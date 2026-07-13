// Marketing Meta - Edge unificada
//
// Concentra todas as integracoes com Meta Ads Graph API v21.0:
//   action=validate      -> testa credenciais (token, ad_account, page, ig, pixel)
//   action=save          -> persiste em integration_keys (parcial OK se page/pixel pendente)
//   action=publish       -> cria campanha PAUSED (campaign + adsets + creatives + ads)
//   action=set_status    -> ACTIVE/PAUSED toggle por campanha
//   action=sync_insights -> 3 periodos por campanha (lifetime + last_7d + today)
//   action=cron_tick     -> chamado pelo pg_cron 4h (sync_insights + relatorio via marketing-midia)
//
// Consolidacao das 3 edges originais (marketing-meta-validate, marketing-midia-publish,
// marketing-midia-cron) feita pra economizar slots no limite do plano Supabase.
//
// Single-file: nunca importa de _shared (memoria project_edge_function_deploy_single_file).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const REQUIRED_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_read_engagement",
  "pages_manage_ads",
  "instagram_basic",
  "read_insights",
];

// ============================================================
// Common types
// ============================================================
type ValidationCheck = {
  ok: boolean;
  label: string;
  error?: string;
  scopes_missing?: string[];
};

type ValidatePayload = {
  token?: string;
  ad_account_id?: string;
  page_id?: string;
  ig_business_id?: string;
  pixel_id?: string;
  app_id?: string;
  app_secret?: string;
  capi_token?: string;
};

type Adset = {
  nome: string;
  publico_descricao: string;
  targeting: string;
  budget_diario: number;
  optimization_goal:
    | "LEAD_GENERATION"
    | "OFFSITE_CONVERSIONS"
    | "LANDING_PAGE_VIEWS"
    | "POST_ENGAGEMENT"
    | "REACH";
  geo_locations?: { countries?: string[] };
  age_min?: number;
  age_max?: number;
  flexible_spec?: any[];
  custom_audiences?: { id: string }[];
  excluded_custom_audiences?: { id: string }[];
};

type CreativeInput = {
  output_id?: string;
  image_base64?: string;
  copy?: {
    primary_text: string;
    headline: string;
    description?: string;
    cta_button?: "LEARN_MORE" | "SIGN_UP" | "SUBSCRIBE" | "GET_OFFER" | "WATCH_MORE" | "CONTACT_US";
  };
  name?: string;
};

type PublishPayload = {
  campaign_name: string;
  objective: "OUTCOME_AWARENESS" | "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_SALES";
  phase?: "captacao" | "aquecimento" | "conversao" | "remarketing";
  budget_total?: number;
  ticket?: number;
  cpl_max?: number;
  adsets: Adset[];
  creatives: CreativeInput[];
  destination_url: string;
  adset_creative_map?: number[][];
  briefing_json?: Record<string, unknown>;
  marketing_event_id?: string;
  initiative_id?: string;
};

type StepLog = {
  step: string;
  success: boolean;
  request_json?: any;
  response_json?: any;
  error_message?: string;
};

// ============================================================
// Common helpers
// ============================================================
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
    pageId: md.page_id ?? "",
    pixelId: md.pixel_id ?? "",
    igBusinessId: md.ig_business_id ?? "",
  };
}

async function graphGet(path: string, params: Record<string, string>): Promise<{ ok: boolean; data?: any; error?: string }> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const r = await fetch(url.toString());
    const json = await r.json();
    if (!r.ok || json.error) return { ok: false, error: json.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function graphPost(
  path: string,
  body: Record<string, any>,
  token: string,
): Promise<{ ok: boolean; data?: any; error?: string; request?: any }> {
  const url = `${GRAPH_BASE}/${path}`;
  const formBody = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") formBody.append(k, JSON.stringify(v));
    else formBody.append(k, String(v));
  }
  formBody.append("access_token", token);

  const requestSnapshot = { url, body: { ...body, access_token: "[REDACTED]" } };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    const json = await r.json();
    if (!r.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${r.status}`, data: json, request: requestSnapshot };
    }
    return { ok: true, data: json, request: requestSnapshot };
  } catch (e) {
    return { ok: false, error: (e as Error).message, request: requestSnapshot };
  }
}

async function uploadImageBase64(
  accountId: string,
  base64DataUrl: string,
  token: string,
): Promise<{ ok: boolean; hash?: string; error?: string; request?: any; response?: any }> {
  const bare = base64DataUrl.includes(",") ? base64DataUrl.split(",")[1] : base64DataUrl;
  const formBody = new URLSearchParams();
  formBody.append("bytes", bare);
  formBody.append("access_token", token);

  const url = `${GRAPH_BASE}/act_${accountId}/adimages`;
  const requestSnapshot = { url, body: { bytes: "[BASE64_OMITTED]", access_token: "[REDACTED]" } };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    const json = await r.json();
    if (!r.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${r.status}`, request: requestSnapshot, response: json };
    }
    const images = json.images ?? {};
    const firstKey = Object.keys(images)[0];
    const hash = images[firstKey]?.hash;
    if (!hash) return { ok: false, error: "Sem hash na resposta", request: requestSnapshot, response: json };
    return { ok: true, hash, request: requestSnapshot, response: json };
  } catch (e) {
    return { ok: false, error: (e as Error).message, request: requestSnapshot };
  }
}

async function logStep(admin: any, campaignRowId: string | null, log: StepLog) {
  await admin.from("meta_publish_log").insert({
    meta_campaign_id: campaignRowId,
    step: log.step,
    success: log.success,
    request_json: log.request_json ?? null,
    response_json: log.response_json ?? null,
    error_message: log.error_message ?? null,
  });
}

// ============================================================
// VALIDATE: testa credenciais contra Graph API
// ============================================================
async function checkToken(token: string): Promise<ValidationCheck> {
  if (!token) return { ok: false, label: "Token nao informado", error: "vazio" };
  const me = await graphGet("me", { access_token: token, fields: "id,name" });
  if (!me.ok) return { ok: false, label: "Token invalido", error: me.error };

  const dbg = await graphGet("debug_token", { input_token: token, access_token: token });
  const scopes: string[] = dbg.data?.data?.scopes ?? [];
  const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  if (missing.length > 0) {
    return {
      ok: false,
      label: `${me.data.name} (scopes faltando)`,
      error: `Faltam scopes: ${missing.join(", ")}. Regere o token marcando todos os obrigatorios.`,
      scopes_missing: missing,
    };
  }
  return { ok: true, label: `Token OK (${me.data.name})` };
}

async function checkAdAccount(token: string, accountId: string): Promise<ValidationCheck> {
  if (!accountId) return { ok: false, label: "Ad Account nao informada", error: "vazio" };
  const clean = accountId.replace(/^act_/, "").trim();
  if (!/^\d+$/.test(clean)) {
    return { ok: false, label: "Ad Account invalida", error: "Apenas digitos, sem o prefixo act_" };
  }
  const r = await graphGet(`act_${clean}`, {
    access_token: token,
    fields: "name,currency,timezone_name,account_status",
  });
  if (!r.ok) return { ok: false, label: "Ad Account inacessivel", error: r.error };
  return { ok: true, label: `${r.data.name} (${r.data.currency}, ${r.data.timezone_name})` };
}

async function checkPage(token: string, pageId: string): Promise<ValidationCheck> {
  if (!pageId) return { ok: false, label: "Page ID nao informado", error: "vazio" };
  if (!/^\d+$/.test(pageId.trim())) return { ok: false, label: "Page ID invalido", error: "Apenas digitos" };
  const r = await graphGet(pageId.trim(), { access_token: token, fields: "name,id,category" });
  if (!r.ok) return { ok: false, label: "Page inacessivel", error: r.error };
  return { ok: true, label: `${r.data.name}${r.data.category ? ` (${r.data.category})` : ""}` };
}

async function checkInstagram(token: string, igId: string): Promise<ValidationCheck> {
  if (!igId) return { ok: false, label: "IG Business ID nao informado", error: "vazio" };
  if (!/^\d+$/.test(igId.trim())) return { ok: false, label: "IG Business ID invalido", error: "Apenas digitos" };
  const r = await graphGet(igId.trim(), { access_token: token, fields: "username,name" });
  if (!r.ok) return { ok: false, label: "IG Business inacessivel", error: r.error };
  return { ok: true, label: `@${r.data.username}${r.data.name ? ` (${r.data.name})` : ""}` };
}

async function checkPixel(token: string, pixelId: string): Promise<ValidationCheck> {
  if (!pixelId) return { ok: false, label: "Pixel ID nao informado", error: "vazio" };
  if (!/^\d+$/.test(pixelId.trim())) return { ok: false, label: "Pixel ID invalido", error: "Apenas digitos" };
  const r = await graphGet(pixelId.trim(), { access_token: token, fields: "name,id" });
  if (!r.ok) return { ok: false, label: "Pixel inacessivel", error: r.error };
  return { ok: true, label: r.data.name ?? `Pixel ${pixelId}` };
}

async function handleValidate(p: ValidatePayload) {
  if (!p.token) return { success: false, error: "Token obrigatorio pra validar", status: 400 };

  const tokenCheck = await checkToken(p.token);
  if (!tokenCheck.ok) {
    return {
      success: true,
      all_ok: false,
      checks: {
        token: tokenCheck,
        ad_account: { ok: false, label: "Skipped (token invalido)" },
        page: { ok: false, label: "Skipped (token invalido)" },
        ig_business: { ok: false, label: "Skipped (token invalido)" },
        pixel: { ok: false, label: "Skipped (token invalido)" },
      },
    };
  }

  const [adAccount, page, igBusiness, pixel] = await Promise.all([
    checkAdAccount(p.token, p.ad_account_id ?? ""),
    checkPage(p.token, p.page_id ?? ""),
    p.ig_business_id ? checkInstagram(p.token, p.ig_business_id) : Promise.resolve<ValidationCheck>({ ok: true, label: "Pulado (opcional)" }),
    checkPixel(p.token, p.pixel_id ?? ""),
  ]);

  const allRequiredOk = tokenCheck.ok && adAccount.ok && page.ok && pixel.ok;

  return {
    success: true,
    all_ok: allRequiredOk,
    checks: { token: tokenCheck, ad_account: adAccount, page, ig_business: igBusiness, pixel },
  };
}

// ============================================================
// SAVE: persiste em integration_keys.meta_ads
// ============================================================
async function handleSave(p: ValidatePayload) {
  if (!p.token || !p.ad_account_id) {
    return { success: false, error: "Token e ad_account_id obrigatorios. Demais sao opcionais.", status: 400 };
  }

  const v = await handleValidate(p);
  if (!v.checks?.token?.ok || !v.checks?.ad_account?.ok) {
    return {
      success: false,
      error: "Token ou Ad Account invalidos. Veja checks.",
      checks: v.checks,
      status: 400,
    };
  }

  const admin = adminClient();
  const { data: current } = await admin
    .from("integration_keys")
    .select("metadata")
    .eq("service", "meta_ads")
    .maybeSingle();
  const currentMeta = (current?.metadata as Record<string, unknown>) ?? {};

  const isPartial = !v.checks?.page?.ok || !v.checks?.pixel?.ok;

  const newMeta: Record<string, unknown> = {
    ...currentMeta,
    validated_at: new Date().toISOString(),
    partial: isPartial,
  };
  if (v.checks?.page?.ok && p.page_id) newMeta.page_id = p.page_id;
  if (v.checks?.pixel?.ok && p.pixel_id) newMeta.pixel_id = p.pixel_id;
  if (v.checks?.ig_business?.ok && p.ig_business_id) newMeta.ig_business_id = p.ig_business_id;
  if (p.app_id) newMeta.app_id = p.app_id;
  if (p.capi_token) newMeta.capi_token = p.capi_token;

  const cleanAccountId = (p.ad_account_id ?? "").replace(/^act_/, "").trim();

  const payload: Record<string, unknown> = {
    service: "meta_ads",
    api_key: p.token,
    account_id: cleanAccountId,
    is_active: true,
    metadata: newMeta,
    updated_at: new Date().toISOString(),
  };
  if (p.app_secret) payload.api_secret = p.app_secret;

  const { error } = await admin.from("integration_keys").upsert(payload, { onConflict: "service" });
  if (error) {
    console.error("[marketing-meta save]:", error);
    return { success: false, error: error.message, status: 500 };
  }

  return { success: true, validated_at: newMeta.validated_at, partial: isPartial, checks: v.checks };
}

// ============================================================
// PUBLISH: cria campanha PAUSED (campaign + adsets + creatives + ads)
// ============================================================
async function handlePublish(payload: PublishPayload) {
  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds || !creds.pageId) {
    return {
      success: false,
      error: "Meta nao configurada ou Page ID ausente. Complete em /admin/marketing/integracoes/meta.",
      status: 400,
    };
  }

  if (!payload.campaign_name || !payload.objective) return { success: false, error: "campaign_name e objective obrigatorios", status: 400 };
  if (!payload.adsets?.length) return { success: false, error: "Pelo menos 1 adset obrigatorio", status: 400 };
  if (!payload.creatives?.length) return { success: false, error: "Pelo menos 1 creative obrigatorio", status: 400 };
  if (!payload.destination_url) return { success: false, error: "destination_url obrigatoria", status: 400 };

  const stepLogs: StepLog[] = [];
  let campaignRowId: string | null = null;

  // Step 1: cria campanha PAUSED
  // is_adset_budget_sharing_enabled e obrigatorio quando ABO (budget no adset).
  // False = cada adset gasta o proprio budget, sem compartilhamento. Comportamento esperado.
  const campaignR = await graphPost(`act_${creds.accountId}/campaigns`, {
    name: payload.campaign_name,
    objective: payload.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
    is_adset_budget_sharing_enabled: false,
  }, creds.token);

  if (!campaignR.ok) {
    stepLogs.push({ step: "create_campaign", success: false, request_json: campaignR.request, response_json: campaignR.data, error_message: campaignR.error });
    await logStep(admin, null, stepLogs[0]);
    return { success: false, error: `Falha criando campanha: ${campaignR.error}`, status: 502, step_logs: stepLogs };
  }

  const metaCampaignId = campaignR.data.id as string;
  stepLogs.push({ step: "create_campaign", success: true, request_json: campaignR.request, response_json: campaignR.data });

  const { data: campaignRow, error: cErr } = await admin
    .from("meta_campaigns")
    .insert({
      meta_campaign_id: metaCampaignId,
      name: payload.campaign_name,
      objective: payload.objective,
      phase: payload.phase ?? null,
      budget_total: payload.budget_total ?? null,
      ticket: payload.ticket ?? null,
      cpl_max: payload.cpl_max ?? null,
      briefing_json: payload.briefing_json ?? {},
      status: "paused",
      marketing_event_id: payload.marketing_event_id ?? null,
      initiative_id: payload.initiative_id ?? null,
    })
    .select()
    .single();

  if (cErr) {
    return { success: false, error: `Insert local falhou: ${cErr.message}`, meta_campaign_id: metaCampaignId, step_logs: stepLogs, status: 500 };
  }
  campaignRowId = campaignRow.id;
  await logStep(admin, campaignRowId, stepLogs[stepLogs.length - 1]);

  // Step 2: upload imagens
  const imageHashes: { hash: string; creative_index: number }[] = [];
  for (let i = 0; i < payload.creatives.length; i++) {
    const c = payload.creatives[i];
    let imageData: string | null = null;
    if (c.image_base64) imageData = c.image_base64;
    else if (c.output_id) {
      const { data: out } = await admin.from("marketing_ai_outputs").select("resultado").eq("id", c.output_id).maybeSingle();
      imageData = (out?.resultado as Record<string, any> | null)?.image_base64 ?? null;
    }
    if (!imageData) {
      const log: StepLog = { step: "upload_image", success: false, error_message: `Creative ${i}: sem imagem` };
      stepLogs.push(log); await logStep(admin, campaignRowId, log);
      return { success: false, error: log.error_message, meta_campaign_id: metaCampaignId, meta_campaign_row_id: campaignRowId, step_logs: stepLogs, status: 400 };
    }
    const up = await uploadImageBase64(creds.accountId, imageData, creds.token);
    const log: StepLog = { step: "upload_image", success: up.ok, request_json: up.request, response_json: up.response, error_message: up.error };
    stepLogs.push(log); await logStep(admin, campaignRowId, log);
    if (!up.ok || !up.hash) {
      return { success: false, error: `Upload imagem ${i}: ${up.error}`, meta_campaign_id: metaCampaignId, meta_campaign_row_id: campaignRowId, step_logs: stepLogs, status: 502 };
    }
    imageHashes.push({ hash: up.hash, creative_index: i });
  }
  await admin.from("meta_campaigns").update({ meta_image_hashes: imageHashes }).eq("id", campaignRowId);

  // Step 3: cria adsets
  const adsetIds: { id: string; nome: string }[] = [];
  for (const adset of payload.adsets) {
    const targeting: Record<string, any> = {
      geo_locations: adset.geo_locations ?? { countries: ["BR"] },
      age_min: adset.age_min ?? 18,
      age_max: adset.age_max ?? 65,
      targeting_automation: { advantage_audience: 0 },
    };
    if (adset.flexible_spec) targeting.flexible_spec = adset.flexible_spec;
    if (adset.custom_audiences) targeting.custom_audiences = adset.custom_audiences;
    if (adset.excluded_custom_audiences) targeting.excluded_custom_audiences = adset.excluded_custom_audiences;

    const promotedObject: Record<string, any> = {};
    if (adset.optimization_goal === "OFFSITE_CONVERSIONS" && creds.pixelId) {
      promotedObject.pixel_id = creds.pixelId;
      promotedObject.custom_event_type = "PURCHASE";
    } else if (adset.optimization_goal === "LEAD_GENERATION" && creds.pageId) {
      promotedObject.page_id = creds.pageId;
    }

    const adsetBody: Record<string, any> = {
      name: adset.nome,
      campaign_id: metaCampaignId,
      billing_event: "IMPRESSIONS",
      optimization_goal: adset.optimization_goal,
      daily_budget: Math.round(adset.budget_diario * 100),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      start_time: new Date(Date.now() + 60_000).toISOString(),
      status: "PAUSED",
    };
    if (Object.keys(promotedObject).length > 0) adsetBody.promoted_object = promotedObject;

    const r = await graphPost(`act_${creds.accountId}/adsets`, adsetBody, creds.token);
    const log: StepLog = { step: "create_adset", success: r.ok, request_json: r.request, response_json: r.data, error_message: r.error };
    stepLogs.push(log); await logStep(admin, campaignRowId, log);
    if (!r.ok) {
      return { success: false, error: `Adset "${adset.nome}": ${r.error}`, meta_campaign_id: metaCampaignId, meta_campaign_row_id: campaignRowId, step_logs: stepLogs, status: 502 };
    }
    adsetIds.push({ id: r.data.id, nome: adset.nome });
  }
  await admin.from("meta_campaigns").update({ meta_adset_ids: adsetIds }).eq("id", campaignRowId);

  // Step 4: cria adcreatives (asset_feed_spec, regras criticas)
  const creativeIds: { id: string; index: number }[] = [];
  for (let i = 0; i < payload.creatives.length; i++) {
    const c = payload.creatives[i];
    const hash = imageHashes.find((h) => h.creative_index === i)?.hash;
    if (!hash) continue;

    const copy = c.copy ?? { primary_text: payload.campaign_name, headline: payload.campaign_name };
    const ctaType = copy.cta_button ?? "LEARN_MORE";

    // Adcreative classico (nao-dinamico) com link_data direto.
    // asset_feed_spec exigiria is_dynamic_creative=true no adset, que limita customizacao.
    const objectStorySpec: Record<string, any> = {
      page_id: creds.pageId,
      link_data: {
        image_hash: hash,
        link: payload.destination_url,
        message: copy.primary_text,
        name: copy.headline,
        call_to_action: { type: ctaType },
      },
    };
    if (copy.description) objectStorySpec.link_data.description = copy.description;

    const adcreativeBody = {
      name: c.name ?? `Creative ${i + 1} - ${payload.campaign_name}`,
      object_story_spec: objectStorySpec,
      url_tags: "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{adset.name}}&utm_term={{ad.name}}",
    };

    const r = await graphPost(`act_${creds.accountId}/adcreatives`, adcreativeBody, creds.token);
    const log: StepLog = { step: "create_creative", success: r.ok, request_json: r.request, response_json: r.data, error_message: r.error };
    stepLogs.push(log); await logStep(admin, campaignRowId, log);
    if (!r.ok) {
      return { success: false, error: `Creative ${i}: ${r.error}`, meta_campaign_id: metaCampaignId, meta_campaign_row_id: campaignRowId, step_logs: stepLogs, status: 502 };
    }
    creativeIds.push({ id: r.data.id, index: i });
  }
  await admin.from("meta_campaigns").update({ meta_creative_ids: creativeIds }).eq("id", campaignRowId);

  // Step 5: cria ads
  const adIds: { id: string; adset_id: string; creative_id: string }[] = [];
  const pairs: Array<{ adsetId: string; creativeId: string; label: string }> = [];
  if (payload.adset_creative_map && payload.adset_creative_map.length === adsetIds.length) {
    for (let aIdx = 0; aIdx < adsetIds.length; aIdx++) {
      const cIdxs = payload.adset_creative_map[aIdx] ?? [];
      for (const cIdx of cIdxs) {
        const cId = creativeIds.find((c) => c.index === cIdx)?.id;
        if (cId) pairs.push({ adsetId: adsetIds[aIdx].id, creativeId: cId, label: `${adsetIds[aIdx].nome} x C${cIdx + 1}` });
      }
    }
  } else {
    for (const a of adsetIds) for (const c of creativeIds) {
      pairs.push({ adsetId: a.id, creativeId: c.id, label: `${a.nome} x C${c.index + 1}` });
    }
  }

  for (const pair of pairs) {
    // tracking_specs garante "Eventos do site" marcado no anuncio (auditoria item 4 - vidoe 4 do gestor)
    const adBody: Record<string, any> = {
      name: `Ad ${pair.label}`,
      adset_id: pair.adsetId,
      creative: { creative_id: pair.creativeId },
      status: "PAUSED",
    };
    if (creds.pixelId) {
      adBody.tracking_specs = JSON.stringify([{ "action.type": ["offsite_conversion"], "fb_pixel": [creds.pixelId] }]);
    }
    const r = await graphPost(`act_${creds.accountId}/ads`, adBody, creds.token);
    const log: StepLog = { step: "create_ad", success: r.ok, request_json: r.request, response_json: r.data, error_message: r.error };
    stepLogs.push(log); await logStep(admin, campaignRowId, log);
    if (!r.ok) {
      return { success: false, error: `Ad "${pair.label}": ${r.error}`, meta_campaign_id: metaCampaignId, meta_campaign_row_id: campaignRowId, step_logs: stepLogs, status: 502 };
    }
    adIds.push({ id: r.data.id, adset_id: pair.adsetId, creative_id: pair.creativeId });
  }
  await admin.from("meta_campaigns").update({ meta_ad_ids: adIds }).eq("id", campaignRowId);

  return {
    success: true,
    meta_campaign_id: metaCampaignId,
    meta_campaign_row_id: campaignRowId,
    adset_ids: adsetIds,
    creative_ids: creativeIds,
    ad_ids: adIds,
    image_hashes: imageHashes,
    ads_manager_url: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${creds.accountId}&selected_campaign_ids=${metaCampaignId}`,
    step_logs: stepLogs,
    aviso: "Campanha criada PAUSED. Revise no Ads Manager e ative manualmente.",
  };
}

// ============================================================
// SET_STATUS: ACTIVE/PAUSED toggle
// ============================================================
async function handleSetStatus(payload: { meta_campaign_row_id?: string; meta_campaign_id?: string; activate: boolean }) {
  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) return { success: false, error: "Meta nao configurada", status: 400 };

  let metaCampaignId: string;
  let dbRowId: string | null = null;

  if (payload.meta_campaign_row_id) {
    const { data: row } = await admin
      .from("meta_campaigns")
      .select("meta_campaign_id, status, id")
      .eq("id", payload.meta_campaign_row_id)
      .maybeSingle();
    if (!row) return { success: false, error: "Campanha nao encontrada", status: 404 };
    metaCampaignId = row.meta_campaign_id;
    dbRowId = row.id;
  } else if (payload.meta_campaign_id) {
    metaCampaignId = payload.meta_campaign_id;
    const { data: row } = await admin
      .from("meta_campaigns")
      .select("id")
      .eq("meta_campaign_id", payload.meta_campaign_id)
      .maybeSingle();
    dbRowId = row?.id ?? null;
  } else {
    return { success: false, error: "meta_campaign_row_id ou meta_campaign_id obrigatorio", status: 400 };
  }

  const targetStatus = payload.activate ? "ACTIVE" : "PAUSED";
  const r = await graphPost(metaCampaignId, { status: targetStatus }, creds.token);

  await logStep(admin, dbRowId, {
    step: payload.activate ? "activate" : "pause",
    success: r.ok,
    request_json: r.request,
    response_json: r.data,
    error_message: r.error,
  });

  if (!r.ok) return { success: false, error: r.error, status: 502 };

  if (dbRowId) {
    await admin
      .from("meta_campaigns")
      .update({ status: payload.activate ? "active" : "paused" })
      .eq("id", dbRowId);
  }

  return { success: true, status: targetStatus };
}

// ============================================================
// SET_ADSET_STATUS: pausa/ativa um adset individual
// ============================================================
async function handleSetAdsetStatus(payload: { adset_id: string; activate: boolean }) {
  if (!payload.adset_id) return { success: false, error: "adset_id obrigatorio", status: 400 };
  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) return { success: false, error: "Meta nao configurada", status: 400 };

  const targetStatus = payload.activate ? "ACTIVE" : "PAUSED";
  const r = await graphPost(payload.adset_id, { status: targetStatus }, creds.token);

  await logStep(admin, null, {
    step: payload.activate ? "activate_adset" : "pause_adset",
    success: r.ok,
    request_json: { adset_id: payload.adset_id, status: targetStatus },
    response_json: r.data,
    error_message: r.error,
  });

  if (!r.ok) return { success: false, error: r.error, status: 502 };
  return { success: true, status: targetStatus, adset_id: payload.adset_id };
}

// ============================================================
// UPDATE_ADSET_BUDGET: atualiza daily_budget de UM adset individual
// ============================================================
async function handleUpdateAdsetBudget(payload: { adset_id: string; daily_budget_brl?: number; delta_pct?: number }) {
  if (!payload.adset_id) return { success: false, error: "adset_id obrigatorio", status: 400 };
  const hasAbsolute = typeof payload.daily_budget_brl === "number" && payload.daily_budget_brl >= 1;
  const hasDelta = typeof payload.delta_pct === "number" && payload.delta_pct !== 0;
  if (!hasAbsolute && !hasDelta) {
    return { success: false, error: "Informe daily_budget_brl (>=1) ou delta_pct (!=0)", status: 400 };
  }

  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) return { success: false, error: "Meta nao configurada", status: 400 };

  let newCents: number;
  let previousCents = 0;
  if (hasAbsolute) {
    newCents = Math.round((payload.daily_budget_brl as number) * 100);
  } else {
    const cur = await graphGet(payload.adset_id, { access_token: creds.token, fields: "daily_budget" });
    if (!cur.ok) return { success: false, error: `Erro ao buscar adset: ${cur.error}`, status: 502 };
    previousCents = Number(cur.data?.daily_budget || 0);
    if (previousCents < 100) return { success: false, error: "Adset sem daily_budget atual, use valor absoluto", status: 422 };
    newCents = Math.max(100, Math.round(previousCents * (1 + (payload.delta_pct as number) / 100)));
  }

  const r = await graphPost(payload.adset_id, { daily_budget: newCents }, creds.token);
  await logStep(admin, null, {
    step: "update_adset_budget",
    success: r.ok,
    request_json: { adset_id: payload.adset_id, daily_budget_cents: newCents, daily_budget_brl: newCents / 100 },
    response_json: r.data,
    error_message: r.error,
  });

  if (!r.ok) return { success: false, error: r.error, status: 502 };
  return {
    success: true,
    adset_id: payload.adset_id,
    previous_daily_budget_brl: previousCents / 100,
    new_daily_budget_brl: newCents / 100,
    delta_pct_applied: payload.delta_pct ?? null,
  };
}

// ============================================================
// UPDATE_BUDGET: atualiza daily_budget dos adsets de uma campanha
// Aceita daily_budget_brl (valor absoluto) OU delta_pct (variacao % sobre o atual)
// ============================================================
async function handleUpdateBudget(payload: { meta_campaign_id: string; daily_budget_brl?: number; delta_pct?: number }) {
  if (!payload.meta_campaign_id) return { success: false, error: "meta_campaign_id obrigatorio", status: 400 };
  const hasAbsolute = typeof payload.daily_budget_brl === "number" && payload.daily_budget_brl >= 1;
  const hasDelta = typeof payload.delta_pct === "number" && payload.delta_pct !== 0;
  if (!hasAbsolute && !hasDelta) {
    return { success: false, error: "Informe daily_budget_brl (>=1) ou delta_pct (!=0)", status: 400 };
  }

  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) return { success: false, error: "Meta nao configurada", status: 400 };

  const adsetsR = await graphGet(`${payload.meta_campaign_id}/adsets`, {
    access_token: creds.token,
    fields: "id,name,daily_budget,status",
    limit: "50",
  });
  if (!adsetsR.ok) return { success: false, error: `Erro ao buscar adsets: ${adsetsR.error}`, status: 502 };

  const adsets = adsetsR.data?.data ?? [];
  if (adsets.length === 0) return { success: false, error: "Nenhum adset encontrado", status: 404 };

  const currentTotalCents = adsets.reduce((s: number, a: any) => s + Number(a.daily_budget || 0), 0);
  let newTotalCents: number;
  if (hasAbsolute) {
    newTotalCents = Math.round((payload.daily_budget_brl as number) * 100);
  } else {
    if (currentTotalCents < 100) {
      return { success: false, error: "Orcamento atual indisponivel nos adsets, use daily_budget_brl absoluto", status: 422 };
    }
    newTotalCents = Math.max(100, Math.round(currentTotalCents * (1 + (payload.delta_pct as number) / 100)));
  }

  const { data: dbRow } = await admin
    .from("meta_campaigns")
    .select("id")
    .eq("meta_campaign_id", payload.meta_campaign_id)
    .maybeSingle();

  const results: Array<{ adset_id: string; name: string; ok: boolean; new_budget_brl: number; error?: string }> = [];

  for (const adset of adsets) {
    let adsetBudget: number;
    if (adsets.length === 1) {
      adsetBudget = newTotalCents;
    } else if (currentTotalCents > 0) {
      adsetBudget = Math.max(100, Math.round(newTotalCents * (Number(adset.daily_budget || 0) / currentTotalCents)));
    } else {
      adsetBudget = Math.max(100, Math.round(newTotalCents / adsets.length));
    }

    const r = await graphPost(adset.id, { daily_budget: adsetBudget }, creds.token);
    results.push({ adset_id: adset.id, name: adset.name, ok: r.ok, new_budget_brl: adsetBudget / 100, error: r.error });

    await logStep(admin, dbRow?.id ?? null, {
      step: "update_budget",
      success: r.ok,
      request_json: { adset_id: adset.id, daily_budget_cents: adsetBudget, daily_budget_brl: adsetBudget / 100 },
      response_json: r.data,
      error_message: r.error,
    });
  }

  return {
    success: results.every((r) => r.ok),
    results,
    previous_daily_budget_brl: currentTotalCents / 100,
    new_daily_budget_brl: newTotalCents / 100,
    delta_pct_applied: payload.delta_pct ?? null,
    adsets_updated: results.filter((r) => r.ok).length,
  };
}

// ============================================================
// SYNC_INSIGHTS: 3 periodos por campanha
// ============================================================
async function fetchCampaignInsights(token: string, campaignId: string, datePreset: string) {
  const url = new URL(`${GRAPH_BASE}/${campaignId}/insights`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("date_preset", datePreset);
  url.searchParams.set("fields", "spend,impressions,reach,clicks,ctr,cpm,frequency,actions,cost_per_action_type");
  try {
    const r = await fetch(url.toString());
    const json = await r.json();
    if (!r.ok || json.error) return { ok: false, error: json.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, data: json.data?.[0] ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function handleSyncInsights(payload: { meta_campaign_row_id?: string }) {
  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) return { success: false, error: "Meta nao configurada", status: 400 };

  let query = admin.from("meta_campaigns").select("id, meta_campaign_id, status");
  if (payload.meta_campaign_row_id) query = query.eq("id", payload.meta_campaign_row_id);
  else query = query.in("status", ["active", "paused"]);
  const { data: rows } = await query;
  if (!rows || rows.length === 0) return { success: true, synced: 0 };

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of rows) {
    const [lifetime, last7d, today] = await Promise.all([
      fetchCampaignInsights(creds.token, row.meta_campaign_id, "lifetime"),
      fetchCampaignInsights(creds.token, row.meta_campaign_id, "last_7d"),
      fetchCampaignInsights(creds.token, row.meta_campaign_id, "today"),
    ]);
    const insights = {
      vitalicio: (lifetime as any).data,
      ultimos_7d: (last7d as any).data,
      hoje: (today as any).data,
      synced_at: new Date().toISOString(),
      erros: [lifetime.error, last7d.error, today.error].filter(Boolean),
    };
    const { error: upErr } = await admin
      .from("meta_campaigns")
      .update({ last_insights_json: insights, last_synced_at: new Date().toISOString() })
      .eq("id", row.id);
    await logStep(admin, row.id, {
      step: "sync_insights",
      success: !upErr && insights.erros.length === 0,
      response_json: insights,
      error_message: upErr?.message ?? (insights.erros.length ? insights.erros.join("; ") : undefined),
    });
    results.push({ id: row.id, ok: !upErr, error: upErr?.message });
  }

  return { success: true, synced: results.length, results };
}

// ============================================================
// COCKPIT_DATA: tudo que o dashboard rico precisa em 1 chamada.
// Account balance + campanhas + insights por campanha + diario.
// ============================================================
async function handleCockpitData(payload: { days?: number }) {
  const admin = adminClient();
  const creds = await getMetaCreds(admin);
  if (!creds) return { success: false, error: "Meta nao configurada", status: 400 };

  const days = Math.max(1, Math.min(180, payload.days ?? 30));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const timeRange = JSON.stringify({ since, until });
  const accountPath = `act_${creds.accountId}`;

  // Balance
  const balanceR = await graphGet(accountPath, {
    access_token: creds.token,
    fields: "id,name,balance,amount_spent,spend_cap,currency,account_status,funding_source_details",
  });

  // Campaigns
  const campaignsR = await graphGet(`${accountPath}/campaigns`, {
    access_token: creds.token,
    fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "100",
  });

  // Adsets (pra somar daily_budget quando campanha eh ABO, valor fica nos adsets)
  const adsetsR = await graphGet(`${accountPath}/adsets`, {
    access_token: creds.token,
    fields: "id,name,campaign_id,daily_budget,lifetime_budget,status,optimization_goal",
    limit: "200",
  });

  // Adset-level insights (pra mostrar CPM/spend por adset e permitir pausar individual)
  const adsetInsightsR = await graphGet(`${accountPath}/insights`, {
    access_token: creds.token,
    fields: "adset_id,adset_name,campaign_id,impressions,reach,clicks,spend,cpc,cpm,ctr,actions,frequency",
    time_range: timeRange,
    level: "adset",
    limit: "200",
  });

  // Campaign-level insights (period)
  const insightsR = await graphGet(`${accountPath}/insights`, {
    access_token: creds.token,
    fields: "campaign_name,campaign_id,impressions,reach,clicks,spend,cpc,cpm,ctr,actions,cost_per_action_type,frequency",
    time_range: timeRange,
    level: "campaign",
    limit: "100",
  });

  // Daily breakdown (account-level)
  const dailyR = await graphGet(`${accountPath}/insights`, {
    access_token: creds.token,
    fields: "campaign_name,impressions,reach,clicks,spend,cpc,cpm,ctr,actions,frequency",
    time_range: timeRange,
    time_increment: "1",
    level: "account",
    limit: "100",
  });

  // Agrega daily_budget dos adsets por campanha (centavos)
  const adsetBudgets: Record<string, { dailyCents: number; activeCount: number; total: number }> = {};
  const adsetsList = adsetsR.ok ? (adsetsR.data?.data ?? []) : [];
  for (const a of adsetsList) {
    const cid = String(a.campaign_id || "");
    if (!cid) continue;
    if (!adsetBudgets[cid]) adsetBudgets[cid] = { dailyCents: 0, activeCount: 0, total: 0 };
    adsetBudgets[cid].total += 1;
    adsetBudgets[cid].dailyCents += Number(a.daily_budget || 0);
    if (String(a.status).toUpperCase() === "ACTIVE") adsetBudgets[cid].activeCount += 1;
  }

  // Combina adsets + insights por adset (pra UI mostrar CPM/spend individual)
  const adsetInsightsList = adsetInsightsR.ok ? (adsetInsightsR.data?.data ?? []) : [];
  const insightsByAdset = new Map<string, any>();
  for (const i of adsetInsightsList) insightsByAdset.set(String(i.adset_id), i);
  const adsetsDetailed = adsetsList.map((a: any) => {
    const ins = insightsByAdset.get(String(a.id)) ?? {};
    return {
      id: a.id,
      name: a.name,
      campaign_id: a.campaign_id,
      status: a.status,
      optimization_goal: a.optimization_goal ?? null,
      daily_budget_brl: Number(a.daily_budget || 0) / 100,
      spend: Number(ins.spend || 0),
      impressions: Number(ins.impressions || 0),
      reach: Number(ins.reach || 0),
      clicks: Number(ins.clicks || 0),
      cpm: Number(ins.cpm || 0),
      cpc: Number(ins.cpc || 0),
      ctr: Number(ins.ctr || 0),
      frequency: Number(ins.frequency || 0),
    };
  });

  const balanceData = balanceR.data ?? {};
  const accountBalance = balanceR.ok ? {
    id: balanceData.id,
    name: balanceData.name,
    balance: Number(balanceData.balance || 0) / 100,
    amountSpent: Number(balanceData.amount_spent || 0) / 100,
    spendCap: Number(balanceData.spend_cap || 0) / 100,
    availableBalance: balanceData.funding_source_details?.display_string
      ? (parseFloat(
          String(balanceData.funding_source_details.display_string)
            .replace(/[^\d.,]/g, "")
            .replace(".", "")
            .replace(",", "."),
        ) || 0)
      : 0,
    fundingSource: balanceData.funding_source_details?.display_string ?? "N/A",
    accountStatus: balanceData.account_status,
    currency: balanceData.currency,
  } : null;

  return {
    success: true,
    days,
    period: { since, until },
    accountBalance,
    campaigns: campaignsR.ok ? (campaignsR.data?.data ?? []) : [],
    adsetBudgets,
    adsets: adsetsDetailed,
    insights: insightsR.ok ? (insightsR.data?.data ?? []) : [],
    daily: dailyR.ok ? (dailyR.data?.data ?? []) : [],
    errors: [balanceR, campaignsR, adsetsR, adsetInsightsR, insightsR, dailyR]
      .filter((r) => !r.ok)
      .map((r) => r.error),
  };
}

// ============================================================
// CRON_TICK: chamado pelo pg_cron 4h. Sync de insights + chama
// marketing-midia (edge AI) pra gerar relatorio_4h.
// ============================================================
async function handleCronTick() {
  const started = new Date();
  const results: Record<string, unknown> = { started_at: started.toISOString() };

  const sync = await handleSyncInsights({});
  results.sync = sync;

  // Chama marketing-midia (edge AI separada) pra gerar relatorio
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/marketing-midia`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ action: "schedule_tick" }),
    });
    const reportJson = await r.json().catch(() => ({}));
    results.report = {
      ok: r.ok,
      output_id: reportJson?.output_id,
      resumo: reportJson?.resumo,
      meta_configured: reportJson?.meta_configured,
    };
  } catch (e) {
    results.report = { ok: false, error: (e as Error).message };
  }

  const ended = new Date();
  results.ended_at = ended.toISOString();
  results.duration_ms = ended.getTime() - started.getTime();
  results.success = true;

  try {
    const admin = adminClient();
    await admin.from("system_cron_log").insert({
      job_name: "marketing-meta-cron",
      success: true,
      result: results,
    });
  } catch { /* tabela pode nao existir */ }

  return results;
}

// ============================================================
// Router
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action ?? "validate";
    let result: any;

    switch (action) {
      case "validate":      result = await handleValidate(body); break;
      case "save":          result = await handleSave(body); break;
      case "publish":       result = await handlePublish(body); break;
      case "set_status":      result = await handleSetStatus(body); break;
      case "set_adset_status":    result = await handleSetAdsetStatus(body); break;
      case "update_budget":   result = await handleUpdateBudget(body); break;
      case "update_adset_budget": result = await handleUpdateAdsetBudget(body); break;
      case "sync_insights":   result = await handleSyncInsights(body); break;
      case "cockpit_data":  result = await handleCockpitData(body); break;
      case "cron_tick":     result = await handleCronTick(); break;
      default:
        result = { success: false, error: `action invalida: ${action}`, status: 400 };
    }

    const status = result.status ?? (result.success ? 200 : 500);
    delete result.status;

    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[marketing-meta] fatal:", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
