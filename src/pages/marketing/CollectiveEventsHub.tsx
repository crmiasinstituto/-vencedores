/**
 * CollectiveEventsHub
 *
 * Painel /admin/marketing/eventos-coletivos. Lista todas as Masterclasses/Workshops/Aulões,
 * mostra contagem de inscritos por sala, deixa o host entrar como moderador e re-sincronizar segmento.
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus, Sparkles, Users, Calendar, Globe, MapPin, Layers,
  RefreshCw, Video, ExternalLink, Loader2,
} from 'lucide-react';
import CollectiveEventModal from '@/components/agenda/CollectiveEventModal';

type EventFormat = 'online' | 'presencial' | 'hybrid';

interface CollectiveEvent {
  id: string;
  title: string;
  event_format: EventFormat;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  recording_enabled: boolean;
  max_per_room: number;
  segment_last_synced_at: string | null;
  venue_name: string | null;
  rooms?: Array<{
    id: string;
    room_name: string;
    attendance_mode: string;
    capacity: number;
    current_count: number;
  }>;
  invite_counts?: {
    total: number;
    confirmed: number;
    joined: number;
    no_show: number;
  };
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

function FormatBadge({ fmt }: { fmt: EventFormat }) {
  const props =
    fmt === 'online'
      ? { icon: <Globe className="w-3 h-3" />, label: 'Online', cls: 'bg-blue-500/10 text-blue-300' }
      : fmt === 'presencial'
      ? { icon: <MapPin className="w-3 h-3" />, label: 'Presencial', cls: 'bg-emerald-500/10 text-emerald-300' }
      : { icon: <Layers className="w-3 h-3" />, label: 'Híbrido', cls: 'bg-amber-500/10 text-amber-300' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${props.cls}`}>
      {props.icon} {props.label}
    </span>
  );
}

export default function CollectiveEventsHub() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CollectiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [resyncing, setResyncing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'drafts' | 'past' | 'all'>('upcoming');

  async function load() {
    setLoading(true);
    try {
      const { data: evRows, error } = await supabase
        .from('collective_events' as any)
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const evs = (evRows as any[]) ?? [];
      if (evs.length === 0) {
        setEvents([]);
        return;
      }

      const ids = evs.map((e) => e.id);
      const [roomsRes, invitesRes] = await Promise.all([
        supabase
          .from('collective_event_rooms' as any)
          .select('id, event_id, room_name, attendance_mode, capacity, current_count')
          .in('event_id', ids),
        supabase
          .from('collective_event_invites' as any)
          .select('event_id, attendance_mode, joined_at, no_show_marked_at, rsvp_at')
          .in('event_id', ids),
      ]);

      const roomsByEvent = new Map<string, any[]>();
      (roomsRes.data as any[] ?? []).forEach((r) => {
        if (!roomsByEvent.has(r.event_id)) roomsByEvent.set(r.event_id, []);
        roomsByEvent.get(r.event_id)!.push(r);
      });

      const countsByEvent = new Map<string, CollectiveEvent['invite_counts']>();
      (invitesRes.data as any[] ?? []).forEach((inv) => {
        const c = countsByEvent.get(inv.event_id) ?? {
          total: 0, confirmed: 0, joined: 0, no_show: 0,
        };
        c.total += 1;
        if (inv.rsvp_at) c.confirmed += 1;
        if (inv.joined_at) c.joined += 1;
        if (inv.no_show_marked_at) c.no_show += 1;
        countsByEvent.set(inv.event_id, c);
      });

      const enriched: CollectiveEvent[] = evs.map((e) => ({
        ...e,
        rooms: roomsByEvent.get(e.id) ?? [],
        invite_counts: countsByEvent.get(e.id) ?? { total: 0, confirmed: 0, joined: 0, no_show: 0 },
      }));

      setEvents(enriched);
    } catch (err: any) {
      toast.error(`Erro ao listar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleResync(eventId: string) {
    setResyncing(eventId);
    try {
      const { data, error } = await (supabase.rpc as any)('populate_collective_invites', { p_event_id: eventId });
      if (error) throw error;
      toast.success(`${data} novos convites adicionados`);
      await load();
    } catch (err: any) {
      toast.error(`Erro no resync: ${err.message}`);
    } finally {
      setResyncing(null);
    }
  }

  function handleEnterAsHost(ev: CollectiveEvent) {
    const onlineRooms = (ev.rooms ?? []).filter((r) => r.attendance_mode === 'online');
    if (onlineRooms.length === 0) {
      toast.error('Esse evento não tem sala online');
      return;
    }
    if (onlineRooms.length === 1) {
      navigate(`/meet/${onlineRooms[0].room_name}?role=host`);
      return;
    }
    // Múltiplas salas: abre todas em abas
    onlineRooms.forEach((r, i) => {
      if (i === 0) {
        navigate(`/meet/${r.room_name}?role=host`);
      } else {
        window.open(`/meet/${r.room_name}?role=host`, '_blank');
      }
    });
    toast.success(`${onlineRooms.length} salas abertas`);
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    if (filter === 'drafts') return events.filter((e) => e.status === 'draft');
    return events.filter((e) =>
      filter === 'upcoming'
        ? !isPast(e.scheduled_at) && e.status !== 'draft'
        : isPast(e.scheduled_at) && e.status !== 'draft',
    );
  }, [events, filter]);

  const draftsCount = useMemo(() => events.filter((e) => e.status === 'draft').length, [events]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" /> Eventos coletivos
          </h1>
          <p className="text-sm text-muted-foreground">
            Masterclasses, Workshops, Aulões e Lives com segmentação do kanban.
          </p>
        </div>
        <Button onClick={() => { setEditingId(undefined); setModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo evento
        </Button>
      </div>

      <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5 w-fit">
        {(['upcoming', 'drafts', 'past', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-md ${
              filter === f ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'
            }`}
          >
            {f === 'upcoming' ? 'Próximos'
              : f === 'drafts' ? `Rascunhos${draftsCount ? ` (${draftsCount})` : ''}`
              : f === 'past' ? 'Passados' : 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhum evento {filter === 'upcoming' ? 'agendado' : filter === 'past' ? 'passado' : ''}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => {
            const past = isPast(ev.scheduled_at);
            const totalCapacity = (ev.rooms ?? []).reduce((s, r) => s + r.capacity, 0);
            const totalCount = (ev.rooms ?? []).reduce((s, r) => s + r.current_count, 0);
            return (
              <Card key={ev.id} className={past ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{ev.title}</h3>
                        <FormatBadge fmt={ev.event_format} />
                        <Badge
                          variant="outline"
                          className={`text-xs ${ev.status === 'draft' ? 'border-amber-500/50 text-amber-300' : ''}`}
                        >
                          {ev.status === 'draft' ? 'Rascunho' : ev.status}
                        </Badge>
                        {ev.recording_enabled && (
                          <Badge variant="outline" className="text-xs border-red-500/40 text-red-300">
                            <Video className="w-3 h-3 mr-1" /> Gravando
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDateBR(ev.scheduled_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {ev.invite_counts?.total ?? 0} convidados ·
                          {' '}{ev.invite_counts?.confirmed ?? 0} confirmados ·
                          {' '}{ev.invite_counts?.joined ?? 0} entraram
                        </span>
                        {totalCapacity > 0 && (
                          <span>{totalCount}/{totalCapacity} nas salas</span>
                        )}
                      </p>
                      {(ev.rooms ?? []).length > 1 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Salas: {(ev.rooms ?? []).map((r) => r.room_name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {ev.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => { setEditingId(ev.id); setModalOpen(true); }}
                          className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                        >
                          Continuar editando
                        </Button>
                      )}
                      {!past && ev.status !== 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResync(ev.id)}
                          disabled={resyncing === ev.id}
                        >
                          {resyncing === ev.id ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          Re-sincronizar
                        </Button>
                      )}
                      {(ev.event_format === 'online' || ev.event_format === 'hybrid') && !past && ev.status !== 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => handleEnterAsHost(ev)}
                          className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                        >
                          <Video className="w-3 h-3 mr-1" /> Entrar como host
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/marketing/eventos-coletivos/${ev.id}`)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CollectiveEventModal
        open={modalOpen}
        onOpenChange={(o) => { setModalOpen(o); if (!o) setEditingId(undefined); }}
        initialEventId={editingId}
        onCreated={(evId) => {
          load();
          if (evId) navigate(`/admin/marketing/eventos-coletivos/${evId}`);
        }}
      />
    </div>
  );
}
