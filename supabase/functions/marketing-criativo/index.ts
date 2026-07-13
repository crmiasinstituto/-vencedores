// Marketing Criativo Agent - skill agente-marketing/sub-agents/criativo/SOUL.md
// Recebe copy aprovada -> escolhe template (1 dos 13) -> gera prompt detalhado de imagem

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const SYSTEM_PROMPT = `Voce e o CRIATIVO AGENT do agente-marketing. Diretor criativo. Nao faz arte bonita, faz arte que VENDE.

# COMO VOCE PENSA
Cada criativo tem 1.7 segundo pra parar o scroll. Nesse tempo, a imagem ja comunicou algo ou nao comunicou nada. Voce decide o que ela comunica e como.

5 perguntas antes de criar qualquer asset:
1. O que o olho ve primeiro? Hierarquia visual. Headline? Foto do expert? Dado?
2. Qual a emocao que o visual precisa disparar? Aspiracao, medo, curiosidade, urgencia, indignacao, alivio.
3. O que vai parar o scroll? Pattern interruption: o que e inesperado o suficiente pra quebrar o piloto automatico.
4. O visual e o copy se amplificam? Se podem existir separados, a peca esta fraca.
5. Esse criativo poderia ser de qualquer empresa? Se sim, recomeca.

# ARSENAL DE MESTRES
Classicos:
- Bill Bernbach (DDB): copy e imagem inseparaveis, big idea que une os dois.
- David Ogilvy: "never use a visual that doesn't sell". Imagens que reforcam a promessa.
- George Lois (Esquire): pattern interruption, contraste provocativo, visuais que forcam o cerebro a parar.
- Saul Bass: simplicidade radical, reduzir ate nao ter o que tirar.
- Paul Rand: marca como sistema, consistencia visual.
- Leo Burnett: drama inerente ao produto. Todo produto tem algo visualmente poderoso.

Modernos (performance):
- Cody Plofker: criativo como hipotese testavel, experimento cientifico.
- Harry Dry: simplicidade extrema, hierarquia clara, "un-ignorable factor".
- Luke Sullivan: insight humano por tras do visual.
- Jon Loomer: performance criativa Meta. O que funciona feed vs stories vs reels.
- Todd Malicoat: visual storytelling em alta conversao.

# PSICOLOGIA VISUAL (fundamento)
Gestalt aplicado:
- Figura-fundo: elemento principal precisa destacar sem esforco visual
- Proximidade: relacionados juntos, nao-relacionados separados
- Contraste: sem contraste nao ha hierarquia. Sem hierarquia o olho nao sabe por onde comecar
- Simplicidade: cerebro prefere interpretacao mais simples. Complexidade visual mata conversao

Psicologia das cores:
- Laranja/dourado: energia, urgencia, acao, confianca sem formalidade
- Preto: autoridade, premium, peso, contraste maximo
- Branco: respiracao, clareza, espaco para o olho descansar
- Vermelho: urgencia extrema. Usar com parcimonia, so em escassez real
- Azul: confianca, estabilidade

Hierarquia de leitura no feed:
1. Imagem / elemento principal -> 0 a 0.3s
2. Headline -> 0.3 a 0.8s
3. Suporte / entregaveis -> 0.8 a 1.5s
4. CTA / badge -> 1.5s+
Se o lead nao parou ate o headline, os entregaveis nao existem.

# REGRA EXPERT POR TEMPERATURA (criticissima)
FRIO: expert FORA do criativo.
- Ninguem para pra ver foto de quem nao conhece
- Visual de alta interrupcao: dor ou curiosidade
- Pattern interruption agressivo: tipografia bold, contraste extremo, imagem provoca
- Use: mockups, ilustracoes, dados, cenarios que espelham a dor
- Evite absolutamente: foto do expert, logo grande, nome do produto em destaque
- O lead precisa se ver no criativo, nao ver o expert

MORNO: expert entra como autoridade.
- Lead ja viu a marca. Expert posiciona como referencia
- Olho na camera, postura solida, sem sorriso exagerado
- Combine presenca do expert com dado/resultado visivel
- Use: foto + numero de alunos, depoimento com resultado, bastidores de evento

QUENTE: expert e o centro.
- Lead ja conhece, ja considerou, quase comprou. Expert fecha a venda.
- Foto em destaque maximo: presenca, autoridade, confianca
- Visual focado em urgencia: data, vagas, countdown
- CTA visivel e direto

Regra de ouro: quanto mais frio o publico, menos expert. Quanto mais quente, mais expert.

# PRINCIPIOS VISUAIS UNIVERSAIS
1. Fundo escuro como padrao. Fundo claro so com justificativa (nativo/editorial)
2. Tipografia em peso extremo + hierarquia brutal: 1 headline gigante, suporte 40-60% menor
3. Acento colorido na palavra que converte. Nunca o texto todo colorido
4. Expert em contexto de autoridade (palco, microfone, acao). Nunca estudio sorrindo
5. Dados especificos em destaque ("R$3.187,26" converte mais que "mais de R$3 mil")
6. CTA como botao com contraste maximo. Nunca texto discreto
7. Zero decoracao sem proposito: cada pixel tem funcao (hierarquia, emocao, acao)

# 13 TEMPLATES DA BIBLIOTECA
Escolha pelo OBJETIVO + TEMPERATURA, nao pela estetica.

01 Expert Cinematico (morno/quente): foto em P&B + frase impactante, espaco negativo generoso. Comunica intimidade + autoridade.

02 Editorial Antagonizacao (frio): sanduiche de noticia real (topo) + frase central acentuada em vermelho + noticia (base). Bordas rasgadas. CTA verde/laranja. Sem foto de pessoa. O lead para porque parece noticia.

03 Metafora de Dor (frio/morno): texto topo (40%) + imagem dramatica (60%) que comunica problema em 0.3s. Headline em 3 atos: positivo passado + virada negativa + solucao implicita.

04 Mascote/Ilustracao (frio): sem expert, ilustracao limpa, 2-3 cores. Quebra padrao de foto no feed.

05 Expert em Cena (morno): expert no palco com microfone, holofotes, dado em laranja, CTA urgente. "Esse cara faz, nao so fala".

06 Stack de Beneficios (morno/quente): badge topo (caixa alta) + headline central + pills/bullets com checkmarks. Lead morno responde "o que eu ganho".

07 Painel de Autoridade (morno): 2-4 experts lado a lado + glassmorphism card sobre as fotos + iluminacao dramatica. "A maior X do Brasil".

08 Dado + Expert (morno/quente): split. Expert num lado + numero gigante em acento no outro. Dado ancora credibilidade.

09 Nativo Organico (frio): parece post comum (caixa de pergunta, sticker, story). Logo discreto. Sem CTA gritante. Cerebro processa como conteudo de amigo, nao propaganda.

10 Manifesto Textual (frio/morno): fundo escuro + ZERO graficos + so texto em 3 camadas (acento laranja em dados/perguntas, branco bold em afirmacoes fortes, branco regular em argumentacao). Estrutura PAS. Lead que le 400 palavras esta engajado de verdade.

11 Prova Social Visual (morno/quente): 3-4 screenshots empilhados em cascata + rotacao + sobreposicao + mais screenshots desfocados abaixo (lista parece infinita). Fluxo: prova, afirmacao, acao.

12 Manchete Portal (frio): layout simula portal de noticia (logo, data, categoria, headline serifada, foto, sub-headline cinza). Cuidado: NUNCA use logo de veiculo real (G1, UOL, Exame, Folha) = bloqueio Meta + risco legal. Crie veiculo ficticio crivel. Use dados reais.

13 Comparacao (frio/morno): divisao 50/50 (ANTES/DEPOIS, VOCE/CONCORRENTE, SEM IA/COM IA, ERRADO/CERTO). Lado negativo: escuro, vermelho, caos. Lado positivo: claro ou acento da marca, leveza, alivio. Headline acima unifica.

# REGRAS PROIBIDAS (aprendizado de producao)
- DATAS no criativo invalidam asset rapido. Use referencia generica ("toda terca", "essa semana") em vez de "15/03"
- Marcas de midia REAIS (G1, Exame, Infomoney, UOL, Folha, R7) = bloqueio imediato Meta + risco legal
- "Gratis" ou variacoes = bloqueio Meta + desvaloriza
- Foto do expert: sempre seguir referencia do briefing (foto_referencia em creative_projects). Especificar tracos consistentes ("sem barba", "cabelo curto", etc) pra evitar imagem inconsistente entre criativos
- Manchete falsa com dados inventados: antietico + derruba conta

# BRIEFING DO NEGOCIO (consultar)
Sempre buscar identidade visual do briefing:
- Paleta (primaria, fundo, acento, texto)
- Tipografia preferida
- Foto/logo do expert
- Tom visual (premium, minimalista, divertido, etc)
Nunca propor paleta fora da identidade sem justificativa estrategica explicita.

# GERACAO DE IMAGEM
Modelo padrao: gemini-3-pro-image-preview (Gemini API).
Stories aprovadas uma a uma, nunca em lote.
Advantage+ Creative no Meta: sempre OPT_OUT (pode distorcer identidade).
Estilos diferentes por angulo, nunca mesmo template pra angulos distintos.

# REGRAS DE ESCRITA (OBRIGATORIAS)
- Portugues brasileiro PERFEITO. Sem typos, sem letras inventadas. Conferir cada palavra.
- Sem markdown (nada de **, ##, ###, listas com -, etc) em copy_criativo e prompt_imagem.
- Sem emoji em NENHUM campo.
- Sem em-dash longo (NUNCA usar "—"). Use virgula, ponto, dois-pontos ou parenteses.
- Acentos sempre corretos: negocios so se nao houver acento exigido, caso contrario "negócios".

# CENARIO / FUNDO DO CRIATIVO
Se o briefing trouxer campo "background_descricao", VOCE DEVE usar essa descricao como cenario/fundo do prompt_imagem. Ex: "escritorio moderno com janelas grandes" entra como ambiente onde o expert esta. NAO ignore esse campo.
Se NAO trouxer "background_descricao", use fundo escuro neutro premium #050505 com gradiente sutil.

# REGRAS DE COPY DO CRIATIVO (anti-duplicacao)
Os 4 elementos (badge, headline, headline_destaque, suporte) NUNCA podem repetir o mesmo conceito.
- Badge: contexto curto (3-5 palavras). Extraia do campo "elementos_obrigatorios" ou "angulo" do briefing.
- Headline: gancho com complemento (NAO entra valor monetario, NAO entra duracao). Extraia do campo "gancho" ou "promessa_principal" do briefing.
- Headline_destaque: o NUMERO/RESULTADO concreto unico (entra aqui o valor monetario, prazo, %). Extraia da "promessa_principal" do briefing.
- Suporte: 1 linha de qualificacao (mecanismo + condicao). Extraia do campo "mecanismo" do briefing.
- CTA: verbo de acao, 2-4 palavras. Extraia de "elementos_obrigatorios" do briefing ou crie coerente com o angulo.

REGRA: cada conceito (valor, prazo, mecanismo) aparece em UM unico campo. NUNCA invente dados que nao estao no briefing desta peca.

# REGRAS DE RENDERIZACAO DE TEXTO NA IMAGEM
No campo prompt_imagem, ao instruir o Gemini Image, sempre escreva:
- Renderize o texto EXATAMENTE como fornecido, sem duplicar
- Ortografia pt-BR correta (cuidado com acentos)
- Cada elemento UMA UNICA VEZ na composicao

# SUA SAIDA
Briefing visual completo + prompt de imagem detalhado (min 300 palavras) com:
- Composicao (hierarquia, alinhamento, posicao do texto)
- Lighting (rim light, gradiente, holofote, etc)
- Paleta exata (hex)
- Mood
- Elementos especificos (objetos, ambiente, expressao)
- Estilo fotografico ou de ilustracao

Detalhado o suficiente pra IA gerar sem ambiguidade.

# CHECKLIST DE QUALIDADE (rode antes de entregar)
- Elemento principal para o scroll em 1.7s?
- Hierarquia visual clara (1o imagem, 2o headline, 3o suporte)?
- Visual e copy sao inseparaveis?
- Esse criativo poderia ser de qualquer empresa? Se sim, reescreva
- Paleta respeita identidade do briefing?
- Contraste correto? Texto legivel sem esforco
- CTA visivel sem precisar procurar?

# REGRA FINAL
Design bonito que nao vende e hobby. Design que para o scroll, guia o olho e entrega a promessa, isso e criativo de performance. Faca pra converter.`;

const briefImagemTool = {
  type: "function",
  function: {
    name: "retornar_brief_imagem",
    description: "Retorna briefing visual completo + prompt de imagem detalhado",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        angulo_visual: { type: "string", description: "Nome do angulo (ex: Autoridade, Dor do Operacional, Antagonizacao)" },
        publico: { type: "string", enum: ["frio", "morno", "quente"] },
        template: {
          type: "string",
          enum: [
            "01_expert_cinematico", "02_editorial_antagonizacao", "03_metafora_dor",
            "04_mascote_ilustracao", "05_expert_em_cena", "06_stack_beneficios",
            "07_painel_autoridade", "08_dado_expert", "09_nativo_organico",
            "10_manifesto_textual", "11_prova_social_visual", "12_manchete_portal",
            "13_comparacao"
          ],
        },
        formato: { type: "string", enum: ["feed_1080x1080", "stories_1080x1920", "reels_1080x1920"] },
        emocao: { type: "string", enum: ["aspiracao", "medo", "curiosidade", "urgencia", "indignacao", "alivio"] },
        pattern_interruption: { type: "string", description: "O que vai parar o scroll (1-2 frases)" },
        copy_criativo: {
          type: "object",
          additionalProperties: false,
          properties: {
            badge: { type: "string" },
            headline: { type: "string" },
            headline_destaque: { type: "string" },
            suporte: { type: "string" },
            cta: { type: "string" },
          },
          required: ["badge", "headline", "headline_destaque", "suporte", "cta"],
        },
        prompt_imagem: {
          type: "string",
          description: "Prompt completo pra gerar imagem (Gemini 3 Image, Midjourney, DALL-E). Min 300 palavras. Inclua: composicao, hierarquia visual, lighting, paleta exata, mood, elementos especificos, posicao do texto, estilo fotografico/ilustracao. Detalhado o suficiente pra IA gerar sem ambiguidade.",
        },
        direcao_visual: { type: "string", description: "2-3 linhas explicando porque essa logica visual converte" },
      },
      required: ["angulo_visual", "publico", "template", "formato", "emocao", "pattern_interruption", "copy_criativo", "prompt_imagem", "direcao_visual"],
    },
  },
};

const identidadeEventoTool = {
  type: "function",
  function: {
    name: "retornar_identidade_evento",
    description: "Retorna 3 conceitos de identidade visual (logo + paleta) pra evento",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome_evento: { type: "string" },
        conceitos: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              nome_conceito: { type: "string" },
              logica: { type: "string", description: "O que representa e por que funciona" },
              prompt_logo: { type: "string", description: "Prompt detalhado pra gerar logo via IA" },
              paleta: {
                type: "object",
                additionalProperties: false,
                properties: {
                  primaria: { type: "string", description: "Hex" },
                  fundo: { type: "string", description: "Hex" },
                  acento: { type: "string", description: "Hex" },
                  texto: { type: "string", description: "Hex" },
                },
                required: ["primaria", "fundo", "acento", "texto"],
              },
              tipografia_sugerida: { type: "string" },
            },
            required: ["nome_conceito", "logica", "prompt_logo", "paleta", "tipografia_sugerida"],
          },
        },
      },
      required: ["nome_evento", "conceitos"],
    },
  },
};

const direcaoCampanhaTool = {
  type: "function",
  function: {
    name: "retornar_direcao_campanha",
    description: "Retorna direcao criativa completa pra uma campanha (multiplos criativos por temperatura)",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome_campanha: { type: "string" },
        angulo_dominante: { type: "string", description: "Angulo visual que vai guiar a campanha" },
        criativos_planejados: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              nome: { type: "string" },
              publico: { type: "string", enum: ["frio", "morno", "quente"] },
              template: { type: "string" },
              formato: { type: "string", enum: ["feed_1080x1080", "stories_1080x1920", "reels_1080x1920", "feed+stories"] },
              hipotese_teste: { type: "string", description: "O que estamos testando com esse criativo" },
            },
            required: ["nome", "publico", "template", "formato", "hipotese_teste"],
          },
        },
        ordem_de_teste: { type: "string", description: "Qual subir primeiro e por que" },
      },
      required: ["nome_campanha", "angulo_dominante", "criativos_planejados", "ordem_de_teste"],
    },
  },
};

const TOOLS_BY_TIPO: Record<string, { tool: any; nome: string }> = {
  brief_imagem: { tool: briefImagemTool, nome: "retornar_brief_imagem" },
  identidade_evento: { tool: identidadeEventoTool, nome: "retornar_identidade_evento" },
  direcao_campanha: { tool: direcaoCampanhaTool, nome: "retornar_direcao_campanha" },
};

async function callGateway(apiKey: string, messages: any[], tool: any, toolName: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages, tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });
  if (!response.ok) {
    console.error("gateway error:", response.status, (await response.text()).slice(0, 300));
    return null;
  }
  const data = await response.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try { return JSON.parse(args); } catch { return null; }
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getBriefing(admin: any, briefingId?: string) {
  if (briefingId) {
    const { data } = await admin.from("marketing_briefing").select("*").eq("id", briefingId).maybeSingle();
    if (data) return data;
  }
  const { data } = await admin.from("marketing_briefing").select("*").eq("is_default", true).limit(1).maybeSingle();
  return data;
}

function buildContext(briefing: any, briefingInput: Record<string, unknown>): string {
  const partes = [];
  if (briefing) {
    partes.push(`# NEGOCIO (contexto geral da marca)
Empresa: ${briefing.empresa}
Produto: ${briefing.produto_servico}
Publico: ${briefing.publico_perfil}
Identidade visual obrigatoria: ${JSON.stringify(briefing.identidade_visual)}
Palavras BANIDAS: ${JSON.stringify(briefing.palavras_banidas)}`);
  }
  if (briefingInput && Object.keys(briefingInput).length) {
    const bi = briefingInput as any;
    partes.push(`# BRIEFING DESTA PECA (OBRIGATORIO - USE ESTES DADOS, NAO INVENTE OUTROS)
ATENCAO: Os campos abaixo sao os UNICOS dados que voce deve usar pra gerar copy e prompt de imagem.
NAO use exemplos do system prompt (como "R$5K a R$15K/mes", "90 dias", "GARANTA SUA VAGA", "Salvador") a menos que esses valores aparecam EXPLICITAMENTE nos campos abaixo.
Se um campo estiver vazio, CRIE conteudo coerente com o angulo e promessa, mas NUNCA copie dos exemplos do system prompt.

Objetivo: ${bi.objetivo ?? ""}
Temperatura: ${bi.publico_temperatura ?? ""}
Formato: ${bi.formato ?? ""}
Template sugerido: ${bi.template_sugerido ?? ""}
Angulo: ${bi.angulo ?? ""}
Promessa principal: ${bi.promessa_principal ?? ""}
Dor do publico: ${bi.publico_dor ?? ""}
Mecanismo / diferencial: ${bi.mecanismo ?? ""}
Gancho de copy: ${bi.gancho ?? ""}
Expert no criativo: ${bi.expert_no_criativo ?? false}
Descricao do expert: ${bi.expert_descricao ?? ""}
Elementos obrigatorios no design: ${bi.elementos_obrigatorios ?? ""}
Cenario / fundo: ${bi.background_descricao ?? ""}`);
  }
  return partes.join("\n\n");
}

// ============================================================
// GEMINI IMAGE - geracao real de imagem (modelo gemini-3-pro-image-preview)
// ============================================================

async function getGeminiKey(admin: any): Promise<string | null> {
  const { data } = await admin
    .from("integration_keys")
    .select("api_key, is_active")
    .eq("service", "gemini")
    .maybeSingle();
  if (!data?.api_key || data.is_active === false) return null;
  return data.api_key;
}

type ReferenceImage = { mimeType: string; data: string; label?: string };

async function generateGeminiImage(
  apiKey: string,
  prompt: string,
  referenceImages?: ReferenceImage[],
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4",
): Promise<{ image_url?: string; image_base64?: string; error?: string }> {
  // Endpoint: generateContent com modelo de imagem
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

  // Multi-image input: Gemini 3 Image aceita varias inlineData parts pra cada
  // tipo de referencia (rosto do expert, layout/estilo de inspiracao, etc).
  // Cada uma vem precedida de uma label textual pra o modelo saber o papel.
  //
  // Aceita 2 formatos por defesa em profundidade:
  // - {data, mimeType} (canonico no backend)
  // - {base64, mime} (formato que o frontend antigo usava por acidente)
  const parts: any[] = [{ text: prompt }];
  for (const img of referenceImages ?? []) {
    const rawData = (img as any)?.data ?? (img as any)?.base64;
    const rawMime = (img as any)?.mimeType ?? (img as any)?.mime ?? "image/jpeg";
    if (!rawData) continue;
    const bareData = rawData.includes(",") ? rawData.split(",")[1] : rawData;
    if (img.label) {
      parts.push({ text: `[REFERENCIA: ${img.label}]` });
    }
    parts.push({
      inlineData: {
        mimeType: rawMime,
        data: bareData,
      },
    });
  }

  const generationConfig: Record<string, unknown> = { responseModalities: ["IMAGE"] };
  if (aspectRatio) {
    generationConfig.imageConfig = { aspectRatio };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("gemini image error:", response.status, errText.slice(0, 400));
    return { error: errText.slice(0, 300) };
  }

  const json = await response.json();
  const respParts = json?.candidates?.[0]?.content?.parts ?? [];
  const inline = respParts.find((p: any) => p.inlineData?.data)?.inlineData;
  if (inline?.data) {
    return { image_base64: `data:${inline.mimeType ?? "image/png"};base64,${inline.data}` };
  }
  return { error: "no image in response" };
}

// ============================================================
// FACE SWAP via Replicate
// Gemini 3 Image preview NAO preserva identidade. Solucao: gera com Gemini
// e depois roda face swap pra trocar o rosto pelo real do expert.
// Modelo: cdingram/face-swap. Custa ~$0.01/swap, ~10s.
// ============================================================

async function getReplicateToken(admin: any): Promise<string | null> {
  const { data } = await admin
    .from("integration_keys")
    .select("api_key, is_active")
    .eq("service", "replicate")
    .maybeSingle();
  if (!data?.api_key || data.is_active === false) return null;
  return data.api_key;
}

async function faceSwapReplicate(
  generatedImageBase64: string, // imagem gerada pelo Gemini (com rosto inventado)
  faceImageBase64: string,      // foto real do expert
  replicateToken: string,
): Promise<{ ok: boolean; image_base64?: string; error?: string }> {
  // Garantir data: prefix (Replicate aceita data URI)
  const ensurePrefix = (b: string, mime = "image/jpeg") =>
    b.startsWith("data:") ? b : `data:${mime};base64,${b}`;

  // Cria prediction
  // version do cdingram/face-swap (latest estavel em 05/2026)
  const VERSION = "d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111";

  const createResp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${replicateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: VERSION,
      input: {
        input_image: ensurePrefix(generatedImageBase64, "image/png"),
        swap_image: ensurePrefix(faceImageBase64, "image/jpeg"),
      },
    }),
  });

  const createJson = await createResp.json();
  if (!createResp.ok || createJson.error) {
    return {
      ok: false,
      error: createJson.detail ?? createJson.error ?? `HTTP ${createResp.status}`,
    };
  }

  // Polling (max 60s)
  const getUrl = createJson.urls?.get;
  if (!getUrl) return { ok: false, error: "Sem URL de polling" };

  let result = createJson;
  for (let i = 0; i < 60; i++) {
    if (result.status === "succeeded") break;
    if (result.status === "failed" || result.status === "canceled") {
      return { ok: false, error: result.error ?? "swap falhou" };
    }
    await new Promise((r) => setTimeout(r, 1000));
    const pollResp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${replicateToken}` },
    });
    result = await pollResp.json();
  }

  if (result.status !== "succeeded") {
    return { ok: false, error: `timeout (status: ${result.status})` };
  }

  // Output pode vir como URL string ou array
  const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!outputUrl || typeof outputUrl !== "string") {
    return { ok: false, error: "Output invalido do Replicate" };
  }

  // Download e converte pra base64
  try {
    const imgResp = await fetch(outputUrl);
    if (!imgResp.ok) return { ok: false, error: `Download falhou: ${imgResp.status}` };
    const buf = await imgResp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Base64 encode em chunks pra evitar stack overflow
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    const mime = imgResp.headers.get("content-type") ?? "image/png";
    return { ok: true, image_base64: `data:${mime};base64,${b64}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ============================================================
// REMOVE BACKGROUND via Replicate (rembg model)
// ============================================================

async function handleRemoveBackground(body: any): Promise<any> {
  const { image_base64, image_mime } = body;
  if (!image_base64) return { success: false, error: "image_base64 obrigatorio", status: 400 };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const token = await getReplicateToken(admin);
  if (!token) return { success: false, error: "Token Replicate nao configurado", status: 400 };

  const ensurePrefix = (b: string, mime = "image/png") =>
    b.startsWith("data:") ? b : `data:${mime};base64,${b}`;

  const VERSION = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003";

  const createResp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      version: VERSION,
      input: { image: ensurePrefix(image_base64, image_mime || "image/png") },
    }),
  });

  const createJson = await createResp.json();
  if (!createResp.ok || createJson.error) {
    return { success: false, error: createJson.detail ?? createJson.error ?? `HTTP ${createResp.status}` };
  }

  const getUrl = createJson.urls?.get;
  if (!getUrl) return { success: false, error: "Sem URL de polling" };

  let result = createJson;
  for (let i = 0; i < 90; i++) {
    if (result.status === "succeeded") break;
    if (result.status === "failed" || result.status === "canceled") {
      return { success: false, error: result.error ?? "rembg falhou" };
    }
    await new Promise((r) => setTimeout(r, 1000));
    const pollResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    result = await pollResp.json();
  }

  if (result.status !== "succeeded") {
    return { success: false, error: `timeout (${result.status})` };
  }

  const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!outputUrl || typeof outputUrl !== "string") {
    return { success: false, error: "Output invalido" };
  }

  try {
    const imgResp = await fetch(outputUrl);
    if (!imgResp.ok) return { success: false, error: `Download falhou: ${imgResp.status}` };
    const buf = await imgResp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    return { success: true, image_base64: `data:image/png;base64,${b64}` };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ============================================================
// ANALYZE REFERENCE: engenharia reversa de uma imagem de inspiracao via
// Gemini Vision (gemini-2.5-flash). Retorna analise estruturada de
// composicao, iluminacao, lente, paleta, copy visivel etc.
// ============================================================
async function analyzeReferenceImage(
  apiKey: string,
  image: ReferenceImage,
): Promise<{ ok: boolean; analysis?: any; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const bareData = image.data.includes(",") ? image.data.split(",")[1] : image.data;

  const analyzePrompt = `Voce e especialista em engenharia reversa de imagens publicitarias.
Analise a imagem anexada como se fosse construir um briefing pra recriar o estilo (NAO o conteudo) em outro criativo.

Retorne JSON com EXATAMENTE essa estrutura, sem mais nada antes ou depois:

{
  "composicao": "string descrevendo regra dos tercos, framing, distribuicao de elementos, hierarquia visual",
  "iluminacao": "string descrevendo esquema de luz (rim, key, fill), direcao, intensidade, temperatura de cor",
  "lente_provavel": "string com tipo de lente, abertura aproximada, distorcao",
  "profundidade_campo": "string descrevendo bokeh, foco seletivo, plano fundo",
  "paleta_hex": ["#xxxxxx","#xxxxxx","#xxxxxx","#xxxxxx"],
  "tipografia": "string descrevendo familia (serif/sans), peso, hierarquia, alinhamento",
  "estilo_geral": "string: editorial vogue | corporate | cyberpunk | film still | luxury | streetwear | etc",
  "tratamento": "string descrevendo pos producao, contraste, grain, lift shadows, color grading",
  "mood": "string capturando atmosfera",
  "cenario_fundo": "string descrevendo background, ambiente, textura",
  "copy_visivel": {
    "badge": "string ou null",
    "headline": "string ou null",
    "headline_destaque": "string ou null (palavras com cor diferente)",
    "suporte": "string ou null",
    "cta": "string ou null",
    "outros_textos": "string ou null"
  },
  "dna_visual": "string de 2-3 linhas resumindo o DNA visual desse criativo pra ser replicado em outro contexto"
}

Importante: NAO copie textos exatos, descreva o estilo. Para copy_visivel: extraia o que estiver escrito na imagem como referencia (NAO vamos copiar literal, mas saber o que tem nos ajuda a manter estrutura).`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: analyzePrompt },
            { inlineData: { mimeType: image.mimeType || "image/jpeg", data: bareData } },
          ],
        }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    const json = await r.json();
    if (!r.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${r.status}` };
    }
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: "Sem resposta do analyzer" };
    try {
      return { ok: true, analysis: JSON.parse(text) };
    } catch {
      return { ok: false, error: "Resposta nao e JSON valido", analysis: text as any };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function handleAnalyzeReference(payload: { image_base64: string; image_mime?: string }) {
  if (!payload.image_base64) return { success: false, error: "image_base64 obrigatorio", status: 400 };
  const admin = adminClient();
  const apiKey = await getGeminiKey(admin);
  if (!apiKey) return { success: false, error: "Gemini nao configurada", status: 400 };

  const r = await analyzeReferenceImage(apiKey, {
    data: payload.image_base64,
    mimeType: payload.image_mime ?? "image/jpeg",
  });
  if (!r.ok) return { success: false, error: r.error, status: 502 };
  return { success: true, analysis: r.analysis };
}

// ============================================================
// ANALYZE EXPERT: descreve o sujeito da foto pra usar como
// expert_descricao no briefing. Foco em rosto, traços, roupa, pose.
// ============================================================
async function analyzeExpertPhoto(
  apiKey: string,
  image: ReferenceImage,
): Promise<{ ok: boolean; description?: string; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const bareData = image.data.includes(",") ? image.data.split(",") [1] : image.data;

  const prompt = `Voce e especialista em descrever pessoas pra reproducao fiel em outras fotos.
Analise o sujeito principal da foto e retorne descricao OBJETIVA em UM unico paragrafo corrido (sem listas), focando em:

- Genero, etnia, idade aparente
- Formato e estrutura do rosto (oval, redondo, anguloso)
- Tom e textura da pele
- Cabelo (cor, comprimento, corte, estilo)
- Barba/bigode (presenca, formato, comprimento, aparado)
- Olhos (cor se visivel)
- Roupas vestidas (peca, cor exata, estilo)
- Pose corporal (em pe, sentado, bracos cruzados, gesticulando, etc)
- Expressao facial (sorriso, serio, focado)
- Acessorios visiveis (oculos, relogio, microfone)

Retorne APENAS o paragrafo descritivo, sem prefacios. Comece com o genero/idade. Maximo 200 palavras.
Essa descricao vai virar instrucao pra que outra IA gere imagens DESSE MESMO sujeito em cenarios diferentes, mantendo identidade fiel.`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: image.mimeType || "image/jpeg", data: bareData } },
          ],
        }],
      }),
    });
    const json = await r.json();
    if (!r.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${r.status}` };
    }
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: "Sem resposta" };
    return { ok: true, description: text.trim() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function handleAnalyzeExpert(payload: { image_base64: string; image_mime?: string }) {
  if (!payload.image_base64) return { success: false, error: "image_base64 obrigatorio", status: 400 };
  const admin = adminClient();
  const apiKey = await getGeminiKey(admin);
  if (!apiKey) return { success: false, error: "Gemini nao configurada", status: 400 };
  const r = await analyzeExpertPhoto(apiKey, {
    data: payload.image_base64,
    mimeType: payload.image_mime ?? "image/jpeg",
  });
  if (!r.ok) return { success: false, error: r.error, status: 502 };
  return { success: true, description: r.description };
}

// ============================================================
// Constroi prompt FINAL pro Gemini Image com:
// - prompt original (gerado pelo brief AI)
// - bloco rigido de PRESERVACAO DE IDENTIDADE quando tem foto expert
// - blueprint visual da imagem de inspiracao (style_analysis)
// - mood futurista quando solicitado
// - negative prompts
// ============================================================
function buildFinalImagePrompt(opts: {
  basePrompt: string;
  hasExpertPhoto: boolean;
  styleAnalysis?: any;
  moodVisual?: string;
  preserveIdentity?: boolean;
}): string {
  const parts: string[] = [];

  if (opts.preserveIdentity && opts.hasExpertPhoto) {
    parts.push(`# PRESERVACAO DE IDENTIDADE (CRITICO)
A imagem anexada como "Foto do expert" mostra o sujeito EXATO que deve aparecer no criativo final.
Voce DEVE manter, sem qualquer alteracao:
- Formato e proporcoes do rosto
- Cor da pele, tom, textura
- Tracos faciais (olhos, nariz, boca, sobrancelhas)
- Barba, bigode, costeleta
- Cabelo (cor, comprimento, estilo)
- Idade aparente
- Estrutura ossea e maxilar

Reproduza o rosto da foto de referencia com fidelidade 100%, como se fosse o mesmo individuo fotografado de novo em outro cenario.
NAO troque a pessoa. NAO invente novo rosto. NAO interprete livremente.
Se voce alterar QUALQUER traco facial, o criativo sera INUTIL e descartado.`);
  }

  if (opts.styleAnalysis) {
    const a = opts.styleAnalysis;
    parts.push(`# BLUEPRINT VISUAL DE REFERENCIA
Use exatamente esse DNA visual pra construir o criativo (NAO copie texto nem rostos da inspiracao, apenas a linguagem visual):

- Composicao: ${a.composicao ?? "n/d"}
- Iluminacao: ${a.iluminacao ?? "n/d"}
- Lente provavel: ${a.lente_provavel ?? "n/d"}
- Profundidade de campo: ${a.profundidade_campo ?? "n/d"}
- Paleta: ${Array.isArray(a.paleta_hex) ? a.paleta_hex.join(", ") : "n/d"}
- Tipografia: ${a.tipografia ?? "n/d"}
- Estilo: ${a.estilo_geral ?? "n/d"}
- Tratamento/pos: ${a.tratamento ?? "n/d"}
- Mood: ${a.mood ?? "n/d"}
- Cenario/fundo: ${a.cenario_fundo ?? "n/d"}

DNA visual resumido: ${a.dna_visual ?? "n/d"}`);
  }

  if (opts.moodVisual) {
    parts.push(`# ATMOSFERA E MOOD VISUAL
${opts.moodVisual}`);
  }

  parts.push(`# PROMPT BASE DO CRIATIVO
${opts.basePrompt}`);

  parts.push(`# NEGATIVE PROMPTS (EVITE ABSOLUTAMENTE)
- Maos deformadas, dedos a mais ou a menos, dedos fundidos
- Olhos assimetricos, desalinhados, pupilas estranhas
- Blur facial ou desfoque em areas importantes
- Anatomia distorcida, pescoco esticado, ombros tortos
- Pele plastica, excessivamente suave, aparencia artificial de IA
- Expressao facial congelada ou artificial
- Rosto que nao bata com a foto de referencia
- Texto distorcido, letras quebradas, palavras sem sentido (renderize texto SEMPRE legivel)
- Marcas falsas reconheciveis (G1, Globo, Exame, UOL, Folha)
- Datas ou horarios no criativo`);

  return parts.join("\n\n");
}

async function handleGenerateImage(payload: {
  output_id?: string;
  prompt?: string;
  reference_image_base64?: string;
  reference_image_mime?: string;
  reference_images?: ReferenceImage[];
  aspect_ratio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  style_analysis?: any;
  mood_visual?: string;
  preserve_identity?: boolean;
}) {
  const admin = adminClient();
  const apiKey = await getGeminiKey(admin);
  if (!apiKey) {
    return {
      success: false,
      error: "Gemini nao configurada. Adicione api_key em integration_keys (service=gemini).",
      status: 400,
    };
  }

  let prompt = payload.prompt;
  let outputRow: any = null;

  if (payload.output_id) {
    const { data } = await admin.from("marketing_ai_outputs").select("*").eq("id", payload.output_id).maybeSingle();
    if (!data) return { success: false, error: "output not found", status: 404 };
    outputRow = data;
    prompt = prompt ?? data.resultado?.prompt_imagem ?? data.resultado?.conceitos?.[0]?.prompt_logo;
  }

  if (!prompt) return { success: false, error: "prompt required", status: 400 };

  // Aceita reference_images (array novo, multi-imagem) ou reference_image_base64 (legado, 1 imagem).
  const refImgs: ReferenceImage[] = payload.reference_images && payload.reference_images.length > 0
    ? payload.reference_images
    : payload.reference_image_base64
      ? [{ mimeType: payload.reference_image_mime ?? "image/jpeg", data: payload.reference_image_base64 }]
      : [];

  const hasExpertPhoto = refImgs.some((r) => (r.label ?? "").toLowerCase().includes("expert"));

  const finalPrompt = buildFinalImagePrompt({
    basePrompt: prompt,
    hasExpertPhoto,
    styleAnalysis: payload.style_analysis,
    moodVisual: payload.mood_visual,
    preserveIdentity: payload.preserve_identity ?? true,
  });

  const img = await generateGeminiImage(apiKey, finalPrompt, refImgs, payload.aspect_ratio);
  if (img.error || !img.image_base64) {
    return { success: false, error: img.error ?? "image generation failed", status: 500 };
  }

  if (outputRow) {
    const novoResultado = { ...outputRow.resultado, image_base64: img.image_base64, prompt_used: prompt };
    await admin.from("marketing_ai_outputs").update({ resultado: novoResultado }).eq("id", outputRow.id);
  }

  return {
    success: true,
    image_base64: img.image_base64,
    output_id: outputRow?.id,
  };
}

async function handleGenerate(payload: {
  tipo: string;
  briefing: Record<string, unknown>;
  session_id?: string;
  initiative_id?: string;
  briefing_id?: string;
  auto_generate_image?: boolean;
  reference_image_base64?: string;
  reference_image_mime?: string;
  reference_images?: ReferenceImage[];
  aspect_ratio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  style_analysis?: any;
  mood_visual?: string;
  preserve_identity?: boolean;
  face_swap?: boolean; // se true e tiver Replicate token + foto expert, faz swap pos-geracao
  simple_mode?: boolean; // se true, manda apenas o prompt_imagem cru + foto inline (modo inicial)
}) {
  const { tipo, briefing: briefingInput } = payload;
  const toolDef = TOOLS_BY_TIPO[tipo];
  if (!toolDef) return { success: false, error: `tipo invalido: ${tipo}`, status: 400 };

  const admin = adminClient();
  const briefing = await getBriefing(admin, payload.briefing_id);

  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  if (!apiKey) return { success: false, error: "LOVABLE_API_KEY missing", status: 500 };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContext(briefing, briefingInput) },
    { role: "user", content: `Gere ${tipo}. REGRA CRITICA: use EXCLUSIVAMENTE os dados do "BRIEFING DESTA PECA" acima (angulo, promessa, dor, mecanismo, gancho, elementos obrigatorios). NAO copie exemplos do system prompt. Se o briefing diz "Venda mais, reduza custo", o criativo fala disso, NAO de "R$5K a R$15K/mes" ou "90 dias". Respeite regras visuais e identidade do briefing.` },
  ];

  const result = await callGateway(apiKey, messages, toolDef.tool, toolDef.nome);
  if (!result) return { success: false, error: "AI failed", status: 500 };

  const { data: output, error } = await admin
    .from("marketing_ai_outputs")
    .insert({
      session_id: payload.session_id ?? null,
      initiative_id: payload.initiative_id ?? null,
      agent: "criativo",
      tipo,
      titulo: (result as any).angulo_visual ?? (result as any).nome_evento ?? (result as any).nome_campanha ?? `Criativo ${tipo}`,
      briefing: briefingInput,
      resultado: result,
      raw_text: JSON.stringify(result, null, 2),
      status: "gerado",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message, status: 500 };

  // Auto-gera imagem se pedido + tiver Gemini configurado.
  // Aceita reference_image_base64 pra image-to-image (preserva rosto, postura, marca visual).
  let imageData: { image_base64?: string } = {};
  if (payload.auto_generate_image && (result as any).prompt_imagem) {
    const apiKey = await getGeminiKey(admin);
    if (apiKey) {
      const refImgs: ReferenceImage[] = payload.reference_images && payload.reference_images.length > 0
        ? payload.reference_images
        : payload.reference_image_base64
          ? [{ mimeType: payload.reference_image_mime ?? "image/jpeg", data: payload.reference_image_base64 }]
          : [];

      const hasExpertPhoto = refImgs.some((r) => (r.label ?? "").toLowerCase().includes("expert"));

      // Regras de renderizacao de TEXTO no Gemini Image:
      // 1. NAO duplicar (problema comum do gemini-3-pro-image-preview com texto longo)
      // 2. Ortografia pt-BR correta (modelo inventa letras: "NEGARCIOS" em vez de "NEGOCIOS")
      // 3. Cada elemento de copy aparece UMA UNICA VEZ na composicao
      const copyData = (result as any).copy_criativo ?? {};
      const textRenderingRules = `\n\n# REGRAS CRITICAS DE RENDERIZACAO DE TEXTO (OBRIGATORIO)
- Renderize TODO o texto EXATAMENTE como escrito. Sem duplicar frases ou palavras.
- Cada elemento aparece UMA UNICA VEZ: badge ${copyData.badge ? `("${copyData.badge}")` : ""}, headline ${copyData.headline ? `("${copyData.headline}")` : ""}, destaque ${copyData.headline_destaque ? `("${copyData.headline_destaque}")` : ""}, suporte, CTA ${copyData.cta ? `("${copyData.cta}")` : ""}.
- Se algum elemento for longo, quebre em multiplas linhas mas NUNCA repita.
- Ortografia portugues do Brasil correta. NUNCA invente letras nem omita acentos. Palavras criticas: "negócios" (com acento e Ç), "vender" (com E), "transformação", "presencial".
- Se houver valores monetarios, use cifrao R$ e formato consistente (NAO escreva "5 mil" se o copy diz "R$5K").
- Renderize APENAS o texto que aparece no copy_criativo acima. NAO adicione texto extra que nao esta nos campos.
- Verifique cada palavra escrita antes de finalizar.`;

      // Modo simples (default): manda apenas o prompt_imagem cru + foto inline.
      // Eh como o projeto comecou e dava resultado mais fiel ao rosto.
      // Modo rigoroso (opcional): envelopa em blocos de identity preservation,
      // blueprint visual, negative prompts. Util com card de inspiracao.
      const basePrompt = ((result as any).prompt_imagem ?? "") + textRenderingRules;
      const finalPrompt = payload.simple_mode
        ? basePrompt
        : buildFinalImagePrompt({
            basePrompt,
            hasExpertPhoto,
            styleAnalysis: payload.style_analysis,
            moodVisual: payload.mood_visual,
            preserveIdentity: payload.preserve_identity ?? true,
          });

      const img = await generateGeminiImage(apiKey, finalPrompt, refImgs, payload.aspect_ratio);
      if (img.image_base64) {
        let finalImageB64 = img.image_base64;
        let faceSwapInfo: any = { attempted: false };

        // FACE SWAP pos-geracao: se pedido, tem token Replicate e foto do expert
        const expertRef = refImgs.find((r) => (r.label ?? "").toLowerCase().includes("expert"));
        if (payload.face_swap && expertRef) {
          const replicateToken = await getReplicateToken(admin);
          if (!replicateToken) {
            faceSwapInfo = {
              attempted: true,
              skipped: true,
              reason: "Token Replicate nao configurado. Adicione em /admin/configuracoes (service=replicate).",
            };
          } else {
            const swap = await faceSwapReplicate(img.image_base64, expertRef.data, replicateToken);
            if (swap.ok && swap.image_base64) {
              finalImageB64 = swap.image_base64;
              faceSwapInfo = { attempted: true, success: true };
            } else {
              faceSwapInfo = { attempted: true, success: false, error: swap.error };
            }
          }
        }

        imageData = { image_base64: finalImageB64 };
        const novoResultado = {
          ...result,
          image_base64: finalImageB64,
          image_base64_pre_swap: payload.face_swap ? img.image_base64 : undefined,
          face_swap_info: faceSwapInfo,
        };
        await admin.from("marketing_ai_outputs").update({ resultado: novoResultado }).eq("id", output.id);
      }
    }
  }

  return { success: true, output_id: output.id, resultado: { ...result, ...imageData } };
}

// ============================================================
// REFINE: pega criativo ja gerado e redesenha com olhar de
// diretor de arte senior, eliminando estetica de IA.
// ============================================================

const REFINE_PROMPT = `Voce recebeu um anuncio digital gerado por IA. Redesenhe essa peca como se fosse produzida por um estudio de design de Sao Paulo que cobra R$15.000 por campanha. O resultado precisa ser indistinguivel de uma peca feita no Photoshop por um humano.

# DIAGNOSTICO: O QUE DELATA IA (elimine TUDO isso)
Pele plastica sem poros, textura de boneco de cera. Corrija: adicione textura real de pele, poros visiveis em close, micro-imperfeicoes naturais, sombras suaves sob os olhos.
Iluminacao flat e uniforme sem direcao. Corrija: use iluminacao direcional com key light a 45 graus, fill sutil no lado oposto, rim light sutil separando sujeito do fundo.
Fundo generico com gradiente artificial. Corrija: fundo com profundidade real, bokeh fotografico natural (circulos irregulares, nao perfeitos), ou ambiente real desfocado com textura.
Tipografia renderizada como textura (letras fundidas na imagem). Corrija: texto com bordas crisp, tracking consistente, alinhamento perfeito, como se fosse layer separada no Photoshop.
Simetria perfeita demais no rosto. Corrija: micro-assimetrias naturais, um lado do rosto levemente diferente.
Cores saturadas demais ou dessaturadas uniformemente. Corrija: color grading cinematografico com shadows puxando pra azul/teal e highlights puxando pra laranja/amber (split toning).
Objetos flutuando sem sombra de contato. Corrija: todo elemento solido tem shadow de contato suave.
Excesso de elementos decorativos (sparkles, linhas, icones). Corrija: REMOVA 80% dos enfeites. Cada pixel precisa ter funcao.

# PRODUCAO FOTOGRAFICA (como um fotografo faria)
Sujeito humano: pele com textura real, micro-detalhes (poros, linhas de expressao finas, textura do tecido da roupa visivel). Cabelo com fios individuais visiveis na borda, nao massa solida.
Iluminacao: key light direcional criando sombras suaves mas definidas. Catchlight nos olhos (reflexo da fonte de luz). Rim light separando sujeito do fundo.
Profundidade: sujeito em foco critico, fundo com desfoque progressivo natural (nao blur uniforme, mas bokeh com formas).
Color grading: tons de pele quentes e naturais. Pretos profundos sem ser esmagados (lift nos shadows de +5 a +10). Highlights controlados sem clipar.

# LAYOUT E COMPOSICAO (como um designer senior faria)
Grid: use regra dos tercos. Sujeito nunca centralizado perfeitamente, leve deslocamento cria dinamismo.
Espaco negativo: MINIMO 25% da area total deve ser espaco vazio. Esse respiro e o que separa design premium de amador.
Hierarquia tipografica em 3 niveis APENAS:
  Nivel 1 (headline): peso Black ou Extra Bold, tamanho dominante, ocupa 30-40% da largura
  Nivel 2 (suporte): peso Regular ou Light, 40% do tamanho do headline, cor com 70% de opacidade
  Nivel 3 (CTA): botao solido com cantos arredondados 8px, padding generoso, contraste maximo com o fundo
Alinhamento: TUDO alinhado a esquerda OU a direita. Nunca misture. Centralizado so no CTA.
Margem: padding interno MINIMO de 48px em stories (9:16) ou 32px em feed (1:1).

# TIPOGRAFIA CONCRETA
Fonte do headline: sans-serif geometrica grossa (como Montserrat Black, Inter Black, ou Clash Display Bold). NUNCA serifada. NUNCA script/cursiva.
Tracking do headline: -2% a -4% (apertado, premium).
Fonte do suporte: mesma familia, peso Light ou Regular.
CTA: mesma familia, peso Bold, caixa alta, letterspacing +5%.
Cor do texto principal: branco #FFFFFF se fundo escuro, preto #0A0A0A se fundo claro. NUNCA cinza medio.
Destaque: UMA palavra ou frase em cor acento (dourado #FAC800, laranja #FF6B00, ou azul #2563EB). Resto monocromatico.

# PALETA ESPECIFICA
Fundo escuro premium: #0A0A0A a #1A1A1A (NUNCA preto puro #000000, fica flat). Gradiente sutil radial com +5% de luminosidade no centro.
Fundo claro premium: #F5F5F0 (off-white quente), NUNCA branco puro #FFFFFF.
Cor acento: UMA unica cor vibrante usada em no maximo 15% da area. Dourado #FAC800 pra premium, laranja #FF6B00 pra urgencia, azul #2563EB pra confianca.
Pele: tons quentes naturais, NUNCA desaturada, NUNCA com cast rosa ou verde.
Sombras no fundo: puxando pra azul escuro #0D1117, nao pra preto puro.

# COMPOSICAO DO CTA
Botao solido com cantos arredondados (8-12px radius).
Background do botao na cor acento em full opacity.
Texto do botao em preto #0A0A0A se botao claro, branco #FFFFFF se botao escuro.
Padding interno generoso: 16px vertical, 32px horizontal minimo.
Posicao: terco inferior da peca, centralizado horizontalmente.
Shadow sutil no botao: 0 4px 12px rgba(cor_acento, 0.3).

# TRATAMENTO FINAL (pos-producao)
Adicione grain fotografico sutil (ISO 400-800 equivalent, nao exagerado) pra quebrar a perfeicao digital.
Vinheta suave nos cantos (escurecimento de 10-15% nas bordas).
Contraste levemente aumentado (+10-15% de contraste).
Sharpening seletivo no sujeito e no texto (nao no fundo).
NUNCA: glow, lens flare artificial, sparkles, confete, bordas brilhantes, neon.

# O QUE FARIA UM DESIGNER COBRAR R$15K
Simplicidade radical. Poucos elementos, cada um perfeito.
Espaco vazio e intencional, nao acidental.
Foto parece editorial de revista, nao stock photo.
Tipografia tem personalidade mas e legivel em 0.3 segundo.
A peca inteira tem no maximo 3 cores.
O olho sabe exatamente pra onde ir primeiro, segundo e terceiro.
Parece que alguem passou 8 horas ajustando cada detalhe, nao 8 segundos gerando.`;

async function handleRefine(payload: {
  output_id?: string;
  image_base64?: string;
  aspect_ratio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  copy_criativo?: { badge?: string; headline?: string; headline_destaque?: string; suporte?: string; cta?: string };
  custom_instructions?: string;
}) {
  const admin = adminClient();
  const apiKey = await getGeminiKey(admin);
  if (!apiKey) {
    return { success: false, error: "Gemini nao configurada", status: 400 };
  }

  let imageB64 = payload.image_base64;
  let outputRow: any = null;
  let aspectRatio = payload.aspect_ratio;
  let copyData = payload.copy_criativo;

  if (payload.output_id) {
    const { data } = await admin.from("marketing_ai_outputs").select("*").eq("id", payload.output_id).maybeSingle();
    if (!data) return { success: false, error: "output not found", status: 404 };
    outputRow = data;
    if (!imageB64) imageB64 = data.resultado?.image_base64;
    if (!aspectRatio) {
      const br = data.briefing as any;
      aspectRatio = br?.aspect_ratio;
    }
    if (!copyData) copyData = data.resultado?.copy_criativo;
  }

  if (!imageB64) return { success: false, error: "Sem imagem pra refinar", status: 400 };

  const parts: string[] = [REFINE_PROMPT];

  if (copyData) {
    parts.push(`\n\nTEXTOS QUE DEVEM APARECER NA PECA FINAL (mantenha esses textos, redesenhe o visual):
- Badge: ${copyData.badge ?? "(sem badge)"}
- Headline: ${copyData.headline ?? ""} ${copyData.headline_destaque ?? ""}
- Suporte: ${copyData.suporte ?? ""}
- CTA: ${copyData.cta ?? ""}

Renderize esses textos EXATAMENTE como escritos. Ortografia pt-BR correta. Cada elemento UMA UNICA VEZ.`);
  }

  if (payload.custom_instructions) {
    parts.push(`\n\nINSTRUCOES ADICIONAIS DO USUARIO:\n${payload.custom_instructions}`);
  }

  parts.push(`\n\nAGORA: redesenhe a imagem anexada seguindo TODAS as diretrizes acima. Entregue uma nova versao profissional, moderna, publicitaria, bem diagramada, com bom respiro, boa tipografia, hierarquia clara, contraste elegante e sem cara de IA.`);

  const finalPrompt = parts.join("");

  const bareData = imageB64.includes(",") ? imageB64.split(",")[1] : imageB64;
  const refImgs: ReferenceImage[] = [{
    data: bareData,
    mimeType: "image/png",
    label: "Criativo original a ser refinado/redesenhado",
  }];

  const img = await generateGeminiImage(apiKey, finalPrompt, refImgs, aspectRatio);
  if (img.error || !img.image_base64) {
    return { success: false, error: img.error ?? "Falha gerando imagem refinada", status: 500 };
  }

  if (outputRow) {
    const novoResultado = {
      ...outputRow.resultado,
      image_base64_pre_refine: outputRow.resultado?.image_base64,
      image_base64: img.image_base64,
      refined: true,
      refined_at: new Date().toISOString(),
    };
    await admin.from("marketing_ai_outputs").update({ resultado: novoResultado }).eq("id", outputRow.id);
  }

  return {
    success: true,
    image_base64: img.image_base64,
    output_id: outputRow?.id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action ?? "generate";
    let result: any;
    if (action === "generate") result = await handleGenerate(body);
    else if (action === "generate_image") result = await handleGenerateImage(body);
    else if (action === "analyze_reference") result = await handleAnalyzeReference(body);
    else if (action === "analyze_expert") result = await handleAnalyzeExpert(body);
    else if (action === "remove_background") result = await handleRemoveBackground(body);
    else if (action === "refine") result = await handleRefine(body);
    else result = { success: false, error: "unknown action", status: 400 };
    const status = result.status ?? (result.success ? 200 : 500);
    delete result.status;
    return new Response(JSON.stringify(result), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("marketing-criativo error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
