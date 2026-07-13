// Painel de saúde da instância WhatsApp + controles anti-bloqueio.
// Mostra ao vivo:
//   - Status conexão (connected/disconnected)
//   - Msgs enviadas última hora vs limite
//   - Msgs enviadas últimas 24h vs limite
//   - Taxa de falha últimos 30 envios (auto-pausa se passar do threshold)
//   - Frozen? + motivo (auto OR manual)
//   - Botão "Pausar envio" / "Liberar"
//   - Inputs pra ajustar limites
//
// Lê tabela whatsapp_send_limits + agrega whatsapp_messages.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, ShieldOff, Activity, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Instance {
  id: string;
  instance_name: string;
  status: string;
  phone_number: string;
}

interface Limits {
  instance_id: string;
  max_per_hour: number;
  max_per_day: number;
  auto_pause_failure_rate: number;
  frozen: boolean;
  frozen_reason: string | null;
  frozen_at: string | null;
}

interface Stats {
  sent_hour: number;
  sent_day: number;
  failed_30min: number;
  total_30min: number;
}

export function WhatsAppHealthPanel() {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLimits, setSavingLimits] = useState(false);
  const [editHour, setEditHour] = useState<number>(30);
  const [editDay, setEditDay] = useState<number>(200);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: insts } = await (supabase as any)
        .from("whatsapp_instances")
        .select("id, instance_name, status, phone_number")
        .order("created_at", { ascending: false })
        .limit(1);
      const inst = insts?.[0] || null;
      setInstance(inst);
      if (!inst) { setLoading(false); return; }

      const { data: lim } = await (supabase as any)
        .from("whatsapp_send_limits")
        .select("*")
        .eq("instance_id", inst.id)
        .maybeSingle();
      setLimits(lim);
      if (lim) {
        setEditHour(lim.max_per_hour);
        setEditDay(lim.max_per_day);
      }

      // Stats agregadas
      const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
      const [hr, dy, rc] = await Promise.all([
        (supabase as any).from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("instance_id", inst.id).eq("direction", "outbound").eq("status", "sent")
          .gte("created_at", oneHourAgo),
        (supabase as any).from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("instance_id", inst.id).eq("direction", "outbound").eq("status", "sent")
          .gte("created_at", oneDayAgo),
        (supabase as any).from("whatsapp_messages")
          .select("status")
          .eq("instance_id", inst.id).eq("direction", "outbound")
          .gte("created_at", thirtyMinAgo)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      const recent = rc.data || [];
      setStats({
        sent_hour: hr.count || 0,
        sent_day: dy.count || 0,
        failed_30min: recent.filter((r: any) => r.status === "failed").length,
        total_30min: recent.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30_000); // refresh 30s
    return () => clearInterval(t);
  }, [fetchAll]);

  async function toggleFreeze() {
    if (!instance || !limits) return;
    const next = !limits.frozen;
    const { error } = await (supabase as any)
      .from("whatsapp_send_limits")
      .update({
        frozen: next,
        frozen_at: next ? new Date().toISOString() : null,
        frozen_reason: next ? "manual_pause_admin" : null,
        updated_at: new Date().toISOString(),
      })
      .eq("instance_id", instance.id);
    if (error) {
      toast.error("Falha", { description: error.message });
      return;
    }
    toast.success(next ? "Envio PAUSADO" : "Envio LIBERADO");
    fetchAll();
  }

  async function saveLimits() {
    if (!instance) return;
    setSavingLimits(true);
    const { error } = await (supabase as any)
      .from("whatsapp_send_limits")
      .update({
        max_per_hour: editHour,
        max_per_day: editDay,
        updated_at: new Date().toISOString(),
      })
      .eq("instance_id", instance.id);
    setSavingLimits(false);
    if (error) {
      toast.error("Falha", { description: error.message });
      return;
    }
    toast.success("Limites salvos");
    fetchAll();
  }

  if (loading && !instance) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando saúde do WhatsApp...
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Nenhuma instância WhatsApp configurada
        </h2>
      </div>
    );
  }

  const isConnected = instance.status === "connected";
  const isFrozen = limits?.frozen || false;
  const hourPct = limits ? Math.min(100, (stats?.sent_hour || 0) / limits.max_per_hour * 100) : 0;
  const dayPct = limits ? Math.min(100, (stats?.sent_day || 0) / limits.max_per_day * 100) : 0;
  const failRate = stats && stats.total_30min > 0 ? stats.failed_30min / stats.total_30min : 0;
  const failPct = failRate * 100;

  return (
    <section className={`rounded-xl border p-5 ${
      isFrozen ? "border-red-500/40 bg-red-500/5"
      : !isConnected ? "border-amber-500/40 bg-amber-500/5"
      : "border-border bg-card"
    }`}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {isFrozen ? <ShieldOff className="w-4 h-4 text-red-400" />
            : !isConnected ? <ShieldAlert className="w-4 h-4 text-amber-400" />
            : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
          Saúde do WhatsApp · {instance.instance_name}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchAll}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Badge variant="outline" className={
            isConnected ? "border-emerald-500/40 text-emerald-300"
            : "border-amber-500/40 text-amber-300"
          }>
            {instance.status}
          </Badge>
          {instance.phone_number && (
            <span className="text-xs text-muted-foreground font-mono">+{instance.phone_number}</span>
          )}
        </div>
      </div>

      {isFrozen && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-sm flex items-start gap-2">
          <ShieldOff className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-red-300">ENVIOS PAUSADOS</strong>
            <p className="text-xs text-red-200/80 mt-0.5">
              Motivo: <code className="font-mono">{limits?.frozen_reason || "manual"}</code>
              {limits?.frozen_at && ` · desde ${new Date(limits.frozen_at).toLocaleString("pt-BR")}`}
            </p>
          </div>
        </div>
      )}

      {/* Cards de uso */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className={`p-3 rounded-lg border ${hourPct > 80 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-background/40"}`}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3" /> Última hora
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats?.sent_hour ?? 0}<span className="text-sm text-muted-foreground"> / {limits?.max_per_hour}</span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full mt-2 overflow-hidden">
            <div className={hourPct > 80 ? "bg-amber-500 h-full" : "bg-emerald-500 h-full"} style={{ width: `${hourPct}%` }}></div>
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${dayPct > 80 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-background/40"}`}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Activity className="w-3 h-3" /> Últimas 24h
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats?.sent_day ?? 0}<span className="text-sm text-muted-foreground"> / {limits?.max_per_day}</span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full mt-2 overflow-hidden">
            <div className={dayPct > 80 ? "bg-amber-500 h-full" : "bg-emerald-500 h-full"} style={{ width: `${dayPct}%` }}></div>
          </div>
        </div>

        <div className={`p-3 rounded-lg border ${failPct > 20 ? "border-red-500/40 bg-red-500/5" : "border-border bg-background/40"}`}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Taxa de falha (30min)
          </div>
          <div className="text-2xl font-bold mt-1">
            {failPct.toFixed(0)}%<span className="text-sm text-muted-foreground"> ({stats?.failed_30min}/{stats?.total_30min || 0})</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            auto-pausa em ≥{((limits?.auto_pause_failure_rate || 0.25) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-end gap-3 flex-wrap pt-3 border-t border-border">
        <div>
          <label className="text-xs text-muted-foreground">Max/hora</label>
          <Input type="number" value={editHour} onChange={(e) => setEditHour(parseInt(e.target.value) || 0)} className="w-24 mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max/dia</label>
          <Input type="number" value={editDay} onChange={(e) => setEditDay(parseInt(e.target.value) || 0)} className="w-24 mt-1" />
        </div>
        <Button onClick={saveLimits} disabled={savingLimits} size="sm">
          {savingLimits ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Salvar"}
        </Button>
        <div className="ml-auto">
          <Button
            onClick={toggleFreeze}
            variant={isFrozen ? "default" : "destructive"}
            size="sm"
          >
            {isFrozen ? (
              <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> LIBERAR envios</>
            ) : (
              <><ShieldOff className="w-3.5 h-3.5 mr-1.5" /> PAUSAR envios agora</>
            )}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
        💡 Esses limites protegem contra bloqueio Meta. Recomendado pós-ban:{" "}
        <strong>max/hora ≤ 15, max/dia ≤ 100</strong> nas primeiras 48h (ramp-up).
        Depois sobe gradualmente.
      </p>
    </section>
  );
}
