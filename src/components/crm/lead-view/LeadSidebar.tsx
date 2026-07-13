import React, { useState, useEffect } from 'react';
import {
  FileText, Pencil, Plus, Briefcase, Check, Trash2, Loader2,
  Trophy, Ban, MapPin, MessageCircle, Globe, Calendar, DollarSign, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DiscProfileCard } from './DiscProfileCard';

interface LeadSidebarProps {
  leadId: string;
  leadWhatsapp: string;
  leadSourceId?: string | null;
  leadSource?: string | null;
  leadNotes?: string | null;
  leadName: string;
  leadDiscProfile?: string | null;
  leadDiscScores?: Record<string, number> | null;
  onOpenOpportunity?: (leadId: string) => void;
}

export const LeadSidebar: React.FC<LeadSidebarProps> = ({
  leadId, leadWhatsapp, leadSourceId, leadSource, leadNotes, leadName,
  leadDiscProfile, leadDiscScores, onOpenOpportunity,
}) => {
  return (
    <div className="space-y-4">
      <FormInfoCard
        leadId={leadId}
        leadSourceId={leadSourceId}
        leadSource={leadSource}
        leadNotes={leadNotes}
      />
      <DiscProfileCard discProfile={leadDiscProfile} discScores={leadDiscScores} />
      <TasksCard leadId={leadId} />
      <OpportunitiesCard
        leadId={leadId}
        leadWhatsapp={leadWhatsapp}
        onOpenOpportunity={onOpenOpportunity}
      />
    </div>
  );
};

/* =========================================================================
 * FORM INFO CARD
 *   Lê do `leads` (cross-board) via source_lead_id ou whatsapp;
 *   exibe cidade/estado/mensagem original/source.
 * ========================================================================= */
type FormInfo = {
  cidade?: string | null;
  estado?: string | null;
  mensagem?: string | null;
  source?: string | null;
  created_at?: string | null;
};

const FormInfoCard: React.FC<{
  leadId: string;
  leadSourceId?: string | null;
  leadSource?: string | null;
  leadNotes?: string | null;
}> = ({ leadId, leadSourceId, leadSource, leadNotes }) => {
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notesValue, setNotesValue] = useState(leadNotes || '');

  useEffect(() => { setNotesValue(leadNotes || ''); }, [leadNotes]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        let row: any = null;
        if (leadSourceId) {
          const { data } = await supabase
            .from('leads')
            .select('cidade, estado, mensagem, source, created_at')
            .eq('id', leadSourceId)
            .maybeSingle();
          row = data;
        }
        if (mounted) setInfo(row || { source: leadSource });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [leadSourceId, leadSource]);

  const saveNotes = async () => {
    const { error } = await supabase
      .from('crm_leads')
      .update({ notes: notesValue })
      .eq('id', leadId);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Anotações atualizadas');
    setEditing(false);
  };

  const cleanNotes = (notesValue || '').replace(/\[BANT:.*?\]/, '').trim();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">Informações do Formulário</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => setEditing(v => !v)}
          title="Editar anotações"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {(info?.cidade || info?.estado) && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> Cidade, Estado
              </p>
              <p className="font-medium">
                {[info?.cidade, info?.estado].filter(Boolean).join(' , ')}
              </p>
            </div>
          )}

          {(info?.source || leadSource) && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" /> Origem
              </p>
              <p className="font-medium text-xs">{info?.source || leadSource}</p>
            </div>
          )}

          {info?.created_at && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" /> Entrou em
              </p>
              <p className="font-medium text-xs">
                {format(new Date(info.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}

          {info?.mensagem && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <MessageCircle className="w-2.5 h-2.5" /> Mensagem original
              </p>
              <p className="text-xs leading-relaxed bg-muted/30 rounded-md p-2 border border-border">
                {info.mensagem}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
              Anotações
            </p>
            {editing ? (
              <div className="space-y-1.5">
                <Textarea
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  className="min-h-[80px] text-xs"
                  placeholder="Anotações sobre o lead..."
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={saveNotes}>
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setNotesValue(leadNotes || ''); setEditing(false); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : cleanNotes ? (
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{cleanNotes}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem anotações</p>
            )}
          </div>

          {!info?.cidade && !info?.mensagem && !info?.source && !leadSource && !cleanNotes && !editing && (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              Nenhuma informação adicional disponível.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* =========================================================================
 * TASKS CARD
 *   crm_activities com activity_type=task, abas Pendentes/Concluídas.
 * ========================================================================= */
interface Task {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

const TasksCard: React.FC<{ leadId: string }> = ({ leadId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [tab, setTab] = useState<'pending' | 'done'>('pending');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_activities')
      .select('id, description, metadata, created_at')
      .eq('lead_id', leadId)
      .eq('activity_type', 'task')
      .order('created_at', { ascending: false });
    if (data) {
      setTasks(
        data.map((d: any) => ({
          id: d.id,
          title: d.description,
          completed: d.metadata?.completed === true,
          created_at: d.created_at || '',
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [leadId]);

  const add = async () => {
    if (!newTask.trim()) return;
    const { error } = await supabase.from('crm_activities').insert({
      lead_id: leadId,
      activity_type: 'task',
      description: newTask.trim(),
      metadata: { completed: false },
    });
    if (!error) {
      setNewTask('');
      setAdding(false);
      load();
      toast.success('Tarefa adicionada');
    }
  };

  const toggle = async (t: Task) => {
    await supabase
      .from('crm_activities')
      .update({ metadata: { completed: !t.completed } })
      .eq('id', t.id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('crm_activities').delete().eq('id', id);
    load();
  };

  const pending = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);
  const list = tab === 'pending' ? pending : done;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">Tarefas</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
          onClick={() => setAdding(v => !v)}
        >
          <Plus className="w-3 h-3" /> Nova
        </Button>
      </div>

      {adding && (
        <div className="flex gap-1.5 mb-3">
          <Input
            placeholder="O que precisa ser feito?"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setNewTask(''); } }}
            className="h-7 text-xs flex-1"
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={add}>OK</Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="w-full">
        <TabsList className="bg-transparent p-0 h-auto gap-1 mb-2">
          <TabsTrigger
            value="pending"
            className="h-7 px-2.5 text-[11px] rounded-md data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
          >
            Pendentes ({pending.length})
          </TabsTrigger>
          <TabsTrigger
            value="done"
            className="h-7 px-2.5 text-[11px] rounded-md data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
          >
            Concluídas ({done.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-0 space-y-1.5">
          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">
              {tab === 'pending' ? 'Nenhuma tarefa pendente.' : 'Nenhuma tarefa concluída.'}
            </p>
          ) : (
            list.slice(0, 5).map(t => (
              <div
                key={t.id}
                className="flex items-start gap-2 p-2 rounded-lg border border-border bg-background/50 hover:bg-accent/40 transition-colors group"
              >
                <button
                  onClick={() => toggle(t)}
                  className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    t.completed
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'border-muted-foreground/30 hover:border-primary'
                  }`}
                >
                  {t.completed && <Check className="w-2.5 h-2.5 text-green-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${t.completed ? 'line-through opacity-60' : ''}`}>
                    {t.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t.completed ? 'Concluída' : 'Não iniciada'} ·{' '}
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Excluir"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* =========================================================================
 * OPPORTUNITIES CARD
 *   Lista todos os crm_leads com o MESMO whatsapp (cross-board),
 *   cada um vira uma oportunidade (board + stage + value + status).
 * ========================================================================= */
type Opportunity = {
  id: string;
  board_id: string | null;
  board_name: string;
  column_name: string;
  potential_value: number | null;
  closed_at: string | null;
  lost_reason: string | null;
  is_current: boolean;
};

const OpportunitiesCard: React.FC<{
  leadId: string;
  leadWhatsapp: string;
  onOpenOpportunity?: (id: string) => void;
}> = ({ leadId, leadWhatsapp, onOpenOpportunity }) => {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('crm_leads')
        .select(`
          id, board_id, potential_value, closed_at, lost_reason, created_at,
          crm_boards:board_id ( name ),
          crm_columns:column_id ( name )
        `)
        .eq('whatsapp', leadWhatsapp)
        .order('created_at', { ascending: false });

      if (!mounted) return;
      if (data) {
        setOpps(
          data.map((r: any) => ({
            id: r.id,
            board_id: r.board_id,
            board_name: r.crm_boards?.name || 'Sem board',
            column_name: r.crm_columns?.name || 'sem etapa',
            potential_value: r.potential_value,
            closed_at: r.closed_at,
            lost_reason: r.lost_reason,
            is_current: r.id === leadId,
          }))
        );
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [leadId, leadWhatsapp]);

  const fmtMoney = (v: number | null) => {
    if (!v) return null;
    if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
    return `R$ ${v.toLocaleString('pt-BR')}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">
            Oportunidades {opps.length > 0 && `(${opps.length})`}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : opps.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-3">
          Nenhuma oportunidade.
        </p>
      ) : (
        <div className="space-y-2">
          {opps.map(o => {
            const won = !!o.closed_at && !o.lost_reason;
            const lost = !!o.lost_reason;
            const money = fmtMoney(o.potential_value);

            return (
              <button
                key={o.id}
                onClick={() => onOpenOpportunity?.(o.id)}
                disabled={o.is_current}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  o.is_current
                    ? 'border-primary/40 bg-primary/5 cursor-default'
                    : 'border-border bg-background/50 hover:border-primary/40 hover:bg-accent/40 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                    <Briefcase className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate font-medium text-foreground">{o.board_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span
                      className={`flex-shrink-0 ${
                        won ? 'text-green-500' : lost ? 'text-destructive' : 'text-amber-500'
                      }`}
                    >
                      ● {o.column_name}
                    </span>
                  </div>
                  {o.is_current && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 flex-shrink-0">
                      atual
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    {money ? (
                      <>
                        <span className="text-sm font-bold">{money}</span>
                        <span className="text-[10px] text-muted-foreground">valor</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">sem valor</span>
                    )}
                  </div>
                  {won && (
                    <Badge className="text-[10px] h-5 px-1.5 bg-green-500/15 text-green-500 border-green-500/30 gap-1">
                      <Trophy className="w-2.5 h-2.5" /> GANHO
                    </Badge>
                  )}
                  {lost && (
                    <Badge className="text-[10px] h-5 px-1.5 bg-destructive/15 text-destructive border-destructive/30 gap-1">
                      <Ban className="w-2.5 h-2.5" /> PERDA
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
