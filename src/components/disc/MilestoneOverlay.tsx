import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Marcos celebratórios
const MILESTONES = [10, 15, 30, 45, 60, 80, 110, 145, 160, 200, 300] as const;

const COPY: Record<number, { word: string; sub: string }> = {
  10:  { word: "UAUUU!",        sub: "Já são 10 prósperos!" },
  15:  { word: "BOOORA!",       sub: "15 transformados!" },
  30:  { word: "FOGO!",         sub: "30 mentes em movimento" },
  45:  { word: "ESTÁ VOANDO!",  sub: "45 prósperos no mural" },
  60:  { word: "É TSUNAMI!",    sub: "60 conexões acesas" },
  80:  { word: "INACREDITÁVEL!", sub: "80 pessoas reprogramadas" },
  110: { word: "HISTÓRICO!",    sub: "110 prósperos juntos" },
  145: { word: "INSANO!",       sub: "145 transformações" },
  160: { word: "VIBRA FORTE!",  sub: "160 mentes prósperas" },
  200: { word: "MARCO 200!",    sub: "Salvador respirando IA" },
  300: { word: "LENDÁRIO!",     sub: "300 prósperos · histórico + que Vencedores" },
};

interface Props {
  count: number;
}

export function MilestoneOverlay({ count }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [lastTriggered, setLastTriggered] = useState<number>(0);

  useEffect(() => {
    const milestone = MILESTONES.find((m) => m === count);
    if (milestone && milestone > lastTriggered) {
      setActive(milestone);
      setLastTriggered(milestone);
      const t = setTimeout(() => setActive(null), 2800);
      return () => clearTimeout(t);
    }
  }, [count, lastTriggered]);

  if (active === null) return null;
  const data = COPY[active];

  return (
    <AnimatePresence>
      <motion.div
        key={active}
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.35 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        {/* Confetti dourado caindo do banner */}
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
            animate={{
              x: (Math.random() - 0.5) * 600,
              y: 200 + Math.random() * 400,
              opacity: 0,
              rotate: Math.random() * 540,
              scale: 1,
            }}
            transition={{ duration: 1.8 + Math.random() * 1.0, ease: "easeOut" }}
            className="absolute left-1/2 top-full"
            style={{
              width: 10,
              height: 10,
              background: i % 3 === 0 ? "#3B82F6" : i % 3 === 1 ? "#FFFFFF" : "#FFB800",
              borderRadius: i % 2 === 0 ? "50%" : "2px",
              boxShadow: "0 0 8px rgba(250,200,0,0.6)",
            }}
          />
        ))}

        {/* Banner compacto horizontal */}
        <motion.div
          initial={{ scale: 0.7 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.85 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
          className="relative flex items-center gap-5 px-8 py-4 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(250,200,0,0.18), rgba(0,0,0,0.85))",
            border: "1px solid rgba(250,200,0,0.55)",
            boxShadow:
              "0 0 0 1px rgba(250,200,0,0.18), 0 20px 60px rgba(250,200,0,0.30), 0 0 80px rgba(250,200,0,0.25)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="text-7xl font-black leading-none tracking-tighter text-white"
            style={{ textShadow: "0 0 28px rgba(250,200,0,0.6)" }}
          >
            {active}
          </div>
          <div className="text-left">
            <p
              className="text-3xl font-black text-[#3B82F6] leading-tight tracking-tight"
              style={{ textShadow: "0 0 12px rgba(250,200,0,0.45)" }}
            >
              {data.word}
            </p>
            <p className="text-sm text-white/85 tracking-wide mt-1">
              {data.sub}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
