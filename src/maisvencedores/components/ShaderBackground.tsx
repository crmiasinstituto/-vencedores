import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

/**
 * Fundo animado do hero da landing.
 *
 * Duas camadas de MeshGradient: a de baixo dá o volume de cor, a de cima entra girada e com
 * opacidade baixa, criando interferência entre as duas — é o que dá a sensação de rede se
 * tecendo, que é o motivo de existir aqui (o título é "NetWeaving").
 *
 * As cores saem das variáveis da marca em index.css (--navy-deep, --primary, --electric), não
 * do ciano/laranja do exemplo original: o resto da landing é azul e o hero é a primeira coisa
 * que a pessoa vê.
 *
 * SOBRE A API: o exemplo que circula deste componente passa `wireframe="true"` e
 * `backgroundColor="..."`. Nenhuma das duas existe no @paper-design/shaders-react 0.0.77 —
 * MeshGradientParams aceita apenas colors/distortion/swirl/grainMixer/grainOverlay, mais
 * speed/frame e as de sizing. Passá-las não fazia nada além de vazar prop desconhecida pro
 * DOM e sujar o console. O volume aqui vem de distortion/swirl, que são as reais.
 *
 * Isto é WebGL. Dois cuidados:
 *  - prefers-reduced-motion zera a velocidade: fica o degradê parado, sem movimento.
 *  - se o WebGL não subir (GPU bloqueada, VM, navegador antigo), o gradiente CSS estático que
 *    fica atrás continua valendo, então o hero nunca aparece preto.
 */

// Equivalentes em hex das vars de index.css. O shader desenha em canvas, não lê CSS var.
const NAVY_DEEP = "#05090f"; // --navy-deep : 222 47% 4%
const NAVY = "#0a1120"; // --navy      : 222 47% 8%
const PRIMARY = "#3b82f6"; // --primary   : 217 91% 60%
const ELECTRIC = "#0ea5e9"; // --electric  : 199 89% 48%
const PRIMARY_DARK = "#1e40af"; // azul fundo, pra dar profundidade

export function ShaderBackground() {
  const [reduzirMovimento, setReduzirMovimento] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzirMovimento(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduzirMovimento(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Fallback: se o WebGL não subir, é este degradê que aparece. */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep via-background to-background" />

      <MeshGradient
        className="absolute inset-0 h-full w-full"
        colors={[NAVY_DEEP, PRIMARY, PRIMARY_DARK, NAVY, ELECTRIC]}
        speed={reduzirMovimento ? 0 : 0.25}
        distortion={0.8}
        swirl={0.6}
        grainOverlay={0.05}
      />
      {/* Girada 180° pra não repetir o desenho da de baixo: as duas juntas criam a malha. */}
      <MeshGradient
        className="absolute inset-0 h-full w-full opacity-50"
        colors={[NAVY_DEEP, ELECTRIC, PRIMARY, NAVY_DEEP]}
        speed={reduzirMovimento ? 0 : 0.15}
        distortion={1}
        swirl={0.9}
        rotation={180}
      />

      {/* O shader sozinho deixa o texto sem contraste no meio da tela. Esta camada escurece o
          centro e as bordas o suficiente pro título continuar legível. */}
      <div className="absolute inset-0 bg-background/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background" />
    </div>
  );
}

export default ShaderBackground;
