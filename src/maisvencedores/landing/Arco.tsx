import { useEffect, useRef } from "react";

const PASSOS = [
  "Mais próximo de Deus.",
  "Mais disciplinado.",
  "Com mais equilíbrio emocional.",
  "Com uma comunicação mais forte.",
  "Com relacionamentos mais saudáveis.",
  "Produzindo mais.",
  "Ganhando mais.",
  "Vivendo com mais propósito.",
];

/**
 * ATO II — a dobradiça. É aqui que a noite vira dia.
 *
 * Cada passo acende ao entrar na tela e a linha cobalto cresce junto. A última frase
 * ("Tudo começa com uma decisão") já aterrissa na luz: o gradiente da seção termina em
 * --day, então a decisão é literalmente o ponto de virada da página.
 *
 * Sem IntersectionObserver, tudo nasce aceso — a página nunca fica com texto invisível.
 */
export function Arco() {
  const trackRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const line = lineRef.current;
    if (!track) return;

    const steps = Array.from(track.querySelectorAll<HTMLElement>(".step"));
    if (!steps.length) return;

    if (!("IntersectionObserver" in window)) {
      steps.forEach((s) => s.classList.add("on"));
      line?.style.setProperty("--grow", "1");
      return;
    }

    let vistos = 0;
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("on");
          io.unobserve(e.target);
          vistos++;
          line?.style.setProperty("--grow", String(Math.min(vistos / steps.length, 1)));
        });
      },
      { threshold: 0.6, rootMargin: "0px 0px -10% 0px" },
    );

    steps.forEach((s, i) => {
      s.style.transitionDelay = (i % 3) * 55 + "ms";
      io.observe(s);
    });

    return () => io.disconnect();
  }, []);

  return (
    <section className="arc">
      <div className="wrap">
        <p className="kicker">Doze meses</p>
        <h2 style={{ marginTop: 16 }}>Imagine onde você pode estar daqui a 12 meses.</h2>
        <div className="arc-track" ref={trackRef}>
          <div className="arc-line" ref={lineRef} aria-hidden="true" />
          {PASSOS.map((passo) => (
            <div className="step" key={passo}>
              <i className="sig" aria-hidden="true" />
              <p>{passo}</p>
            </div>
          ))}
        </div>
        <p className="arc-end">Tudo começa com uma decisão.</p>
      </div>
    </section>
  );
}

export default Arco;
