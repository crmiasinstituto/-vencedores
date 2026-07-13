import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar, Radio, Users, Clock, Link as LinkIcon, Trash2, Plus, Loader2 } from 'lucide-react';

interface Module {
  id: string;
  title: string;
  category: string;
}

interface LiveMeeting {
  id: string;
  title: string;
  livekit_room_name: string;
  target_module_id: string | null;
  target_lesson_title: string | null;
  target_lesson_id: string | null;
  members_scheduled_at: string;
  members_duration_minutes: number;
  host_name: string | null;
  status: string;
  recording_status: string | null;
  recording_url: string | null;
  processing_step: string | null;
}

interface Props {
  modules: Module[];
  onChanged: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function liveStatus(m: LiveMeeting): { label: string; color: string; live: boolean } {
  if (m.status === 'completed') {
    if (m.processing_step === 'ready') return { label: 'Publicada', color: 'bg-green-500/20 text-green-400 border-green-500/30', live: false };
    if (m.processing_step === 'failed') return { label: 'Falhou', color: 'bg-red-500/20 text-red-400 border-red-500/30', live: false };
    return { label: 'Processando', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', live: false };
  }
  const now = Date.now();
  const start = new Date(m.members_scheduled_at).getTime();
  const end = start + (m.members_duration_minutes || 60) * 60_000;
  if (now < start - 15 * 60_000) return { label: 'Agendada', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', live: false };
  if (now < end) return { label: 'AO VIVO', color: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse', live: true };
  return { label: 'Encerrada', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', live: false };
}

export default function LiveSessionsSection({ modules, onChanged }: Props) {
  const [meetings, setMeetings] = useState<LiveMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    module_id: '',
    scheduled_date: '',
    scheduled_time: '',
    duration_minutes: 60,
    host_name: '+ que Vencedores',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('meetings')
      .select('id, title, livekit_room_name, target_module_id, target_lesson_title, target_lesson_id, members_scheduled_at, members_duration_minutes, host_name, status, recording_status, recording_url, processing_step')
      .eq('members_visible', true)
      .order('members_scheduled_at', { ascending: false })
      .limit(50);
    setMeetings((data as LiveMeeting[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setSeconds(0, 0);
    const d = now.toISOString().slice(0, 10);
    const t = now.toTimeString().slice(0, 5);
    setForm({
      title: '',
      description: '',
      module_id: modules[0]?.id || '',
      scheduled_date: d,
      scheduled_time: t,
      duration_minutes: 60,
      host_name: '+ que Vencedores',
    });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.module_id || !form.scheduled_date || !form.scheduled_time) {
      toast.error('Preencha titulo, modulo, data e hora');
      return;
    }
    setSaving(true);
    try {
      const scheduled = new Date(`${form.scheduled_date}T${form.scheduled_time}:00`);
      const roomName = `aovivo-${form.module_id.slice(0, 8)}-${Date.now()}`;
      await (supabase as any).from('meetings').insert({
        title: form.title.trim(),
        livekit_room_name: roomName,
        status: 'scheduled',
        kind: 'live-session',
        lesson_mode: true,
        members_visible: true,
        members_scheduled_at: scheduled.toISOString(),
        members_duration_minutes: form.duration_minutes,
        target_module_id: form.module_id,
        target_lesson_title: form.title.trim(),
        host_name: form.host_name.trim() || '+ que Vencedores',
        scheduled_at: scheduled.toISOString(),
      });
      toast.success('Reuniao ao vivo agendada');

      // Auto-anunciar em grupos WhatsApp ligados ao modulo com auto_send_meeting_links
      try {
        const { data: groups } = await (supabase as any).from('whatsapp_groups')
          .select('id, name, is_broadcast_enabled, auto_send_meeting_links')
          .eq('linked_module_id', form.module_id).eq('is_broadcast_enabled', true).eq('auto_send_meeting_links', true);
        const meetLink = `${window.location.origin}/membros/meet/${roomName}`;
        const whenStr = scheduled.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
        const msg = `📢 *NOVA AULA AO VIVO AGENDADA*\n\n*${form.title.trim()}*\n🗓️ ${whenStr}\n⏱️ ${form.duration_minutes} minutos\n🎤 Apresentador: ${form.host_name || '+ que Vencedores'}\n\n🔗 Link da sala: ${meetLink}\n\nO link tambem vai estar disponivel na Area de Membros 5 min antes do horario. Nos vemos la!`;
        for (const g of (groups || [])) {
          await supabase.functions.invoke('send-group-message', {
            body: { group_id: g.id, message: msg },
          }).catch(() => {});
        }
        if (groups?.length) toast.success(`Anunciado em ${groups.length} grupo(s) WhatsApp`);
      } catch (e) { console.warn('[group-announce]', e); }

      setShowDialog(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro ao agendar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Cancelar esta reuniao agendada?')) return;
    await (supabase as any).from('meetings').delete().eq('id', id);
    toast.success('Reuniao cancelada');
    load();
  };

  const copyMemberLink = (m: LiveMeeting) => {
    const url = `${window.location.origin}/membros/meet/${m.livekit_room_name}`;
    navigator.clipboard.writeText(url);
    toast.success('Link para membros copiado');
  };

  const openHostRoom = (m: LiveMeeting) => {
    const url = `/meet/${m.livekit_room_name}?mode=live-session&role=host&name=${encodeURIComponent(m.host_name || '+ que Vencedores')}`;
    window.open(url, '_blank');
  };

  const upcoming = meetings.filter(m => m.status !== 'completed');
  const past = meetings.filter(m => m.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-400" /> Reunioes ao vivo
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agende masterclasses e lives com os membros. A gravacao e publicada automaticamente no modulo.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Agendar reuniao
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>
      ) : (
        <>
          {/* Upcoming / live */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Agendadas e ao vivo</p>
            {upcoming.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Nenhuma reuniao agendada</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {upcoming.map((m) => {
                  const s = liveStatus(m);
                  const mod = modules.find(x => x.id === m.target_module_id);
                  return (
                    <Card key={m.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={s.color}>{s.label}</Badge>
                              <p className="font-medium text-sm truncate">{m.title}</p>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(m.members_scheduled_at)}</span>
                              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{m.members_duration_minutes}min</span>
                              {mod && <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{mod.title}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => copyMemberLink(m)} title="Copiar link para os membros">
                              <LinkIcon className="w-3.5 h-3.5" />
                            </Button>
                            {s.live ? (
                              <Button size="sm" onClick={() => openHostRoom(m)} className="bg-red-600 hover:bg-red-700 text-white">
                                Iniciar ao vivo
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => openHostRoom(m)}>
                                Entrar como host
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-red-400" onClick={() => remove(m.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Encerradas</p>
              <div className="space-y-2">
                {past.map((m) => {
                  const s = liveStatus(m);
                  return (
                    <Card key={m.id} className="opacity-75">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Badge className={s.color}>{s.label}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(m.members_scheduled_at)}</p>
                        </div>
                        {m.target_lesson_id && (
                          <Button size="sm" variant="ghost" onClick={() => window.open(`/membros/aula/${m.target_lesson_id}`, '_blank')}>
                            Ver aula
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Schedule dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar reuniao ao vivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Live de Q&A Masterclass" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duracao (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })} />
              </div>
              <div className="space-y-2">
                <Label>Apresentador</Label>
                <Input value={form.host_name} onChange={(e) => setForm({ ...form, host_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Publicar no modulo</Label>
              <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um modulo" /></SelectTrigger>
                <SelectContent>
                  {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.title} ({m.category})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
