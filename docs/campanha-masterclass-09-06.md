# Campanha Masterclass IA Salvador, 09/06/2026

Documento operacional. Atualizar a cada mudança.

**Initiative ID:** `80cc23c0-d55c-4ba4-9fb2-e703db2b8935`
**Status:** ativa
**Criado:** 2026-05-21
**Última atualização:** 2026-05-21

## Contexto

| Campo | Valor |
|---|---|
| Evento | Masterclass IA presencial em Salvador |
| Tema | Como ganhar R$5k a R$15k/mês com IA |
| Data evento | 2026-06-09 (segunda-feira) |
| Local | Salvador, BA (raio captação 120km) |
| Capacidade total | 130 |
| Já vendidos | 33 |
| **Meta restante** | **97 vendas adicionais** |
| Ticket | R$97 |
| Faturamento alvo | R$9.409 (97 × R$97) |
| Janela | 19 dias (21/05 a 09/06) |

## Budget e expectativas

| Item | Valor |
|---|---|
| Budget mídia total | R$2.000 |
| CPL máximo aceitável | R$8 |
| CPA máximo aceitável | R$35 |
| Estimativa realista | 50 a 80 vendas adicionais |

Atingir 97 vendas com R$2k é desafio. Cenário base é 50-80. Pra subir esse número, dois caminhos:
- Reforço orgânico (DISC + WhatsApp + IG + visitantes site)
- Conversão WhatsApp da lista quente, com taxa esperada 15-25%

## Audiências (Custom Audiences Meta a criar)

| Nome | Fonte | Tamanho | Uso |
|---|---|---|---|
| DISC respondedores 2026 | Board CRM "Reprogramesse 10x" | 112 leads | Retarget morno + email blast |
| Compradores Masterclass | Board CRM "Masterclass IA (comprou)" | a confirmar | LAL 1% + retarget quente |
| LAL 1% Compradores | Lookalike da audience acima | 2M+ (1% Brasil) | Captação fria qualificada |
| Engajamento IG 365d | Auto Meta (perfil @carloseduardo.ia) | ~6.5k base | Captação morna |
| Visitantes squaad.com.br/masterclass-ia 60d | Pixel `960069026909883` | crescente | Aquecimento + retarget |

## Identidade técnica

| Asset | Valor |
|---|---|
| Business Manager | Squaad Business Solution (`772674652542589`) |
| Ad Account | BM-Squaad (`act_900122122945508`), BRL, America/Bahia, ACTIVE |
| Pixel | Pixel Squaad Ads (`960069026909883`) |
| Page | Caduh (`1108460375977974`) |
| IG Business | @carloseduardo.ia (`17841400307325415`) |
| App ID | `1405201087970275` |
| URL destino | https://squaad.com.br/masterclass-ia |
| Checkout | Kirvano (https://pay.kirvano.com/21799188-eac1-4542-bb27-c6ad2600062c) |

## Eventos pixel disparando hoje

| Evento | Onde | Status |
|---|---|---|
| PageView | LP automático | ✓ |
| Lead | MasterclassLeadPopup ao preencher | ✓ |
| InitiateCheckout | MasterclassLeadPopup ao avançar pra checkout | ✓ |
| **Purchase** | A configurar via webhook Kirvano (CAPI) | ✗ pendente |

## Estrutura de campanhas (5 campanhas, R$2.000 distribuídos)

### 1. Captação FRIA, R$840 (21/05 → 03/06, 14 dias)

| Campo | Valor |
|---|---|
| Objetivo ODAX | OUTCOME_TRAFFIC (até Purchase rolar; depois migra OUTCOME_SALES) |
| Optimization goal | LANDING_PAGE_VIEWS |
| Status | PAUSED até revisão, depois ACTIVE |

**Adset 1: LAL 1% Compradores** R$30/dia
- Targeting: LAL 1% Compradores Masterclass, Brasil, raio Salvador 120km, 25-55
- Optimization: LANDING_PAGE_VIEWS

**Adset 2: Interesses BA** R$30/dia
- Targeting: Geo Salvador 120km, 25-55
- Interesses: Empreendedorismo, Inteligência artificial, ChatGPT, Marketing digital
- Optimization: LANDING_PAGE_VIEWS

### 2. Captação MORNA, R$420 (21/05 → 03/06, 14 dias)

**Adset 3: Engajamento IG + Visitantes** R$15/dia
- Custom audience: Engajamento IG @carloseduardo.ia 365d
- Custom audience: Visitantes LP 60d
- Geo Salvador 120km

**Adset 4: Retarget DISC** R$15/dia
- Custom audience: DISC respondedores 2026
- Excluir: compradores

### 3. AQUECIMENTO, R$500 (04/06 → 08/06, 5 dias)

**Adset 5: Leads capturados (não-compradores)** R$100/dia
- Custom audience: inscritos masterclass (gerada via popup)
- Excluir: compradores
- Criativos com urgência: "Faltam 5 dias", "Última semana", "Amanhã é o dia"

### 4. DIA D, R$200 (09/06, lifetime budget)

**Adset 6: Última chance** lifetime R$200
- Geo Salvador 50km
- Criativo "ÚLTIMA CHANCE"
- Optimization REACH

### 5. PÓS-EVENTO, R$105 (10/06 → 16/06, 7 dias)

**Adset 7: Remarketing não-compradores** R$15/dia
- Visitantes LP 30d, sem compra
- Bônus de recuperação (se aplicável)

## Apoios sem custo de mídia

| Canal | O que | Quando | Responsável |
|---|---|---|---|
| Email blast DISC | Anúncio inicial pra 112 leads do DISC | 23/05 | Carlos via `/admin/marketing/campanhas/nova` |
| Email sequence aquecimento | 5 emails | 04/06 a 09/06 | Sistema (automation) |
| WhatsApp broadcast 1 | Anúncio lista quente (DISC + compradores) | 24/05 | Carlos via UAZAPI |
| WhatsApp broadcast 2 | Aquecimento | 06/06 | Carlos |
| WhatsApp lembrete | Manhã do evento | 09/06 | Carlos |
| Conteúdo orgânico IG | Posts/stories | Contínuo | Carlos |

## Próximas ações sistêmicas (pendente implementação)

| Item | Status | Responsável |
|---|---|---|
| Edge `marketing-meta` action `export_audience` (puxa board CRM, sobe Custom Audience Meta) | Pendente | Sistema |
| Edge `kirvano-webhook` (recebe venda aprovada, dispara Purchase via CAPI) | Pendente | Sistema |
| Liberar 1 slot de edge (limite 100/100 atingido) | Pendente, autorização Carlos | Sistema |
| Configurar webhook Kirvano apontando pra `kirvano-webhook` | Pendente | Carlos (cola URL no painel Kirvano) |
| Subir 4 Custom Audiences no Meta | Pendente | Sistema (após edge export_audience) |

## Regras operacionais

- **Tudo entra PAUSED.** Carlos confere no Ads Manager BM-Squaad e ativa manualmente.
- **Regra dos 3 períodos** antes de pausar/escalar: bom vitalício + 7d + hoje só pausa se ruim nos 3.
- **Cron 4h** roda sync de insights + relatório consolidado em `/admin/marketing/midia`.
- **Toda alteração de plano** Carlos comunica e doc é atualizado.

## Como medir sucesso

| KPI | Meta | Como medir |
|---|---|---|
| Leads inscritos | 1.000 | Inscrições LP via popup |
| CPL médio | ≤ R$8 | Meta Insights |
| Vendas | 97 | Kirvano sales |
| ROAS | ≥ 4x (R$2k investido, R$9.4k retorno) | Faturamento Kirvano / spend |
| No-show | ≤ 20% | Lista presença evento |

## Histórico de mudanças

- **2026-05-21 21:30** Iniciativa criada. Carlos confirmou autonomia. Budget R$2k, meta 97 vendas, evento 09/06.
