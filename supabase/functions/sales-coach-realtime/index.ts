import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// === resolver de chave de integracao (fonte unica = tabela integration_keys, /admin/configuracoes) ===
// Le do banco primeiro; cai no env var como fallback retrocompat. Suporta instancia-por-cliente.
let _keyClient: any = null;
async function getIntegrationKey(service: string, envFallback?: string): Promise<string | null> {
  try {
    if (!_keyClient) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      _keyClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    }
    const { data } = await _keyClient
      .from("integration_keys")
      .select("api_key, is_active")
      .eq("service", service)
      .maybeSingle();
    if (data && data.is_active && data.api_key) return String(data.api_key).trim();
  } catch (_) { /* cai no fallback */ }
  return (envFallback ? Deno.env.get(envFallback) : null) || null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcription, playbook, currentPhase, checklistStatus, leadName } = await req.json();
    const LOVABLE_API_KEY = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const phasesText = (playbook.phases || []).map((p: any) => {
      const checkItems = (p.checklist || []).map((c: string, i: number) => {
        const done = checklistStatus?.[p.id]?.[i] === true;
        return `  ${done ? '[x]' : '[ ]'} ${c}`;
      }).join('\n');
      const rules = (p.rules || []).map((r: string) => `  ⚠️ ${r}`).join('\n');
      return `### Fase ${p.order}: ${p.name} (id: ${p.id})\nChecklist:\n${checkItems}\nRegras:\n${rules}`;
    }).join('\n\n');

    const systemPrompt = `Você é um Sales Coach em tempo real monitorando uma chamada de vendas ao vivo. Analise a transcrição contra o playbook.

PLAYBOOK: "${playbook.name}"
${phasesText}

FASE ATUAL: ${currentPhase}
LEAD: ${leadName || 'Desconhecido'}

REGRAS:
1. Analise CONTEXTUALMENTE - não use detecção por palavra-chave
2. Se o vendedor fez rapport, chamou pelo nome, etc - marque no checklist
3. Se uma REGRA foi violada, gere ALERTA com severity "high"
4. Sugira a próxima pergunta baseada no contexto
5. Seja ULTRA CONCISO - responda em JSON mínimo

RESPONDA APENAS JSON válido (sem markdown, sem code blocks):
{"phase_update":null,"checklist_updates":[{"phase_id":"id","item_index":0,"completed":true}],"alerts":[{"type":"rule_violation","severity":"high","message":"msg","phase_id":"id"}],"tips":["dica"],"next_question":"pergunta?"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcrição:\n${transcription}` },
        ],
        stream: true,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("sales-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
