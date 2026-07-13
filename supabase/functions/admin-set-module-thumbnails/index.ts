// One-shot: atribui as capas customizadas (cyberpunk neon) aos modulos da trilha.
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

    const updates = [
      { match: "%bem vindo%", url: "/trilhas/boas-vindas.png" },
      { match: "%automacao%", url: "/trilhas/automacao-com-ia.png" },
      { match: "%construindo%crm%", url: "/trilhas/construindo-crm.png" },
      { match: "%nova era%claude%", url: "/trilhas/nova-era-claude.png" },
      { match: "%masterclass%whatsapp%", url: "/trilhas/masterclass-whatsapp.png" },
      { match: "%templates%ferramentas%", url: "/trilhas/templates-ferramentas.png" },
    ];

    const results: any[] = [];
    for (const u of updates) {
      const { data, error } = await (supabase as any)
        .from("member_modules")
        .update({ thumbnail_url: u.url })
        .ilike("title", u.match)
        .select("id, title, thumbnail_url");
      results.push({ url: u.url, match: u.match, updated: data || [], error: error?.message });
    }

    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
