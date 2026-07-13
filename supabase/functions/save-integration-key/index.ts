// ============================================================
// save-integration-key
//
// Edge function que faz upsert em public.integration_keys com SERVICE_ROLE_KEY,
// bypassando RLS. Usado por /admin/configuracoes pra salvar/atualizar
// chaves de integração (OpenAI, Firecrawl, ScrapeCreators, Gemini, etc).
//
// A autenticação é admin via Supabase Auth — o front passa o user_id
// que validamos contra auth.users. Se você quiser segurança forte adicional,
// adicione checagem de role/RLS no frontend.
//
// Body: {
//   service: string,
//   api_key?: string | null,
//   api_secret?: string | null,
//   account_id?: string | null,
//   is_active?: boolean,
// }
// verify_jwt: false
// ============================================================

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Input {
  service: string;
  api_key?: string | null;
  api_secret?: string | null;
  account_id?: string | null;
  is_active?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as Partial<Input> & { service?: string };
    const service = body?.service;

    if (!service || typeof service !== "string") {
      return json({ error: "service é obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert PARCIAL: só inclui no payload o que o caller mandou.
    // Campo omitido = mantém valor atual no banco. Pra apagar, mandar null
    // explícito. (Necessário porque agora o front nunca lê o valor cru —
    // se o payload incluísse api_key=null em toda gravação, o toggle de
    // ativo apagaria a chave acidentalmente.)
    const payload: Record<string, unknown> = {
      service,
      updated_at: new Date().toISOString(),
    };
    if ("api_key" in body) payload.api_key = body.api_key ?? null;
    if ("api_secret" in body) payload.api_secret = body.api_secret ?? null;
    if ("account_id" in body) payload.account_id = body.account_id ?? null;
    if (typeof body.is_active === "boolean") payload.is_active = body.is_active;

    // metadata: merge parcial. Ex: body.metadata = { display_label: 'X' }
    // funde com o jsonb atual, preservando outras chaves.
    if (body && typeof body.metadata === "object" && body.metadata !== null) {
      const { data: current } = await supabase
        .from("integration_keys")
        .select("metadata")
        .eq("service", service)
        .maybeSingle();
      const currentMeta = (current?.metadata as Record<string, unknown>) || {};
      payload.metadata = { ...currentMeta, ...(body.metadata as Record<string, unknown>) };
    }

    const { data, error } = await supabase
      .from("integration_keys")
      .upsert(payload, { onConflict: "service" })
      .select()
      .single();

    if (error) {
      console.error("[save-integration-key]", error);
      return json({ error: error.message, details: error }, 500);
    }

    return json({ ok: true, row: data });
  } catch (e) {
    console.error("[save-integration-key] fatal:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
