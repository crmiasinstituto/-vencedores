import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { callId, transcription, leadContext, tableName } = await req.json();
    if (!callId) throw new Error("callId required");

    const LOVABLE_API_KEY = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const prompt = `Analise esta chamada de vendas e retorne um JSON com:
- diagnostico: resumo em 2-3 frases
- pontos_chave: array de strings (3-5 pontos)
- sentimento: "positive", "neutral" ou "negative"
- proximo_passo: string com recomendação
- tarefas_sugeridas: array de { title: string, priority: "high"|"medium"|"low" }

Contexto do lead: ${leadContext || 'Não disponível'}

Transcrição: ${transcription || 'Não disponível'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista de vendas expert. Responda APENAS em JSON válido." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_call",
            description: "Return structured call analysis",
            parameters: {
              type: "object",
              properties: {
                diagnostico: { type: "string" },
                pontos_chave: { type: "array", items: { type: "string" } },
                sentimento: { type: "string", enum: ["positive", "neutral", "negative"] },
                proximo_passo: { type: "string" },
                tarefas_sugeridas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] }
                    },
                    required: ["title", "priority"]
                  }
                }
              },
              required: ["diagnostico", "pontos_chave", "sentimento", "proximo_passo", "tarefas_sugeridas"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_call" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;
    
    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments) 
        : toolCall.function.arguments;
    } else {
      // Fallback: try to parse content
      const content = aiResult.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (analysis) {
      const targetTable = tableName === 'meetings' ? 'meetings' : 'call_history';
      await supabase.from(targetTable).update({
        ai_summary: analysis.diagnostico,
        ai_sentiment: analysis.sentimento,
        ai_key_points: analysis.pontos_chave,
        ai_suggested_tasks: analysis.tarefas_sugeridas,
        ai_processed_at: new Date().toISOString(),
        metadata: { ai_analysis: analysis },
      }).eq('id', callId);
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-sales-call error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
