// Daily job that picks recently-closed or long-idle conversations and asks
// Gemini to analyze them: what worked, where we lost, unhandled objections,
// and concrete prompt improvements. Results are stored in ai_agent_logs with
// log_type = 'post_analysis' and shown in the performance dashboard.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { analyzed: 0, skipped: 0, failed: 0 };

  try {
    const lovableApiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
    const body = await req.json().catch(() => ({}));
    const hoursWindow = body.hours || 24;
    const limit = body.limit || 10;
    const sinceIso = new Date(Date.now() - hoursWindow * 3600_000).toISOString();

    // Pick conversations that closed / paused / went idle in the window
    const { data: convs } = await supabase.from("ai_agent_conversations")
      .select("id, lead_id, agent_id, status, messages_history, pause_reason, updated_at, last_processed_at, total_messages_sent, total_messages_received")
      .or(`status.eq.paused,status.eq.closed,last_processed_at.lte.${sinceIso}`)
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false })
      .limit(limit);

    for (const conv of (convs || [])) {
      try {
        // Skip if already analyzed recently
        const { data: existing } = await supabase.from("ai_agent_logs")
          .select("id").eq("conversation_id", conv.id).eq("log_type", "post_analysis")
          .gte("created_at", sinceIso).maybeSingle();
        if (existing) { stats.skipped++; continue; }

        const history = Array.isArray(conv.messages_history) ? conv.messages_history : [];
        if (history.length < 4) { stats.skipped++; continue; }

        const { data: lead } = await supabase.from("crm_leads")
          .select("name, whatsapp, company_name, lead_score, lost_reason").eq("id", conv.lead_id).maybeSingle();

        const transcript = history.slice(-30).map((m: any, i: number) => `[${i + 1}] ${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`).join("\n");

        const prompt = `Voce e um Sales Coach analisando uma conversa entre um SDR (Carol) e um lead. Seja direto, objetivo e acionavel.

LEAD: ${lead?.name || "(sem nome)"} | Empresa: ${lead?.company_name || "n/a"} | Score: ${lead?.lead_score || 0} | Lost reason: ${lead?.lost_reason || "(nao perdido)"}
Status final da conversa: ${conv.status} (${conv.pause_reason || "ativo"})
Mensagens enviadas / recebidas: ${conv.total_messages_sent || 0} / ${conv.total_messages_received || 0}

TRANSCRICAO (ultimas 30 mensagens):
${transcript}

Retorne JSON com:
- outcome: 'converted' | 'lost' | 'abandoned' | 'paused' | 'in_progress'
- quality_score: 0-10 (qualidade da conduta do agente, nao do lead)
- strengths: array de 1-3 pontos positivos
- weaknesses: array de 1-3 pontos de melhoria
- unhandled_objections: array de objecoes que o lead levantou e Carol nao tratou bem
- prompt_suggestions: array de 1-2 sugestoes concretas de ajuste no system prompt
- summary: 1-2 frases resumindo o que aconteceu`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Voce e um Sales Coach. Retorne APENAS JSON valido." },
              { role: "user", content: prompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "analyze_conversation",
                parameters: {
                  type: "object",
                  properties: {
                    outcome: { type: "string", enum: ["converted", "lost", "abandoned", "paused", "in_progress"] },
                    quality_score: { type: "number" },
                    strengths: { type: "array", items: { type: "string" } },
                    weaknesses: { type: "array", items: { type: "string" } },
                    unhandled_objections: { type: "array", items: { type: "string" } },
                    prompt_suggestions: { type: "array", items: { type: "string" } },
                    summary: { type: "string" },
                  },
                  required: ["outcome", "quality_score", "summary"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "analyze_conversation" } },
          }),
        });

        if (!aiRes.ok) { stats.failed++; continue; }
        const aiData = await aiRes.json();
        const argStr = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        let analysis: any;
        try {
          analysis = typeof argStr === "string" ? JSON.parse(argStr) : argStr;
        } catch {
          const m = (aiData.choices?.[0]?.message?.content || "").match(/\{[\s\S]*\}/);
          analysis = m ? JSON.parse(m[0]) : null;
        }
        if (!analysis) { stats.failed++; continue; }

        await supabase.from("ai_agent_logs").insert({
          conversation_id: conv.id,
          lead_id: conv.lead_id,
          agent_id: conv.agent_id,
          log_type: "post_analysis",
          data: analysis,
        });
        stats.analyzed++;
      } catch (e: any) {
        console.error("[analyze] error:", e);
        stats.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[analyze] fatal:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
