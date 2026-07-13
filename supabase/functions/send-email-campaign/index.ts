import { createClient } from "npm:@supabase/supabase-js@2";

// ─── Inlined: email-config helper (era ../_shared-marketing/email-config.ts) ───
// Inlined porque deploy via Management API só aceita 1 arquivo. CLI normal
// resolveria via bundle, mas estamos sem CLI configurado.
interface EmailConfig {
  id: string;
  resend_api_key: string | null;
  resend_webhook_secret: string | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  company_address: string | null;
  company_name: string | null;
  app_url: string | null;
  is_active: boolean;
  domain_verified: boolean;
}

async function getEmailConfig(supabase: any): Promise<EmailConfig | null> {
  const { data, error } = await supabase
    .from("email_config")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) {
    console.error("Erro ao ler email_config:", error);
    return null;
  }
  return data || null;
}

function requireActiveConfig(config: EmailConfig | null): EmailConfig {
  if (!config) throw new Error("email_config (singleton) não encontrado.");
  if (!config.is_active) throw new Error("Email marketing inativo. Ative em /admin/marketing/config.");
  if (!config.resend_api_key) throw new Error("RESEND_API_KEY não configurada.");
  if (!config.from_email) throw new Error("from_email não configurado.");
  return config;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface AudienceCriteria {
  board_ids?: string[];
  column_ids?: string[];
  lead_ids?: string[];
  sources?: string[];
  assigned_to_any?: string[];
  tags_any?: string[];
  onboarding_status?: "any" | "completed" | "pending";
}

interface SendBody {
  campaign_id?: string;
  test_email?: string;
  html?: string;
  subject?: string;
  audience_override?: AudienceCriteria;
}

interface Recipient {
  lead_id: string | null;
  email: string;
  name: string | null;
  first_name: string | null;
  whatsapp: string | null;
  company_name: string | null;
  assigned_to: string | null;
}

async function resolveAudienceByCriteria(supabase: any, criteria: AudienceCriteria): Promise<Recipient[]> {
  if (!criteria) return [];

  let q = supabase
    .from("crm_leads")
    .select("id, name, email, whatsapp, company_name, assigned_to, board_id, column_id, source, tags, email_opted_out, onboarding_completed_at")
    .not("email", "is", null)
    .neq("email", "");

  if (criteria.lead_ids?.length) {
    q = q.in("id", criteria.lead_ids);
  } else {
    if (criteria.board_ids?.length) q = q.in("board_id", criteria.board_ids);
    if (criteria.column_ids?.length) q = q.in("column_id", criteria.column_ids);
    if (criteria.sources?.length) q = q.in("source", criteria.sources);
    if (criteria.assigned_to_any?.length) q = q.in("assigned_to", criteria.assigned_to_any);
    if (criteria.tags_any?.length) q = q.overlaps("tags", criteria.tags_any);
    if (criteria.onboarding_status === "completed") q = q.not("onboarding_completed_at", "is", null);
    else if (criteria.onboarding_status === "pending") q = q.is("onboarding_completed_at", null);
  }

  const { data: leads, error } = await q.limit(10000);
  if (error) throw error;

  const filtered = (leads || []).filter((l: any) => !l.email_opted_out);
  const emails = filtered.map((l: any) => l.email).filter(Boolean);
  if (emails.length === 0) return [];

  const { data: unsubs } = await supabase
    .from("email_subscribers")
    .select("email")
    .in("email", emails)
    .in("status", ["unsubscribed", "bounced", "complained"]);
  const unsubSet = new Set((unsubs || []).map((u: any) => u.email));

  const { data: hardUnsubs } = await supabase
    .from("email_unsubscribes")
    .select("email")
    .in("email", emails);
  (hardUnsubs || []).forEach((u: any) => unsubSet.add(u.email));

  return filtered
    .filter((l: any) => !unsubSet.has(l.email))
    .map((l: any) => ({
      lead_id: l.id,
      email: l.email,
      name: l.name,
      first_name: l.name ? l.name.split(" ")[0] : null,
      whatsapp: l.whatsapp || null,
      company_name: l.company_name || null,
      assigned_to: l.assigned_to || null,
    }));
}

async function getOrCreateUnsubscribeToken(supabase: any, email: string, leadId: string | null): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from("email_subscribers")
      .select("unsubscribe_token, status")
      .eq("email", email)
      .maybeSingle();
    if (existing?.unsubscribe_token) {
      return existing.status === "unsubscribed" || existing.status === "complained"
        ? null
        : existing.unsubscribe_token;
    }
    const { data: created } = await supabase
      .from("email_subscribers")
      .insert({
        email,
        lead_id: leadId,
        status: "subscribed",
        consent_source: "campaign_send",
        consent_at: new Date().toISOString(),
      })
      .select("unsubscribe_token")
      .single();
    return created?.unsubscribe_token || null;
  } catch (e) {
    console.error("Erro ao gerar unsubscribe token:", e);
    return null;
  }
}

function injectComplianceFooter(html: string, unsubscribeUrl: string, config: EmailConfig): string {
  const address = config.company_address || config.company_name || "";
  const replyEmail = config.reply_to || config.from_email || "";
  const footer = `
<table role="presentation" width="100%" style="margin-top:32px;border-top:1px solid #e5e5e5;padding:24px 0;">
  <tr>
    <td style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#999;line-height:1.6;">
      ${address ? `<p style="margin:0 0 8px;">${address}</p>` : ""}
      <p style="margin:0;">
        <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Descadastrar</a>
        ${replyEmail ? `· <a href="mailto:${replyEmail}" style="color:#999;text-decoration:underline;">Contato</a>` : ""}
      </p>
    </td>
  </tr>
</table>`;
  if (html.includes("</body>")) return html.replace("</body>", `${footer}</body>`);
  return html + footer;
}

function substituteVariables(text: string, vars: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: SendBody = await req.json();
    const { campaign_id, test_email, audience_override } = body;

    // === MODO TESTE (sem campaign_id) ===
    if (!campaign_id && test_email && body.html) {
      const cfg = requireActiveConfig(await getEmailConfig(supabase));
      const fEmail = (cfg.from_email || "").trim();
      const fName = (cfg.from_name || "CRM").trim();
      const appUrlT = cfg.app_url || "https://squaadcrm.com";
      const variables: Record<string, string> = {
        nome: "Teste",
        primeiro_nome: "Teste",
        empresa: cfg.company_name || "Empresa",
        email: test_email,
        whatsapp: "(11) 99999-9999",
        vendedor: "Vendedor de Teste",
        unsubscribe_url: `${appUrlT}/unsubscribe?token=teste`,
        link_descadastro: `${appUrlT}/unsubscribe?token=teste`,
      };
      const html = substituteVariables(body.html, variables);
      const subject = `[TESTE] ${substituteVariables(body.subject || "Teste de template", variables)}`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${cfg.resend_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${fName} <${fEmail}>`,
          to: [test_email],
          subject,
          html,
          reply_to: cfg.reply_to || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true, test: true, sent_to: test_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaign_id) throw new Error("campaign_id é obrigatório");

    const { data: campaign, error: campaignErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();
    if (campaignErr || !campaign) throw new Error("Campanha não encontrada");

    const config = requireActiveConfig(await getEmailConfig(supabase));
    const fromEmail = (campaign.from_email || config.from_email || "").trim();
    const fromName = (campaign.from_name || config.from_name || "").trim() || "CRM";
    const replyTo = campaign.reply_to || config.reply_to || undefined;
    const appUrl = config.app_url || "https://squaadcrm.com";

    if (test_email) {
      const variables: Record<string, string> = {
        nome: "Teste",
        primeiro_nome: "Teste",
        empresa: config.company_name || "Empresa",
        email: test_email,
        whatsapp: "(11) 99999-9999",
        vendedor: "Vendedor de Teste",
        unsubscribe_url: `${appUrl}/unsubscribe?token=teste`,
      };
      const baseHtml = body.html || `<p>${campaign.subject}</p>`;
      const html = substituteVariables(baseHtml, variables);
      const subject = `[TESTE] ${substituteVariables(campaign.subject, variables)}`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${config.resend_api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [test_email],
          subject,
          html,
          reply_to: replyTo,
        }),
      });
      if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true, test: true, sent_to: test_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bloqueia reprocessamento total de campanha completed/cancelled.
    // EXCETO se vier audience_override (= retry intencional de leads especificos,
    // ex: "Corrigir e reenviar" no painel da campanha pra leads failed).
    if ((campaign.status === "completed" || campaign.status === "cancelled") && !audience_override) {
      return new Response(
        JSON.stringify({ error: `Campanha já está ${campaign.status}. Pra reenviar pra leads específicos, passe audience_override.` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Só seta 'sending' se ainda não foi processada (retries de completed mantém status)
    if (campaign.status !== "completed" && campaign.status !== "cancelled") {
      await supabase
        .from("email_campaigns")
        .update({ status: "sending", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", campaign_id);
    }

    let audience: Recipient[] = [];
    if (audience_override) {
      audience = await resolveAudienceByCriteria(supabase, audience_override);
    } else {
      const filters = (campaign as any).audience_filters || {};
      audience = await resolveAudienceByCriteria(supabase, filters);
      if (audience.length === 0) {
        const { data: ecls } = await supabase
          .from("email_campaign_leads")
          .select("lead_id, email")
          .eq("campaign_id", campaign_id)
          .eq("status", "pending");
        const leadIds = (ecls || []).map((r: any) => r.lead_id).filter(Boolean);
        if (leadIds.length) audience = await resolveAudienceByCriteria(supabase, { lead_ids: leadIds });
      }
    }

    if (audience.length === 0) {
      await supabase
        .from("email_campaigns")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", campaign_id);
      throw new Error("Nenhum destinatário encontrado");
    }

    await supabase
      .from("email_campaigns")
      .update({ total_leads: audience.length, total_recipients: audience.length })
      .eq("id", campaign_id);

    const from = `${fromName} <${fromEmail}>`;
    let sent = 0;
    let failed = 0;

    const bgTask = (async () => {
      for (const recipient of audience) {
        try {
          const token = await getOrCreateUnsubscribeToken(supabase, recipient.email, recipient.lead_id);
          if (!token) {
            console.log(`Skip ${recipient.email} (unsubscribed/complained)`);
            continue;
          }
          const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}`;

          // Onboarding URL único por lead (Masterclass IA wizard).
          // Garante token + monta /m/<token>. Se RPC falhar, link cai pro home.
          let onboardingUrl = `${appUrl}/`;
          try {
            if (recipient.lead_id) {
              const { data: onbToken } = await supabase
                .rpc("onboarding_ensure_token", { p_lead_id: recipient.lead_id });
              if (onbToken) onboardingUrl = `${appUrl}/m/${onbToken}`;
            }
          } catch (e) {
            console.warn(`onboarding_ensure_token falhou pra lead=${recipient.lead_id}:`, e);
          }

          const variables: Record<string, string> = {
            nome: recipient.name || "",
            primeiro_nome: recipient.first_name || "",
            email: recipient.email,
            empresa: recipient.company_name || config.company_name || "",
            whatsapp: recipient.whatsapp || "",
            vendedor: recipient.assigned_to || "",
            unsubscribe_url: unsubscribeUrl,
            link_descadastro: unsubscribeUrl,
            // Onboarding único pro wizard pós-compra Masterclass
            onboarding_url: onboardingUrl,
            link_onboarding: onboardingUrl,
            link_plataforma: onboardingUrl,
            acessar_plataforma: onboardingUrl,
          };
          const baseHtml = body.html || (campaign as any).html_content || `<p>${campaign.subject}</p>`;
          let html = substituteVariables(baseHtml, variables);
          html = injectComplianceFooter(html, unsubscribeUrl, config);
          const subject = substituteVariables(campaign.subject, variables);

          const { data: sendRow } = await supabase
            .from("email_sends")
            .insert({
              campaign_id,
              lead_id: recipient.lead_id,
              email: recipient.email,
              status: "pending",
              html,
            })
            .select("id")
            .single();

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${config.resend_api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from,
              to: [recipient.email],
              subject,
              html,
              reply_to: replyTo,
              headers: {
                "X-Campaign-ID": campaign_id,
                "X-Send-ID": sendRow?.id || "",
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const nowIso = new Date().toISOString();
            await supabase
              .from("email_sends")
              .update({ status: "sent", sent_at: nowIso, resend_id: data.id })
              .eq("id", sendRow!.id);
            await supabase
              .from("email_campaign_leads")
              .update({ status: "sent", sent_at: nowIso, resend_id: data.id })
              .eq("campaign_id", campaign_id)
              .eq("email", recipient.email);
            sent++;
          } else {
            const errText = await res.text();
            await supabase
              .from("email_sends")
              .update({ status: "failed", error_message: errText.slice(0, 500) })
              .eq("id", sendRow!.id);
            await supabase
              .from("email_campaign_leads")
              .update({ status: "failed", error_message: errText.slice(0, 500) })
              .eq("campaign_id", campaign_id)
              .eq("email", recipient.email);
            failed++;
          }
        } catch (err) {
          console.error(`Erro enviando pra ${recipient.email}:`, err);
          failed++;
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      await supabase
        .from("email_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          sent_count: sent,
          failed_count: failed,
          total_sent: sent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);
      console.log(`Campaign ${campaign_id} done: ${sent} sent, ${failed} failed`);
    })();

    // @ts-ignore EdgeRuntime global
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(bgTask);

    return new Response(
      JSON.stringify({ success: true, message: "Campanha em envio", recipients: audience.length }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
