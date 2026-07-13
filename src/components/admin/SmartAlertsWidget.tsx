import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertTriangle, Bell, Clock, UserX, Flame, ChevronRight, Loader2,
  CalendarX, DollarSign, MessageCircle,
} from 'lucide-react';

const db = supabase as any;

interface Alert {
  id: string;
  type: 'cold_lead' | 'unconfirmed_meeting' | 'overdue_task' | 'no_show' | 'hot_lead_stuck' | 'overdue_payment';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  lead_id?: string;
  meeting_id?: string;
  task_id?: string;
  link?: string;
  created_at: string;
}

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  cold_lead:            { icon: Clock,       color: '#6B7280', label: 'Lead esquecido' },
  unconfirmed_meeting:  { icon: CalendarX,   color: '#F59E0B', label: 'Sem confirmacao' },
  overdue_task:         { icon: AlertTriangle, color: '#EF4444', label: 'Tarefa atrasada' },
  no_show:              { icon: UserX,       color: '#EF4444', label: 'No-show' },
  hot_lead_stuck:       { icon: Flame,       color: '#F97316', label: 'Lead quente parado' },
  overdue_payment:      { icon: DollarSign,  color: '#EF4444', label: 'Pagamento atrasado' },
};

export default function SmartAlertsWidget() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    compute();
    const i = setInterval(compute, 5 * 60_000);
    return () => clearInterval(i);
  }, []);

  const compute = async () => {
    setLoading(true);
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400_000).toISOString();
    const tomorrow = new Date(now.getTime() + 86400_000).toISOString();

    // Parallel queries
    const [
      coldLeadsRes,
      unconfirmedMeetingsRes,
      overdueTasksRes,
      noShowsRes,
      hotStuckRes,
      overduePaymentsRes,
    ] = await Promise.all([
      // Cold leads: stage not Fechado/Perdido, no activity in 3+ days
      db.from('crm_leads')
        .select('id, name, updated_at, column_id, lead_score')
        .lte('updated_at', threeDaysAgo)
        .is('closed_at', null)
        .limit(10),
      // Meetings tomorrow without confirmation
      db.from('meetings')
        .select('id, title, lead_id, scheduled_at, status')
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', tomorrow)
        .eq('status', 'scheduled')
        .limit(10),
      // Overdue tasks
      db.from('tasks')
        .select('id, title, lead_id, due_date')
        .is('completed_at', null)
        .lt('due_date', now.toISOString())
        .limit(10),
      // Past meetings without started_at = no-shows
      db.from('meetings')
        .select('id, title, lead_id, scheduled_at, started_at, ended_at')
        .lt('scheduled_at', now.toISOString())
        .is('started_at', null)
        .gte('scheduled_at', new Date(now.getTime() - 3 * 86400_000).toISOString())
        .limit(5),
      // Hot leads (score >= 70) without activity in 2+ days
      db.from('crm_leads')
        .select('id, name, lead_score, updated_at')
        .gte('lead_score', 70)
        .is('closed_at', null)
        .lte('updated_at', new Date(now.getTime() - 2 * 86400_000).toISOString())
        .limit(5),
      // Overdue payments
      db.from('member_payments')
        .select('id, value, due_date, member_id, status')
        .in('status', ['pending', 'overdue'])
        .lt('due_date', now.toISOString())
        .limit(5),
    ]);

    const list: Alert[] = [];

    for (const l of (coldLeadsRes.data || [])) {
      const daysAgo = Math.floor((now.getTime() - new Date(l.updated_at).getTime()) / 86400_000);
      list.push({
        id: `cold-${l.id}`,
        type: 'cold_lead',
        severity: daysAgo > 7 ? 'high' : 'medium',
        title: `${l.name || 'Lead sem nome'} sem contato ha ${daysAgo} dias`,
        description: `Score ${l.lead_score || 0} — reative antes de perder`,
        lead_id: l.id,
        link: `/admin/crm?lead=${l.id}`,
        created_at: l.updated_at,
      });
    }

    for (const m of (unconfirmedMeetingsRes.data || [])) {
      const hoursUntil = Math.round((new Date(m.scheduled_at).getTime() - now.getTime()) / 3600_000);
      list.push({
        id: `unconfirmed-${m.id}`,
        type: 'unconfirmed_meeting',
        severity: hoursUntil < 4 ? 'high' : 'medium',
        title: `"${m.title}" em ${hoursUntil}h sem confirmacao`,
        description: 'Mande o lembrete pra evitar no-show',
        meeting_id: m.id,
        lead_id: m.lead_id,
        link: m.lead_id ? `/admin/crm?lead=${m.lead_id}` : '/admin/agenda',
        created_at: m.scheduled_at,
      });
    }

    for (const t of (overdueTasksRes.data || [])) {
      const hoursOverdue = Math.floor((now.getTime() - new Date(t.due_date).getTime()) / 3600_000);
      list.push({
        id: `task-${t.id}`,
        type: 'overdue_task',
        severity: hoursOverdue > 24 ? 'high' : 'medium',
        title: t.title,
        description: hoursOverdue > 24 ? `Atrasada ha ${Math.floor(hoursOverdue / 24)} dia(s)` : `Atrasada ha ${hoursOverdue}h`,
        task_id: t.id,
        lead_id: t.lead_id,
        link: t.lead_id ? `/admin/crm?lead=${t.lead_id}` : '/admin/agenda',
        created_at: t.due_date,
      });
    }

    for (const m of (noShowsRes.data || [])) {
      list.push({
        id: `noshow-${m.id}`,
        type: 'no_show',
        severity: 'high',
        title: `No-show: "${m.title}"`,
        description: 'Lead nao compareceu a call. Reagende ou marque como perdido.',
        meeting_id: m.id,
        lead_id: m.lead_id,
        link: m.lead_id ? `/admin/crm?lead=${m.lead_id}` : '/admin/agenda',
        created_at: m.scheduled_at,
      });
    }

    for (const l of (hotStuckRes.data || [])) {
      list.push({
        id: `hotstuck-${l.id}`,
        type: 'hot_lead_stuck',
        severity: 'high',
        title: `🔥 ${l.name || 'Lead'} quente parado (score ${l.lead_score})`,
        description: 'Lead quente sem atividade ha 2+ dias. Chama ele AGORA.',
        lead_id: l.id,
        link: `/admin/crm?lead=${l.id}`,
        created_at: l.updated_at,
      });
    }

    for (const p of (overduePaymentsRes.data || [])) {
      const daysOverdue = Math.floor((now.getTime() - new Date(p.due_date).getTime()) / 86400_000);
      list.push({
        id: `pay-${p.id}`,
        type: 'overdue_payment',
        severity: daysOverdue > 5 ? 'high' : 'medium',
        title: `Pagamento de R$ ${Number(p.value).toFixed(2)} atrasado`,
        description: daysOverdue > 0 ? `${daysOverdue} dia(s) em atraso` : 'Vencendo hoje',
        link: '/admin/recebimentos',
        created_at: p.due_date,
      });
    }

    // Sort by severity then date
    const sevOrder = { high: 3, medium: 2, low: 1 };
    list.sort((a, b) => {
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[b.severity] - sevOrder[a.severity];
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setAlerts(list);
    setLoading(false);
  };

  const high = alerts.filter(a => a.severity === 'high').length;
  const medium = alerts.filter(a => a.severity === 'medium').length;

  return (
    <Card className="border-yellow-500/20">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/15 flex items-center justify-center relative">
              <Bell className="w-5 h-5 text-yellow-500" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold">Alertas inteligentes</p>
              <p className="text-[11px] text-muted-foreground">
                {alerts.length === 0 ? 'Tudo sob controle' : `${high} criticos · ${medium} medios`}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={compute} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {loading && !alerts.length ? (
          <p className="text-xs text-muted-foreground">Calculando...</p>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-2">
              <Flame className="w-6 h-6 text-green-500" />
            </div>
            <p className="text-sm font-medium">Sem alertas agora</p>
            <p className="text-xs text-muted-foreground">Nada precisando de atencao imediata</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {alerts.slice(0, 10).map(alert => {
              const meta = TYPE_META[alert.type];
              const Icon = meta.icon;
              const sevBg = alert.severity === 'high' ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                : alert.severity === 'medium' ? 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                : 'bg-muted/30 border-border hover:bg-muted/50';
              return (
                <button
                  key={alert.id}
                  onClick={() => alert.link && navigate(alert.link)}
                  className={`w-full text-left flex items-start gap-3 p-2.5 rounded-lg border ${sevBg} transition-colors`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{alert.title}</p>
                      <Badge variant="outline" className="text-[9px] uppercase flex-shrink-0" style={{ color: meta.color, borderColor: meta.color + '55' }}>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                  {alert.link && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-1 text-muted-foreground" />}
                </button>
              );
            })}
            {alerts.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center pt-2">+{alerts.length - 10} alertas adicionais</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
