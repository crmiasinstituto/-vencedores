import { Faixa, FAIXA_INFO } from '@/maisvencedores/types/member';
import { cn } from '@/lib/utils';

interface FaixaBadgeProps {
  faixa: Faixa;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * A faixa da pessoa.
 *
 * Substituiu o PlanBadge (Bronze/Prata/Ouro com ícone de coroa/estrela/raio). Aqui não tem
 * ícone: a faixa É a cor, então quem identifica é a pastilha colorida. Coroa numa faixa
 * branca não diria nada — e a ideia toda é que a cor seja lida de relance, como no tatame.
 *
 * As cores vêm de FAIXA_INFO, calibradas pro fundo escuro (ver member.ts).
 */
export function FaixaBadge({ faixa, size = 'md', showLabel = true }: FaixaBadgeProps) {
  const info = FAIXA_INFO[faixa];

  const tamanho = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-3 py-1 gap-2',
    lg: 'text-base px-4 py-1.5 gap-2.5',
  };

  const pastilha = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        info.fundo,
        info.borda,
        tamanho[size],
      )}
      title={info.descricao}
    >
      <span className={cn('rounded-full', pastilha[size], info.pastilha)} aria-hidden="true" />
      {showLabel && <span className={info.texto}>Faixa {info.nome}</span>}
    </div>
  );
}
