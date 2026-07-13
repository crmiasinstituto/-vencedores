/**
 * wa-create-template — Cria template Meta via Cloud API e UPSERT local.
 * Lê WABA + token da primeira instância provider='cloud_api'.
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

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function countVariables(text: string): number {
  const matches = text.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return new Set(matches).size;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { name, category, language, components } = body;

    if (!name || !/^[a-z0-9_]+$/.test(name)) {
      return jsonRes({ error: "Nome inválido. Use lowercase, números e underscore." }, 400);
    }
    if (name.length > 512) return jsonRes({ error: "Nome muito longo (max 512)" }, 400);
    if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(category)) {
      return jsonRes({ error: "Categoria inválida" }, 400);
    }
    if (!language) return jsonRes({ error: "Idioma obrigatório" }, 400);
    if (!Array.isArray(components) || components.length === 0) {
      return jsonRes({ error: "components obrigatório" }, 400);
    }
    const bodyComp = components.find((c: any) => c.type === "BODY");
    if (!bodyComp || !bodyComp.text) return jsonRes({ error: "Body obrigatório" }, 400);
    if (bodyComp.text.length > 1024) return jsonRes({ error: "Body muito longo (max 1024)" }, 400);

    const bodyVarCount = countVariables(bodyComp.text);
    if (bodyVarCount > 0) {
      const examples = bodyComp.example?.body_text?.[0] || [];
      if (examples.length !== bodyVarCount) {
        return jsonRes(
          { error: `Body tem ${bodyVarCount} variável(is) mas faltam ${bodyVarCount - examples.length} exemplo(s).` },
          400,
        );
      }
    }

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, business_account_id, api_key, status")
      .eq("provider", "cloud_api")
      .in("status", ["connected", "active"])
      .limit(1)
      .maybeSingle();
    if (!instance?.business_account_id || !instance?.api_key) {
      return jsonRes({ error: "Nenhuma instância Cloud API conectada" }, 404);
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${instance.business_account_id}/message_templates`;
    const metaRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${instance.api_key}` },
      body: JSON.stringify({ name, category, language, components }),
    });
    const metaData = await metaRes.json();
    if (!metaRes.ok || metaData.error) {
      return jsonRes(
        { error: metaData.error?.message || "Falha ao criar template na Meta", meta_error: metaData.error },
        metaRes.status || 502,
      );
    }

    const metaTemplateId = metaData.id;
    const metaStatus = metaData.status || "PENDING";
    const metaCategory = metaData.category || category;

    const { data: localTpl, error: insertErr } = await supabase
      .from("whatsapp_cloud_templates")
      .upsert(
        {
          meta_template_id: metaTemplateId,
          meta_waba_id: instance.business_account_id,
          name,
          language,
          category: metaCategory,
          status: metaStatus,
          components,
          variables_count: bodyVarCount,
        },
        { onConflict: "name,language" },
      )
      .select()
      .single();

    if (insertErr) {
      return jsonRes({
        success: true,
        warning: "Template criado na Meta mas erro ao salvar local. Será sincronizado.",
        meta_template_id: metaTemplateId,
        status: metaStatus,
      });
    }

    return jsonRes({
      success: true,
      template: localTpl,
      status: metaStatus,
      message: metaStatus === "PENDING"
        ? "Template enviado pra Meta. Aprovação leva de minutos a 24h."
        : `Template criado com status ${metaStatus}.`,
    });
  } catch (err: any) {
    return jsonRes({ error: err.message }, 500);
  }
});
