---
name: prospeccao-digital
description: >
  Skill de prospecção digital automatizada para negócios locais. Use esta skill sempre que o usuário pedir para:
  prospectar clientes/empresas, fazer análise digital de um negócio, gerar diagnóstico de presença digital,
  analisar site/SEO/Instagram de uma empresa, abordar um lead no Instagram com oportunidades de melhoria,
  reagir a stories no Instagram, ou qualquer combinação dessas atividades. Também use quando o usuário
  mencionar "prospecção", "diagnóstico digital", "análise de concorrente", "captação de leads",
  "abordagem comercial", ou quiser encontrar negócios locais para prospectar via Google Maps/Google Meu Negócio.
---

# Prospecção Digital Automatizada

Skill para prospectar negócios locais, analisar sua presença digital (site + Instagram + Google Meu Negócio), gerar um diagnóstico profissional em PDF, e abordar o lead via Instagram DM.

## Workflow Completo

O fluxo completo tem 5 etapas. O usuário pode pedir todas ou apenas parte delas — adapte conforme o pedido.

### Etapa 1: Encontrar o Prospect

Buscar no Google Maps/Google Meu Negócio usando Chrome (`navigate` para `https://www.google.com/maps/search/{nicho}+{cidade}`).

Critérios para selecionar um bom prospect:
- Nota alta (4.5+) com volume razoável de avaliações (mostra que tem clientes mas pode crescer digitalmente)
- Localização premium (bairro nobre = potencial de investimento)
- Sinais de que não investem bem em digital (poucos seguidores, site fraco, etc.)

Extraia via JavaScript: nome, nota, número de avaliações, endereço, telefone, site, horário.

### Etapa 2: Análise do Site

Navegue ao site do prospect e execute análise via `javascript_tool`. Extraia:

**SEO:**
- `document.title` — título da página
- `document.querySelector('meta[name="description"]')?.content` — meta description
- `document.querySelector('h1')?.textContent` — H1 principal
- Presença de Schema/JSON-LD: `document.querySelectorAll('script[type="application/ld+json"]')`
- Tags Open Graph: `document.querySelectorAll('meta[property^="og:"]')`
- Contagem de CSS/JS: `document.querySelectorAll('link[rel="stylesheet"]').length` e `document.querySelectorAll('script[src]').length`

**Conversão:**
- Formulários: `document.querySelectorAll('form').length`
- CTAs: botões e links com textos de ação
- Prova social (depoimentos, avaliações)
- WhatsApp/chat widgets

**Avaliação (escala 1-10):**
- SEO: considere título, meta description, H1, schema, OG tags, velocidade
- Conversão: considere formulários, CTAs, prova social, canais de contato
- Gere notas com justificativas curtas

### Etapa 3: Análise do Instagram

Navegue ao perfil do Instagram do prospect. O Instagram nunca chega ao estado "idle", então as ferramentas `read_page`, `find` e `screenshot` vão falhar. Use **exclusivamente** `javascript_tool` para todas as interações.

**Extrair métricas do perfil:**
```javascript
// No perfil do Instagram, extrair dados do header
const header = document.querySelector('header');
const spans = header?.querySelectorAll('span') || [];
const bio = document.querySelector('div.-vDIg span')?.textContent ||
            document.querySelector('[class*="bio"]')?.textContent || '';
// Procure por números de seguidores, seguindo, posts nos spans
```

**O que analisar:**
- Número de seguidores, seguindo, e posts
- Ratio seguindo/seguidores (ideal < 0.15 para parecer orgânico)
- Bio: tem proposta de valor clara? CTA? Link otimizado?
- Highlights: quantos e quais temas
- Conteúdo: tipos de post (educativo, institucional, promocional), frequência
- Engajamento aparente nos posts recentes

**Avaliação (escala 1-10):**
- Posicionamento: bio, identidade visual, proposta de valor
- Engajamento: interação nos posts, frequência, tipos de conteúdo

### Etapa 4: Gerar Diagnóstico PDF Premium

Execute o script `scripts/gerar_diagnostico.py` passando os dados coletados como JSON. O script gera um PDF **premium com dark theme**, construído com canvas customizado do reportlab (NÃO use SimpleDocTemplate, o resultado fica sem graça).

**Visual do PDF:**
- Fundo escuro (#0f172a slate-900) nas páginas de capa e destaque
- Cards de score com barras de progresso coloridas (verde/laranja/vermelho por faixa de nota)
- Accent azul (#3b82f6) para títulos e elementos de destaque
- Páginas de conteúdo em fundo claro com barra lateral azul
- Tipografia hierárquica clara, bastante respiro entre blocos

**Estrutura (7 páginas):**
1. **Capa** (dark): nome da empresa, dados de contato, data, elaborado por
2. **Sumário Executivo** (dark): cards com notas por área + barras de progresso
3. **Análise do Site** (light): problemas de SEO + problemas de conversão
4. **Análise do Google Meu Negócio** (light): pontos fortes + oportunidades
5. **Análise do Instagram** (light): métricas + problemas de posicionamento + conteúdo
6. **Plano de Ação**: quick wins (30 dias), médio prazo (60-90 dias), longo prazo (6-12 meses)
7. **Impacto Projetado + CTA** (dark): tabela de métricas atuais vs projetadas e convite para call

**Para usar o script:**
```bash
# Via arquivo JSON
python scripts/gerar_diagnostico.py \
  --data-file /path/to/diagnostico_data.json \
  --output /path/to/output.pdf

# Via JSON string inline
python scripts/gerar_diagnostico.py \
  --data '{"empresa": "Nome", "instagram": "@handle", ...}' \
  --output /path/to/output.pdf
```

**Schema do JSON esperado:**
```json
{
  "empresa": "Nome da Clínica/Empresa",
  "contato": {"telefone": "...", "site": "...", "instagram": "@..."},
  "elaborado_por": "Seu Nome",
  "email": "seu@email.com",
  "notas": {
    "site_seo": 7.0,
    "site_conversao": 5.5,
    "google_meu_negocio": 8.0,
    "instagram_posicionamento": 4.5,
    "instagram_engajamento": 4.0
  },
  "site": {"problemas_seo": ["..."], "problemas_conversao": ["..."]},
  "gmb": {"pontos_fortes": ["..."], "oportunidades": ["..."]},
  "instagram": {
    "metricas": {"seguidores": "...", "posts": "..."},
    "problemas_posicionamento": ["..."],
    "problemas_conteudo": ["..."]
  },
  "plano_acao": {
    "quick_wins": ["..."],
    "medio_prazo": ["..."],
    "longo_prazo": ["..."]
  },
  "impacto": [
    {"metrica": "Leads/mês", "atual": "5", "projetado": "25"}
  ]
}
```

Leia `references/pdf_structure.md` para detalhes do layout se precisar customizar.

### Etapa 5: Abordar no Instagram via DM

Navegue ao perfil do Instagram do prospect e envie uma DM. O padrão que funciona:

**Para abrir a DM (mini-chat popup do perfil):**
```javascript
// Encontrar e clicar no botão "Enviar mensagem" / "Message" no perfil
const buttons = [...document.querySelectorAll('button, div[role="button"]')];
const msgBtn = buttons.find(b =>
  b.textContent.includes('Enviar mensagem') ||
  b.textContent.includes('Message') ||
  b.textContent.includes('Mensagem')
);
if (msgBtn) msgBtn.click();
```

**Para digitar e enviar a mensagem:**
```javascript
// Aguardar a caixa de texto aparecer, depois injetar valor
const textarea = document.querySelector('textarea[placeholder]');
if (textarea) {
  const nativeSet = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  nativeSet.call(textarea, 'SUA MENSAGEM AQUI');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}
```

```javascript
// Clicar no botão Enviar
const sendBtn = [...document.querySelectorAll('button, div[role="button"]')].find(b =>
  b.textContent.trim() === 'Enviar' || b.textContent.trim() === 'Send'
) || document.querySelector('button[type="submit"]');
if (sendBtn) sendBtn.click();
```

**Regras obrigatórias do tom da mensagem:**

1. **SEM emoji.** Nenhum. Nem no começo, nem no fim, nem no meio.
2. **SEM traço longo** (—). Use vírgula, ponto ou quebra de linha.
3. **Tom humano e direto**, como se fosse uma pessoa real digitando no celular. Português natural, sem formalidade de e-mail corporativo.
4. **Interessante antes de interessado.** A primeira mensagem entrega valor, não pede nada. Fala de algo específico que você notou no negócio do cara. Só depois que ele responde é que você fala do diagnóstico e da call.
5. **Personalizado de verdade.** Cita um ponto específico do site ou do Instagram do prospect. Se não tiver nada específico, não manda.
6. **Curta.** Se passou de 5 linhas, tá longa demais.

**Template de abordagem (primeira mensagem):**
```
Oi [nome], tudo certo?

Tava olhando o [site/perfil] de vocês e reparei em [ponto específico que chama atenção, elogio ou gap]. [Uma frase explicando rapidinho o que viu].

Trabalho com [sua área] pra negócios de [nicho] e fiz um diagnóstico rápido da presença digital de vocês, achei uns pontos que podem render bastante.

Quer dar uma olhada?
```

**Template de follow-up (quando o prospect responde "pode mandar"):**
```
Show, segue aí.

Dei uma olhada em site, Instagram e Google Meu Negócio, listei as oportunidades que achei mais relevantes e montei um plano de ação dividido por prazo.

Se fizer sentido, topa marcar uma call rápida de 30 minutos essa semana pra gente conversar sobre os pontos? Sem compromisso.
```

**Exemplos de ganchos específicos que funcionam como abertura:**
- "seu Google tá com nota alta mas o site não tem nem WhatsApp visível"
- "vi que vocês postam bastante mas o perfil não tem CTA nenhum na bio"
- "o site carrega rápido mas não tem nenhum formulário pra capturar lead"
- "reparei que vocês têm X avaliações no Google, mas no Instagram só X seguidores, dá pra melhorar muito isso"
- "gostei muito da identidade visual de vocês no feed, mas tem um gap forte de conversão no site"

**O que NUNCA fazer na DM:**
- Começar com "Olá [Nome]! Tudo bem?" seguido de apresentação formal (cara de template de IA)
- Usar "trabalho com [área]" antes de falar de algo específico do negócio do prospect
- Mandar lista de problemas com emoji de lupa, gráfico, etc
- Pedir call na primeira mensagem
- Usar "sem compromisso" com carinha sorridente no final

### Etapa Bônus: Reagir a Stories

Para reagir a stories de pessoas que o usuário segue:

1. Na página principal do Instagram, clique no story desejado via JavaScript
2. Encontre o textarea de reação
3. Injete o emoji (🔥 é o mais comum) usando o mesmo padrão de `nativeSet`
4. Clique em "Enviar"

```javascript
// Clicar em um story do feed
const storyItems = document.querySelectorAll('[role="button"] img[alt]');
// Selecionar o desejado e clicar
```

## Regras Importantes sobre Instagram via Chrome

Estas regras vêm de experiência direta e são essenciais para que a automação funcione:

1. **O Instagram nunca chega ao estado "idle"** — os scripts de background rodam continuamente. Isso significa que `read_page`, `find` e `screenshot` vão falhar ou travar. Use sempre `javascript_tool`.

2. **Para injetar texto em inputs do React**, use o padrão `Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set` + dispatching eventos `input` e `change`. Simplesmente setar `.value` não funciona porque o React não detecta a mudança.

3. **Upload de arquivos via DM não funciona** programaticamente. O React bloqueia injeção de arquivos via DataTransfer API. Se precisar enviar imagens, instrua o usuário a fazer manualmente ou envie apenas texto.

4. **Stories avançam automaticamente** — trabalhe rápido ao interagir com stories.

5. **"Ver story" popup**: ao navegar direto para `/stories/username/`, pode aparecer um popup de confirmação. Clique nele antes de interagir.

6. **Contas business** podem ter DMs separados em "Mensagens de parceria". Se a DM não aparecer na caixa principal, procure nessa seção.

## Personalização

O usuário deve configurar:
- **Seu nome**: para aparecer no diagnóstico e na mensagem de abordagem
- **Sua área**: ex: "Inteligência Artificial para Negócios", "Marketing Digital"
- **Seu email**: para o rodapé do diagnóstico
- **Nicho alvo**: ex: "dentista", "restaurante", "academia"
- **Cidade**: ex: "Belo Horizonte", "São Paulo"

Se o usuário não fornecer esses dados, pergunte antes de iniciar.

## Dependências

- Python 3 com `reportlab` (para gerar o PDF)
- `pdf2image` + `poppler-utils` (se precisar converter PDF para imagens)
- Chrome com Instagram logado (para análise do Instagram e abordagem)
- Acesso ao Google Maps via Chrome (para encontrar prospects)
