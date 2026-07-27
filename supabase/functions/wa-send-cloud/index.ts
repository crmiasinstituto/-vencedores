/**
 * wa-send-cloud — WhatsApp Cloud API (Meta oficial) — Envio (single-tenant)
 *
 * Resolve instância via instance_id OU primeira ativa com provider='cloud_api'.
 * Coexiste com instâncias UAZAPI (provider='uazapi').
 *
 * Persiste em whatsapp_messages com o schema real do CRM:
 *   instance_id, lead_id, board_id, remote_phone, direction='outbound',
 *   message_type, content, media_url, whatsapp_message_id, status, metadata.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_API_VERSION = "v22.0";

interface CloudInstance {
  id: string;
  instance_name: string;
  api_key: string;
  phone_number_id: string;
  business_account_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, phone, lead_id, sent_by, instance_id, campaign_id } = body;
    if (!phone) return jsonRes({ error: "phone required" }, 400);

    const instance = await resolveInstance(supabase, { instance_id });
    if (!instance) return jsonRes({ error: "Nenhuma instância Cloud API ativa encontrada" }, 404);

    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const graphUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instance.phone_number_id}/messages`;

    let result: { ok: boolean; data: any; content: string; messageType: string; extraMeta?: any };

    switch (action) {
      case "send_template":
        result = await sendTemplate(body, formattedPhone, graphUrl, instance, supabase);
        break;
      case "send_text":
        result = await sendText(body, formattedPhone, graphUrl, instance);
        break;
      case "send_image":
        result = await sendMedia(body, formattedPhone, "image", graphUrl, instance);
        break;
      case "send_document":
        result = await sendMedia(body, formattedPhone, "document", graphUrl, instance);
        break;
      case "send_video":
        result = await sendMedia(body, formattedPhone, "video", graphUrl, instance);
        break;
      case "send_audio":
        result = await sendMedia(body, formattedPhone, "audio" as any, graphUrl, instance);
        break;
      default:
        if (body.template_name) result = await sendTemplate(body, formattedPhone, graphUrl, instance, supabase);
        else if (body.text || body.message) result = await sendText(body, formattedPhone, graphUrl, instance);
        else return jsonRes({ error: "action obrigatória" }, 400);
    }

    if (!result.ok) {
      console.error(`[wa-send-cloud] error:`, JSON.stringify(result.data));
      return jsonRes(
        { error: result.data.error?.message || "Falha ao enviar", details: result.data },
        500,
      );
    }

    const messageId = result.data.messages?.[0]?.id || `cloud_${Date.now()}`;

    await supabase.from("whatsapp_messages").insert({
      instance_id: instance.id,
      lead_id: lead_id || null,
      remote_phone: formattedPhone,
      direction: "outbound",
      message_type: result.messageType || "text",
      content: result.content,
      media_url: result.extraMeta?.media_url || null,
      whatsapp_message_id: messageId,
      status: "sent",
      metadata: {
        sent_by: sent_by || "system",
        provider: "cloud_api",
        campaign_id: campaign_id || null,
        ...(result.extraMeta || {}),
      },
    });

    return jsonRes({ success: true, message_id: messageId, instance_id: instance.id });
  } catch (err: any) {
    console.error("[wa-send-cloud] unexpected:", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});

async function resolveInstance(supabase: any, params: { instance_id?: string }): Promise<CloudInstance | null> {
  const sel = "id, instance_name, api_key, phone_number_id, business_account_id";
  if (params.instance_id) {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select(sel)
      .eq("id", params.instance_id)
      .eq("provider", "cloud_api")
      .maybeSingle();
    return hydrate(data);
  }
  const { data } = await supabase
    .from("whatsapp_instances")
    .select(sel)
    .eq("provider", "cloud_api")
    .limit(1)
    .maybeSingle();
  return hydrate(data);
}

function hydrate(data: any): CloudInstance | null {
  if (!data) return null;
  if (!data.api_key || !data.phone_number_id) {
    console.warn(`[wa-send-cloud] instance ${data.id} sem api_key ou phone_number_id`);
    return null;
  }
  return data as CloudInstance;
}

/**
 * Monta o componente `header` de um template de mídia.
 *
 * Pegadinha da Meta: o `example.header_handle` que aparece no template aprovado serve SÓ pra
 * aprovação — não dá pra reaproveitar no envio (é um handle da API de upload, e a URL do
 * scontent expira). Todo envio de template com HEADER de mídia tem que remandar o arquivo,
 * por `link` (URL pública) ou por `id` (media_id já enviado pra /media). Sem isso a Meta
 * devolve #132012 "parameter format does not match format in the created template" e a
 * mensagem simplesmente não sai.
 */
function buildHeaderComponent(headerMedia: any, headerTextParams?: string[]) {
  if (Array.isArray(headerTextParams) && headerTextParams.length > 0) {
    return { type: "header", parameters: headerTextParams.map((t: string) => ({ type: "text", text: t })) };
  }
  if (!headerMedia) return null;
  const kind = String(headerMedia.type || "").toLowerCase();
  if (!["video", "image", "document"].includes(kind)) return null;
  // `id` tem precedência: media_id não expira tão cedo e evita a Meta ter que baixar a URL.
  const asset: any = headerMedia.id ? { id: headerMedia.id } : headerMedia.link ? { link: headerMedia.link } : null;
  if (!asset) return null;
  if (kind === "document" && headerMedia.filename) asset.filename = headerMedia.filename;
  return { type: "header", parameters: [{ type: kind, [kind]: asset }] };
}

async function sendTemplate(body: any, phone: string, graphUrl: string, instance: CloudInstance, supabase: any) {
  const { template_name, template_params, template_language, button_url_params, header_media, header_text_params } = body;
  if (!template_name) throw new Error("template_name obrigatório");
  const language = template_language || "pt_BR";
  const payload: any = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: { name: template_name, language: { code: language } },
  };
  const components: any[] = [];
  // header ANTES do body: a Meta valida os componentes na ordem declarada no template.
  const headerComp = buildHeaderComponent(header_media, header_text_params);
  if (headerComp) components.push(headerComp);
  if (template_params && template_params.length > 0) {
    components.push({
      type: "body",
      parameters: template_params.map((p: string) => ({ type: "text", text: p })),
    });
  }
  // Botão URL dinâmica: cada lead recebe sua própria URL (ex: token onboarding).
  // body.button_url_params = string[] (1 valor por botão URL, em ordem).
  if (Array.isArray(button_url_params)) {
    button_url_params.forEach((value: string, idx: number) => {
      if (value) {
        components.push({
          type: "button",
          sub_type: "url",
          index: String(idx),
          parameters: [{ type: "text", text: value }],
        });
      }
    });
  }
  if (components.length > 0) payload.template.components = components;
  const response = await callCloudAPI(graphUrl, instance.api_key, payload);
  let content = `[Template: ${template_name}]`;
  try {
    const { data: tpl } = await supabase
      .from("whatsapp_cloud_templates")
      .select("components")
      .eq("name", template_name)
      .maybeSingle();
    if (tpl?.components) {
      const bodyComp = tpl.components.find((c: any) => c?.type === "BODY");
      if (bodyComp?.text) {
        let t = bodyComp.text;
        (template_params || []).forEach((p: string, i: number) => { t = t.replace(`{{${i + 1}}}`, p); });
        content = t;
      }
    }
  } catch {/* non-fatal */}
  return { ok: response.ok, data: response.data, content, messageType: "template", extraMeta: { template_name, template_language: language } };
}

async function sendText(body: any, phone: string, graphUrl: string, instance: CloudInstance) {
  const text = body.text || body.message;
  if (!text) throw new Error("text/message obrigatório");
  const payload = { messaging_product: "whatsapp", to: phone, type: "text", text: { body: text } };
  const response = await callCloudAPI(graphUrl, instance.api_key, payload);
  return { ok: response.ok, data: response.data, content: text, messageType: "text" };
}

async function sendMedia(body: any, phone: string, type: "image" | "document" | "video" | "audio", graphUrl: string, instance: CloudInstance) {
  const { media_url, caption, filename } = body;
  if (!media_url) throw new Error("media_url obrigatório");
  const mediaObj: any = { link: media_url };
  if (caption && type !== "audio") mediaObj.caption = caption;
  if (filename && type === "document") mediaObj.filename = filename;
  const payload = { messaging_product: "whatsapp", to: phone, type, [type]: mediaObj };
  const response = await callCloudAPI(graphUrl, instance.api_key, payload);
  const label: Record<string, string> = { image: "Imagem", document: "Documento", video: "Vídeo", audio: "Áudio" };
  return { ok: response.ok, data: response.data, content: caption || `[${label[type]}]`, messageType: type, extraMeta: { media_url } };
}

async function callCloudAPI(graphUrl: string, token: string, payload: any) {
  const response = await fetch(graphUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
