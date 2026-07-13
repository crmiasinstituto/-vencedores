import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Users, GraduationCap, ShoppingCart, DollarSign, FileText, AlertTriangle, Clock, ArrowRight, TrendingUp, Target, Timer, Banknote } from 'lucide-react';
import { ActivityFeed } from '@/components/crm/ActivityFeed';
import AgendaWidget from '@/components/admin/AgendaWidget';
import SmartAlertsWidget from '@/components/admin/SmartAlertsWidget';
import { showSaleToast } from '@/lib/sale-toast';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLeads: 0,
    alunosAtivos: 0,
    vendasMes: 0,
    receitaMensal: 0,
    contratosAtivos: 0,
  });
  const [crmStats, setCrmStats] = useState({
    taxaConversao: 0,
    ticketMedio: 0,
    tempoMedioFunil: 0,
    receitaTotal: 0,
  });
  // Faturamento da Masterclass IA (vendas Kirvano), separado dos contratos do Metodo
  const [masterclass, setMasterclass] = useState({
    faturamentoTotal: 0,
    vendasTotal: 0,
    faturamentoMes: 0,
    vendasMes: 0,
  });
  const [kanbanSummary, setKanbanSummary] = useState<{ name: string; count: number; color: string }[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; message: string; count: number }[]>([]);
  const [leadsBySource, setLeadsBySource] = useState<{ name: string; count: number }[]>([]);
  const [leadsPerDay, setLeadsPerDay] = useState<{ date: string; count: number }[]>([]);
  const [lossReasons, setLossReasons] = useState<{ reason: string; count: number }[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Realtime: nova venda → toast com foto + som (throttled pra n vendas simultaneas)
  useEffect(() => {
    const channel = supabase
      .channel('admin_dashboard_sales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales_events' }, (payload) => {
        const sale = payload.new as any;
        showSaleToast(sale, { volume: 0.7 });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadDashboard = async () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [leadsRes, crmRes, membersRes, contractsRes, salesRes, activitiesRes, columnsRes, coldLeadsRes, overdueRes] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('crm_leads').select('id', { count: 'exact', head: true }),
      // Alunos ativos = membros ativos de verdade
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      // Vendas/contratos reais (Metodo: Stone, Asaas, manual...) ficam em member_contracts
      supabase.from('member_contracts').select('total_value, status, created_at'),
      // Faturamento Masterclass IA (vendas Kirvano)
      supabase.from('sales_events').select('amount, created_at'),
      supabase.from('crm_activities').select('*').order('created_at', { ascending: false }).limit(10),
      // Kanban summary: get columns with lead counts for first active board
      supabase.from('crm_boards').select('id').eq('is_active', true).order('sort_order').limit(1),
      // Cold leads (>48h)
      supabase.from('crm_leads').select('id', { count: 'exact', head: true }).lt('updated_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),
      // Overdue payments (parcelas de membros vencidas)
      supabase.from('member_payments').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
    ]);

    // Contratos que contam no financeiro (exclui cancelados e VIP/parceria de cortesia)
    const allContracts = (contractsRes.data || []) as any[];
    const activeContracts = allContracts.filter(c => c.status === 'active' || c.status === 'promise');
    const monthContracts = activeContracts.filter(c => c.created_at && c.created_at >= firstDay);
    const receitaTotal = activeContracts.reduce((s, c) => s + Number(c.total_value || 0), 0);
    const receitaMensal = monthContracts.reduce((s, c) => s + Number(c.total_value || 0), 0);
    const ticketMedio = activeContracts.length > 0 ? receitaTotal / activeContracts.length : 0;

    setStats({
      totalLeads: (leadsRes.count || 0) + (crmRes.count || 0),
      alunosAtivos: membersRes.count || 0,
      vendasMes: monthContracts.length,
      receitaMensal,
      contratosAtivos: activeContracts.length,
    });

    // Receita/ticket ja com base nos contratos reais (board sobrescreve taxa/tempo abaixo)
    setCrmStats({ taxaConversao: 0, ticketMedio, tempoMedioFunil: 0, receitaTotal });

    // Faturamento Masterclass IA (Kirvano)
    const salesEvents = (salesRes.data || []) as any[];
    const mcMes = salesEvents.filter(e => e.created_at && e.created_at >= firstDay);
    setMasterclass({
      faturamentoTotal: salesEvents.reduce((s, e) => s + Number(e.amount || 0), 0),
      vendasTotal: salesEvents.length,
      faturamentoMes: mcMes.reduce((s, e) => s + Number(e.amount || 0), 0),
      vendasMes: mcMes.length,
    });

    setActivities(activitiesRes.data || []);

    // Alerts
    const alertsList: typeof alerts = [];
    if ((coldLeadsRes.count || 0) > 0) alertsList.push({ type: 'warning', message: 'Leads esfriando (>48h)', count: coldLeadsRes.count || 0 });
    if ((overdueRes.count || 0) > 0) alertsList.push({ type: 'danger', message: 'Pagamentos vencidos', count: overdueRes.count || 0 });
    setAlerts(alertsList);

    // Kanban summary + CRM analytics
    if (columnsRes.data?.[0]) {
      const boardId = columnsRes.data[0].id;

      const [colsRes, allLeadsRes] = await Promise.all([
        supabase.from('crm_columns').select('id, name, color, is_final_stage').eq('board_id', boardId).order('sort_order'),
        supabase.from('crm_leads').select('id, column_id, source, potential_value, created_at, closed_at, lost_reason, deal_value').eq('board_id', boardId),
      ]);

      const cols = colsRes.data || [];
      const allLeads = (allLeadsRes.data || []) as any[];

      // Kanban summary
      const summary = cols.map(col => ({
        name: col.name,
        color: col.color || '#6B7280',
        count: allLeads.filter(l => l.column_id === col.id).length,
      }));
      setKanbanSummary(summary);

      // CRM KPIs
      const totalLeadsCount = allLeads.length;
      const wonLeads = allLeads.filter(l => l.closed_at && !l.lost_reason);
      const closedLeads = allLeads.filter(l => l.closed_at);

      const taxaConversao = totalLeadsCount > 0
        ? (wonLeads.length / totalLeadsCount) * 100
        : 0;

      // Tempo medio no funil
      let tempoMedioFunil = 0;
      if (closedLeads.length > 0) {
        const totalDays = closedLeads.reduce((sum: number, l: any) => {
          if (l.created_at && l.closed_at) {
            const diffMs = new Date(l.closed_at).getTime() - new Date(l.created_at).getTime();
            return sum + diffMs / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0);
        tempoMedioFunil = totalDays / closedLeads.length;
      }

      setCrmStats({ taxaConversao, ticketMedio, tempoMedioFunil, receitaTotal });

      // Leads by source
      const sourceMap: Record<string, number> = {};
      allLeads.forEach(l => {
        const src = l.source || 'manual';
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      });
      setLeadsBySource(Object.entries(sourceMap).map(([name, count]) => ({ name, count })));

      // Leads per day (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dayMap: Record<string, number> = {};
      for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
        dayMap[d.toISOString().slice(0, 10)] = 0;
      }
      allLeads.forEach(l => {
        if (l.created_at) {
          const day = l.created_at.slice(0, 10);
          if (dayMap[day] !== undefined) dayMap[day]++;
        }
      });
      setLeadsPerDay(Object.entries(dayMap).map(([date, count]) => ({ date, count })));

      // Loss reasons
      const reasonMap: Record<string, number> = {};
      allLeads.forEach(l => {
        if (l.lost_reason) {
          reasonMap[l.lost_reason] = (reasonMap[l.lost_reason] || 0) + 1;
        }
      });
      setLossReasons(
        Object.entries(reasonMap)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
      );
    }
  };

  const kpiCards = [
    { label: 'Total de Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Alunos Ativos', value: stats.alunosAtivos, icon: GraduationCap, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Vendas do Mes', value: stats.vendasMes, icon: ShoppingCart, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Receita Mensal', value: `R$ ${stats.receitaMensal.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Contratos Ativos', value: stats.contratosAtivos, icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  const crmKpiCards = [
    { label: 'Taxa de Conversao', value: `${crmStats.taxaConversao.toFixed(1)}%`, icon: Target, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Ticket Medio', value: `R$ ${crmStats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Tempo Medio no Funil', value: `${crmStats.tempoMedioFunil.toFixed(1)} dias`, icon: Timer, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Receita Total', value: `R$ ${crmStats.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Banknote, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border px-3 py-2 rounded-lg shadow-lg text-xs">
          <p className="text-foreground font-medium">{label || payload[0].name}</p>
          <p className="text-primary font-bold">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Executivo</h1>
        <p className="text-sm text-muted-foreground">Visao geral do ecossistema + que Vencedores</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                alert.type === 'danger'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {alert.type === 'danger' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              <span>{alert.message}</span>
              <Badge variant="secondary" className="text-xs">{alert.count}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className={`${kpi.bg} border-border`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Masterclass IA para Negocios (faturamento Kirvano) */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Masterclass IA para Negocios <span className="text-xs font-normal text-muted-foreground">(Kirvano)</span></h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-emerald-500/10 border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] text-muted-foreground">Faturamento Total</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">R$ {masterclass.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <span className="text-[11px] text-muted-foreground">Vendas Total</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{masterclass.vendasTotal}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] text-muted-foreground">Faturamento do Mes</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">R$ {masterclass.faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <span className="text-[11px] text-muted-foreground">Vendas do Mes</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{masterclass.vendasMes}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CRM Analytics KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Analytics CRM</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {crmKpiCards.map((kpi) => (
            <Card key={kpi.label} className={`${kpi.bg} border-border`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
                </div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Agenda + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgendaWidget />
        <SmartAlertsWidget />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads por Status (Pie) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {kanbanSummary.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={kanbanSummary}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, count }) => `${name} (${count})`}
                    labelLine={false}
                  >
                    {kanbanSummary.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Leads por Fonte (Bar) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads por Fonte</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsBySource.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={leadsBySource}>
                  <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads nos ultimos 30 dias (Line) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads nos ultimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsPerDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={leadsPerDay}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    tickFormatter={(val) => val.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3B82F6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Motivos de Perda (Horizontal Bar) */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Motivos de Perda</CardTitle>
          </CardHeader>
          <CardContent>
            {lossReasons.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={lossReasons} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="reason" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">Nenhum motivo de perda registrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kanban Summary */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pipeline CRM</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/crm')} className="gap-1 text-xs">
              Abrir CRM <ArrowRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {kanbanSummary.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {kanbanSummary.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs text-muted-foreground">{col.name}</span>
                    <span className="text-sm font-bold text-foreground">{col.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum board ativo</p>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <div>
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
