// Banner persistente que aparece em TODAS as páginas admin enquanto o
// rate limit do /disc estiver desligado (modo evento). Mostra countdown
// pra expiração e botão pra religar imediatamente.
//
// Polling a cada 30s pra reagir mesmo se outro admin religar/expirar.

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function fmtRemaining(untilIso: string): string {
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return "expirando…";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

export function RateLimitBanner() {
  const [disabled, setDisabled] = useState(false);
  const [until, setUntil] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from("r10x_settings")
        .select("key, value")
        .in("key", ["disc_rate_limit_disabled", "disc_rate_limit_disabled_until"]);
      const map = new Map((data || []).map((r: any) => [r.key, r.value]));
      setDisabled(map.get("disc_rate_limit_disabled") === true);
      const u = map.get("disc_rate_limit_disabled_until");
      setUntil(u ? String(u) : null);
    } catch {
      /* silencioso, banner não pode quebrar a página */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  // Tick local pra atualizar countdown sem refetch
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const isEffectivelyDisabled =
    disabled && (!until || new Date(until).getTime() > now);

  if (!isEffectivelyDisabled) return null;

  async function reenableNow() {
    await (supabase as any)
      .from("r10x_settings")
      .upsert(
        { key: "disc_rate_limit_disabled", value: false, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    refresh();
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-500/95 text-amber-950 border-b-2 border-amber-600 shadow-md">
      <div className="px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span className="text-center">
          <strong>Rate limit do /disc está DESLIGADO.</strong>{" "}
          {until ? (
            <>
              Religa automaticamente em <strong>{fmtRemaining(until)}</strong>.
            </>
          ) : (
            <>Sem expiração programada — não esqueça de religar manual!</>
          )}{" "}
          <Link to="/admin/reprograma" className="underline underline-offset-2 hover:text-amber-900">
            ir pro painel
          </Link>
        </span>
        <button
          onClick={reenableNow}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-950 text-amber-100 text-xs font-bold hover:bg-amber-900 transition-colors"
          title="Religa o rate limit agora"
        >
          <X className="w-3 h-3" /> RELIGAR AGORA
        </button>
      </div>
    </div>
  );
}
