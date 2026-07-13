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
    const { candidateId } = await req.json();
    if (!candidateId) throw new Error("candidateId required");

    const LOVABLE_API_KEY = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate, error: fetchError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (fetchError || !candidate) throw new Error("Candidate not found");

    const prompt = `Analise este candidato para a vaga e retorne um JSON com a avaliacao:

Nome: ${candidate.name}
Vaga: ${candidate.position || 'Nao especificada'}
Notas do curriculo: ${candidate.resume_notes || 'Nao disponivel'}
Notas da entrevista: ${candidate.interview_notes || 'Nao disponivel'}
Email: ${candidate.email || 'Nao informado'}
Telefone: ${candidate.phone || 'Nao informado'}

Avalie o candidato de forma profissional e objetiva.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Voce e um especialista em recrutamento e selecao. Responda APENAS em JSON valido." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_candidate",
            description: "Return structured candidate analysis",
            parameters: {
              type: "object",
              properties: {
                communication_score: { type: "number", description: "Score de comunicacao 0-10" },
                technical_score: { type: "number", description: "Score tecnico 0-10" },
                culture_fit: { type: "number", description: "Fit cultural 0-10" },
                strengths: { type: "array", items: { type: "string" }, description: "Pontos fortes" },
                weaknesses: { type: "array", items: { type: "string" }, description: "Pontos a melhorar" },
                recommendation: { type: "string", description: "Recomendacao geral sobre o candidato" },
                overall_score: { type: "number", description: "Score geral 0-10" },
              },
              required: ["communication_score", "technical_score", "culture_fit", "strengths", "weaknesses", "recommendation", "overall_score"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_candidate" } },
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
      analysis = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (analysis) {
      await supabase.from("candidates").update({
        ai_analysis: analysis,
        updated_at: new Date().toISOString(),
      }).eq("id", candidateId);
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-candidate error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
