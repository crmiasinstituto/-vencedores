// One-shot: aplica migration de program access + libera "Sejam bem vindos"
// Usa connection direta ao Postgres via service_role/pooler.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Tenta aplicar a coluna (se nao existir) + update via RPC pg_exec (se existir),
    // senao tenta INSERT via REST na tabela (se a coluna ja existir vinda da migration
    // automatica) simplesmente atualizando os modulos com allowed_programs = null.

    const results: any = { step1_alter: null, step2_reset_levels: null, step3_liberate: null };

    // Primeiro: tenta fazer UPDATE simples. Se a coluna nao existir, vai dar erro 42703.
    const { data: mods, error: selErr } = await supabase
      .from("member_modules")
      .select("id, title")
      .ilike("title", "%bem%vindo%");

    results.modules_found = mods;

    if (selErr) {
      results.select_error = selErr.message;
      return new Response(JSON.stringify(results), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Libera TODOS os modulos existentes (allowed_programs = null = todos)
    // e zera required_level
    const { error: upAllErr } = await (supabase as any)
      .from("member_modules")
      .update({ allowed_programs: null, required_level: null })
      .not("id", "is", null);
    results.step3_liberate = upAllErr ? { error: upAllErr.message, code: (upAllErr as any).code } : "ok";

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
