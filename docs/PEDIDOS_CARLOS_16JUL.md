# Pedidos do Carlos — 16/07/2026

Registro do que foi pedido numa rodada grande, pra nada se perder (como o artifact da
landing se perdeu por eu não ter aberto o link). Cada item tem estado.

## 1. Remover linguagem comercial da área de membros — FEITO
- ✅ "Meta de Vendas" (SalesProgress) removida da tela `/maisvencedores/membros/vendas`
- ✅ "Contribuição 5%" removida do SalesStats
- ✅ "sua contribuição para o grupo" (subtítulo) reescrito
- ✅ Ranking Anual com prêmios chumbados (passagens aéreas, mentoria) removido
- ✅ Página reenquadrada: "Negócios da rede" — celebra o que a conexão gerou, não meta.
  Motivo do Carlos: "nossa proposta não é vincular esse projeto com ganhos diretos, mas uma
  rede de conexões, autodesenvolvimento, crescimento pessoal e empresarial". Moeda = ponto.
- Os componentes SalesProgress/AnnualRanking seguem no repo, sem uso, caso o modelo mude.

## 2. Apertar espaçamento da landing — FEITO (parcial)
- ✅ Paddings das dobras de 96-120px → 64-72px. Carlos: "página muito espaçada".
- ⏳ Falta: "zero gatilhos" — a página não tem CTAs no meio, prova social, urgência entre as
  dobras. Isso é a auditoria de conversão, ainda pendente.

## 3. Primeiro acesso / cadastro — campos obrigatórios — PENDENTE
Carlos: no cadastro perguntar **faixa** (já feito, opcional), e coletar OBRIGATÓRIO:
- Nome completo (já tem)
- Instagram (OBRIGATÓRIO — hoje não coleta no signup)
- WhatsApp / telefone
- CPF (validar formato)
- Data de nascimento
- Email (já tem)
`profiles` já tem: cpf, telefone, instagram, birth_date/birthdate. Falta o form + trigger
passar esses campos via raw_user_meta_data (padrão já montado em handle_new_user).

## 4. Notificação em tempo real pro padrinho — PENDENTE
"aprovação tem que ocorrer e você notificar quem indicou em tempo real que a indicação deu
certo, para manter todos cientes da evolução". Supabase Realtime na tabela `referrals`
(status pending→approved) ou `referral_conversions`. A RPC `minhas_indicacoes()` já entrega
o dado do funil. Falta o canal realtime + toast/badge no app.

## 5. Resend pro ADMIN disparar email do ecossistema — PENDENTE
"conectado com o resend para parte admin para comunicar informações do nosso ecossistema
através do email disparado pelo ADMIN". CUIDADO: Resend não usa secret, lê da tabela
`email_config` (row singleton), que está VAZIA — precisa a chave. E há o teto de 100 edge
functions (deploy bloqueado por 402). Ver memória vencedores-secrets-pendentes.
ATENÇÃO SPF: a zona do domínio tem `v=spf1 -all` (bloqueia TODO envio) — trocar por
include:_spf.resend.com antes de disparar, senão email some.

## 6. Auditoria de layout — enterprise/premium/corporativo — PENDENTE
Carlos quer o app inteiro com "padrão enterprise". Auditoria ampla, merece sessão dedicada.

---

## PROMPTS DE COMPONENTES (integrar quando chegar a vez)

### 6a. HERO da landing — canvas.tsx (mouse-trail neon)
Um `<canvas>` full-screen com rastro de linhas que segue o mouse, cor em hsl rotativo.
RESSALVA DE DESIGN: o efeito é um rastro NEON ARCO-ÍRIS sobre preto. Isso é chamativo/lúdico,
o OPOSTO de "enterprise/premium" que o Carlos também pediu. Há tensão entre "colocar esse hero"
e "deixar corporativo". Integrar pra ele VER e decidir, mas avisar. Depende: só framer-motion
(já temos). O `renderCanvas` é vanilla JS num `#canvas`. Precisa adaptar de Next (`"use client"`,
next/link, DIcons) pra Vite+react-router. Código completo salvo no histórico do chat 16/07.

### 6b. TREINADORES na dobra "Quem está por trás" — card-stack.tsx (leque 3D)
Carrossel de cards em leque 3D, arrastável, auto-advance. Carlos: "nessa dobra vai ficar as
fotos dos treinadores com nome". Substituir a lista atual (Ludmila, Soraya, Alexandre, Claudia
como texto) por este card-stack COM AS FOTOS. Bloqueio: ainda não temos foto de nenhum treinador
(tabela `treinadores` tem os 5 nomes, foto_url null). Adaptar de Next (next/link) pra
react-router. Depende: framer-motion (temos), lucide-react (temos). Código completo no chat.

### 6c. MEMBROS por faixa na área — team.tsx (grid por seção)
Grid de avatares agrupado. Carlos: "ao invés de Leadership/Engineering/Marketing, agrupar por
FAIXA; os que têm mais pontos ficam na frente". Ou seja: seções = faixas (Preta, Marrom, Roxa…),
dentro de cada faixa ordenar por pontos desc. Usar dado real (mural_de_membros já dá foto+nome;
precisaria de RPC que também devolva faixa e pontos). Onde: dentro de /maisvencedores/membros,
provavelmente em Portfólios. Código completo no chat.

Todos os 3 prompts vieram no formato "integrate an existing React component" e mandam encher
imagem com Unsplash — NÃO fazer isso pra pessoas reais (mesma regra dos depoimentos falsos):
foto de membro/treinador só quando houver a real.
