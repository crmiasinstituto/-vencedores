// ARQUIVADO em 2026-05-19. Function ja' rodou e populou integration_keys
// com firecrawl/scrapecreators/gemini. Foi apagada do servidor pra liberar
// slot (plano Supabase tava em 100/100 e uazapi-proxy precisava redeploy).
// Mantido aqui so' como referencia caso precise rodar de novo no futuro.
// Pra ressuscitar: copia esse arquivo pra supabase/functions/seed-prospeccao-keys/
// e roda `supabase functions deploy seed-prospeccao-keys`.

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const services = ["firecrawl", "scrapecreators", "gemini"];
  const results: any[] = [];
  for (const service of services) {
    const { data: existing } = await supabase
      .from("integration_keys")
      .select("id")
      .eq("service", service)
      .maybeSingle();
    if (existing) {
      results.push({ service, created: false, existing: true });
      continue;
    }
    const { error } = await supabase
      .from("integration_keys")
      .insert({ service, is_active: true });
    results.push({ service, created: !error, error: error?.message });
  }
  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
