// Originalmente gerado pela Lovable; foi customizado (smart-fetch
// proxy fallback + x-member-token injector pra RLS dos member_*).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Env-first com fallback nos valores atuais da + que Vencedores. Numa instancia clonada
// por cliente, basta setar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build
// (Netlify) que o front aponta pro banco do cliente. Sem env, mantem a + que Vencedores,
// entao o build atual nao quebra.
const SUPABASE_DIRECT = (import.meta.env.VITE_SUPABASE_URL as string) || "https://iymlwsawrmghhbawiavz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWx3c2F3cm1naGhiYXdpYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjI5NjUsImV4cCI6MjA5OTUzODk2NX0.mmnCM6HjBlADVpARI3S-2rSUWdZYpEMbf8hTO5fhwoM";

// DNS-fallback: if the browser can't resolve the Supabase subdomain (some
// ISPs/firewalls filter supabase.co subdomains), calls are transparently
// routed through the site's Netlify proxy at /__sb/*.
const PROXY_FLAG = 'sb_use_proxy';
const hasWindow = typeof window !== 'undefined';
const PROXY_BASE = hasWindow ? `${window.location.origin}/__sb` : SUPABASE_DIRECT;

function readForcedProxy(): boolean {
  if (!hasWindow) return false;
  try {
    if (window.localStorage.getItem(PROXY_FLAG) === '1') return true;
    if (window.location.search.includes('sb=proxy')) {
      window.localStorage.setItem(PROXY_FLAG, '1');
      return true;
    }
    if (window.location.search.includes('sb=direct')) {
      window.localStorage.removeItem(PROXY_FLAG);
    }
  } catch { /* ignore */ }
  return false;
}

let useProxy = readForcedProxy();

function toProxyUrl(url: string): string {
  if (!url.startsWith(SUPABASE_DIRECT)) return url;
  return PROXY_BASE + url.slice(SUPABASE_DIRECT.length);
}

// Lê o session_token do membro do localStorage. Usado pelo header
// x-member-token enviado em todas as chamadas Supabase, que a função
// SQL public.current_member_id() resolve no servidor pra escopar RLS
// nas tabelas member_progress/milestones/sessions/contracts/payments
// e nos catálogos member_lessons/modules/files.
function getMemberToken(): string | null {
  if (!hasWindow) return null;
  try {
    const raw = window.localStorage.getItem('squaad_member_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const t = parsed?.session_token;
    return typeof t === 'string' && t.length >= 16 ? t : null;
  } catch {
    return null;
  }
}

// Lê o token de sessão do TIME (acervo /time) do localStorage. Mesmo
// mecanismo do x-member-token: a função SQL public.current_team_user_id()
// resolve no servidor pra escopar RLS nas tabelas drive_* (acervo + quadro).
function getTeamToken(): string | null {
  if (!hasWindow) return null;
  try {
    const raw = window.localStorage.getItem('squaad_team_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const t = parsed?.token;
    return typeof t === 'string' && t.length >= 16 ? t : null;
  } catch {
    return null;
  }
}

// Soma um header custom (x-member-token / x-team-token) preservando os
// demais (Authorization, apikey, content-type) tanto pra input string/URL
// quanto pra Request.
function applyCustomHeader(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  name: string,
  value: string
): { input: RequestInfo | URL; init?: RequestInit } {
  if (typeof input === 'string' || input instanceof URL) {
    const headers = new Headers(init?.headers);
    headers.set(name, value);
    return { input, init: { ...init, headers } };
  }
  const merged = new Headers(input.headers);
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => merged.set(k, v));
  }
  merged.set(name, value);
  return { input: new Request(input, { headers: merged }), init };
}

function applyMemberHeader(
  input: RequestInfo | URL,
  init?: RequestInit
): { input: RequestInfo | URL; init?: RequestInit } {
  const token = getMemberToken();
  if (!token) return { input, init };

  // Caso comum: supabase-js passa URL string + init contendo Authorization,
  // apikey etc. Copiamos os headers atuais e somamos o nosso.
  if (typeof input === 'string' || input instanceof URL) {
    const headers = new Headers(init?.headers);
    headers.set('x-member-token', token);
    return { input, init: { ...init, headers } };
  }

  // Caso Request: precisamos preservar TODOS os headers do Request original
  // (Authorization, apikey, content-type) e somar o nosso. Construir um
  // novo Request porque a propriedade headers de Request é mutável só por
  // métodos da classe Headers e o fetch usa a snapshot original.
  const merged = new Headers(input.headers);
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => merged.set(k, v));
  }
  merged.set('x-member-token', token);
  return { input: new Request(input, { headers: merged }), init };
}

function markUseProxy() {
  useProxy = true;
  if (hasWindow) {
    try { window.localStorage.setItem(PROXY_FLAG, '1'); } catch {}
  }
  // eslint-disable-next-line no-console
  console.warn('[supabase] Direct host unreachable; falling back to /__sb proxy');
}

async function smartFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const originalUrl = typeof input === 'string'
    ? input
    : input instanceof URL ? input.toString() : input.url;

  const isSupabaseCall = originalUrl.startsWith(SUPABASE_DIRECT);

  // x-member-token e necessario em:
  // - chamadas REST/PostgREST (RLS dos member_* usa current_member_id()
  //   que le request.headers->x-member-token)
  // - edges ai-tutor e request-member-help (unicas que consomem o header)
  // Em qualquer outra edge function, injetar quebra o preflight CORS,
  // porque a maioria das edges nao lista x-member-token em
  // Access-Control-Allow-Headers e o browser bloqueia silenciosamente.
  const isEdgeFn = /\/functions\/v1\//.test(originalUrl);
  const isMemberAwareEdge = /\/functions\/v1\/(ai-tutor|request-member-help)(\?|$|\/)/.test(originalUrl);
  const shouldInjectMemberToken = isSupabaseCall && (!isEdgeFn || isMemberAwareEdge);
  if (shouldInjectMemberToken) {
    const r = applyMemberHeader(input, init);
    input = r.input;
    init = r.init;
  }

  // x-team-token: RLS dos drive_* (acervo/quadro do time). Só em REST/PostgREST
  // e RPC. NUNCA em edge function (create-b2-upload-url etc não listam o header
  // no CORS e o browser bloqueia o preflight). Edges usam service_role e não
  // dependem desse token.
  if (isSupabaseCall && !isEdgeFn) {
    const teamToken = getTeamToken();
    if (teamToken) {
      const r = applyCustomHeader(input, init, 'x-team-token', teamToken);
      input = r.input;
      init = r.init;
    }
  }

  // Edge functions /functions/v1/* podem demorar minutos (análise multi-canal,
  // transcrição, IA). Netlify Edge tem timeout de 10s — então NUNCA usa proxy
  // pra functions, sempre vai direto pro Supabase.
  const isLongRunningFunction = isSupabaseCall && /\/functions\/v1\//.test(originalUrl);

  // If proxy is forced, rewrite the URL before calling — exceto pra functions.
  if (useProxy && isSupabaseCall && !isLongRunningFunction) {
    const proxiedUrl = toProxyUrl(originalUrl);
    const proxiedRequest = typeof input === 'string' || input instanceof URL
      ? proxiedUrl
      : new Request(proxiedUrl, input);
    return fetch(proxiedRequest, init);
  }

  // First attempt: direct. Pra functions long-running, sem timeout custom
  // (deixa o próprio Supabase definir — geralmente 60s+).
  const controller = new AbortController();
  const userSignal = init?.signal;
  if (userSignal) {
    if (userSignal.aborted) controller.abort((userSignal as any).reason);
    else userSignal.addEventListener('abort', () => controller.abort((userSignal as any).reason));
  }
  const timer = (isSupabaseCall && !isLongRunningFunction)
    ? setTimeout(() => controller.abort(new DOMException('supabase-direct-timeout', 'AbortError')), 4500)
    : null;

  try {
    const firstInit: RequestInit = { ...init, signal: controller.signal };
    const res = await fetch(input as any, firstInit);
    if (timer) clearTimeout(timer);
    return res;
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    if (!isSupabaseCall) throw err;

    // If the user aborted, don't retry.
    if (userSignal?.aborted) throw err;

    // Functions long-running NUNCA caem no proxy (timeout 10s mata análise).
    // Re-throw pra Supabase client lidar.
    if (isLongRunningFunction) throw err;

    // TypeError "Failed to fetch" or AbortError from our timeout = DNS/network failure.
    markUseProxy();
    const proxiedUrl = toProxyUrl(originalUrl);
    const proxiedRequest = typeof input === 'string' || input instanceof URL
      ? proxiedUrl
      : new Request(proxiedUrl, init);
    return fetch(proxiedRequest, init);
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_DIRECT, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: smartFetch as any,
  },
});

export const SUPABASE_URL = SUPABASE_DIRECT;
