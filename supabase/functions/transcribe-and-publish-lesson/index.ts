// Transcreve audio de uma aula gravada e gera o PDF.
// Recebe: { meeting_id } ou { lesson_id }
// 1. Pega o video URL
// 2. Faz HEAD pra checar tamanho. Se passar de 25MB, instrui usuario a colar
//    transcricao manualmente (limite OpenAI Whisper).
// 3. Baixa video, envia pra OpenAI whisper-1
// 4. Atualiza meeting.transcription
// 5. Aciona process-lesson-recording que gera PDF + publica
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

const WHISPER_LIMIT_MB = 25;

interface WhisperResult {
  text: string;
  segments: Array<{ start: number; end: number; text: string; is_final: true }>;
}

async function transcribeWithOpenAI(videoUrl: string, contentType: string): Promise<WhisperResult> {
  const apiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY nao configurada");

  // Download do video (best effort - se passar do limite, falha)
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Video download falhou: ${videoRes.status}`);
  const blob = await videoRes.blob();

  // Whisper aceita ate 25MB
  if (blob.size > WHISPER_LIMIT_MB * 1024 * 1024) {
    throw new Error(`Video ${(blob.size / 1024 / 1024).toFixed(1)}MB excede limite de ${WHISPER_LIMIT_MB}MB do Whisper. Cole transcricao manualmente.`);
  }

  const form = new FormData();
  form.append("file", blob, "audio.mp4");
  form.append("model", "whisper-1");
  form.append("language", "pt");
  // verbose_json devolve segments com start/end em segundos — necessario pra
  // construir [MM:SS] reais no PDF. Sem isso, Gemini inventa horarios.
  form.append("response_format", "verbose_json");

  const transcribeRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!transcribeRes.ok) {
    const errText = await transcribeRes.text();
    throw new Error(`Whisper falhou (${transcribeRes.status}): ${errText.slice(0, 200)}`);
  }

  const json = await transcribeRes.json();
  const segments = Array.isArray(json.segments)
    ? json.segments
        .filter((s: any) => typeof s?.start === "number" && (s?.text || "").trim())
        .map((s: any) => ({
          start: s.start,
          end: s.end,
          text: String(s.text).trim(),
          is_final: true as const,
        }))
    : [];
  return { text: String(json.text || "").trim(), segments };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { meeting_id, lesson_id, transcription } = await req.json();
    if (!meeting_id && !lesson_id) throw new Error("meeting_id ou lesson_id obrigatorio");

    // Resolve meeting + video URL
    let meeting: any = null;
    if (meeting_id) {
      const { data } = await supabase.from("meetings").select("*").eq("id", meeting_id).maybeSingle();
      meeting = data;
    } else if (lesson_id) {
      const { data: lesson } = await supabase.from("member_lessons").select("*").eq("id", lesson_id).maybeSingle();
      if (!lesson) throw new Error("lesson nao encontrada");
      if (lesson.meeting_id) {
        const { data } = await supabase.from("meetings").select("*").eq("id", lesson.meeting_id).maybeSingle();
        meeting = data;
      } else {
        // Lesson sem meeting linkado — cria meeting derivada
        const { data: newMeeting } = await supabase.from("meetings").insert({
          title: lesson.title,
          status: "completed",
          kind: "lesson",
          lesson_mode: true,
          target_module_id: lesson.module_id,
          target_lesson_title: lesson.title,
          target_lesson_id: lesson.id,
          recording_url: lesson.content_url,
          recording_status: "completed",
          ended_at: new Date().toISOString(),
        }).select("*").single();
        meeting = newMeeting;
        await supabase.from("member_lessons").update({ meeting_id: meeting.id }).eq("id", lesson_id);
      }
    }

    if (!meeting) throw new Error("Meeting nao encontrada");
    if (!meeting.recording_url) throw new Error("Meeting sem recording_url");

    let finalTranscription = (transcription || "").trim();
    let finalSegments: WhisperResult["segments"] = [];

    // Se nao colou transcricao, tenta transcrever automaticamente via Whisper
    if (!finalTranscription || finalTranscription.length < 80) {
      // Checa tamanho do video antes via HEAD
      try {
        const head = await fetch(meeting.recording_url, { method: "HEAD" });
        const sizeBytes = parseInt(head.headers.get("content-length") || "0", 10);
        const sizeMB = sizeBytes / 1024 / 1024;

        if (sizeMB > WHISPER_LIMIT_MB) {
          return new Response(JSON.stringify({
            success: false,
            error: `Video tem ${sizeMB.toFixed(1)}MB e excede limite de ${WHISPER_LIMIT_MB}MB do Whisper. Cole transcricao manualmente no campo "transcription".`,
            video_size_mb: sizeMB,
            requires_manual_transcription: true,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const whisper = await transcribeWithOpenAI(meeting.recording_url, head.headers.get("content-type") || "video/mp4");
        finalTranscription = whisper.text;
        finalSegments = whisper.segments;
      } catch (e: any) {
        return new Response(JSON.stringify({
          success: false,
          error: e.message,
          requires_manual_transcription: true,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Salva transcricao na meeting. Se Whisper produziu segments, sobrescreve
    // meeting.transcriptions com timestamps reais (start em segundos) — isso
    // habilita o PDF a usar minutagem correta. Se a transcricao veio do
    // Soniox (live) ou do usuario manual, mantemos transcriptions intacta.
    const updatePayload: any = { transcription: finalTranscription };
    if (finalSegments.length) {
      updatePayload.transcriptions = finalSegments;
    }
    await supabase.from("meetings").update(updatePayload).eq("id", meeting.id);

    // Aciona pipeline de PDF + publicacao
    const processRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-lesson-recording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ meeting_id: meeting.id, force: true }),
    });
    const processJson = await processRes.json();

    return new Response(JSON.stringify({
      success: true,
      transcription_chars: finalTranscription.length,
      pipeline_result: processJson,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[transcribe-and-publish] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
