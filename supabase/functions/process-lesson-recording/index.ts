import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callEdgeFunction(name: string, body: any) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// Envia o PDF da aula pro grupo do WhatsApp SO' quando a REUNIAO realmente
// encerrou (meetings.status='completed', setado pelo room_finished do LiveKit).
// Antes o envio era amarrado ao fim da GRAVACAO, entao parar/reiniciar a gravacao
// no meio da aula disparava o PDF pro grupo com a reuniao ainda rolando.
// Idempotente via metadata.pdf_broadcast_sent. Chamado no fim do processamento
// E no room_finished (o que acontecer por ultimo, com PDF pronto + reuniao fim).
async function maybeBroadcastPdf(supabase: any, meetingId: string) {
  const { data: m } = await supabase
    .from("meetings")
    .select("id, title, target_module_id, status, metadata")
    .eq("id", meetingId)
    .maybeSingle();
  if (!m || !m.target_module_id) return { skipped: "no_module" };
  if ((m.status || "") !== "completed") return { skipped: "meeting_not_ended" };
  if (m.metadata?.pdf_broadcast_sent) return { skipped: "already_sent" };

  const { data: lesson } = await supabase
    .from("member_lessons")
    .select("pdf_url, title")
    .eq("meeting_id", meetingId)
    .not("pdf_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pdf_url = lesson?.pdf_url;
  if (!pdf_url) return { skipped: "no_pdf_yet" };

  const { data: groups } = await supabase
    .from("whatsapp_groups")
    .select("id, name")
    .eq("linked_module_id", m.target_module_id)
    .eq("is_broadcast_enabled", true)
    .eq("auto_send_meeting_links", true);

  const broadcasts: any[] = [];
  if (groups && groups.length) {
    const caption = `📚 *PDF da aula:* ${lesson?.title || m.title}\n\nResumo, pontos-chave e exercicios gerados pela IA SQUAAD a partir da gravacao da aula ao vivo.`;
    for (const g of groups) {
      try {
        const r = await callEdgeFunction("send-group-message", {
          group_id: g.id, message: caption, media_url: pdf_url, media_type: "document",
        });
        broadcasts.push({ group_id: g.id, name: g.name, ok: r?.ok !== false });
      } catch (be: any) {
        broadcasts.push({ group_id: g.id, name: g.name, ok: false, error: be.message });
      }
    }
  }
  await supabase.from("meetings").update({
    metadata: { ...(m.metadata || {}), pdf_broadcast_sent: true, pdf_broadcast_at: new Date().toISOString() },
  }).eq("id", meetingId);
  return { sent: broadcasts };
}

function buildTranscriptionText(meeting: any): string {
  // Prefer the aggregated text field
  if (meeting.transcription && typeof meeting.transcription === "string" && meeting.transcription.length > 50) {
    return meeting.transcription;
  }
  // Fallback: concatenate transcriptions jsonb array
  const arr = meeting.transcriptions;
  if (Array.isArray(arr)) {
    const parts = arr
      .map((t: any) => t?.text || t?.content || "")
      .filter((t: string) => t && t.trim().length > 0);
    if (parts.length) return parts.join(" ");
  }
  return "";
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Constroi transcript com marcacoes [MM:SS] usando os segments REAIS.
// Estrategia em ordem de preferencia para definir o T=0 (inicio):
//   1. meeting.started_at (se setado)
//   2. min(segment.timestamp) — primeiro segmento Soniox marca o inicio
//   3. segment.start em segundos (Whisper verbose_json — ja relativo)
function buildTimestampedTranscript(meeting: any): string {
  const arr = meeting.transcriptions;
  if (!Array.isArray(arr) || arr.length === 0) return "";

  const finalSegs = arr.filter((s: any) => s?.is_final !== false && (s?.text || s?.content || "").trim());
  if (finalSegs.length === 0) return "";

  // Heuristica de origem temporal
  let startedAtMs: number | null = meeting.started_at
    ? new Date(meeting.started_at).getTime()
    : null;

  // Fallback: usa o menor timestamp (Soniox grava wall-clock; primeiro segmento ≈ inicio)
  if (startedAtMs == null) {
    const tss = finalSegs
      .map((s: any) => (typeof s.timestamp === "number" ? (s.timestamp > 1e12 ? s.timestamp : s.timestamp * 1000) : null))
      .filter((v: any): v is number => v != null);
    if (tss.length > 0) startedAtMs = Math.min(...tss);
  }

  const lines: string[] = [];
  for (const seg of finalSegs) {
    const text: string = (seg.text || seg.content || "").trim();
    let secs: number | null = null;

    // Whisper verbose_json: start ja em segundos relativos
    if (typeof seg.start === "number") {
      secs = seg.start;
    }
    // Soniox: timestamp wall-clock — diferenca pro inicio
    else if (typeof seg.timestamp === "number" && startedAtMs != null) {
      const ts = seg.timestamp > 1e12 ? seg.timestamp : seg.timestamp * 1000;
      secs = Math.max(0, (ts - startedAtMs) / 1000);
    }

    if (secs == null) continue;
    const speaker = seg.speaker ? `${seg.speaker}: ` : "";
    lines.push(`[${fmtTime(secs)}] ${speaker}${text}`);
  }

  // Precisa de pelo menos 8 segmentos timestampaveis (ou 50% dos finais) pra
  // valer a pena gerar a "Trilha da Aula" — abaixo disso fica esparso.
  if (lines.length < Math.min(8, Math.floor(finalSegs.length * 0.5))) return "";
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { meeting_id, force, broadcast_only } = await req.json();
    if (!meeting_id) throw new Error("meeting_id required");

    // Modo so'-broadcast: chamado pelo room_finished pra tentar enviar o PDF
    // agora que a reuniao encerrou (gate em maybeBroadcastPdf).
    if (broadcast_only) {
      const r = await maybeBroadcastPdf(supabase, meeting_id);
      return new Response(JSON.stringify({ success: true, broadcast_only: true, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[PROCESS] meeting_id=${meeting_id} force=${force}`);

    // 1. Load meeting
    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meeting_id)
      .single();
    if (mErr || !meeting) throw new Error(`Meeting not found: ${mErr?.message}`);

    if (!meeting.lesson_mode) {
      throw new Error("Meeting is not in lesson_mode");
    }

    // 2.0 Acelerador: anexa a gravacao ao member_files (aula de instrucao) e
    //     pula todo o pipeline de aula/PDF/trilha. Espera o recording_url ficar
    //     pronto (o webhook re-invoca quando o egress termina).
    if (meeting.target_accelerator_id) {
      if (!meeting.recording_url) {
        await supabase.from("meetings").update({
          processing_step: "waiting_for_recording_url",
        }).eq("id", meeting_id);
        return new Response(JSON.stringify({
          success: true, status: "waiting", missing: ["recording_url"],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("member_files").update({
        video_url: meeting.recording_url,
        video_title: meeting.target_lesson_title || meeting.title || "Aula de instrução",
      }).eq("id", meeting.target_accelerator_id);
      // 'ready' + recording_status 'completed': a tela "Processando aula" sai do loop
      // por esse estado (acelerador nao cria lesson_recording_jobs).
      await supabase.from("meetings").update({
        processing_step: "ready", recording_status: "completed", status: "completed",
      }).eq("id", meeting_id);
      console.log(`[PROCESS] Accelerator ${meeting.target_accelerator_id} video attached: ${meeting.recording_url}`);
      return new Response(JSON.stringify({
        success: true, status: "accelerator_attached",
        accelerator_id: meeting.target_accelerator_id,
        video_url: meeting.recording_url,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Idempotency: race-safe lookup. Procura lesson existente por meeting_id
    //    AO INVES de target_lesson_id (que pode estar nulo numa segunda chamada
    //    concorrente que iniciou antes da primeira escrever target_lesson_id).
    //    Adopta o lesson encontrado mesmo que meeting.target_lesson_id ainda
    //    esteja null — evita inserir duplicado.
    const { data: existingLessons } = await supabase
      .from("member_lessons")
      .select("id, pdf_url, content_url, processing_status")
      .eq("meeting_id", meeting_id)
      .order("created_at", { ascending: true })
      .limit(1);
    const existingLesson = existingLessons?.[0];
    if (existingLesson && !force) {
      // Garante que meeting aponta pra ela (sincroniza target_lesson_id)
      if (meeting.target_lesson_id !== existingLesson.id) {
        await supabase.from("meetings")
          .update({ target_lesson_id: existingLesson.id })
          .eq("id", meeting_id);
        meeting.target_lesson_id = existingLesson.id;
      }
      if (existingLesson.processing_status === "ready") {
        return new Response(JSON.stringify({
          success: true,
          status: "already_ready",
          lesson_id: existingLesson.id,
          pdf_url: existingLesson.pdf_url,
          video_url: existingLesson.content_url,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 2b. Lock concorrencia: se outra invocacao iniciou nos ultimos 90s, aborta
    //    pra evitar duplicate insert. Race window e' o intervalo entre a 1a
    //    chamada upsertar o job e o lookup acima refletir o lesson criado.
    const NOW_ISO = new Date().toISOString();
    const LOCK_WINDOW_MS = 90 * 1000;
    if (!force) {
      const { data: existingJob } = await supabase
        .from("lesson_recording_jobs")
        .select("id, status, updated_at")
        .eq("meeting_id", meeting_id)
        .maybeSingle();
      if (existingJob && existingJob.status === "processing" && existingJob.updated_at) {
        const ageMs = Date.now() - new Date(existingJob.updated_at).getTime();
        if (ageMs < LOCK_WINDOW_MS) {
          console.log(`[PROCESS] Lock held by concurrent invocation (age=${ageMs}ms), aborting`);
          return new Response(JSON.stringify({
            success: true,
            status: "locked",
            job_id: existingJob.id,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // 3. Check readiness
    const transcription = buildTranscriptionText(meeting);
    const videoUrl = meeting.recording_url;
    const hasTranscription = transcription && transcription.length >= 80;

    // Video is required; transcription is optional (we'll still publish the
    // lesson, just without the auto-generated PDF).
    const missing: string[] = [];
    if (!videoUrl) missing.push("recording_url");

    // Upsert job
    const jobPayload = {
      meeting_id,
      module_id: meeting.target_module_id,
      title: meeting.target_lesson_title || meeting.title || "Aula SQUAAD",
      video_url: videoUrl,
      transcription,
      source: "meeting_recording",
      status: missing.length ? "waiting" : "processing",
      step: missing.length ? `waiting_for_${missing.join("_")}` : (hasTranscription ? "analyzing" : "publishing"),
      updated_at: new Date().toISOString(),
    };

    // Upsert by meeting_id (get or create)
    let jobId: string;
    const { data: existingJob } = await supabase
      .from("lesson_recording_jobs")
      .select("id")
      .eq("meeting_id", meeting_id)
      .maybeSingle();
    if (existingJob) {
      jobId = existingJob.id;
      await supabase.from("lesson_recording_jobs").update(jobPayload).eq("id", jobId);
    } else {
      const { data: newJob, error: jErr } = await supabase
        .from("lesson_recording_jobs")
        .insert(jobPayload)
        .select("id")
        .single();
      if (jErr) throw new Error(`Failed to create job: ${jErr.message}`);
      jobId = newJob.id;
    }

    if (missing.length) {
      console.log(`[PROCESS] Waiting for: ${missing.join(", ")}`);
      await supabase.from("meetings").update({
        processing_step: `waiting_for_${missing.join("_")}`,
      }).eq("id", meeting_id);
      return new Response(JSON.stringify({
        success: true,
        status: "waiting",
        missing,
        job_id: jobId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sem transcricao ao vivo (Soniox real-time agora roda SO em venda): transcreve
    // a gravacao em LOTE. A VPS extrai o audio comprimido e a edge transcribe-recording
    // transcreve no Groq e reinvoca esta funcao — ai gera o PDF. So pra aula/live/
    // acelerador (sales call nao usa este pipeline).
    //
    // Enquanto a transcricao em lote nao chega, ESPERA (status 'transcribing') em vez
    // de publicar video-only cedo — senao a idempotencia trava e o PDF nunca sai
    // (o poll/recover chamariam esta funcao no meio do caminho). Timeout de 12min:
    // se nao vier (Groq/VPS caiu), cai pro fluxo video-only abaixo (publica sem PDF).
    if (!hasTranscription) {
      const meta = meeting.metadata || {};
      const isLessonTarget = !!(meeting.target_module_id || meeting.target_accelerator_id || meeting.collective_event_id);
      const onSquaadBucket = typeof videoUrl === "string" && videoUrl.startsWith("https://videos.squaad.com.br");
      const kickedAtMs = meta.audio_transcribe_kicked_at ? new Date(meta.audio_transcribe_kicked_at).getTime() : 0;
      const waitedMs = kickedAtMs ? Date.now() - kickedAtMs : 0;
      const GIVE_UP_MS = 12 * 60 * 1000;
      if (isLessonTarget && onSquaadBucket && waitedMs < GIVE_UP_MS) {
        try {
          if (!kickedAtMs) {
            // Primeira passada: dispara a extracao de audio na VPS.
            const ppBase = (Deno.env.get("POSTPROCESS_URL") || "https://meet.squaad.com.br/postprocess/faststart").replace(/\/faststart$/, "");
            const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
            const s3Public = (Deno.env.get("S3_PUBLIC_URL") || "https://videos.squaad.com.br").replace(/\/$/, "");
            const room = (() => { try { return new URL(videoUrl).pathname.split("/").filter(Boolean)[1] || meeting_id; } catch { return meeting_id; } })();
            const ts = Date.now();
            const outputKey = `recordings/${room}/audio-${ts}.ogg`;
            const outputUrl = `${s3Public}/${outputKey}`;
            await supabase.from("meetings").update({
              processing_step: "transcribing",
              metadata: { ...meta, audio_transcribe_kicked_at: new Date().toISOString() },
            }).eq("id", meeting_id);
            fetch(`${ppBase}/extract-audio`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiSecret}` },
              body: JSON.stringify({
                video_url: videoUrl,
                output_key: outputKey,
                output_url: outputUrl,
                meeting_id,
                callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-recording`,
              }),
            }).then((r) => console.log(`[PROCESS] extract-audio queued: ${r.status}`)).catch((e) => console.error("[PROCESS] extract-audio err:", e.message));
            console.log(`[PROCESS] Batch transcription kicked for meeting ${meeting_id}`);
          } else {
            // Ja disparou; ainda esperando o callback do Groq.
            await supabase.from("meetings").update({ processing_step: "transcribing" }).eq("id", meeting_id);
          }
          await supabase.from("lesson_recording_jobs").update({ status: "waiting", step: "transcribing", updated_at: new Date().toISOString() }).eq("id", jobId);
          return new Response(JSON.stringify({ success: true, status: "transcribing", job_id: jobId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[PROCESS] batch transcription wait failed:", e.message);
          // cai pro fluxo video-only abaixo
        }
      }
    }

    const title = meeting.target_lesson_title || meeting.title || "Aula SQUAAD";
    let pdf_url: string | null = null;
    let analysis: any = null;

    if (hasTranscription) {
      // 4a. Generate PDF from transcription
      await supabase.from("meetings").update({ processing_step: "generating_pdf" }).eq("id", meeting_id);
      try {
        const timestamped_transcript = buildTimestampedTranscript(meeting);
        if (timestamped_transcript) {
          console.log(`[PROCESS] Using ${timestamped_transcript.split("\n").length} timestamped segments`);
        } else {
          console.log(`[PROCESS] No timestamped segments — Gemini will skip 'Trilha da Aula'`);
        }
        const pdfResult = await callEdgeFunction("generate-lesson-pdf", {
          title,
          transcription,
          timestamped_transcript,
          meeting_id,
        });
        pdf_url = pdfResult.pdf_url;
        analysis = pdfResult.analysis;
        console.log(`[PROCESS] PDF generated: ${pdf_url}`);
      } catch (e: any) {
        console.error(`[PROCESS] PDF generation failed, publishing without PDF: ${e.message}`);
        // Non-fatal: publish the lesson with video only
      }
    } else {
      console.log(`[PROCESS] No transcription available, publishing video-only lesson`);
    }

    // 5. Create or update member_lesson
    await supabase.from("meetings").update({ processing_step: "publishing" }).eq("id", meeting_id);

    const lessonPayload: any = {
      module_id: meeting.target_module_id,
      title,
      description: analysis?.summary?.slice(0, 280) || null,
      type: "video",
      content_url: videoUrl,
      pdf_url,
      transcription: transcription || null,
      ai_summary: analysis?.summary || null,
      ai_key_points: analysis?.key_points || [],
      ai_timestamps: analysis?.timestamps || [],
      ai_exercises: analysis?.exercises || [],
      processing_status: "ready",
      processing_step: hasTranscription ? "ready" : "ready_no_pdf",
      source: meeting.members_visible ? "live_session" : "meeting_recording",
      is_published: true,
      meeting_id,
    };

    let lessonId = meeting.target_lesson_id;
    // Re-check por meeting_id JUSTO ANTES do insert pra cobrir race que
    // passou pelo lock (ex: lock expirou ou job nao existia).
    if (!lessonId) {
      const { data: midLessons } = await supabase
        .from("member_lessons")
        .select("id")
        .eq("meeting_id", meeting_id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (midLessons?.[0]) lessonId = midLessons[0].id;
    }
    if (lessonId) {
      await supabase.from("member_lessons").update(lessonPayload).eq("id", lessonId);
    } else {
      // Get next sort_order for the module
      const { data: maxRow } = await supabase
        .from("member_lessons")
        .select("sort_order")
        .eq("module_id", meeting.target_module_id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      lessonPayload.sort_order = (maxRow?.sort_order || 0) + 1;

      const { data: newLesson, error: lErr } = await supabase
        .from("member_lessons")
        .insert(lessonPayload)
        .select("id")
        .single();
      if (lErr) throw new Error(`Failed to create lesson: ${lErr.message}`);
      lessonId = newLesson.id;
    }

    // Update meeting with lesson link
    await supabase.from("meetings").update({
      target_lesson_id: lessonId,
      processing_step: "ready",
    }).eq("id", meeting_id);

    // Update job
    await supabase.from("lesson_recording_jobs").update({
      status: "ready",
      step: "ready",
      lesson_id: lessonId,
      pdf_url,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    // Increment module's total_lessons counter if we just created a new lesson
    if (!meeting.target_lesson_id && meeting.target_module_id) {
      await supabase.rpc("increment_module_lesson_count", { p_module_id: meeting.target_module_id })
        .then(() => {})
        .catch(() => { /* non-fatal if rpc doesn't exist */ });
    }

    // Broadcast do PDF pro grupo do WhatsApp: SO' se a reuniao ja' encerrou
    // (gate dentro de maybeBroadcastPdf). Se a aula ainda esta rolando, isto e'
    // um no-op e o envio acontece depois, no room_finished. Corrige o bug de
    // mandar o PDF pro grupo com a reuniao ao vivo ainda em andamento.
    let broadcasts: any[] = [];
    try {
      const r = await maybeBroadcastPdf(supabase, meeting_id);
      broadcasts = r?.sent || [];
      console.log(`[PROCESS] broadcast gate: ${JSON.stringify(r?.skipped || r?.sent?.length + ' grupos')}`);
    } catch (e: any) {
      console.error(`[PROCESS] erro no broadcast do PDF: ${e.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      status: "ready",
      lesson_id: lessonId,
      pdf_url,
      video_url: videoUrl,
      job_id: jobId,
      broadcasts,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[PROCESS] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
