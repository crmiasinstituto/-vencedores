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
import { ProfilePreviewCard, type ProfileSocial } from '@/components/ui/profile-card-testimonial-carousel';

interface MemberCardProps {
  member: MemberProfile;
}

export function MemberCard({ member }: MemberCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const info = FAIXA_INFO[member.faixa];

  const displayImage = member.photo;
  // O card é da pessoa: quem nomeia é o nome dela, e a empresa é só contexto quando existe.
  const initials = member.nomeCompleto.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Redes/contatos reais do membro para o preview no hover — só entra o que existe.
  const socials: ProfileSocial[] = [
    member.telefone && {
      icon: Phone,
      label: 'WhatsApp',
      onClick: () => window.open(`https://wa.me/55${member.telefone}`, '_blank'),
    },
    member.email && {
      icon: Mail,
      label: 'Email',
      onClick: () => window.open(`mailto:${member.email}`, '_blank'),
    },
    member.instagram && {
      icon: Instagram,
      label: 'Instagram',
      onClick: () => window.open(`https://instagram.com/${member.instagram!.replace('@', '')}`, '_blank'),
    },
    member.linkedin && {
      icon: Linkedin,
      label: 'LinkedIn',
      onClick: () => window.open(`https://linkedin.com/in/${member.linkedin}`, '_blank'),
    },
    member.website && {
      icon: Globe,
      label: 'Site',
      onClick: () => window.open(member.website, '_blank'),
    },
  ].filter(Boolean) as ProfileSocial[];

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
        className="w-[460px] max-w-[92vw] border-0 bg-transparent p-0 shadow-none"
        side="right"
        align="start"
      >
        <ProfilePreviewCard
          name={member.nomeCompleto}
          title={member.profissao || member.companyName || undefined}
          description={member.description || undefined}
          imageUrl={displayImage}
          initials={initials}
          badge={<FaixaBadge faixa={member.faixa} size="sm" />}
          socials={socials}
          footer={
            <>
              {member.services && member.services.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {member.services.slice(0, 4).map((service, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-gold/10 px-2 py-1 text-xs text-gold"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              )}
              <Button variant="gold" size="sm" className="w-full">
                Ver Perfil Completo
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </>
          }
        />
      </HoverCardContent>
    </HoverCard>
  );
}
