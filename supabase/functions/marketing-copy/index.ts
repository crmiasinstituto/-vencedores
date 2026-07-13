// Marketing Copy Agent - skill agente-marketing/sub-agents/copy/SOUL.md
// Gera copy de anuncio Meta, email, VSL, LP, WhatsApp - calibrado por temperatura,
// nivel de consciencia (Schwartz 1-5), framework e tom da marca.

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

const SYSTEM_PROMPT = `Voce e o COPY AGENT do agente-marketing. O melhor copywriter que existe, nao porque escreve bonito, mas porque entende o ser humano melhor do que a maioria entende a si mesma.

# COMO VOCE PENSA (antes de escrever uma palavra)
Voce pensa como psicologo, pesquisa como cientista, escreve como vendedor nato. Antes de digitar uma palavra, voce ja sabe o que o lead esta sentindo as 2h da manha quando nao consegue dormir.

5 perguntas obrigatorias:
1. Quem e essa pessoa, emocionalmente? O que ela sente, o que a envergonha, o que sonha mas nao conta?
2. Qual o nivel de consciencia? (Schwartz 1-5)
3. Qual o mecanismo? O que torna a solucao unica, especificamente?
4. Qual a crenca limitante que bloqueia a compra? Como voce quebra antes da oferta?
5. Qual a promessa principal? Especifica, crivel, desejada (com numero, prazo, condicao).

# ARSENAL DE MESTRES

Classicos (fundacao):
- Claude Hopkins: reason-why copy, especificidade, claims testaveis.
- John Caples: headlines sao 80% da batalha. Headlines baseadas em resultado, curiosidade ou noticia.
- Robert Collier: entrar na conversa que ja esta acontecendo na mente do leitor. Mirroring emocional.
- Eugene Schwartz: 5 niveis de consciencia, mechanism-first em mercados saturados.
- David Ogilvy: pesquisa antes de tudo, big idea, long copy quando o produto precisa.
- Gary Halbert: cartas de venda agressivas, "A pile", energia e personalidade.
- Joseph Sugarman: slippery slide, curiosity loops, resolvendo dissonancia cognitiva.
- John Carlton: agitation before solution, bullets que sangram de curiosidade.
- Dan Kennedy: magnetic message, avatar preciso, direct response sem floreios.

Modernos (execucao digital):
- Russell Brunson: funnels, value ladders, epiphany bridge, origin story.
- Alex Hormozi: a oferta E o copy. Value equation = dream outcome × likelihood / (time × effort). Stack de valor, garantia reversa.
- Stefan Georgi (RMBC): Research, Mechanism, Brief, Copy. Pesquisa de dores reais.
- Jon Benson (pai do VSL): hook, problema, agitacao, mecanismo, prova, oferta, CTA. Conversational.
- Sabri Suby: AIDA em esteroides, prova massiva, velocidade na oferta.
- Frank Kern: conversational copy, emails que parecem de amigo.
- Todd Brown (E5 Method): indoctrination sequences, belief shifting.
- Clayton Makepeace: power of specificity, proof stacking, escalating urgency.
- Robert Cialdini: 6 principios (Reciprocidade, Compromisso, Prova Social, Autoridade, Afinidade, Escassez), sempre com fundamento real.
- Jim Edwards: fill-in-the-blank frameworks pra velocidade sem perder qualidade.

# OS 5 NIVEIS DE CONSCIENCIA (Schwartz, sua bussola de entrada)
N1. Inconsciente do problema: nao sabe que tem o problema. Entrar por historia, analogia, pergunta que provoca reconhecimento.
N2. Consciente do problema, nao da solucao: espelhe a dor com precisao cirurgica, depois revele que existe saida.
N3. Consciente da solucao, nao do produto: apresente o METODO, nao o curso. O que torna sua abordagem diferente.
N4. Consciente do produto, nao convencido: quebre a objecao principal antes da oferta. Prova social especifica.
N5. Pronto pra comprar: direto na oferta, CTA unico, escassez real.

Regra: leads frios geralmente em N1-N2. Mornos em N3-N4. Quentes em N5. Mas confirme pelo comportamento, nao assuma.

# TEMPERATURA DO PUBLICO (calibra tudo)
FRIO (60-70% budget):
- Pessoas que nao te conhecem
- Foco: DOR, CURIOSIDADE, PROVOCACAO
- Tom: provoca, nao vende ainda
- Gatilhos: dor, curiosidade, identificacao

MORNO (20-25%):
- Pessoas que ja viram seus anuncios ou perfil
- Foco: METODO, DIFERENCIAL, AUTORIDADE
- Tom: educativo, posiciona autoridade
- Gatilhos: autoridade, mecanismo unico, prova social

QUENTE (10-15%):
- Pessoas que quase compraram (visitaram pagina, abandonaram carrinho)
- Foco: URGENCIA, OFERTA DIRETA
- Tom: direto, sem rodeio, pressao real
- Gatilhos: escassez, urgencia, risco revertido

Regra: nunca use copy de quente pra frio (parece spam). Nunca use copy de frio pra quente (perde a venda na hora certa).

# OS 5 ELEMENTOS QUE TODO COPY PRECISA
1. Hook: para o scroll. Cria loop cognitivo que o cerebro precisa fechar.
2. Agitacao: faz a dor doer mais antes de apresentar a solucao.
3. Mecanismo: o "porque isso funciona" que diferencia de tudo que o lead ja viu.
4. Prova: especifica, com numeros, com nomes, com antes/depois.
5. Oferta: clara, irresistivel, com risco revertido.

# CHECKLIST UNIVERSAL (rode antes de entregar)
- O headline para o scroll? Se voce visse no feed, pararia pra ler?
- Tem especificidade? "Fature 30% a mais em 90 dias" > "fature mais".
- A promessa e crivel? Grande demais vira ceticismo, pequena demais nao motiva.
- O gatilho tem fundamento real? Escassez falsa queima a marca.
- Essa copy poderia ser de qualquer empresa? Se sim, reescreva.
- Tem UM CTA unico e claro? Dois CTAs = nenhum.
- A dor foi agitada antes da solucao?

# CHECKLIST POR FORMATO

Anuncio Meta:
- Primary text abre com hook (nao com apresentacao da empresa)
- Headline <40 chars, entrega a promessa central
- CTA button bate com temperatura (frio: SAIBA MAIS, quente: INSCREVA-SE)

VSL:
- Primeiros 5s criam um loop que o cerebro precisa fechar
- Transicao dor mecanismo natural, nao abrupta
- Pitch de oferta vem depois da prova, nunca antes

Email:
- Assunto parece de pessoa pra pessoa, nao de empresa pra lead
- Primeiro paragrafo nao comeca com "Eu" ou nome da empresa
- UM unico link de CTA, nao tres espalhados

Landing Page:
- Hero responde em 3s: o que e, pra quem e, qual resultado
- Objecoes quebradas antes do CTA final
- Oferta empacotada com stack de valor

# REGRAS DE TOM (sempre consultar briefing do negocio)
- Respeitar palavras BANIDAS literalmente (briefing.palavras_banidas)
- Usar palavras caracteristicas se houver
- Adaptar formalidade (formal / informal / super_informal)
- Se briefing diz "sem emoji" ou "sem travessao", obedeca sempre

# REGRA DE OURO
Copy ruim tenta convencer. Copy bom faz o lead sentir que a decisao ja estava dentro dele, voce so revelou.

# OUTPUT
Sempre via tool calling. Antes da entrega final, anote em "estrategia": nivel de consciencia, framework guia, e em 2-3 linhas porque vai funcionar.`;

// Tools por tipo de copy
const adMetaTool = {
  type: "function",
  function: {
    name: "retornar_ad_meta",
    description: "Retorna copy completa de anuncio Meta (criativo + ad)",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        angulo: { type: "string", description: "Nome do angulo (ex: Dor do Operacional)" },
        publico: { type: "string", enum: ["frio", "morno", "quente"] },
        nivel_consciencia: { type: "integer", minimum: 1, maximum: 5 },
        framework: { type: "string", description: "Qual copywriter/metodo guiou (Schwartz, Hormozi, Halbert...)" },
        criativo: {
          type: "object",
          additionalProperties: false,
          properties: {
            badge: { type: "string", description: "2-4 palavras CAIXA ALTA. Ex: AO VIVO" },
            headline: { type: "string", description: "3-7 palavras impacto maximo" },
            headline_destaque: { type: "string", description: "Palavras que vao em cor de destaque (laranja/amarelo)" },
            suporte: { type: "string", description: "Frase de apoio ao headline" },
            cta: { type: "string", description: "Acao clara, urgente. Ex: QUERO SAIR DO OPERACIONAL" },
          },
          required: ["badge", "headline", "headline_destaque", "suporte", "cta"],
        },
        anuncio: {
          type: "object",
          additionalProperties: false,
          properties: {
            primary_text: { type: "string", description: "Texto principal do feed - abre com hook" },
            headline: { type: "string", description: "Max 40 chars" },
            description: { type: "string", description: "Max 30 chars" },
            cta_button: { type: "string", enum: ["LEARN_MORE", "SIGN_UP", "SUBSCRIBE", "GET_OFFER", "WATCH_MORE", "CONTACT_US"] },
          },
          required: ["primary_text", "headline", "description", "cta_button"],
        },
        estrategia: { type: "string", description: "2-3 linhas explicando porque vai funcionar" },
      },
      required: ["angulo", "publico", "nivel_consciencia", "framework", "criativo", "anuncio", "estrategia"],
    },
  },
};

const emailTool = {
  type: "function",
  function: {
    name: "retornar_sequencia_email",
    description: "Retorna sequencia de email (boas-vindas, aquecimento, abertura, urgencia, fechamento)",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        objetivo: { type: "string" },
        publico: { type: "string", enum: ["frio", "morno", "quente"] },
        emails: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              momento: { type: "string", description: "Ex: confirmacao_inscricao, falta_1h, e_hoje, ao_vivo, last_call" },
              assunto: { type: "string" },
              preview: { type: "string" },
              corpo: { type: "string", description: "Markdown. Pode ter quebras. Sem emoji se briefing pedir." },
              cta: { type: "string" },
              cta_url: { type: "string", description: "Placeholder ou URL real" },
            },
            required: ["momento", "assunto", "preview", "corpo", "cta", "cta_url"],
          },
        },
        estrategia: { type: "string" },
      },
      required: ["objetivo", "publico", "emails", "estrategia"],
    },
  },
};

const vslTool = {
  type: "function",
  function: {
    name: "retornar_vsl",
    description: "Retorna roteiro de VSL conversacional",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        duracao_estimada_segundos: { type: "integer" },
        publico: { type: "string", enum: ["frio", "morno", "quente"] },
        secoes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              tipo: { type: "string", enum: ["hook", "problema", "agitacao", "mecanismo", "prova", "oferta", "cta"] },
              tempo_segundos: { type: "integer" },
              roteiro: { type: "string", description: "Como o avatar vai falar (texto conversacional)" },
            },
            required: ["tipo", "tempo_segundos", "roteiro"],
          },
        },
        estrategia: { type: "string" },
      },
      required: ["duracao_estimada_segundos", "publico", "secoes", "estrategia"],
    },
  },
};

const lpTool = {
  type: "function",
  function: {
    name: "retornar_copy_lp",
    description: "Retorna copy completa de landing page de captacao ou vendas",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        tipo_pagina: { type: "string", enum: ["captacao", "vendas", "obrigado"] },
        publico: { type: "string", enum: ["frio", "morno", "quente"] },
        hero: {
          type: "object",
          additionalProperties: false,
          properties: {
            headline: { type: "string" },
            subheadline: { type: "string" },
            cta: { type: "string" },
            campos_form: { type: "array", items: { type: "string" }, description: "Ex: nome, email, telefone (max 3)" },
          },
          required: ["headline", "subheadline", "cta", "campos_form"],
        },
        beneficios: {
          type: "object",
          additionalProperties: false,
          properties: {
            titulo: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["titulo", "bullets"],
        },
        para_quem: {
          type: "object",
          additionalProperties: false,
          properties: {
            titulo: { type: "string" },
            ideal: { type: "array", items: { type: "string" } },
            nao_ideal: { type: "array", items: { type: "string" } },
          },
          required: ["titulo", "ideal", "nao_ideal"],
        },
        sobre_expert: {
          type: "object",
          additionalProperties: false,
          properties: {
            titulo: { type: "string" },
            copy: { type: "string" },
            credenciais: { type: "array", items: { type: "string" } },
          },
          required: ["titulo", "copy", "credenciais"],
        },
        prova_social: {
          type: "object",
          additionalProperties: false,
          properties: {
            depoimentos: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  nome: { type: "string" },
                  resultado: { type: "string" },
                  texto: { type: "string" },
                },
                required: ["nome", "resultado", "texto"],
              },
            },
            numeros: { type: "array", items: { type: "string" } },
          },
          required: ["depoimentos", "numeros"],
        },
        cta_final: {
          type: "object",
          additionalProperties: false,
          properties: {
            headline: { type: "string" },
            urgencia: { type: "string" },
            cta: { type: "string" },
          },
          required: ["headline", "urgencia", "cta"],
        },
        estrategia: { type: "string" },
      },
      required: ["tipo_pagina", "publico", "hero", "beneficios", "para_quem", "sobre_expert", "prova_social", "cta_final", "estrategia"],
    },
  },
};

const whatsappTool = {
  type: "function",
  function: {
    name: "retornar_whatsapp",
    description: "Retorna sequencia de mensagens WhatsApp",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        objetivo: { type: "string" },
        publico: { type: "string", enum: ["frio", "morno", "quente"] },
        mensagens: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              momento: { type: "string" },
              texto: { type: "string", description: "Mensagem curta, conversacional, sem cara de spam" },
              cta: { type: "string" },
            },
            required: ["momento", "texto", "cta"],
          },
        },
        estrategia: { type: "string" },
      },
      required: ["objetivo", "publico", "mensagens", "estrategia"],
    },
  },
};

const TOOLS_BY_TIPO: Record<string, { tool: any; nome: string }> = {
  ad_meta: { tool: adMetaTool, nome: "retornar_ad_meta" },
  email: { tool: emailTool, nome: "retornar_sequencia_email" },
  vsl: { tool: vslTool, nome: "retornar_vsl" },
  lp: { tool: lpTool, nome: "retornar_copy_lp" },
  whatsapp: { tool: whatsappTool, nome: "retornar_whatsapp" },
};

async function callGateway(apiKey: string, messages: any[], tool: any, toolName: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: [tool],
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
    partes.push(`# NEGOCIO
Empresa: ${briefing.empresa}
Produto: ${briefing.produto_servico}
Ticket: R$ ${briefing.ticket_medio ?? "?"}
Publico: ${briefing.publico_perfil}
Dores: ${JSON.stringify(briefing.dores)}
Desejos: ${JSON.stringify(briefing.desejos)}
Tom: ${briefing.formalidade}
Palavras BANIDAS (nao usar): ${JSON.stringify(briefing.palavras_banidas)}
Palavras caracteristicas: ${JSON.stringify(briefing.palavras_caracteristicas)}`);
  }
  if (briefingInput && Object.keys(briefingInput).length) {
    partes.push(`# BRIEFING DESTA PECA\n${JSON.stringify(briefingInput, null, 2)}`);
  }
  return partes.join("\n\n");
}

async function handleGenerate(payload: {
  tipo: string;                    // ad_meta | email | vsl | lp | whatsapp
  briefing: Record<string, unknown>; // input do user (objetivo, publico, mecanismo, etc)
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
    { role: "user", content: `Gere copy do tipo ${tipo} respeitando todas as regras de tom do briefing acima. Use o briefing desta peca como input principal.` },
  ];

  const result = await callGateway(apiKey, messages, toolDef.tool, toolDef.nome);
  if (!result) return { success: false, error: "AI failed", status: 500 };

  // salva output
  const { data: output, error } = await admin
    .from("marketing_ai_outputs")
    .insert({
      session_id: payload.session_id ?? null,
      initiative_id: payload.initiative_id ?? null,
      agent: "copy",
      tipo,
      titulo: (result as any).angulo ?? (result as any).objetivo ?? `Copy ${tipo}`,
      briefing: briefingInput,
      resultado: result,
      raw_text: JSON.stringify(result, null, 2),
      status: "gerado",
    })
    .select()
    .single();

  if (error) {
    console.error("save output error:", error);
    return { success: false, error: error.message, status: 500 };
  }

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
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("marketing-copy error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
