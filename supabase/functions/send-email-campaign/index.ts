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

// ─── Parâmetros do motor de disparo ───────────────────────────────────────
// A edge function é abatida no teto de CPU perto dos 150s. Paramos de abrir
// lote novo aos 100s e deixamos o cron `email-campanha-retomar` chamar de novo:
// a fila é a fonte da verdade, então recomeçar é sempre seguro.
const LIMITE_MS = 100_000;
const LOTE = 100;              // teto do endpoint /emails/batch do Resend
const PAUSA_ENTRE_LOTES_MS = 600;
const MAX_429_SEGUIDOS = 5;

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

interface Reservado {
  send_id: string;
  lead_id: string | null;
  email: string;
  nome: string | null;
  token: string | null;
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

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enviarTeste(cfg: EmailConfig, para: string, html: string, assunto: string, replyTo?: string) {
  const fEmail = (cfg.from_email || "").trim();
  const fName = (cfg.from_name || "CRM").trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${cfg.resend_api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${fName} <${fEmail}>`, to: [para], subject: assunto, html, reply_to: replyTo }),
  });
  if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: SendBody = await req.json();
    const { campaign_id, test_email, audience_override } = body;

    // ═══ MODO TESTE (sem campaign_id) ═══
    if (!campaign_id && test_email && body.html) {
      const cfg = requireActiveConfig(await getEmailConfig(supabase));
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
      await enviarTeste(
        cfg,
        test_email,
        substituteVariables(body.html, variables),
        `[TESTE] ${substituteVariables(body.subject || "Teste de template", variables)}`,
        cfg.reply_to || undefined,
      );
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
      const baseHtml = body.html || (campaign as any).html_content || `<p>${campaign.subject}</p>`;
      await enviarTeste(
        { ...config, from_email: fromEmail, from_name: fromName } as EmailConfig,
        test_email,
        substituteVariables(baseHtml, variables),
        `[TESTE] ${substituteVariables(campaign.subject, variables)}`,
        replyTo,
      );
      return new Response(JSON.stringify({ success: true, test: true, sent_to: test_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // "Corrigir e reenviar": reabre os que falharam (apaga a linha failed de
    // email_sends, senão a trava anti-duplicação barra a retentativa).
    if (audience_override?.lead_ids?.length) {
      const { data: reabertos } = await supabase.rpc("email_campanha_reabrir_falhas", {
        p_campaign_id: campaign_id,
        p_lead_ids: audience_override.lead_ids,
      });
      console.log(`Campanha ${campaign_id}: ${reabertos ?? 0} falhas reabertas pra retentativa`);
    } else if (campaign.status === "completed" || campaign.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: `Campanha já está ${campaign.status}. Pra reenviar pra leads específicos, passe audience_override.` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // A fila (email_campaign_leads) é a fonte da verdade da audiência.
    //
    // Antes a audiência era resolvida por query em crm_leads a partir de
    // audience_filters. Com filtro vazio isso virava "todos os leads com
    // e-mail", e o PostgREST corta a resposta em 1000 linhas — a campanha de
    // 25/08 mostrava "110/1000" tendo 17.212 na fila, e os outros 16 mil nunca
    // entrariam no alcance por mais que a função rodasse de novo.
    const { data: prog0 } = await supabase.rpc("email_campanha_progresso", { p_campaign_id: campaign_id });
    const inicial = (Array.isArray(prog0) ? prog0[0] : prog0) || {};
    const naFila = Number(inicial.pendentes || 0) + Number(inicial.processando || 0);
    if (naFila === 0) {
      await supabase
        .from("email_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);
      return new Response(JSON.stringify({ success: true, message: "Fila vazia, campanha concluída" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("email_campaigns")
      .update({
        status: "sending",
        started_at: campaign.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    const from = `${fromName} <${fromEmail}>`;
    const htmlBase = body.html || (campaign as any).html_content || `<p>${campaign.subject}</p>`;
    const inicio = Date.now();

    const bgTask = (async () => {
      let enviadosAqui = 0;
      let falhasAqui = 0;
      let seguidos429 = 0;
      let motivoParada = "fila vazia";

      while (true) {
        if (Date.now() - inicio > LIMITE_MS) {
          motivoParada = "limite de tempo (o cron retoma)";
          break;
        }

        // Reserva atômica: quem sai daqui já tem linha em email_sends e
        // portanto está travado contra segundo envio.
        const { data: reservados, error: errReserva } = await supabase.rpc("email_campanha_reservar_lote", {
          p_campaign_id: campaign_id,
          p_limite: LOTE,
        });
        if (errReserva) {
          console.error("Erro reservando lote:", errReserva);
          motivoParada = `erro na reserva: ${errReserva.message}`;
          break;
        }
        const lote: Reservado[] = reservados || [];
        if (lote.length === 0) break;

        const itens = lote.map((r) => {
          const unsubscribeUrl = `${appUrl}/unsubscribe?token=${r.token || ""}`;
          const primeiroNome = r.nome ? r.nome.split(" ")[0] : "";
          const variables: Record<string, string> = {
            nome: r.nome || "",
            primeiro_nome: primeiroNome,
            email: r.email,
            empresa: config.company_name || "",
            unsubscribe_url: unsubscribeUrl,
            link_descadastro: unsubscribeUrl,
          };
          return {
            from,
            to: [r.email],
            subject: substituteVariables(campaign.subject, variables),
            html: injectComplianceFooter(substituteVariables(htmlBase, variables), unsubscribeUrl, config),
            reply_to: replyTo,
            headers: {
              "X-Campaign-ID": campaign_id,
              "X-Send-ID": r.send_id,
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          };
        });

        const sendIds = lote.map((r) => r.send_id);
        let resposta: Response | null = null;
        try {
          resposta = await fetch("https://api.resend.com/emails/batch", {
            method: "POST",
            headers: { "Authorization": `Bearer ${config.resend_api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify(itens),
          });
        } catch (e) {
          // Resposta desconhecida: pode ter saído ou não. Marca falha e NÃO
          // devolve pra fila — perder um e-mail é preferível a mandar dois.
          const msg = `sem resposta do Resend: ${e}`;
          console.error(msg);
          await supabase.rpc("email_campanha_falhar", { p_send_ids: sendIds, p_erro: msg });
          falhasAqui += sendIds.length;
          motivoParada = msg;
          break;
        }

        if (resposta.ok) {
          seguidos429 = 0;
          const dados = await resposta.json();
          const ids: any[] = Array.isArray(dados?.data) ? dados.data : [];
          const confirmacoes = lote.map((r, i) => ({ send_id: r.send_id, resend_id: ids[i]?.id || null }));
          await supabase.rpc("email_campanha_confirmar", { p_itens: confirmacoes });
          enviadosAqui += lote.length;

          const { data: prog } = await supabase.rpc("email_campanha_progresso", { p_campaign_id: campaign_id });
          const p = (Array.isArray(prog) ? prog[0] : prog) || {};
          await supabase
            .from("email_campaigns")
            .update({
              sent_count: Number(p.enviados || 0),
              total_sent: Number(p.enviados || 0),
              failed_count: Number(p.falhas || 0),
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaign_id);
        } else {
          const erro = await resposta.text();

          if (resposta.status === 429) {
            // Nada saiu: devolve o lote pra fila e espera.
            await supabase.rpc("email_campanha_devolver", { p_send_ids: sendIds });
            seguidos429++;
            if (seguidos429 >= MAX_429_SEGUIDOS) {
              motivoParada = "rate limit do Resend insistente";
              break;
            }
            await dorme(2000 * seguidos429);
            continue;
          }

          if (resposta.status >= 400 && resposta.status < 500) {
            // O /emails/batch é tudo-ou-nada: UM endereço recusado derruba os
            // 100 (ex.: 422 "email address contains non-ASCII characters"). Se
            // devolvêssemos o lote e parássemos, a invocação seguinte pegaria o
            // mesmo endereço ruim e a fila travava pra sempre — foi o que
            // segurou a campanha em 812/17212 em 27/08. Aqui isolamos o culpado
            // reenviando item a item: os bons saem, o ruim fica marcado.
            console.error(`Lote recusado (${resposta.status}), isolando item a item: ${erro.slice(0, 200)}`);
            seguidos429 = 0;
            for (let i = 0; i < lote.length; i++) {
              const alvo = lote[i];
              try {
                const uma = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${config.resend_api_key}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(itens[i]),
                });
                if (uma.ok) {
                  const d = await uma.json();
                  await supabase.rpc("email_campanha_confirmar", {
                    p_itens: [{ send_id: alvo.send_id, resend_id: d?.id || null }],
                  });
                  enviadosAqui++;
                } else {
                  const txt = await uma.text();
                  await supabase.rpc("email_campanha_falhar", {
                    p_send_ids: [alvo.send_id],
                    p_erro: `Resend ${uma.status}: ${txt.slice(0, 300)}`,
                  });
                  falhasAqui++;
                }
              } catch (e) {
                await supabase.rpc("email_campanha_falhar", {
                  p_send_ids: [alvo.send_id],
                  p_erro: `sem resposta do Resend: ${e}`,
                });
                falhasAqui++;
              }
              await dorme(120); // teto de 10 req/s do Resend
            }
            await dorme(PAUSA_ENTRE_LOTES_MS);
            continue;
          }

          // 5xx: problema do lado do Resend. Devolve o lote e para; o cron volta.
          await supabase.rpc("email_campanha_devolver", { p_send_ids: sendIds });
          console.error(`Resend indisponível (${resposta.status}): ${erro.slice(0, 300)}`);
          motivoParada = `Resend ${resposta.status}: ${erro.slice(0, 200)}`;
          break;
        }

        await dorme(PAUSA_ENTRE_LOTES_MS);
      }

      // Fecha só quando não resta ninguém na fila.
      const { data: progF } = await supabase.rpc("email_campanha_progresso", { p_campaign_id: campaign_id });
      const pf = (Array.isArray(progF) ? progF[0] : progF) || {};
      const restam = Number(pf.pendentes || 0) + Number(pf.processando || 0);
      const total = Number(pf.pendentes || 0) + Number(pf.processando || 0) + Number(pf.enviados || 0) +
        Number(pf.falhas || 0) + Number(pf.pulados || 0);
      const concluiu = restam === 0;

      await supabase
        .from("email_campaigns")
        .update({
          status: concluiu ? "completed" : "sending",
          ...(concluiu ? { completed_at: new Date().toISOString(), sent_at: new Date().toISOString() } : {}),
          sent_count: Number(pf.enviados || 0),
          total_sent: Number(pf.enviados || 0),
          failed_count: Number(pf.falhas || 0),
          total_leads: total,
          total_recipients: total,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      console.log(
        `Campanha ${campaign_id}: +${enviadosAqui} nesta invocação (${falhasAqui} falhas), ` +
          `${restam} na fila, parou por: ${motivoParada}`,
      );
    })();

    // @ts-ignore EdgeRuntime global
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(bgTask);

    return new Response(
      JSON.stringify({ success: true, message: "Campanha em envio", na_fila: naFila }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
