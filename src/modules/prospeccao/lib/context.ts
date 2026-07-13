// ============================================================
// Prospeccao — contexto de auth (admin vs membro)
// ============================================================
// Decide se o ator atual é:
//  - admin do CRM + que Vencedores (Supabase Auth, tem user_id)
//  - membro Método + que Vencedores (localStorage 'squaad_member_session', tem member_id)
//
// Usado em:
//  - lib/api.ts (manda user_id OU member_id no body das edge functions)
//  - VirarLeadModal.tsx (renderiza UI diferente: admin pega board/column,
//    membro só nome+whatsapp)
//  - Indicador de cota (só visível pra membros)
// ============================================================

import { supabase } from "@/integrations/supabase/client";

export type Audience = "admin" | "member";

export interface ProspeccaoContext {
  audience: Audience;
  user_id: string | null;
  member_id: string | null;
  member_name: string | null;
  member_email: string | null;
}

interface MemberSessionRaw {
  session_token: string;
  member_id: string;
  name?: string;
  email?: string;
}

/**
 * Resolve contexto atual.
 * Membro tem prioridade — se tiver session de membro, é membro
 * (mesmo que também tenha user admin logado por algum motivo).
 */
export async function getProspeccaoContext(): Promise<ProspeccaoContext> {
  // 1. Membro? (localStorage)
  const memberSession = readMemberSession();
  if (memberSession) {
    return {
      audience: "member",
      user_id: null,
      member_id: memberSession.member_id,
      member_name: memberSession.name || null,
      member_email: memberSession.email || null,
    };
  }

  // 2. Admin? (Supabase Auth)
  const { data: { user } } = await supabase.auth.getUser();
  return {
    audience: "admin",
    user_id: user?.id || null,
    member_id: null,
    member_name: null,
    member_email: user?.email || null,
  };
}

/**
 * Versão síncrona quando você JÁ sabe que é membro (ex: dentro de MembrosLayout).
 * Retorna null se não tem session de membro.
 */
export function getMemberContextSync(): ProspeccaoContext | null {
  const ms = readMemberSession();
  if (!ms) return null;
  return {
    audience: "member",
    user_id: null,
    member_id: ms.member_id,
    member_name: ms.name || null,
    member_email: ms.email || null,
  };
}

/**
 * Retorna a base de rota do módulo conforme o ator atual.
 * Prioridade:
 *  1. Se URL atual já tá em /membros/prospeccao/* → continua ali
 *  2. Se URL atual já tá em /admin/prospeccao/* → continua ali
 *  3. Senão, usa squaad_member_session do localStorage como tiebreaker
 *
 * Isso evita o bug clássico: admin que testou /membros antes tem session
 * salva no localStorage e era redirecionado pra rota errada.
 */
export function getProspeccaoBaseRoute(): string {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/admin/prospeccao")) return "/admin/prospeccao";
    if (path.startsWith("/membros/prospeccao")) return "/membros/prospeccao";
  }
  return readMemberSession() ? "/membros/prospeccao" : "/admin/prospeccao";
}

/** Helper pra montar rotas relativas mantendo contexto. */
export function routeTo(path: string = ""): string {
  const base = getProspeccaoBaseRoute();
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function readMemberSession(): MemberSessionRaw | null {
  try {
    const raw = localStorage.getItem("squaad_member_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemberSessionRaw;
    if (!parsed.member_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Adiciona { user_id } ou { member_id } a um body de chamada
 * de edge function, conforme o contexto.
 */
export function withContextBody<T extends object>(
  ctx: ProspeccaoContext,
  body: T
): T & { user_id?: string; member_id?: string } {
  if (ctx.audience === "member" && ctx.member_id) {
    return { ...body, member_id: ctx.member_id };
  }
  if (ctx.user_id) {
    return { ...body, user_id: ctx.user_id };
  }
  return body;
}
