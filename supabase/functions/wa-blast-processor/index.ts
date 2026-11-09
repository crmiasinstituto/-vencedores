/**
 * wa-blast-processor — Processor de campanhas wa_campaigns (substitui campaign-processor).
 *
 * SCHEMA SQUAAD (single-tenant, anti-ban):
 *  - wa_campaigns:        dedicated_instance_id NOT NULL, max_per_hour/day, cooldown
 *  - wa_campaign_leads:   pending → sending → sent | failed | skipped
 *  - wa_campaign_instance_stats: sent_today, sent_this_hour, last_sent_at, warmup_messages_today
 *
 * TRAVAS:
 *  - assert_wa_campaign_safe(): bloqueia se instância não é is_dedicated_blast=true
 *  - Respeita confirmed_opt_in_only (populate_wa_campaign_leads já filtrou)
 *  - max_per_hour/max_per_day por instância
 *  - cooldown_min/max entre mensagens (UAZAPI)
 *  - Cloud API (Meta) pula cooldown — rate-limit nativo
 *  - Stale lock recovery: leads 'sending' >5min voltam pra 'pending'
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55") && cleaned.length <= 11) cleaned = "55" + cleaned;
  return cleaned;
}

function normalizeName(raw: string): string {
  if (!raw) return "";
  let name = raw.trim();
  // 3,9 mil leads vieram da planilha com nome "null"/"nan": sem isso a mensagem sai "Olá Null".
  if (/^(null|nan|undefined|none|-)$/i.test(name)) return "";
  if (/^[A-Za-zÀ-ú]( [A-Za-zÀ-ú]){2,}$/.test(name)) name = name.replace(/ /g, "");
  return name
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_m, space, letter) => space + letter.toUpperCase())
    .replace(/\s(Da|De|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());
}

function resolveVariables(template: string, lead: any): string {
  let msg = template;
  const fullName = normalizeName(lead.name || "");
  const firstName = fullName.split(" ")[0];
  const onbToken = lead.onboarding_token || "";
  const appUrl = Deno.env.get("APP_PUBLIC_URL") || "https://squaad.com.br";
  const onbUrl = onbToken ? `${appUrl}/m/${onbToken}` : "";
  msg = msg.replace(/\{\{nome\}\}/g, fullName);
  msg = msg.replace(/\{\{primeiro_nome\}\}/g, firstName);
  msg = msg.replace(/\{\{email\}\}/g, lead.email || "");
  msg = msg.replace(/\{\{whatsapp\}\}/g, lead.whatsapp || "");
  msg = msg.replace(/\{\{empresa\}\}/g, lead.company_name || "");
  msg = msg.replace(/\{\{onboarding_token\}\}/g, onbToken);
  msg = msg.replace(/\{\{onboarding_url\}\}/g, onbUrl);
  return msg;
}

function buildTemplateParams(paramConfig: any[], lead: any): any[] {
  if (!Array.isArray(paramConfig) || paramConfig.length === 0) return [];
  const sorted = [...paramConfig].sort((a, b) => (a.index || 0) - (b.index || 0));
  const fullName = normalizeName(lead.name || "");
  const firstName = fullName.split(" ")[0];
  const onbToken = lead.onboarding_token || "";
  const appUrl = Deno.env.get("APP_PUBLIC_URL") || "https://squaad.com.br";
  const onbUrl = onbToken ? `${appUrl}/m/${onbToken}` : "";
  return sorted.map((p: any) => {
    let value = "";
    if (p.type === "static") value = String(p.value || "");
    else if (p.type === "lead_field") {
      const field = String(p.value || "");
      switch (field) {
        case "nome": case "name": value = fullName; break;
        case "primeiro_nome": case "first_name": value = firstName; break;
        case "email": value = lead.email || ""; break;
        case "whatsapp": case "phone": case "telefone": value = lead.whatsapp || ""; break;
        case "empresa": case "company_name": value = lead.company_name || ""; break;
        case "onboarding_token": value = onbToken; break;
        case "onboarding_url": value = onbUrl; break;
        default: value = String((lead as any)[field] || "");
      }
    }
    return { type: "text", text: value || "_" };
  });
}

// Detecta se template tem botao URL com placeholder {{N}}. Se sim, automaticamente
// resolve o placeholder pro onboarding_token do lead. Ordem dos botoes URL == ordem
// de envio. Hoje so suportamos 1 botao URL dinamico, preenchido com token onboarding.
function buildButtonUrlParams(templateComponents: any[], lead: any): string[] {
  if (!Array.isArray(templateComponents)) return [];
  const out: string[] = [];
  for (const c of templateComponents) {
    if (c?.type !== "BUTTONS" || !Array.isArray(c.buttons)) continue;
    for (const b of c.buttons) {
      if (b?.type === "URL" && typeof b.url === "string" && /\{\{\s*\d+\s*\}\}/.test(b.url)) {
        out.push(lead.onboarding_token || "");
      }
    }
  }
  return out;
}

function isUazapiSuccess(resp: Response, result: any): { success: boolean; messageId: string } {
  if (!resp.ok) return { success: false, messageId: "" };
  if (result.messageId) return { success: true, messageId: result.messageId };
  if (result.id && (result.fromMe === true || result.chatid)) return { success: true, messageId: result.id };
  if (result.key?.id) return { success: true, messageId: result.key.id };
  if (result.status === "PENDING") return { success: true, messageId: "" };
  return { success: false, messageId: "" };
}

function isDisconnectedError(resp: Response, result: any, errorMsg: string): boolean {
  if (result.error === true && typeof result.message !== "string" && !result.messageId) return true;
  const patterns = ["disconnect", "not connected", "not logged", "qr code", "session closed", "connection lost", "not ready"];
  return patterns.some((p) => errorMsg.toLowerCase().includes(p));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: campaigns, error: cErr } = await supabase
      .from("wa_campaigns")
      .select("*")
      .eq("status", "sending");
    if (cErr) throw cErr;
    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ processed: 0, reason: "no_sending_campaigns" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;
    const details: any[] = [];
    for (const campaign of campaigns) {
      try {
        const r = await processCampaign(supabase, campaign);
        totalProcessed += r.processed;
        details.push({ campaign_id: campaign.id, name: campaign.name, ...r });
      } catch (err: any) {
        console.error(`[wa-blast] error on ${campaign.id}:`, err);
        details.push({ campaign_id: campaign.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: totalProcessed, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processCampaign(supabase: any, campaign: any) {
  // 1) ASSERT: instância dedicada e marcada anti-ban
  try {
    const { error: assertErr } = await supabase.rpc("assert_wa_campaign_safe", { p_campaign_id: campaign.id });
    if (assertErr) {
      await supabase
        .from("wa_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
      return { processed: 0, reason: `unsafe_instance: ${assertErr.message}` };
    }
  } catch (e: any) {
    return { processed: 0, reason: `assert_failed: ${e.message}` };
  }

  const instanceId = campaign.dedicated_instance_id;
  const isCloudApi = (campaign.provider || "uazapi") === "cloud_api";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentHour = now.getHours();

  // 2) Rate-limit check (stats por instância)
  if (!isCloudApi) {
    const { data: stats } = await supabase
      .from("wa_campaign_instance_stats")
      .select("*")
      .eq("instance_id", instanceId)
      .maybeSingle();

    let sentHour = 0;
    let sentDay = 0;
    if (stats) {
      const hourWin = stats.last_hour_window_at ? new Date(stats.last_hour_window_at) : null;
      const dayWin = stats.last_day_window_at ? new Date(stats.last_day_window_at) : null;
      sentHour = hourWin && (now.getTime() - hourWin.getTime() < 3600_000) ? (stats.sent_this_hour || 0) : 0;
      sentDay = dayWin && dayWin.toISOString().slice(0, 10) === today ? (stats.sent_today || 0) : 0;
    }
    if (sentHour >= campaign.max_per_hour) return { processed: 0, reason: "hour_limit" };
    if (sentDay >= campaign.max_per_day) return { processed: 0, reason: "day_limit" };
  }

  // 3) Stale lock recovery (>5min em sending)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("wa_campaign_leads")
    .select("id")
    .eq("campaign_id", campaign.id)
    .eq("status", "sending")
    .lt("updated_at", fiveMinAgo);
  if (stale && stale.length > 0) {
    await supabase
      .from("wa_campaign_leads")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .in("id", stale.map((s: any) => s.id));
  }

  // 4) Lock: outro processor ainda ativo?
  const { count: sendingCount } = await supabase
    .from("wa_campaign_leads")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("status", "sending");
  if (sendingCount && sendingCount > 0) {
    return { processed: 0, reason: "batch_already_processing" };
  }

  // 5) Pega batch
  const batchSize = isCloudApi ? 50 : 2;
  const { data: pending, error: pErr } = await supabase
    .from("wa_campaign_leads")
    .select("id, lead_id, whatsapp, assigned_to, lead:crm_leads(id, name, email, whatsapp, company_name, onboarding_token, tags, nao_contatar)")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (pErr) throw pErr;
  if (!pending || pending.length === 0) {
    const { count: remaining } = await supabase
      .from("wa_campaign_leads")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .in("status", ["pending", "sending"]);
    if (!remaining || remaining === 0) {
      await supabase
        .from("wa_campaigns")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", campaign.id);
    }
    return { processed: 0, reason: "no_pending" };
  }

  const ids = pending.map((p: any) => p.id);
  await supabase
    .from("wa_campaign_leads")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .in("id", ids);

  // 6) Instance data
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name, api_key, api_url, provider, phone_number_id")
    .eq("id", instanceId)
    .single();
  if (!instance?.api_key) {
    await supabase
      .from("wa_campaign_leads")
      .update({ status: "failed", error_message: "Instance sem api_key", failed_at: new Date().toISOString() })
      .in("id", ids);
    return { processed: 0, reason: "instance_no_key" };
  }

  let processed = 0;
  let skipped = 0;
  // Contadores DESTE lote. campaign.sent_count/failed_count sao um snapshot lido antes do loop,
  // entao os incrementos tem que somar em cima dele, e nao ser recalculados a cada lead.
  let sentInRun = 0;
  let failedInRun = 0;

  for (let i = 0; i < pending.length; i++) {
    const cl: any = pending[i];
    const lead = cl.lead;
    // Quem pediu pra parar DEPOIS que a campanha montou a fila (respondeu "não tenho
    // interesse", foi marcado "Não contatar" ou a Meta devolveu opt-out) não recebe.
    const bloqueado = !!lead && (lead.nao_contatar === true || (lead.tags || []).includes("whatsapp_optout"));
    if (!lead || !cl.whatsapp || bloqueado) {
      await supabase
        .from("wa_campaign_leads")
        .update({
          status: "skipped",
          error_message: !lead ? "lead nao encontrado" : !cl.whatsapp ? "sem whatsapp" : "nao contatar (pediu pra parar)",
          updated_at: new Date().toISOString(),
        })
        .eq("id", cl.id);
      skipped++;
      continue;
    }

    const resolvedMessage = campaign.message_text ? resolveVariables(campaign.message_text, lead) : "";
    await supabase
      .from("wa_campaign_leads")
      .update({ instance_id: instanceId, resolved_message: resolvedMessage, updated_at: new Date().toISOString() })
      .eq("id", cl.id);

    try {
      const phone = formatPhone(cl.whatsapp);
      let success = false;
      let messageId = "";
      let errMsg = "";
      let resp: Response | null = null;
      let result: any = null;

      if (isCloudApi) {
        const { data: tpl } = await supabase
          .from("whatsapp_cloud_templates")
          .select("name, language, status, components")
          .eq("id", campaign.cloud_template_id)
          .maybeSingle();
        if (!tpl?.name) {
          await supabase
            .from("wa_campaign_leads")
            .update({ status: "failed", error_message: "Template Meta nao encontrado", failed_at: new Date().toISOString() })
            .eq("id", cl.id);
          continue;
        }
        if (String(tpl.status || "").toUpperCase() !== "APPROVED") {
          await supabase
            .from("wa_campaign_leads")
            .update({ status: "failed", error_message: `template nao APPROVED (${tpl.status})`, failed_at: new Date().toISOString() })
            .eq("id", cl.id);
          continue;
        }
        // Garante onboarding_token se template usa botao URL dinamico OU variavel onboarding_url/token
        const needsOnboardingToken = !lead.onboarding_token && (
          (Array.isArray(tpl.components) && tpl.components.some((c: any) =>
            c?.type === "BUTTONS" && Array.isArray(c.buttons) &&
            c.buttons.some((b: any) => b?.type === "URL" && /\{\{\s*\d+\s*\}\}/.test(b.url || ""))
          )) ||
          (Array.isArray(campaign.cloud_template_params) && campaign.cloud_template_params.some(
            (p: any) => p?.type === "lead_field" && (p.value === "onboarding_token" || p.value === "onboarding_url")
          ))
        );
        if (needsOnboardingToken) {
          try {
            const { data: tokenRpc } = await supabase.rpc("onboarding_ensure_token", { p_lead_id: lead.id });
            if (tokenRpc) lead.onboarding_token = tokenRpc;
          } catch (e) { console.warn(`onboarding_ensure_token failed for ${lead.id}:`, e); }
        }
        const params = buildTemplateParams(campaign.cloud_template_params || [], lead);
        const buttonUrlParams = buildButtonUrlParams(tpl.components || [], lead);

        // Template com HEADER de mídia (VIDEO/IMAGE/DOCUMENT) exige o arquivo em TODO envio —
        // o header_handle do template aprovado não vale (ver comentário em wa-send-cloud).
        // A fonte é wa_campaigns.media_url: URL pública (vira `link`) ou media_id da Meta (`id`).
        const headerComp = (tpl.components || []).find((c: any) => c?.type === "HEADER");
        const headerFormat = String(headerComp?.format || "TEXT").toUpperCase();
        let headerMedia: any = null;
        if (["VIDEO", "IMAGE", "DOCUMENT"].includes(headerFormat)) {
          const asset = String(campaign.media_url || "").trim();
          if (!asset) {
            await supabase
              .from("wa_campaign_leads")
              .update({
                status: "failed",
                error_message: `template '${tpl.name}' tem header ${headerFormat} e a campanha esta sem media_url — informe a URL publica (ou media_id) do arquivo`,
                failed_at: new Date().toISOString(),
              })
              .eq("id", cl.id);
            continue;
          }
          headerMedia = asset.startsWith("http")
            ? { type: headerFormat.toLowerCase(), link: asset }
            : { type: headerFormat.toLowerCase(), id: asset };
        }

        resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-send-cloud`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            instance_id: instanceId,
            action: "send_template",
            phone,
            template_name: tpl.name,
            template_language: tpl.language || "pt_BR",
            template_params: params.map((p) => p.text),
            button_url_params: buttonUrlParams,
            header_media: headerMedia,
            lead_id: lead.id,
            campaign_id: campaign.id,
          }),
        });
        result = await resp.json();
        success = resp.ok && !result.error;
        messageId = result.message_id || "";
        errMsg = result.error || "";
      } else {
        if (!instance.api_url) throw new Error("instance.api_url ausente (UAZAPI)");
        resp = await fetch(`${instance.api_url}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: instance.api_key },
          body: JSON.stringify({ number: phone, text: resolvedMessage }),
        });
        result = await resp.json();
        const r = isUazapiSuccess(resp, result);
        success = r.success;
        messageId = r.messageId;
        errMsg = success ? "" : (result.message || JSON.stringify(result).slice(0, 300));

        if (!success && isDisconnectedError(resp, result, errMsg)) {
          await supabase
            .from("wa_campaign_leads")
            .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
            .eq("id", cl.id);
          await supabase
            .from("whatsapp_instances")
            .update({ status: "disconnected", updated_at: new Date().toISOString() })
            .eq("id", instanceId);
          break;
        }
      }

      const nowIso = new Date().toISOString();
      if (success) {
        await supabase
          .from("wa_campaign_leads")
          .update({ status: "sent", whatsapp_message_id: messageId, sent_at: nowIso, updated_at: nowIso })
          .eq("id", cl.id);

        // wa_campaigns.sent_count++
        // Usa contador de SUCESSOS do lote, nao o indice do loop: com `+ 1 + i` cada lead que
        // falhava no meio do lote ainda empurrava o sent_count pra cima (1 lead virava "2 enviados").
        sentInRun++;
        await supabase
          .from("wa_campaigns")
          .update({ sent_count: (campaign.sent_count || 0) + sentInRun, updated_at: nowIso })
          .eq("id", campaign.id);

        // wa_campaign_instance_stats
        const { data: existingStats } = await supabase
          .from("wa_campaign_instance_stats")
          .select("*")
          .eq("instance_id", instanceId)
          .maybeSingle();
        const sameDay = existingStats?.last_day_window_at &&
          new Date(existingStats.last_day_window_at).toISOString().slice(0, 10) === today;
        const sameHourBucket = existingStats?.last_hour_window_at &&
          (new Date().getTime() - new Date(existingStats.last_hour_window_at).getTime() < 3600_000);
        if (existingStats) {
          await supabase
            .from("wa_campaign_instance_stats")
            .update({
              sent_today: sameDay ? (existingStats.sent_today || 0) + 1 : 1,
              sent_this_hour: sameHourBucket ? (existingStats.sent_this_hour || 0) + 1 : 1,
              last_sent_at: nowIso,
              last_hour_window_at: sameHourBucket ? existingStats.last_hour_window_at : nowIso,
              last_day_window_at: sameDay ? existingStats.last_day_window_at : nowIso,
              updated_at: nowIso,
            })
            .eq("instance_id", instanceId);
        } else {
          await supabase.from("wa_campaign_instance_stats").insert({
            instance_id: instanceId,
            sent_today: 1,
            sent_this_hour: 1,
            last_sent_at: nowIso,
            last_hour_window_at: nowIso,
            last_day_window_at: nowIso,
          });
        }

        // timeline em crm_activities
        try {
          await supabase.from("crm_activities").insert({
            lead_id: lead.id,
            board_id: null,
            activity_type: "wa_blast_sent",
            description: `Campanha "${campaign.name}": ${resolvedMessage.slice(0, 200)}`,
            metadata: { campaign_id: campaign.id, message_id: messageId, instance_id: instanceId },
          });
        } catch {/* non-fatal */}

        processed++;
      } else {
        await supabase
          .from("wa_campaign_leads")
          .update({
            status: "failed",
            error_message: String(errMsg).slice(0, 500),
            failed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", cl.id);
        // Mesmo motivo do sent_count, ao contrario: `+ 1` em cima do snapshot fazia todo lote
        // com N falhas gravar sempre base+1, ou seja, so a primeira falha era contabilizada.
        failedInRun++;
        await supabase
          .from("wa_campaigns")
          .update({ failed_count: (campaign.failed_count || 0) + failedInRun, updated_at: nowIso })
          .eq("id", campaign.id);
      }
    } catch (sendErr: any) {
      console.error(`[wa-blast] send error lead ${lead.id}:`, sendErr);
      await supabase
        .from("wa_campaign_leads")
        .update({
          status: "failed",
          error_message: String(sendErr.message || "unknown").slice(0, 500),
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cl.id);
    }

    // Cooldown (UAZAPI only)
    if (i < pending.length - 1 && !isCloudApi) {
      const min = campaign.cooldown_min_seconds || 45;
      const max = campaign.cooldown_max_seconds || 90;
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      console.log(`[wa-blast] cooldown ${delay}s`);
      await sleep(delay * 1000);
    }
  }

  return { processed, skipped };
}
