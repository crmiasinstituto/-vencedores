import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sparkles, Send, CheckSquare, ArrowRight, MessageSquare, Loader2,
  Copy, RefreshCw, Trophy, AlertTriangle,
} from 'lucide-react';

const db = supabase as any;

interface Props {
  meetingId: string;
  plan: any;
  leadId: string | null;
  boardId?: string | null;
  onUpdated?: () => void;
}

const OUTCOME_META: Record<string, { label: string; color: string }> = {
  ganhou:    { label: '🏆 Ganhou',      color: '#10B981' },
  avancou:   { label: '↗  Avançou',     color: '#3B82F6' },
  estagnou:  { label: '⏸  Estagnou',    color: '#F59E0B' },
  perdeu:    { label: '❌ Perdeu',      color: '#EF4444' },
  sem_call:  { label: '📵 No-show',     color: '#6B7280' },
};

export default function PostCallPlanPanel({ meetingId, plan: initialPlan, leadId, boardId, onUpdated }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [email, setEmail] = useState(initialPlan?.email?.body || '');
  const [subject, setSubject] = useState(initialPlan?.email?.subject || '');
  const [whatsapp, setWhatsapp] = useState(initialPlan?.whatsapp_followup || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  if (!plan) {
    return (
      <Card><CardContent className="p-6 text-center">
        <Sparkles className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">Ainda nao tem plano pos-call pra esta reuniao</p>
        <Button size="sm" onClick={regeneratePlan} disabled={regenerating}>
          {regenerating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          Gerar plano agora
        </Button>
      </CardContent></Card>
    );
  }

  async function regeneratePlan() {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-post-call-actions', {
        body: { meeting_id: meetingId, auto_execute: false },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      setPlan((data as any).plan);
      setEmail((data as any).plan.email?.body || '');
      setSubject((data as any).plan.email?.subject || '');
      setWhatsapp((data as any).plan.whatsapp_followup || '');
      toast.success('Plano gerado pela IA');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally { setRegenerating(false); }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  async function sendWhatsappNow() {
    if (!leadId || !whatsapp.trim()) return;
    setBusy('whatsapp');
    try {
      const { data: lead } = await db.from('crm_leads').select('whatsapp').eq('id', leadId).single();
      // Mensagem 1-to-1 pos-call: usa instancia UAZAPI, nunca Cloud API/blast.
      const { data: inst } = await db.from('whatsapp_instances').select('id')
        .eq('status', 'connected')
        .eq('provider', 'uazapi')
        .not('is_dedicated_blast', 'is', true)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (!lead?.whatsapp || !inst) throw new Error('Lead sem whatsapp ou instancia UAZAPI desconectada');
      await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'send_text', instance_id: inst.id, phone: lead.whatsapp, message: whatsapp, lead_id: leadId, sent_by: 'post_call_plan' },
      });
      toast.success('Mensagem enviada no WhatsApp');
      onUpdated?.();
    } catch (e: any) { toast.error('Erro: ' + e.message); }
    finally { setBusy(null); }
  }

  async function createTasks() {
    if (!leadId || !plan?.tasks?.length) return;
    setBusy('tasks');
    try {
      for (const t of plan.tasks) {
        await db.from('tasks').insert({
          lead_id: leadId, title: t.title,
          due_date: new Date(Date.now() + (t.due_in_hours || 24) * 3600_000).toISOString(),
          type: 'task', status: 'pending',
        });
      }
      toast.success(`${plan.tasks.length} tarefa(s) criada(s)`);
      onUpdated?.();
    } catch (e: any) { toast.error('Erro: ' + e.message); }
    finally { setBusy(null); }
  }

  async function moveStage() {
    if (!leadId || !plan?.suggested_stage) return;
    setBusy('stage');
    try {
      const { data: cols } = await db.from('crm_columns').select('id, name, board_id');
      const target = (cols || []).find((c: any) =>
        (!boardId || c.board_id === boardId) &&
        (c.name || '').toLowerCase().includes((plan.suggested_stage || '').toLowerCase())
      );
      if (!target) throw new Error(`Estagio "${plan.suggested_stage}" nao encontrado`);
      await db.from('crm_leads').update({ column_id: target.id, updated_at: new Date().toISOString() }).eq('id', leadId);
      toast.success(`Lead movido pra "${target.name}"`);
      onUpdated?.();
    } catch (e: any) { toast.error('Erro: ' + e.message); }
    finally { setBusy(null); }
  }

  const outcome = OUTCOME_META[plan.outcome] || { label: plan.outcome, color: '#6B7280' };

  return (
    <div className="space-y-3">
      {/* Header com outcome + summary */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold">Plano pos-call IA</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge style={{ backgroundColor: `${outcome.color}22`, color: outcome.color, borderColor: `${outcome.color}55` }} variant="outline">
                {outcome.label}
              </Badge>
              <Button size="sm" variant="ghost" onClick={regeneratePlan} disabled={regenerating} title="Regenerar">
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Resumo</p>
            <p className="text-sm">{plan.timeline_summary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Sugestão de stage */}
      {plan.suggested_stage && (
        <Card className="border-blue-500/30">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <ArrowRight className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs font-bold uppercase text-blue-500">Proximo estagio</p>
                <p className="text-sm">Mover lead para <strong>{plan.suggested_stage}</strong></p>
              </div>
            </div>
            <Button size="sm" onClick={moveStage} disabled={busy === 'stage'} className="bg-blue-500 hover:bg-blue-600 text-white">
              {busy === 'stage' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 mr-1.5" />}
              Mover
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tarefas */}
      {plan.tasks?.length > 0 && (
        <Card className="border-green-500/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-green-500" />
                <p className="text-sm font-bold">Tarefas sugeridas ({plan.tasks.length})</p>
              </div>
              <Button size="sm" onClick={createTasks} disabled={busy === 'tasks'} className="bg-green-500 hover:bg-green-600 text-white">
                {busy === 'tasks' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5 mr-1.5" />}
                Criar todas
              </Button>
            </div>
            <div className="space-y-1.5">
              {plan.tasks.map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded-lg">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`} />
                  <span className="flex-1">{t.title}</span>
                  <Badge variant="outline" className="text-[10px]">em {t.due_in_hours}h</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp */}
      {whatsapp && (
        <Card className="border-[#25D366]/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#25D366]" />
              <p className="text-sm font-bold">WhatsApp de follow-up</p>
            </div>
            <Textarea value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="min-h-[80px] text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyText(whatsapp, 'Mensagem')} className="flex-1">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
              </Button>
              <Button size="sm" onClick={sendWhatsappNow} disabled={busy === 'whatsapp'} className="flex-1 bg-[#25D366] hover:bg-[#25D366]/90 text-white">
                {busy === 'whatsapp' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Enviar agora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email */}
      {plan.email && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-bold">E-mail de follow-up</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Assunto</p>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-muted/30 rounded-md px-3 py-2 text-sm border border-border"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Corpo</p>
              <Textarea value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[180px] text-sm font-sans" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyText(`Assunto: ${subject}\n\n${email}`, 'E-mail')} className="flex-1">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar tudo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
