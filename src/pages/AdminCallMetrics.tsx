import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Phone, PhoneCall, PhoneOff, PhoneMissed, Clock, TrendingUp, BarChart3,
  ArrowUpRight, ArrowDownLeft, RefreshCw, User, MessageSquare, ThumbsUp, Minus, ThumbsDown,
} from 'lucide-react';
import { formatDuration } from '@/hooks/useWavoip';
import { format, startOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = 'hoje' | '7d' | '30d';

function usePeriodDate(period: Period): string {
  if (period === 'hoje') return startOfDay(new Date()).toISOString();
  if (period === '7d') return subDays(new Date(), 7).toISOString();
  return subDays(new Date(), 30).toISOString();
}

function useCallMetrics(period: Period) {
  const since = usePeriodDate(period);
  return useQuery({
    queryKey: ['call-metrics', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_history')
        .select('id, direction, status, duration_seconds, peer_phone, peer_name, lead_id, ai_sentiment, ai_summary, started_at, ended_at, created_at, crm_leads(name, whatsapp, column_id, closed_at, lost_reason, deal_value, potential_value)')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, lead: r.crm_leads }));
    },
    refetchInterval: 30_000,
  });
}

const SENTIMENT_CONFIG = {
  positive: { label: 'Positivo', color: 'text-green-600', bg: 'bg-green-500/10', icon: ThumbsUp },
  neutral: { label: 'Neutro', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Minus },
  negative: { label: 'Negativo', color: 'text-red-600', bg: 'bg-red-500/10', icon: ThumbsDown },
};

export default function AdminCallMetrics() {
  const [period, setPeriod] = useState<Period>('hoje');
  const { data: calls = [], isLoading, refetch } = useCallMetrics(period);

  const metrics = useMemo(() => {
    const outgoing = calls.filter((c: any) => c.direction === 'outgoing' || c.direction === 'OUTGOING');
    const incoming = calls.filter((c: any) => c.direction === 'incoming' || c.direction === 'INCOMING');
    const answered = calls.filter((c: any) =>
      (c.status === 'ENDED' || c.status === 'ACTIVE' || c.status === 'CONNECTED') && (c.duration_seconds || 0) > 0,
    );
    const notAnswered = calls.filter((c: any) =>
      c.status === 'NOT_ANSWERED' || c.status === 'REJECTED' || c.status === 'FAILED' || ((c.status === 'ENDED') && (c.duration_seconds || 0) === 0),
    );
    const totalDuration = answered.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0);
    const avgDuration = answered.length > 0 ? Math.round(totalDuration / answered.length) : 0;

    const sentiments = { positive: 0, neutral: 0, negative: 0 };
    calls.forEach((c: any) => {
      if (c.ai_sentiment && sentiments.hasOwnProperty(c.ai_sentiment)) {
        sentiments[c.ai_sentiment as keyof typeof sentiments]++;
      }
    });

    const byHour: Record<number, number> = {};
    calls.forEach((c: any) => {
      const h = new Date(c.created_at).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
    });
    const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];

    const uniqueLeadsCalled = new Set(answered.filter((c: any) => c.lead_id).map((c: any) => c.lead_id));
    const leadsWon = answered.filter((c: any) => c.lead?.closed_at && !c.lead?.lost_reason);
    const uniqueLeadsWon = new Set(leadsWon.map((c: any) => c.lead_id));
    const revenue = [...uniqueLeadsWon].reduce((sum, lid) => {
      const call = answered.find((c: any) => c.lead_id === lid);
      return sum + (call?.lead?.deal_value || call?.lead?.potential_value || 0);
    }, 0);
    const conversionRate = uniqueLeadsCalled.size > 0 ? (uniqueLeadsWon.size / uniqueLeadsCalled.size) * 100 : 0;

    return {
      total: calls.length,
      outgoing: outgoing.length,
      incoming: incoming.length,
      answered: answered.length,
      notAnswered: notAnswered.length,
      answerRate: calls.length > 0 ? ((answered.length / calls.length) * 100) : 0,
      totalDuration,
      avgDuration,
      sentiments,
      peakHour: peakHour ? `${peakHour[0]}h (${peakHour[1]} calls)` : '-',
      longestCall: Math.max(0, ...calls.map((c: any) => c.duration_seconds || 0)),
      uniqueLeadsCalled: uniqueLeadsCalled.size,
      leadsWon: uniqueLeadsWon.size,
      conversionRate,
      revenue,
    };
  }, [calls]);

  const periodLabel = { hoje: 'Hoje', '7d': 'Ultimos 7 dias', '30d': 'Ultimos 30 dias' };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-[#BAA05E]" />
            Central de Ligacoes
          </h1>
          <p className="text-muted-foreground text-sm">Metricas de performance em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-5"><div className="animate-pulse space-y-2"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-8 bg-muted rounded w-1/2" /></div></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Phone}
              iconColor="#BAA05E"
              label="Ligacoes feitas"
              value={String(metrics.total)}
              sub={`${metrics.outgoing} saintes, ${metrics.incoming} recebidas`}
            />
            <MetricCard
              icon={PhoneCall}
              iconColor="#22c55e"
              label="Atendidas"
              value={String(metrics.answered)}
              sub={`${metrics.answerRate.toFixed(0)}% taxa de atendimento`}
              highlight={metrics.answerRate >= 50 ? 'green' : metrics.answerRate >= 30 ? 'yellow' : 'red'}
            />
            <MetricCard
              icon={PhoneMissed}
              iconColor="#ef4444"
              label="Nao atendidas"
              value={String(metrics.notAnswered)}
              sub={metrics.notAnswered > 0 ? 'Tentar novamente mais tarde' : 'Todas atendidas!'}
            />
            <MetricCard
              icon={Clock}
              iconColor="#8b5cf6"
              label="Duracao media"
              value={formatDuration(metrics.avgDuration)}
              sub={`Total: ${formatDuration(metrics.totalDuration)} | Max: ${formatDuration(metrics.longestCall)}`}
            />
          </div>

          {/* Conversao */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={User}
              iconColor="#06b6d4"
              label="Leads contatados"
              value={String(metrics.uniqueLeadsCalled)}
              sub="Leads unicos atendidos"
            />
            <MetricCard
              icon={TrendingUp}
              iconColor="#22c55e"
              label="Vendas por ligacao"
              value={String(metrics.leadsWon)}
              sub={`${metrics.conversionRate.toFixed(0)}% taxa de conversao`}
              highlight={metrics.conversionRate >= 20 ? 'green' : metrics.conversionRate >= 10 ? 'yellow' : undefined}
            />
            <MetricCard
              icon={BarChart3}
              iconColor="#f59e0b"
              label="Receita gerada"
              value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.revenue)}
              sub={metrics.leadsWon > 0 ? `Ticket medio: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.revenue / metrics.leadsWon)}` : 'Nenhuma venda ainda'}
            />
            <MetricCard
              icon={Phone}
              iconColor="#a855f7"
              label="Ligacoes por venda"
              value={metrics.leadsWon > 0 ? (metrics.answered / metrics.leadsWon).toFixed(1) : '-'}
              sub={metrics.leadsWon > 0 ? 'Media de ligacoes pra fechar' : 'Faz a primeira venda!'}
            />
          </div>

          {/* Sentiment + Peak */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(SENTIMENT_CONFIG).map(([key, cfg]) => {
              const count = metrics.sentiments[key as keyof typeof metrics.sentiments];
              const pct = metrics.answered > 0 ? ((count / metrics.answered) * 100).toFixed(0) : '0';
              return (
                <Card key={key} className={cfg.bg}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <cfg.icon className={`h-6 w-6 ${cfg.color}`} />
                    <div>
                      <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                      <p className="text-xs text-muted-foreground">{cfg.label} ({pct}%)</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Call List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Ligacoes - {periodLabel[period]} ({calls.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calls.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma ligacao no periodo.</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {calls.map((call: any) => (
                    <CallRow key={call.id} call={call} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, iconColor, label, value, sub, highlight }: {
  icon: any; iconColor: string; label: string; value: string; sub: string; highlight?: 'green' | 'yellow' | 'red';
}) {
  const highlightColors = { green: 'border-green-500/30', yellow: 'border-amber-500/30', red: 'border-red-500/30' };
  return (
    <Card className={highlight ? highlightColors[highlight] : ''}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}20` }}>
            <Icon className="h-4 w-4" style={{ color: iconColor }} />
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        </div>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function CallRow({ call }: { call: any }) {
  const isOutgoing = call.direction === 'outgoing' || call.direction === 'OUTGOING';
  const isAnswered = (call.status === 'ENDED' || call.status === 'ACTIVE' || call.status === 'CONNECTED') && (call.duration_seconds || 0) > 0;
  const sentiment = call.ai_sentiment as string | null;
  const sentCfg = sentiment ? SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG] : null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAnswered ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
        {isOutgoing
          ? <ArrowUpRight className={`h-4 w-4 ${isAnswered ? 'text-green-600' : 'text-red-500'}`} />
          : <ArrowDownLeft className={`h-4 w-4 ${isAnswered ? 'text-green-600' : 'text-red-500'}`} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {call.lead?.name || call.peer_name || call.peer_phone}
          </p>
          {sentCfg && (
            <Badge variant="outline" className={`text-[10px] ${sentCfg.color}`}>
              {sentCfg.label}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {call.peer_phone}
          {call.ai_summary && ` · ${call.ai_summary.slice(0, 60)}...`}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-mono">
          {isAnswered ? formatDuration(call.duration_seconds || 0) : '--:--'}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {format(new Date(call.created_at), "HH:mm · dd/MM", { locale: ptBR })}
        </p>
      </div>

      <Badge variant={isAnswered ? 'default' : 'destructive'} className="text-[10px] shrink-0">
        {isAnswered ? 'Atendida' : call.status === 'NOT_ANSWERED' ? 'Sem resposta' : call.status === 'REJECTED' ? 'Rejeitada' : 'Falhou'}
      </Badge>
    </div>
  );
}
