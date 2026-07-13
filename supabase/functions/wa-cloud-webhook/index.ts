/**
 * wa-cloud-webhook — Receiver oficial Meta WhatsApp Cloud API.
 *
 * GET  → Verificação inicial da Meta (hub.mode=subscribe, hub.verify_token, hub.challenge).
 *        Retorna hub.challenge se o token bater com env WHATSAPP_CLOUD_VERIFY_TOKEN.
 *
 * POST → Eventos do webhook. Estrutura Meta:
 *   {
 *     object: 'whatsapp_business_account',
 *     entry: [{
 *       id: <waba_id>,
 *       changes: [{
 *         field: 'messages',
 *         value: {
 *           messaging_product: 'whatsapp',
 *           metadata: { display_phone_number, phone_number_id },
 *           contacts?: [{ profile: { name }, wa_id }],
 *           messages?: [...],     // INBOUND
 *           statuses?: [...],     // sent | delivered | read | failed
 *           errors?: [...],
 *         }
 *       }]
 *     }]
 *   }
 *
 * Comportamento:
 *  - messages INBOUND → grava em whatsapp_messages (direction='inbound'), atualiza last_message_at do lead,
 *    marca wa_campaign_leads.status='responded' se houver match recente, atualiza first_contact_at.
 *  - statuses → atualiza whatsapp_messages.status pelo whatsapp_message_id, atualiza wa_campaign_leads
 *    (delivered_at/read_at), e em caso de erro de bloqueio (code 131026/131047/131048) marca lead como 'blocked'.
 *  - Errors no payload → grava em wa_campaign_instance_stats.last_error pra alerta no painel.
 *
 * Auth:
 *  - Resposta ao Meta NÃO precisa de auth (Meta valida via verify_token na criação).
 *  - Assinatura X-Hub-Signature-256 (HMAC SHA-256 com APP_SECRET) é validada se WHATSAPP_CLOUD_APP_SECRET estiver setado.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_CLOUD_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("WHATSAPP_CLOUD_APP_SECRET") || "";
// Fail-closed: sem APP_SECRET, webhook recusa POSTs.
// Só ative INSECURE em dev local com tunnel (ngrok) pra testar handshake.
const INSECURE_MODE = (Deno.env.get("WHATSAPP_CLOUD_WEBHOOK_INSECURE") || "").toLowerCase() === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Bloqueio / spam detection codes (Meta WhatsApp Business Platform)
// 131026 — Message undeliverable (recipient not on WA / no consent)
// 131047 — Re-engagement / 24h window expired
// 131048 — Spam rate limit (lead reportou)
// 131049 — User capacity / experiment block
// 131050 — User stopped marketing (opt-out)
// 368    — Account violates WhatsApp policies
const BLOCK_ERROR_CODES = new Set([131026, 131048, 131049, 131050, 368]);

async function verifyHmac(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!APP_SECRET) {
    // Sem secret: só passa se modo inseguro explícito (dev local). Em prod = recusa.
    return INSECURE_MODE;
  }
  if (!signatureHeader) return false;
  const expected = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Comparação constante (timing-safe)
  if (hex.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function normPhone(raw: string): string {
  let n = (raw || "").replace(/\D/g, "");
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ============ GET: Verification handshake ============
  if (req.method === "GET") {
    const u = new URL(req.url);
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(challenge || "", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    console.warn("[wa-cloud-webhook] verify_failed", { mode, token_matches: token === VERIFY_TOKEN });
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  // ============ POST: Event ingest ============
  const rawBody = await req.text();

  // HMAC validation (Meta envia X-Hub-Signature-256: sha256=<hex>)
  const sigHeader = req.headers.get("x-hub-signature-256") || req.headers.get("X-Hub-Signature-256");
  const sigOk = await verifyHmac(rawBody, sigHeader);
  if (!sigOk) {
    console.warn("[wa-cloud-webhook] invalid_signature", { has_secret: !!APP_SECRET, has_header: !!sigHeader });
    return new Response("invalid_signature", { status: 403, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid_json", { status: 400, headers: corsHeaders });
  }

  // Meta requer 200 OK rápido (<20s) ou desabilita o webhook após retries.
  // Processa de forma resiliente: erros parciais não derrubam o ack.
  const results: any[] = [];

  for (const entry of payload?.entry || []) {
    const wabaId = entry.id;
    for (const change of entry?.changes || []) {
      if (change.field !== "messages") continue; // só interessa esse field por enquanto
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;

      // Resolve instância (cloud_api) pelo phone_number_id
      let instance: any = null;
      if (phoneNumberId) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id, instance_name, business_account_id")
          .eq("provider", "cloud_api")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();
        instance = data;
      }
      const instanceId = instance?.id || null;

      // ---- INBOUND messages ----
      for (const msg of value?.messages || []) {
        try {
          await handleInboundMessage(supabase, instanceId, value, msg);
          results.push({ type: "inbound", id: msg.id, ok: true });
        } catch (e: any) {
          console.error("[wa-cloud-webhook] inbound error:", e?.message);
          results.push({ type: "inbound", id: msg?.id, ok: false, error: e?.message });
        }
      }

      // ---- STATUSES ----
      for (const status of value?.statuses || []) {
        try {
          await handleStatus(supabase, instanceId, status);
          results.push({ type: "status", id: status.id, status: status.status, ok: true });
        } catch (e: any) {
          console.error("[wa-cloud-webhook] status error:", e?.message);
          results.push({ type: "status", id: status?.id, ok: false, error: e?.message });
        }
      }

      // ---- ERRORS at value-level (rate-limit, account issues) ----
      for (const err of value?.errors || []) {
        try {
          if (instanceId) {
            await supabase.from("wa_campaign_instance_stats").upsert(
              {
                instance_id: instanceId,
                last_error: `[${err.code}] ${err.title || err.message || ""}`.slice(0, 500),
                last_error_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any,
              { onConflict: "instance_id" } as any,
            );
          }
        } catch {/* non-fatal */}
        results.push({ type: "error", code: err.code, title: err.title });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results: results.slice(0, 20) }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ====================================================================
// Inbound handler
// ====================================================================
async function handleInboundMessage(supabase: any, instanceId: string | null, value: any, msg: any) {
  const fromRaw = msg.from || ""; // já vem em E.164 sem '+'
  const from = normPhone(fromRaw);
  const wamid = msg.id; // wamid.HBgL...
  const ts = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString();
  const profileName = value?.contacts?.[0]?.profile?.name || null;

  // Extrai conteúdo conforme tipo
  let messageType = msg.type || "text";
  let content = "";
  let mediaUrl: string | null = null;
  let mediaId: string | null = null;
  switch (messageType) {
    case "text":
      content = msg.text?.body || "";
      break;
    case "image":
    case "document":
    case "audio":
    case "video":
    case "sticker":
      mediaId = msg[messageType]?.id || null;
      content = msg[messageType]?.caption || `[${messageType}]`;
      break;
    case "location":
      content = `[location] ${msg.location?.latitude},${msg.location?.longitude}`;
      break;
    case "interactive": {
      const i = msg.interactive || {};
      if (i.type === "button_reply") content = `[button] ${i.button_reply?.title}`;
      else if (i.type === "list_reply") content = `[list] ${i.list_reply?.title}`;
      else content = `[interactive:${i.type}]`;
      break;
    }
    case "button":
      content = `[button] ${msg.button?.text || ""}`;
      break;
    case "reaction":
      content = `[reaction] ${msg.reaction?.emoji || ""}`;
      break;
    default:
      content = `[${messageType}]`;
  }

  // Match lead por whatsapp (busca pelo final do número, mais tolerante)
  let leadId: string | null = null;
  const last8 = from.slice(-8);
  if (last8.length >= 8) {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, name, first_contact_at")
      .ilike("whatsapp", `%${last8}`)
      .limit(1)
      .maybeSingle();
    if (lead) {
      leadId = lead.id;
      // first_contact_at: trigger no banco popula, mas garantimos aqui pra inbound
      if (!lead.first_contact_at) {
        await supabase
          .from("crm_leads")
          .update({ first_contact_at: ts, updated_at: new Date().toISOString() })
          .eq("id", lead.id);
      }
    }
  }

  // Persiste mensagem
  await supabase.from("whatsapp_messages").insert({
    instance_id: instanceId,
    lead_id: leadId,
    remote_phone: from,
    direction: "inbound",
    message_type: messageType,
    content,
    media_url: mediaUrl,
    whatsapp_message_id: wamid,
    status: "received",
    metadata: {
      provider: "cloud_api",
      profile_name: profileName,
      media_id: mediaId,
      raw: msg,
      received_at: ts,
    },
  });

  // Auto-trigger DISC PDF: se lead pediu o diagnostico e ja completou o quiz,
  // dispara o envio. disc-pdf-deliver tem dedup interno via disc_pdf_requests,
  // entao chamadas repetidas sao idempotentes.
  if (leadId && content && messageType === "text") {
    const lower = content.toLowerCase();
    const isDiagRequest = /diagn[oó]stico|preciso.*pdf|disc.*pdf|raio-x/i.test(lower);
    if (isDiagRequest) {
      const { data: lead } = await supabase
        .from("crm_leads")
        .select("disc_profile")
        .eq("id", leadId)
        .maybeSingle();
      if (lead?.disc_profile) {
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/disc-pdf-deliver`;
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ lead_id: leadId }),
        }).catch((e) => console.warn("[disc-trigger] failed:", (e as Error).message));
        console.log(`[disc-trigger] PDF requested by lead ${leadId} via inbound msg`);
      }
    }
  }

  // Se há campaign_lead recente outbound pro mesmo número, marca como 'responded'
  if (leadId) {
    const { data: recent } = await supabase
      .from("wa_campaign_leads")
      .select("id, status, sent_at")
      .eq("lead_id", leadId)
      .in("status", ["sent", "delivered", "read"])
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.id) {
      await supabase
        .from("wa_campaign_leads")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
          response_message_id: wamid,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recent.id);
      // increment responded_count na campaign
      const { data: cl } = await supabase
        .from("wa_campaign_leads")
        .select("campaign_id")
        .eq("id", recent.id)
        .single();
      if (cl?.campaign_id) {
        await supabase.rpc("increment_campaign_responded", { p_campaign_id: cl.campaign_id }).then(
          () => {},
          async () => {
            // Fallback se RPC não existir: incrementa via select+update
            const { data: c } = await supabase
              .from("wa_campaigns")
              .select("responded_count")
              .eq("id", cl.campaign_id)
              .single();
            await supabase
              .from("wa_campaigns")
              .update({
                responded_count: (c?.responded_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", cl.campaign_id);
          },
        );
      }
    }
  }
}

// ====================================================================
// Status handler
// ====================================================================
async function handleStatus(supabase: any, instanceId: string | null, status: any) {
  const wamid = status.id;
  const s = status.status; // 'sent' | 'delivered' | 'read' | 'failed'
  const ts = status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();
  const errs: any[] = status.errors || [];

  // Atualiza whatsapp_messages
  const updateMsg: any = { status: s, updated_at: new Date().toISOString() };
  if (s === "delivered") updateMsg.delivered_at = ts;
  if (s === "read") updateMsg.read_at = ts;
  if (s === "failed") {
    updateMsg.failed_at = ts;
    updateMsg.error_message = errs.map((e) => `[${e.code}] ${e.title || e.message || ""}`).join(" | ").slice(0, 500);
  }

  await supabase.from("whatsapp_messages").update(updateMsg).eq("whatsapp_message_id", wamid);

  // Atualiza wa_campaign_leads (se match)
  const { data: cl } = await supabase
    .from("wa_campaign_leads")
    .select("id, campaign_id, lead_id, status")
    .eq("whatsapp_message_id", wamid)
    .maybeSingle();

  if (cl?.id) {
    const update: any = { updated_at: new Date().toISOString() };
    if (s === "delivered") {
      update.delivered_at = ts;
      if (cl.status === "sent") update.status = "delivered";
    } else if (s === "read") {
      update.read_at = ts;
      if (cl.status === "sent" || cl.status === "delivered") update.status = "read";
    } else if (s === "failed") {
      update.failed_at = ts;
      update.status = "failed";
      update.error_message = updateMsg.error_message;

      // Bloqueio / opt-out → marca lead.whatsapp_opt_in=false pra não recontactar
      const hasBlockErr = errs.some((e: any) => BLOCK_ERROR_CODES.has(Number(e.code)));
      if (hasBlockErr && cl.lead_id) {
        update.status = "blocked";
        await supabase
          .from("crm_leads")
          .update({ whatsapp_opt_in: false, updated_at: new Date().toISOString() })
          .eq("id", cl.lead_id);
      }
    }
    await supabase.from("wa_campaign_leads").update(update).eq("id", cl.id);

    // Incrementa contadores na campaign
    if (s === "delivered" || s === "read" || s === "failed") {
      const col =
        s === "delivered" ? "delivered_count" :
        s === "read" ? "read_count" :
        "failed_count";
      const { data: c } = await supabase
        .from("wa_campaigns")
        .select(col)
        .eq("id", cl.campaign_id)
        .single();
      if (c) {
        await supabase
          .from("wa_campaigns")
          .update({ [col]: ((c as any)[col] || 0) + 1, updated_at: new Date().toISOString() })
          .eq("id", cl.campaign_id);
      }
    }
  }

  // Bloqueio detectado → marca stats da instância (alerta no painel)
  const hasBlockErr = errs.some((e: any) => BLOCK_ERROR_CODES.has(Number(e.code)));
  if (hasBlockErr && instanceId) {
    const { data: st } = await supabase
      .from("wa_campaign_instance_stats")
      .select("blocks_detected_day, last_block_at")
      .eq("instance_id", instanceId)
      .maybeSingle();
    await supabase.from("wa_campaign_instance_stats").upsert(
      {
        instance_id: instanceId,
        blocks_detected_day: (st?.blocks_detected_day || 0) + 1,
        last_block_at: new Date().toISOString(),
        last_error: errs.map((e: any) => `[${e.code}] ${e.title || ""}`).join(" | ").slice(0, 500),
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "instance_id" } as any,
    );
  }
}
