import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Send, Inbox, CalendarDays, Loader2 } from 'lucide-react';

/**
 * Contabilização de disparos do WhatsApp. Lê a RPC public.whatsapp_contabilizacao (agrega
 * whatsapp_messages). Conta só o que saiu pelo NOSSO sistema — envios antigos por outras
 * ferramentas (SellFlux) não entram.
 */

interface Stats {
  total_enviadas: number;
  enviadas_hoje: number;
  enviadas_7d: number;
  recebidas: number;
  por_dia: { dia: string; enviadas: number }[];
  por_template: { template: string; total: number }[];
}

function Kpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="bg-card/50">
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${color}1a`, color }}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground">{value.toLocaleString('pt-BR')}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WhatsAppContabilizacao() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('whatsapp_contabilizacao');
      if (!error && data) setStats(data as unknown as Stats);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!stats) return <p className="p-6 text-muted-foreground">Não foi possível carregar a contabilização.</p>;

  const maxDia = Math.max(1, ...stats.por_dia.map((d) => d.enviadas));

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Contabilização — WhatsApp</h1>
        <p className="text-muted-foreground">Quantas mensagens saíram pelo nosso sistema. Atualiza em tempo real.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Send} label="Total enviadas" value={stats.total_enviadas} color="#22c55e" />
        <Kpi icon={CalendarDays} label="Enviadas hoje" value={stats.enviadas_hoje} color="#3b82f6" />
        <Kpi icon={MessageSquare} label="Enviadas (7 dias)" value={stats.enviadas_7d} color="#a855f7" />
        <Kpi icon={Inbox} label="Recebidas" value={stats.recebidas} color="#f59e0b" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/50">
          <CardHeader><CardTitle className="text-base">Enviadas por dia (14 dias)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.por_dia.map((d) => (
              <div key={d.dia} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">
                  {new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted/40">
                  <div className="h-full rounded bg-[#22c55e]" style={{ width: `${(d.enviadas / maxDia) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold text-foreground">{d.enviadas}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader><CardTitle className="text-base">Por template / tipo</CardTitle></CardHeader>
          <CardContent>
            {stats.por_template.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p>
            ) : (
              <div className="space-y-2">
                {stats.por_template.map((t) => (
                  <div key={t.template} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
                    <span className="truncate text-sm text-foreground">{t.template}</span>
                    <span className="ml-2 shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{t.total}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
