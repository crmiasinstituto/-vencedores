/**
 * wa-cloud-profile — GET/POST do perfil WhatsApp Business (Meta Cloud API).
 *
 * Esse e o perfil que LEADS veem quando abrem conversa: foto, status (about),
 * email, site, endereco, vertical, description. NAO confunda com avatar_url
 * do CRM (whatsapp_instances.avatar_url), que e apenas display interno do painel.
 *
 * GET   ?instance_id=<uuid>            → busca perfil atual da Meta
 * POST  { instance_id, fields: {...} } → atualiza perfil (parcial OK)
 *
 * Foto NAO incluida nesta versao: Meta exige upload resumable em 2 passos
 * (POST /app_id/uploads → handle → POST profile com profile_picture_handle).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("WHATSAPP_CLOUD_APP_ID") || "1405201087970275"; // SQUAAD app
const GRAPH_API_VERSION = "v22.0";

/**
 * Resumable upload pra Meta (3 passos):
 *  1. POST /{app_id}/uploads → cria sessao, retorna { id: upload_session_id }
 *  2. POST /{upload_session_id} com body=binary + header file_offset → retorna { h: handle }
 *  3. usa o handle no /whatsapp_business_profile {profile_picture_handle}
 *
 * Aceita PNG/JPG. Recomendado 640x640.
 */
async function uploadProfilePictureFromUrl(
  imageUrl: string,
  appId: string,
  appAccessToken: string,
): Promise<{ handle: string }> {
  // Baixa a imagem
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: HTTP ${imgRes.status}`);
  const buf = new Uint8Array(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get("content-type") || "image/jpeg";

  // Passo 1: criar sessao
  const sessionUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${appId}/uploads?file_length=${buf.length}&file_type=${encodeURIComponent(mime)}&access_token=${appAccessToken}`;
  const s = await fetch(sessionUrl, { method: "POST" });
  const sData = await s.json();
  if (!s.ok || !sData?.id) {
    throw new Error(`Erro criando upload session: ${sData?.error?.message || JSON.stringify(sData)}`);
  }
  const sessionId = sData.id;

  // Passo 2: upload binary
  const u = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${sessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${appAccessToken}`,
      file_offset: "0",
    },
    body: buf,
  });
  const uData = await u.json();
  if (!u.ok || !uData?.h) {
    throw new Error(`Erro no upload: ${uData?.error?.message || JSON.stringify(uData)}`);
  }
  return { handle: uData.h };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const isPost = req.method === "POST";
    const body = isPost ? await req.json() : {};
    const instanceId = body.instance_id || url.searchParams.get("instance_id");

    if (!instanceId) return jsonRes({ error: "instance_id required" }, 400);

    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("id, phone_number_id, api_key, provider")
      .eq("id", instanceId)
      .maybeSingle();

    if (!inst || inst.provider !== "cloud_api" || !inst.phone_number_id || !inst.api_key) {
      return jsonRes({ error: "Cloud API instance not found or missing credentials" }, 404);
    }

    const graphUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${inst.phone_number_id}/whatsapp_business_profile`;

    if (req.method === "GET") {
      const fields = "about,description,address,email,profile_picture_url,websites,vertical,messaging_product";
      const res = await fetch(`${graphUrl}?fields=${fields}`, {
        headers: { Authorization: `Bearer ${inst.api_key}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return jsonRes({ error: data.error?.message || "Meta API error", details: data }, res.status || 502);
      }
      const profile = data.data?.[0] || {};
      return jsonRes({ success: true, profile });
    }

    // Action: upload da foto de perfil (Meta exige resumable upload em 3 passos)
    if (req.method === "POST" && body.action === "upload_picture") {
      const imageUrl: string | undefined = body.image_url;
      if (!imageUrl) return jsonRes({ error: "image_url required" }, 400);
      // Token de acesso pro endpoint /uploads precisa ser App Access Token
      // (format: {app_id}|{app_secret}). Mais simples e funcional.
      const appSecret = Deno.env.get("WHATSAPP_CLOUD_APP_SECRET") || "";
      if (!appSecret) return jsonRes({ error: "WHATSAPP_CLOUD_APP_SECRET not configured" }, 500);
      const appAccessToken = `${META_APP_ID}|${appSecret}`;

      // 1+2: baixa imagem + upload resumable
      const { handle } = await uploadProfilePictureFromUrl(imageUrl, META_APP_ID, appAccessToken);

      // 3: aplica handle no profile (usa user access token = api_key do System User)
      const profRes = await fetch(graphUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${inst.api_key}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          profile_picture_handle: handle,
        }),
      });
      const profData = await profRes.json();
      if (!profRes.ok || profData.error) {
        return jsonRes({ error: profData.error?.message || "Meta API error", details: profData }, profRes.status || 502);
      }
      return jsonRes({ success: true, handle, applied: profData });
    }

    if (req.method === "POST") {
      const fields = body.fields || {};
      const payload: any = { messaging_product: "whatsapp" };

      // Validacao por campo
      const allowed = ["about", "description", "address", "email", "vertical", "websites"];
      for (const key of allowed) {
        if (fields[key] !== undefined) {
          payload[key] = fields[key] || null;
        }
      }

      // Limites Meta:
      // about: max 139 chars
      // description: max 512
      // address: max 256
      // email: max 128
      // websites: array de strings, max 2 entradas, cada URL com http(s)://
      if (payload.about && payload.about.length > 139) {
        return jsonRes({ error: "Status (about) deve ter no maximo 139 caracteres" }, 400);
      }
      if (payload.description && payload.description.length > 512) {
        return jsonRes({ error: "Descricao deve ter no maximo 512 caracteres" }, 400);
      }
      if (payload.email && payload.email.length > 128) {
        return jsonRes({ error: "Email deve ter no maximo 128 caracteres" }, 400);
      }
      if (payload.address && payload.address.length > 256) {
        return jsonRes({ error: "Endereco deve ter no maximo 256 caracteres" }, 400);
      }
      if (Array.isArray(payload.websites)) {
        if (payload.websites.length > 2) {
          return jsonRes({ error: "Maximo 2 sites" }, 400);
        }
        for (const w of payload.websites) {
          if (typeof w !== "string" || !/^https?:\/\//.test(w)) {
            return jsonRes({ error: `Site invalido: ${w} (precisa comecar com http:// ou https://)` }, 400);
          }
        }
        if (payload.websites.length === 0) payload.websites = null;
      }

      const res = await fetch(graphUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${inst.api_key}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return jsonRes({ error: data.error?.message || "Meta API error", details: data }, res.status || 502);
      }
      return jsonRes({ success: true, updated: data.success === true, sent: payload });
    }

    return jsonRes({ error: "method_not_allowed" }, 405);
  } catch (err: any) {
    console.error("[wa-cloud-profile]", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});
