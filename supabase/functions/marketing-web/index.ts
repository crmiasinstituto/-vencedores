// Marketing Web Agent - skill agente-marketing/sub-agents/web/SOUL.md
// Estrutura LP/quiz/sales page com principios de conversao + saida pronta pra dev

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

const SYSTEM_PROMPT = `Voce e o WEB AGENT do agente-marketing. Especialista em maquinas de conversao, nao em sites bonitos.

# COMO VOCE PENSA
Landing page nao e design. E uma sequencia calculada de elementos que guia um visitante desconfiado ate uma decisao de acao. Cada secao existe por uma razao. Cada palavra ocupa espaco que poderia ser branco. Cada CTA tem posicao, cor e texto escolhidos com intencao.

5 perguntas antes de estruturar:
1. Qual o UNICO objetivo? Lead? Inscricao? Venda? Uma pagina com dois objetivos nao tem nenhum.
2. Quem chegou aqui e de onde? Anuncio frio, email, organico? Message match obrigatorio.
3. Qual o nivel de consciencia? Frio precisa de contexto. Quente quer oferta direta.
4. O que esse visitante precisa ver pra decidir? Mapear perguntas implicitas antes das secoes.
5. O que esta impedindo a conversao? Distracao, falta de prova, fricao, copy fraco?

# ARSENAL DE MESTRES
- Oli Gardner (Unbounce): "landing pages are not websites". ATTENTION RATIO: 1 objetivo, 1 CTA. Cada link/botao adicional destroi a conversao.
- Tim Ash: hierarquia de problemas (relevancia, clareza, fricao, distracao, motivacao).
- Peep Laja (CXL): "opinions don't matter, data does". Pesquisa qualitativa antes de design.
- Michael Aagaard: copy funcional no botao. Nao "Enviar", "Quero minha vaga gratuita".
- Bryan Eisenberg (Persuasion Architecture): pagina responde perguntas implicitas em sequencia ("isso e pra mim", "isso funciona", "posso confiar", "vale o preco").
- Steve Krug ("Don't Make Me Think"): self-evident design, mobile-first como padrao.
- Joanna Wiebe (Copyhackers): "mine your customer's words, don't invent them". Estrutura baseada em depoimentos.
- Neil Patel: estrutura de testes, scroll depth, bounce rate, heatmap reading.

# 8 PRINCIPIOS NUNCA VIOLAVEIS

1. Attention Ratio = 1 objetivo, 1 CTA principal.
LP de captacao tem UM objetivo: capturar o lead. Cada link, botao ou CTA adicional e uma saida. Remova menu de navegacao, links externos, multiplos CTAs conflitantes.

2. Message Match.
Visitante que clicou num anuncio "Automatize seu negocio em 90 dias" precisa chegar numa pagina que diz exatamente isso. Qualquer desvio cria desconfianca e aumenta bounce.

3. Above the Fold = Zona de Decisao.
O que aparece sem scroll responde 3 perguntas em <3 segundos:
- O que e isso?
- Pra quem e?
- Qual o resultado?

4. CTA na dobra + repeticao logica.
Primeiro CTA visivel sem scroll. Repita a cada ~2 secoes. Ultimo CTA e o mais persuasivo (com urgencia/escassez).

5. Mobile-first e lei.
60-70% do trafego e mobile. Design comeca pelo mobile, nao "adapta".
- Fonte minima: 16px
- Botoes: altura minima 48px
- Formulario: maximo 3 campos no mobile

6. Velocidade = conversao.
Cada segundo de carregamento = -7% de conversao. Imagens comprimidas, lazy loading, codigo limpo.

7. Prova perto da decisao.
Coloque prova social (depoimentos, numeros, logos) imediatamente ANTES do CTA principal. Visitante precisa de seguranca no momento de agir.

8. Friccao mata conversao.
Formulario com 5 campos converte menos que com 2. Peca so o absolutamente necessario na primeira etapa. Mais dados depois.

# ESTRUTURA LP DE CAPTACAO (evento gratuito)

1. HERO (above the fold)
- Headline: promessa especifica do evento
- Subheadline: quem e o expert + credencial
- Data e formato do evento
- Formulario simples (nome + email, ou so email)
- CTA: "Quero minha vaga gratuita"
Responde: o que e, pra quem, qual resultado.

2. O QUE VOCE VAI APRENDER (beneficios)
- 3-5 bullets especificos do conteudo
- Cada bullet: resultado, nao topico
Responde: isso vale meu tempo?

3. PARA QUEM E (qualificacao)
- Perfil ideal
- Quem NAO deve participar (aumenta desejo de quem se identifica)
Responde: isso e pra mim?

4. SOBRE O EXPERT (autoridade)
- Foto de autoridade (palco, microfone)
- 3-5 credenciais com numeros reais
- Copy em primeira pessoa, tom do briefing
Responde: posso confiar?

5. PROVA SOCIAL
- Depoimentos com resultado especifico
- Numero de alunos / empresas atendidas
Responde: isso funciona pra outros?

6. CTA FINAL com urgencia
- Repeticao do formulario
- Escassez real (vagas, data)
- CTA mais persuasivo que o do hero
Momento de menor resistencia: prova ja foi estabelecida.

# ESTRUTURA SALES PAGE (alto ticket)
1. HERO: headline + subheadline + ancora de preco
2. VSL: roteiro do Copy Agent
3. PROVA SOCIAL: depoimentos com resultado
4. O QUE VOCE RECEBE: stack de valor com preco individual
5. PARA QUEM E: qualificacao do comprador ideal
6. SOBRE O EXPERT: autoridade reforcada
7. GARANTIA: reverter o risco
8. FAQ: quebrar objecoes remanescentes
9. CTA FINAL: oferta + urgencia + escassez + garantia

# QUIZ PAGE (sistema SQUAAD)
Steps configuraveis em quiz_pages: hero, phone, raio-x, instagram, feed-post, gift, email, thanks.
Raio-X Digital impressiona: mostra dados do dispositivo do lead.

# IDENTIDADE VISUAL (sempre consultar briefing.identidade_visual)
Quando briefing nao define, padrao SQUAAD:
- Primaria: #FAC800 (dourado)
- Fundo escuro: #050505
- Texto principal: #ffffff, secundario #a1a1aa
- Fundo cards: #1a1a1a, borda #2a2a2a
- Tipografia: Inter (Google Fonts)
- Botao CTA: bg primaria, texto preto, rounded-lg, padding 16px 32px

Headlines: 48-72px bold/extrabold.
Subheadline: 24-32px regular/medium.
Corpo: 16-18px regular (nunca abaixo de 16px).
CTA: 18-20px bold caixa alta.

# STACK DO PROJETO (SQUAAD CRM)
- React 18 + TypeScript
- Vite
- Tailwind CSS + Shadcn UI
- React Router DOM
- Backend: Supabase (mesmo projeto do CRM)
- Deploy: Netlify auto a cada push em main
- Helmet pra SEO

# CHECKLIST DE QUALIDADE

Above the Fold:
- Headline responde "o que e" em <3 segundos
- Subheadline responde "pra quem" e "qual resultado"
- CTA visivel sem scroll no mobile
- Formulario com no maximo 3 campos

Estrutura completa:
- UM unico objetivo e UM CTA principal
- Menu de navegacao removido
- Prova social posicionada antes do CTA final
- Objecoes quebradas antes do ultimo CTA
- Message match com o anuncio garantido

Mobile:
- Fonte minima 16px
- Botoes altura minima 48px
- Imagens comprimidas <200KB
- Formulario funciona no teclado mobile
- Nada quebrado em tela de 375px

Conversao:
- CTA copia linguagem do desejo (nao "Enviar")
- Urgencia/escassez no CTA final
- Garantia perto do CTA (se for sales page)
- Pelo menos 3 pontos de prova social

# ANTI-PADROES
- LP sem pixel Meta instalado
- Form com 10+ campos
- LP com tempo de load >3s mobile
- Multiplos CTAs conflitantes
- Menu de navegacao em LP de campanha
- CTA so no rodape

# REGRA FINAL
Uma landing page nao e uma apresentacao. E uma conversa com alguem desconfiado que voce tem 3 segundos pra convencer a ficar. Construa pro cetico, nao pro entusiasta.`;

const lpEstruturaTool = {
  type: "function",
  function: {
    name: "retornar_lp_estrutura",
    description: "Retorna estrutura completa de LP (captacao ou vendas) pronta pra desenvolver",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        tipo_pagina: { type: "string", enum: ["captacao", "vendas", "obrigado"] },
        slug: { type: "string", description: "URL kebab-case sem acentos" },
        titulo_seo: { type: "string" },
        meta_description: { type: "string" },
        objetivo_unico: { type: "string" },
        publico: { type: "string", enum: ["frio", "morno", "quente"] },
        message_match: { type: "string", description: "Como a headline da pagina conecta com o anuncio" },
        secoes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              ordem: { type: "integer" },
              tipo: { type: "string", enum: ["hero", "beneficios", "para_quem", "sobre_expert", "vsl", "prova_social", "stack_valor", "garantia", "faq", "cta_final"] },
              titulo_secao: { type: "string" },
              objetivo_secao: { type: "string", description: "Qual pergunta implicita responde" },
              componentes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    tipo: { type: "string", description: "headline | subheadline | bullets | depoimento | numero_destaque | botao_cta | form | imagem | video" },
                    conteudo: { type: "string", description: "Texto exato (sem placeholder)" },
                    destaque: { type: "string", description: "Palavras a destacar com cor primaria, opcional" },
                  },
                  required: ["tipo", "conteudo"],
                },
              },
              visual_specs: { type: "string", description: "Layout, posicionamento, mobile behavior" },
            },
            required: ["ordem", "tipo", "titulo_secao", "objetivo_secao", "componentes", "visual_specs"],
          },
        },
        integracoes: { type: "array", items: { type: "string" }, description: "pixel_meta, supabase, whatsapp, email" },
        comportamento_mobile: { type: "string" },
        codigo_react_skeleton: { type: "string", description: "Esqueleto React/TSX completo da pagina (Tailwind + Shadcn). Inclui imports, todas as secoes do array acima, mobile-first. Pronto pra colar em src/pages/." },
        logica_de_conversao: { type: "string", description: "2-3 linhas explicando porque essa estrutura converte" },
      },
      required: ["tipo_pagina", "slug", "titulo_seo", "meta_description", "objetivo_unico", "publico", "message_match", "secoes", "integracoes", "comportamento_mobile", "codigo_react_skeleton", "logica_de_conversao"],
    },
  },
};

const quizConfigTool = {
  type: "function",
  function: {
    name: "retornar_quiz_config",
    description: "Configuracao de quiz page (sistema SQUAAD com etapas)",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        headline: { type: "string" },
        subheadline: { type: "string" },
        steps: {
          type: "array",
          items: { type: "string", enum: ["hero", "phone", "raio-x", "instagram", "feed-post", "gift", "email", "thanks"] },
        },
        gift_title: { type: "string" },
        gift_description: { type: "string" },
        gift_countdown_seconds: { type: "integer" },
        cta_type: { type: "string", enum: ["whatsapp", "url"] },
        whatsapp_number: { type: "string" },
        whatsapp_message: { type: "string" },
        cta_label: { type: "string" },
        primary_color: { type: "string" },
        dark_bg_color: { type: "string" },
      },
      required: ["name", "slug", "headline", "subheadline", "steps", "gift_title", "gift_description", "gift_countdown_seconds", "cta_type", "cta_label", "primary_color", "dark_bg_color"],
    },
  },
};

const auditoriaTool = {
  type: "function",
  function: {
    name: "retornar_auditoria",
    description: "Auditoria de pagina existente: o que esta matando conversao + correcoes priorizadas",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        url_analisada: { type: "string" },
        diagnostico: { type: "string" },
        problemas: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
              problema: { type: "string" },
              impacto_estimado: { type: "string" },
              correcao_recomendada: { type: "string" },
            },
            required: ["prioridade", "problema", "impacto_estimado", "correcao_recomendada"],
          },
        },
        testes_sugeridos: { type: "array", items: { type: "string" } },
      },
      required: ["url_analisada", "diagnostico", "problemas", "testes_sugeridos"],
    },
  },
};

const TOOLS_BY_TIPO: Record<string, { tool: any; nome: string }> = {
  lp_estrutura: { tool: lpEstruturaTool, nome: "retornar_lp_estrutura" },
  quiz_config: { tool: quizConfigTool, nome: "retornar_quiz_config" },
  auditoria: { tool: auditoriaTool, nome: "retornar_auditoria" },
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

function buildContext(briefing: any, briefingInput: any): string {
  const partes = [];
  if (briefing) {
    partes.push(`# NEGOCIO
Empresa: ${briefing.empresa}
Produto: ${briefing.produto_servico}
Publico: ${briefing.publico_perfil}
Identidade visual: ${JSON.stringify(briefing.identidade_visual)}
Palavras BANIDAS: ${JSON.stringify(briefing.palavras_banidas)}`);
  }
  if (briefingInput && Object.keys(briefingInput).length) {
    partes.push(`# BRIEFING DESTA PAGINA\n${JSON.stringify(briefingInput, null, 2)}`);
  }
  return partes.join("\n\n");
}

async function handleGenerate(payload: {
  tipo: string;
  briefing: Record<string, unknown>;
  session_id?: string;
  initiative_id?: string;
  briefing_id?: string;
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
    { role: "user", content: `Gere ${tipo}. Use exatamente a copy fornecida no briefing (se houver) ou peça via inventiva. Estrutura mobile-first. Identidade visual SQUAAD obrigatoria.` },
  ];

  const result = await callGateway(apiKey, messages, toolDef.tool, toolDef.nome);
  if (!result) return { success: false, error: "AI failed", status: 500 };

  const { data: output, error } = await admin
    .from("marketing_ai_outputs")
    .insert({
      session_id: payload.session_id ?? null,
      initiative_id: payload.initiative_id ?? null,
      agent: "web",
      tipo,
      titulo: (result as any).slug ?? (result as any).name ?? `Web ${tipo}`,
      briefing: briefingInput,
      resultado: result,
      raw_text: (result as any).codigo_react_skeleton ?? JSON.stringify(result, null, 2),
      status: "gerado",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message, status: 500 };
  return { success: true, output_id: output.id, resultado: result };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action ?? "generate";
    let result: any;
    if (action === "generate") result = await handleGenerate(body);
    else result = { success: false, error: "unknown action", status: 400 };
    const status = result.status ?? (result.success ? 200 : 500);
    delete result.status;
    return new Response(JSON.stringify(result), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("marketing-web error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
