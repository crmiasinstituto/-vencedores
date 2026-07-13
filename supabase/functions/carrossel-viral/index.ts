// Carrossel Viral - gerador de roteiro de carrossel Instagram com IA
// Actions: generate_hooks | generate_content | regenerate_slide

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const TOTAL_SLIDES = 6;

const SYSTEM_PROMPT = `Voce e o estrategista de conteudo viral da SQUAAD. Voce escreve carrosseis para Instagram que viralizam por SHARES (a metrica que importa).

# DNA DO CONTEUDO VIRAL (regra de ouro)

- Case real + estrategia contraintuitiva + dado concreto
- Formula: "todo mundo faz X.. mas [empresa real] faz Y de proposito.. e fatura bilhoes"
- Estudo cientifico + aplicacao pratica
- A pessoa quer MOSTRAR pra alguem = viraliza
- Slide 1 = PANCADA (dado chocante + cliffhanger)

# REGRAS DE FORMATO (obrigatorias)

- Paragrafos CURTOS (1-2 linhas)
- Linha em branco entre cada paragrafo
- Pontuacao: usar ".." no lugar de travessao (travessao da cara de IA)
- Sem emojis no texto
- Sem palavras em ingles dificeis
- Cada slide = 1 ideia COMPLETA (nao dividir raciocinio entre slides)
- Conteudo profundo, "pqp isso e de graca?"
- Numeros, estudos, fontes reais
- CTA so no ULTIMO slide (natural, "link na bio")
- Sem auto-promocao no meio
- Portugues do Brasil

# O QUE NAO FUNCIONA (proibido)

- Conteudo generico sem dados
- Linguagem de coach ("mindset", "jornada", "proposito")
- Tutorial tecnico generico
- Noticia pura sem angulo contraintuitivo
- "Comente palavra X" (coisa de guru)
- Slide fraco no comeco

# OUTPUT

Responda APENAS chamando a funcao apropriada (tool use). Sem texto adicional.`;

/**
 * Mescla overrides do criador (persona, estrutura, legenda) ao SYSTEM_PROMPT padrao.
 * Quando o criador customiza um campo, ele PRIORIZA sobre o default mas mantem
 * as regras criticas (formato, tools, output JSON).
 */
function buildSystemPromptWithOverrides(opts: {
  personaOverride?: string;
  structureOverride?: string;
  captionOverride?: string;
}): string {
  const blocks: string[] = [SYSTEM_PROMPT];

  if (opts.personaOverride && opts.personaOverride.trim()) {
    blocks.push(
      `# PERSONA & ESTILO (DEFINIDO PELO CRIADOR, segue estritamente este tom):\n${opts.personaOverride.trim()}`,
    );
  }
  if (opts.structureOverride && opts.structureOverride.trim()) {
    blocks.push(
      `# ESTRUTURA DE CONTEUDO (DEFINIDO PELO CRIADOR, segue esta ordem dos slides):\n${opts.structureOverride.trim()}`,
    );
  }
  if (opts.captionOverride && opts.captionOverride.trim()) {
    blocks.push(
      `# LEGENDA (DEFINIDO PELO CRIADOR, segue este briefing pra montar a legenda):\n${opts.captionOverride.trim()}`,
    );
  }

  return blocks.join("\n\n");
}

// ============================================================
// TOOLS (function calling)
// ============================================================

const generateHooksTool = {
  type: "function",
  function: {
    name: "retornar_ganchos",
    description: "Retorna 3 opcoes de gancho viral para o slide 1, com estilos diferentes",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: {
          type: "string",
          description: "Titulo curto do tema (max 80 chars), pra usar como label no historico",
        },
        hooks: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: {
                type: "string",
                description: "Texto do gancho com 3 paragrafos curtos separados por linha em branco. Max 280 chars no total.",
              },
              style: {
                type: "string",
                enum: ["case_contraintuitivo", "dado_chocante", "polemico"],
                description: "Estilo do gancho: case_contraintuitivo (empresa que faz Y diferente), dado_chocante (numero que choca), polemico (afirmacao que provoca)",
              },
              angle: {
                type: "string",
                description: "Em 1 frase, qual e o angulo / por que vai engajar. Max 120 chars.",
              },
            },
            required: ["text", "style", "angle"],
          },
        },
      },
      required: ["topic", "hooks"],
    },
  },
};

const generateContentTool = {
  type: "function",
  function: {
    name: "retornar_carrossel",
    description: `Retorna o carrossel completo com ${TOTAL_SLIDES} slides + legenda do post`,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        slides: {
          type: "object",
          additionalProperties: false,
          description: `Os ${TOTAL_SLIDES} slides do carrossel. slide1 e o gancho ja escolhido (mantenha). slide${TOTAL_SLIDES} e o CTA.`,
          properties: {
            slide1: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string", description: "Titulo curto do slide. Max 60 chars." },
                texto: { type: "string", description: "Corpo do slide. Paragrafos curtos com linha em branco entre eles." },
              },
              required: ["titulo", "texto"],
            },
            slide2: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string", description: "Titulo curto. Max 60 chars." },
                texto: { type: "string", description: "Conteudo concreto, 1 ideia completa, com dado/case." },
              },
              required: ["titulo", "texto"],
            },
            slide3: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string" },
                texto: { type: "string" },
              },
              required: ["titulo", "texto"],
            },
            slide4: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string" },
                texto: { type: "string" },
              },
              required: ["titulo", "texto"],
            },
            slide5: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string" },
                texto: { type: "string" },
              },
              required: ["titulo", "texto"],
            },
            slide6: {
              type: "object",
              additionalProperties: false,
              description: "Slide final. CTA natural, ligado ao conteudo. 'Link na bio' como fechamento.",
              properties: {
                titulo: { type: "string" },
                texto: { type: "string" },
              },
              required: ["titulo", "texto"],
            },
          },
          required: ["slide1", "slide2", "slide3", "slide4", "slide5", "slide6"],
        },
        caption: {
          type: "string",
          description: "Legenda do post Instagram. Texto educativo, direto, com quebras de linha. Sem emojis. Resumo do conteudo + CTA final. Max 800 chars.",
        },
      },
      required: ["slides", "caption"],
    },
  },
};

const regenerateSlideTool = {
  type: "function",
  function: {
    name: "retornar_slide",
    description: "Retorna a versao reescrita de um unico slide",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        titulo: { type: "string", description: "Max 60 chars." },
        texto: { type: "string", description: "Paragrafos curtos com linha em branco entre eles." },
      },
      required: ["titulo", "texto"],
    },
  },
};

// ============================================================
// Lovable Gateway helper (mesmo padrao do masterclass-diagnostico)
// ============================================================

async function callLovableGateway(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  tool: unknown,
  toolName: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lovable gateway error:", response.status, errText.slice(0, 300));
    return null;
  }

  const data = await response.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;

  try {
    return JSON.parse(args);
  } catch (err) {
    console.error("JSON parse error:", err);
    return null;
  }
}

// ============================================================
// Supabase admin client (service role, pra inserir/atualizar)
// ============================================================

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================
// Fallback (sem IA): gera conteudo simples pra nao travar a UI
// ============================================================

function fallbackHooks(briefing: string) {
  const tema = briefing.slice(0, 80);
  return {
    topic: tema,
    hooks: [
      {
        text: `A maioria das pessoas erra isso sobre ${tema}.\n\nNao por falta de informacao.. por excesso de regra geral.\n\nO proximo slide mostra o que muda.`,
        style: "case_contraintuitivo",
        angle: "Promete revelar erro que parece certo",
      },
      {
        text: `97% das pessoas que tentam ${tema} desistem antes de 30 dias.\n\nNao e falta de disciplina.. e o metodo errado desde o dia 1.\n\nVeja o que os 3% fazem diferente.`,
        style: "dado_chocante",
        angle: "Numero forte + cliffhanger",
      },
      {
        text: `${tema} nao e sobre o que voce pensa que e.\n\nQuem fatura com isso fala uma coisa.. mas faz outra.\n\nO carrossel abaixo mostra o jogo real.`,
        style: "polemico",
        angle: "Provoca curiosidade com promessa de bastidor",
      },
    ],
  };
}

function fallbackContent() {
  return {
    slides: {
      slide1: {
        titulo: "(gancho escolhido)",
        texto: "(use o gancho que voce escolheu)",
      },
      slide2: {
        titulo: "Erro #1",
        texto: "Quase todo mundo comeca pelo lugar errado.\n\nO que parece atalho e o que mais atrasa.",
      },
      slide3: {
        titulo: "O que os melhores fazem",
        texto: "Comecam pelo final.\n\nSabem antes onde querem chegar e fazem engenharia reversa.",
      },
      slide4: {
        titulo: "O dado que ninguem cita",
        texto: "Pesquisas internas de empresas que escalam mostram um padrao.\n\nNao e o talento.. e o sistema.",
      },
      slide5: {
        titulo: "Como aplicar hoje",
        texto: "Tres passos simples.\n\n1. Definir o final\n2. Quebrar em semanas\n3. Medir 1 numero por semana",
      },
      slide6: {
        titulo: "E o proximo passo",
        texto: "Se voce ja faz isso.. e so afinar.\n\nSe nao.. comeca hoje.\n\nLink na bio.",
      },
    },
    caption: "Conteudo direto pra quem quer parar de tentar e comecar a executar. Salva o post pra rever depois e manda pra alguem que precisa ouvir isso. Link na bio.",
  };
}

// ============================================================
// HANDLERS
// ============================================================

async function handleGenerateHooks(payload: {
  briefing: string;
  persona_override?: string;
  structure_override?: string;
}) {
  const { briefing, persona_override, structure_override } = payload;
  if (!briefing || briefing.trim().length < 6) {
    return { success: false, error: "briefing too short", status: 400 };
  }

  const admin = getAdminClient();
  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");

  let result: { topic: string; hooks: Array<{ text: string; style: string; angle: string }> };

  if (apiKey) {
    const systemPrompt = buildSystemPromptWithOverrides({
      personaOverride: persona_override,
      structureOverride: structure_override,
    });
    const ai = await callLovableGateway(
      apiKey,
      systemPrompt,
      `Briefing do criador:
"""
${briefing}
"""

Gere 3 ganchos virais para o SLIDE 1 desse carrossel. Cada um com estilo diferente:
1. case_contraintuitivo (empresa real que faz oposto do obvio e ganha)
2. dado_chocante (numero forte + cliffhanger)
3. polemico (afirmacao que provoca, sem ser raso)

Retorne chamando retornar_ganchos.`,
      generateHooksTool,
      "retornar_ganchos",
    );

    result = (ai as typeof result) ?? fallbackHooks(briefing);
  } else {
    console.warn("LOVABLE_API_KEY missing, using fallback");
    result = fallbackHooks(briefing);
  }

  const hooksWithIds = result.hooks.map((h, i) => ({ id: i, ...h }));

  const { data, error } = await admin
    .from("viral_carousels")
    .insert({
      briefing,
      topic: result.topic ?? briefing.slice(0, 80),
      hooks: hooksWithIds,
      status: "hooks_generated",
    })
    .select()
    .single();

  if (error) {
    console.error("insert viral_carousels error:", error);
    return { success: false, error: error.message, status: 500 };
  }

  return {
    success: true,
    carousel_id: data.id,
    topic: data.topic,
    hooks: hooksWithIds,
  };
}

async function handleGenerateContent(payload: {
  carousel_id: string;
  hook_index: number;
  persona_override?: string;
  structure_override?: string;
  caption_override?: string;
}) {
  const { carousel_id, hook_index, persona_override, structure_override, caption_override } = payload;
  if (!carousel_id) return { success: false, error: "carousel_id required", status: 400 };
  if (typeof hook_index !== "number" || hook_index < 0 || hook_index > 2) {
    return { success: false, error: "hook_index must be 0..2", status: 400 };
  }

  const admin = getAdminClient();

  const { data: carousel, error: fetchErr } = await admin
    .from("viral_carousels")
    .select("*")
    .eq("id", carousel_id)
    .single();

  if (fetchErr || !carousel) {
    return { success: false, error: "carousel not found", status: 404 };
  }

  const hooks = (carousel.hooks ?? []) as Array<{ text: string; style: string }>;
  const chosen = hooks[hook_index];
  if (!chosen) return { success: false, error: "invalid hook_index", status: 400 };

  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  let result: {
    slides: Record<string, { titulo: string; texto: string }>;
    caption: string;
  };

  if (apiKey) {
    const systemPrompt = buildSystemPromptWithOverrides({
      personaOverride: persona_override,
      structureOverride: structure_override,
      captionOverride: caption_override,
    });
    const ai = await callLovableGateway(
      apiKey,
      systemPrompt,
      `Briefing original:
"""
${carousel.briefing}
"""

Gancho ESCOLHIDO pelo criador (use exatamente como slide1.texto):
"""
${chosen.text}
"""

Agora gere o carrossel completo com ${TOTAL_SLIDES} slides:
- slide1 = use o gancho escolhido (texto do gancho como slide1.texto, titulo curto extraido)
- slide2 a slide5 = conteudo profundo, 1 ideia por slide, dado concreto, case real
- slide${TOTAL_SLIDES} = CTA natural, "link na bio"

Tambem gere a LEGENDA do post (campo caption) seguindo as regras.

Retorne chamando retornar_carrossel.`,
      generateContentTool,
      "retornar_carrossel",
    );
    result = (ai as typeof result) ?? fallbackContent();
  } else {
    result = fallbackContent();
  }

  // Garantir que slide1 use o gancho escolhido literalmente
  if (result.slides?.slide1) {
    result.slides.slide1.texto = chosen.text;
  }

  const { error: updErr } = await admin
    .from("viral_carousels")
    .update({
      selected_hook_index: hook_index,
      slides: result.slides,
      caption: result.caption,
      total_slides: TOTAL_SLIDES,
      status: "ready",
    })
    .eq("id", carousel_id);

  if (updErr) {
    console.error("update viral_carousels error:", updErr);
    return { success: false, error: updErr.message, status: 500 };
  }

  return {
    success: true,
    carousel_id,
    slides: result.slides,
    caption: result.caption,
  };
}

async function handleRegenerateSlide(payload: {
  carousel_id: string;
  slide_key: string;
  instruction?: string;
}) {
  const { carousel_id, slide_key, instruction } = payload;
  if (!carousel_id || !slide_key) {
    return { success: false, error: "carousel_id and slide_key required", status: 400 };
  }

  const admin = getAdminClient();
  const { data: carousel, error: fetchErr } = await admin
    .from("viral_carousels")
    .select("*")
    .eq("id", carousel_id)
    .single();
  if (fetchErr || !carousel) return { success: false, error: "carousel not found", status: 404 };

  const slides = (carousel.slides ?? {}) as Record<string, { titulo: string; texto: string }>;
  const current = slides[slide_key];
  if (!current) return { success: false, error: "slide_key not found", status: 400 };

  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  if (!apiKey) {
    return { success: false, error: "AI key not configured", status: 500 };
  }

  const ai = await callLovableGateway(
    apiKey,
    SYSTEM_PROMPT,
    `Briefing do carrossel:
"""
${carousel.briefing}
"""

Slide atual (${slide_key}):
TITULO: ${current.titulo}
TEXTO:
${current.texto}

${instruction ? `Instrucao do criador para regerar este slide:\n"""\n${instruction}\n"""` : "Reescreva mantendo a mesma ideia mas com texto melhor: paragrafos mais curtos, dado mais concreto, ou angulo mais forte."}

Retorne APENAS o slide reescrito chamando retornar_slide.`,
    regenerateSlideTool,
    "retornar_slide",
  );

  if (!ai) return { success: false, error: "AI failed", status: 500 };

  const newSlide = ai as { titulo: string; texto: string };
  slides[slide_key] = newSlide;

  const { error: updErr } = await admin
    .from("viral_carousels")
    .update({ slides })
    .eq("id", carousel_id);

  if (updErr) return { success: false, error: updErr.message, status: 500 };

  return { success: true, carousel_id, slide_key, slide: newSlide };
}

// ============================================================
// IMAGE GENERATION (Gemini 2.5 Flash Image)
// ============================================================

const TECHNICAL_STYLE_FOOTER = `Photorealistic. Vertical aspect ratio 4:5 (1080x1350). High quality, magazine-grade.
NEVER include text, letters, words, captions, watermarks, logos, or typography in the image. Pure visual scene only.`;

const FALLBACK_STYLE_PROMPT = `Photorealistic editorial photography for an Instagram carousel slide.
Cinematic lighting, shallow depth of field, professional composition.`;

interface ImagePromptOptions {
  briefing: string;
  slide: { titulo: string; texto: string };
  stylePrompt?: string;
  accentColor?: string;
  hasReference?: boolean;
}

function buildImagePromptForSlide(opts: ImagePromptOptions): string {
  const { briefing, slide, stylePrompt, accentColor, hasReference } = opts;
  const directorPrompt = (stylePrompt && stylePrompt.trim()) || FALLBACK_STYLE_PROMPT;
  const cleanText = slide.texto.replace(/\n+/g, " ").slice(0, 240);

  const accentLine = accentColor
    ? `Accent color to subtly include in small details: ${accentColor}.`
    : "";
  const referenceLine = hasReference
    ? "The provided reference photo is the person of reference. Include them subtly in the scene as a coadjuvant character. The scene is the protagonist."
    : "";

  return [
    "=== STYLE (director's brief, applies to ALL images) ===",
    directorPrompt,
    accentLine,
    referenceLine,
    "",
    "=== THIS SPECIFIC SLIDE ===",
    `Carousel theme: ${briefing.slice(0, 200)}.`,
    `Slide topic: ${slide.titulo}.`,
    `Slide content: ${cleanText}`,
    "",
    "=== TECHNICAL ===",
    TECHNICAL_STYLE_FOOTER,
  ]
    .filter(Boolean)
    .join("\n");
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchReferenceImage(
  url: string,
): Promise<{ mimeType: string; base64: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("reference image fetch failed:", res.status);
      return null;
    }
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return { mimeType: mimeType.split(";")[0].trim(), base64: bytesToBase64(buf) };
  } catch (err) {
    console.error("reference image fetch threw:", err);
    return null;
  }
}

async function generateImageBytes(
  prompt: string,
  reference?: { mimeType: string; base64: string },
): Promise<{ bytes: Uint8Array | null; debug: string[] }> {
  const debug: string[] = [];
  const geminiKey = await getIntegrationKey("gemini", "GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_KEY");
  const openaiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");

  debug.push(`gemini_key=${geminiKey ? "set" : "missing"} openai_key=${openaiKey ? "set" : "missing"}`);

  if (geminiKey) {
    const result = await callGeminiImageDetailed(prompt, geminiKey, reference);
    debug.push(...result.debug);
    if (result.bytes) return { bytes: result.bytes, debug };
  }

  if (openaiKey) {
    const result = await callOpenAIImageDetailed(prompt, openaiKey);
    debug.push(...result.debug);
    if (result.bytes) return { bytes: result.bytes, debug };
  }

  return { bytes: null, debug };
}

async function callGeminiImageDetailed(
  prompt: string,
  geminiKey: string,
  reference?: { mimeType: string; base64: string },
): Promise<{ bytes: Uint8Array | null; debug: string[] }> {
  const debug: string[] = [];
  const candidateModels = [
    "gemini-2.5-flash-image-preview",
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-exp",
  ];

  const parts: Array<Record<string, unknown>> = [];
  if (reference) {
    parts.push({ inline_data: { mime_type: reference.mimeType, data: reference.base64 } });
  }
  parts.push({ text: prompt });

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      if (!response.ok) {
        const txt = await response.text();
        const snip = txt.slice(0, 220).replace(/\s+/g, " ");
        debug.push(`gemini[${model}] ${response.status}: ${snip}`);
        continue;
      }
      const data = await response.json();
      const respParts = data?.candidates?.[0]?.content?.parts ?? [];
      for (const part of respParts) {
        const inline = part?.inlineData ?? part?.inline_data;
        if (inline?.data) {
          debug.push(`gemini[${model}] OK`);
          return { bytes: decodeBase64ToBytes(inline.data), debug };
        }
      }
      const finishReason = data?.candidates?.[0]?.finishReason || "no_image";
      debug.push(`gemini[${model}] no_image finishReason=${finishReason}`);
    } catch (err: any) {
      debug.push(`gemini[${model}] threw: ${err.message?.slice(0, 200) || err}`);
    }
  }
  return { bytes: null, debug };
}

async function callOpenAIImageDetailed(
  prompt: string,
  openaiKey: string,
): Promise<{ bytes: Uint8Array | null; debug: string[] }> {
  const debug: string[] = [];
  const tries = [
    { model: "gpt-image-1", size: "1024x1536" as const },
    { model: "dall-e-3", size: "1024x1792" as const },
  ];

  for (const t of tries) {
    try {
      const body: Record<string, unknown> = {
        model: t.model,
        prompt: prompt.slice(0, 3900), // dall-e-3 cap
        n: 1,
        size: t.size,
      };
      // gpt-image-1 NAO aceita response_format, retorna b64 sempre.
      // dall-e-3 PRECISA de response_format=b64_json pra retornar base64.
      if (t.model === "dall-e-3") body.response_format = "b64_json";

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const txt = await response.text();
        const snip = txt.slice(0, 220).replace(/\s+/g, " ");
        debug.push(`openai[${t.model}] ${response.status}: ${snip}`);
        continue;
      }
      const data = await response.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) {
        debug.push(`openai[${t.model}] OK`);
        return { bytes: decodeBase64ToBytes(b64), debug };
      }
      debug.push(`openai[${t.model}] no_b64 in response`);
    } catch (err: any) {
      debug.push(`openai[${t.model}] threw: ${err.message?.slice(0, 200) || err}`);
    }
  }
  return { bytes: null, debug };
}

async function handleGenerateImage(payload: {
  carousel_id: string;
  slide_key: string;
  prompt?: string;             // legacy: prompt direto pro slide
  style_prompt?: string;       // novo: prompt do "diretor de arte"
  accent_color?: string;       // cor de destaque a inserir nas imagens
  reference_url?: string;      // URL publica da foto de referencia (multimodal)
}) {
  const { carousel_id, slide_key, prompt, style_prompt, accent_color, reference_url } = payload;
  if (!carousel_id || !slide_key) {
    return { success: false, error: "carousel_id and slide_key required", status: 400 };
  }

  const admin = getAdminClient();
  const { data: carousel, error: fetchErr } = await admin
    .from("viral_carousels")
    .select("*")
    .eq("id", carousel_id)
    .single();
  if (fetchErr || !carousel) return { success: false, error: "carousel not found", status: 404 };

  const slides = (carousel.slides ?? {}) as Record<
    string,
    { titulo: string; texto: string; imageUrl?: string }
  >;
  const slide = slides[slide_key];
  if (!slide) return { success: false, error: "slide_key not found", status: 400 };

  // Baixa foto de referencia se foi passada
  let reference: { mimeType: string; base64: string } | undefined;
  if (reference_url) {
    const fetched = await fetchReferenceImage(reference_url);
    if (fetched) reference = fetched;
    else console.warn("reference_url provided but fetch failed:", reference_url);
  }

  const imagePrompt = buildImagePromptForSlide({
    briefing: carousel.briefing,
    slide,
    stylePrompt: style_prompt || prompt, // backwards compat
    accentColor: accent_color,
    hasReference: !!reference,
  });

  const { bytes: imageBytes, debug } = await generateImageBytes(imagePrompt, reference);
  if (!imageBytes) {
    console.error("[image gen] all attempts failed:", debug.join(" | "));
    return {
      success: false,
      error: "image generation failed",
      debug, // expoe pra UI mostrar o motivo real
      status: 502,
    };
  }

  // Upload Storage
  const path = `${carousel_id}/${slide_key}-${Date.now()}.png`;
  const { error: upErr } = await admin.storage
    .from("carousel-images")
    .upload(path, imageBytes, {
      contentType: "image/png",
      upsert: true,
    });
  if (upErr) {
    console.error("storage upload error:", upErr);
    return { success: false, error: "storage upload failed", status: 500 };
  }

  const { data: pub } = admin.storage.from("carousel-images").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  // Update slide com imageUrl
  slides[slide_key] = { ...slide, imageUrl: publicUrl };
  const { error: updErr } = await admin
    .from("viral_carousels")
    .update({ slides })
    .eq("id", carousel_id);
  if (updErr) return { success: false, error: updErr.message, status: 500 };

  return {
    success: true,
    carousel_id,
    slide_key,
    image_url: publicUrl,
  };
}

// ============================================================
// HTTP entrypoint
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    let result: { success: boolean; status?: number; [k: string]: unknown };

    switch (action) {
      case "generate_hooks":
        result = await handleGenerateHooks(body);
        break;
      case "generate_content":
        result = await handleGenerateContent(body);
        break;
      case "regenerate_slide":
        result = await handleRegenerateSlide(body);
        break;
      case "generate_image":
        result = await handleGenerateImage(body);
        break;
      default:
        result = { success: false, error: "unknown action", status: 400 };
    }

    const status = result.status ?? (result.success ? 200 : 500);
    delete result.status;

    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("carrossel-viral error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
