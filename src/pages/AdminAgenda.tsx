import React, { useState, useEffect, useMemo, Fragment, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DndContext, DragEndEvent, useDraggable, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, Video, GraduationCap,
  CheckSquare, MapPin, Users, Trash2, Loader2, Link as LinkIcon, User,
  RefreshCw, Search, Bell, Download, Sparkles,
} from 'lucide-react';
import { downloadIcs } from '@/lib/icsExport';
import GoogleCalendarIntegration from '@/components/admin/GoogleCalendarIntegration';
import CollectiveEventModal from '@/components/agenda/CollectiveEventModal';

const db = supabase as any;

type ViewMode = 'month' | 'week' | 'day';

interface AgendaEvent {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  type: string;
  source: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  meeting_url: string | null;
  location: string | null;
  lead_id: string | null;
  meeting_id_ref: string | null;
  lesson_id_ref: string | null;
  status: string;
  metadata: any;
  recurrence_rule?: string | null;
  recurrence_until?: string | null;
  attendees_user_ids?: string[] | null;
  // synthetic fields for expanded occurrences
  _occurrence?: boolean;
  _original_id?: string;
}

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  personal: { label: 'Pessoal', icon: Calendar, color: '#3B82F6' },
  meeting: { label: 'Reuniao', icon: Video, color: '#3B82F6' },
  lesson_recording: { label: 'Gravacao de aula', icon: GraduationCap, color: '#8B5CF6' },
  live_session: { label: 'Live com membros', icon: Users, color: '#EF4444' },
  task: { label: 'Tarefa', icon: CheckSquare, color: '#10B981' },
  reminder: { label: 'Lembrete', icon: Clock, color: '#F59E0B' },
  other: { label: 'Outro', icon: Calendar, color: '#6B7280' },
};

const COLOR_PALETTE = [
  '#3B82F6', '#3B82F6', '#8B5CF6', '#EF4444', '#10B981',
  '#F59E0B', '#EC4899', '#06B6D4', '#6B7280', '#000000',
];

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function toLocalInput(iso: string | null) { if (!iso) return ''; const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

// Monta o link de HOST a partir do evento (reuniao/live/aula). O meeting_url
// salvo e' sempre o link do CONVIDADO (role=guest&name=<lead>); aqui extraimos
// so a sala e entramos como apresentador, com o nome ja preenchido. Assim o host
// clica no evento e entra na hora certa sem montar link na mao.
const HOST_NAME = '+ que Vencedores';
function buildHostMeetUrl(ev: AgendaEvent | null): string | null {
  if (!ev?.meeting_url) return null;
  let room = '';
  try {
    room = new URL(ev.meeting_url).pathname.replace(/^\/meet\//, '').replace(/\/$/, '');
  } catch {
    const m = ev.meeting_url.match(/\/meet\/([^?#/]+)/);
    room = m ? m[1] : '';
  }
  if (!room) return null;
  const mode = ev.type === 'live_session' ? 'live-session' : ev.type === 'lesson_recording' ? 'lesson' : 'sales';
  return `/meet/${room}?role=host&mode=${mode}&name=${encodeURIComponent(HOST_NAME)}`;
}

// Simple recurrence expander. Supports: DAILY, WEEKLY, MONTHLY.
// Format: FREQ=WEEKLY;INTERVAL=1  (INTERVAL optional, default 1)
function expandRecurrence(ev: AgendaEvent, windowStart: Date, windowEnd: Date): AgendaEvent[] {
  if (!ev.recurrence_rule) return [ev];
  const parts = Object.fromEntries(ev.recurrence_rule.split(';').map(p => p.split('=')));
  const freq = parts.FREQ;
  const interval = parseInt(parts.INTERVAL || '1', 10);
  const until = ev.recurrence_until ? new Date(ev.recurrence_until) : windowEnd;
  const durationMs = new Date(ev.end_at).getTime() - new Date(ev.start_at).getTime();
  const hardLimit = new Date(Math.min(until.getTime(), windowEnd.getTime() + 60 * 86400000));
  const out: AgendaEvent[] = [];
  let cursor = new Date(ev.start_at);
  let i = 0;
  while (cursor <= hardLimit && i < 400) {
    if (cursor >= windowStart) {
      out.push({
        ...ev,
        id: i === 0 ? ev.id : `${ev.id}::${cursor.getTime()}`,
        start_at: cursor.toISOString(),
        end_at: new Date(cursor.getTime() + durationMs).toISOString(),
        _occurrence: i > 0,
        _original_id: ev.id,
      });
    }
    if (freq === 'DAILY') cursor = addDays(cursor, interval);
    else if (freq === 'WEEKLY') cursor = addDays(cursor, 7 * interval);
    else if (freq === 'MONTHLY') {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + interval);
      cursor = next;
    } else break;
    i++;
  }
  return out;
}

export default function AdminAgenda() {
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(new Date());
  const [rawEvents, setRawEvents] = useState<AgendaEvent[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Set<string>>(new Set(['personal', 'meeting', 'lesson_recording', 'live_session', 'task', 'reminder']));
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [collectiveOpen, setCollectiveOpen] = useState(false);
  const [collectiveInitialDate, setCollectiveInitialDate] = useState<Date | undefined>(undefined);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const range = useMemo(() => {
    if (view === 'month') return { from: addDays(startOfMonth(cursor), -7), to: addDays(endOfMonth(cursor), 7) };
    if (view === 'week') return { from: startOfWeek(cursor), to: addDays(startOfWeek(cursor), 7) };
    const day0 = new Date(cursor); day0.setHours(0, 0, 0, 0);
    return { from: day0, to: addDays(day0, 1) };
  }, [view, cursor]);

  useEffect(() => { load(); }, [range.from.getTime(), range.to.getTime()]);
  useEffect(() => {
    db.from('team_members').select('id, name, email, avatar_url, role').eq('is_active', true).then(({ data }: any) => setTeamMembers(data || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from('calendar_events_all')
      .select('*')
      .gte('start_at', range.from.toISOString())
      .lte('start_at', range.to.toISOString())
      .order('start_at', { ascending: true });
    setRawEvents((data || []) as AgendaEvent[]);
    setLoading(false);
  };

  // Expand recurring events within visible range
  const events = useMemo(() => {
    const expanded: AgendaEvent[] = [];
    for (const ev of rawEvents) {
      if (ev.source === 'calendar_events' && ev.recurrence_rule) {
        expanded.push(...expandRecurrence(ev, range.from, range.to));
      } else {
        expanded.push(ev);
      }
    }
    return expanded.filter(e => filters.has(e.type));
  }, [rawEvents, range.from, range.to, filters]);

  const searchLeads = useCallback(async (q: string) => {
    if (q.length < 2) { setLeads([]); return; }
    const { data } = await db.from('crm_leads')
      .select('id, name, whatsapp, company_name')
      .or(`name.ilike.%${q}%,company_name.ilike.%${q}%,whatsapp.ilike.%${q}%`)
      .limit(8);
    setLeads(data || []);
  }, []);

  const openNew = (start?: Date) => {
    const s = start || new Date();
    s.setMinutes(Math.round(s.getMinutes() / 15) * 15, 0, 0);
    const e = new Date(s.getTime() + 30 * 60_000);
    setSelectedEvent(null);
    setForm({
      title: '', description: '', type: 'personal',
      start_at: toLocalInput(s.toISOString()),
      end_at: toLocalInput(e.toISOString()),
      all_day: false, location: '', meeting_url: '',
      color: TYPE_META.personal.color,
      lead_id: null, lead_name: '',
      attendees_user_ids: [],
      recurrence_freq: 'NONE',
      recurrence_interval: 1,
      recurrence_until: '',
      reminder_minutes_before: 15,
    });
    setShowDialog(true);
  };

  const openEdit = async (ev: AgendaEvent) => {
    let lead_name = '';
    if (ev.lead_id) {
      const { data } = await db.from('crm_leads').select('name').eq('id', ev.lead_id).maybeSingle();
      lead_name = data?.name || '';
    }
    setSelectedEvent(ev);
    const rruleParts = ev.recurrence_rule ? Object.fromEntries(ev.recurrence_rule.split(';').map(p => p.split('='))) : {};
    setForm({
      title: ev.title,
      description: ev.description || '',
      type: ev.type,
      start_at: toLocalInput(ev.start_at),
      end_at: toLocalInput(ev.end_at),
      all_day: ev.all_day,
      location: ev.location || '',
      meeting_url: ev.meeting_url || '',
      color: ev.color || TYPE_META[ev.type]?.color || '#3B82F6',
      lead_id: ev.lead_id,
      lead_name,
      attendees_user_ids: ev.attendees_user_ids || [],
      recurrence_freq: rruleParts.FREQ || 'NONE',
      recurrence_interval: parseInt(rruleParts.INTERVAL || '1', 10),
      recurrence_until: ev.recurrence_until ? ev.recurrence_until.slice(0, 10) : '',
      reminder_minutes_before: (ev as any).reminder_minutes_before ?? null,
    });
    setShowDialog(true);
  };

  const exportIcs = (ev: AgendaEvent) => {
    downloadIcs({
      uid: ev.id,
      title: ev.title,
      description: ev.description || '',
      location: ev.location || '',
      url: ev.meeting_url || '',
      start_at: ev.start_at,
      end_at: ev.end_at,
      rrule: ev.recurrence_rule || null,
    });
    toast.success('Baixado — importe no seu calendario favorito');
  };

  const save = async () => {
    if (!form.title?.trim() || !form.start_at) { toast.error('Preencha titulo e inicio'); return; }
    setSaving(true);
    try {
      // Reagendar reuniao (origem meetings): atualiza so horario/duracao na meeting.
      // O resto dos campos vem da reuniao e nao e' editado aqui. A ponte
      // meetings->Google re-sincroniza o evento no Google Calendar.
      if (selectedEvent && selectedEvent.source === 'meetings') {
        const startIso = new Date(form.start_at).toISOString();
        const endIso = form.end_at ? new Date(form.end_at).toISOString() : null;
        const durMin = endIso
          ? Math.max(5, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000))
          : null;
        const upd: any = { scheduled_at: startIso, reminder_sent_at: null, updated_at: new Date().toISOString() };
        if (durMin) upd.members_duration_minutes = durMin;
        const { error } = await db.from('meetings').update(upd).eq('id', selectedEvent.meeting_id_ref || selectedEvent.id);
        if (error) throw error;
        toast.success('Reuniao reagendada');
        setShowDialog(false);
        load();
        return;
      }

      const rrule = form.recurrence_freq && form.recurrence_freq !== 'NONE'
        ? `FREQ=${form.recurrence_freq};INTERVAL=${form.recurrence_interval || 1}`
        : null;
      const payload: any = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        type: form.type || 'personal',
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        all_day: !!form.all_day,
        location: form.location?.trim() || null,
        meeting_url: form.meeting_url?.trim() || null,
        color: form.color || TYPE_META[form.type || 'personal']?.color || '#3B82F6',
        lead_id: form.lead_id || null,
        attendees_user_ids: form.attendees_user_ids || [],
        recurrence_rule: rrule,
        recurrence_until: form.recurrence_until ? new Date(form.recurrence_until + 'T23:59:59').toISOString() : null,
        reminder_minutes_before: form.reminder_minutes_before === null || form.reminder_minutes_before === '' ? null : Number(form.reminder_minutes_before),
        reminder_sent_at: null, // reset if rescheduled
        updated_at: new Date().toISOString(),
      };
      let saved: any;
      if (selectedEvent && selectedEvent.source === 'calendar_events') {
        const realId = selectedEvent._original_id || selectedEvent.id;
        const { data } = await db.from('calendar_events').update(payload).eq('id', realId).select().single();
        saved = data;
      } else {
        const { data } = await db.from('calendar_events').insert(payload).select().single();
        saved = data;
      }
      toast.success(selectedEvent ? 'Atualizado' : 'Evento criado');
      setShowDialog(false);
      load();

      // Fire-and-forget push to Google Calendar if connected
      if (saved?.id) {
        supabase.functions.invoke('sync-google-calendar', {
          body: { action: 'push', event_id: saved.id },
        }).catch(() => {}); // silent — user sees result via sync indicator
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!selectedEvent || selectedEvent.source !== 'calendar_events') {
      toast.error('Eventos automaticos devem ser excluidos pela tela de origem.');
      return;
    }
    if (!confirm('Excluir este evento? Se for recorrente, remove toda a serie.')) return;
    const realId = selectedEvent._original_id || selectedEvent.id;
    await db.from('calendar_events').delete().eq('id', realId);
    toast.success('Excluido');
    setShowDialog(false);
    load();
  };

  const moveCursor = (delta: number) => {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + delta);
    else if (view === 'week') d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };

  const upcoming = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.start_at) >= now).slice(0, 8);
  }, [events]);

  const handleDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return;
    const eventId = String(e.active.id);
    const targetIso = String(e.over.id).replace('day-', '');
    const ev = events.find(x => x.id === eventId);
    if (!ev || ev.source !== 'calendar_events') {
      toast.error('So eventos pessoais podem ser arrastados. Reunioes/tarefas precisam ser reagendadas na tela de origem.');
      return;
    }
    if (ev._occurrence) {
      toast.error('Ocorrencia de evento recorrente nao pode ser movida individualmente (ainda).');
      return;
    }
    const targetDate = new Date(targetIso);
    const old = new Date(ev.start_at);
    const duration = new Date(ev.end_at).getTime() - old.getTime();
    // Keep hour/minute, change only day
    const newStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), old.getHours(), old.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);
    await db.from('calendar_events').update({
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', ev._original_id || ev.id);
    toast.success('Evento reagendado');
    load();
  };


  return (
    <>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" /> Agenda
            </h1>
            <p className="text-sm text-muted-foreground">Reunioes, aulas, lives, tarefas e compromissos num so lugar. Arraste eventos pessoais entre dias pra reagendar.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <GoogleCalendarIntegration onSyncComplete={load} />
            <Button
              variant="outline"
              onClick={() => { setCollectiveInitialDate(cursor); setCollectiveOpen(true); }}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Evento coletivo
            </Button>
            <Button onClick={() => openNew()} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Novo evento
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>Hoje</Button>
              <Button size="sm" variant="ghost" onClick={() => moveCursor(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => moveCursor(1)}><ChevronRight className="w-4 h-4" /></Button>
              <span className="text-sm font-semibold ml-2">
                {view === 'month' && `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}
                {view === 'week' && `Semana de ${startOfWeek(cursor).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                {view === 'day' && cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(['month', 'week', 'day'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs rounded-md ${view === v ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'}`}
                >
                  {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Dia'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TYPE_META).map(([key, m]) => {
            const active = filters.has(key);
            const Icon = m.icon;
            return (
              <button
                key={key}
                onClick={() => setFilters(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                className={`px-3 py-1 text-xs rounded-full border transition-all flex items-center gap-1.5 ${
                  active ? 'border-transparent text-white' : 'border-border text-muted-foreground opacity-50'
                }`}
                style={active ? { backgroundColor: m.color } : {}}
              >
                <Icon className="w-3 h-3" />{m.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div>
            {loading && <div className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Carregando...</div>}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              {view === 'month' && <MonthView cursor={cursor} events={events} onDayClick={openNew} onEventClick={openEdit} />}
              {view === 'week' && <WeekView cursor={cursor} events={events} onSlotClick={openNew} onEventClick={openEdit} />}
              {view === 'day' && <DayView cursor={cursor} events={events} onSlotClick={openNew} onEventClick={openEdit} />}
            </DndContext>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Proximos eventos</p>
              {upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nada agendado</p>
              ) : upcoming.map(ev => {
                const meta = TYPE_META[ev.type] || TYPE_META.other;
                const Icon = meta.icon;
                const start = new Date(ev.start_at);
                return (
                  <button
                    key={ev.id}
                    onClick={() => openEdit(ev)}
                    className="w-full text-left p-2 rounded-lg hover:bg-muted/50 border border-border/50 flex gap-2"
                  >
                    <div className="w-1 rounded-full" style={{ backgroundColor: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Icon className="w-3 h-3" />
                        {start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        <span>·</span>
                        {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {ev.recurrence_rule && <RefreshCw className="w-2.5 h-2.5" />}
                      </div>
                      <p className="text-sm font-medium truncate">{ev.title}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? 'Editar evento' : 'Novo evento'}
              {selectedEvent && selectedEvent.source !== 'calendar_events' && (
                <Badge variant="outline" className="ml-2 text-[10px]">origem: {selectedEvent.source}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Entrar na sala como apresentador: aparece em reuniao/live/aula que
              ja tem sala. Abre o /meet em nova aba, role=host e nome preenchido. */}
          {selectedEvent && buildHostMeetUrl(selectedEvent) && (
            <button
              onClick={() => {
                const url = buildHostMeetUrl(selectedEvent);
                if (url) window.open(url, '_blank', 'noopener');
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold py-3 hover:opacity-90 transition-opacity shadow-lg"
            >
              <Video className="w-4 h-4" />
              Entrar na sala como apresentador
            </button>
          )}

          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Titulo</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, color: TYPE_META[v]?.color || form.color })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_META).map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cor</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full h-10 rounded-md border border-input flex items-center gap-2 px-3">
                        <div className="w-5 h-5 rounded" style={{ backgroundColor: form.color }} />
                        <span className="text-xs font-mono">{form.color}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px]">
                      <div className="grid grid-cols-5 gap-1.5">
                        {COLOR_PALETTE.map(c => (
                          <button key={c}
                            className={`w-8 h-8 rounded ${form.color === c ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setForm({ ...form, color: c })}
                          />
                        ))}
                      </div>
                      <Input className="mt-2 h-8 text-xs" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#hex" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Inicio</Label>
                  <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Local</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Endereco ou sala" />
                </div>
                <div className="space-y-1.5">
                  <Label>Link de reuniao</Label>
                  <Input value={form.meeting_url} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              {/* Lead picker */}
              <div className="space-y-1.5">
                <Label>Vincular a lead (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-full h-10 rounded-md border border-input flex items-center gap-2 px-3 text-left">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs flex-1 truncate">{form.lead_name || 'Pesquisar lead...'}</span>
                      {form.lead_id && <Badge variant="outline" className="text-[10px]">vinculado</Badge>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px]">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        className="pl-8 h-8 text-xs"
                        placeholder="Nome, empresa ou WhatsApp"
                        onChange={(e) => searchLeads(e.target.value)}
                      />
                    </div>
                    <div className="max-h-[260px] overflow-auto space-y-1">
                      {form.lead_id && (
                        <button
                          onClick={() => setForm({ ...form, lead_id: null, lead_name: '' })}
                          className="w-full text-left text-[11px] text-red-400 p-2 hover:bg-red-500/10 rounded"
                        >
                          Remover vinculo
                        </button>
                      )}
                      {leads.map(l => (
                        <button
                          key={l.id}
                          onClick={() => setForm({ ...form, lead_id: l.id, lead_name: l.name || l.whatsapp })}
                          className="w-full text-left p-2 hover:bg-muted/50 rounded"
                        >
                          <p className="text-sm font-medium">{l.name || '(sem nome)'}</p>
                          <p className="text-[11px] text-muted-foreground">{l.company_name || l.whatsapp}</p>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Attendees from team */}
              {teamMembers.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Convidar equipe</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {teamMembers.map(tm => {
                      const selected = (form.attendees_user_ids || []).includes(tm.id);
                      return (
                        <button
                          key={tm.id}
                          onClick={() => setForm({
                            ...form,
                            attendees_user_ids: selected
                              ? form.attendees_user_ids.filter((id: string) => id !== tm.id)
                              : [...(form.attendees_user_ids || []), tm.id]
                          })}
                          className={`px-2.5 py-1 text-xs rounded-full border ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
                        >
                          {tm.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recurrence */}
              {(!selectedEvent || selectedEvent.source === 'calendar_events') && (
                <div className="space-y-1.5 p-3 bg-muted/30 rounded-lg">
                  <Label>Repetir</Label>
                  <div className="grid grid-cols-[1fr_80px_1fr] gap-2">
                    <Select value={form.recurrence_freq} onValueChange={(v) => setForm({ ...form, recurrence_freq: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Nao repete</SelectItem>
                        <SelectItem value="DAILY">Todo dia</SelectItem>
                        <SelectItem value="WEEKLY">Toda semana</SelectItem>
                        <SelectItem value="MONTHLY">Todo mes</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.recurrence_freq !== 'NONE' && (
                      <>
                        <Input type="number" min={1} max={30} className="h-8 text-xs"
                          value={form.recurrence_interval}
                          onChange={(e) => setForm({ ...form, recurrence_interval: parseInt(e.target.value) || 1 })}
                          title="Intervalo"
                        />
                        <Input type="date" className="h-8 text-xs"
                          value={form.recurrence_until}
                          onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })}
                          placeholder="ate"
                          title="Ate quando"
                        />
                      </>
                    )}
                  </div>
                  {form.recurrence_freq !== 'NONE' && (
                    <p className="text-[10px] text-muted-foreground">
                      Ex: "Toda semana" com intervalo 2 = a cada 2 semanas. Se nao definir ate quando, repete por 60 dias.
                    </p>
                  )}
                </div>
              )}

              {/* Reminder */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-primary" /> Lembrete por WhatsApp</Label>
                <Select
                  value={form.reminder_minutes_before === null ? 'none' : String(form.reminder_minutes_before)}
                  onValueChange={(v) => setForm({ ...form, reminder_minutes_before: v === 'none' ? null : parseInt(v, 10) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem lembrete</SelectItem>
                    <SelectItem value="5">5 minutos antes</SelectItem>
                    <SelectItem value="15">15 minutos antes</SelectItem>
                    <SelectItem value="30">30 minutos antes</SelectItem>
                    <SelectItem value="60">1 hora antes</SelectItem>
                    <SelectItem value="120">2 horas antes</SelectItem>
                    <SelectItem value="1440">1 dia antes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Envia notificacao automatica para o seu WhatsApp configurado em notification_rules.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Descricao</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[60px]" />
              </div>

              {selectedEvent && selectedEvent.source === 'meetings' && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  Reuniao: voce pode <strong>reagendar (data, hora e duracao)</strong> aqui e salvar. Os outros campos vem da reuniao. Entre na sala pelo botao acima.
                </p>
              )}
              {selectedEvent && selectedEvent.source !== 'calendar_events' && selectedEvent.source !== 'meetings' && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  Este evento vem de <strong>{selectedEvent.source}</strong>. Edicoes aqui nao afetam a origem — abra a tela especifica para alterar.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            {selectedEvent && selectedEvent.source === 'calendar_events' && (
              <Button variant="ghost" className="text-red-400 mr-auto" onClick={deleteEvent}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
              </Button>
            )}
            {selectedEvent && (
              <Button variant="outline" size="sm" onClick={() => exportIcs(selectedEvent)} title="Exportar .ics (Apple Calendar / Outlook)">
                <Download className="w-3.5 h-3.5 mr-1.5" /> .ics
              </Button>
            )}
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={saving || (selectedEvent && selectedEvent.source !== 'calendar_events' && selectedEvent.source !== 'meetings')}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              {selectedEvent && selectedEvent.source === 'meetings' ? 'Salvar novo horário' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CollectiveEventModal
        open={collectiveOpen}
        onOpenChange={setCollectiveOpen}
        initialDate={collectiveInitialDate}
        onCreated={() => load()}
      />
    </>
  );
}

// ==================== DRAGGABLE EVENT ====================

function DraggableEvent({ ev, onClick }: { ev: AgendaEvent; onClick: (e: AgendaEvent) => void }) {
  const draggable = ev.source === 'calendar_events' && !ev._occurrence;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ev.id,
    disabled: !draggable,
  });
  return (
    <button
      ref={setNodeRef as any}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(ev); }}
      className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate text-white font-medium ${isDragging ? 'opacity-50' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ backgroundColor: ev.color }}
      title={`${ev.title}${draggable ? ' (arraste pra mover)' : ''}`}
    >
      {ev.recurrence_rule && <span className="mr-0.5">↻</span>}
      {new Date(ev.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {ev.title}
    </button>
  );
}

// ==================== MONTH VIEW ====================

function MonthView({ cursor, events, onDayClick, onEventClick }: {
  cursor: Date; events: AgendaEvent[]; onDayClick: (d: Date) => void; onEventClick: (e: AgendaEvent) => void;
}) {
  const firstDay = startOfMonth(cursor);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      <div className="grid grid-cols-7 bg-muted/40">
        {WEEK.map(w => <div key={w} className="text-center text-xs font-semibold p-2 text-muted-foreground">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d, i) => <DayCell key={i} date={d} cursor={cursor} today={today} events={events} onDayClick={onDayClick} onEventClick={onEventClick} />)}
      </div>
    </div>
  );
}

function DayCell({ date, cursor, today, events, onDayClick, onEventClick }: {
  date: Date; cursor: Date; today: Date; events: AgendaEvent[]; onDayClick: (d: Date) => void; onEventClick: (e: AgendaEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date.toISOString()}` });
  const dayEvents = events.filter(e => sameDay(new Date(e.start_at), date));
  const inMonth = date.getMonth() === cursor.getMonth();
  const isToday = sameDay(date, today);
  return (
    <div
      ref={setNodeRef as any}
      className={`min-h-[110px] border-t border-l border-border p-1.5 cursor-pointer hover:bg-muted/30 transition-colors ${inMonth ? '' : 'bg-muted/10 text-muted-foreground'} ${isOver ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onDayClick(date); }}
    >
      <div className={`text-xs font-medium mb-1 ${isToday ? 'w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center' : ''}`}>
        {date.getDate()}
      </div>
      <div className="space-y-0.5">
        {dayEvents.slice(0, 3).map(ev => <DraggableEvent key={ev.id} ev={ev} onClick={onEventClick} />)}
        {dayEvents.length > 3 && (
          <button
            onClick={(e) => { e.stopPropagation(); onDayClick(date); }}
            className="text-[10px] text-muted-foreground font-medium pl-1.5"
          >
            +{dayEvents.length - 3} mais
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== WEEK VIEW ====================

function WeekView({ cursor, events, onSlotClick, onEventClick }: {
  cursor: Date; events: AgendaEvent[]; onSlotClick: (d: Date) => void; onEventClick: (e: AgendaEvent) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  const today = new Date();

  return (
    <div className="border border-border rounded-xl overflow-auto bg-background max-h-[75vh]">
      <div className="grid grid-cols-[50px_repeat(7,1fr)] sticky top-0 bg-muted/40 z-10">
        <div />
        {days.map(d => (
          <div key={d.toISOString()} className="text-center p-2 border-l border-border">
            <p className="text-[10px] uppercase text-muted-foreground">{WEEK[d.getDay()]}</p>
            <p className={`text-sm font-semibold ${sameDay(d, today) ? 'text-primary' : ''}`}>{d.getDate()}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[50px_repeat(7,1fr)]">
        {hours.map(h => (
          <Fragment key={`row-${h}`}>
            <div className="text-[10px] text-muted-foreground text-right pr-1 pt-0.5 border-t border-border h-12">
              {String(h).padStart(2, '0')}:00
            </div>
            {days.map(d => {
              const slot = new Date(d); slot.setHours(h, 0, 0, 0);
              const slotEvents = events.filter(e => {
                const es = new Date(e.start_at);
                return sameDay(es, d) && es.getHours() === h;
              });
              return (
                <div
                  key={`${d.toISOString()}-${h}`}
                  className="border-t border-l border-border h-12 p-0.5 cursor-pointer hover:bg-muted/30"
                  onClick={(e) => { if (e.target === e.currentTarget) onSlotClick(slot); }}
                >
                  {slotEvents.map(ev => (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className="w-full text-left text-[10px] px-1 py-0.5 rounded text-white font-medium truncate block"
                      style={{ backgroundColor: ev.color }}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ==================== DAY VIEW ====================

function DayView({ cursor, events, onSlotClick, onEventClick }: {
  cursor: Date; events: AgendaEvent[]; onSlotClick: (d: Date) => void; onEventClick: (e: AgendaEvent) => void;
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7);
  const dayEvents = events.filter(e => sameDay(new Date(e.start_at), cursor));

  return (
    <div className="border border-border rounded-xl overflow-auto bg-background max-h-[75vh]">
      <div className="grid grid-cols-[70px_1fr]">
        {hours.map(h => {
          const slot = new Date(cursor); slot.setHours(h, 0, 0, 0);
          const slotEvents = dayEvents.filter(e => new Date(e.start_at).getHours() === h);
          return (
            <Fragment key={`row-${h}`}>
              <div className="text-xs text-muted-foreground text-right pr-2 pt-1 border-t border-border h-20">
                {String(h).padStart(2, '0')}:00
              </div>
              <div
                className="border-t border-border h-20 p-1 space-y-1 cursor-pointer hover:bg-muted/20"
                onClick={(e) => { if (e.target === e.currentTarget) onSlotClick(slot); }}
              >
                {slotEvents.map(ev => {
                  const meta = TYPE_META[ev.type] || TYPE_META.other;
                  const Icon = meta.icon;
                  const durationMin = (new Date(ev.end_at).getTime() - new Date(ev.start_at).getTime()) / 60_000;
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className="w-full text-left p-2 rounded-lg text-white"
                      style={{ backgroundColor: ev.color }}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] opacity-90">
                        <Icon className="w-3 h-3" />
                        {new Date(ev.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {durationMin}min
                        {ev.recurrence_rule && <span className="ml-1">↻</span>}
                      </div>
                      <p className="text-sm font-semibold">{ev.title}</p>
                      {ev.location && <p className="text-[10px] opacity-80 flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</p>}
                      {ev.meeting_url && <p className="text-[10px] opacity-80 flex items-center gap-1"><LinkIcon className="w-3 h-3" />{ev.meeting_url}</p>}
                    </button>
                  );
                })}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
