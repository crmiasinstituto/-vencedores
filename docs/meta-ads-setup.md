# Setup Meta Ads no SQUAAD CRM

Pra subir campanhas Meta Ads, criar adsets, ads e ler insights nos 3 períodos via Graph API v21.0, o CRM precisa de 6 credenciais obrigatórias + 2 opcionais.

Esse passo a passo guia você na coleta de cada uma. No final, joga tudo em `/admin/marketing/integracoes/meta` e o sistema valida automaticamente contra a API antes de salvar.

## Pré-requisitos do Business Manager

Antes de começar, confirme que tudo isso existe e está vinculado ao seu Meta Business Manager:

- [ ] BM ativo em [business.facebook.com](https://business.facebook.com)
- [ ] Ad Account criada e vinculada ao BM
- [ ] Página do Facebook conectada ao BM
- [ ] Conta Instagram Business conectada ao BM (vinculada à Página)
- [ ] Pixel criado no Events Manager
- [ ] Seu usuário é admin do BM e tem acesso de admin à Ad Account, Página e Pixel

Se algum desses estiver faltando, resolva antes. Sem BM completo nada funciona.

---

## 1. Ad Account ID (obrigatório)

**Onde:** Meta Ads Manager, [adsmanager.facebook.com](https://adsmanager.facebook.com)

**Passos:**
1. Abra o Ads Manager
2. No canto superior esquerdo, clique no seletor de conta
3. O ID aparece logo abaixo do nome da conta, formato `act_123456789012345`
4. **Copie apenas os dígitos**, sem o prefixo `act_`

**Exemplo do que você vai colar no sistema:** `123456789012345`

**Risco de errar:** colar com `act_` na frente quebra todas as chamadas. O sistema rejeita.

---

## 2. Page ID, Facebook Page (obrigatório)

**Onde:** página da sua marca no Facebook

**Caminho A, pelo Business Manager (recomendado):**
1. business.facebook.com, Configurações do Negócio, Páginas
2. Clique na sua página
3. Copie o ID que aparece abaixo do nome

**Caminho B, pela própria página:**
1. Vá em facebook.com/sua-page
2. Menu lateral, Sobre
3. Role até o fim, Informações da Página, ID da Página

**Exemplo do que você vai colar:** `987654321098765`

**Pra que serve:** todo `object_story_spec` precisa do `page_id`. Sem isso, nenhum criativo pode ser criado.

---

## 3. Instagram Business Account ID (obrigatório)

**Onde:** Business Manager

**Passos:**
1. business.facebook.com, Configurações do Negócio
2. Contas, Contas do Instagram
3. Clique na conta vinculada à sua marca
4. Copie o ID na parte de cima da tela

**Exemplo:** `17841412345678901`

**Pra que serve:** cross-post automático de Reels e Stories no Instagram. Sem isso, anúncios saem só no Facebook.

**Atenção:** precisa ser conta Instagram Business (não pessoal). Se for pessoal, converta em Configurações do Instagram, Mudar para conta profissional, Empresa.

---

## 4. Pixel ID (obrigatório)

**Onde:** Meta Events Manager, [business.facebook.com/events_manager](https://business.facebook.com/events_manager)

**Passos:**
1. Events Manager, sidebar Data Sources
2. Clique no pixel da sua marca (ex: "SQUAAD Pixel")
3. ID aparece logo abaixo do nome, formato numérico longo

**Exemplo:** `1234567890123456`

**Pra que serve:**
- Otimização de campanhas por evento Lead, Purchase, etc.
- Custom Audiences de visitantes do site
- Conversions API (envio server-side de eventos)

**Pré-requisito:** o pixel precisa estar instalado nas suas landing pages. Se não estiver, instale antes pelo Tag Manager ou direto no HTML antes de ligar campanha.

---

## 5. System User Access Token (obrigatório, longa duração)

**Por que System User e não token de usuário pessoal:** token pessoal expira em 60 dias e quebra se você sair do BM. System User é uma "conta de serviço" do BM, token dura indefinidamente até você revogar.

**Pré-requisito:** ter app criado em [developers.facebook.com](https://developers.facebook.com).

**Se ainda não tem app:**
1. developers.facebook.com, Meus Apps, Criar App
2. Tipo: Empresa
3. Nome: "SQUAAD CRM" (ou similar)
4. Email de contato
5. Vincule ao Business Manager
6. Anote o **App ID** (vai precisar no passo 6)

**Criando o System User:**
1. business.facebook.com, Configurações do Negócio
2. Usuários, Usuários do Sistema
3. Adicionar, nome "SQUAAD CRM Meta Ads", role: Admin
4. Após criar, clique no nome do System User
5. **Adicionar Ativos:**
   - Páginas, sua página, controle total
   - Contas de Anúncio, sua ad account, controle total
   - Pixels, seu pixel, controle total
   - Contas Instagram, sua conta IG, controle total

**Gerando o token:**
1. Ainda na tela do System User, clique em "Gerar Token de Acesso"
2. Selecione seu app
3. **Marque exatamente esses 7 scopes:**
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_read_engagement`
   - `pages_manage_ads`
   - `instagram_basic`
   - `read_insights`
4. Clique "Gerar Token"
5. **Copie agora**, esse token só aparece uma vez. Se perder, gere outro.

**Exemplo:** `EAAB...` (string longa de ~200+ caracteres)

**Validação rápida no terminal:**
```bash
curl "https://graph.facebook.com/v21.0/me?access_token=SEU_TOKEN_AQUI"
```
Se retornar `{"name": "SQUAAD CRM Meta Ads", "id": "..."}` está OK. Se retornar erro, falta scope ou ativo não foi vinculado.

---

## 6. App ID + App Secret (opcional, mas recomendado)

**Por que opcional:** sem isso o System User Token funciona, mas você precisa rotacionar manual a cada renovação. Com isso o CRM consegue renovar token sozinho via OAuth refresh.

**Onde:** developers.facebook.com

**Passos:**
1. Meu app, Configurações, Básico
2. Copie o **App ID** (numérico)
3. Copie o **App Secret** (clique em "Mostrar", confirme senha)
4. **Nunca compartilhe nem cole o App Secret em lugar público.** Vai criptografado no CRM.

---

## 7. Conversions API Access Token (opcional, recomendado)

**Por que: pixel client-side é bloqueado por adblockers, iOS 14.5+, etc. CAPI envia eventos server-side e melhora match rate em 20-40%.

**Onde:** Events Manager

**Passos:**
1. Events Manager, seu pixel
2. Aba Settings
3. Role até "Conversions API"
4. Clique "Generate Access Token"
5. Copie o token gerado

**Exemplo:** `EAAB...` (similar ao do passo 5, mas escopo diferente)

**Atenção:** esse token é específico do pixel, NÃO use o do System User aqui.

---

## Cole tudo no CRM

Com os 6 valores obrigatórios em mãos (passos 1 a 5):

1. Entre no CRM, sidebar, Marketing, Integrações Meta
2. Cole cada valor no campo correspondente
3. Clique "Validar contra Meta API"
4. O sistema testa cada credencial em sequência:
   - Token, GET `/me` retorna nome do System User
   - Ad Account, GET `/act_<ID>?fields=name,currency` retorna nome
   - Page, GET `/<PAGE_ID>?fields=name` retorna nome
   - IG Business, GET `/<IG_ID>?fields=username` retorna @
   - Pixel, GET `/<PIXEL_ID>?fields=name` retorna nome do pixel
5. Se todos ✓ verde, clique "Salvar"
6. Se algum ✗ vermelho, o erro aparece com a mensagem exata do Meta. Corrija o valor e teste de novo.

Depois de salvar, o agente Mídia automaticamente passa a:
- Ler insights da sua ad account nos 3 períodos
- Estruturar campanhas com seu page_id e pixel_id pré-preenchidos
- Sugerir adsets baseados no histórico real da conta

---

## Renovação e troubleshooting

**Token System User expirou:** repete o passo 5. App Secret no passo 6 evita isso, ativa renovação automática.

**Erro "Invalid OAuth access token":** scopes faltando. Volta no System User, regera o token marcando os 7 scopes do passo 5.

**Erro "Permissions error":** o System User não tem o ativo vinculado. Volta em "Adicionar Ativos" e dá controle total na ad account/page/pixel.

**Erro "User request limit reached":** muitas chamadas em pouco tempo. Aguarda 1 hora e tenta de novo. Em produção, o CRM faz cache de 60s pra evitar isso.

**Erro 1443048 ao subir criativo:** problema técnico da API, não da credencial. O agente Mídia já tem regra documentada pra evitar (`object_story_spec` deve ter SO `page_id` em imagem com asset_feed_spec).

---

## Próximo passo

Com Meta integrada, o CRM ganha 3 capacidades novas:

1. **Análise 3 períodos automática** em `/admin/marketing-ia` (insights reais vitalício + 7d + hoje)
2. **Estruturar campanha** (a UI vai gerar JSON e te perguntar "subir PAUSED no Meta agora?", você confirma, sistema sobe campanha + adsets + criativos + ads via API)
3. **Relatório 4h automático** (cron roda a cada 4 horas, gera o report formato emoji + análise + dicas, posta em notificações internas)

Essas 3 capacidades são a Onda 2 do plano. Depois de você passar nesse setup, é minha vez de implementar a UI de "subir campanha" e o cron do relatório.
