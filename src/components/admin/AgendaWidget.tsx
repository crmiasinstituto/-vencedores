import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  CalendarDays, ChevronRight, Video, GraduationCap, Users, CheckSquare, Clock, Bell,
} from 'lucide-react';

const db = supabase as any;

const TYPE_ICONS: Record<string, any> = {
  personal: CalendarDays,
  meeting: Video,
  lesson_recording: GraduationCap,
  live_session: Users,
  task: CheckSquare,
  reminder: Bell,
};

export default function AgendaWidget() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await db.from('calendar_events_all')
        .select('id, title, start_at, type, color, meeting_url, lead_id, source')
        .gte('start_at', new Date().toISOString())
        .neq('status', 'completed')
        .order('start_at', { ascending: true })
        .limit(6);
      setEvents(data || []);
      setLoading(false);
    };
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, []);

  const todayEvents = events.filter(e => {
    const d = new Date(e.start_at);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Agenda</p>
              <p className="text-[11px] text-muted-foreground">
                {todayEvents.length > 0 ? `${todayEvents.length} hoje` : 'Proximos compromissos'}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate('/admin/agenda')}>
            Abrir <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : events.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground mb-3">Nenhum compromisso nos proximos dias</p>
            <Button size="sm" onClick={() => navigate('/admin/agenda')} className="text-xs">
              + Criar evento
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(ev => {
              const Icon = TYPE_ICONS[ev.type] || CalendarDays;
              const start = new Date(ev.start_at);
              const isToday = start.toDateString() === new Date().toDateString();
              const isTomorrow = start.toDateString() === new Date(Date.now() + 86400000).toDateString();
              const dayLabel = isToday ? 'Hoje'
                : isTomorrow ? 'Amanha'
                : start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' });
              const timeLabel = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return (
                <button
                  key={ev.id}
                  onClick={() => navigate('/admin/agenda')}
                  className="w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                  <div className="flex-shrink-0 w-16 text-center">
                    <p className={`text-[10px] uppercase font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{dayLabel}</p>
                    <p className="text-sm font-bold">{timeLabel}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Icon className="w-3 h-3" />
                      <span className="truncate">{ev.source === 'calendar_events' ? 'Pessoal' : ev.source === 'meetings' ? 'Reuniao' : ev.source === 'tasks' ? 'Tarefa' : ev.type}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
