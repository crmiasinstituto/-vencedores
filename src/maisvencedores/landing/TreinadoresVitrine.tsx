import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Vitrine dos treinadores na dobra "Quem está por trás" — carrossel de rostos que rola sozinho.
 *
 * Os dados vêm da tabela `treinadores` via RPC pública; nada é fabricado.
 *
 * POR QUE JAVASCRIPT E NÃO CSS: a página vive dentro de `.mv-landing`, que tem uma regra
 * `@media (prefers-reduced-motion: reduce) { .mv-landing * { animation: none !important } }`.
 * No iPhone com "Reduzir movimento" ligado (padrão em muitos aparelhos), essa regra matava a
 * animação CSS do marquee e a vitrine ficava parada. Aqui o movimento é feito com
 * requestAnimationFrame + transform, que o CSS de reduced-motion não alcança — roda em qualquer
 * aparelho, com ou sem a configuração ligada.
 *
 * ENQUANTO NÃO HÁ FOTO: o card mostra as iniciais num círculo. Assim que houver foto_url na
 * tabela, ela aparece no lugar — sem mexer aqui.
 */

type Treinador = { nome: string; foto_url: string | null; papel: string };

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function Card({ t }: { t: Treinador }) {
  return (
    <figure className="group flex w-44 shrink-0 flex-col sm:w-56">
      <div className="relative h-60 w-full overflow-hidden rounded-2xl bg-[#dfe4ec] sm:h-72">
        {t.foto_url ? (
          <img
            src={t.foto_url}
            alt={t.nome}
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover grayscale transition-all duration-300 group-hover:grayscale-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1b3fd1]/10 to-[#dfe4ec] font-display text-5xl font-bold text-[#1b3fd1]">
            {iniciais(t.nome)}
          </div>
        )}
        <figcaption className="absolute bottom-0 w-full bg-white/85 p-3 backdrop-blur-sm">
          <p className="font-semibold leading-tight text-[#080b12]">{t.nome}</p>
          <p className="text-sm text-[#4a5262]">{t.papel}</p>
        </figcaption>
      </div>
    </figure>
  );
}

export function TreinadoresVitrine() {
  const [treinadores, setTreinadores] = useState<Treinador[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    supabase.rpc('treinadores_publicos').then(({ data, error }) => {
      if (!ativo) return;
      if (error) {
        console.error('Erro ao carregar treinadores:', error);
      } else {
        setTreinadores((data as Treinador[]) || []);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  // Movimento contínuo em JS: imune ao reduced-motion do CSS.
  useEffect(() => {
    if (treinadores.length === 0) return;
    const track = trackRef.current;
    const group = groupRef.current;
    if (!track || !group) return;

    let raf = 0;
    let offset = 0;
    let last = performance.now();
    let paused = false;
    const speed = 45; // px por segundo

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // trava saltos se a aba ficou em segundo plano
      last = now;
      if (!paused) {
        const loop = group.offsetWidth; // largura de um conjunto (inclui o espaçamento final)
        if (loop > 0) {
          offset += speed * dt;
          if (offset >= loop) offset -= loop;
          track.style.transform = `translate3d(${-offset}px,0,0)`;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // Pausa só no mouse (desktop). No touch não pausa, pra não travar preso no dedo.
    const enter = () => {
      paused = true;
    };
    const leave = () => {
      paused = false;
    };
    track.addEventListener('mouseenter', enter);
    track.addEventListener('mouseleave', leave);

    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener('mouseenter', enter);
      track.removeEventListener('mouseleave', leave);
    };
  }, [treinadores]);

  if (treinadores.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden">
      {/* Máscaras nas bordas pra o carrossel desaparecer suave em vez de cortar seco. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[var(--day)] to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[var(--day)] to-transparent sm:w-24" />

      <div ref={trackRef} className="flex w-max will-change-transform">
        {/* Dois conjuntos idênticos lado a lado. Ao rolar a largura de um conjunto, reinicia
            sem emenda visível. O pr-4 dá o mesmo espaçamento entre e depois dos cards. */}
        <div ref={groupRef} className="flex shrink-0 gap-4 pr-4 py-2">
          {treinadores.map((t) => (
            <Card key={t.nome} t={t} />
          ))}
        </div>
        <div className="flex shrink-0 gap-4 pr-4 py-2" aria-hidden="true">
          {treinadores.map((t) => (
            <Card key={`dup-${t.nome}`} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default TreinadoresVitrine;
