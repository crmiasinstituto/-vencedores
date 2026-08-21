import { Event, FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Lock,
  ExternalLink
} from 'lucide-react';
import { FaixaBadge } from './FaixaBadge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const { faixa } = useMembership();
  // Evento é lista de convidados, não nível: estar numa faixa acima não te põe na sala.
  const hasAccess = event.faixasPermitidas.includes(faixa);
  const abertoATodos = event.faixasPermitidas.length === FAIXAS.length;

  const inicio = event.date;
  const fim = event.endDate ?? null;
  const multiDia = !!fim && fim.getTime() > inicio.getTime();

  // Evento de vários dias só encerra depois do ÚLTIMO dia — senão um evento de 26 a 28
  // apareceria como "encerrado" já no dia 27, com gente ainda participando.
  const ultimoDia = fim ?? inicio;
  const isPast = new Date(ultimoDia.getFullYear(), ultimoDia.getMonth(), ultimoDia.getDate() + 1) < new Date();

  const dayOfWeek = format(inicio, 'EEEE', { locale: ptBR });
  const formattedDate = multiDia
    ? (inicio.getMonth() === fim!.getMonth()
        ? `${format(inicio, 'd')} a ${format(fim!, "d 'de' MMMM", { locale: ptBR })}`
        : `${format(inicio, "d 'de' MMM", { locale: ptBR })} a ${format(fim!, "d 'de' MMM", { locale: ptBR })}`)
    : format(inicio, "d 'de' MMMM", { locale: ptBR });

  // "Garantir Vaga" precisa levar a algum lugar: inscrição/pagamento primeiro, sala depois.
  const destino = event.paymentUrl || event.meetingUrl || null;
  const rotuloBotao = event.paymentUrl
    ? 'Garantir Vaga'
    : event.type === 'presencial' ? 'Garantir Vaga' : 'Participar';

  return (
    <div className={cn(
      'group relative rounded-xl overflow-hidden bg-card/50 border transition-all duration-300',
      hasAccess && !isPast
        ? 'border-border/50 hover:border-gold/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)]' 
        : 'border-border/30',
      isPast && 'opacity-60'
    )}>
      {event.imageUrl && (
        <div className="relative h-36 w-full overflow-hidden">
          <img
            src={event.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {/* Degradê pra data e título continuarem legíveis sobre qualquer foto. */}
          <div className="absolute inset-0 bg-gradient-to-t from-card/95 to-transparent" />
        </div>
      )}
      <div className="p-5">
        {/* Date Block */}
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center bg-muted text-foreground">
            <span className="text-2xl font-bold leading-none">
              {multiDia ? `${format(inicio, 'd')}-${format(fim!, 'd')}` : format(inicio, 'd')}
            </span>
            <span className="text-xs uppercase mt-1">
              {format(inicio, 'MMM', { locale: ptBR })}
            </span>
          </div>

          {/* Event Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-gold transition-colors line-clamp-2">
              {event.title}
            </h3>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {dayOfWeek}, {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {event.time}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              {/* O local vale pros dois tipos: evento online também tem "onde" (Zoom, YouTube,
                  Meet), e escondê-lo deixava o card do online sem nenhuma pista de lugar. */}
              {event.location ? (
                <>
                  {event.type === 'presencial'
                    ? <MapPin className="w-3.5 h-3.5" />
                    : <Video className="w-3.5 h-3.5" />}
                  <span className="truncate">{event.location}</span>
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>Evento Online</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
          {event.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            {/* Spots remaining */}
            {event.spots && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                event.spotsRemaining && event.spotsRemaining <= 10 
                  ? 'text-destructive' 
                  : 'text-muted-foreground'
              )}>
                <Users className="w-3.5 h-3.5" />
                {event.spotsRemaining} vagas restantes
              </span>
            )}

            {/* Faixas convidadas. Se o evento é aberto a todas, dizer isso é ruído. */}
            {!abertoATodos && (
              <div className="flex flex-wrap items-center gap-1">
                {event.faixasPermitidas.map(f => (
                  <FaixaBadge key={f} faixa={f} size="sm" showLabel={false} />
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          {isPast ? (
            <span className="text-xs text-muted-foreground">Evento encerrado</span>
          ) : hasAccess ? (
            // O botão não tinha link nenhum: era decorativo e o membro clicava sem sair do lugar.
            destino ? (
              <Button variant="gold" size="sm" asChild>
                <a href={destino} target="_blank" rel="noopener noreferrer">
                  {rotuloBotao}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Link em breve</span>
            )
          ) : (
            <Button variant="outline" size="sm" disabled className="gap-1">
              <Lock className="w-3 h-3" />
              {event.faixasPermitidas.map(f => FAIXA_INFO[f].nome).join(', ')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
