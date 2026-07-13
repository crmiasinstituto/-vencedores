import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp, TrendingDown, Users, MessageCircle, Target, CalendarCheck,
  CheckCircle2, DollarSign, ArrowRight, Percent, Bot, RefreshCw, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';

const db = supabase as any;

type Period = '7d' | '30d' | '90d' | 'all';

const STAGE_MAP: Record<string, { label: string; icon: any; color: string; order: number }> = {
  'Captado':         { label: 'Captado',          icon: Users,         color: '#6B7280', order: 1 },
  'Primeiro Contato': { label: 'Primeiro Contato', icon: MessageCircle, color: '#3B82F6', order: 2 },
  'Qualificado':      { label: 'Qualificado',      icon: Target,         color: '#F59E0B', order: 3 },
  'Call Agendada':    { label: 'Call Agendada',    icon: CalendarCheck, color: '#8B5CF6', order: 4 },
  'Proposta':         { label: 'Proposta',         icon: ArrowRight,     color: '#EC4899', order: 5 },
  'Negociação':       { label: 'Negociação',       icon: ArrowRight,     color: '#06B6D4', order: 6 },
  'Fechado':          { label: 'Fechado',          icon: CheckCircle2,   color: '#10B981', order: 7 },
  'Perdido':          { label: 'Perdido',          icon: TrendingDown,  color: '#EF4444', order: 99 },
};

function normalizeStage(name: string): string {
  const t = (name || '').toLowerCase().trim();
  if (t.includes('captad')) return 'Captado';
  if (t.includes('primeiro') || t.includes('contat')) return 'Primeiro Contato';
  if (t.includes('qualif')) return 'Qualificado';
  if (t.includes('call') || t.includes('agenda')) return 'Call Agendada';
  if (t.includes('propost')) return 'Proposta';
  if (t.includes('negoc')) return 'Negociação';
  if (t.includes('fechad') || t.includes('conver') || t.includes('vendi')) return 'Fechado';
  if (t.includes('perd') || t.includes('lost')) return 'Perdido';
  return name || '(sem stage)';
}

export default function AdminFunil() {
  const [period, setPeriod] = useState<Period>('30d');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [stageByColumn, setStageByColumn] = useState<Record<string, string>>({});

  const periodStart = useMemo(() => {
    if (period === 'all') return new Date(0);
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    return new Date(Date.now() - days * 86400_000);
  }, [period]);

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    const [cols, leadsRes, meetingsRes, paymentsRes, msgsRes] = await Promise.all([
      db.from('crm_columns').select('id, name'),
      db.from('crm_leads').select('id, name, source, column_id, created_at, updated_at, closed_at, potential_value, deal_value, lost_reason').gte('created_at', periodStart.toISOString()),
      db.from('meetings').select('id, lead_id, status, scheduled_at, started_at, ended_at, kind, metadata').gte('created_at', periodStart.toISOString()),
      db.from('member_payments').select('id, member_id, value, paid_value, status, paid_at').gte('created_at', periodStart.toISOString()),
      db.from('whatsapp_messages').select('lead_id, direction, created_at').gte('created_at', periodStart.toISOString()).limit(5000),
    ]);

    const colMap: Record<string, string> = {};
    (cols.data || []).forEach((c: any) => { colMap[c.id] = normalizeStage(c.name); });
    setStageByColumn(colMap);
    setLeads(leadsRes.data || []);
    setMeetings(meetingsRes.data || []);
    setPayments(paymentsRes.data || []);
    setMessages(msgsRes.data || []);
    setLoading(false);
  };

  const availableSources = useMemo(() => {
    const s = new Set<string>();
    leads.forEach(l => { if (l.source) s.add(l.source); });
    return Array.from(s).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (sourceFilter === 'all') return leads;
    return leads.filter(l => l.source === sourceFilter);
  }, [leads, sourceFilter]);

  const funnel = useMemo(() => {
    const leadsInPeriod = filteredLeads;
    const captured = leadsInPeriod.length;

    const repliedLeadIds = new Set<string>();
    messages.forEach(m => { if (m.direction === 'outbound' && m.lead_id) repliedLeadIds.add(m.lead_id); });
    const responded = leadsInPeriod.filter(l => repliedLeadIds.has(l.id)).length;

    const qualifiedStages = new Set(['Qualificado', 'Call Agendada', 'Proposta', 'Negociação', 'Fechado']);
    const qualified = leadsInPeriod.filter(l => qualifiedStages.has(stageByColumn[l.column_id])).length;

    const meetingsByLead = new Map<string, any[]>();
    meetings.forEach(m => {
      if (!m.lead_id) return;
      if (!meetingsByLead.has(m.lead_id)) meetingsByLead.set(m.lead_id, []);
      meetingsByLead.get(m.lead_id)!.push(m);
    });
    const scheduled = leadsInPeriod.filter(l => meetingsByLead.get(l.id)?.length).length;
    const attended = leadsInPeriod.filter(l => meetingsByLead.get(l.id)?.some((m: any) => m.started_at)).length;

    const closedStages = new Set(['Fechado']);
    const closed = leadsInPeriod.filter(l => closedStages.has(stageByColumn[l.column_id])).length;

    const totalRevenue = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.paid_value || p.value || 0), 0);

    return [
      { stage: 'Captado',      count: captured,  icon: Users,         color: '#6B7280' },
      { stage: 'Respondeu',    count: responded, icon: MessageCircle, color: '#3B82F6' },
      { stage: 'Qualificado',  count: qualified, icon: Target,        color: '#F59E0B' },
      { stage: 'Agendado',     count: scheduled, icon: CalendarCheck, color: '#8B5CF6' },
      { stage: 'Compareceu',   count: attended,  icon: CheckCircle2,  color: '#EC4899' },
      { stage: 'Fechou',       count: closed,    icon: CheckCircle2,  color: '#10B981' },
    ];
  }, [filteredLeads, messages, meetings, stageByColumn, payments]);

  const conversionRates = useMemo(() => {
    const rates: { from: string; to: string; rate: number }[] = [];
    for (let i = 1; i < funnel.length; i++) {
      const prev = funnel[i - 1].count;
      const curr = funnel[i].count;
      rates.push({
        from: funnel[i - 1].stage,
        to: funnel[i].stage,
        rate: prev ? (curr / prev) * 100 : 0,
      });
    }
    return rates;
  }, [funnel]);

  const sourceBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredLeads.forEach(l => { const s = l.source || 'direto'; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredLeads]);

  const stageBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const stage = stageByColumn[l.column_id] || '(sem stage)';
      m[stage] = (m[stage] || 0) + 1;
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value, color: STAGE_MAP[name]?.color || '#6B7280', order: STAGE_MAP[name]?.order || 100 }))
      .sort((a, b) => a.order - b.order);
  }, [filteredLeads, stageByColumn]);

  const totalRevenue = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.paid_value || p.value || 0), 0);
  const pipelineValue = filteredLeads.reduce((s, l) => s + Number(l.deal_value || l.potential_value || 0), 0);
  const avgTicket = funnel[5]?.count ? totalRevenue / funnel[5].count : 0;

  const agentScheduled = meetings.filter(m => m.metadata?.scheduled_by_agent).length;
  const agentCompleted = meetings.filter(m => m.metadata?.scheduled_by_agent && m.status === 'completed').length;

  const funnelMax = funnel[0]?.count || 1;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Funil de Conversão
          </h1>
          <p className="text-sm text-muted-foreground">Onde voce ganha e onde voce perde. Clique numa etapa pra ver os leads.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              {availableSources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="90d">Ultimos 90 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {loading && <div className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Carregando...</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><p className="text-xs text-muted-foreground">Receita</p></div>
            <p className="text-2xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{funnel[5]?.count || 0} vendas · ticket {avgTicket ? `R$ ${avgTicket.toFixed(0)}` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Pipeline</p></div>
            <p className="text-2xl font-bold">R$ {pipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground mt-1">potencial em aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Percent className="w-4 h-4 text-yellow-500" /><p className="text-xs text-muted-foreground">Conversao geral</p></div>
            <p className="text-2xl font-bold">{funnel[0].count ? ((funnel[5].count / funnel[0].count) * 100).toFixed(1) : '0'}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">captado → fechado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Bot className="w-4 h-4 text-purple-500" /><p className="text-xs text-muted-foreground">Calls do agente</p></div>
            <p className="text-2xl font-bold">{agentScheduled}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{agentCompleted} concluidas · {agentScheduled ? ((agentCompleted / agentScheduled) * 100).toFixed(0) : '0'}% no-show</p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-bold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Funil
          </p>
          <div className="space-y-2">
            {funnel.map((step, i) => {
              const Icon = step.icon;
              const pct = (step.count / funnelMax) * 100;
              const rate = i > 0 ? (funnel[i - 1].count ? ((step.count / funnel[i - 1].count) * 100) : 0) : 100;
              const rateColor = rate >= 50 ? 'text-green-500' : rate >= 25 ? 'text-yellow-500' : 'text-red-500';
              return (
                <div key={step.stage} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: step.color }} />
                      <span className="text-sm font-medium">{step.stage}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{step.count}</span>
                      {i > 0 && <Badge variant="outline" className={`text-[10px] ${rateColor}`}>{rate.toFixed(1)}%</Badge>}
                    </div>
                  </div>
                  <div className="h-8 bg-muted/30 rounded-md overflow-hidden">
                    <div
                      className="h-full transition-all rounded-md flex items-center pl-3 text-[11px] text-white font-medium"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: step.color, minWidth: '24px' }}
                    >
                      {pct >= 15 && `${pct.toFixed(0)}% do topo`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-bold mb-3">Leads por canal</p>
            {sourceBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={sourceBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%" outerRadius={80}
                    label={(entry: any) => `${entry.name} (${entry.value})`}
                  >
                    {sourceBreakdown.map((_, i) => (
                      <Cell key={i} fill={['#3B82F6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'][i % 8]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-bold mb-3">Distribuicao no pipeline</p>
            {stageBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stageBreakdown} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis dataKey="name" type="category" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {stageBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion rates between stages */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-bold mb-3">Taxas de conversao entre etapas</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {conversionRates.map((r, i) => {
              const color = r.rate >= 50 ? 'text-green-500' : r.rate >= 25 ? 'text-yellow-500' : 'text-red-500';
              return (
                <div key={i} className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">{r.from} → {r.to}</p>
                  <p className={`text-xl font-bold ${color}`}>{r.rate.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
