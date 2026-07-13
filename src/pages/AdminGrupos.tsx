import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Users, MessageCircle, HelpCircle, Send, Crown, RefreshCw, Eye,
  Megaphone, TrendingUp, Loader2, Settings, Link2, Search, Check, X,
  CheckCircle2, AlertTriangle, Clock, Trophy, Zap, Plus, Info,
} from 'lucide-react';

const db = supabase as any;

export default function AdminGrupos() {
  const [groups, setGroups] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'participants' | 'messages' | 'questions' | 'broadcast'>('participants');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ group_jid: '', name: '', instance_id: '' });
  const [instances, setInstances] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [groupsRes, modulesRes, instRes] = await Promise.all([
      db.from('whatsapp_groups').select('*').order('last_message_at', { ascending: false, nullsFirst: false }),
      db.from('member_modules').select('id, title, category').eq('is_published', true),
      // Grupos sao via UAZAPI (Cloud API nao gerencia grupos do mesmo jeito).
      db.from('whatsapp_instances').select('id, instance_name, status').eq('status', 'connected').eq('provider', 'uazapi'),
    ]);
    setGroups(groupsRes.data || []);
    setModules(modulesRes.data || []);
    setInstances(instRes.data || []);
    setLoading(false);
  };

  const addGroupManual = async () => {
    const jid = addForm.group_jid.replace(/@g\.us$/, '').replace(/\D/g, '');
    if (!jid || jid.length < 10) { toast.error('JID invalido (so digitos, min 10 chars)'); return; }
    if (!addForm.instance_id) { toast.error('Selecione uma instancia WhatsApp'); return; }
    try {
      const { error } = await db.from('whatsapp_groups').insert({
        group_jid: jid,
        name: addForm.name.trim() || `Grupo ${jid}`,
        instance_id: addForm.instance_id,
        is_spy_active: true,
        auto_send_meeting_links: true,
        auto_detect_questions: true,
      });
      if (error) throw error;
      toast.success('Grupo cadastrado — espiao ativado');
      setShowAdd(false);
      setAddForm({ group_jid: '', name: '', instance_id: '' });
      load();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    }
  };

  const removeGroup = async (g: any) => {
    if (!confirm(`Remover o grupo "${g.name}"? Isso apaga historico de participantes e duvidas, e para o espiao.`)) return;
    await db.from('whatsapp_groups').delete().eq('id', g.id);
    toast.success('Grupo removido');
    if (selected?.id === g.id) setSelected(null);
    load();
  };

  const loadDetail = async (group: any) => {
    setSelected(group);
    setLoadingDetail(true);
    const [pRes, mRes, qRes] = await Promise.all([
      db.from('whatsapp_group_participants').select('*').eq('group_id', group.id).order('message_count', { ascending: false }).limit(100),
      db.from('whatsapp_messages').select('id, content, message_type, created_at, remote_phone, sender_name:contact_name, metadata').eq('instance_id', group.instance_id).ilike('metadata->>groupName', `%${group.name || ''}%`).order('created_at', { ascending: false }).limit(60),
      db.from('whatsapp_group_questions').select('*').eq('group_id', group.id).order('created_at', { ascending: false }).limit(40),
    ]);
    setParticipants(pRes.data || []);
    setMessages(mRes.data || []);
    setQuestions(qRes.data || []);
    setLoadingDetail(false);
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    if (!settingsForm?.id) return;
    try {
      await db.from('whatsapp_groups').update({
        name: settingsForm.name,
        linked_module_id: settingsForm.linked_module_id || null,
        linked_program: settingsForm.linked_program || null,
        is_spy_active: settingsForm.is_spy_active,
        is_broadcast_enabled: settingsForm.is_broadcast_enabled,
        auto_send_meeting_links: settingsForm.auto_send_meeting_links,
        auto_detect_questions: settingsForm.auto_detect_questions,
        welcome_message: settingsForm.welcome_message,
        updated_at: new Date().toISOString(),
      }).eq('id', settingsForm.id);
      toast.success('Configuracoes salvas');
      setShowSettings(false);
      load();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const sendBroadcast = async () => {
    if (!selected || broadcastMsg.length < 2) return;
    if (!selected.is_broadcast_enabled) {
      toast.error('Ative o broadcast nas configuracoes primeiro');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-group-message', {
        body: { group_id: selected.id, message: broadcastMsg },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      toast.success('Mensagem enviada no grupo');
      setBroadcastMsg('');
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally {
      setSending(false);
    }
  };

  const markQuestionAnswered = async (q: any) => {
    await db.from('whatsapp_group_questions').update({
      answered: true,
      answered_at: new Date().toISOString(),
      answered_by: 'admin',
    }).eq('id', q.id);
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, answered: true } : x));
  };

  const totals = useMemo(() => ({
    groups: groups.length,
    active: groups.filter(g => g.is_spy_active).length,
    messages: groups.reduce((s, g) => s + (g.total_messages || 0), 0),
    questions: groups.reduce((s, g) => s + (g.total_questions || 0), 0),
  }), [groups]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Grupos WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Espião monitora mensagens, detecta duvidas e envia avisos automaticos de aulas ao vivo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Atualizar</Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground">
            <Users className="w-4 h-4 mr-1" /> Adicionar grupo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Grupos</p></div>
          <p className="text-2xl font-bold mt-1">{totals.groups}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Espionados</p></div>
          <p className="text-2xl font-bold mt-1">{totals.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-500" /><p className="text-xs text-muted-foreground">Mensagens</p></div>
          <p className="text-2xl font-bold mt-1">{totals.messages}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-yellow-500" /><p className="text-xs text-muted-foreground">Duvidas</p></div>
          <p className="text-2xl font-bold mt-1">{totals.questions}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Groups list */}
        <div className="space-y-2">
          <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider px-2">Grupos detectados</p>
          {loading ? (
            <Card><CardContent className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></CardContent></Card>
          ) : groups.length === 0 ? (
            <Card><CardContent className="p-4 text-xs text-center text-muted-foreground">
              Nenhum grupo detectado ainda. Quando uma mensagem de grupo chegar no webhook, ele aparece aqui.
            </CardContent></Card>
          ) : groups.map(g => {
            const isSel = selected?.id === g.id;
            return (
              <div key={g.id} className={`relative group rounded-xl border transition-colors ${isSel ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:bg-muted/30'}`}>
                <button onClick={() => loadDetail(g)} className="w-full text-left p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate pr-6">{g.name || '(sem nome)'}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {g.is_spy_active && <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-500">Espião</Badge>}
                        {g.is_broadcast_enabled && <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-500">Broadcast</Badge>}
                        {g.auto_send_meeting_links && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Auto-meet</Badge>}
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                        <span>{g.total_messages || 0} msgs</span>
                        <span>{g.total_questions || 0} duvidas</span>
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeGroup(g); }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1"
                  title="Remover grupo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              Selecione um grupo pra ver detalhes.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {/* Header */}
              <Card>
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{selected.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{selected.group_jid}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setSettingsForm({ ...selected }); setShowSettings(true); }}>
                    <Settings className="w-3.5 h-3.5 mr-1.5" /> Configurar
                  </Button>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                {[
                  { key: 'participants', icon: Users, label: `Participantes (${participants.length})` },
                  { key: 'messages', icon: MessageCircle, label: `Mensagens (${messages.length})` },
                  { key: 'questions', icon: HelpCircle, label: `Duvidas (${questions.filter(q => !q.answered).length})` },
                  { key: 'broadcast', icon: Megaphone, label: 'Enviar' },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-md flex items-center justify-center gap-1.5 ${activeTab === t.key ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'}`}>
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {loadingDetail ? (
                <Card><CardContent className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></CardContent></Card>
              ) : (
                <>
                  {/* Participants */}
                  {activeTab === 'participants' && (
                    <Card><CardContent className="p-4">
                      {participants.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Nenhum participante registrado ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {participants.map((p, i) => (
                            <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px]" style={{
                                backgroundColor: i === 0 ? '#3B82F6' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#404040',
                                color: i < 3 ? '#000' : '#fff',
                              }}>
                                {i === 0 ? <Crown className="w-3 h-3" /> : `#${i + 1}`}
                              </div>
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs">{(p.name || p.phone || '?').charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{p.name || p.phone}</p>
                                  {p.matched_member_id && <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-500">Aluno</Badge>}
                                  {p.is_admin && <Badge variant="outline" className="text-[9px]">Admin</Badge>}
                                </div>
                                <p className="text-[11px] text-muted-foreground">{p.phone} · ultima vez {new Date(p.last_seen_at).toLocaleDateString('pt-BR')}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold">{p.message_count}</p>
                                <p className="text-[10px] text-muted-foreground">msgs</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent></Card>
                  )}

                  {/* Messages */}
                  {activeTab === 'messages' && (
                    <Card><CardContent className="p-4">
                      {messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Sem mensagens recentes.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                          {messages.map((m) => (
                            <div key={m.id} className="p-2 rounded-lg bg-muted/20 text-xs">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="font-semibold text-primary">{m.sender_name || m.remote_phone}</p>
                                <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                {m.message_type !== 'text' && <Badge variant="outline" className="text-[9px]">{m.message_type}</Badge>}
                              </div>
                              <p className="whitespace-pre-wrap">{m.content || <em className="text-muted-foreground">(midia)</em>}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent></Card>
                  )}

                  {/* Questions */}
                  {activeTab === 'questions' && (
                    <Card><CardContent className="p-4">
                      {questions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma duvida detectada ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {questions.map(q => (
                            <div key={q.id} className={`p-3 rounded-lg border ${q.answered ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <HelpCircle className={`w-3.5 h-3.5 ${q.answered ? 'text-green-500' : 'text-yellow-500'}`} />
                                  <p className="text-xs font-semibold">{q.participant_name || q.participant_phone || '(anonimo)'}</p>
                                  <span className="text-[10px] text-muted-foreground">{new Date(q.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {!q.answered && (
                                  <Button size="sm" variant="ghost" onClick={() => markQuestionAnswered(q)} className="h-6 text-[10px]">
                                    <Check className="w-3 h-3 mr-1" /> Marcar respondida
                                  </Button>
                                )}
                                {q.answered && <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-500">Respondida</Badge>}
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{q.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent></Card>
                  )}

                  {/* Broadcast */}
                  {activeTab === 'broadcast' && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        {!selected.is_broadcast_enabled && (
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold">Broadcast desabilitado</p>
                              <p className="text-xs text-muted-foreground">Ative em "Configurar" antes de enviar mensagens.</p>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5 text-primary" /> Mensagem pro grupo</Label>
                          <Textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)}
                            className="min-h-[120px]"
                            placeholder="Ex: Pessoal, amanha as 14h teremos a live de qualificacao. Quem tiver duvida, me chama aqui!" />
                          <p className="text-[10px] text-muted-foreground">{broadcastMsg.length} chars</p>
                        </div>
                        <Button onClick={sendBroadcast} disabled={sending || broadcastMsg.length < 2 || !selected.is_broadcast_enabled}
                          className="w-full bg-primary text-primary-foreground">
                          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                          Enviar mensagem no grupo
                        </Button>
                        <p className="text-[11px] text-muted-foreground">
                          Dica: Se o grupo tiver um modulo vinculado e "auto-meet" ativado, toda reuniao ao vivo marcada pra esse modulo e anunciada automaticamente.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add group dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar grupo WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-2 text-xs">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p>Só os grupos cadastrados aqui são espionados. Demais conversas de grupos são ignoradas.</p>
                <p className="mt-1 text-muted-foreground">
                  Pra pegar o JID: abre o grupo no WhatsApp → menu → Info do grupo → compartilhar link → o número antes do "-" é o JID (ex: <code>120363407700316960</code>).
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>JID do grupo (só números)</Label>
              <Input value={addForm.group_jid} onChange={(e) => setAddForm({ ...addForm, group_jid: e.target.value })}
                placeholder="120363407700316960" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome (como aparece no + que Vencedores)</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="MentorIA - + que Vencedores" />
            </div>
            <div className="space-y-1.5">
              <Label>Instância WhatsApp</Label>
              <Select value={addForm.instance_id} onValueChange={(v) => setAddForm({ ...addForm, instance_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {instances.map(i => <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={addGroupManual}><Plus className="w-4 h-4 mr-1" /> Cadastrar e ativar espião</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Configurar grupo</DialogTitle></DialogHeader>
          {settingsForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome do grupo</Label>
                <Input value={settingsForm.name || ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Modulo vinculado (pra receber avisos de aulas automaticamente)</Label>
                <Select value={settingsForm.linked_module_id || 'none'} onValueChange={(v) => setSettingsForm({ ...settingsForm, linked_module_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum modulo</SelectItem>
                    {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title} ({m.category})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Espião ativo</p>
                      <p className="text-[10px] text-muted-foreground">Registra mensagens, contagem de interacao, duvidas</p>
                    </div>
                  </div>
                  <Switch checked={!!settingsForm.is_spy_active} onCheckedChange={(v) => setSettingsForm({ ...settingsForm, is_spy_active: v })} />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Broadcast habilitado</p>
                      <p className="text-[10px] text-muted-foreground">Permite enviar mensagens do + que Vencedores pro grupo</p>
                    </div>
                  </div>
                  <Switch checked={!!settingsForm.is_broadcast_enabled} onCheckedChange={(v) => setSettingsForm({ ...settingsForm, is_broadcast_enabled: v })} />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Auto-avisar aulas ao vivo</p>
                      <p className="text-[10px] text-muted-foreground">Envia link quando uma live e agendada pro modulo</p>
                    </div>
                  </div>
                  <Switch checked={!!settingsForm.auto_send_meeting_links} onCheckedChange={(v) => setSettingsForm({ ...settingsForm, auto_send_meeting_links: v })} />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">Detectar duvidas automaticamente</p>
                      <p className="text-[10px] text-muted-foreground">Identifica perguntas e guarda na aba Duvidas</p>
                    </div>
                  </div>
                  <Switch checked={!!settingsForm.auto_detect_questions} onCheckedChange={(v) => setSettingsForm({ ...settingsForm, auto_detect_questions: v })} />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label>Mensagem de boas-vindas (manda quando novo membro entra)</Label>
                <Textarea value={settingsForm.welcome_message || ''} onChange={(e) => setSettingsForm({ ...settingsForm, welcome_message: e.target.value })}
                  className="min-h-[80px]"
                  placeholder="Bem-vindo ao grupo + que Vencedores! Aqui voce encontra..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveSettings}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
