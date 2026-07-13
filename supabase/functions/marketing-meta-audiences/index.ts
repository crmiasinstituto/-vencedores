// Marketing Meta Audiences
//
// Edge consolidada com 3 actions:
//   1. export_audience  - puxa leads de um board+coluna do CRM, hasheia (SHA256),
//                         sobe Custom Audience no Meta via Graph API.
//   2. create_lal       - cria Lookalike a partir de uma Custom Audience existente.
//   3. kirvano_webhook  - recebe webhook do Kirvano em venda aprovada,
//                         dispara evento Purchase no Pixel via Conversions API.
//
// Single-file, sem _shared (memoria project_edge_function_deploy_single_file).
// verify_jwt=false pro kirvano_webhook poder ser chamado externamente.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getMetaCreds(admin: any) {
  const { data } = await admin
    .from("integration_keys")
    .select("api_key, account_id, metadata, is_active")
    .eq("service", "meta_ads")
    .maybeSingle();
  if (!data?.api_key || !data?.account_id || data.is_active === false) return null;
  const md = (data.metadata ?? {}) as Record<string, string>;
  return {
    token: data.api_key,
    accountId: data.account_id,
    pixelId: md.pixel_id ?? "",
  };
}

// SHA-256 hex via Web Crypto (Deno nativo)
async function sha256Hex(input: string): Promise<string> {
  if (!input) return "";
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normaliza email pra hash conforme spec Meta: lowercase, trim
async function hashEmail(email?: string | null): Promise<string> {
  if (!email) return "";
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) return "";
  return sha256Hex(clean);
}

// Normaliza telefone pra hash conforme spec Meta: so digitos com country code
async function hashPhone(phone?: string | null): Promise<string> {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // Garante country code Brasil (55) quando ausente
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return sha256Hex(digits);
}

// ============================================================
// EXPORT AUDIENCE: puxa leads de board+coluna do CRM, hasheia,
// cria Custom Audience no Meta, popula com usuarios hashed.
// ============================================================
type ExportAudiencePayload = {
  board_name?: string;        // ex: "Reprograme-se 10X"
  column_names?: string[];    // ex: ["DISC Concluído"], opcional, omitir = todas colunas
  audience_name: string;      // ex: "DISC respondedores 2026"
  description?: string;
};

async function handleExportAudience(payload: ExportAudiencePayload) {
  if (!payload.board_name || !payload.audience_name) {
    return { success: false, error: "board_name e audience_name obrigatorios", status: 400 };
  }

  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) {
    return { success: false, error: "Meta nao configurada", status: 400 };
  }

  // Acha board
  const { data: board } = await admin
    .from("crm_boards")
    .select("id, name")
    .eq("name", payload.board_name)
    .maybeSingle();
  if (!board) return { success: false, error: `Board "${payload.board_name}" nao encontrado`, status: 404 };

  // Acha colunas
  let cols: { id: string; name: string }[] = [];
  if (payload.column_names && payload.column_names.length > 0) {
    const { data } = await admin
      .from("crm_columns")
      .select("id, name")
      .eq("board_id", board.id)
      .in("name", payload.column_names);
    cols = data ?? [];
  } else {
    const { data } = await admin
      .from("crm_columns")
      .select("id, name")
      .eq("board_id", board.id);
    cols = data ?? [];
  }
  if (cols.length === 0) {
    return { success: false, error: "Nenhuma coluna encontrada", status: 404 };
  }

  // Puxa leads das colunas
  const colIds = cols.map((c) => c.id);
  const { data: leads, error: leadsErr } = await admin
    .from("crm_leads")
    .select("id, name, email, whatsapp")
    .in("column_id", colIds);
  if (leadsErr) return { success: false, error: leadsErr.message, status: 500 };
  if (!leads || leads.length === 0) {
    return { success: false, error: "Nenhum lead nas colunas selecionadas", status: 404 };
  }

  // Hasheia em paralelo
  const hashedRows: Array<[string, string]> = [];
  let countWithEmail = 0;
  let countWithPhone = 0;
  for (const l of leads) {
    const em = await hashEmail(l.email);
    const ph = await hashPhone(l.whatsapp);
    if (em || ph) {
      hashedRows.push([em, ph]);
      if (em) countWithEmail++;
      if (ph) countWithPhone++;
    }
  }

  if (hashedRows.length === 0) {
    return { success: false, error: "Nenhum lead com email ou telefone valido", status: 400 };
  }

  // 1. Cria Custom Audience no Meta
  const createUrl = `${GRAPH_BASE}/act_${creds.accountId}/customaudiences`;
  const createBody = new URLSearchParams();
  createBody.append("name", payload.audience_name);
  createBody.append("subtype", "CUSTOM");
  createBody.append("description", payload.description ?? `Exportado do CRM SQUAAD: board "${board.name}", ${hashedRows.length} usuarios`);
  createBody.append("customer_file_source", "USER_PROVIDED_ONLY");
  createBody.append("access_token", creds.token);

  const createResp = await fetch(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createBody.toString(),
  });
  const createJson = await createResp.json();
  if (!createResp.ok || createJson.error) {
    return {
      success: false,
      error: `Falha criando Custom Audience: ${createJson.error?.message ?? createResp.status}`,
      response: createJson,
      status: 502,
    };
  }
  const audienceId = createJson.id as string;

  // 2. Popula com usuarios hashed. Meta aceita ate 10k por request, batches de 1k seguros.
  const BATCH_SIZE = 1000;
  const populateResults = [];
  for (let i = 0; i < hashedRows.length; i += BATCH_SIZE) {
    const batch = hashedRows.slice(i, i + BATCH_SIZE);
    const payload = {
      schema: ["EMAIL", "PHONE"],
      data: batch,
    };
    const popUrl = `${GRAPH_BASE}/${audienceId}/users`;
    const popBody = new URLSearchParams();
    popBody.append("payload", JSON.stringify(payload));
    popBody.append("access_token", creds.token);
    const popResp = await fetch(popUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: popBody.toString(),
    });
    const popJson = await popResp.json();
    populateResults.push({
      batch_index: i / BATCH_SIZE,
      ok: popResp.ok && !popJson.error,
      response: popJson,
    });
  }

  return {
    success: true,
    audience_id: audienceId,
    audience_name: payload.audience_name,
    board: board.name,
    columns: cols.map((c) => c.name),
    leads_count: leads.length,
    hashed_uploaded: hashedRows.length,
    com_email: countWithEmail,
    com_telefone: countWithPhone,
    populate_results: populateResults,
    ads_manager_url: `https://adsmanager.facebook.com/audiences/manage/audiences/?act=${creds.accountId}`,
  };
}

// ============================================================
// CREATE LAL: cria Lookalike a partir de Custom Audience.
// Min 100 usuarios na audience-base.
// ============================================================
type CreateLalPayload = {
  origin_audience_id: string;
  name: string;
  country?: string;     // ex: "BR"
  ratio?: number;       // 0.01 a 0.10
};

async function handleCreateLal(payload: CreateLalPayload) {
  if (!payload.origin_audience_id || !payload.name) {
    return { success: false, error: "origin_audience_id e name obrigatorios", status: 400 };
  }
  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) return { success: false, error: "Meta nao configurada", status: 400 };

  const lookalikeSpec = {
    type: "similarity",
    ratio: payload.ratio ?? 0.01,
    country: payload.country ?? "BR",
  };

  const url = `${GRAPH_BASE}/act_${creds.accountId}/customaudiences`;
  const body = new URLSearchParams();
  body.append("name", payload.name);
  body.append("subtype", "LOOKALIKE");
  body.append("origin_audience_id", payload.origin_audience_id);
  body.append("lookalike_spec", JSON.stringify(lookalikeSpec));
  body.append("access_token", creds.token);

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await r.json();
  if (!r.ok || json.error) {
    return {
      success: false,
      error: json.error?.message ?? `HTTP ${r.status}`,
      response: json,
      status: 502,
    };
  }
  return {
    success: true,
    lookalike_id: json.id,
    origin_audience_id: payload.origin_audience_id,
    spec: lookalikeSpec,
  };
}

// ============================================================
// KIRVANO WEBHOOK: recebe POST do Kirvano em venda aprovada,
// dispara Purchase via Conversions API no pixel.
// ============================================================
async function handleKirvanoWebhook(req: Request, body: any) {
  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds || !creds.pixelId) {
    return { success: false, error: "Meta/pixel nao configurado", status: 400 };
  }

  // Kirvano payload pode variar. Extrai campos comuns.
  // Eventos: "SALE_APPROVED", "SALE_REFUSED", "SALE_CHARGEBACK", "ABANDONED_CART", etc.
  // Vamos rastrear apenas SALE_APPROVED.
  const event = body?.event ?? body?.event_type ?? "";
  if (!String(event).toUpperCase().includes("APPROVED")) {
    return {
      success: true,
      ignored: true,
      reason: `Evento "${event}" nao e SALE_APPROVED`,
    };
  }

  const customer = body?.customer ?? body?.buyer ?? body?.client ?? {};
  const email = customer?.email ?? body?.customer_email ?? body?.email ?? "";
  const phone = customer?.phone ?? customer?.whatsapp ?? body?.customer_phone ?? "";
  const value =
    Number(body?.total ?? body?.amount ?? body?.value ?? body?.sale_amount ?? body?.products?.[0]?.price ?? 0) /
    (body?.total && body.total > 1000 ? 100 : 1); // se vier em centavos, divide
  const currency = body?.currency ?? "BRL";
  const orderId = body?.order_id ?? body?.transaction_id ?? body?.sale_id ?? body?.id ?? "";
  const productName = body?.product?.name ?? body?.products?.[0]?.name ?? body?.product_name ?? "Masterclass IA";

  // Hash user_data
  const emHash = await hashEmail(email);
  const phHash = await hashPhone(phone);

  if (!emHash && !phHash) {
    return {
      success: false,
      error: "Sem email nem telefone do comprador no payload do Kirvano",
      received: { event, has_customer: !!customer, body_keys: Object.keys(body ?? {}) },
      status: 400,
    };
  }

  const eventTime = Math.floor(Date.now() / 1000);
  const capiBody = {
    data: [{
      event_name: "Purchase",
      event_time: eventTime,
      event_id: orderId || `kirvano_${eventTime}`,
      action_source: "website",
      event_source_url: "https://squaad.com.br/masterclass-ia",
      user_data: {
        em: emHash ? [emHash] : undefined,
        ph: phHash ? [phHash] : undefined,
        client_user_agent: req.headers.get("user-agent") ?? undefined,
      },
      custom_data: {
        value,
        currency,
        content_name: productName,
        content_type: "product",
        order_id: orderId,
      },
    }],
    access_token: creds.token,
  };

  const capiUrl = `${GRAPH_BASE}/${creds.pixelId}/events`;
  const r = await fetch(capiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(capiBody),
  });
  const json = await r.json();

  // Log em meta_publish_log
  await admin.from("meta_publish_log").insert({
    step: "sync_insights",  // reaproveita enum existente, marca como kirvano via response
    success: r.ok && !json.error,
    request_json: { url: capiUrl, event_name: "Purchase", order_id: orderId, value, currency },
    response_json: json,
    error_message: json.error?.message,
  });

  return {
    success: r.ok && !json.error,
    event: "Purchase",
    order_id: orderId,
    value,
    currency,
    capi_response: json,
  };
}

// ============================================================
// Router
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? body?.event ?? "kirvano_webhook"; // se vier sem action, assume webhook
    let result: any;

    if (action === "export_audience") result = await handleExportAudience(body);
    else if (action === "create_lal") result = await handleCreateLal(body);
    else if (action === "kirvano_webhook" || (body?.event && String(body.event).toUpperCase().includes("SALE"))) {
      result = await handleKirvanoWebhook(req, body);
    } else {
      result = { success: false, error: `Action invalida: ${action}`, status: 400 };
    }

    const status = result.status ?? (result.success ? 200 : 500);
    delete result.status;
    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[marketing-meta-audiences] fatal:", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
