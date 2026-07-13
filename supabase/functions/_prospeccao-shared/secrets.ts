// ============================================================
// _prospeccao-shared/secrets.ts
// Lê chaves API do banco (integration_keys) com fallback pra env var.
//
// Padrão: o CRM SQUAAD gerencia chaves via tabela `integration_keys`
// editada na UI /admin/configuracoes (não via Supabase Secrets).
// Esta function permite que admin troque chaves sem redeploy.
//
// Cache simples por instância de edge function (vive ~minutos).
// ============================================================

// deno-lint-ignore no-explicit-any
type Supa = any;

export interface ProspeccaoSecrets {
  firecrawl: string | null;
  scrapecreators: string | null;
  gemini: string | null;
  pagespeed: string | null; // alias pra Gemini se não setado
}

const SERVICES = ["firecrawl", "scrapecreators", "gemini", "pagespeed"];

// Cache simples por worker (Edge Functions reutilizam o worker entre requests
// próximos). TTL de 60s evita ler banco em todo request.
let _cache: { secrets: ProspeccaoSecrets; expiresAt: number } | null = null;

export async function getProspeccaoSecrets(supabase: Supa, forceRefresh = false): Promise<ProspeccaoSecrets> {
  const now = Date.now();
  if (!forceRefresh && _cache && _cache.expiresAt > now) {
    return _cache.secrets;
  }

  const { data, error } = await supabase
    .from("integration_keys")
    .select("service, api_key, is_active")
    .in("service", SERVICES);

  if (error) {
    console.error("[secrets] Erro ao ler integration_keys:", error.message);
    return resolveFromEnv();
  }

  const fromDb = new Map<string, string | null>();
  for (const row of data || []) {
    if (row.is_active && row.api_key) {
      fromDb.set(row.service, String(row.api_key).trim());
    }
  }

  // Cada service: usa banco se ativo, senão Deno.env (fallback retrocompat)
  const secrets: ProspeccaoSecrets = {
    firecrawl: fromDb.get("firecrawl") || Deno.env.get("FIRECRAWL_API_KEY") || null,
    scrapecreators: fromDb.get("scrapecreators") || Deno.env.get("SCRAPECREATORS_API_KEY") || null,
    gemini: fromDb.get("gemini") || Deno.env.get("GEMINI_API_KEY") || null,
    pagespeed: fromDb.get("pagespeed") || Deno.env.get("PAGESPEED_API_KEY") || null,
  };

  // Pagespeed reusa Gemini se não tiver chave própria
  if (!secrets.pagespeed) secrets.pagespeed = secrets.gemini;

  // Injeta nas env vars pra fontes que leem direto via Deno.env.get
  // (21 scrapers em prospeccao-analisar/fontes/ usam esse padrão)
  injectIntoEnv(secrets);

  _cache = { secrets, expiresAt: now + 60_000 };
  return secrets;
}

function injectIntoEnv(secrets: ProspeccaoSecrets) {
  try {
    if (secrets.firecrawl) Deno.env.set("FIRECRAWL_API_KEY", secrets.firecrawl);
    if (secrets.scrapecreators) Deno.env.set("SCRAPECREATORS_API_KEY", secrets.scrapecreators);
    if (secrets.gemini) Deno.env.set("GEMINI_API_KEY", secrets.gemini);
    if (secrets.pagespeed) Deno.env.set("PAGESPEED_API_KEY", secrets.pagespeed);
  } catch (e) {
    // Em alguns ambientes Deno.env.set pode lançar (env readonly). Ignorável.
    console.warn("[secrets] injectIntoEnv falhou:", e);
  }
}

function resolveFromEnv(): ProspeccaoSecrets {
  const gemini = Deno.env.get("GEMINI_API_KEY") || null;
  return {
    firecrawl: Deno.env.get("FIRECRAWL_API_KEY") || null,
    scrapecreators: Deno.env.get("SCRAPECREATORS_API_KEY") || null,
    gemini,
    pagespeed: Deno.env.get("PAGESPEED_API_KEY") || gemini,
  };
}

export function requireSecret(secrets: ProspeccaoSecrets, key: keyof ProspeccaoSecrets): string {
  const v = secrets[key];
  if (!v) {
    throw new Error(`Chave '${key}' não configurada. Configure em /admin/configuracoes ou via Supabase Secrets.`);
  }
  return v;
}
