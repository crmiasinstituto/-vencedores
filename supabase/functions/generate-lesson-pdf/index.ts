import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

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

// SQUAAD brand palette
const SQUAAD_GOLD = rgb(0.98, 0.784, 0);        // #FAC800
const SQUAAD_GOLD_DARK = rgb(0.82, 0.65, 0);    // hover/darker variant
const SQUAAD_BLACK = rgb(0.04, 0.04, 0.04);     // near-black for headers
const TEXT_COLOR = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.45, 0.45, 0.45);
const GRAY_LIGHT = rgb(0.7, 0.7, 0.7);
const GOLD_BG = rgb(1.0, 0.975, 0.85);          // soft gold for badge bg
const WHITE = rgb(1, 1, 1);

async function runGemini(title: string, transcription: string, timestampedTranscript?: string) {
  const hasTimestamps = !!(timestampedTranscript && timestampedTranscript.trim().length > 50);

  const timestampRule = hasTimestamps
    ? `REGRA CRITICA dos timestamps:
- A transcrição vem com marcações [MM:SS] reais (extraídas da gravação).
- Você DEVE escolher 5 a 10 dessas marcações como divisores de tópicos.
- O campo "time" de cada item de "timestamps" DEVE ser COPIADO exatamente de uma marcação que aparece na transcrição. NÃO invente, NÃO arredonde, NÃO interpole.
- Se uma marcação não aparece literal na transcrição abaixo, NÃO a use.
- Distribua os tópicos ao longo da aula (não concentre tudo no início).`
    : `Os timestamps reais NÃO estão disponíveis para esta aula — retorne timestamps: []. Não tente adivinhar horários.`;

  const transcriptBlock = hasTimestamps
    ? `Transcrição com marcações [MM:SS] reais:\n"""\n${timestampedTranscript!.slice(0, 80000)}\n"""`
    : `Transcrição completa:\n"""\n${transcription.slice(0, 80000)}\n"""`;

  const prompt = `Você é um editor pedagógico da SQUAAD. A partir da transcrição real de uma aula intitulada "${title}", produza um material de apoio premium em português.

Retorne JSON com:
- summary: resumo executivo de 180-280 palavras, em parágrafos
- key_points: 6 a 10 pontos-chave objetivos
- timestamps: ${hasTimestamps ? "de 5 a 10 marcações no formato { time, topic } — usando os timestamps REAIS abaixo" : "array vazio []"}
- exercises: 3 a 5 exercícios práticos no formato { title, description }

${timestampRule}

Seja fiel ao conteúdo da transcrição. Não invente fatos.

${transcriptBlock}`;

  const lovableApiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um editor pedagógico expert. Responda APENAS em JSON válido." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "structure_lesson",
          description: "Return structured lesson content",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string" },
              key_points: { type: "array", items: { type: "string" } },
              timestamps: {
                type: "array",
                items: {
                  type: "object",
                  properties: { time: { type: "string" }, topic: { type: "string" } },
                  required: ["time", "topic"],
                },
              },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  properties: { title: { type: "string" }, description: { type: "string" } },
                  required: ["title", "description"],
                },
              },
            },
            required: ["summary", "key_points", "timestamps", "exercises"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "structure_lesson" } },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error ${response.status}: ${err}`);
  }

  const aiResult = await response.json();
  const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
  const args = toolCall?.function?.arguments;
  if (args) {
    return typeof args === "string" ? JSON.parse(args) : args;
  }
  const content = aiResult.choices?.[0]?.message?.content || "";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Gemini did not return structured output");
  return JSON.parse(match[0]);
}

// Strip characters outside WinAnsi (pdf-lib Helvetica supports WinAnsi-1252 only)
function sanitize(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\xFF]/g, "");
}

async function loadLogo(): Promise<Uint8Array | null> {
  const candidates = [
    "https://squaad.com.br/squaad-logo-pdf.png",
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch { /* try next */ }
  }
  return null;
}

async function buildPdf(title: string, data: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(sanitize(title));
  pdfDoc.setAuthor("SQUAAD Empresarial");
  pdfDoc.setSubject("Material de Apoio - Area de Membros SQUAAD");
  pdfDoc.setProducer("SQUAAD CRM");
  pdfDoc.setCreationDate(new Date());

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const logoBytes = await loadLogo();
  let logo: any = null;
  if (logoBytes) {
    try { logo = await pdfDoc.embedPng(logoBytes); } catch {
      try { logo = await pdfDoc.embedJpg(logoBytes); } catch { /* ignore */ }
    }
  }

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 60;
  const CONTENT_W = PAGE_W - 2 * MARGIN;
  const HEADER_H = 90;
  const FOOTER_H = 60;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 50;
  let pageNum = 1;

  function drawHeader(p: any) {
    // Black bar
    p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: SQUAAD_BLACK });
    // Gold accent strip at bottom
    p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 3, width: PAGE_W, height: 3, color: SQUAAD_GOLD });

    // Logo (centered vertically in black bar). The cropped logo is ~2.86:1
    if (logo) {
      const logoH = 46;
      const logoW = Math.min(logoH * (logo.width / logo.height), 180);
      p.drawImage(logo, {
        x: MARGIN,
        y: PAGE_H - HEADER_H + (HEADER_H - logoH) / 2,
        width: logoW,
        height: logoH,
      });
    } else {
      p.drawText("SQUAAD", {
        x: MARGIN,
        y: PAGE_H - HEADER_H / 2 - 6,
        size: 24, font: bold, color: SQUAAD_GOLD,
      });
    }

    // Right side: AREA DE MEMBROS
    const labelText = "AREA DE MEMBROS";
    const labelW = bold.widthOfTextAtSize(labelText, 9);
    p.drawText(labelText, {
      x: PAGE_W - MARGIN - labelW,
      y: PAGE_H - HEADER_H / 2 + 4,
      size: 9, font: bold, color: SQUAAD_GOLD,
    });
    const subLabel = "Material exclusivo";
    const subW = regular.widthOfTextAtSize(subLabel, 7);
    p.drawText(subLabel, {
      x: PAGE_W - MARGIN - subW,
      y: PAGE_H - HEADER_H / 2 - 8,
      size: 7, font: regular, color: GRAY_LIGHT,
    });
  }

  function drawFooter(p: any, pn: number) {
    const ruleY = 46;
    p.drawLine({
      start: { x: MARGIN, y: ruleY },
      end: { x: MARGIN + 32, y: ruleY },
      thickness: 2, color: SQUAAD_GOLD,
    });
    p.drawLine({
      start: { x: MARGIN + 38, y: ruleY },
      end: { x: PAGE_W - MARGIN, y: ruleY },
      thickness: 0.4, color: GRAY_LIGHT,
    });
    p.drawText("SQUAAD BUSINESS SOLUTIONS", {
      x: MARGIN, y: 28, size: 8, font: bold, color: SQUAAD_BLACK,
    });
    p.drawText("Material exclusivo da Area de Membros", {
      x: MARGIN, y: 18, size: 7, font: regular, color: GRAY,
    });
    const pageLabel = `${pn}`;
    const pageW = bold.widthOfTextAtSize(pageLabel, 9);
    p.drawText(pageLabel, {
      x: PAGE_W - MARGIN - pageW, y: 24, size: 9, font: bold, color: SQUAAD_GOLD,
    });
  }

  drawHeader(page);

  function newPage() {
    drawFooter(page, pageNum);
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageNum++;
    drawHeader(page);
    y = PAGE_H - HEADER_H - 40;
  }

  function ensure(needed: number) {
    if (y - needed < FOOTER_H + 10) newPage();
  }

  function wrap(text: string, font: any, size: number, maxW: number): string[] {
    const clean = sanitize(text);
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function paragraph(text: string, opts: any = {}) {
    const { font = regular, size = 11, color = TEXT_COLOR, lineHeight = 15, indent = 0 } = opts;
    const lines = wrap(text, font, size, CONTENT_W - indent);
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color });
      y -= lineHeight;
    }
  }

  function heading(text: string, opts: any = {}) {
    const { size = 13 } = opts;
    y -= 14;
    ensure(size + 22);
    // Gold square mark
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 4, height: size + 2, color: SQUAAD_GOLD });
    // Uppercase heading text
    const upper = sanitize(text).toUpperCase();
    page.drawText(upper, {
      x: MARGIN + 12,
      y: y - 1,
      size,
      font: bold,
      color: SQUAAD_BLACK,
    });
    y -= size + 14;
  }

  // ---- Cover area ----
  y = PAGE_H - HEADER_H - 36;

  // Eyebrow label
  page.drawText("AULA - METODO SQUAAD", {
    x: MARGIN, y, size: 8, font: bold, color: SQUAAD_GOLD,
  });
  y -= 18;

  // Main title
  const titleLines = wrap(title, bold, 22, CONTENT_W);
  for (const line of titleLines) {
    ensure(32);
    page.drawText(line, { x: MARGIN, y, size: 22, font: bold, color: SQUAAD_BLACK });
    y -= 28;
  }
  y -= 6;

  // Gold accent line under title
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + 60, y },
    thickness: 3, color: SQUAAD_GOLD,
  });
  y -= 16;

  // Date
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  page.drawText(sanitize(`Material gerado em ${dateStr}`), {
    x: MARGIN, y, size: 9, font: italic, color: GRAY,
  });
  y -= 28;

  // Summary
  if (data.summary) {
    heading("Resumo da Aula");
    const paragraphs = String(data.summary).split(/\n+/).filter(Boolean);
    for (const p of paragraphs) {
      paragraph(p, { size: 11, lineHeight: 15 });
      y -= 6;
    }
  }

  // Key points
  if (Array.isArray(data.key_points) && data.key_points.length) {
    heading("Pontos-chave");
    for (const point of data.key_points) {
      ensure(22);
      // Small gold square bullet
      page.drawRectangle({ x: MARGIN, y: y + 1, width: 5, height: 5, color: SQUAAD_GOLD });
      const lines = wrap(String(point), regular, 11, CONTENT_W - 16);
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) ensure(14);
        page.drawText(lines[i], { x: MARGIN + 14, y, size: 11, font: regular, color: TEXT_COLOR });
        if (i < lines.length - 1) y -= 14;
      }
      y -= 16;
    }
  }

  // Timestamps
  if (Array.isArray(data.timestamps) && data.timestamps.length) {
    heading("Trilha da Aula");
    for (const ts of data.timestamps) {
      ensure(22);
      const time = sanitize(String(ts.time || ""));
      const topic = String(ts.topic || "");
      // Gold filled badge with black text
      const badgeW = Math.max(52, bold.widthOfTextAtSize(time, 9) + 14);
      page.drawRectangle({
        x: MARGIN, y: y - 3, width: badgeW, height: 17,
        color: SQUAAD_GOLD,
      });
      page.drawText(time, {
        x: MARGIN + (badgeW - bold.widthOfTextAtSize(time, 9)) / 2,
        y: y + 1, size: 9, font: bold, color: SQUAAD_BLACK,
      });

      const lines = wrap(topic, regular, 10.5, CONTENT_W - badgeW - 14);
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) ensure(13);
        page.drawText(lines[i], {
          x: MARGIN + badgeW + 10, y: y + 1, size: 10.5, font: regular, color: TEXT_COLOR,
        });
        if (i < lines.length - 1) y -= 13;
      }
      y -= 22;
    }
  }

  // Exercises
  if (Array.isArray(data.exercises) && data.exercises.length) {
    heading("Exercicios Praticos");
    data.exercises.forEach((ex: any, i: number) => {
      ensure(55);
      // Numbered gold circle
      const num = String(i + 1);
      const circleR = 10;
      const cx = MARGIN + circleR;
      page.drawCircle({ x: cx, y: y + 4, size: circleR, color: SQUAAD_GOLD });
      const numW = bold.widthOfTextAtSize(num, 11);
      page.drawText(num, {
        x: cx - numW / 2, y: y + 1, size: 11, font: bold, color: SQUAAD_BLACK,
      });

      const exTitle = sanitize(String(ex.title || ""));
      const titleLines = wrap(exTitle, bold, 12, CONTENT_W - 32);
      let firstLine = true;
      for (const line of titleLines) {
        if (!firstLine) { ensure(16); y -= 16; }
        page.drawText(line, { x: MARGIN + 28, y, size: 12, font: bold, color: SQUAAD_BLACK });
        firstLine = false;
      }
      y -= 16;

      if (ex.description) {
        paragraph(String(ex.description), { size: 10, lineHeight: 14, color: GRAY, indent: 28 });
      }
      y -= 14;
    });
  }

  drawFooter(page, pageNum);
  return await pdfDoc.save();
}

async function uploadToB2(filename: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const endpoint = Deno.env.get("S3_ENDPOINT") || Deno.env.get("B2_ENDPOINT")!;
  const bucket = Deno.env.get("S3_BUCKET") || Deno.env.get("B2_BUCKET")!;
  const accessKey = Deno.env.get("S3_ACCESS_KEY") || Deno.env.get("B2_ACCESS_KEY")!;
  const secretKey = Deno.env.get("S3_SECRET_KEY") || Deno.env.get("B2_SECRET_KEY")!;
  const publicUrl = Deno.env.get("S3_PUBLIC_URL") || Deno.env.get("B2_PUBLIC_URL")!;
  const region = Deno.env.get("S3_REGION") || Deno.env.get("B2_REGION") || "us-east-005";

  const client = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    service: "s3",
    region,
  });

  const url = `${endpoint.replace(/\/$/, "")}/${bucket}/${filename}`;
  const response = await client.fetch(url, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": contentType },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`B2 upload failed (${response.status}): ${err}`);
  }

  return `${publicUrl.replace(/\/$/, "")}/${filename}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, transcription, timestamped_transcript, meeting_id, lesson_id, persist } = await req.json();
    if (!title) throw new Error("title required");
    if (!transcription || transcription.length < 50) {
      throw new Error("transcription too short or missing");
    }

    console.log(`[PDF] Starting for "${title}" (${transcription.length} chars, timestamped=${!!timestamped_transcript})`);

    const analysis = await runGemini(title, transcription, timestamped_transcript);
    console.log(`[PDF] Gemini returned ${analysis.key_points?.length || 0} key points`);

    // Hard guard: descarta timestamps que NAO aparecem literalmente na
    // transcricao timestampada. Sem timestamped_transcript, zera tudo (ai fica
    // claro no PDF que nao temos minutagem real ao inves de minutagem fake).
    if (Array.isArray(analysis.timestamps) && analysis.timestamps.length) {
      const allowed = new Set<string>();
      if (timestamped_transcript) {
        for (const m of timestamped_transcript.matchAll(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g)) {
          allowed.add(m[1]);
        }
      }
      const before = analysis.timestamps.length;
      analysis.timestamps = analysis.timestamps.filter((ts: any) => {
        const t = String(ts?.time || "").trim();
        return t && allowed.has(t);
      });
      if (analysis.timestamps.length !== before) {
        console.log(`[PDF] Discarded ${before - analysis.timestamps.length} hallucinated timestamps`);
      }
    }

    const pdfBytes = await buildPdf(title, analysis);
    console.log(`[PDF] PDF built: ${pdfBytes.byteLength} bytes`);

    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const prefix = meeting_id || lesson_id || "adhoc";
    const filename = `lessons/${prefix}/${Date.now()}-${safeName || "aula"}.pdf`;
    const pdfUrl = await uploadToB2(filename, pdfBytes, "application/pdf");
    console.log(`[PDF] Uploaded to ${pdfUrl}`);

    if (persist && (meeting_id || lesson_id)) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      if (lesson_id) {
        await supabase.from("member_lessons").update({
          pdf_url: pdfUrl,
          ai_summary: analysis.summary,
          ai_key_points: analysis.key_points,
          ai_timestamps: analysis.timestamps,
          ai_exercises: analysis.exercises,
        }).eq("id", lesson_id);
      }
    }

    return new Response(JSON.stringify({ success: true, pdf_url: pdfUrl, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[PDF] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
