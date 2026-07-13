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
      .from("crm_leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) throw new Error("Lead not found");

    // Fetch activities for context
    const { data: activities } = await supabase
      .from("crm_activities")
      .select("description, activity_type, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(30);

    // Fetch call history for extra context
    const { data: calls } = await supabase
      .from("call_history")
      .select("ai_summary, ai_key_points, ai_sentiment, duration, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch conversation insights
    const { data: insights } = await supabase
      .from("lead_conversation_insights")
      .select("*")
      .eq("lead_id", leadId)
      .order("analyzed_at", { ascending: false })
      .limit(1);

    const activitiesContext = activities?.length
      ? activities.map(a => `[${a.activity_type}] ${a.description}`).join("\n")
      : "Nenhuma atividade registrada";

    const callsContext = calls?.length
      ? calls.map(c => `Resumo: ${c.ai_summary || "N/A"} | Sentimento: ${c.ai_sentiment || "N/A"} | Pontos: ${(c.ai_key_points || []).join(", ")}`).join("\n")
      : "Nenhuma chamada registrada";

    const insightsContext = insights?.[0]
      ? JSON.stringify(insights[0])
      : "Nenhum insight de conversa disponivel";

    const prompt = `Voce e um especialista em vendas consultivas B2B no Brasil. Analise os dados deste lead e gere um DOSSIE DE VENDAS completo e personalizado em portugues brasileiro.

DADOS DO LEAD:
- Nome: ${lead.name}
- Empresa: ${lead.company_name || "Nao informado"}
- WhatsApp: ${lead.whatsapp}
- Instagram: ${lead.instagram || "Nao informado"}
- Fonte: ${lead.source || "Nao informado"}
- Prioridade: ${lead.priority || "Nao informado"}
- Score: ${lead.lead_score || 0}
- Tags: ${(lead.tags || []).join(", ") || "Nenhuma"}
- Notas: ${lead.notes || "Nenhuma"}
- Valor Potencial: ${lead.potential_value || "Nao informado"}

HISTORICO DE ATIVIDADES:
${activitiesContext}

HISTORICO DE CHAMADAS:
${callsContext}

INSIGHTS DE CONVERSA:
${insightsContext}

Com base em TODOS esses dados, gere um dossie de vendas completo. Seja ESPECIFICO para este lead - nao seja generico. Use as informacoes reais disponibilizadas para personalizar cada secao.

Responda APENAS com JSON valido no formato especificado.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Voce e um consultor de vendas expert. Responda APENAS em JSON valido, sem markdown ou texto adicional."
          },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_sales_dossier",
            description: "Generate a comprehensive sales dossier for a lead",
            parameters: {
              type: "object",
              properties: {
                disc_profile: {
                  type: "object",
                  properties: {
                    primary: { type: "string", enum: ["D", "I", "S", "C"] },
                    description: { type: "string" },
                    communication_tips: { type: "array", items: { type: "string" } }
                  },
                  required: ["primary", "description", "communication_tips"]
                },
                buyer_persona: { type: "string" },
                spin_questions: {
                  type: "object",
                  properties: {
                    situation: { type: "array", items: { type: "string" } },
                    problem: { type: "array", items: { type: "string" } },
                    implication: { type: "array", items: { type: "string" } },
                    need_payoff: { type: "array", items: { type: "string" } }
                  },
                  required: ["situation", "problem", "implication", "need_payoff"]
                },
                opening_script: { type: "string" },
                rapport_techniques: { type: "array", items: { type: "string" } },
                objection_handling: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      objection: { type: "string" },
                      response: { type: "string" }
                    },
                    required: ["objection", "response"]
                  }
                },
                closing_techniques: { type: "array", items: { type: "string" } },
                urgency_triggers: { type: "array", items: { type: "string" } },
                red_flags: { type: "array", items: { type: "string" } },
                green_flags: { type: "array", items: { type: "string" } },
                call_agenda: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      phase: { type: "string" },
                      duration: { type: "string" },
                      objective: { type: "string" }
                    },
                    required: ["phase", "duration", "objective"]
                  }
                },
                confidence_score: { type: "number", minimum: 0, maximum: 100 }
              },
              required: [
                "disc_profile", "buyer_persona", "spin_questions", "opening_script",
                "rapport_techniques", "objection_handling", "closing_techniques",
                "urgency_triggers", "red_flags", "green_flags", "call_agenda",
                "confidence_score"
              ]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_sales_dossier" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let dossier;

    if (toolCall?.function?.arguments) {
      dossier = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      // Fallback: try to parse content
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      dossier = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!dossier) throw new Error("Failed to parse AI response");

    // Store the dossier as an activity with metadata
    await supabase.from("crm_activities").insert({
      lead_id: leadId,
      activity_type: "ai_dossier",
      description: `Dossie de Vendas gerado por IA - Perfil DISC: ${dossier.disc_profile?.primary || "N/A"} | Confianca: ${dossier.confidence_score || 0}%`,
      metadata: { sales_dossier: dossier, generated_at: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ success: true, dossier }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sales-dossier error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
