import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

interface DiagnosticoInput {
  profissao: string;
  ddd?: string;
  cidade?: string;
  estado?: string;
  nome?: string;
  instagram_username?: string;
  instagram_summary?: {
    followers?: number;
    following?: number;
    posts_count?: number;
    bio?: string;
    category?: string | null;
    is_business?: boolean;
    is_verified?: boolean;
    recent_captions?: string[];
  };
}

interface OportunidadeBloco {
  titulo: string;
  descricao: string;
}

interface LeituraInstagram {
  observacoes: string[];
  recomendacao_baseada_nisso: string;
}

interface DiagnosticoResult {
  headline: string;
  cenario_atual: string;
  oportunidade: {
    crm_ai_first: OportunidadeBloco;
    prospeccao_ativa: OportunidadeBloco;
    ia_atendimento: OportunidadeBloco;
  };
  implantacao: {
    descricao: string;
    ticket_implantacao: string;
    manutencao_mensal: string;
  };
  reducao_custos: {
    descricao: string;
    economia_estimada: string;
    ferramentas_substituiveis: string[];
  };
  diferencial_squaad: string;
  call_to_action: string;
  leitura_instagram?: LeituraInstagram;
}

const SYSTEM_PROMPT = `Voce e o head de estrategia da SQUAAD. A SQUAAD ja transformou mais de 40 empresas em operacoes AI First. Voce esta entregando um diagnostico para um decisor que pediu avaliacao do proprio negocio.

# REGRA #1 — ENTENDA O NEGOCIO ANTES DE PROPOR

Antes de gerar qualquer coisa, voce DEVE raciocinar (silenciosamente) sobre o funil real desse profissional:

1. Quem e o cliente final? (paciente, aluno, comprador, contratante, parceiro)
2. Quem PAGA pelo servico? (o cliente direto? plano de saude? escola? pais? empresa?)
3. Como esse profissional adquire cliente HOJE? (indicacao, marketing, institucional, prospeccao ativa, etc)
4. Onde esta o gargalo da operacao? (captar, atender, organizar, cobrar, entregar)
5. Esse profissional vende para PESSOAS, EMPRESAS ou INSTITUICOES?

So depois de responder isso, voce aplica os pilares.

# ERROS PROIBIDOS

NUNCA cometa estes erros:
- Sugerir prospeccao ativa de pais para uma professora de escola (ela nao prospecta pais — a escola contrata ela ou ela faz aulas particulares para alunos especificos).
- Sugerir prospeccao para profissoes onde o cliente vem por indicacao ou regulamentacao (ex: medico de plano, defensor publico, juiz).
- Sugerir CRM de pacientes para um defensor publico (ele nao gerencia pacientes — gerencia processos).
- Aplicar os 3 pilares como se fossem receita de bolo igual para qualquer nicho.
- Generalizar. "Atendimento ao cliente" sem dizer QUE cliente e fraco.

# COMO ADAPTAR OS 3 PILARES

Cada pilar tem um TITULO e uma DESCRICAO. Voce deve adaptar o titulo a realidade do nicho mantendo a essencia:

## CRM AI First
Essencia: gestao centralizada e inteligente de relacionamento com QUEM IMPORTA para o negocio.
Exemplos de adaptacao:
- Medico clinico: "CRM de pacientes com pre-consulta automatizada"
- Professor de escola: "Plataforma de gestao de turmas e relatorios para os pais"
- Professor particular: "CRM de alunos com agenda + entrega de tarefas"
- Advogado: "CRM de processos com triagem inicial automatizada"
- Imobiliaria: "CRM de leads e proprietarios com matching inteligente"
- Mentor: "CRM de mentorados com tracking de evolucao"
- Tricologista: "Prontuario inteligente de pacientes com followup de tratamento"

## Prospeccao Ativa
Essencia: aquisicao de cliente em escala. SE o nicho nao prospecta, ADAPTE para captacao passiva inteligente, conteudo, parceria automatizada ou indicacao.
Exemplos:
- Coach: "Prospeccao ativa B2B para empresas que precisam de programas de desenvolvimento"
- Professor de escola publica: NAO usar "prospeccao". Usar "Programa de aulas particulares automatizado" ou "Conteudo educacional escalado para mais alunos por aula"
- Medico de plano: "Captacao de particulares + retencao da base atual" (nao prospecta plano, prospecta particular)
- Advogado de massa: "Prospeccao ativa de empresas com perfil de litigio recorrente"
- Contador: "Prospeccao ativa de pequenas empresas no entorno + retencao com servicos premium"
- Designer freelancer: "Prospeccao ativa de agencias e empresas no nicho dele"
- Esteticista de bairro: NAO prospeccao. Usar "Reativacao da base + indicacao automatizada"

## IA de Atendimento
Essencia: responder, qualificar e encaminhar 24/7.
Exemplos:
- Clinica: "Agente que agenda consulta, lembra de retorno, tira duvida pre-procedimento"
- Professor escola: "Agente que responde aos pais sobre tarefas, calendario e desempenho do aluno"
- Advogado: "Agente que faz triagem do caso, separa o que e e o que nao e processo"
- Imobiliaria: "Agente que qualifica interesse do cliente em imovel, faz tour virtual e agenda visita"
- Tricologista: "Agente que orienta sobre tratamento, agenda retorno, lembra de produtos"

# REALIDADE FINANCEIRA

- Ganho forte do consultor SQUAAD esta na IMPLANTACAO (one-shot). Tipicamente entre R$ 8 mil e R$ 35 mil dependendo do nicho.
- Manutencao mensal e MENOR que a implantacao. Tipicamente R$ 1.500 a R$ 5.000.
- Nunca diga que mensalidade = implantacao. Nunca prometa receita futura como certa.

# REDUCAO DE CUSTOS

A IA centraliza funcoes hoje espalhadas: RD Station, Trello, Notion, Power BI, Zoom Pro, gestor de trafego terceirizado, gerente comercial, SDR, ferramentas de email, dashboards, secretaria virtual, etc.
Cite 4-6 itens REAIS que o nicho do lead provavelmente paga hoje.
A economia mensal estimada deve ser plausivel.

# DIFERENCIAL SQUAAD

A operacao AI First que ensinamos, menos de 1% dos brasileiros executa. +40 empresas ja foram transformadas. Nao e teoria de prompt — e protocolo de implantacao.

# USO DO INSTAGRAM (quando disponivel)

Se o lead informou Instagram, voce recebe: bio, numero de seguidores, posts recentes (legendas), categoria, se e business.

Voce DEVE usar esses dados para personalizar o diagnostico de forma OBSERVAVEL. Nao escreva "vi seu Instagram" — DEMONSTRE que viu citando elementos especificos:

- Headline pode citar algo do perfil (ex: "Tricologista com 12 mil seguidores: o gargalo nao e visibilidade").
- Cenario_atual pode comentar a base de seguidores, frequencia de posts, foco do conteudo.
- Cada bloco da oportunidade deve referenciar a realidade observada (ex: "Voce ja capta atencao no Instagram, falta um agente que converta DM em consulta agendada").
- O bloco leitura_instagram (sempre que houver Instagram) deve trazer 3 observacoes ESPECIFICAS:
  * 1 sobre a base/perfil (seguidores, business, categoria)
  * 1 sobre o conteudo recente (tom dos posts, tema, engajamento aparente)
  * 1 sobre a bio e proposta de valor declarada
- A "recomendacao_baseada_nisso" deve dizer EXATAMENTE como o que foi visto muda a estrategia recomendada.

Se o lead NAO informou Instagram, NAO inclua o campo leitura_instagram no retorno.

# POSTURA

- Voce nao vende. Voce diagnostica.
- Tom de consultor de C-level: claro, denso, sem floreios.
- Frases curtas. Verbo no presente.
- Sem hiperbole. Sem promessa de retorno garantido. Sem numero magico.
- Portugues do Brasil. Sem emojis. Sem markdown. Sem exclamacoes.
- PROIBIDO usar travessao ( — ou - ) no meio das frases. Usa ponto, virgula ou ponto e virgula. Travessao da cara de IA.
- Nao use parenteses para apartes do tipo "(ou seja, ...)" ou "(ex: ...)". Reescreva como frase normal.

# OUTPUT

Responda APENAS chamando retornar_diagnostico (tool use). Sem texto adicional.`;

const tool = {
  type: "function",
  function: {
    name: "retornar_diagnostico",
    description: "Retorna o diagnostico estruturado de oportunidade IA adaptado ao nicho do profissional",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: {
          type: "string",
          description: "Frase executiva sobre o cenario do profissional. Sem hiperbole. Max 110 chars.",
        },
        cenario_atual: {
          type: "string",
          description: "Diagnostico realista do mercado dele em 1-2 frases, mencionando como o nicho dele opera hoje. Max 280 chars.",
        },
        oportunidade: {
          type: "object",
          additionalProperties: false,
          properties: {
            crm_ai_first: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: {
                  type: "string",
                  description: "Titulo curto adaptado ao nicho. Ex: 'CRM de pacientes', 'Plataforma de gestao de turmas'. Max 60 chars.",
                },
                descricao: {
                  type: "string",
                  description: "Aplicacao concreta para o nicho. Max 220 chars.",
                },
              },
              required: ["titulo", "descricao"],
            },
            prospeccao_ativa: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: {
                  type: "string",
                  description: "Titulo adaptado ao funil do nicho. Se prospeccao nao se aplica, troque para algo equivalente (ex: 'Captacao por indicacao automatizada'). Max 60 chars.",
                },
                descricao: {
                  type: "string",
                  description: "Aplicacao concreta para o nicho. Max 220 chars.",
                },
              },
              required: ["titulo", "descricao"],
            },
            ia_atendimento: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: {
                  type: "string",
                  description: "Titulo curto adaptado. Ex: 'Agente para pais e alunos', 'Agente de pre-consulta'. Max 60 chars.",
                },
                descricao: {
                  type: "string",
                  description: "Aplicacao concreta para o nicho. Max 220 chars.",
                },
              },
              required: ["titulo", "descricao"],
            },
          },
          required: ["crm_ai_first", "prospeccao_ativa", "ia_atendimento"],
        },
        implantacao: {
          type: "object",
          additionalProperties: false,
          properties: {
            descricao: {
              type: "string",
              description: "O que e entregue na implantacao especifica para o nicho. Max 240 chars.",
            },
            ticket_implantacao: {
              type: "string",
              description: "Faixa de ticket de implantacao (one-shot). Ex: 'R$ 8.000 a R$ 25.000'",
            },
            manutencao_mensal: {
              type: "string",
              description: "Faixa de manutencao mensal (MENOR que implantacao). Ex: 'R$ 1.500 a R$ 4.000/mes'",
            },
          },
          required: ["descricao", "ticket_implantacao", "manutencao_mensal"],
        },
        reducao_custos: {
          type: "object",
          additionalProperties: false,
          properties: {
            descricao: {
              type: "string",
              description: "Como a IA reduz custos do cliente. Max 200 chars.",
            },
            economia_estimada: {
              type: "string",
              description: "Estimativa mensal de economia. Ex: 'R$ 3.500 a R$ 8.000/mes'",
            },
            ferramentas_substituiveis: {
              type: "array",
              items: { type: "string" },
              description: "Lista de 4-6 ferramentas/servicos REAIS que o nicho dele provavelmente paga hoje e podem ser reduzidos.",
            },
          },
          required: ["descricao", "economia_estimada", "ferramentas_substituiveis"],
        },
        diferencial_squaad: {
          type: "string",
          description: "Por que a Masterclass SQUAAD e diferente. Cite +40 empresas e <1% dos brasileiros. Max 240 chars.",
        },
        call_to_action: {
          type: "string",
          description: "Frase final convidando a entrar para a Masterclass. Max 140 chars.",
        },
        leitura_instagram: {
          type: "object",
          description: "PRESENTE APENAS se o lead informou Instagram. Demonstra que voce analisou o perfil de fato. Omita o campo se nao houver Instagram.",
          additionalProperties: false,
          properties: {
            observacoes: {
              type: "array",
              items: { type: "string" },
              description: "Exatamente 3 observacoes ESPECIFICAS do perfil: (1) base/perfil, (2) conteudo recente, (3) bio. Cada uma com max 160 chars. Cite numeros e palavras concretas vistas.",
            },
            recomendacao_baseada_nisso: {
              type: "string",
              description: "Como o que foi observado muda a estrategia recomendada. Frase direta. Max 240 chars.",
            },
          },
          required: ["observacoes", "recomendacao_baseada_nisso"],
        },
      },
      required: [
        "headline",
        "cenario_atual",
        "oportunidade",
        "implantacao",
        "reducao_custos",
        "diferencial_squaad",
        "call_to_action",
      ],
    },
  },
};

function fallbackDiagnostico(input: DiagnosticoInput): DiagnosticoResult {
  const profCap = input.profissao.charAt(0).toUpperCase() + input.profissao.slice(1);
  const cidade = input.cidade ?? "sua regiao";
  return {
    headline: `${profCap} em ${cidade}: a janela de adocao continua aberta.`,
    cenario_atual:
      "A maior parte do seu nicho opera com processos manuais e ferramentas desconectadas. Quem implementa AI First primeiro define o padrao do setor pelos proximos cinco anos.",
    oportunidade: {
      crm_ai_first: {
        titulo: "CRM AI First do nicho",
        descricao:
          "Operacao construida ao redor da inteligencia. Qualifica, agenda e prepara o atendimento humano.",
      },
      prospeccao_ativa: {
        titulo: "Aquisicao em escala",
        descricao:
          "Captura e abordagem direcionadas ao perfil exato do seu cliente. Mensagem por IA, ritmo definido pela conversao.",
      },
      ia_atendimento: {
        titulo: "Agente 24/7",
        descricao:
          "Atende, qualifica e encaminha. Hoje e commodity. Sem isso, conversao cai todo dia.",
      },
    },
    implantacao: {
      descricao:
        "Entrega completa: CRM AI First, captacao ativa adaptada ao funil, IA de atendimento no WhatsApp e dashboards conectados.",
      ticket_implantacao: "R$ 8.000 a R$ 25.000",
      manutencao_mensal: "R$ 1.500 a R$ 4.000/mes",
    },
    reducao_custos: {
      descricao:
        "A operacao AI First centraliza funcoes que hoje estao em ferramentas e fornecedores diferentes.",
      economia_estimada: "R$ 3.500 a R$ 8.000/mes",
      ferramentas_substituiveis: [
        "RD Station",
        "Power BI",
        "Trello / Notion",
        "Zoom Pro",
        "Gestor de trafego terceirizado",
      ],
    },
    diferencial_squaad:
      "Mais de 40 empresas ja foram transformadas pelo metodo SQUAAD. O que se aprende aqui menos de 1% dos brasileiros executa. Nao e teoria de IA. E protocolo de implantacao.",
    call_to_action: "Entrar para a Masterclass e implantar isso no seu negocio.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input = (await req.json()) as DiagnosticoInput;
    if (!input.profissao || input.profissao.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "profissao required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
    if (!apiKey) {
      console.warn("LOVABLE_API_KEY not set, using fallback");
      return new Response(
        JSON.stringify({ success: true, source: "fallback", diagnostico: fallbackDiagnostico(input) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ig = input.instagram_summary;
    const igBlock = ig
      ? `\nINSTAGRAM ANALISADO (use isso para personalizar o diagnostico de forma observavel):
- Username: @${input.instagram_username ?? "(n/a)"}
- Seguidores: ${ig.followers ?? "?"} | Seguindo: ${ig.following ?? "?"} | Posts: ${ig.posts_count ?? "?"}
- Verificado: ${ig.is_verified ? "sim" : "nao"} | Conta business: ${ig.is_business ? "sim" : "nao"}
- Categoria declarada: ${ig.category ?? "(nao informada)"}
- Bio (texto exato): "${(ig.bio ?? "").trim() || "(vazia)"}"
- Legendas dos posts mais recentes:
${(ig.recent_captions ?? []).slice(0, 5).map((c, i) => `  ${i + 1}. "${c.slice(0, 200)}"`).join("\n") || "  (nenhuma capturada)"}
\nUse esses dados para gerar o bloco leitura_instagram com 3 observacoes especificas e citar elementos concretos no headline, cenario_atual e nas descricoes dos pilares.`
      : "\n(Lead nao informou Instagram. NAO inclua o campo leitura_instagram no retorno.)";

    const userPrompt = `Lead a ser diagnosticado:
- Nome: ${input.nome ?? "(nao informado)"}
- Profissao: ${input.profissao}
- Cidade/Estado: ${input.cidade ?? "(nao informado)"} / ${input.estado ?? "(nao informado)"}
- DDD: ${input.ddd ?? "(nao informado)"}
${igBlock}

ANTES de responder, raciocine internamente:
1. Quem e o cliente desse profissional?
2. Quem paga pelo servico?
3. Como ele adquire cliente hoje?
4. Onde esta o gargalo?
5. (Se ha Instagram) O que o perfil diz sobre o estagio do negocio?

Depois aplique os 3 pilares ADAPTADOS a essa realidade. Cite elementos concretos do Instagram quando disponivel. Nao invente prospeccao para quem nao prospecta. Nao sugira CRM de pacientes para quem nao tem paciente.

Retorne chamando retornar_diagnostico.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "retornar_diagnostico" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini gateway error:", response.status, errText.slice(0, 300));
      return new Response(
        JSON.stringify({ success: true, source: "fallback", diagnostico: fallbackDiagnostico(input) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;

    if (!args) {
      return new Response(
        JSON.stringify({ success: true, source: "fallback", diagnostico: fallbackDiagnostico(input) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: DiagnosticoResult;
    try {
      parsed = JSON.parse(args);
    } catch {
      parsed = fallbackDiagnostico(input);
    }

    return new Response(
      JSON.stringify({ success: true, source: "gemini", diagnostico: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("masterclass-diagnostico error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
