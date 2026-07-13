// Kirvano webhook receiver — routes events to CRM board "masterclass-ia"
//
// Supported Kirvano events:
//   - SALE_APPROVED         → coluna "Comprou" + envia link do grupo via WhatsApp
//   - ABANDONED_CART        → coluna "Checkout Aberto" + enrolla na cadência IA (3 toques)
//   - PIX_GENERATED         → coluna "Checkout Aberto" + tag "PIX pendente" (sem msg)
//   - BOLETO_GENERATED      → coluna "Checkout Aberto" + tag "Boleto pendente" (sem msg)
//   - PIX_EXPIRED           → enrolla na cadência IA de recuperação (1 toque imediato)
//   - BOLETO_EXPIRED        → enrolla na cadência IA de recuperação (1 toque imediato)
//   - SALE_REFUNDED         → coluna "Não Comprou" + tag "Reembolso" (sem msg)
//   - SALE_CHARGEBACK       → coluna "Não Comprou" + tag "Chargeback" (sem msg)
//   - SALE_REFUSED          → coluna "Checkout Aberto" + tag "Recusado" (cadência leve)
//
// Auth: shared token via env KIRVANO_WEBHOOK_TOKEN
//   Aceita em: header `x-kirvano-token`, `Authorization: Bearer <t>`, body.token, ou ?token=

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-kirvano-token",
};

const BOARD_SLUG = "masterclass-ia";
const MASTERCLASS_GROUP_URL =
  Deno.env.get("MASTERCLASS_GROUP_INVITE_URL") ||
  "https://chat.whatsapp.com/Bm9gpVJwnOCLe2QR5ooDP2?mode=gi_t";

// stage names usadas no ai_sales_agents.cadence_steps (devem casar com a migration de seed)
const STAGE_CART_ABANDONED = "masterclass_cart_abandoned";
const STAGE_PIX_EXPIRED = "masterclass_pix_expired";
const STAGE_SALE_REFUSED = "masterclass_sale_refused";

// Meta Conversions API helpers (acionado em SALE_APPROVED pra alimentar pixel)
const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

// Template "Boas-vindas SQUAAD" disparado em SALE_APPROVED via Resend
const CONFIRMATION_TEMPLATE_ID = "cb9bf815-2b44-4a7d-9c02-2ae7851092e4";

function renderTemplate(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), v ?? "");
  }
  return out;
}

// Dispara email Boas-vindas SQUAAD via Resend pro comprador da Kirvano.
// Falha silenciosamente: nao quebra o fluxo principal do webhook.
async function sendConfirmationEmail(supabase: any, norm: NormalizedPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    if (!norm.customer_email) {
      return { ok: false, error: "comprador sem email" };
    }

    // Le config Resend
    const { data: cfg } = await supabase
      .from("email_config")
      .select("resend_api_key, from_email, from_name, reply_to, company_name, app_url, is_active")
      .eq("id", "singleton")
      .maybeSingle();
    if (!cfg?.is_active || !cfg.resend_api_key || !cfg.from_email) {
      return { ok: false, error: "email_config inativo ou incompleto" };
    }

    // Le template
    const { data: tpl } = await supabase
      .from("email_templates")
      .select("subject, preheader, html_content")
      .eq("id", CONFIRMATION_TEMPLATE_ID)
      .maybeSingle();
    if (!tpl?.html_content) {
      return { ok: false, error: "template Boas-vindas SQUAAD nao encontrado" };
    }

    const firstName = (norm.customer_name || "").split(" ")[0] || "Olá";
    const vars: Record<string, string> = {
      primeiro_nome: firstName,
      nome: norm.customer_name || firstName,
      empresa: cfg.company_name || "SQUAAD",
      produto: norm.product_name || "Masterclass IA",
      app_url: cfg.app_url || "https://squaad.com.br",
      grupo_url: Deno.env.get("MASTERCLASS_GROUP_INVITE_URL") || "https://chat.whatsapp.com/Bm9gpVJwnOCLe2QR5ooDP2",
    };

    const subject = renderTemplate(tpl.subject || "", vars);
    const html = renderTemplate(tpl.html_content, vars);

    // Dispara via Resend
    const fromHeader = cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email;
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [norm.customer_email],
        subject,
        html,
        reply_to: cfg.reply_to ?? undefined,
        tags: [
          { name: "source", value: "kirvano_webhook" },
          { name: "template", value: "boas_vindas_squaad" },
          { name: "transaction_id", value: norm.transaction_id ?? "" },
        ],
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: json.message ?? `HTTP ${resp.status}` };
    }

    // Log em email_sends pro tracking
    try {
      await supabase.from("email_sends").insert({
        template_id: CONFIRMATION_TEMPLATE_ID,
        recipient_email: norm.customer_email,
        recipient_name: norm.customer_name,
        subject,
        resend_id: json.id,
        status: "sent",
        source: "kirvano_webhook",
      });
    } catch (logErr) {
      console.warn("[email] log em email_sends falhou:", logErr);
    }

    return { ok: true, id: json.id };
  } catch (e) {
    console.error("[email] erro:", e);
    return { ok: false, error: (e as Error).message };
  }
}

async function sha256Hex(input: string): Promise<string> {
  if (!input) return "";
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashEmail(email?: string | null): Promise<string> {
  if (!email) return "";
  const clean = email.trim().toLowerCase();
  return clean.includes("@") ? sha256Hex(clean) : "";
}

async function hashPhone(phoneNormalized?: string | null): Promise<string> {
  if (!phoneNormalized) return "";
  return sha256Hex(phoneNormalized.replace(/\D/g, ""));
}

// Dispara Purchase via Conversions API no Pixel configurado em integration_keys.meta_ads.
// Falha silenciosamente: se Meta nao tiver configurado ou der erro, nao quebra o fluxo
// principal do webhook (CRM upsert + WhatsApp).
async function sendMetaCAPIPurchase(
  admin: any,
  norm: NormalizedPayload,
  eventSourceUrl = "https://squaad.com.br/masterclass-ia",
): Promise<{ ok: boolean; response?: any; error?: string }> {
  try {
    const { data: ik } = await admin
      .from("integration_keys")
      .select("api_key, metadata, is_active")
      .eq("service", "meta_ads")
      .maybeSingle();
    if (!ik?.api_key || ik.is_active === false) {
      return { ok: false, error: "Meta nao configurada" };
    }
    const metadata = (ik.metadata ?? {}) as Record<string, string>;
    const pixelId = metadata.pixel_id;
    if (!pixelId) return { ok: false, error: "pixel_id ausente em metadata" };

    const capiToken = metadata.capi_token || ik.api_key; // fallback no system user token
    const emHash = await hashEmail(norm.customer_email);
    const phHash = await hashPhone(norm.customer_phone);
    if (!emHash && !phHash) return { ok: false, error: "Sem email nem telefone hashable" };

    const eventTime = Math.floor(Date.now() / 1000);
    const eventId = norm.transaction_id || norm.sale_id || `kirvano_${eventTime}`;

    const body = {
      data: [{
        event_name: "Purchase",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: {
          em: emHash ? [emHash] : undefined,
          ph: phHash ? [phHash] : undefined,
        },
        custom_data: {
          value: norm.amount,
          currency: "BRL",
          content_name: norm.product_name,
          content_type: "product",
          order_id: norm.transaction_id ?? eventId,
        },
      }],
      access_token: capiToken,
    };

    const r = await fetch(`${META_GRAPH_BASE}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const respJson = await r.json();

    // Log auditavel em meta_publish_log
    try {
      await admin.from("meta_publish_log").insert({
        step: "sync_insights",
        success: r.ok && !respJson.error,
        request_json: {
          source: "kirvano_webhook",
          event_name: "Purchase",
          event_id: eventId,
          value: norm.amount,
          currency: "BRL",
          has_email_hash: !!emHash,
          has_phone_hash: !!phHash,
        },
        response_json: respJson,
        error_message: respJson.error?.message,
      });
    } catch (logErr) {
      console.warn("[capi] log falhou:", logErr);
    }

    return { ok: r.ok && !respJson.error, response: respJson, error: respJson.error?.message };
  } catch (e) {
    console.error("[capi] erro:", e);
    return { ok: false, error: (e as Error).message };
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
function normalizePhone(phone: string): string {
  let n = String(phone || "").replace(/\D/g, "");
  if (!n) return "";
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

function parsePrice(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  // Kirvano manda "R$ 197,00" — converter pra 197.00
  const s = String(raw).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

interface NormalizedPayload {
  event: string;
  sale_id: string | null;
  checkout_id: string | null;
  transaction_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  customer_document: string | null;
  product_name: string;
  product_offer: string | null;
  amount: number;
  payment_method: string | null;
  checkout_url: string | null;
}

function normalizeKirvano(payload: Record<string, unknown>): NormalizedPayload | null {
  // Kirvano usa snake_case, mas variantes podem ter outras formas — pega defensivamente.
  const event = String(payload.event || payload.event_type || "").toUpperCase().trim();
  if (!event) return null;

  const customer = (payload.customer || payload.comprador || {}) as Record<string, unknown>;
  const products = Array.isArray(payload.products) ? payload.products : [];
  const firstProduct = (products[0] || payload.venda || payload.product || {}) as Record<string, unknown>;

  const phoneRaw =
    customer.phone_number || customer.phone || customer.whatsapp || customer.celular || "";

  return {
    event,
    sale_id: (payload.sale_id || payload.id || null) as string | null,
    checkout_id: (payload.checkout_id || null) as string | null,
    transaction_id: (payload.transaction_id || payload.sale_id || payload.id || null) as string | null,
    customer_name: String(customer.name || customer.nome || "Sem nome"),
    customer_email: (customer.email as string) || null,
    customer_phone: normalizePhone(String(phoneRaw)),
    customer_document: (customer.document || customer.cpf || null) as string | null,
    product_name: String(firstProduct.name || firstProduct.produto || payload.product_name || "Masterclass IA"),
    product_offer: (firstProduct.offer_name || firstProduct.offer_id || null) as string | null,
    amount: parsePrice(payload.total_price || payload.total || firstProduct.price || payload.amount),
    payment_method: (payload.payment_method || (payload.payment as any)?.method || null) as string | null,
    checkout_url: (payload.checkout_url || payload.payment_link || null) as string | null,
  };
}

function extractToken(req: Request, body: Record<string, unknown>): string {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token");
  const fromHeader = req.headers.get("x-kirvano-token");
  const auth = req.headers.get("authorization") || "";
  const fromAuth = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const fromBody = (body.token as string) || "";
  return fromHeader || fromAuth || fromQuery || fromBody || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  // === AUTH ===
  const expectedToken = Deno.env.get("KIRVANO_WEBHOOK_TOKEN") || "";
  if (expectedToken) {
    const provided = extractToken(req, payload);
    if (provided !== expectedToken) {
      console.warn("[kirvano] token inválido ou ausente");
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }
  } else {
    console.warn("[kirvano] KIRVANO_WEBHOOK_TOKEN não configurado — webhook aceito sem auth");
  }

  const norm = normalizeKirvano(payload);
  if (!norm) return jsonResponse({ success: false, error: "Payload inválido — sem event" }, 400);
  if (!norm.customer_phone) {
    console.warn("[kirvano] sem phone — ignorando", norm.event);
    return jsonResponse({ success: false, error: "customer.phone_number obrigatório" }, 400);
  }

  console.log(`[kirvano] event=${norm.event} customer=${norm.customer_name} phone=${norm.customer_phone}`);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // === IDEMPOTÊNCIA ===
  // Dedupe por (event + sale_id/transaction_id) sem janela de tempo.
  // Vendas reais ficam em sales_events; demais eventos em webhook_event_log.
  // Checamos as duas pra evitar reprocessamento (inclui CSV imports antigos).
  const dedupeKey = `${norm.event}:${norm.transaction_id || norm.checkout_id || norm.customer_phone}`;
  const isRealSale = ["SALE_APPROVED", "SUBSCRIPTION_RENEWED"].includes(norm.event);

  if (isRealSale) {
    const { data: existing } = await supabase
      .from("sales_events")
      .select("id")
      .eq("source", "kirvano")
      .eq("dedupe_key", dedupeKey)
      .limit(1)
      .maybeSingle();
    if (existing) {
      console.log(`[kirvano] venda duplicada ignorada: ${dedupeKey}`);
      return jsonResponse({ success: true, deduplicated: true, sale_id: existing.id });
    }
  } else {
    const { data: existing } = await supabase
      .from("webhook_event_log")
      .select("id")
      .eq("provider", "kirvano")
      .eq("dedupe_key", dedupeKey)
      .limit(1)
      .maybeSingle();
    if (existing) {
      console.log(`[kirvano] evento duplicado ignorado: ${dedupeKey}`);
      return jsonResponse({ success: true, deduplicated: true, event_id: existing.id });
    }
  }

  // === BOARD + COLUNAS ===
  const { data: board } = await supabase.from("crm_boards").select("id, name").eq("slug", BOARD_SLUG).maybeSingle();
  if (!board) {
    console.error(`[kirvano] board ${BOARD_SLUG} não encontrado`);
    return jsonResponse({ success: false, error: `Board ${BOARD_SLUG} não encontrado` }, 500);
  }
  const { data: columns } = await supabase.from("crm_columns").select("id, name, sort_order").eq("board_id", board.id);
  const colByName = (n: string) => columns?.find((c) => c.name === n);
  const colCheckout = colByName("Checkout Aberto");
  const colComprou = colByName("Comprou");
  const colNaoComprou = colByName("Não Comprou");
  const colCaptured = colByName("Lead Capturado");

  // === DEFAULT AGENT (pra cadência) ===
  const { data: agent } = await supabase
    .from("ai_sales_agents")
    .select("id, instance_id")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();

  // === ENRIQUECER COM FOTO DO LEAD ===
  // Cascateia entre crm_leads e leads (Instagram pic > WhatsApp pic > handle only).
  // Match por whatsapp normalizado (com/sem 55) + fallback por email.
  // Mantém a venda visível com foto/nome no sino mesmo se a Kirvano não mandou IG.
  let igHandle: string | null = null;
  let igProfilePicUrl: string | null = null;
  try {
    const { data: avatar } = await supabase.rpc("resolve_lead_avatar", {
      p_whatsapp: norm.customer_phone,
      p_email: norm.customer_email,
    });
    const row = Array.isArray(avatar) ? avatar[0] : avatar;
    if (row?.instagram_handle) igHandle = String(row.instagram_handle).replace(/^@/, "");
    if (row?.photo_url) igProfilePicUrl = String(row.photo_url);
    console.log(`[kirvano] avatar source=${row?.source ?? "none"} handle=${igHandle ?? "-"} photo=${igProfilePicUrl ? "yes" : "no"}`);
  } catch (e) {
    console.warn("[kirvano] resolve_lead_avatar falhou:", e);
  }

  // === UPSERT LEAD ===
  async function upsertLead(targetColumnId: string, extraTags: string[]): Promise<string | null> {
    const { data: existing } = await supabase
      .from("crm_leads")
      .select("id, column_id, tags, cpf")
      .eq("board_id", board.id)
      .eq("whatsapp", norm.customer_phone)
      .maybeSingle();

    const now = new Date().toISOString();
    const dedupedTags = Array.from(
      new Set([...(existing?.tags || []), "Masterclass IA", ...extraTags].map((t) => String(t).trim()).filter(Boolean)),
    );

    // CPF da Kirvano: salva se chegou e o lead ainda nao tem
    const cpfDigits = (norm.customer_document || "").replace(/\D/g, "");
    const cpfToSave = (cpfDigits.length === 11 || cpfDigits.length === 14) ? cpfDigits : null;

    if (existing) {
      // Não força regressão de coluna: só move se a nova coluna é "mais à frente"
      // ou se estamos finalizando (Comprou/Não Comprou).
      const currentCol = columns?.find((c) => c.id === existing.column_id);
      const targetCol = columns?.find((c) => c.id === targetColumnId);
      const shouldMove =
        !currentCol ||
        !targetCol ||
        (targetCol.sort_order || 0) >= (currentCol.sort_order || 0);

      await supabase
        .from("crm_leads")
        .update({
          column_id: shouldMove ? targetColumnId : existing.column_id,
          updated_at: now,
          tags: dedupedTags,
          ...(cpfToSave && !existing.cpf ? { cpf: cpfToSave } : {}),
          ...(targetCol?.name === "Comprou" ? { closed_at: now } : {}),
        })
        .eq("id", existing.id);

      if (shouldMove && currentCol?.id !== targetColumnId) {
        await supabase.from("crm_activities").insert({
          lead_id: existing.id,
          board_id: board.id,
          activity_type: "column_change",
          description: `${norm.customer_name} movido por Kirvano: ${norm.event}`,
          from_column_name: currentCol?.name ?? null,
          to_column_name: targetCol?.name ?? null,
          metadata: { source: "kirvano", event: norm.event, amount: norm.amount },
        });
      }
      return existing.id;
    }

    const { data: newLead } = await supabase
      .from("crm_leads")
      .insert({
        board_id: board.id,
        column_id: targetColumnId,
        name: norm.customer_name,
        whatsapp: norm.customer_phone,
        email: norm.customer_email,
        source: "kirvano",
        tags: dedupedTags,
        ...(cpfToSave ? { cpf: cpfToSave } : {}),
        ...(colByName("Comprou")?.id === targetColumnId ? { closed_at: now } : {}),
      })
      .select("id")
      .single();

    if (newLead?.id) {
      await supabase.from("crm_activities").insert({
        lead_id: newLead.id,
        board_id: board.id,
        activity_type: "lead_created",
        description: `${norm.customer_name} - criado via Kirvano (${norm.event})`,
        to_column_name: columns?.find((c) => c.id === targetColumnId)?.name ?? null,
        metadata: { source: "kirvano", event: norm.event, amount: norm.amount },
      });
    }
    return newLead?.id ?? null;
  }

  // === HELPER: enviar WhatsApp direto via uazapi-proxy ===
  async function sendWhatsApp(leadId: string | null, message: string) {
    if (!agent?.instance_id) {
      console.warn("[kirvano] nenhum agent default com instance_id — não consigo enviar WhatsApp");
      return;
    }
    const r = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        action: "send_text",
        instance_id: agent.instance_id,
        phone: norm.customer_phone,
        message,
        lead_id: leadId,
        board_id: board.id,
        sent_by: "kirvano-webhook",
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error(`[kirvano] send_text falhou: ${r.status} ${err}`);
    }
  }

  // === HELPER: enrollar na cadência IA ===
  async function enrollCadence(leadId: string, stage: string, firstDelayMinutes: number, reason: string) {
    if (!agent?.id) {
      console.warn("[kirvano] sem agent default — pulando cadência");
      return;
    }
    // Não dupla-enrolla se já existe enrollment ativo no mesmo stage
    const { data: existing } = await supabase
      .from("ai_agent_cadence_enrollments")
      .select("id")
      .eq("lead_id", leadId)
      .eq("stage", stage)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (existing) {
      console.log(`[kirvano] já enrolado em ${stage}, ignorando`);
      return;
    }

    const nextAt = new Date(Date.now() + firstDelayMinutes * 60 * 1000).toISOString();
    await supabase.from("ai_agent_cadence_enrollments").insert({
      lead_id: leadId,
      agent_id: agent.id,
      stage,
      current_step: 0,
      status: "active",
      next_action_at: nextAt,
      metadata: { reason, source: "kirvano", event: norm.event, checkout_url: norm.checkout_url },
    });
    console.log(`[kirvano] cadência ${stage} agendada pro lead ${leadId} em ${firstDelayMinutes}min`);
  }

  // === ROTEAMENTO POR EVENTO ===
  let crmLeadId: string | null = null;
  const firstName = norm.customer_name.split(" ")[0] || "tudo bem";

  switch (norm.event) {
    case "SALE_APPROVED":
    case "SUBSCRIPTION_RENEWED": {
      if (!colComprou?.id) break;
      crmLeadId = await upsertLead(colComprou.id, ["Aluno Masterclass IA", "Comprador"]);

      // Mensagem transacional (template fixo — não passa pela IA)
      const welcome =
        `Boa, ${firstName}! 🎉\n\n` +
        `Aqui é da SQUAAD confirmando sua entrada na *Masterclass IA para Negócios*.\n\n` +
        `Seu lugar já tá garantido! Entra agora no grupo *exclusivo* dos alunos pra receber o link da sala, materiais e tirar dúvidas em tempo real:\n\n` +
        `👉 ${MASTERCLASS_GROUP_URL}\n\n` +
        `Te vejo lá! Qualquer coisa antes do evento, é só me chamar por aqui.`;
      await sendWhatsApp(crmLeadId, welcome);

      // Meta Conversions API: alimenta pixel com evento Purchase
      // pra otimizacao OUTCOME_SALES. Falha silenciosamente.
      const capi = await sendMetaCAPIPurchase(supabase, norm);
      console.log(`[kirvano] CAPI Purchase: ok=${capi.ok}${capi.error ? ` err="${capi.error}"` : ""}`);

      // Email Boas-vindas SQUAAD via Resend (template Confirmacao Masterclass).
      // Falha silenciosamente: nao bloqueia CRM nem WhatsApp nem CAPI.
      const emailRes = await sendConfirmationEmail(supabase, norm);
      console.log(`[kirvano] Email boas-vindas: ok=${emailRes.ok}${emailRes.error ? ` err="${emailRes.error}"` : ` resend_id=${emailRes.id}`}`);
      break;
    }

    case "ABANDONED_CART": {
      if (!colCheckout?.id) break;
      crmLeadId = await upsertLead(colCheckout.id, ["Carrinho Abandonado"]);
      if (crmLeadId) {
        // Espera 15min antes da 1ª mensagem (best practice — não parecer stalker)
        await enrollCadence(crmLeadId, STAGE_CART_ABANDONED, 15, "abandoned_cart_kirvano");
      }
      break;
    }

    case "PIX_GENERATED":
    case "BOLETO_GENERATED":
    case "PICPAY_GENERATED": {
      if (!colCheckout?.id) break;
      const method = norm.event.replace("_GENERATED", "");
      crmLeadId = await upsertLead(colCheckout.id, [`${method} pendente`]);
      // Sem mensagem aqui — comprador acabou de gerar, deixa ele em paz
      break;
    }

    case "PIX_EXPIRED":
    case "BOLETO_EXPIRED":
    case "PICPAY_EXPIRED": {
      if (!colCheckout?.id) break;
      const method = norm.event.replace("_EXPIRED", "");
      crmLeadId = await upsertLead(colCheckout.id, [`${method} expirado`]);
      if (crmLeadId) {
        // Imediato (5min de respiro)
        await enrollCadence(crmLeadId, STAGE_PIX_EXPIRED, 5, `${method.toLowerCase()}_expired_kirvano`);
      }
      break;
    }

    case "SALE_REFUSED": {
      if (!colCheckout?.id) break;
      crmLeadId = await upsertLead(colCheckout.id, ["Cartão Recusado"]);
      if (crmLeadId) {
        await enrollCadence(crmLeadId, STAGE_SALE_REFUSED, 10, "sale_refused_kirvano");
      }
      break;
    }

    case "SALE_REFUNDED":
    case "SALE_CHARGEBACK":
    case "SUBSCRIPTION_CANCELED": {
      if (!colNaoComprou?.id) break;
      const tag =
        norm.event === "SALE_REFUNDED" ? "Reembolso" :
        norm.event === "SALE_CHARGEBACK" ? "Chargeback" : "Assinatura Cancelada";
      crmLeadId = await upsertLead(colNaoComprou.id, [tag]);
      // Sem mensagem automática (sensível — pode irritar)
      break;
    }

    default: {
      // Evento desconhecido: registra mas sem ação.
      if (colCaptured?.id) {
        crmLeadId = await upsertLead(colCaptured.id, [`Kirvano: ${norm.event}`]);
      }
      console.log(`[kirvano] evento sem ação dedicada: ${norm.event}`);
      break;
    }
  }

  // === REGISTRO DO EVENTO ===
  // sales_events  = SÓ vendas reais (SalesDashboard + AdminDashboard escutam INSERT aqui
  //                 via realtime e tocam o sino com foto IG).
  // webhook_event_log = demais eventos (carrinho abandonado, PIX expirado, refund...).
  if (isRealSale) {
    await supabase.from("sales_events").insert({
      name: norm.customer_name,
      email: norm.customer_email,
      whatsapp: norm.customer_phone,
      instagram: igHandle,
      instagram_profile_pic_url: igProfilePicUrl,
      product_name: norm.product_name,
      amount: norm.amount,
      payment_method: norm.payment_method,
      transaction_id: norm.transaction_id,
      crm_lead_id: crmLeadId,
      crm_board_id: board.id,
      source: "kirvano",
      dedupe_key: dedupeKey,
      raw_payload: payload,
    });
  } else {
    await supabase.from("webhook_event_log").insert({
      provider: "kirvano",
      event_type: norm.event,
      dedupe_key: dedupeKey,
      customer_name: norm.customer_name,
      customer_email: norm.customer_email,
      customer_phone: norm.customer_phone,
      product_name: norm.product_name,
      amount: norm.amount,
      crm_lead_id: crmLeadId,
      crm_board_id: board.id,
      raw_payload: payload,
    });
  }

  return jsonResponse({ success: true, event: norm.event, lead_id: crmLeadId });
});
