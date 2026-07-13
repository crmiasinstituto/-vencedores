import { useEffect, useState, useCallback } from 'react';
import { supabase as supabaseTyped } from '@/integrations/supabase/client';
// Tabelas social_selling_* não estão nos tipos gerados ainda; usa client untyped pra elas
const supabase = supabaseTyped as any;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, Pause, Camera, ExternalLink, CheckCircle2, XCircle, Clock as ClockIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_LABELS: Record<string, string> = {
  curtir_posts: '❤️ Curtiu post',
  comentar_post: '💬 Comentou post',
  reagir_story: '🔥 Reagiu story',
  responder_story: '📩 Respondeu story',
  enviar_dm: '📩 Enviou DM',
  followup_story: '🔄 Follow-up story',
  verificar_resposta: '👀 Checou inbox',
};

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativa', variant: 'default' },
  completed: { label: 'Concluída', variant: 'secondary' },
  replied: { label: 'Lead respondeu', variant: 'default' },
  paused: { label: 'Pausada', variant: 'outline' },
  failed: { label: 'Falhou', variant: 'destructive' },
};

interface Enrollment {
  id: string;
  lead_id: string;
  instagram_username: string | null;
  automation_id: string | null;
  current_day: number;
  total_days: number;
  status: string;
  started_at: string;
  next_action_at: string | null;
  last_action_at: string | null;
  completed_at: string | null;
  automation?: { id: string; name: string; emoji: string; cadence_config: any } | null;
}

interface Interaction {
  id: string;
  action_type: string;
  status: string;
  day_number: number | null;
  executed_at: string;
  instagram_target: string | null;
  content: string | null;
  error_message: string | null;
}

interface Automation {
  id: string;
  name: string;
  emoji: string;
  is_active: boolean;
  cadence_config: { days?: Array<{ day: number; actions: Array<{ type: string; count?: number }> }> };
}

interface Props {
  leadId: string;
  leadName: string;
  leadInstagram?: string | null;
}

export function LeadSocialSellingTab({ leadId, leadName, leadInstagram }: Props) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<string>('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [enrRes, intRes, autoRes] = await Promise.all([
        supabase.from('social_selling_enrollments')
          .select('*, automation:social_selling_automations(id, name, emoji, cadence_config)')
          .eq('lead_id', leadId)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('social_selling_interactions')
          .select('id, action_type, status, day_number, executed_at, instagram_target, content, error_message')
          .eq('lead_id', leadId)
          .order('executed_at', { ascending: false })
          .limit(50),
        supabase.from('social_selling_automations')
          .select('id, name, emoji, is_active, cadence_config')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);
      setEnrollment(enrRes.data as Enrollment | null);
      setInteractions((intRes.data || []) as Interaction[]);
      setAutomations((autoRes.data || []) as Automation[]);
    } catch (e) {
      toast.error(`Erro ao carregar: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleEnroll = async () => {
    if (!selectedAutomation || !leadInstagram) {
      toast.error('Selecione uma cadência e o lead precisa ter @ do Instagram cadastrado');
      return;
    }
    setEnrolling(true);
    try {
      const auto = automations.find((a) => a.id === selectedAutomation);
      const totalDays = auto?.cadence_config?.days?.length || 3;
      const { error } = await supabase.from('social_selling_enrollments').insert({
        lead_id: leadId,
        automation_id: selectedAutomation,
        instagram_username: String(leadInstagram).toLowerCase().replace(/^@/, ''),
        current_day: 1,
        total_days: totalDays,
        status: 'active',
        next_action_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success('Lead inscrito na cadência');
      await reload();
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setEnrolling(false);
    }
  };

  const handleTogglePause = async () => {
    if (!enrollment) return;
    const nextStatus = enrollment.status === 'active' ? 'paused' : 'active';
    try {
      const { error } = await supabase
        .from('social_selling_enrollments')
        .update({
          status: nextStatus,
          next_action_at: nextStatus === 'active' ? new Date().toISOString() : null,
        })
        .eq('id', enrollment.id);
      if (error) throw error;
      toast.success(nextStatus === 'active' ? 'Cadência reativada' : 'Cadência pausada');
      await reload();
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
    }
  };

  const handleRunNow = async () => {
    if (!enrollment) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-selling-plan-day', {
        body: { enrollment_ids: [enrollment.id], skip_budget: true },
      });
      if (error) throw error;
      if (data?.ok === false && data.reason) {
        toast.warning(`Plano vazio: ${data.reason}`);
      } else if (data?.plan?.length > 0) {
        toast.success(`${data.plan.length} ação(ões) planejada(s). A extensão executa quando o Chrome estiver aberto e logado no IG.`);
      } else {
        toast.info('Nenhuma ação pendente pra hoje');
      }
      await reload();
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 p-2">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Social Selling Instagram</h3>
          <p className="text-xs text-muted-foreground">
            {leadInstagram ? `@${leadInstagram.replace(/^@/, '')}` : 'Lead sem @ de Instagram cadastrado'}
          </p>
        </div>
      </div>

      {!leadInstagram && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            Pra rodar Social Selling, esse lead precisa ter o @ do Instagram cadastrado em "Comercial".
          </CardContent>
        </Card>
      )}

      {/* Status atual ou enrollment */}
      {enrollment ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>{enrollment.automation?.emoji || '🔄'}</span>
                  {enrollment.automation?.name || 'Cadência'}
                  <Badge variant={STATUS_BADGE[enrollment.status]?.variant || 'outline'} className="text-[10px]">
                    {STATUS_BADGE[enrollment.status]?.label || enrollment.status}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  Dia {enrollment.current_day}/{enrollment.total_days} • Inscrito {formatDistanceToNow(new Date(enrollment.started_at), { addSuffix: true, locale: ptBR })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                {(enrollment.status === 'active' || enrollment.status === 'paused') && (
                  <Button size="sm" variant="outline" onClick={handleTogglePause}>
                    {enrollment.status === 'active' ? <><Pause className="w-3 h-3 mr-1" /> Pausar</> : <><Play className="w-3 h-3 mr-1" /> Retomar</>}
                  </Button>
                )}
                {enrollment.status === 'active' && (
                  <Button size="sm" onClick={handleRunNow} disabled={running}>
                    {running ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                    Executar agora
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {enrollment.next_action_at && enrollment.status === 'active' && (
              <p className="text-xs text-muted-foreground">
                ⏰ Próxima ação: {formatDistanceToNow(new Date(enrollment.next_action_at), { addSuffix: true, locale: ptBR })}
              </p>
            )}
            {enrollment.last_action_at && (
              <p className="text-xs text-muted-foreground">
                ✅ Última ação executada: {formatDistanceToNow(new Date(enrollment.last_action_at), { addSuffix: true, locale: ptBR })}
              </p>
            )}
            {enrollment.completed_at && (
              <p className="text-xs text-muted-foreground">
                🏁 Finalizou: {formatDistanceToNow(new Date(enrollment.completed_at), { addSuffix: true, locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>
      ) : leadInstagram ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Iniciar cadência manualmente</CardTitle>
            <CardDescription>
              Inscreve esse lead numa cadência ativa. A extensão Chrome executa as ações respeitando os limites configurados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {automations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma cadência ativa. <a href="/admin/social-selling" className="text-primary hover:underline inline-flex items-center gap-1">
                  Configure em /admin/social-selling <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            ) : (
              <>
                <Select value={selectedAutomation} onValueChange={setSelectedAutomation}>
                  <SelectTrigger><SelectValue placeholder="Selecione a cadência..." /></SelectTrigger>
                  <SelectContent>
                    {automations.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.emoji} {a.name} ({a.cadence_config?.days?.length || 0} dias)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleEnroll} disabled={enrolling || !selectedAutomation}>
                  {enrolling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  Iniciar cadência
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Histórico de ações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de ações</CardTitle>
          <CardDescription>
            Tudo que a extensão executou pra esse lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhuma ação registrada ainda.</p>
          ) : (
            interactions.map((it) => (
              <div key={it.id} className="flex items-start gap-2 text-sm border-b last:border-0 py-2">
                <div className="mt-0.5">
                  {it.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : it.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <ClockIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{ACTION_LABELS[it.action_type] || it.action_type}</span>
                    {it.day_number && <Badge variant="outline" className="text-[10px]">D{it.day_number}</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(it.executed_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  {it.content && (
                    <p className="text-xs text-muted-foreground mt-1 italic break-words">"{it.content}"</p>
                  )}
                  {it.instagram_target && (
                    <a href={it.instagram_target} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1">
                      {it.instagram_target} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {it.error_message && (
                    <p className="text-xs text-red-500 mt-1">⚠ {it.error_message}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
