import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  MessageCircle, CheckCircle2, Clock, AlertTriangle, Wrench,
  Calendar, TrendingUp, Bot, UserMinus, Pause, RefreshCw,
} from 'lucide-react';

const db = supabase as any;

export default function AgentV2Dashboard({ agentId }: { agentId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [toolUsage, setToolUsage] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => { if (agentId) load(); }, [agentId]);

  const load = async () => {
    setLoading(true);
    const sinceWeek = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [convRes, logsRes, meetingsRes, enrollmentsRes] = await Promise.all([
      db.from('ai_agent_conversations').select('id, status, total_messages_sent, total_messages_received, bot_detection_score, pause_reason, last_processed_at, updated_at, crm_leads!inner(id, name, whatsapp)')
        .eq('agent_id', agentId).order('updated_at', { ascending: false }).limit(200),
      db.from('ai_agent_logs').select('id, log_type, data, tokens_input, tokens_output, duration_ms, created_at')
        .eq('agent_id', agentId).gte('created_at', sinceWeek).order('created_at', { ascending: false }).limit(500),
      db.from('meetings').select('id, title, scheduled_at, status, metadata')
        .gte('created_at', sinceWeek).limit(50),
      db.from('ai_agent_cadence_enrollments').select('id, stage, status, current_step, next_action_at, enrolled_at')
        .eq('agent_id', agentId).order('enrolled_at', { ascending: false }).limit(50),
    ]);

    const convs = convRes.data || [];
    const logs = logsRes.data || [];
    const meetings = meetingsRes.data || [];
    const enrollments = enrollmentsRes.data || [];

    const tokensInput = logs.reduce((s: number, l: any) => s + (l.tokens_input || 0), 0);
    const tokensOutput = logs.reduce((s: number, l: any) => s + (l.tokens_output || 0), 0);
    const paused = convs.filter((c: any) => c.status === 'paused').length;
    const scheduledByAgent = meetings.filter((m: any) => m.metadata?.scheduled_by_agent === agentId).length;
    const toolCalls = logs.filter((l: any) => l.log_type === 'tool_call');
    const handoffs = toolCalls.filter((l: any) => l.data?.name === 'transfer_to_human').length;
    const botDetections = convs.filter((c: any) => (c.bot_detection_score || 0) >= 0.5).length;
    const totalMessages = convs.reduce((s: number, c: any) => s + (c.total_messages_sent || 0) + (c.total_messages_received || 0), 0);

    setStats({
      activeConversations: convs.filter((c: any) => c.status === 'active').length,
      pausedConversations: paused,
      totalMessages,
      meetingsScheduled: scheduledByAgent,
      handoffs,
      botDetected: botDetections,
      tokensInput,
      tokensOutput,
      activeEnrollments: enrollments.filter((e: any) => e.status === 'active').length,
    });

    const byTool: Record<string, number> = {};
    toolCalls.forEach((l: any) => {
      const name = l.data?.name;
      if (name) byTool[name] = (byTool[name] || 0) + 1;
    });
    setToolUsage(Object.entries(byTool).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })));

    setRecentActivity(logs.slice(0, 30));
    setConversations(convs.slice(0, 20));
    setLoading(false);
  };

  if (loading || !stats) {
    return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
      Carregando metricas...
    </CardContent></Card>;
  }

  const statCards = [
    { label: 'Conversas ativas', value: stats.activeConversations, icon: MessageCircle, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Conversas pausadas', value: stats.pausedConversations, icon: Pause, color: 'text-yellow-400 bg-yellow-500/10' },
    { label: 'Mensagens trocadas', value: stats.totalMessages, icon: TrendingUp, color: 'text-primary bg-primary/10' },
    { label: 'Reunioes agendadas', value: stats.meetingsScheduled, icon: Calendar, color: 'text-green-400 bg-green-500/10' },
    { label: 'Cadencias ativas', value: stats.activeEnrollments, icon: Clock, color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Handoffs', value: stats.handoffs, icon: UserMinus, color: 'text-orange-400 bg-orange-500/10' },
    { label: 'Bots detectados', value: stats.botDetected, icon: Bot, color: 'text-red-400 bg-red-500/10' },
    { label: 'Tokens (in/out)', value: `${(stats.tokensInput/1000).toFixed(1)}k / ${(stats.tokensOutput/1000).toFixed(1)}k`, icon: Wrench, color: 'text-muted-foreground bg-muted' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Ultimos 7 dias</p>
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tool usage */}
      {toolUsage.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold mb-3">Ferramentas mais usadas</p>
            <div className="space-y-2">
              {toolUsage.map(t => {
                const max = toolUsage[0].count;
                const pct = Math.round((t.count / max) * 100);
                return (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-40 truncate">{t.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-10 text-right">{t.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active conversations */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Conversas recentes</p>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {conversations.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conversa ainda</p>}
            {conversations.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg text-xs">
                <div className={`w-2 h-2 rounded-full ${c.status === 'active' ? 'bg-green-500' : c.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.crm_leads?.name || '(sem nome)'}</p>
                  <p className="text-muted-foreground truncate">
                    {c.total_messages_sent || 0} sent / {c.total_messages_received || 0} recv
                    {c.bot_detection_score > 0 && ` · bot ${(c.bot_detection_score*100).toFixed(0)}%`}
                    {c.pause_reason && ` · ${c.pause_reason}`}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent logs */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Atividade recente</p>
          <div className="space-y-1 max-h-[300px] overflow-auto text-xs">
            {recentActivity.length === 0 && <p className="text-muted-foreground">Sem atividade recente</p>}
            {recentActivity.map((l: any) => {
              const t = new Date(l.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const icon = l.log_type === 'tool_call' ? '🔧' : l.log_type === 'error' ? '❌' : l.log_type === 'skip' ? '⏭️' : l.log_type === 'pause' ? '⏸️' : l.log_type === 'rate_limit' ? '🚫' : '💬';
              const detail = l.log_type === 'tool_call' ? l.data?.name : l.log_type === 'skip' ? l.data?.reason : l.log_type === 'pause' ? l.data?.reason : '';
              return (
                <div key={l.id} className="flex gap-2 p-1.5 hover:bg-muted/30 rounded font-mono">
                  <span className="text-muted-foreground w-12 shrink-0">{t}</span>
                  <span>{icon}</span>
                  <span className="font-sans">{l.log_type}</span>
                  {detail && <span className="text-primary truncate">· {detail}</span>}
                  {l.duration_ms && <span className="text-muted-foreground ml-auto shrink-0">{l.duration_ms}ms</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
