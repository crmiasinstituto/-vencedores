import { useState } from 'react';
import { MemberProfile, FAIXA_INFO } from '@/maisvencedores/types/member';
import { FaixaBadge } from './FaixaBadge';
import { cn } from '@/lib/utils';
import { 
  Mail, 
  Phone, 
  Globe, 
  Instagram, 
  Linkedin,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';

interface MemberCardProps {
  member: MemberProfile;
}

export function MemberCard({ member }: MemberCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const info = FAIXA_INFO[member.faixa];

  const displayImage = member.photo;
  // O card é da pessoa: quem nomeia é o nome dela, e a empresa é só contexto quando existe.
  const initials = member.nomeCompleto.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <HoverCard open={isOpen} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        <div 
          className={cn(
            'group relative cursor-pointer rounded-xl p-4 transition-all duration-300',
            'bg-card/50 backdrop-blur-sm border hover:border-gold/50',
            'hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]',
            'hover:scale-[1.02] hover:-translate-y-1',
            info.borda
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          {/* New Member Badge */}
          {member.isNewMember && (
            <div className="absolute -top-2 -right-2 z-10">
              <div className="flex items-center gap-1 bg-electric text-navy-deep text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                <Sparkles className="w-3 h-3" />
                NOVO
              </div>
            </div>
          )}

          {/* Card Content */}
          <div className="flex flex-col items-center text-center space-y-3">
            {/* Avatar */}
            <div className={cn(
              'w-20 h-20 rounded-full overflow-hidden border-2 transition-all duration-300',
              'group-hover:scale-110 group-hover:shadow-lg',
              info.borda
            )}>
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={member.nomeCompleto}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-navy-light flex items-center justify-center text-gold text-xl font-bold">
                  {initials}
                </div>
              )}
            </div>

            {/* Nome */}
            <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-gold transition-colors line-clamp-1">
              {member.nomeCompleto}
            </h3>

            {/* Profissão */}
            {member.profissao && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {member.profissao}
              </span>
            )}

            <FaixaBadge faixa={member.faixa} size="sm" />
          </div>
        </div>
      </HoverCardTrigger>

      <HoverCardContent
        className={cn(
          'w-80 p-0 overflow-hidden',
          'bg-card/95 backdrop-blur-xl border',
          info.borda
        )}
        side="right"
        align="start"
      >
        {/* Header na cor da faixa */}
        <div className={cn('p-4 text-center', info.fundo)}>
          <div className="flex items-center justify-center gap-3">
            <div className={cn('w-14 h-14 rounded-full overflow-hidden border-2', info.borda)}>
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={member.nomeCompleto}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-navy-light flex items-center justify-center text-gold text-lg font-bold">
                  {initials}
                </div>
              )}
            </div>
            <div className="text-left">
              <h4 className="font-display text-lg font-bold text-foreground">
                {member.nomeCompleto}
              </h4>
              {member.profissao && <p className="text-sm text-muted-foreground">{member.profissao}</p>}
              {member.companyName && <p className="text-xs text-gold">{member.companyName}</p>}
            </div>
          </div>
          <div className="mt-3">
            <FaixaBadge faixa={member.faixa} size="sm" />
          </div>
        </div>

        {/* Description */}
        <div className="p-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground leading-relaxed">
            "{member.description}"
          </p>
        </div>

        {/* Services */}
        {member.services && member.services.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">
              Produtos/Serviços
            </p>
            <div className="flex flex-wrap gap-1.5">
              {member.services.slice(0, 4).map((service, idx) => (
                <span 
                  key={idx}
                  className="text-xs bg-gold/10 text-gold px-2 py-1 rounded-full"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact Links */}
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {member.telefone && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => window.open(`https://wa.me/55${member.telefone}`, '_blank')}
            >
              <Phone className="w-3 h-3 mr-1" />
              WhatsApp
            </Button>
          )}
          {member.email && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => window.open(`mailto:${member.email}`, '_blank')}
            >
              <Mail className="w-3 h-3 mr-1" />
              Email
            </Button>
          )}
          {member.linkedin && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => window.open(`https://linkedin.com/in/${member.linkedin}`, '_blank')}
            >
              <Linkedin className="w-4 h-4" />
            </Button>
          )}
          {member.instagram && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => window.open(`https://instagram.com/${member.instagram.replace('@', '')}`, '_blank')}
            >
              <Instagram className="w-4 h-4" />
            </Button>
          )}
          {member.website && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => window.open(member.website, '_blank')}
            >
              <Globe className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* View Profile CTA */}
        <div className="p-3 border-t border-border/50 bg-muted/30">
          <Button 
            variant="gold" 
            size="sm" 
            className="w-full"
          >
            Ver Perfil Completo
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
