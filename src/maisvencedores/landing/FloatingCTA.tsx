import { useEffect, useState } from 'react';

/**
 * Botão de CTA que aparece ao rolar além do hero.
 *
 * Enterprise, não spam: fica escondido no topo (o hero já tem o CTA dele), surge discreto no
 * canto quando a pessoa rola e some se ela volta pro topo. Aponta pro #entrar, o cadastro.
 */
export function FloatingCTA() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Aparece depois de passar da primeira dobra (~80% da altura da janela).
      setVisivel(window.scrollY > window.innerHeight * 0.8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <a href="#entrar" className={`mv-landing-float${visivel ? ' on' : ''}`} aria-hidden={!visivel}>
      Quero fazer parte
      <span aria-hidden="true">→</span>
    </a>
  );
}

export default FloatingCTA;
