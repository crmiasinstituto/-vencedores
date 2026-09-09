/**
 * wa-sync-templates — sincroniza templates Meta Cloud API com whatsapp_cloud_templates.
 *
 * Varre TODAS as instâncias provider='cloud_api'. Antes lia só a primeira (`.limit(1)`),
 * e por isso os templates do segundo número (Isaac Santos | Coexistente, WABA
 * 1356814739183286) nunca apareciam no CRM — a tela mostrava 37 e a Meta tinha mais.
 *
 * Template da Cloud API pertence a um WABA, e cada número tem o seu. Por isso o upsert
 * casa por (meta_waba_id, name, language): dois números podem ter template de mesmo nome
 * sem um sobrescrever o outro.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, business_account_id, api_key, status")
      .eq("provider", "cloud_api")
      .in("status", ["connected", "active"]);

    const utilizaveis = (instances || []).filter(
      (i: any) => i.business_account_id && i.api_key,
    );
    if (!utilizaveis.length) {
      return jsonRes({ error: "Nenhuma instância Cloud API configurada" }, 404);
    }

    // Um WABA pode estar em mais de uma instância; sincronizar duas vezes só desperdiça
    // chamada e ainda faz o upsert brigar consigo mesmo.
    const porWaba = new Map<string, any>();
    for (const i of utilizaveis) {
      if (!porWaba.has(i.business_account_id)) porWaba.set(i.business_account_id, i);
    }

    const linhas: any[] = [];
    let totalUpserted = 0;

    for (const inst of porWaba.values()) {
      const resultado = {
        linha: inst.instance_name,
        waba_id: inst.business_account_id,
        encontrados: 0,
        salvos: 0,
        erro: null as string | null,
      };

      try {
        // Paginação: com mais de 100 templates a primeira página não é tudo.
        let url =
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${inst.business_account_id}` +
          `/message_templates?fields=id,name,language,category,status,components,quality_score,rejected_reason&limit=100`;
        const templates: any[] = [];

        while (url) {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${inst.api_key}` } });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message || "Meta API error");
          templates.push(...(data.data || []));
          url = data.paging?.next || "";
        }

        resultado.encontrados = templates.length;

        for (const t of templates) {
          const body = (t.components || []).find((c: any) => c.type === "BODY");
          const { error } = await supabase.from("whatsapp_cloud_templates").upsert(
            {
              meta_template_id: t.id,
              meta_waba_id: inst.business_account_id,
              name: t.name,
              language: t.language,
              category: t.category,
              status: t.status,
              rejection_reason: t.rejected_reason || null,
              components: t.components || [],
              variables_count: countVariables(body?.text || ""),
            },
            { onConflict: "meta_waba_id,name,language" },
          );
          if (!error) {
            resultado.salvos++;
            totalUpserted++;
          } else {
            console.error(`[${inst.instance_name}] ${t.name}: ${error.message}`);
          }
        }
      } catch (e: any) {
        // Uma linha com token vencido não pode derrubar a sincronização das outras.
        resultado.erro = e?.message || String(e);
        console.error(`Falha na linha ${inst.instance_name}: ${resultado.erro}`);
      }

      linhas.push(resultado);
    }

    return jsonRes({
      success: true,
      linhas,
      total: linhas.reduce((s, l) => s + l.encontrados, 0),
      upserted: totalUpserted,
    });
  } catch (err: any) {
    return jsonRes({ error: err.message }, 500);
  }
});

function countVariables(text: string): number {
  const matches = text.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return new Set(matches).size;
}

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
