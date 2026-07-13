# Kit de Clonagem (provisioning) - SQUAAD CRM

Roteiro pra criar uma instancia NOVA e INDEPENDENTE do CRM pra um cliente.
Cada cliente = GitHub proprio + Supabase proprio + Netlify proprio + dominio proprio.
Nada aqui toca no CRM original da SQUAAD.

## Por que nao usamos as migrations pra clonar

O banco vivo divergiu das migrations (76 migrations registradas, 102 arquivos no repo,
140 tabelas reais). Reconstruir pelas migrations nasceria faltando pedaco. Por isso
clonamos por FOTOGRAFIA do schema atual (`supabase db dump`), nao por migrations.

## Visao geral (ordem de execucao)

```
[VOCE]   1. cria projeto Supabase novo (anota REF, ANON_KEY, SERVICE_ROLE_KEY, DB password)
[VOCE]   2. tira a fotografia do schema do projeto ORIGINAL (1 comando)
[KIT]    3. aplica no projeto novo: extensoes -> schema -> buckets -> cron -> seed
[KIT]    4. deploya as edge functions no projeto novo
[VOCE]   5. seta os secrets de infra no projeto novo
[VOCE]   6. cria GitHub novo (copia do projeto) + Netlify novo apontando pro Supabase novo
[VOCE]   7. liga dominio + conecta WhatsApp/pagamentos do cliente + webhooks
[VOCE]   8. cria usuario admin do cliente e roda o seed final
[KIT]    9. confere que subiu inteiro (script de verificacao)
```

## Passo 1 - Criar o projeto Supabase novo (VOCE)

No painel do Supabase, crie um projeto novo (regiao sa-east-1). Anote:
- PROJECT_REF (ex: abcdwxyz...)        -> aparece na URL do projeto
- ANON_KEY                              -> Settings > API
- SERVICE_ROLE_KEY                     -> Settings > API
- DB password / connection string      -> Settings > Database

## Passo 2 - Fotografia do schema do ORIGINAL (VOCE)

Roda no terminal (precisa do supabase CLID logado). Isso e SO LEITURA no original:

```
npx supabase db dump \
  --db-url "postgresql://postgres:SENHA_DO_ORIGINAL@db.iymlwsawrmghhbawiavz.supabase.co:5432/postgres" \
  --schema public \
  -f provisioning/snapshot/public_schema.sql
```

Resultado: `provisioning/snapshot/public_schema.sql` com as 140 tabelas, 83 funcoes,
68 triggers e as RLS. (A pasta snapshot/ esta no .gitignore, nao sobe pro git.)

## Passo 3 + 4 + 5 - Aplicar tudo no projeto novo (KIT)

Edite `provisioning/clone.env` com os dados do projeto novo e rode:

```
bash provisioning/clone.sh
```

O script faz, em ordem, contra o PROJETO NOVO:
1. liga extensoes (sql/01_extensions.sql)
2. aplica a fotografia do schema (snapshot/public_schema.sql)
3. cria buckets + regras de storage (sql/02_storage_buckets.sql)
4. cria os 18 cron jobs ja com o endereco/chaves do projeto NOVO (sql/03_cron_jobs.template.sql)
5. deploya todas as edge functions
6. seta os secrets de infra (a partir do seu clone.env)

## Passo 6 e 7 - GitHub, Netlify, dominio (VOCE)

- Crie um repo GitHub novo com a copia do projeto.
- Crie um site Netlify novo ligado a esse repo. Nas variaveis de ambiente do site:
  - `VITE_SUPABASE_URL`  = https://PROJECT_REF.supabase.co
  - `VITE_SUPABASE_ANON_KEY` = ANON_KEY do projeto novo
  (o front ja le essas variaveis; sem elas ele apontaria pro original)
- Aponte o dominio do cliente pro site Netlify.
- Conecte as contas externas do cliente (UAZAPI/WhatsApp, Meta, pagamento) e cadastre
  os webhooks no endereco NOVO (https://PROJECT_REF.supabase.co/functions/v1/...).

## Passo 8 - Admin + seed final (VOCE)

- No Supabase novo: Authentication > Add user (email/senha do admin do cliente).
- Edite `provisioning/sql/04_seed.template.sql` com email do admin, nome da empresa etc.
- Rode o seed (o clone.sh pergunta se quer rodar, ou rode manual).

## Passo 9 - Verificacao (KIT)

```
bash provisioning/verify.sh
```

Compara contagem de tabelas/funcoes/buckets/cron do projeto novo com o esperado:
140 tabelas, 83 funcoes, 68 triggers, 11 buckets, 18 cron. Aponta o que faltou.

## O que NAO vem no clone (e ok)

- Dados (leads, mensagens, membros): o cliente comeca vazio, e o certo.
- Credenciais de IA/WhatsApp: o cliente preenche em /admin/configuracoes (ja e DB-first).
- Secrets de infra (LiveKit, storage de gravacao): setados no passo 5 via clone.env.

## Aviso honesto

Este kit cobre o grosso mecanico. O PRIMEIRO clone real quase certamente vai revelar
1 ou 2 ajustes finos (alguma policy de storage, algum seed faltando). Isso e normal em
provisionamento: a gente roda o verify.sh, corrige o que apontar, e a partir do 2o clone
ja fica liso. Por isso o 1o deve ser um CLONE DE TESTE, nao um cliente pagante.
