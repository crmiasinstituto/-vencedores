import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReprogrameLanding() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Reprograme-se 10X · + que Vencedores</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </Helmet>
      <main className="relative min-h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
        {/* Glow de fundo dourado */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[120%] h-[60%] rounded-full opacity-40 blur-[100px]"
            style={{ background: "radial-gradient(ellipse at center, #3B82F6 0%, transparent 60%)" }}
          />
          <div
            className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[60%] rounded-full opacity-20 blur-[120px]"
            style={{ background: "radial-gradient(ellipse at center, #3B82F6 0%, transparent 70%)" }}
          />
        </div>

        {/* Top bar com logo oficial */}
        <header className="relative z-10 px-6 pt-7 flex items-center justify-between">
          <img
            src="/squaad-logo.png"
            alt="+ que Vencedores"
            className="h-9 w-auto object-contain"
            draggable={false}
          />
          <span className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
            Salvador · 2026
          </span>
        </header>

        {/* Hero */}
        <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md w-full"
          >
            {/* Selo do evento */}
            <div className="inline-flex items-center gap-2 mb-7">
              <span className="h-px w-8 bg-[#3B82F6]/60" />
              <span className="text-[11px] uppercase tracking-[0.4em] text-[#3B82F6]">
                Reprograme-se 10X
              </span>
              <span className="h-px w-8 bg-[#3B82F6]/60" />
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-[2.6rem] font-bold tracking-tight leading-[1.05]">
              Descubra seu <span className="text-[#3B82F6]">perfil DISC</span>
              <br />
              e como a <span className="text-[#3B82F6]">IA</span> pode
              multiplicar seu negócio.
            </h1>

            {/* Subheadline em serif itálico premium */}
            <p
              className="mt-6 text-lg text-zinc-300/90 italic leading-relaxed"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Análise personalizada do seu Instagram cruzada com IA. Em 90 segundos.
            </p>

            {/* CTA */}
            <div className="mt-10">
              <Button
                size="lg"
                onClick={() => navigate("/r10x/disc")}
                className="group h-14 w-full rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6] hover:brightness-110 text-black font-semibold text-base shadow-[0_20px_50px_-10px_rgba(250,200,0,0.45)] transition-all"
              >
                Começar minha análise
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>

              {/* Indicadores discretos */}
              <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-zinc-500 uppercase tracking-[0.18em]">
                <span>90 segundos</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>100% gratuito</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>Sem cadastro</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer minimalista */}
        <footer className="relative z-10 px-6 pb-6 text-center">
          <p
            className="text-sm text-white/70 italic"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            "Eu sou próspero, capaz e abundante"
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-zinc-600">
            + que Vencedores · IA aplicada a negócios
          </p>
        </footer>
      </main>
    </>
  );
}
