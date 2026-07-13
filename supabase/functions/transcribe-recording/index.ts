// ============================================================
// transcribe-recording (verify_jwt: false)
//
// Transcricao em LOTE (batch) da gravacao, barata, pra gerar o PDF.
// Substitui o Soniox em tempo real em aula/masterclass/live (real-time so
// nas calls de venda, pro coach ao vivo). Fluxo:
//   1. process-lesson-recording (ou manual) -> VPS /extract-audio (extrai
//      audio mono opus do MP4 gravado).
//   2. VPS chama ESTA edge no callback com { meeting_id, audio_url }.
//   3. Baixa o audio (pequeno) e manda pro Groq whisper-large-v3-turbo.
//   4. Salva meeting.transcription + transcriptions (segments) e reinvoca
//      process-lesson-recording, que agora acha transcricao e gera o PDF.
//
// verify_jwt=false porque o callback da VPS nao manda JWT. Guard: audio_url
// tem que ser do nosso bucket publico (videos.squaad.com.br).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Le a chave do banco (integration_keys, service='groq'), cai no env como fallback.
let _keyClient: any = null;
async function getIntegrationKey(service: string, envFallback?: string): Promise<string | null> {
  try {
    if (!_keyClient) {
      _keyClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    }
    const { data } = await _keyClient
      .from("integration_keys")
      .select("api_key, is_active")
      .eq("service", service)
      .maybeSingle();
    if (data && data.is_active && data.api_key) return String(data.api_key).trim();
  } catch (_) { /* fallback */ }
  return (envFallback ? Deno.env.get(envFallback) : null) || null;
}

const PUBLIC_PREFIX = (Deno.env.get("S3_PUBLIC_URL") || "https://videos.squaad.com.br").replace(/\/$/, "");
const GROQ_MODEL = "whisper-large-v3-turbo";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { meeting_id, audio_url } = await req.json().catch(() => ({} as any));
    if (!meeting_id || !audio_url) return json({ error: "meeting_id e audio_url obrigatorios" }, 400);

    // Guard: so aceita audio do nosso bucket publico.
    if (!String(audio_url).startsWith(PUBLIC_PREFIX) && !String(audio_url).startsWith("https://videos.squaad.com.br")) {
      return json({ error: "audio_url invalido (fora do bucket SQUAAD)" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const groqKey = await getIntegrationKey("groq", "GROQ_API_KEY");
    if (!groqKey) {
      await supabase.from("meetings").update({ processing_error: "GROQ_API_KEY nao configurada" }).eq("id", meeting_id);
      return json({ error: "GROQ_API_KEY nao configurada (integration_keys service=groq)" }, 503);
    }

    // 1) Baixa o audio (ja comprimido pela VPS, ~10MB/h)
    const audioRes = await fetch(audio_url);
    if (!audioRes.ok) return json({ error: `falha ao baixar audio (${audioRes.status})` }, 502);
    const audioBlob = await audioRes.blob();
    const fname = audio_url.split("/").pop() || "audio.ogg";

    // 2) Groq Whisper (batch). verbose_json -> segments com start/end em segundos.
    const form = new FormData();
    form.append("file", audioBlob, fname);
    form.append("model", GROQ_MODEL);
    form.append("response_format", "verbose_json");
    form.append("language", "pt");
    form.append("temperature", "0");

    const gRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });
    const gText = await gRes.text();
    if (!gRes.ok) {
      console.error("[transcribe-recording] groq fail:", gRes.status, gText.slice(0, 400));
      await supabase.from("meetings").update({ processing_error: `Groq ${gRes.status}: ${gText.slice(0, 200)}` }).eq("id", meeting_id);
      return json({ error: `Groq falhou (${gRes.status})` }, 502);
    }
    let parsed: any = {};
    try { parsed = JSON.parse(gText); } catch { parsed = { text: gText }; }

    const fullText = String(parsed.text || "").trim();
    const segments = Array.isArray(parsed.segments)
      ? parsed.segments.map((s: any) => ({
          start: typeof s.start === "number" ? s.start : 0,
          end: typeof s.end === "number" ? s.end : 0,
          text: String(s.text || "").trim(),
          is_final: true,
        })).filter((s: any) => s.text)
      : [];

    if (fullText.length < 5) {
      await supabase.from("meetings").update({ processing_error: "Transcricao vazia (Groq)" }).eq("id", meeting_id);
      return json({ error: "transcricao vazia" }, 422);
    }

    // 3) Salva na meeting (transcription + segments com timestamps reais)
    const upd: any = { transcription: fullText };
    if (segments.length) upd.transcriptions = segments;
    await supabase.from("meetings").update(upd).eq("id", meeting_id);
    console.log(`[transcribe-recording] meeting ${meeting_id}: ${fullText.length} chars, ${segments.length} segments`);

    // 4) Reinvoca o pipeline da aula (agora com transcricao -> gera PDF + publica)
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-lesson-recording`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ meeting_id }),
      });
    } catch (e) {
      console.error("[transcribe-recording] re-invoke process-lesson-recording err:", e);
    }

    return json({ ok: true, chars: fullText.length, segments: segments.length });
  } catch (e: any) {
    console.error("[transcribe-recording] fatal:", e);
    return json({ error: e.message || "erro inesperado" }, 500);
  }
});
