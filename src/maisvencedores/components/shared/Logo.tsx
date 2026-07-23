import branca from '@/assets/logo-vencedores-branca.png';
import escura from '@/assets/logo-vencedores-escura.png';
import { cn } from '@/lib/utils';

/**
 * Logo oficial da Comunidade + que Vencedores (cruz em pincel + wordmark).
 *
 * - tone="branca": sempre a versão branca. Use em fundos escuros fixos (landing, telas de auth).
 * - tone="auto" (padrão): troca conforme o tema — branca no escuro, escura no claro.
 *   Depende da classe .theme-light no <html> (ver index.css). Usa nos headers da área de membros.
 */
export function Logo({
  className,
  tone = 'auto',
}: {
  className?: string;
  tone?: 'auto' | 'branca';
}) {
  const alt = 'Comunidade + que Vencedores';
  if (tone === 'branca') {
    return <img src={branca} alt={alt} className={cn('w-auto select-none', className)} draggable={false} />;
  }
  return (
    <>
      <img src={branca} alt={alt} draggable={false} className={cn('logo-on-dark w-auto select-none', className)} />
      <img src={escura} alt="" aria-hidden draggable={false} className={cn('logo-on-light w-auto select-none', className)} />
    </>
  );
}

export default Logo;
