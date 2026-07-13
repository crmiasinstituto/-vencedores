// Marketing Midia Agent - skill agente-marketing/sub-agents/midia/SOUL.md
// Estrutura campanhas Meta Ads + analise pelos 3 periodos + relatorio + recomendacoes
// Se META_ADS_TOKEN estiver setado, busca dados reais. Senao, gera analise sobre dados manuais do CRM.

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

const SYSTEM_PROMPT = `Voce e o MIDIA AGENT do agente-marketing. Gestor de trafego pago. Nao compra clique, compra resultado.

# QUEM VOCE E
Voce pensa em numeros antes de qualquer decisao. Cada real investido tem uma hipotese por tras, e cada hipotese tem um dado que confirma ou refuta. Nao tem ego: se o dado manda matar, mata; se manda dobrar, dobra. Trafego pago nao e sobre anuncio bonito, e sobre encontrar a pessoa certa, com a mensagem certa, no momento certo, pelo menor custo possivel, e escalar isso sem destruir a eficiencia.

# ARSENAL DE MESTRES
- Perry Marshall (80/20): 80% do resultado vem de 20% dos anuncios/publicos. Use pra priorizar o que escalar e o que pausar.
- Molly Pittman (Meta Ads): estrutura por temperatura de publico, frameworks de segmentacao.
- Jon Loomer (Meta avancado): custom audiences, lookalikes, retargeting por comportamento, pixel mastery.
- Andrew Foxwell ("os criativos sao a nova segmentacao"): teste de criativos como experimentos cientificos, fadiga criativa.
- Nicholas Kusmich: sequencia de anuncios que educa antes de vender (frio nao recebe oferta direta).
- Pedro Sobral (referencia BR): CBOs, escalonamento, "ensinar o algoritmo".
- Ben Heath (infoprodutos): broad vs interest, quando usar cada.
- Aaron Nosbisch: como o algoritmo distribui criativos, estrutura de teste eficiente.
- Ryan Deiss (Customer Value Journey): cada fase tem uma metrica e um tipo de anuncio.

# 5 PERGUNTAS ANTES DE ESTRUTURAR QUALQUER CAMPANHA
1. Qual o objetivo real? Lead, inscricao, venda, view de VSL? Define tudo.
2. Qual o CPL/CPA maximo viavel? Ticket × taxa de conversao esperada × margem. Sem isso, nao ha parametro de corte.
3. Qual o funil completo? Anuncio onde o lead cai o que acontece depois. Trafego sem funil e dinheiro no ralo.
4. Qual o historico da conta? Conta nova vs consolidada define estrategia de segmentacao e orcamento inicial.
5. Quais criativos estao disponiveis? Voce distribui e otimiza, nao decide qual criativo vai pra qual publico (Copy e Criativo Agent decidem).

# REGRA DOS 3 PERIODOS (CRITICA, NUNCA PULAR)
Antes de pausar, escalar ou alterar QUALQUER ativo, analise SEMPRE nos 3 periodos:
1. Vitalicio (date_preset=lifetime): historico completo
2. Ultimos 7 dias (date_preset=last_7d): tendencia recente
3. Hoje (date_preset=today): atual, mas tem delay do Meta

So e RUIM se mal nos 3 simultaneamente.
- Ruim hoje + bom 7d + bom vitalicio = flutuacao. NAO pausar.
- Ruim 7d + bom vitalicio = investigar antes de pausar.
- Bom vitalicio + bom 7d + ruim hoje = NAO ruim. Aguardar.
- Ruim nos 3 = pausar com conviccao.

Atencao: Meta tem delay de ate 24h no spend. Sempre cruzar com dados do CRM (utm_medium=paid_social) antes de decisao definitiva, pode parecer "0 leads" quando teve 10.

# BENCHMARKS (mercado BR infoprodutos, calibrar com historico real da conta)
| Metrica | Ruim | OK | Bom | Excelente |
|---|---|---|---|---|
| CPM | >R$50 | R$30-50 | R$15-30 | <R$15 |
| CTR link | <0.8% | 0.8-1.5% | 1.5-3% | >3% |
| Hook Rate (3s view) | <20% | 20-30% | 30-45% | >45% |
| Hold Rate (50% view) | <15% | 15-25% | 25-40% | >40% |
| CPL | >R$25 | R$15-25 | R$7-15 | <R$7 |
| CPA | >10x CPL | 6-10x CPL | 3-6x CPL | <3x CPL |
| Frequencia | >5 saturacao | 3-5 | 2-3 | 1-2 |

# MATEMATICA DE DECISAO
CPL_max = ticket × taxa_conversao_esperada × margem
Ex: ticket R$997, taxa venda 3%, margem CAC=50% LTV: 997 × 0.03 × 0.5 = R$14.95

ROAS minimo viavel: 2x. Bom: 3x. Excelente: 5x+.

Teste: R$50-200/dia por criativo, ate 2-3 dias.
Validacao: CPL na meta = escalar gradualmente (+20-30% por vez).
Morte: 3 dias com CPL 2x acima da meta = pausar.

# QUANDO ESCALAR vs MATAR
Escalar quando:
- CPL/CPA dentro da meta por 3+ dias consecutivos
- Saiu da fase de aprendizado (50+ conversoes em 7 dias)
- Escale +20-30% por vez. NUNCA dobrar de uma vez (reseta learning).
- Prefira DUPLICAR adset performatico com orcamento maior em vez de editar o original.

Pause ou mate quando:
- CPL/CPA > 2x da meta por 3+ dias
- CTR link < 0.5% (criativo nao para o scroll)
- Hook Rate < 15% (primeiros 3s falhando)
- Frequencia > 4-5 (publico saturado, troque criativo ou expanda publico)
- Sem saida de learning apos 14 dias

NUNCA faca:
- Editar adset ativo em learning phase (reseta tudo)
- Criar 20 criativos de uma vez sem estrutura de teste
- Aumentar orcamento mais de 30% de uma vez
- Pausar campanha no meio do aprendizado sem motivo claro
- Julgar performance em menos de 3 dias

# CBO vs ABO (Campaign Budget Optimization vs Ad Set Budget)
CBO: budget na campanha, Meta distribui pelos adsets. USE quando: 3+ adsets, quer que o algoritmo otimize.
ABO: budget por adset, controle granular. USE quando: quer gasto minimo em cada temperatura (frio/morno/quente), conta nova sem historico.
Regra geral: ABO na fase de teste, CBO na fase de escala.

# ORCAMENTO POR TEMPERATURA (diretriz, ajustar pela conta)
- Frio: 60-70% (gerar volume de leads qualificados)
- Morno: 20-25% (reconectar, avancar na jornada)
- Quente: 10-15% (converter quem ja esta pronto)

# ESTRUTURA POR FASE DE LANCAMENTO

## Fase 1 - Captacao (D-30 a D-7)
Objetivo: OUTCOME_LEADS, maximizar inscricoes pelo menor CPL.
Estrutura:
- Campanha [EVENTO] - Captacao - Frio (CBO ou ABO)
  - Adset: Broad BR <faixa etaria>
  - Adset: Lookalike 1% compradores
  - Adset: Interesses verticais (empreendedorismo + tema do produto)
- Campanha [EVENTO] - Captacao - Morno
  - Adset: Engajamento IG/FB ultimos 60 dias
  - Adset: Visitantes de paginas da marca ultimos 60 dias

## Fase 2 - Aquecimento (D-7 a D-1)
Objetivo: aumentar show rate e engajamento pre-evento. OUTCOME_ENGAGEMENT.
- Campanha [EVENTO] - Aquecimento
  - Adset: Lista de leads inscritos (excluir compradores)
  - Criativos: bastidores, prova social, urgencia de vagas

## Fase 3 - Conversao (Dia do evento + 48h pos)
Objetivo: fechar vendas. OUTCOME_SALES com pixel Purchase.
- Campanha [EVENTO] - Conversao
  - Adset: Assistiu evento >50% (video view audience)
  - Adset: Visitou pagina de vendas (pixel ViewContent)
  - Adset: Iniciou checkout (pixel InitiateCheckout)

## Fase 4 - Remarketing (D+1 a D+7)
Objetivo: recuperar quem quase comprou.
- Campanha [EVENTO] - Remarketing
  - Adset: Nao-compradores que visitaram LP de vendas
  - Criativos: objecao quebrada, bonus exclusivo, prazo final

# OBJETIVOS ODAX (Meta atual)
- OUTCOME_AWARENESS: alcance, brand awareness, topo de funil amplo
- OUTCOME_TRAFFIC: cliques pra site, otimiza por Landing Page Views
- OUTCOME_ENGAGEMENT: engajamento, mensagens
- OUTCOME_LEADS: principal pra captacao, evento Lead ou CompleteRegistration
- OUTCOME_SALES: venda direta, ROAS, evento Purchase

optimization_goal por objetivo:
- Leads: LEAD_GENERATION
- Conversoes: OFFSITE_CONVERSIONS
- Trafego: LANDING_PAGE_VIEWS
- Engajamento: POST_ENGAGEMENT

bid_strategy:
- LOWEST_COST_WITHOUT_CAP (padrao, fase de aprendizado)
- COST_CAP (quando ja tem CPL medio historico, exige bid_amount em centavos)
- TARGET_ROAS (campanhas de conversao com historico)

# PUBLICOS
Core Audiences (Interesses): localizacao + idade + interesses + comportamentos.
Custom Audiences:
- Lista de clientes/leads (CSV email/telefone)
- Pixel: visitantes, eventos especificos
- Engajamento IG/FB: comentou, mandou DM, salvou
- Video viewers: 25%, 50%, 75%, 95%
- Leads de formulario Meta
Lookalike Audiences:
- 1% mais parecido com a fonte (menor, mais preciso)
- 5% equilibrio
- 10% maior alcance, menos preciso
- Melhor fonte: lista de compradores do produto principal
Advantage+ Audience: IA do Meta expande automaticamente. Use com conta com historico (>50 conversoes/semana). Coloque Audience Controls pra proteger localizacao/idade.

# LEARNING PHASE
Requisito pra sair: ~50 eventos de otimizacao em 7 dias por adset.
O que REINICIA o aprendizado (evite durante campanha ativa):
- Editar orcamento mais de 20%
- Editar publico do adset
- Editar criativo do anuncio
- Pausar e reativar o adset
- Trocar evento de otimizacao
- Trocar destino do anuncio
"Learning Limited" = nao consegue 50 conversoes/semana. Solucao: ampliar publico, simplificar evento (Lead em vez de Purchase), aumentar budget.
Nunca julgue um adset antes de sair do aprendizado (min 7 dias).

# REGRAS DE EXECUCAO META API (criticas)
- SEMPRE criar com status PAUSED. Ativacao manual apos revisao.
- Feed + Story SEMPRE no mesmo ad via asset_feed_spec. NUNCA crie ads separados.
- IMAGE asset_feed_spec: object_story_spec deve ter SOMENTE page_id (sem link_data, sem photo_data). Tudo no asset_feed_spec.
- VIDEO asset_feed_spec: object_story_spec = page_id + video_data (com video_id, message, call_to_action, image_url thumb).
- ad_formats obrigatorio: ["SINGLE_IMAGE"] ou ["SINGLE_VIDEO"].
- call_to_action: NUNCA com campo "value". So {type: "LEARN_MORE"} ou {type: "SIGN_UP"}.
- url_tags: top-level no adcreative, NUNCA dentro de link_data.
- instagram_actor_id: omitir completamente (API rejeita).
- Advantage Audience: sempre {targeting_automation: {advantage_audience: 0}} se quiser controle.
- Videos >100MB: upload chunked obrigatorio (start/transfer/finish).
- Budget diario em adset: requer janela >=24h. Lifetime budget pra janelas curtas.
- Separar campanhas de video e imagem (nao misturar em CBO, o algoritmo prefere um).

# ERROS META API DOCUMENTADOS (nao repetir)
| Erro | Causa | Solucao |
|---|---|---|
| 1443048 | link_data ou photo_data em object_story_spec com asset_feed_spec de imagem | object_story_spec deve ter SOMENTE page_id |
| 1870197 | targeting_optimization incluido | campo DEPRECATED, omitir |
| 1487079 | individual_setting em targeting_automation pra REACH | omitir completamente |
| 3858504 | degrees_of_freedom_spec com standard_enhancements | DEPRECATED, omitir |
| 2654/1870077 | origin_audience_id nested dentro de lookalike_spec | enviar como parametro separado top-level |

# UTMs OBRIGATORIAS
Sempre setar url_tags no adcreative:
utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{adset.name}}&utm_term={{ad.name}}

# RELATORIO PERIODICO (a cada 4h)
Formato fixo: timestamp BRT, por campanha mostre gasto/alcance/impressoes/cliques/CTR/leads/CPL/frequencia/CPM. Liste adsets (inclusive PAUSED com marca). Top 3 criativos por leads, desempate por CPL. Alerta no criativo se CPL zerado, ou CPL>2x meta, ou CTR<0.5%. Veredicto saudavel/atencao/critico por campanha. Dicas globais 1-3 acoes concretas.

# REGRA FINAL
Dado sem acao = relatorio. Acao sem dado = aposta. Use os dois sempre.`;

const estruturaCampanhaTool = {
  type: "function",
  function: {
    name: "retornar_estrutura_campanha",
    description: "Retorna estrutura completa de campanhas Meta Ads para uma fase do funil",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome_iniciativa: { type: "string" },
        fase: { type: "string", enum: ["captacao", "aquecimento", "conversao", "remarketing"] },
        objetivo_meta: {
          type: "string",
          enum: ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES"],
        },
        budget_total: { type: "number" },
        cpl_max_aceitavel: { type: "number" },
        campanhas: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              nome: { type: "string" },
              objetivo: { type: "string" },
              budget_diario: { type: "number" },
              estrutura: { type: "string", enum: ["CBO", "ABO"] },
              adsets: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    nome: { type: "string" },
                    publico_descricao: { type: "string" },
                    targeting: { type: "string", description: "Frio/morno/quente + segmentacao especifica (LAL 1%, interesses, customaud)" },
                    budget_diario: { type: "number" },
                    optimization_goal: {
                      type: "string",
                      enum: ["LEAD_GENERATION", "OFFSITE_CONVERSIONS", "LANDING_PAGE_VIEWS", "POST_ENGAGEMENT", "REACH"],
                    },
                  },
                  required: ["nome", "publico_descricao", "targeting", "budget_diario", "optimization_goal"],
                },
              },
            },
            required: ["nome", "objetivo", "budget_diario", "estrutura", "adsets"],
          },
        },
        observacoes: { type: "string", description: "Pontos de atencao, regras de leitura de performance, quando reavaliar" },
      },
      required: ["nome_iniciativa", "fase", "objetivo_meta", "budget_total", "cpl_max_aceitavel", "campanhas", "observacoes"],
    },
  },
};

const analise3PeriodosTool = {
  type: "function",
  function: {
    name: "retornar_analise_3periodos",
    description: "Analisa campanha/adset/criativo nos 3 periodos e gera veredicto + acoes",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        objeto_analisado: { type: "string", description: "Nome da campanha/adset/criativo" },
        nivel: { type: "string", enum: ["campanha", "adset", "criativo"] },
        dados: {
          type: "object",
          additionalProperties: false,
          properties: {
            vitalicio: {
              type: "object",
              additionalProperties: true,
              properties: {
                cpl: { type: "number" }, ctr: { type: "number" },
                spend: { type: "number" }, leads: { type: "integer" },
                hook_rate: { type: "number" }, frequencia: { type: "number" },
              },
            },
            ultimos_7d: { type: "object", additionalProperties: true },
            hoje: { type: "object", additionalProperties: true },
          },
        },
        veredicto: { type: "string", enum: ["saudavel", "atencao", "critico"] },
        analise: { type: "string", description: "Analise objetiva: CPL vs meta, CTR, frequencia, comparacao entre periodos" },
        acoes_recomendadas: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
              acao: { type: "string", enum: ["pausar", "escalar", "duplicar", "trocar_criativo", "expandir_publico", "aguardar"] },
              detalhe: { type: "string" },
            },
            required: ["prioridade", "acao", "detalhe"],
          },
        },
      },
      required: ["objeto_analisado", "nivel", "dados", "veredicto", "analise", "acoes_recomendadas"],
    },
  },
};

const relatorio4hTool = {
  type: "function",
  function: {
    name: "retornar_relatorio_4h",
    description: "Relatorio formatado de performance das campanhas (a cada 4h)",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        timestamp_brt: { type: "string", description: "DD/MM HH:MM BRT" },
        proximo_relatorio: { type: "string" },
        campanhas: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              nome: { type: "string" },
              gasto: { type: "number" },
              alcance: { type: "integer" },
              impressoes: { type: "integer" },
              cliques: { type: "integer" },
              ctr: { type: "number" },
              leads: { type: "integer" },
              cpl: { type: "number" },
              frequencia: { type: "number" },
              cpm: { type: "number" },
              adsets: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    nome: { type: "string" }, status: { type: "string" },
                    gasto: { type: "number" }, leads: { type: "integer" },
                    cpl: { type: "number" }, ctr: { type: "number" },
                  },
                  required: ["nome", "status", "gasto", "leads", "cpl", "ctr"],
                },
              },
              top_criativos: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    nome: { type: "string" }, leads: { type: "integer" },
                    cpl: { type: "number" }, alerta: { type: "string" },
                  },
                  required: ["nome", "leads", "cpl"],
                },
              },
              veredicto: { type: "string", enum: ["saudavel", "atencao", "critico"] },
              analise: { type: "string" },
            },
            required: ["nome", "gasto", "alcance", "impressoes", "cliques", "ctr", "leads", "cpl", "frequencia", "cpm", "adsets", "top_criativos", "veredicto", "analise"],
          },
        },
        dicas_globais: { type: "array", items: { type: "string" }, description: "1-3 acoes concretas pra aplicar agora" },
      },
      required: ["timestamp_brt", "proximo_relatorio", "campanhas", "dicas_globais"],
    },
  },
};

const recomendacaoTool = {
  type: "function",
  function: {
    name: "retornar_recomendacao",
    description: "Recomendacao estrategica de midia (escalar X, pausar Y, expandir Z)",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        contexto: { type: "string" },
        recomendacoes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
              acao: { type: "string" },
              fundamento: { type: "string", description: "Numeros que sustentam a recomendacao" },
              risco: { type: "string" },
            },
            required: ["prioridade", "acao", "fundamento", "risco"],
          },
        },
      },
      required: ["contexto", "recomendacoes"],
    },
  },
};

const TOOLS_BY_TIPO: Record<string, { tool: any; nome: string }> = {
  estrutura_campanha: { tool: estruturaCampanhaTool, nome: "retornar_estrutura_campanha" },
  analise_3periodos: { tool: analise3PeriodosTool, nome: "retornar_analise_3periodos" },
  relatorio_4h: { tool: relatorio4hTool, nome: "retornar_relatorio_4h" },
  recomendacao: { tool: recomendacaoTool, nome: "retornar_recomendacao" },
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

// Busca dados do CRM existente (marketing_campaigns + utm_links) pra cruzar
async function getCrmData(admin: any) {
  const [{ data: campaigns }, { data: utm }] = await Promise.all([
    admin.from("marketing_campaigns").select("*").order("created_at", { ascending: false }).limit(20),
    admin.from("utm_links").select("*").eq("is_active", true).limit(50),
  ]);
  return {
    campanhas_crm: (campaigns ?? []).map((c: any) => ({
      nome: c.name, plataforma: c.platform, status: c.status,
      budget: c.budget, gasto: c.spent, leads: c.leads,
      cpl: c.cpl, conversoes: c.conversions,
    })),
    utm_links_ativos: (utm ?? []).length,
  };
}

// ============================================================
// META MARKETING API - busca insights reais nos 3 periodos
// ============================================================

async function getMetaCredentials(admin: any) {
  const { data } = await admin
    .from("integration_keys")
    .select("api_key, account_id, metadata, is_active")
    .eq("service", "meta_ads")
    .maybeSingle();
  if (!data?.api_key || !data?.account_id || data.is_active === false) return null;
  return { token: data.api_key, accountId: data.account_id, metadata: data.metadata ?? {} };
}

const META_API_VERSION = "v21.0";
const META_INSIGHTS_FIELDS = [
  "campaign_name", "adset_name", "ad_name",
  "impressions", "reach", "clicks", "ctr", "cpm", "cpp", "spend", "frequency",
  "actions", "cost_per_action_type",
  "video_p25_watched_actions", "video_p50_watched_actions", "video_p75_watched_actions",
].join(",");

async function fetchMetaInsights(
  token: string,
  accountId: string,
  datePreset: "lifetime" | "last_7d" | "today",
  level: "account" | "campaign" | "adset" | "ad" = "campaign",
) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", META_INSIGHTS_FIELDS);
  url.searchParams.set("date_preset", datePreset);
  url.searchParams.set("level", level);
  url.searchParams.set("limit", "100");

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errText = await response.text();
    console.error(`Meta API err [${datePreset}]:`, response.status, errText.slice(0, 300));
    return { error: errText.slice(0, 300), data: [] };
  }
  const json = await response.json();
  return { data: json.data ?? [], error: null };
}

function extractAction(actions: any[] | undefined, type: string): number {
  if (!Array.isArray(actions)) return 0;
  const m = actions.find((a) => a.action_type === type);
  return m ? Number(m.value) : 0;
}

function summarizeMetaRow(row: any) {
  const leads = extractAction(row.actions, "lead") || extractAction(row.actions, "onsite_conversion.lead_grouped");
  const purchases = extractAction(row.actions, "purchase") || extractAction(row.actions, "offsite_conversion.fb_pixel_purchase");
  const spend = Number(row.spend ?? 0);
  return {
    nome: row.campaign_name ?? row.adset_name ?? row.ad_name ?? "?",
    impressoes: Number(row.impressions ?? 0),
    alcance: Number(row.reach ?? 0),
    cliques: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpm: Number(row.cpm ?? 0),
    spend,
    leads,
    cpl: leads > 0 ? spend / leads : null,
    purchases,
    cpa: purchases > 0 ? spend / purchases : null,
    frequencia: Number(row.frequency ?? 0),
  };
}

async function getMetaThreeperiods(admin: any, level: "account" | "campaign" | "adset" | "ad" = "campaign") {
  const creds = await getMetaCredentials(admin);
  if (!creds) return { configured: false };

  const [lifetime, last7d, today] = await Promise.all([
    fetchMetaInsights(creds.token, creds.accountId, "lifetime", level),
    fetchMetaInsights(creds.token, creds.accountId, "last_7d", level),
    fetchMetaInsights(creds.token, creds.accountId, "today", level),
  ]);

  return {
    configured: true,
    account_id: creds.accountId,
    vitalicio: lifetime.data.map(summarizeMetaRow),
    ultimos_7d: last7d.data.map(summarizeMetaRow),
    hoje: today.data.map(summarizeMetaRow),
    erros: [lifetime.error, last7d.error, today.error].filter(Boolean),
  };
}

function buildContext(briefing: any, briefingInput: any, crmData: any, meta: any): string {
  const partes = [];
  if (briefing) {
    partes.push(`# NEGOCIO
Empresa: ${briefing.empresa}
Ticket: R$ ${briefing.ticket_medio ?? "?"}
Aprendizados: ${JSON.stringify(briefing.aprendizados ?? [])}`);
  }
  partes.push(`# DADOS DO CRM (cruzar com decisoes)
Campanhas no CRM: ${JSON.stringify(crmData.campanhas_crm)}
UTM links ativos: ${crmData.utm_links_ativos}`);

  if (meta?.configured) {
    partes.push(`# META ADS API (dados reais nos 3 periodos)
Account: act_${meta.account_id}
Vitalicio: ${JSON.stringify(meta.vitalicio).slice(0, 4000)}
Ultimos 7d: ${JSON.stringify(meta.ultimos_7d).slice(0, 4000)}
Hoje: ${JSON.stringify(meta.hoje).slice(0, 4000)}
${meta.erros?.length ? `Avisos: ${JSON.stringify(meta.erros)}` : ""}

REGRA DOS 3 PERIODOS: aplique a comparacao. Pause apenas se ruim nos 3. Cruze com dados do CRM acima (Meta tem delay no spend).`);
  } else {
    partes.push(`# META ADS API
Nao configurada (sem token em integration_keys.meta_ads). Use os dados do CRM e do briefing pra gerar a analise. Sugira ao usuario configurar a integracao Meta pra analise automatica.`);
  }

  if (briefingInput && Object.keys(briefingInput).length) {
    partes.push(`# BRIEFING DESTA REQUISICAO\n${JSON.stringify(briefingInput, null, 2)}`);
  }
  return partes.join("\n\n");
}

async function handleGenerate(payload: {
  tipo: string;
  briefing: Record<string, unknown>;
  session_id?: string;
  initiative_id?: string;
  briefing_id?: string;
  fetch_meta?: boolean;            // se true, busca dados Meta nos 3 periodos
  meta_level?: "account" | "campaign" | "adset" | "ad";
}) {
  const { tipo, briefing: briefingInput } = payload;
  const toolDef = TOOLS_BY_TIPO[tipo];
  if (!toolDef) return { success: false, error: `tipo invalido: ${tipo}`, status: 400 };

  const admin = adminClient();
  // tipos que pedem dados Meta automaticamente
  const wantsMeta = payload.fetch_meta ?? ["analise_3periodos", "relatorio_4h", "recomendacao"].includes(tipo);

  const [briefing, crmData, meta] = await Promise.all([
    getBriefing(admin, payload.briefing_id),
    getCrmData(admin),
    wantsMeta ? getMetaThreeperiods(admin, payload.meta_level ?? "campaign") : Promise.resolve({ configured: false }),
  ]);

  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  if (!apiKey) return { success: false, error: "LOVABLE_API_KEY missing", status: 500 };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContext(briefing, briefingInput, crmData, meta) },
    { role: "user", content: `Gere ${tipo}. Aplique a regra dos 3 periodos onde fizer sentido. Cruze com dados do CRM e da Meta API se disponiveis.` },
  ];

  const result = await callGateway(apiKey, messages, toolDef.tool, toolDef.nome);
  if (!result) return { success: false, error: "AI failed", status: 500 };

  const { data: output, error } = await admin
    .from("marketing_ai_outputs")
    .insert({
      session_id: payload.session_id ?? null,
      initiative_id: payload.initiative_id ?? null,
      agent: "midia",
      tipo,
      titulo: (result as any).nome_iniciativa ?? (result as any).objeto_analisado ?? `Midia ${tipo}`,
      briefing: { ...briefingInput, _meta_configured: (meta as any).configured ?? false },
      resultado: result,
      raw_text: JSON.stringify(result, null, 2),
      status: "gerado",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message, status: 500 };
  return { success: true, output_id: output.id, resultado: result, meta_configured: (meta as any).configured ?? false };
}

// ============================================================
// SCHEDULE TICK: rodado por cron, gera relatorio_4h pra todas iniciativas ativas
// ============================================================
async function handleScheduleTick() {
  const admin = adminClient();
  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  if (!apiKey) return { success: false, error: "LOVABLE_API_KEY missing", status: 500 };

  const [briefing, crmData, meta] = await Promise.all([
    admin.from("marketing_briefing").select("*").eq("is_default", true).limit(1).maybeSingle().then((r: any) => r.data),
    getCrmData(admin),
    getMetaThreeperiods(admin, "campaign"),
  ]);

  const briefingInput = {
    contexto: "Relatorio automatico agendado",
    timestamp: new Date().toISOString(),
  };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContext(briefing, briefingInput, crmData, meta) },
    { role: "user", content: `Gere relatorio_4h com base nos dados Meta + CRM. Inclua todas as campanhas ativas. Aplique regra dos 3 periodos.` },
  ];

  const result = await callGateway(apiKey, messages, relatorio4hTool, "retornar_relatorio_4h");
  if (!result) return { success: false, error: "AI failed", status: 500 };

  const { data: output, error } = await admin
    .from("marketing_ai_outputs")
    .insert({
      agent: "midia",
      tipo: "relatorio_4h",
      titulo: `Relatorio automatico ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      briefing: { ...briefingInput, _meta_configured: meta.configured },
      resultado: result,
      raw_text: JSON.stringify(result, null, 2),
      status: "gerado",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message, status: 500 };
  return {
    success: true,
    output_id: output.id,
    meta_configured: meta.configured,
    resumo: (result as any).campanhas?.length
      ? `${(result as any).campanhas.length} campanhas analisadas`
      : "sem campanhas ativas",
  };
}

// ============================================================
// ESTRATEGISTA (action=estrategista): copiloto que monta o PLANO da
// campanha a partir de um briefing curto. Usa Claude Sonnet (ANTHROPIC_API_KEY),
// independente do gateway Gemini do resto da edge. Aditivo, nao toca nada acima.
// ============================================================
const ESTRATEGISTA_PROMPT = `Voce e um estrategista senior de trafego pago (Meta Ads) e de comportamento humano, no nivel dos melhores do mundo. Voce monta o PLANO completo de uma campanha a partir de um briefing curto e devolve em formato que preenche um formulario de criacao de campanha.

# POSICIONAMENTO OBRIGATORIO (marca SQUAAD)
- A oferta e IA DE VERDADE, sob medida, treinada no negocio do cliente. O reframe central: "o ChatGPT generico todo mundo ja tem, o que muda o jogo e uma IA treinada no SEU negocio".
- NUNCA venda "IA generativa" ou "ChatGPT" como gancho positivo. Use "ChatGPT generico" apenas como contraste do que NAO resolve.
- Construa VALOR antes de qualquer preco.
- Prova real disponivel: a clinica do fundador cresceu +64% de faturamento e +71% de ticket medio em 12 meses.

# REGRA DE ESCRITA (CRITICA)
- NUNCA use travessao (— ou –) em nenhum texto. Use virgula, ponto ou dois-pontos. Vale pra copy, headline, roteiro e observacoes.
- PT-BR, tom direto e humano. Gancho forte nos primeiros 3 segundos do criativo.

# ESTRATEGIA
- Evento presencial e regional: o geo trava num raio (max 80km por pino na Meta). Nesse caso o motor e BROAD dentro do raio, porque publicos de CRM/LAL nacionais quase somem cruzados com o raio. Diga isso nas observacoes quando for evento presencial.
- Pouco volume de Compra: otimize os conjuntos FRIOS em INITIATED_CHECKOUT (evento frequente, algoritmo aprende rapido) e deixe Compra so pro retargeting quente. No formulario o optimization_goal de conversao e OFFSITE_CONVERSIONS (a infra forca o evento, registre nas observacoes qual evento usar).
- CBO na escala, ABO no teste. Sempre subir PAUSED.
- Divida o investimento por temperatura. Os budget_diario dos adsets DEVEM somar o investimento diario informado no briefing.
- Interesses/comportamentos Meta uteis ja validados (use nas descricoes de targeting): Empreendedorismo (id 6003114185392), Pequenas e medias empresas (id 6003136069408), comportamento Proprietarios de pequenas empresas (id 6002714898572).

# SAIDA
Preencha TODOS os campos. Alem da estrutura:
- posicionamento: a grande ideia da campanha (1 a 2 frases) + a frase de posicionamento entre aspas.
- aviso_compliance: se houver autoridade de terceiros (nomes conhecidos, podcast, evento), oriente usar como ambiente/autoridade, NUNCA como endosso, pra proteger de takedown.
- conceitos: 5 conceitos de criativo do mais frio (awareness) ao mais quente (retargeting), cada um com gancho de 3s e os beats em ordem.
- creatives: 2 a 3 com copy variada (autoridade, prova, callout local).
- headlines: 6 alternativas curtas.
- roteiros: 1 a 2 roteiros cena a cena (tempo, b-roll, fala, texto na tela).
- checklist_producao: regras praticas do bruto pro anuncio (9:16, legenda queimada, gancho no 1o frame, variacoes de gancho, etc.).
Seja concreto e pronto pra usar, nada generico.`;

const planoCampanhaTool = {
  name: "retornar_plano_campanha",
  description: "Plano completo de campanha Meta Ads pronto pra preencher o formulario de Nova Campanha",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      posicionamento: { type: "string", description: "A grande ideia da campanha em 1 a 2 frases" },
      aviso_compliance: { type: "string", description: "Como usar material de autoridade (terceiros) sem claim de endosso, pra nao tomar takedown" },
      conceitos: {
        type: "array",
        description: "5 conceitos de criativo do mais frio ao mais quente",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            nome: { type: "string" },
            campanha: { type: "string", description: "awareness, sales ou retargeting" },
            formato: { type: "string", description: "ex: 9:16, 30-40s" },
            gancho: { type: "string", description: "primeiros 3s, o que abre o video" },
            estrutura: { type: "array", items: { type: "string" }, description: "beats do roteiro em ordem" },
            objetivo: { type: "string" },
          },
          required: ["nome", "campanha", "gancho", "estrutura"],
        },
      },
      headlines: { type: "array", items: { type: "string" }, description: "6 headlines curtas alternativas" },
      checklist_producao: { type: "array", items: { type: "string" }, description: "regras de producao do bruto pro anuncio" },
      campaign_name: { type: "string" },
      objective: { type: "string", enum: ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES"] },
      phase: { type: "string", enum: ["captacao", "aquecimento", "conversao", "remarketing"] },
      destination_url: { type: "string" },
      ticket: { type: "number" },
      cpl_max: { type: "number" },
      budget_diario_total: { type: "number" },
      adsets: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            nome: { type: "string" },
            publico_descricao: { type: "string" },
            targeting: { type: "string", description: "Frio/morno/quente + segmentacao (broad, interesses com id, custom audiences, geo)" },
            budget_diario: { type: "number" },
            optimization_goal: { type: "string", enum: ["LEAD_GENERATION", "OFFSITE_CONVERSIONS", "LANDING_PAGE_VIEWS", "POST_ENGAGEMENT", "REACH"] },
            age_min: { type: "integer" },
            age_max: { type: "integer" },
          },
          required: ["nome", "publico_descricao", "targeting", "budget_diario", "optimization_goal", "age_min", "age_max"],
        },
      },
      creatives: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            primary_text: { type: "string" },
            headline: { type: "string", description: "ate 40 caracteres" },
            description: { type: "string", description: "ate 30 caracteres" },
            cta_button: { type: "string", enum: ["LEARN_MORE", "SIGN_UP", "SUBSCRIBE", "GET_OFFER", "WATCH_MORE", "CONTACT_US"] },
          },
          required: ["primary_text", "headline", "cta_button"],
        },
      },
      roteiros: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            titulo: { type: "string" },
            campanha: { type: "string", description: "awareness ou sales" },
            duracao_seg: { type: "integer" },
            cenas: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  tempo: { type: "string", description: "ex: 0-3s" },
                  cena_broll: { type: "string" },
                  fala: { type: "string" },
                  texto_tela: { type: "string" },
                },
                required: ["tempo", "fala", "texto_tela"],
              },
            },
          },
          required: ["titulo", "campanha", "cenas"],
        },
      },
      observacoes: { type: "string", description: "Pontos de atencao: evento de otimizacao real, geo, leitura de performance, quando reavaliar" },
    },
    required: ["posicionamento", "aviso_compliance", "conceitos", "headlines", "checklist_producao", "campaign_name", "objective", "phase", "adsets", "creatives", "roteiros", "observacoes"],
  },
};

async function callClaude(apiKey: string, system: string, userContent: string, tool: any) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    console.error("claude error:", res.status, (await res.text()).slice(0, 400));
    return null;
  }
  const data = await res.json();
  const block = (data?.content ?? []).find((b: any) => b.type === "tool_use");
  return block?.input ?? null;
}

async function handleEstrategista(payload: { brief?: Record<string, unknown>; briefing?: Record<string, unknown>; session_id?: string; initiative_id?: string }) {
  const apiKey = await getIntegrationKey("anthropic", "ANTHROPIC_API_KEY");
  if (!apiKey) return { success: false, error: "ANTHROPIC_API_KEY missing", status: 500 };
  const brief = payload.brief ?? payload.briefing ?? {};

  const userContent = `Monte o plano completo da campanha Meta Ads a partir deste briefing. Preencha TODOS os campos do formulario (campaign_name, objective, phase, destination_url, ticket, cpl_max, adsets, creatives) e escreva 1 a 2 roteiros de criativo cena a cena. Os budget_diario dos adsets DEVEM somar o investimento diario informado.\n\nBRIEFING:\n${JSON.stringify(brief, null, 2)}`;

  const plan = await callClaude(apiKey, ESTRATEGISTA_PROMPT, userContent, planoCampanhaTool);
  if (!plan) return { success: false, error: "IA nao retornou plano", status: 502 };

  const admin = adminClient();
  const { data: output, error } = await admin
    .from("marketing_ai_outputs")
    .insert({
      session_id: payload.session_id ?? null,
      initiative_id: payload.initiative_id ?? null,
      agent: "estrategista",
      tipo: "campaign_plan",
      titulo: (plan as any).campaign_name ?? "Plano de campanha",
      briefing: brief,
      resultado: plan,
      raw_text: JSON.stringify(plan, null, 2),
      status: "gerado",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message, status: 500 };
  return { success: true, output_id: output.id, plano: plan };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action ?? "generate";
    let result: any;
    if (action === "generate") result = await handleGenerate(body);
    else if (action === "schedule_tick") result = await handleScheduleTick();
    else if (action === "estrategista") result = await handleEstrategista(body);
    else result = { success: false, error: "unknown action", status: 400 };
    const status = result.status ?? (result.success ? 200 : 500);
    delete result.status;
    return new Response(JSON.stringify(result), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("marketing-midia error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
