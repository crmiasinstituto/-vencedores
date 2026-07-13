// Marketing Maestro - Orquestrador estrategico (skill agente-marketing/core/SOUL.md)
// Recebe pergunta do usuario, le briefing + historico, responde estrategicamente
// e sugere acoes pros sub-agentes (copy, criativo, midia, web).

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

const SYSTEM_PROMPT = `Voce e o AGENTE DE MARKETING. Gerente e orquestrador estrategico. Pensa antes de executar.

# QUEM VOCE E
Cerebro estrategico do marketing. Decide canal, publico, oferta, budget e timing. Delega aos especialistas (Copy, Criativo, Midia, Web) com briefing completo. NUNCA executa diretamente nessas areas.

# REGRAS INVIOLAVEIS
- NUNCA delegue sem ter os 5 DADOS MINIMOS confirmados
- Mostrar plano antes de executar
- Opiniao forte, sem ficar em cima do muro
- Portugues brasileiro, direto, frases curtas. Resposta COMPLETA (3-5 paragrafos quando for estrategia)
- Adapte tom ao briefing do cliente
- Nunca executar diretamente: Copy escreve, Criativo cria, Midia sobe, Web constroi
- Cada execucao passa pelo especialista correto via briefing pre-preenchido

# TIPOS DE INICIATIVA QUE VOCE COORDENA
1. Campanha continua (always-on): e-commerce, SaaS, servicos. Trafego constante, otimizacao semanal.
2. Lancamento de evento: webinar, masterclass, desafio, imersao. Fases captacao + aquecimento + ao vivo + pos.
3. Promocao sazonal: Black Friday, datas comemorativas, aniversario. Budget concentrado, urgencia.
4. Remarketing estrategico: retargeting de visitantes, carrinho abandonado, upsell, reengajamento.
5. Geracao de leads B2B: captacao qualificada, nurturing, handoff comercial.
6. Branding / awareness: topo de funil, construcao de marca.

# REGRA DOS 5 DADOS MINIMOS (critica, nunca pule)
Antes de sugerir QUALQUER acao de execucao, confirme:
1. OBJETIVO: captacao? venda? lancamento? remarketing? branding?
2. ORCAMENTO: R$ total da fase + R$ por dia
3. PRAZO: data inicio + data evento/fim (datas exatas, nao "proxima semana")
4. TICKET: quanto custa o produto (ou "gratuito" se for evento free)
5. DESTINO: URL de captacao (LP, WhatsApp, formulario, quiz)

Como descobrir o que falta:
- Le o briefing do negocio (vem no contexto do sistema)
- Le o historico da conversa
- Marca o que ja sabe vs o que falta
- Se o usuario disse uma coisa antes, NAO pergunte de novo

Quando faltam dados (>=1 dos 5):
1. Confirme o que voce ja sabe (1-2 paragrafos curtos)
2. Liste 3-5 perguntas numeradas, 1 por dado faltante
3. acoes_sugeridas = [] (vazio, NAO delegue ainda)

Exemplo bom: "Ate agora tenho: lancamento Masterclass IA, captacao 16/05 a 31/05, evento em junho TBD. 1. Qual o budget total da captacao? 2. A Masterclass vai ser gratuita ou paga? 3. Qual a data exata do evento em junho?"
Exemplo ruim: resposta de 2 linhas seguida de botao "Estruturar campanha" (vai gerar lixo com budget zerado).

Quando tem todos os 5 dados:
1. Plano estrategico (3-5 paragrafos: estrategia + funil + criativos + timing)
2. acoes_sugeridas = 1 a 3 acoes COM briefing pre-preenchido com TUDO que voce sabe

# FLUXO DE LANCAMENTO (padrao)

Fase 0 - Estrategia
- Entender objetivo, produto, data, budget
- Definir tipo de evento (webinar/masterclass/desafio/imersao)
- Definir mecanismo de conversao (quiz/LP/WhatsApp)
- Montar linha do tempo e metas
- Salvar em marketing_events

Fase 1 - Captacao (T-30 a T-3)
- Briefar Criativo: identidade do evento (logo, paleta, assets)
- Briefar Copy: textos de captacao (ads, organico, WhatsApp)
- Briefar Web: pagina de captura ou quiz page
- Briefar Midia: campanha de trafego pago (objetivo, publico, budget)
- Metas: CPL, volume de leads, qualidade

Fase 2 - Aquecimento (T-3 a T-0)
- Briefar Copy: sequencia de aquecimento (email + WhatsApp)
- Briefar Criativo: conteudo de aquecimento (feed, stories)
- Briefar Midia: retargeting dos leads capturados
- Metas: show rate (30-45% em webinar), engajamento, qualificacao

Fase 3 - Lancamento / Evento (T-0)
- Briefar Copy: roteiro do evento, pitch, VSL
- Briefar Web: pagina de vendas / checkout
- Briefar Midia: campanha de conversao
- Metas: taxa show -> venda, faturamento, ROAS (>=3x bom, >=5x excelente)

Fase 4 - Pos-lancamento (T+1 a T+14)
- Analisar resultados
- Briefar Midia: remarketing dos nao-compradores (30-60 dias)
- Briefar Copy: email pra nao-compradores
- Documentar aprendizados em marketing_briefing.aprendizados

# REGRA DOS 3 PERIODOS (analise de campanha rodando)
Antes de pausar/escalar criativo ou campanha: analise vitalicio + ultimos 7 dias + hoje. So e RUIM se mal nos 3 simultaneamente. Ruim so hoje = flutuacao. Cruzar com CRM (Meta tem delay no spend).

# MATEMATICA DE DECISAO
CPL_max aceitavel = ticket × taxa_conversao_esperada × margem
Ex: R$997 × 3% × 50% = R$14.95

ROAS minimo: 2x. Bom: 3x. Excelente: 5x+.

Budget por temperatura (diretriz):
- Frio: 60-70% (volume qualificado)
- Morno: 20-25% (reconectar)
- Quente: 10-15% (converter)

# ANTI-PADROES (nao caia)
Trafego:
- Editar adset em learning phase (reseta aprendizado)
- Pausar ativo com 1 dia ruim (use regra 3 periodos)
- Misturar video + imagem em CBO
- Advantage+ Creative em B2B (distorce)

Copy:
- "Gratis" se o evento e pago depois (bloqueia conta)
- Prometer sem data ("em breve")
- Falar pra "todo mundo" (sem avatar claro)
- Headline >15 palavras em feed

Criativo:
- Expert aparecendo em publico frio (quebra conversao)
- Marca de midia falsa real (G1, Exame): bloqueio Meta + risco legal
- Datas no criativo (invalidam asset rapido)

Web:
- LP sem pixel Meta instalado
- Form com 10+ campos
- LP com load >3s mobile
- Multiplos CTAs conflitantes

# ACOES POSSIVEIS (so depois dos 5 dados)
- {agent: 'copy', tipo: 'ad_meta', briefing: {publico_temperatura, dor_principal, ticket, oferta, prazo, ...}, label: 'Gerar copy anuncio frio'}
- {agent: 'copy', tipo: 'email', briefing: {...}, label: 'Sequencia email aquecimento'}
- {agent: 'copy', tipo: 'whatsapp', briefing: {...}, label: 'Roteiro WhatsApp pre-evento'}
- {agent: 'copy', tipo: 'vsl', briefing: {...}, label: 'Roteiro VSL'}
- {agent: 'copy', tipo: 'lp', briefing: {...}, label: 'Copy LP captacao'}
- {agent: 'criativo', tipo: 'brief_imagem', briefing: {formato, dor, gancho, template, ...}, label: 'Brief criativo feed/stories'}
- {agent: 'criativo', tipo: 'identidade_evento', briefing: {...}, label: '3 conceitos de identidade'}
- {agent: 'criativo', tipo: 'direcao_campanha', briefing: {...}, label: 'Direcao criativa da campanha'}
- {agent: 'midia', tipo: 'estrutura_campanha', briefing: {budget_diario, fase, publicos, ticket, cpl_max, ...}, label: 'Estrutura Meta Ads'}
- {agent: 'midia', tipo: 'analise_3periodos', briefing: {...}, label: 'Analisar 3 periodos'}
- {agent: 'midia', tipo: 'relatorio_4h', briefing: {...}, label: 'Relatorio de performance'}
- {agent: 'midia', tipo: 'recomendacao', briefing: {...}, label: 'Recomendacao estrategica'}
- {agent: 'web', tipo: 'lp_estrutura', briefing: {oferta, dor, mecanismo, cta, ...}, label: 'Estrutura LP captacao'}
- {agent: 'web', tipo: 'quiz_config', briefing: {...}, label: 'Configurar quiz page'}
- {agent: 'web', tipo: 'auditoria', briefing: {...}, label: 'Auditar pagina existente'}
- {agent: 'iniciativa', tipo: 'criar', briefing: {...}, label: 'Salvar iniciativa: Lancamento X'}

PRE-PREENCHA o briefing de cada acao com TUDO que voce sabe (briefing do negocio + iniciativa + respostas do usuario). NAO mande objeto vazio.

# PROTOCOLO DE APROVACAO
Cada especialista apresenta ANTES de executar:
- Copy: angulo + framework -> aprovacao -> copy completa
- Criativo: template + emocao + pattern interruption -> aprovacao -> prompt de imagem
- Midia: estrutura de campanhas -> aprovacao -> criar PAUSED -> aprovacao -> ATIVAR
- Web: estrutura de secoes -> aprovacao -> constroi -> aprovacao -> push/deploy

Maximo 3 acoes sugeridas por resposta. Se faltar dados, retorne array vazio.`;

const responderTool = {
  type: "function",
  function: {
    name: "responder",
    description: "Responde ao usuario com analise estrategica em markdown e sugere ate 3 acoes pros sub-agentes",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        resposta: {
          type: "string",
          description: "Resposta em markdown. Comece pela analise/recomendacao, depois plano, depois proximo passo. Frases curtas. Tom adaptado ao briefing."
        },
        titulo_sessao: {
          type: "string",
          description: "Titulo curto (max 60 chars) da sessao baseado no que o usuario quer. Se sessao ja tem titulo, repita o atual."
        },
        acoes_sugeridas: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              agent: { type: "string", enum: ["copy", "criativo", "midia", "web", "iniciativa"] },
              tipo: { type: "string", description: "Tipo do output ou acao. Ex: ad_meta, brief_imagem, estrutura_campanha, lp_estrutura, criar" },
              label: { type: "string", description: "Texto curto do botao (max 60 chars)" },
              briefing: { type: "object", additionalProperties: true, description: "Dados pre-preenchidos pro sub-agente usar" }
            },
            required: ["agent", "tipo", "label", "briefing"]
          }
        }
      },
      required: ["resposta", "titulo_sessao", "acoes_sugeridas"]
    }
  }
};

async function callGateway(apiKey: string, messages: Array<{ role: string; content: string }>) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: [responderTool],
      tool_choice: { type: "function", function: { name: "responder" } },
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

async function loadContext(admin: any, sessionId: string | null, briefingId: string | null) {
  // briefing
  let briefing: any = null;
  if (briefingId) {
    const { data } = await admin.from("marketing_briefing").select("*").eq("id", briefingId).maybeSingle();
    briefing = data;
  }
  if (!briefing) {
    const { data } = await admin.from("marketing_briefing").select("*").eq("is_default", true).limit(1).maybeSingle();
    briefing = data;
  }

  // historico (ultimas 12 mensagens)
  let historico: Array<{ role: string; content: string }> = [];
  if (sessionId) {
    const { data } = await admin
      .from("marketing_ai_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(12);
    historico = data ?? [];
  }

  return { briefing, historico };
}

function buildBriefingContext(briefing: any): string {
  if (!briefing) return "Sem briefing configurado. Pergunte os dados basicos antes.";
  return `# CONTEXTO DO NEGOCIO (briefing)
- Empresa: ${briefing.empresa}
- Tipo: ${briefing.tipo_negocio}
- Produto/servico: ${briefing.produto_servico}
- Ticket medio: R$ ${briefing.ticket_medio ?? "?"}
- Responsavel: ${briefing.responsavel ?? "?"}

PUBLICO:
- Perfil: ${briefing.publico_perfil}
- Dores: ${JSON.stringify(briefing.dores ?? [])}
- Desejos: ${JSON.stringify(briefing.desejos ?? [])}
- Canais: ${JSON.stringify(briefing.canais ?? [])}

TOM:
- Formalidade: ${briefing.formalidade}
- Palavras BANIDAS: ${JSON.stringify(briefing.palavras_banidas ?? [])}
- Palavras caracteristicas: ${JSON.stringify(briefing.palavras_caracteristicas ?? [])}

IDENTIDADE VISUAL: ${JSON.stringify(briefing.identidade_visual ?? {})}

APRENDIZADOS: ${JSON.stringify(briefing.aprendizados ?? [])}`;
}

async function handleChat(payload: {
  message: string;
  session_id?: string;
  briefing_id?: string;
  initiative_id?: string;
}) {
  const { message } = payload;
  if (!message?.trim()) return { success: false, error: "message required", status: 400 };

  const admin = adminClient();
  let sessionId = payload.session_id ?? null;

  // cria sessao se nao existir
  if (!sessionId) {
    const { data, error } = await admin
      .from("marketing_ai_sessions")
      .insert({
        briefing_id: payload.briefing_id ?? null,
        initiative_id: payload.initiative_id ?? null,
        titulo: message.slice(0, 60),
      })
      .select()
      .single();
    if (error || !data) {
      console.error("create session err:", error);
      return { success: false, error: error?.message ?? "session create failed", status: 500 };
    }
    sessionId = data.id;
  }

  const { briefing, historico } = await loadContext(admin, sessionId, payload.briefing_id ?? null);

  // monta mensagens
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildBriefingContext(briefing) },
    ...historico,
    { role: "user", content: message },
  ];

  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  if (!apiKey) return { success: false, error: "LOVABLE_API_KEY missing", status: 500 };

  const ai = await callGateway(apiKey, messages);
  if (!ai) return { success: false, error: "AI failed", status: 500 };

  const resposta = ai.resposta ?? "Nao consegui processar agora. Tenta de novo.";
  const acoes = Array.isArray(ai.acoes_sugeridas) ? ai.acoes_sugeridas : [];

  // salva mensagem do user + resposta
  await admin.from("marketing_ai_messages").insert([
    { session_id: sessionId, role: "user", content: message },
    {
      session_id: sessionId,
      role: "assistant",
      agent: "maestro",
      content: resposta,
      metadata: { acoes_sugeridas: acoes },
    },
  ]);

  // atualiza titulo se vazio
  if (ai.titulo_sessao) {
    await admin.from("marketing_ai_sessions").update({ titulo: ai.titulo_sessao }).eq("id", sessionId);
  }

  return {
    success: true,
    session_id: sessionId,
    resposta,
    acoes_sugeridas: acoes,
    briefing_id: briefing?.id ?? null,
  };
}

async function handleListSessions(payload: { limit?: number }) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("marketing_ai_sessions")
    .select("id, titulo, status, briefing_id, initiative_id, created_at, updated_at")
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .limit(payload.limit ?? 30);
  if (error) return { success: false, error: error.message, status: 500 };
  return { success: true, sessions: data };
}

async function handleGetSession(payload: { session_id: string }) {
  const admin = adminClient();
  const { data: session } = await admin
    .from("marketing_ai_sessions")
    .select("*")
    .eq("id", payload.session_id)
    .maybeSingle();
  if (!session) return { success: false, error: "session not found", status: 404 };
  const { data: messages } = await admin
    .from("marketing_ai_messages")
    .select("*")
    .eq("session_id", payload.session_id)
    .order("created_at", { ascending: true });
  const { data: outputs } = await admin
    .from("marketing_ai_outputs")
    .select("*")
    .eq("session_id", payload.session_id)
    .order("created_at", { ascending: false });
  return { success: true, session, messages: messages ?? [], outputs: outputs ?? [] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action as string;
    let result: any;
    switch (action) {
      case "chat": result = await handleChat(body); break;
      case "list_sessions": result = await handleListSessions(body); break;
      case "get_session": result = await handleGetSession(body); break;
      default: result = { success: false, error: "unknown action", status: 400 };
    }
    const status = result.status ?? (result.success ? 200 : 500);
    delete result.status;
    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("marketing-maestro error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
