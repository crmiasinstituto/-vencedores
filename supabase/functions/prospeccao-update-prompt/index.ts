// ============================================================
// prospeccao-update-prompt
// Atualiza um prompt em prospeccao_prompts_config (service_role)
// Usado por /admin/prospeccao/configuracoes pra editar prompts.
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
  id: string;
  prompt_text?: string;
  ai_model?: string;
  temperature?: number;
  tom_voz?: string;
  is_active?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body: Input = await req.json();
    if (!body.id) return json({ error: "id é obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.prompt_text !== undefined) patch.prompt_text = body.prompt_text;
    if (body.ai_model !== undefined) patch.ai_model = body.ai_model;
    if (body.temperature !== undefined) patch.temperature = body.temperature;
    if (body.tom_voz !== undefined) patch.tom_voz = body.tom_voz;
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    const { data, error } = await supabase
      .from("prospeccao_prompts_config")
      .update(patch)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("[update-prompt]", error);
      return json({ error: error.message }, 500);
    }
    return json({ ok: true, row: data });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
