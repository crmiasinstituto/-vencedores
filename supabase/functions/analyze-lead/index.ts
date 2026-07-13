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

  try {
    const { leadId } = await req.json();
    if (!leadId) throw new Error("leadId required");

    const LOVABLE_API_KEY = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) throw new Error("Lead not found");

    // Fetch activities and messages in parallel
    const [activitiesRes, messagesRes] = await Promise.all([
      supabase.from('crm_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(30),
      supabase.from('lead_conversation_insights').select('*').eq('lead_id', leadId).order('analyzed_at', { ascending: false }).limit(5),
    ]);

    const context = {
      name: lead.name,
      whatsapp: lead.whatsapp,
      instagram: lead.instagram,
      source: lead.source,
      score: lead.lead_score,
      priority: lead.priority,
      notes: lead.notes,
      tags: lead.tags,
      potential_value: lead.potential_value,
      created_at: lead.created_at,
      scheduled_call_at: lead.scheduled_call_at,
      activities: activitiesRes.data || [],
      insights: messagesRes.data || [],
    };

    const prompt = `Analise este lead de vendas e retorne um JSON estruturado com a analise completa.

Dados do lead:
- Nome: ${context.name}
- Fonte: ${context.source || 'Desconhecida'}
- Score atual: ${context.score}/100
- Prioridade: ${context.priority}
- Notas: ${context.notes || 'Nenhuma'}
- Tags: ${(context.tags || []).join(', ') || 'Nenhuma'}
- Valor potencial: ${context.potential_value || 'Nao definido'}
- Criado em: ${context.created_at}
- Call agendada: ${context.scheduled_call_at || 'Nao'}
- Total de atividades: ${(context.activities || []).length}
- Ultimas atividades: ${JSON.stringify((context.activities || []).slice(0, 10).map(a => ({ type: a.activity_type, desc: a.description, date: a.created_at })))}
- Insights de conversa: ${JSON.stringify((context.insights || []).slice(0, 3))}

Analise criteriosamente considerando engajamento, tempo no funil, atividades recentes, e potencial de conversao.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Voce e um analista de vendas expert em qualificacao de leads B2B. Responda APENAS em JSON valido." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_lead",
            description: "Return structured lead analysis",
            parameters: {
              type: "object",
              properties: {
                health_score: { type: "number", description: "Score de saude do lead de 0 a 100" },
                risk_level: { type: "string", enum: ["low", "medium", "high"] },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                engagement: { type: "string", enum: ["high", "medium", "low"] },
                predicted_outcome: { type: "string", enum: ["likely_win", "uncertain", "likely_loss"] },
                strengths: { type: "array", items: { type: "string" }, description: "Pontos fortes do lead" },
                weaknesses: { type: "array", items: { type: "string" }, description: "Pontos fracos/riscos" },
                recommendations: { type: "array", items: { type: "string" }, description: "Recomendacoes de acao" },
                attention_points: { type: "array", items: { type: "string" }, description: "Pontos de atencao" },
              },
              required: ["health_score", "risk_level", "sentiment", "engagement", "predicted_outcome", "strengths", "weaknesses", "recommendations", "attention_points"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_lead" } },
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

    if (!analysis) throw new Error("Failed to parse AI response");

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-lead error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
