// ============================================================
// _prospeccao-shared/auth.ts
// Helpers de auth dual (admin/membro) + cota mensal pros membros.
//
// Padrão de input das edge functions:
//   { user_id?: string, member_id?: string, ... }
//   - Se member_id veio: ator é membro Método Squaad (audience='member')
//   - Senão se user_id veio: ator é admin do CRM (audience='admin')
//   - Se nenhum: tratamos como anônimo (audience='admin', sem owner) — só
//     pra retrocompatibilidade. Em produção sempre vem um dos dois.
//
// Cota: aplicada SOMENTE quando ator é membro. Antes de operações pagas
// (busca via Firecrawl, análise multi-canal), chame requireMemberQuota.
// Após sucesso, chame incrementMemberUsage.
// ============================================================

// deno-lint-ignore no-explicit-any
type Supa = any;

export type Audience = "admin" | "member";

export interface Actor {
  audience: Audience;
  user_id: string | null;
  member_id: string | null;
}

export interface ActorInput {
  user_id?: string | null;
  member_id?: string | null;
}

export function resolveActor(input: ActorInput): Actor {
  if (input.member_id) {
    return { audience: "member", user_id: null, member_id: input.member_id };
  }
  return { audience: "admin", user_id: input.user_id || null, member_id: null };
}

export interface QuotaState {
  member_id: string;
  trial_started_at: string;
  trial_expires_at: string;
  monthly_limit: number;
  current_period_start: string;
  analises_used_this_month: number;
  buscas_used_this_month: number;
  total_analises_lifetime: number;
  total_buscas_lifetime: number;
  total_custo_lifetime: number;
  is_paid: boolean;
  plan_name: string;
  paid_until: string | null;
  last_used_at: string | null;
}

/**
 * Garante que o membro tenha registro de cota (cria se não existir) e
 * reseta contador mensal se virou o mês. Retorna o estado atual.
 */
export async function getMemberQuota(supabase: Supa, member_id: string): Promise<QuotaState> {
  const { data, error } = await supabase.rpc("prospeccao_ensure_member_quota", { p_member_id: member_id });
  if (error) throw new Error(`Erro ao carregar cota: ${error.message}`);
  return data as QuotaState;
}

export interface QuotaCheck {
  ok: boolean;
  reason?: "trial_expired" | "monthly_limit_reached" | "member_blocked";
  message?: string;
  quota: QuotaState;
}

/**
 * Verifica se membro pode executar uma operação cobrável.
 * tipo: 'busca' (Maps + parsing) ou 'analise' (multi-canal completa).
 *
 * Política:
 *  1. Se trial expirou e não is_paid → bloqueia
 *  2. Se análise/busca conta excedeu monthly_limit → bloqueia
 *  3. Senão → libera (incrementa só após sucesso via incrementMemberUsage)
 */
export async function requireMemberQuota(
  supabase: Supa,
  member_id: string,
  tipo: "busca" | "analise"
): Promise<QuotaCheck> {
  const quota = await getMemberQuota(supabase, member_id);
  const now = new Date();

  // 1. Trial expirado e não pagou
  const trialExpired = quota.trial_expires_at && new Date(quota.trial_expires_at) < now;
  if (trialExpired && !quota.is_paid) {
    return {
      ok: false,
      reason: "trial_expired",
      message: "Seu período de avaliação de 90 dias acabou. Fale com o suporte SQUAAD para continuar usando.",
      quota,
    };
  }

  // 2. Cota mensal estourada (somente se for análise — busca é mais barata e tem limite separado)
  if (tipo === "analise" && quota.analises_used_this_month >= quota.monthly_limit) {
    return {
      ok: false,
      reason: "monthly_limit_reached",
      message: `Limite mensal de ${quota.monthly_limit} análises atingido. Renova no dia 1 do próximo mês.`,
      quota,
    };
  }

  return { ok: true, quota };
}

/** Incrementa contador no DB. Chamar após operação bem-sucedida. */
export async function incrementMemberUsage(
  supabase: Supa,
  member_id: string,
  tipo: "busca" | "analise",
  custo: number = 0
): Promise<QuotaState> {
  const { data, error } = await supabase.rpc("prospeccao_increment_member_usage", {
    p_member_id: member_id,
    p_tipo: tipo,
    p_custo: custo,
  });
  if (error) {
    console.error("[quota] Erro ao incrementar uso:", error);
    throw new Error(`Erro ao registrar uso: ${error.message}`);
  }
  return data as QuotaState;
}

/**
 * Adiciona campos de auditoria (created_by_user_id, created_by_member_id, audience)
 * em qualquer payload de insert nas tabelas prospeccao_*.
 */
export function withActorFields<T extends Record<string, unknown>>(actor: Actor, payload: T): T {
  return {
    ...payload,
    created_by_user_id: actor.user_id,
    created_by_member_id: actor.member_id,
    audience: actor.audience,
  };
}

/**
 * Confirma que um lead descoberto pertence ao ator (segurança).
 * Bloqueia que membro acesse dados de outro membro ou do admin.
 */
export async function assertActorOwnsLead(
  supabase: Supa,
  actor: Actor,
  lead_descoberto_id: string
): Promise<{ ok: boolean; lead?: Record<string, unknown>; reason?: string }> {
  const { data: lead, error } = await supabase
    .from("prospeccao_leads_descobertos")
    .select("id, audience, created_by_user_id, created_by_member_id, busca_id")
    .eq("id", lead_descoberto_id)
    .single();

  if (error || !lead) return { ok: false, reason: "lead não encontrado" };

  if (actor.audience === "member") {
    if (lead.audience !== "member" || lead.created_by_member_id !== actor.member_id) {
      return { ok: false, reason: "acesso negado: lead não pertence a este membro" };
    }
  }
  // Admin pode acessar tudo (admin OU member que ele criou) — sem restrição

  return { ok: true, lead };
}
