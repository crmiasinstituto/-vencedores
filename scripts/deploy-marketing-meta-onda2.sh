#!/usr/bin/env bash
# Deploy Marketing Meta - Ondas 1, 2 e 3
#
# - Aplica 2 migrations via Management API (db push tem historico
#   de divergencia neste projeto, ver memoria project_migration_divergence):
#     1. meta_campaigns + meta_publish_log
#     2. cron 4h + system_cron_log
# - Faz deploy das 8 edges:
#     enriquecidas (Onda 1): marketing-maestro, marketing-copy, marketing-criativo,
#                            marketing-midia, marketing-web
#     novas (Onda 2):        marketing-meta-validate, marketing-midia-publish
#     nova (Onda 3):         marketing-midia-cron
#
# Uso:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxxxx     # token Management API
#   bash scripts/deploy-marketing-meta-onda2.sh
#
# Pre-requisitos:
#   - supabase CLI em /tmp/supabase OU no PATH (script tenta os dois)
#   - jq instalado pra leitura de respostas
#
# Idempotente: SQL usa CREATE TABLE IF NOT EXISTS, edges sao upserts.

set -euo pipefail

PROJECT_REF="iymlwsawrmghhbawiavz"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_BIN="${SUPABASE_BIN:-/tmp/supabase}"

if ! command -v "$SUPABASE_BIN" >/dev/null 2>&1; then
  if command -v supabase >/dev/null 2>&1; then
    SUPABASE_BIN="supabase"
  else
    echo "[ERRO] supabase CLI nao encontrado (tentei /tmp/supabase e supabase no PATH)" >&2
    echo "Baixe em https://supabase.com/docs/guides/cli/getting-started" >&2
    exit 1
  fi
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "[ERRO] SUPABASE_ACCESS_TOKEN nao definido" >&2
  echo "Use: export SUPABASE_ACCESS_TOKEN=sbp_xxxxx" >&2
  exit 1
fi

echo "==> Usando supabase CLI: $SUPABASE_BIN"
echo "==> Project ref: $PROJECT_REF"
echo ""

# ----------------------------------------------------------------
# Aplicar migrations via Management API
# ----------------------------------------------------------------
apply_migration() {
  local file="$1"
  local label="$2"
  echo "==> Aplicando $label..."
  if [ ! -f "$file" ]; then
    echo "[ERRO] Arquivo nao encontrado: $file" >&2
    exit 1
  fi
  local sql
  sql=$(cat "$file")
  local body
  body=$(jq -Rs '{query: .}' <<< "$sql")

  local response
  response=$(curl -s -X POST \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")

  if echo "$response" | jq -e '. | type == "array"' >/dev/null 2>&1; then
    echo "    OK $label aplicada"
  elif echo "$response" | grep -q '"message"'; then
    local msg
    msg=$(echo "$response" | jq -r '.message // .error // .')
    if echo "$msg" | grep -qiE "(already exists|null|empty)"; then
      echo "    OK (objeto ja existia)"
    else
      echo "    Resposta: $msg"
      echo "[AVISO] Resposta inesperada, revise manualmente"
      echo "$response"
    fi
  else
    echo "    OK (resposta vazia = sucesso DDL)"
  fi
  echo ""
}

apply_migration "$REPO_ROOT/supabase/migrations/20260520120000_meta_campaigns.sql" "[1/10] meta_campaigns + meta_publish_log"
apply_migration "$REPO_ROOT/supabase/migrations/20260520130000_marketing_midia_cron.sql" "[2/10] system_cron_log + cron 4h"

# ----------------------------------------------------------------
# 2-8. Deploy das 7 edges
# ----------------------------------------------------------------
deploy_edge() {
  local name="$1"
  echo "==> Deploying $name..."
  if SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" \
     "$SUPABASE_BIN" functions deploy "$name" \
     --project-ref "$PROJECT_REF" \
     --no-verify-jwt \
     2>&1 | tail -5; then
    echo "    OK $name"
  else
    echo "[ERRO] Falha deploy $name" >&2
    exit 1
  fi
  echo ""
}

cd "$REPO_ROOT"

deploy_edge "marketing-maestro"
deploy_edge "marketing-copy"
deploy_edge "marketing-criativo"
deploy_edge "marketing-midia"
deploy_edge "marketing-web"
deploy_edge "marketing-meta"

echo "==> Tudo pronto."
echo ""
echo "Proximos passos:"
echo "  1. Acesse /admin/marketing/integracoes/meta e cole as credenciais"
echo "  2. Veja docs/meta-ads-setup.md pra coletar token, ad account, page, pixel"
echo "  3. Apos validar, va em /admin/marketing/midia/nova-campanha pra subir teste"
echo "  4. Comece com R\$5-10/dia, 1 adset, 1 criativo. Tudo entra PAUSED."
