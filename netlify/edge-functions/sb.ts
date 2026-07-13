// Supabase DNS-bypass proxy running on Netlify Edge.
// Accepts any method (GET/POST/PATCH/DELETE/OPTIONS) and forwards the
// request to the real Supabase host, so clients whose DNS or firewall
// filters supabase.co subdomains can still reach the API through the
// site's own domain at /__sb/*.

// Env-first: cada instancia (clone) aponta o proxy pro proprio Supabase via
// a variavel SUPABASE_PROXY_TARGET no Netlify. Sem ela, cai na matriz (build atual).
const TARGET = (() => {
  try { const v = (globalThis as any).Deno?.env?.get?.("SUPABASE_PROXY_TARGET"); if (v) return v; } catch { /* noop */ }
  try { const v = (globalThis as any).Netlify?.env?.get?.("SUPABASE_PROXY_TARGET"); if (v) return v; } catch { /* noop */ }
  return "https://iymlwsawrmghhbawiavz.supabase.co";
})();

const DROP_REQ = new Set([
  "host", "connection", "content-length", "accept-encoding",
  "x-forwarded-host", "x-forwarded-for", "x-forwarded-proto",
  "x-country", "x-language", "x-nf-account-id", "x-nf-request-id",
  "x-nf-client-connection-ip", "x-nf-geo", "x-nf-debug-logging",
  "x-nf-site-id", "via", "forwarded",
]);

const DROP_RES = new Set([
  "content-encoding", "content-length", "transfer-encoding",
  "connection", "keep-alive",
]);

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const suffix = url.pathname.replace(/^\/__sb/, "");
  const targetUrl = TARGET + (suffix || "/") + url.search;

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    if (!DROP_REQ.has(k.toLowerCase())) headers.set(k, v);
  });

  const init: RequestInit = { method: req.method, headers, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: "upstream_fetch_failed", detail: String(err) }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!DROP_RES.has(k.toLowerCase())) resHeaders.set(k, v);
  });
  resHeaders.set("x-sb-proxy", "netlify-edge");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
};

export const config = {
  path: "/__sb/*",
};
