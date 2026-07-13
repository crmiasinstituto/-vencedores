// Real-time sales coach for live meetings. Called by the MeetRoom panel
// every 45s with the latest transcription snippet. Returns the next best
// question, alerts, and stage hint. Uses Gemini (via Lovable gateway) with
// a fallback to OpenAI if unavailable.

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

async function askLLM(prompt: string, systemPrompt: string): Promise<any> {
  const lovableKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  const openaiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");

  const tools = [{
    type: "function",
    function: {
      name: "coach_suggestion",
      description: "Return structured coaching output",
      parameters: {
        type: "object",
        properties: {
          stage: { type: "string", enum: ["rapport", "discovery", "diagnosis", "pitch", "objection", "closing", "followup"] },
          next_question: { type: "string", description: "A proxima pergunta certeira que o vendedor deveria fazer agora. Curta, contextual, em PT-BR." },
          alerts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["info", "warn", "critical"] },
                message: { type: "string" },
              },
              required: ["severity", "message"],
            },
          },
          insights: { type: "array", items: { type: "string" }, description: "2-3 observacoes rapidas sobre a conversa" },
          lead_temperature: { type: "string", enum: ["frio", "morno", "quente", "muito_quente"] },
        },
        required: ["stage", "next_question", "alerts", "insights", "lead_temperature"],
      },
    },
  }];

  const bodyOpenAIish = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "coach_suggestion" } },
    temperature: 0.4,
    max_tokens: 600,
  };

  // 1) Try Lovable/Gemini first
  if (lovableKey) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify(bodyOpenAIish),
      });
      if (r.ok) {
        const j = await r.json();
        const argStr = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (argStr) return typeof argStr === "string" ? JSON.parse(argStr) : argStr;
      }
    } catch {/* fall through */}
  }

  // 2) Fallback OpenAI
  if (openaiKey) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ ...bodyOpenAIish, model: "gpt-4o-mini" }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const argStr = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (argStr) return typeof argStr === "string" ? JSON.parse(argStr) : argStr;
  }

  throw new Error("no LLM provider available");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { meeting_id, transcription, lead_id } = await req.json();
    if (!transcription || transcription.length < 20) {
      return new Response(JSON.stringify({ ok: false, error: "transcription_too_short" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load lead context (optional)
    let leadContext = "";
    if (lead_id) {
      const { data: lead } = await supabase.from("crm_leads")
        .select("name, company_name, lead_score, potential_value, notes, source")
        .eq("id", lead_id).maybeSingle();
      if (lead) {
        leadContext = `LEAD: ${lead.name || "s/nome"} | Empresa: ${lead.company_name || "?"} | Score: ${lead.lead_score || 0}/100 | Valor potencial: R$${lead.potential_value || 0} | Canal: ${lead.source || "?"} | Notas: ${lead.notes || "sem notas"}`;
      }
    }

    const systemPrompt = `Voce e um Sales Coach de elite da SQUAAD Business Solutions, escutando uma call de venda em tempo real.

Seu job: analisar a transcricao e retornar a PROXIMA MELHOR PERGUNTA que o vendedor deve fazer pra avancar a conversa.

CONTEXTO SQUAAD:
- Vendemos programas de IA para empresarios: MentorIA (inicio), Metodo SQUAAD (12 meses, mais popular), MBAI (personalizado), Enterprise
- Fundador: Carlos Eduardo, Nivel 5 Fullstack IA Brasil
- Preco NUNCA e revelado antes da call de descoberta, se o lead perguntar, desvia pra agendamento
- Linguagem do vendedor: consultiva, de boteco/WhatsApp, nao corporativa

REGRAS DE COACHING:
- Responde em PT-BR, ULTRA CONCISO
- Se o vendedor falar demais (>70% do tempo), gere alerta "warn": "Voce ta falando muito, deixa o lead falar mais"
- Se detectar uma OBJECAO nao tratada (preco, tempo, ja tentou curso antes), gere alerta "critical"
- Se o lead mostrar alto interesse (faz perguntas sobre programa, sobre proximos passos), eleva temperatura pra "quente" ou "muito_quente"
- Sugira pergunta que avanca o estagio atual (rapport, descoberta, diagnostico, pitch, fechamento)
- Nao sugira pergunta repetitiva se ja foi feita

${leadContext}

FASES DE CALL:
1. rapport: quebra de gelo, gera conexao
2. discovery: entende empresa, modelo, equipe, canais
3. diagnosis: mapeia dor real, gargalos, o que ja tentaram
4. pitch: apresenta como SQUAAD resolve (SEM preco)
5. objection: trata objecoes (tempo, preco, cerimonia)
6. closing: compromisso (agendamento, proposta, fechamento)
7. followup: pos-call`;

    const userPrompt = `TRANSCRICAO RECENTE (ultimos ~60s):\n"${transcription.slice(-4000)}"\n\nAnalise e retorne JSON com stage, next_question, alerts, insights, lead_temperature.`;

    const startTime = Date.now();
    const suggestion = await askLLM(userPrompt, systemPrompt);

    // Log in ai_agent_logs for observability
    if (meeting_id) {
      await supabase.from("ai_agent_logs").insert({
        log_type: "coach_suggestion",
        data: { meeting_id, suggestion, transcription_length: transcription.length },
        duration_ms: Date.now() - startTime,
      }).then(() => {}).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, suggestion, generated_in_ms: Date.now() - startTime }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[coach] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
