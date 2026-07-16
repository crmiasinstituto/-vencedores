import { useEffect, useRef } from "react";

/**
 * O campo do hero: cada sinal ("+") é uma pessoa. São as 34 mil.
 *
 * Não é enfeite — é o argumento da seção seguinte desenhado. Por isso o jitter (gente não
 * forma grade), as falhas (a multidão respira) e a minoria que pulsa em cobalto (quem já
 * está dentro).
 *
 * Respeita prefers-reduced-motion: desenha um quadro parado e não abre requestAnimationFrame.
 */
export function SignalField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const STEP = 44;
    const ARM = 4.2;
    // 3x no celular é pixel jogado fora — o campo é decorativo, 2x basta e poupa bateria.
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let cells: { x: number; y: number; r: number; b: number; sp: number; ph: number }[] = [];
    let raf = 0;

    function build() {
      const host = c!.parentElement;
      if (!host) return;
      w = c!.width = host.offsetWidth * DPR;
      h = c!.height = host.offsetHeight * DPR;
      c!.style.width = host.offsetWidth + "px";
      c!.style.height = host.offsetHeight + "px";

      const s = STEP * DPR;
      const j = s * 0.42; // jitter: gente não forma grade
      cells = [];
      for (let y = s; y < h; y += s) {
        for (let x = s; x < w; x += s) {
          if (Math.random() < 0.22) continue; // falhas — a multidão respira
          cells.push({
            x: x + (Math.random() - 0.5) * j,
            y: y + (Math.random() - 0.5) * j,
            r: (Math.random() - 0.5) * 0.5, // inclinação leve
            b: Math.random() * 0.5,
            sp: 0.15 + Math.random() * 0.5,
            ph: Math.random() * 6.28,
          });
        }
      }
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);
      const arm = ARM * DPR;
      ctx!.lineWidth = 1.4 * DPR;
      ctx!.lineCap = "round";
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        const a = reduce ? p.b * 0.4 : p.b * 0.4 + 0.2 * Math.sin(t * 0.00035 * p.sp + p.ph) + 0.1;
        if (a <= 0.02) continue;
        // uma minoria pulsa em cobalto — quem já está dentro
        const hot = p.ph > 5.75;
        ctx!.strokeStyle = hot
          ? "rgba(61,107,255," + Math.min(a * 1.6, 0.8) + ")"
          : "rgba(150,168,205," + a * 0.34 + ")";
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.r);
        ctx!.beginPath();
        ctx!.moveTo(-arm, 0);
        ctx!.lineTo(arm, 0);
        ctx!.moveTo(0, -arm);
        ctx!.lineTo(0, arm);
        ctx!.stroke();
        ctx!.restore();
      }
    }

    function loop(t: number) {
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      build();
      if (reduce) {
        draw(0);
      } else {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    }

    start();

    let to: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(to);
      to = setTimeout(start, 180);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(to);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas id="field" ref={ref} aria-hidden="true" />;
}

export default SignalField;
