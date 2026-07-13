// ============================================================
// ai-tutor (verify_jwt: false)
//
// Tutor lateral em cada aula. Recebe:
//   { lesson_id, question, member_token? }
//
// Header X-Member-Token (preferido) ou body.member_token resolve
// o membro via members.session_token. Sem isso, 401.
//
// Fluxo:
//   1) Resolve member pelo token
//   2) Carrega lesson context: title, description, transcription, ai_summary,
//      ai_key_points, ai_timestamps, ai_exercises
//   3) Garante conversation (RPC get_or_create_lesson_conversation)
//   4) Carrega ultimas 6 mensagens do historico
//   5) Le Gemini key de integration_keys (service:'gemini')
//   6) Chama Gemini 2.5 Flash
//   7) Persiste user msg + assistant msg em chat_messages
//   8) Retorna { conversation_id, answer }
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-2.5-flash";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as any));
    const { lesson_id, question } = body || {};
    if (!lesson_id || !question || typeof question !== "string") {
      return json({ error: "lesson_id e question sao obrigatorios" }, 400);
    }
    if (question.length > 2000) {
      return json({ error: "Pergunta muito longa (max 2000 chars)" }, 400);
    }

    const memberToken = req.headers.get("x-member-token") || body?.member_token;
    if (!memberToken || typeof memberToken !== "string" || memberToken.length < 16) {
      return json({ error: "x-member-token obrigatorio" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Resolve membro
    const { data: member } = await supabase
      .from("members")
      .select("id, name, status")
      .eq("session_token", memberToken)
      .maybeSingle();
    if (!member || member.status !== "active") {
      return json({ error: "Sessao invalida" }, 401);
    }

    // 2) Lesson context
    const { data: lesson } = await supabase
      .from("member_lessons")
      .select("id, title, description, transcription, ai_summary, ai_key_points, ai_timestamps, ai_exercises")
      .eq("id", lesson_id)
      .maybeSingle();
    if (!lesson) {
      return json({ error: "Aula nao encontrada" }, 404);
    }

    // 3) Conversation (idempotente). Setamos o header pra RPC resolver via current_member_id.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { "x-member-token": memberToken } } },
    );
    const { data: cid, error: cidErr } = await userClient.rpc("get_or_create_lesson_conversation", { p_lesson_id: lesson_id });
    if (cidErr || !cid) {
      console.error("[ai-tutor] conv:", cidErr);
      return json({ error: "Erro ao abrir conversa" }, 500);
    }

    // 4) Historico (ultimas 6 msgs)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: false })
      .limit(6);
    const ordered = (history || []).reverse();

    // Anti-flood: limita conversa a 30 mensagens totais
    const { count: total } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", cid);
    if ((total ?? 0) >= 30) {
      return json({
        error: "Esta conversa atingiu o limite de mensagens. Comeca uma nova conversa em outra aula.",
        limit_reached: true,
      }, 429);
    }

    // 5) Gemini key
    const { data: keyRow } = await supabase
      .from("integration_keys")
      .select("api_key, is_active")
      .eq("service", "gemini")
      .maybeSingle();
    if (!keyRow?.api_key || !keyRow.is_active) {
      return json({
        error: "Tutor temporariamente indisponivel. Configure a chave Gemini em /admin/configuracoes.",
      }, 503);
    }

    // 6) Monta prompt
    const stepsStr = Array.isArray(lesson.ai_key_points)
      ? (lesson.ai_key_points as any[]).slice(0, 12).map((p, i) => `  ${i + 1}. ${typeof p === 'string' ? p : JSON.stringify(p)}`).join("\n")
      : "";
    const timestampsStr = Array.isArray(lesson.ai_timestamps)
      ? (lesson.ai_timestamps as any[]).slice(0, 8).map((t: any) => `  ${t.time || t.timestamp || ''} - ${t.title || t.label || ''}`).join("\n")
      : "";

    const systemPrompt = `Voce e tutor da aula "${lesson.title}" da plataforma SQUAAD.

CONTEXTO DA AULA:
${lesson.description || lesson.ai_summary || ''}

PONTOS-CHAVE:
${stepsStr || '(sem pontos extraidos)'}

TIMESTAMPS:
${timestampsStr || '(sem timestamps)'}

REGRAS DE RESPOSTA:
- Curto e direto (3 a 5 frases)
- Portugues claro, sem jargao tecnico desnecessario
- Cite o timestamp do ponto da aula quando aplicavel
- Se pergunta NAO e sobre essa aula, redirecione: "Essa nao e duvida da aula. Pergunta no canal de Duvidas Tecnicas da comunidade."
- Sugira proximo passo pratico ao final
- NAO invente: se nao souber, diga "Nao sei essa parte especifica, manda pro suporte tecnico"`;

    // 7) Chama Gemini
    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendi. Estou pronto pra responder duvidas dessa aula." }] },
      ...ordered.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: question }] },
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${keyRow.api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 600,
            topP: 0.95,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[ai-tutor] gemini error:", geminiRes.status, errText.slice(0, 500));
      return json({ error: "Erro ao chamar tutor. Tenta de novo em 1 minuto." }, 502);
    }

    const geminiJson = await geminiRes.json();
    const answer = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) {
      console.warn("[ai-tutor] empty gemini reply:", JSON.stringify(geminiJson).slice(0, 300));
      return json({ error: "Tutor sem resposta. Reformula a pergunta." }, 502);
    }

    // 8) Persiste user + assistant. Usa userClient pra passar pelas policies.
    await userClient.from("chat_messages").insert([
      { conversation_id: cid, role: "user", content: question },
      { conversation_id: cid, role: "assistant", content: answer },
    ]);

    return json({ conversation_id: cid, answer });
  } catch (e) {
    console.error("[ai-tutor] fatal:", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
