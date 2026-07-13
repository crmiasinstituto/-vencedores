import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le a chave de integracao do banco (integration_keys) com fallback pra env var.
// Fonte unica da verdade = tela /admin/configuracoes. Permite trocar a chave sem
// redeploy e suporta instancia-por-cliente (cada projeto tem a sua chave no banco).
async function getIntegrationKey(supabase: any, service: string, envFallback?: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("integration_keys")
      .select("api_key, is_active")
      .eq("service", service)
      .maybeSingle();
    if (data && data.is_active && data.api_key) return String(data.api_key).trim();
  } catch (_) { /* cai no fallback */ }
  return (envFallback ? Deno.env.get(envFallback) : null) || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = await getIntegrationKey(supabase, "soniox", "SONIOX_API_KEY");
    if (!apiKey) throw new Error("Soniox nao configurado. Configure em /admin/configuracoes.");

    return new Response(JSON.stringify({ api_key: apiKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
