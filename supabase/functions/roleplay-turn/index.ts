// Roleplay simulator: IA simula um lead com um perfil/cenario especifico,
// e o usuario (vendedor) conversa. No final pede avaliacao detalhada.

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

const SCENARIOS: Record<string, { persona: string; objective: string; difficulty: string }> = {
  cetico_preco: {
    persona: "Empresario dono de agencia de marketing pequena (5 pessoas). Sempre acha tudo caro. Ja tentou curso de marketing e nao funcionou. E cetico com 'mais uma formacao'. Fala 'quanto custa' na primeira mensagem e insiste.",
    objective: "Fazer o vendedor NAO revelar preco antes da call de descoberta, e conduzir pra agendamento mesmo com a resistencia.",
    difficulty: "Dificil, lead testa paciencia, insiste no preco, questiona valor.",
  },
  curioso_interessado: {
    persona: "Empresario dono de clinica com 15 funcionarios. Viu o conteudo SQUAAD e ta super interessado. Faz muitas perguntas de curiosidade (como funciona, quem e o Carlos, quanto tempo pra resultado). Pode virar fechamento rapido se bem conduzido.",
    objective: "Avancar de curioso para agendamento em <6 trocas. Usar query_knowledge pra responder duvidas.",
    difficulty: "Facil-medio, lead quer ser vendido, basta conduzir.",
  },
  objecao_tempo: {
    persona: "Empresario sobrecarregado, dono de pequeno e-commerce. Interessado em IA mas nao tem tempo 'pra estudar mais uma coisa'. Usa muito 'to corrido', 'vou ver depois', 'me manda tudo escrito'.",
    objective: "Tratar a objecao 'falta de tempo' mostrando que IA DEVOLVE tempo, e encaixar call de 20min como investimento de tempo justificavel.",
    difficulty: "Medio, objecao sutil, exige reframing.",
  },
  apenas_curioso: {
    persona: "Estudante universitario 22 anos. Sem empresa ainda. Quer saber 'se pode fazer o curso mesmo sendo aluno'. Nao e fit SQUAAD (foco em empresario).",
    objective: "Identificar que NAO e fit com gentileza, direcionar pra comunidade gratuita ou MentorIA, nao forcar call com lead sem fit.",
    difficulty: "Medio, tentacao de forcar agendamento mesmo sem fit.",
  },
  dois_socios: {
    persona: "Empresario socio de startup SaaS com outro co-founder. Diz 'preciso ver com meu socio antes', 'vou conversar em casa', 'manda material que a gente le'.",
    objective: "Nao cair na armadilha de 'mandar material'. Propor call com OS DOIS socios.",
    difficulty: "Medio, tentador mandar PDFs, mas a estrategia certa e envolver o socio na call.",
  },
};

async function chatLead(systemPrompt: string, history: any[]): Promise<string> {
  const lovableKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  const openaiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role === "rep" ? "user" : "assistant", content: m.content })),
    ],
    temperature: 0.8, max_tokens: 200,
  };

  if (lovableKey) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify(body),
      });
      if (r.ok) return (await r.json()).choices?.[0]?.message?.content || "";
    } catch { /* fall through */ }
  }
  if (openaiKey) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ ...body, model: "gpt-4o-mini" }),
    });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()).choices?.[0]?.message?.content || "";
  }
  throw new Error("no LLM");
}

async function evaluateConversation(scenarioKey: string, history: any[]): Promise<any> {
  const sc = SCENARIOS[scenarioKey];
  if (!sc) throw new Error("unknown scenario");

  const openaiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");
  const lovableKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");

  const transcript = history.map((m, i) => `[${i + 1}] ${m.role === "rep" ? "VENDEDOR" : "LEAD"}: ${m.content}`).join("\n");

  const tools = [{
    type: "function",
    function: {
      name: "roleplay_evaluation",
      parameters: {
        type: "object",
        properties: {
          score: { type: "number", description: "0-10" },
          achieved_objective: { type: "boolean" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          missed_opportunities: { type: "array", items: { type: "string" } },
          tone_feedback: { type: "string", description: "Feedback sobre tom e linguagem (SQUAAD style)" },
          key_moment: { type: "string", description: "Momento mais importante da conversa (positivo ou negativo)" },
          next_steps_for_improvement: { type: "array", items: { type: "string" } },
        },
        required: ["score", "achieved_objective", "strengths", "weaknesses", "tone_feedback", "next_steps_for_improvement"],
      },
    },
  }];

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: `Voce e um Sales Coach de elite avaliando uma simulacao de venda. Seja direto, especifico e acionavel. Avalie em PT-BR.

CENARIO: ${sc.persona}
OBJETIVO DO EXERCICIO: ${sc.objective}
DIFICULDADE: ${sc.difficulty}

CRITERIOS:
- Tom SQUAAD (consultivo, de boteco, sem robozar, sem emoji)
- Seguiu o fluxo (abertura, descoberta, qualificacao, agendamento)
- Tratou objecoes corretamente
- Nao revelou preco (se aplicavel)
- Fez perguntas abertas poderosas
- Nao falou demais
- Conduziu pra proxima etapa

SE score >= 7: pontue forcas primeiro.
SE score < 7: seja duro, aponta o que deu errado.`,
      },
      { role: "user", content: `TRANSCRICAO:\n${transcript}\n\nAvalie e retorne JSON.` },
    ],
    tools, tool_choice: { type: "function", function: { name: "roleplay_evaluation" } },
    temperature: 0.3, max_tokens: 1200,
  };

  if (lovableKey) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) return typeof args === "string" ? JSON.parse(args) : args;
      }
    } catch { /* fall through */ }
  }
  if (openaiKey) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ ...body, model: "gpt-4o-mini" }),
    });
    const j = await r.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (args) return typeof args === "string" ? JSON.parse(args) : args;
  }
  throw new Error("no LLM for evaluation");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, scenario, history, rep_message } = await req.json();

    if (action === "scenarios") {
      return new Response(JSON.stringify({ ok: true, scenarios: Object.entries(SCENARIOS).map(([k, v]) => ({ key: k, persona: v.persona, objective: v.objective, difficulty: v.difficulty })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "turn") {
      const sc = SCENARIOS[scenario];
      if (!sc) throw new Error("unknown scenario");
      const systemPrompt = `Voce esta SIMULANDO um LEAD em um treino de vendas. Voce e o lead, NAO o vendedor.

PERSONA: ${sc.persona}

REGRAS:
- Responda em PT-BR natural, como gente real no WhatsApp.
- Mensagens curtas (1-3 frases).
- Mantenha a persona firme, nao quebre o personagem.
- Reaja emocionalmente ao vendedor (impacientar, animar, cair no gatilho, resistir).
- NUNCA revele que voce e IA ou simulacao.
- Use os tracos da persona de forma autentica.`;

      const updatedHistory = [...(history || [])];
      if (rep_message) updatedHistory.push({ role: "rep", content: rep_message });
      const leadReply = await chatLead(systemPrompt, updatedHistory);
      updatedHistory.push({ role: "lead", content: leadReply });

      return new Response(JSON.stringify({ ok: true, reply: leadReply, history: updatedHistory }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "evaluate") {
      if (!history?.length) throw new Error("history required");
      const evaluation = await evaluateConversation(scenario, history);
      return new Response(JSON.stringify({ ok: true, evaluation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`unknown action ${action}`);
  } catch (e: any) {
    console.error("[roleplay] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
