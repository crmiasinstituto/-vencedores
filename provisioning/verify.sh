#!/usr/bin/env bash
# ============================================================
# verify.sh - confere se o clone subiu inteiro, comparando com o original.
# Esperado (snapshot do original em 25/06/2026): 140 tabelas, 83 funcoes,
# 68 triggers, 11 buckets, 18 cron. Pequenas diferencas podem ser normais
# (ex: cron so aparece depois do clone.sh), o objetivo e nao deixar buraco grande.
# Uso: bash provisioning/verify.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source clone.env

echo "Verificando projeto $NEW_PROJECT_REF ..."
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -At <<'SQL'
select 'tabelas_public ' || count(*) || ' (esperado ~140)' from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
union all
select 'funcoes_public ' || count(*) || ' (esperado ~83)' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all
select 'triggers ' || count(*) || ' (esperado ~68)' from information_schema.triggers where trigger_schema='public'
union all
select 'buckets ' || count(*) || ' (esperado 11)' from storage.buckets
union all
select 'storage_policies ' || count(*) || ' (esperado 16)' from pg_policies where schemaname='storage' and tablename='objects'
union all
select 'cron_jobs ' || count(*) || ' (esperado 18)' from cron.job
union all
select 'admins ' || count(*) || ' (esperado >=1)' from public.app_admins;
SQL
echo "Pronto. Se algum item estiver bem abaixo do esperado, me mande a saida que eu aponto o que faltou."
