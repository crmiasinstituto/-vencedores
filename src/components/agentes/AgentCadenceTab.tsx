import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Save, RefreshCcw, Clock, Calendar, Info, MessageSquare, Plus, Trash2,
  ChevronUp, ChevronDown, Play, Pause, Users, GripVertical, ListOrdered,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ===================== Types =====================

interface CadenceStep {
  step: number;
  delay_hours: number;
  message_template: string;
  channel: string;
}

interface CadenceSequence {
  id: string;
  name: string;
  description: string;
  steps: CadenceStep[];
  is_active: boolean;
  created_at: string;
}

interface CadenceEnrollment {
  id: string;
  cadence_id: string;
  lead_id: string;
  current_step: number;
  status: string;
  next_send_at: string | null;
  created_at: string;
  lead_name?: string;
}

// Legacy config for backward compatibility
interface CadenceConfig {
  maxAttempts: number;
  intervalHours: number;
  messages: string[];
  followUpEnabled: boolean;
  confirmImmediate: string;
  confirm3Days: string;
  confirm1Day: string;
  confirm30Min: string;
}

interface Props {
  config: CadenceConfig;
  onChange: (config: CadenceConfig) => void;
  onSave: () => void;
  saving: boolean;
}

// ===================== Helpers =====================

function TipLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm">{label}</Label>
      <Tooltip>
        <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
        <TooltipContent className="max-w-[250px] text-xs">{tip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function formatDelay(hours: number): string {
  if (hours === 0) return 'Imediato';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

// ===================== Main Component =====================

export function AgentCadenceTab({ config, onChange, onSave, saving }: Props) {
  const { toast } = useToast();
  const [sequences, setSequences] = useState<CadenceSequence[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [editSequence, setEditSequence] = useState<Partial<CadenceSequence> | null>(null);
  const [enrollments, setEnrollments] = useState<CadenceEnrollment[]>([]);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [savingSequence, setSavingSequence] = useState(false);
  const [activeTab, setActiveTab] = useState<'sequences' | 'legacy'>('sequences');

  // Legacy handlers (preserved)
  const update = (patch: Partial<CadenceConfig>) => onChange({ ...config, ...patch });
  const updateMsg = (idx: number, value: string) => {
    const msgs = [...config.messages];
    msgs[idx] = value;
    onChange({ ...config, messages: msgs });
  };
  const addMessage = () => onChange({ ...config, messages: [...config.messages, ''] });
  const removeMessage = (idx: number) => {
    const msgs = [...config.messages];
    msgs.splice(idx, 1);
    onChange({ ...config, messages: msgs });
  };

  // ===================== Load Sequences =====================

  const loadSequences = async () => {
    setLoadingSequences(true);
    try {
      const { data, error } = await (supabase as any)
        .from('cadence_sequences')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSequences(data || []);
    } catch (e: any) {
      console.error('Error loading sequences:', e);
    } finally {
      setLoadingSequences(false);
    }
  };

  const loadEnrollments = async (cadenceId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('cadence_enrollments')
        .select('*')
        .eq('cadence_id', cadenceId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch lead names
      const leadIds = (data || []).map((e: any) => e.lead_id);
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from('crm_leads')
          .select('id, name')
          .in('id', leadIds);
        const leadMap = new Map((leads || []).map((l: any) => [l.id, l.name]));
        const enriched = (data || []).map((e: any) => ({
          ...e,
          lead_name: leadMap.get(e.lead_id) || 'Lead sem nome',
        }));
        setEnrollments(enriched);
      } else {
        setEnrollments(data || []);
      }
    } catch (e: any) {
      console.error('Error loading enrollments:', e);
    }
  };

  useEffect(() => {
    loadSequences();
  }, []);

  useEffect(() => {
    if (selectedSequenceId) {
      const found = sequences.find(s => s.id === selectedSequenceId);
      if (found) {
        setEditSequence({ ...found });
        loadEnrollments(found.id);
      }
    }
  }, [selectedSequenceId, sequences]);

  // ===================== Save Sequence =====================

  const handleSaveSequence = async () => {
    if (!editSequence?.name) {
      toast({ title: 'Erro', description: 'Nome da sequencia e obrigatorio', variant: 'destructive' });
      return;
    }

    setSavingSequence(true);
    try {
      const payload = {
        name: editSequence.name,
        description: editSequence.description || '',
        steps: editSequence.steps || [],
        is_active: editSequence.is_active !== false,
      };

      if (editSequence.id) {
        // Update
        const { error } = await (supabase as any)
          .from('cadence_sequences')
          .update(payload)
          .eq('id', editSequence.id);
        if (error) throw error;
        toast({ title: 'Salvo!', description: 'Sequencia atualizada.' });
      } else {
        // Insert
        const { data, error } = await (supabase as any)
          .from('cadence_sequences')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setSelectedSequenceId(data.id);
        toast({ title: 'Criada!', description: 'Nova sequencia criada.' });
      }
      loadSequences();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingSequence(false);
    }
  };

  const handleDeleteSequence = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sequencia?')) return;
    try {
      const { error } = await (supabase as any)
        .from('cadence_sequences')
        .delete()
        .eq('id', id);
      if (error) throw error;
      if (selectedSequenceId === id) {
        setSelectedSequenceId(null);
        setEditSequence(null);
      }
      toast({ title: 'Excluida', description: 'Sequencia removida.' });
      loadSequences();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  // ===================== Step Management =====================

  const addStep = () => {
    if (!editSequence) return;
    const steps = [...(editSequence.steps || [])];
    steps.push({
      step: steps.length + 1,
      delay_hours: steps.length === 0 ? 0 : 24,
      message_template: '',
      channel: 'whatsapp',
    });
    setEditSequence({ ...editSequence, steps });
  };

  const updateStep = (idx: number, patch: Partial<CadenceStep>) => {
    if (!editSequence) return;
    const steps = [...(editSequence.steps || [])];
    steps[idx] = { ...steps[idx], ...patch };
    setEditSequence({ ...editSequence, steps });
  };

  const removeStep = (idx: number) => {
    if (!editSequence) return;
    const steps = [...(editSequence.steps || [])];
    steps.splice(idx, 1);
    // Renumber
    steps.forEach((s, i) => { s.step = i + 1; });
    setEditSequence({ ...editSequence, steps });
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    if (!editSequence) return;
    const steps = [...(editSequence.steps || [])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    steps.forEach((s, i) => { s.step = i + 1; });
    setEditSequence({ ...editSequence, steps });
  };

  // ===================== Enrollment Management =====================

  const handleCancelEnrollment = async (enrollmentId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('cadence_enrollments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (error) throw error;
      toast({ title: 'Cancelado', description: 'Inscricao cancelada.' });
      if (selectedSequenceId) loadEnrollments(selectedSequenceId);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handlePauseEnrollment = async (enrollmentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paused' ? 'active' : 'paused';
    try {
      const { error } = await (supabase as any)
        .from('cadence_enrollments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (error) throw error;
      toast({ title: newStatus === 'paused' ? 'Pausado' : 'Retomado' });
      if (selectedSequenceId) loadEnrollments(selectedSequenceId);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  // ===================== Render =====================

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'sequences' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('sequences')}
        >
          <ListOrdered className="w-3.5 h-3.5 mr-1.5" /> Sequencias Outbound
        </Button>
        <Button
          variant={activeTab === 'legacy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('legacy')}
        >
          <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Reengajamento
        </Button>
      </div>

      {/* ===================== SEQUENCES TAB ===================== */}
      {activeTab === 'sequences' && (
        <>
          {/* Sequence list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListOrdered className="w-4 h-4" /> Sequencias de Cadencia
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={loadSequences} disabled={loadingSequences}>
                    <RefreshCcw className={`w-3 h-3 mr-1 ${loadingSequences ? 'animate-spin' : ''}`} /> Atualizar
                  </Button>
                  <Button size="sm" onClick={() => {
                    setSelectedSequenceId(null);
                    setEditSequence({ name: '', description: '', steps: [], is_active: true });
                    setEnrollments([]);
                  }}>
                    <Plus className="w-3 h-3 mr-1" /> Nova Sequencia
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sequences.length === 0 && !loadingSequences && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma sequencia criada. Crie sua primeira sequencia de cadencia outbound.
                </p>
              )}
              <div className="space-y-2">
                {sequences.map(seq => (
                  <div
                    key={seq.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedSequenceId === seq.id ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                    onClick={() => setSelectedSequenceId(seq.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${seq.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium">{seq.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(seq.steps as any[])?.length || 0} etapas
                          {seq.description && ` - ${seq.description.substring(0, 40)}...`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={seq.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {seq.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDeleteSequence(seq.id); }}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sequence editor */}
          {editSequence && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {editSequence.id ? 'Editar Sequencia' : 'Nova Sequencia'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <TipLabel label="Nome" tip="Nome identificador da sequencia." />
                      <Input
                        className="mt-1"
                        value={editSequence.name || ''}
                        onChange={e => setEditSequence({ ...editSequence, name: e.target.value })}
                        placeholder="Ex: Outbound Frio - SaaS"
                      />
                    </div>
                    <div>
                      <TipLabel label="Descricao" tip="Descricao breve da finalidade." />
                      <Input
                        className="mt-1"
                        value={editSequence.description || ''}
                        onChange={e => setEditSequence({ ...editSequence, description: e.target.value })}
                        placeholder="Ex: Cadencia para leads frios do Instagram"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <TipLabel label="Sequencia Ativa" tip="Quando desativada, nenhuma mensagem sera enviada." />
                    <Switch
                      checked={editSequence.is_active !== false}
                      onCheckedChange={v => setEditSequence({ ...editSequence, is_active: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Steps editor */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GripVertical className="w-4 h-4" /> Etapas da Sequencia
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={addStep}>
                      <Plus className="w-3 h-3 mr-1" /> Etapa
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(editSequence.steps || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma etapa. Adicione etapas para definir o fluxo de mensagens.
                    </p>
                  )}
                  {(editSequence.steps || []).map((step, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">Etapa {step.step}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDelay(step.delay_hours)} {idx > 0 ? 'apos etapa anterior' : ''}
                          </span>
                        </div>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(idx, 1)} disabled={idx === (editSequence.steps || []).length - 1}>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(idx)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Atraso (horas)</Label>
                          <Input
                            type="number"
                            min={0}
                            className="mt-1 h-8 text-sm"
                            value={step.delay_hours}
                            onChange={e => updateStep(idx, { delay_hours: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Canal</Label>
                          <Select
                            value={step.channel || 'whatsapp'}
                            onValueChange={v => updateStep(idx, { channel: v })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Template da mensagem</Label>
                        <Textarea
                          className="mt-1 text-xs"
                          rows={3}
                          value={step.message_template}
                          onChange={e => updateStep(idx, { message_template: e.target.value })}
                          placeholder="Oi {nome}! Sou da + que Vencedores e vi que voce tem interesse em... Use {nome}, {empresa} para personalizar."
                        />
                      </div>
                    </div>
                  ))}

                  {/* Visual timeline */}
                  {(editSequence.steps || []).length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                      <Label className="text-xs font-medium mb-2 block">Timeline visual</Label>
                      <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {(editSequence.steps || []).map((step, idx) => (
                          <div key={idx} className="flex items-center">
                            <div className="flex flex-col items-center min-w-[60px]">
                              <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-xs font-bold text-primary">
                                {step.step}
                              </div>
                              <span className="text-[9px] text-muted-foreground mt-1">{formatDelay(step.delay_hours)}</span>
                              <span className="text-[9px] text-muted-foreground">{step.channel}</span>
                            </div>
                            {idx < (editSequence.steps || []).length - 1 && (
                              <div className="w-8 h-0.5 bg-primary/30 mx-1" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button onClick={handleSaveSequence} disabled={savingSequence} className="w-full gap-2">
                <Save className="w-4 h-4" /> {savingSequence ? 'Salvando...' : (editSequence.id ? 'Salvar Sequencia' : 'Criar Sequencia')}
              </Button>

              {/* Enrollments section - only for saved sequences */}
              {editSequence.id && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4" /> Leads Inscritos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {enrollments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhum lead inscrito nesta sequencia. Inscreva leads pelo painel do lead.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {enrollments.map(enr => (
                          <div key={enr.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                enr.status === 'active' ? 'bg-green-500' :
                                enr.status === 'paused' ? 'bg-yellow-500' :
                                enr.status === 'completed' ? 'bg-blue-500' :
                                'bg-gray-400'
                              }`} />
                              <div>
                                <p className="text-sm">{enr.lead_name || 'Lead'}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Etapa {enr.current_step}/{(editSequence.steps || []).length}
                                  {enr.next_send_at && ` - Proximo envio: ${new Date(enr.next_send_at).toLocaleString('pt-BR')}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px]">{enr.status}</Badge>
                              {(enr.status === 'active' || enr.status === 'paused') && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handlePauseEnrollment(enr.id, enr.status)}
                                    title={enr.status === 'paused' ? 'Retomar' : 'Pausar'}
                                  >
                                    {enr.status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleCancelEnrollment(enr.id)}
                                    title="Cancelar"
                                  >
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ===================== LEGACY TAB (re-engagement + follow-ups) ===================== */}
      {activeTab === 'legacy' && (
        <>
          {/* Re-engagement cadence */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><RefreshCcw className="w-4 h-4" /> Cadencia de Reengajamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Quando o lead parar de responder sem concluir a conversa, o agente reenvia mensagens automaticamente.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TipLabel label="Maximo de Tentativas" tip="Quantas vezes o agente tentara reengajar antes de desistir." />
                  <Input type="number" className="mt-1" value={config.maxAttempts} onChange={e => update({ maxAttempts: Number(e.target.value) })} />
                </div>
                <div>
                  <TipLabel label="Intervalo (horas)" tip="Tempo entre cada tentativa de reengajamento." />
                  <Input type="number" className="mt-1" value={config.intervalHours} onChange={e => update({ intervalHours: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-3">
                <TipLabel label="Mensagens por Tentativa" tip="Customize a mensagem de cada tentativa. Use {nome} para personalizar." />
                {config.messages.map((msg, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-xs text-muted-foreground pt-2 w-6 shrink-0">#{i + 1}</span>
                    <Textarea className="text-xs" rows={2} value={msg} onChange={e => updateMsg(i, e.target.value)} placeholder={`Mensagem da tentativa ${i + 1}...`} />
                    {config.messages.length > 1 && (
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => removeMessage(i)}>x</Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addMessage}><MessageSquare className="w-3 h-3 mr-1" /> + Tentativa</Button>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up inteligente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Follow-up Inteligente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <TipLabel label="Follow-up por Contexto" tip='O agente detecta frases como "retorno dia 6 de marco" e agenda retomada automatica na data.' />
                <Switch checked={config.followUpEnabled} onCheckedChange={v => update({ followUpEnabled: v })} />
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                <p className="font-medium mb-1">Como funciona:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Lead diz: "Estou viajando, retorno dia 6 de marco"</li>
                  <li>O agente entende o contexto e agenda retomada para 06/03</li>
                  <li>Na data, retoma a conversa naturalmente de onde parou</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Meeting confirmations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Confirmacoes de Reuniao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Templates enviados automaticamente para confirmar reunioes agendadas.</p>
              <div>
                <TipLabel label="Confirmacao Imediata" tip="Enviada logo apos agendar a reuniao." />
                <Textarea className="mt-1 text-xs" rows={2} value={config.confirmImmediate} onChange={e => update({ confirmImmediate: e.target.value })} placeholder="Reuniao agendada para {data} as {hora}. Te espero la!" />
              </div>
              <div>
                <TipLabel label="3 Dias Antes" tip="Lembrete enviado 3 dias antes da reuniao." />
                <Textarea className="mt-1 text-xs" rows={2} value={config.confirm3Days} onChange={e => update({ confirm3Days: e.target.value })} placeholder="Oi {nome}! So passando pra lembrar da nossa reuniao em 3 dias..." />
              </div>
              <div>
                <TipLabel label="1 Dia Antes" tip="Lembrete enviado 1 dia antes." />
                <Textarea className="mt-1 text-xs" rows={2} value={config.confirm1Day} onChange={e => update({ confirm1Day: e.target.value })} placeholder="Amanha temos nossa reuniao as {hora}. Tudo certo?" />
              </div>
              <div>
                <TipLabel label="30 Minutos Antes" tip="Ultimo lembrete antes da reuniao." />
                <Textarea className="mt-1 text-xs" rows={2} value={config.confirm30Min} onChange={e => update({ confirm30Min: e.target.value })} placeholder="Comecamos em 30 min! O link e: {link}" />
              </div>
            </CardContent>
          </Card>

          <Button onClick={onSave} disabled={saving} className="w-full gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Cadencia'}
          </Button>
        </>
      )}
    </div>
  );
}
