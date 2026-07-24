import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Vitrine dos treinadores — carrossel que rola sozinho E pode ser arrastado.
 *
 * É um scroller nativo (overflow-x-auto): no celular arrasta com o dedo, no desktop arrasta
 * com o mouse (handlers de pointer). Um requestAnimationFrame empurra o scrollLeft pra rolar
 * sozinho; qualquer interação (arrastar, roda do mouse, toque) pausa o automático por alguns
 * segundos e depois ele volta. Dois conjuntos idênticos lado a lado dão o loop sem emenda.
 *
 * Por que scrollLeft e não transform: assim o arrasto nativo funciona de graça, e o reduced-motion
 * do CSS (que congela animações) não alcança — roda em qualquer aparelho.
 */

type Treinador = { nome: string; foto_url: string | null; papel: string };

function iniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
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
            className="h-full w-full object-cover object-center grayscale transition-all duration-300 group-hover:grayscale-0"
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    supabase.rpc('treinadores_publicos').then(({ data, error }) => {
      if (!ativo) return;
      if (error) console.error('Erro ao carregar treinadores:', error);
      else setTreinadores((data as Treinador[]) || []);
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (treinadores.length === 0) return;
    const el = scrollerRef.current;
    const grp = groupRef.current;
    if (!el || !grp) return;

    const ctrl = { dragging: false, pausedUntil: 0, startX: 0, startScroll: 0 };
    let raf = 0;
    let last = performance.now();
    const speed = 55; // px por segundo

    const wrap = () => {
      const loop = grp.offsetWidth;
      if (loop <= 0) return;
      if (el.scrollLeft >= loop) el.scrollLeft -= loop;
      else if (el.scrollLeft < 0) el.scrollLeft += loop;
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (grp.offsetWidth > 0 && !ctrl.dragging && now >= ctrl.pausedUntil) {
        el.scrollLeft += speed * dt;
      }
      wrap();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const pause = (ms: number) => { ctrl.pausedUntil = performance.now() + ms; };
    const onWheel = () => pause(2500);
    const onTouchStart = () => pause(8000);
    const onTouchEnd = () => pause(2500);

    // arrastar com o mouse (no touch o scroll nativo já resolve)
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      ctrl.dragging = true;
      ctrl.startX = e.clientX;
      ctrl.startScroll = el.scrollLeft;
      el.style.cursor = 'grabbing';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!ctrl.dragging) return;
      el.scrollLeft = ctrl.startScroll - (e.clientX - ctrl.startX);
    };
    const onPointerUp = () => {
      if (!ctrl.dragging) return;
      ctrl.dragging = false;
      el.style.cursor = '';
      pause(2500);
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [treinadores]);

  if (treinadores.length === 0) return null;

  return (
    <div className="relative w-full">
      {/* Máscaras nas bordas pra o carrossel desaparecer suave. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[var(--day)] to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[var(--day)] to-transparent sm:w-24" />

      <div
        ref={scrollerRef}
        className="flex cursor-grab select-none overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollBehavior: 'auto', overscrollBehaviorX: 'contain' }}
      >
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
