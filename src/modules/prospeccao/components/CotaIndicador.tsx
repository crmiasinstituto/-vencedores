// ============================================================
// CotaIndicador — mostra estado da cota do membro
//
// Aparece SÓ pra membros (audience='member'). Admin não vê.
// Lê via tabela prospeccao_member_quotas (com auto-reset mensal
// via função prospeccao_ensure_member_quota).
// ============================================================

import { useEffect, useState } from "react";
import { Sparkles, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getProspeccaoContext } from "../lib/context";

interface CotaState {
  monthly_limit: number;
  analises_used_this_month: number;
  buscas_used_this_month: number;
  trial_expires_at: string;
  is_paid: boolean;
  plan_name: string;
}

export function CotaIndicador({ compact = false }: { compact?: boolean }) {
  const [cota, setCota] = useState<CotaState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ctx = await getProspeccaoContext();
      if (ctx.audience !== "member" || !ctx.member_id) {
        if (alive) setLoading(false);
        return;
      }
      // Garante que a row existe + reseta contador mensal se virou o mês
      const { data, error } = await (supabase as any).rpc("prospeccao_ensure_member_quota", { p_member_id: ctx.member_id });
      if (!alive) return;
      if (!error && data) setCota(data as CotaState);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading || !cota) return null;

  const usadas = cota.analises_used_this_month;
  const limite = cota.monthly_limit;
  const restantes = Math.max(0, limite - usadas);
  const pct = limite > 0 ? Math.min(100, (usadas / limite) * 100) : 0;
  const expira = new Date(cota.trial_expires_at);
  const diasRestantes = Math.max(0, Math.ceil((expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const trialAcabou = diasRestantes === 0 && !cota.is_paid;

  const cor = pct >= 90 ? "text-red-500" : pct >= 70 ? "text-amber-500" : "text-emerald-500";

  if (compact) {
    return (
      <Badge variant="outline" className={`${cor} border-current/30 bg-current/10 gap-1 font-bold`}>
        <Zap className="h-3 w-3" />
        {restantes}/{limite}
      </Badge>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Sua cota mensal</span>
        </div>
        <Badge variant="outline" className={cor}>
          {restantes} restantes
        </Badge>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{usadas} de {limite} análises usadas</span>
        {trialAcabou ? (
          <span className="text-red-500 font-medium">Trial expirado — fale com o suporte</span>
        ) : cota.is_paid ? (
          <span className="text-emerald-500">Plano: {cota.plan_name}</span>
        ) : (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Trial: {diasRestantes} dia{diasRestantes !== 1 ? "s" : ""} restante{diasRestantes !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
