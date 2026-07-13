// After a sales call ends, generates:
//   - Personalized follow-up email (subject + body)
//   - Suggested next CRM stage
//   - 1-3 specific tasks for the rep
//   - Short timeline summary
// Called automatically by MeetRoom on disconnect for sales-mode meetings.

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

async function callLLM(systemPrompt: string, userPrompt: string): Promise<any> {
  const lovableKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  const openaiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");

  const tools = [{
    type: "function",
    function: {
      name: "post_call_plan",
      parameters: {
        type: "object",
        properties: {
          outcome: { type: "string", enum: ["ganhou", "avancou", "estagnou", "perdeu", "sem_call"], description: "Resultado da call" },
          timeline_summary: { type: "string", description: "2-3 frases resumindo o que aconteceu na call. Vai pro timeline do lead." },
          suggested_stage: { type: "string", description: "Nome do proximo estagio do Kanban (ex: 'Qualificado', 'Proposta', 'Fechado', 'Perdido')" },
          email: {
            type: "object",
            properties: {
              subject: { type: "string" },
              body: { type: "string", description: "E-mail em portugues, tom consultivo SQUAAD. Quebra em paragrafos curtos. Sem emoji. Finaliza com proximo passo claro." },
            },
            required: ["subject", "body"],
          },
          tasks: {
            type: "array",
            description: "1-3 tarefas concretas e acionaveis para o vendedor. Cada uma com deadline relativo.",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                due_in_hours: { type: "number", description: "Quantas horas a partir de agora" },
                priority: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: ["title", "due_in_hours"],
            },
          },
          whatsapp_followup: { type: "string", description: "Mensagem curta de WhatsApp pra mandar logo apos a call (mais informal que o email)" },
        },
        required: ["outcome", "timeline_summary", "suggested_stage", "email", "tasks", "whatsapp_followup"],
      },
    },
  }];

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools, tool_choice: { type: "function", function: { name: "post_call_plan" } },
    temperature: 0.5, max_tokens: 1500,
  };

  if (lovableKey) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
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
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ ...body, model: "gpt-4o-mini" }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (args) return typeof args === "string" ? JSON.parse(args) : args;
  }
  throw new Error("no LLM available");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { meeting_id, auto_execute } = await req.json();
    if (!meeting_id) throw new Error("meeting_id required");

    const { data: meeting } = await supabase.from("meetings")
      .select("id, lead_id, title, transcription, ai_summary, ai_key_points, ai_sentiment, started_at, ended_at, scheduled_at")
      .eq("id", meeting_id).single();
    if (!meeting) throw new Error("meeting not found");

    // Load lead context
    let leadCtx = "";
    let lead: any = null;
    if (meeting.lead_id) {
      const { data } = await supabase.from("crm_leads")
        .select("id, name, whatsapp, company_name, lead_score, potential_value, notes, source, column_id")
        .eq("id", meeting.lead_id).maybeSingle();
      lead = data;
      if (lead) {
        leadCtx = `LEAD: ${lead.name || "?"} | Empresa: ${lead.company_name || "?"} | Canal: ${lead.source || "?"} | Score: ${lead.lead_score || 0} | Valor potencial: R$${lead.potential_value || 0} | Notas: ${lead.notes || "?"}`;
      }
    }

    const transcription = (meeting.transcription || "").trim();
    const summary = meeting.ai_summary || "";
    const keyPoints = Array.isArray(meeting.ai_key_points) ? meeting.ai_key_points.join("; ") : "";
    const sentiment = meeting.ai_sentiment || "neutral";

    const durationMin = meeting.started_at && meeting.ended_at
      ? Math.round((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 60_000)
      : null;

    const systemPrompt = `Voce e um gerente comercial SQUAAD ajudando o vendedor com o pos-call. Retorne um plano de acao estruturado em JSON.

REGRAS:
- Tom consultivo SQUAAD (nao corporativo, nao robo), direto mas profissional
- E-mail em PT-BR: assunto curto, corpo com paragrafos de 1-2 frases, sem emoji
- Mensagem WhatsApp mais informal que o email ("Opa [nome], show de bola nossa call...")
- Tarefas concretas: "Enviar proposta do Metodo SQUAAD pra Jairo" > "Fazer follow-up"
- Deadline em horas (ex: 2h, 24h, 72h, 168h=1sem)
- Sugira estagio do Kanban coerente: se call foi positiva e lead engajou, "Proposta" ou "Negociacao". Se nao teve interesse, "Perdido". Se foi neutro, manter no mesmo ou "Qualificado".
- Se transcricao indicar fechamento verbal: outcome="ganhou", stage="Fechado"
- Se lead cancelou ou nao quis seguir: outcome="perdeu"
- Se foi no-show (meeting sem started_at): outcome="sem_call"

CONTEXTO SQUAAD:
Programas: MentorIA, Metodo SQUAAD (12m, mais popular), MBAI, Enterprise.
Fundador Carlos Eduardo, Nivel 5 Fullstack IA Brasil.
Preco: so depois de entendimento, na proposta.`;

    const userPrompt = `${leadCtx}

CALL:
- Titulo: ${meeting.title}
- Duracao: ${durationMin || "n/a"}min
- Sentimento detectado: ${sentiment}
- Resumo IA: ${summary || "(sem resumo)"}
- Pontos-chave: ${keyPoints || "(sem pontos)"}

TRANSCRICAO (primeiros 6000 chars):
"""
${transcription.slice(0, 6000)}
"""

Gere o plano completo em JSON.`;

    const plan = await callLLM(systemPrompt, userPrompt);

    // Save the plan in the meeting's metadata for later retrieval
    await supabase.from("meetings").update({
      metadata: { ...(meeting as any).metadata, post_call_plan: plan, post_call_generated_at: new Date().toISOString() },
    }).eq("id", meeting_id);

    // Auto-execute selected actions if requested (default off, user reviews first)
    let executed: any = { tasks_created: 0, stage_changed: false, activity_logged: true };
    if (lead) {
      // Always log the timeline summary as an activity
      await supabase.from("crm_activities").insert({
        lead_id: lead.id,
        activity_type: "call_summary",
        description: plan.timeline_summary,
        metadata: { meeting_id, outcome: plan.outcome, ai_generated: true },
      });

      if (auto_execute) {
        // Create tasks
        for (const t of (plan.tasks || [])) {
          await supabase.from("tasks").insert({
            lead_id: lead.id,
            title: t.title,
            due_date: new Date(Date.now() + (t.due_in_hours || 24) * 3600_000).toISOString(),
            type: "task",
            status: "pending",
          });
          executed.tasks_created++;
        }
        // Change stage
        if (plan.suggested_stage) {
          const { data: cols } = await supabase.from("crm_columns").select("id, name, board_id");
          const targetCol = (cols || []).find((c: any) =>
            c.board_id === (lead as any).board_id &&
            (c.name || "").toLowerCase().includes(plan.suggested_stage.toLowerCase())
          );
          if (targetCol) {
            await supabase.from("crm_leads").update({
              column_id: targetCol.id,
              updated_at: new Date().toISOString(),
            }).eq("id", lead.id);
            executed.stage_changed = true;
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, plan, executed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[post-call] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
