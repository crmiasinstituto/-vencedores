import { useEffect, useRef } from 'react';

/**
 * Fundo do hero: rastro de linhas que segue o cursor, com física de mola e cor em hsl rotativo.
 *
 * O Carlos mandou este efeito e pediu "do jeito que te mandei" — então é o rastro colorido,
 * como no original. Eu avisei que o neon puxa pro lúdico e não pro enterprise; ele confirmou
 * que quer assim.
 *
 * O código original vinha de Next com VARIÁVEIS GLOBAIS de módulo (ctx, lines, pos, E) e
 * listeners no `document` sem cleanup. Numa SPA isso VAZA: ao sair da landing os listeners e o
 * requestAnimationFrame continuam vivos e estouram ao tocar num canvas que não existe mais.
 * Aqui está tudo encapsulado no componente, com cancelamento no unmount.
 *
 * pointer-events-none: o canvas cobre o hero mas não engole cliques dos botões.
 * prefers-reduced-motion: desenha nada e não abre o loop.
 */
export function CanvasHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const config = { friction: 0.5, trails: 80, size: 50, dampening: 0.025, tension: 0.99 };
    const pos = { x: 0, y: 0 };
    let running = true;
    let raf = 0;
    let oscPhase = Math.random() * 2 * Math.PI;
    const oscAmp = 85;
    const oscFreq = 0.0015;
    const oscOffset = 285;

    type No = { x: number; y: number; vx: number; vy: number };
    type Linha = { spring: number; friction: number; nodes: No[] };
    let linhas: Linha[] = [];

    function criarLinhas() {
      linhas = [];
      for (let i = 0; i < config.trails; i++) {
        const spring = 0.4 + (i / config.trails) * 0.025;
        const linha: Linha = {
          spring: spring + 0.1 * Math.random() - 0.05,
          friction: config.friction + 0.01 * Math.random() - 0.005,
          nodes: [],
        };
        for (let n = 0; n < config.size; n++) {
          linha.nodes.push({ x: pos.x, y: pos.y, vx: 0, vy: 0 });
        }
        linhas.push(linha);
      }
    }

    function atualizarLinha(l: Linha) {
      let spring = l.spring;
      let t = l.nodes[0];
      t.vx += (pos.x - t.x) * spring;
      t.vy += (pos.y - t.y) * spring;
      for (let i = 0; i < l.nodes.length; i++) {
        t = l.nodes[i];
        if (i > 0) {
          const prev = l.nodes[i - 1];
          t.vx += (prev.x - t.x) * spring;
          t.vy += (prev.y - t.y) * spring;
          t.vx += prev.vx * config.dampening;
          t.vy += prev.vy * config.dampening;
        }
        t.vx *= l.friction;
        t.vy *= l.friction;
        t.x += t.vx;
        t.y += t.vy;
        spring *= config.tension;
      }
    }

    function desenharLinha(l: Linha) {
      let n = l.nodes[0].x;
      let i = l.nodes[0].y;
      ctx!.beginPath();
      ctx!.moveTo(n, i);
      let a: No, b: No;
      for (let k = 1; k < l.nodes.length - 2; k++) {
        a = l.nodes[k];
        b = l.nodes[k + 1];
        n = 0.5 * (a.x + b.x);
        i = 0.5 * (a.y + b.y);
        ctx!.quadraticCurveTo(a.x, a.y, n, i);
      }
      a = l.nodes[l.nodes.length - 2];
      b = l.nodes[l.nodes.length - 1];
      ctx!.quadraticCurveTo(a.x, a.y, b.x, b.y);
      ctx!.stroke();
      ctx!.closePath();
    }

    function render() {
      if (!running) return;
      ctx!.globalCompositeOperation = 'source-over';
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.globalCompositeOperation = 'lighter';
      oscPhase += oscFreq;
      const hue = Math.round(oscOffset + Math.sin(oscPhase) * oscAmp);
      ctx!.strokeStyle = `hsla(${hue},100%,50%,0.025)`;
      ctx!.lineWidth = 10;
      for (const l of linhas) {
        atualizarLinha(l);
        desenharLinha(l);
      }
      raf = window.requestAnimationFrame(render);
    }

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }

    let iniciado = false;
    function primeiroMovimento(e: MouseEvent | TouchEvent) {
      // No primeiro movimento, posiciona o rastro e liga o loop. Antes disso o canvas fica
      // limpo (sem uma linha morta pendurada no canto).
      const p = 'touches' in e ? e.touches[0] : (e as MouseEvent);
      const rect = canvas!.getBoundingClientRect();
      pos.x = p.clientX - rect.left;
      pos.y = p.clientY - rect.top;
      if (!iniciado) {
        iniciado = true;
        criarLinhas();
        render();
      }
    }

    function mover(e: MouseEvent | TouchEvent) {
      const p = 'touches' in e ? e.touches[0] : (e as MouseEvent);
      const rect = canvas!.getBoundingClientRect();
      pos.x = p.clientX - rect.left;
      pos.y = p.clientY - rect.top;
      if ('preventDefault' in e && e.cancelable) e.preventDefault();
    }

    resize();
    // O rastro segue o mouse na PÁGINA toda, não só sobre o canvas — como no efeito original.
    document.addEventListener('mousemove', primeiroMovimento, { once: true });
    document.addEventListener('touchstart', primeiroMovimento, { once: true });
    document.addEventListener('mousemove', mover);
    document.addEventListener('touchmove', mover, { passive: false });
    window.addEventListener('resize', resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', primeiroMovimento);
      document.removeEventListener('touchstart', primeiroMovimento);
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('touchmove', mover);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export default CanvasHero;
