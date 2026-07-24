import type { ComponentType, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Cartão de perfil no formato "avatar grande + card sobreposto + redes".
 *
 * Adaptado do componente de carrossel de depoimentos pedido pelo Carlos:
 * - next/Image -> <img> nativo, next/Link -> <button>/<a> (o app é Vite, não Next);
 * - o demo original trazia depoimentos de pessoas fictícias. Aqui NADA é inventado:
 *   recebe os dados reais de UM membro. É usado como preview ao passar o mouse no card.
 */

export interface ProfileSocial {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

export interface ProfilePreviewCardProps {
  name: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  initials?: string;
  badge?: ReactNode;
  socials?: ProfileSocial[];
  footer?: ReactNode;
  className?: string;
}

export function ProfilePreviewCard({
  name,
  title,
  description,
  imageUrl,
  initials,
  badge,
  socials = [],
  footer,
  className,
}: ProfilePreviewCardProps) {
  return (
    <div className={cn('flex items-stretch', className)}>
      {/* Avatar */}
      <div className="relative w-28 flex-shrink-0 self-start overflow-hidden rounded-2xl bg-navy-light aspect-[4/5]">
        <motion.div
          key={imageUrl || name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex h-full w-full items-center justify-center"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              draggable={false}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="font-display text-4xl font-bold text-gold">{initials}</span>
          )}
        </motion.div>
      </div>

      {/* Card sobreposto */}
      <motion.div
        key={name}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="z-10 -ml-6 flex flex-1 flex-col rounded-2xl border border-border/50 bg-card p-4 shadow-2xl"
      >
        <div className="mb-3">
          <h2 className="font-display text-xl font-bold leading-tight text-foreground">{name}</h2>
          {title && <p className="mt-0.5 text-sm font-medium text-muted-foreground">{title}</p>}
          {badge && <div className="mt-2">{badge}</div>}
        </div>

        {description && (
          <p className="mb-4 text-sm leading-relaxed text-foreground/80 line-clamp-4">
            {description}
          </p>
        )}

        {socials.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {socials.map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground transition-transform hover:scale-105"
              >
                <Icon className="h-4 w-4 text-background" />
              </button>
            ))}
          </div>
        )}

        {footer && <div className="mt-4">{footer}</div>}
      </motion.div>
    </div>
  );
}

export default ProfilePreviewCard;
