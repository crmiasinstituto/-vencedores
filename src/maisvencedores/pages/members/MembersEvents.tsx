import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { EventCard } from '@/maisvencedores/components/members/EventCard';
import { useEvents, Event as EventType } from '@/maisvencedores/hooks/useEvents';
import { useAnnouncements } from '@/maisvencedores/hooks/useAnnouncements';
import { Bell, Loader2, Calendar, Info, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MembersEvents() {
  const { events, loading: loadingEvents } = useEvents();
  const { announcements, loading: loadingAnnouncements } = useAnnouncements();

  const loading = loadingEvents || loadingAnnouncements;

  // Map events to the format expected by EventCard
  const mappedEvents = events.map((e: EventType) => ({
    id: e.id,
    title: e.title,
    description: e.description || '',
    date: e.date,
    endDate: e.endDate,
    time: e.time || '',
    type: e.type,
    location: e.location || undefined,
    meetingUrl: e.meetingUrl || undefined,
    paymentUrl: e.paymentUrl || undefined,
    imageUrl: e.imageUrl || undefined,
    spots: e.totalSpots || undefined,
    spotsRemaining: e.spotsRemaining || undefined,
    faixasPermitidas: e.faixasPermitidas || [],
  }));

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'new_member':
        return <User className="w-5 h-5 text-gold" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen">
      <MembersHeader 
        title="Eventos & Avisos"
        subtitle="Fique por dentro das novidades da comunidade"
      />
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Events */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold" />
              Próximos Eventos
            </h2>
            {mappedEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card/50 rounded-xl border border-border/50">
                Nenhum evento agendado no momento.
              </div>
            ) : (
              mappedEvents.map(event => (
                <EventCard key={event.id} event={event} />
              ))
            )}
          </div>

          {/* Announcements */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-5 h-5 text-gold" />
              Avisos Recentes
            </h2>
            {announcements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-card/50 rounded-xl border border-border/50">
                Nenhum aviso no momento.
              </div>
            ) : (
              announcements.map(announcement => (
                <div 
                  key={announcement.id}
                  className={cn(
                    'bg-card/50 border rounded-xl p-4',
                    announcement.type === 'new_member' ? 'border-gold/30' : 'border-border/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {getAnnouncementIcon(announcement.type)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground text-sm">{announcement.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{announcement.content}</p>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {format(announcement.createdAt, "dd 'de' MMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
