/**
 * URL pública do app.
 *
 * Existia como `const SQUAAD_DOMAIN = 'https://squaad.com.br'` copiado em vários
 * arquivos, chumbando o domínio da SQUAAD em todo link gerado pro cliente final:
 * convite de reunião, link de onboarding, credencial de membro. Num domínio novo,
 * cada um desses links levaria o destinatário pro site de outra empresa.
 *
 * Derivar da origem faz o link sempre apontar pra onde o app realmente está —
 * localhost em dev, o domínio de verdade em produção — sem nada pra manter.
 * VITE_SITE_URL cobre o caso de gerar link fora do browser (edge function, script).
 */
export const SITE_URL =
  import.meta.env.VITE_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

/** Monta uma URL absoluta do app a partir de um caminho ("/membros/login"). */
export const siteUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
