#!/usr/bin/env bash
# ============================================================
# clone.sh - aplica o kit de clonagem no PROJETO NOVO.
# Pre-requisitos: psql instalado, supabase CLI logado, e o snapshot do schema
# ja gerado em provisioning/snapshot/public_schema.sql (ver README passo 2).
# Uso: bash provisioning/clone.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f clone.env ]; then
  echo "ERRO: crie provisioning/clone.env a partir de clone.env.example"; exit 1
fi
# shellcheck disable=SC1091
source clone.env

SNAP="snapshot/public_schema.sql"
if [ ! -f "$SNAP" ]; then
  echo "ERRO: falta $SNAP. Rode o pg_dump do README (passo 2) primeiro."; exit 1
fi

run_sql () { echo ">> aplicando $1"; psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$2"; }

echo "== 1/6 extensoes =="
run_sql "extensoes" sql/01_extensions.sql

echo "== 2/6 schema (fotografia) =="
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$SNAP"

echo "== 3/6 buckets + storage =="
run_sql "buckets" sql/02_storage_buckets.sql

echo "== 4/6 cron jobs (substituindo endereco/chaves) =="
mkdir -p .generated
sed -e "s|__PROJECT_REF__|${NEW_PROJECT_REF}|g" \
    -e "s|__ANON_KEY__|${NEW_ANON_KEY}|g" \
    -e "s|__SERVICE_ROLE_KEY__|${NEW_SERVICE_ROLE_KEY}|g" \
    sql/03_cron_jobs.template.sql > .generated/03_cron_jobs.sql
run_sql "cron" .generated/03_cron_jobs.sql

echo "== 5/6 deploy das edge functions =="
( cd .. && npx supabase functions deploy --project-ref "$NEW_PROJECT_REF" )

echo "== 6/6 secrets de infra =="
SECRETS=()
for k in LIVEKIT_API_KEY LIVEKIT_API_SECRET LIVEKIT_URL S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET S3_REGION S3_PUBLIC_URL UAZAPI_ADMIN_TOKEN ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY LOVABLE_API_KEY SONIOX_API_KEY; do
  v="${!k:-}"; [ -n "$v" ] && SECRETS+=("$k=$v")
done
if [ ${#SECRETS[@]} -gt 0 ]; then
  ( cd .. && npx supabase secrets set --project-ref "$NEW_PROJECT_REF" "${SECRETS[@]}" )
else
  echo "   (nenhum secret de infra preenchido no clone.env, pulei)"
fi

echo ""
echo "BASE PRONTA. Agora rode o seed (revise sql/04_seed.template.sql) e o verify.sh:"
echo "  sed \"s|__ADMIN_EMAIL__|$ADMIN_EMAIL|g\" sql/04_seed.template.sql | psql \"\$NEW_DB_URL\""
echo "  bash provisioning/verify.sh"
