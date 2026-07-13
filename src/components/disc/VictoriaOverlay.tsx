import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";

interface Props {
  active: boolean;
}

export function VictoriaOverlay({ active }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          {/* Backdrop com gradient rosa/dourado */}
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(244,114,182,0.25), transparent 50%), radial-gradient(circle at 70% 70%, rgba(250,200,0,0.18), transparent 50%)",
            }}
          />

          {/* Corações flutuantes */}
          {Array.from({ length: 28 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: (Math.random() - 0.5) * 800,
                y: 600,
                opacity: 0,
                scale: 0.3 + Math.random() * 0.8,
                rotate: (Math.random() - 0.5) * 60,
              }}
              animate={{
                y: -800,
                opacity: [0, 1, 1, 0],
                rotate: (Math.random() - 0.5) * 120,
              }}
              transition={{
                duration: 6 + Math.random() * 3,
                delay: i * 0.18,
                ease: "easeOut",
              }}
              className="absolute"
            >
              <Heart
                className="text-pink-400 fill-pink-400"
                style={{
                  width: 24 + Math.random() * 30,
                  height: 24 + Math.random() * 30,
                  filter: "drop-shadow(0 0 16px rgba(244,114,182,0.65))",
                }}
              />
            </motion.div>
          ))}

          {/* Conteúdo central */}
          <motion.div
            initial={{ scale: 0.5, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: -20 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.2 }}
            className="relative text-center px-12"
          >
            <Heart
              className="mx-auto mb-6 text-pink-400 fill-pink-400"
              style={{
                width: 80,
                height: 80,
                filter: "drop-shadow(0 0 40px rgba(244,114,182,0.7))",
              }}
            />
            <p className="text-[10px] uppercase tracking-[0.5em] text-pink-300/70 mb-4 font-medium">
              Uma mensagem especial
            </p>
            <h1
              className="text-7xl md:text-8xl font-black leading-tight tracking-tight text-white"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontStyle: "italic",
                textShadow: "0 0 60px rgba(244,114,182,0.45)",
              }}
            >
              Te amo,
              <br />
              meu <span className="text-pink-300">Amor.</span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-8 text-lg text-white/70 tracking-wide"
            >
              · Carlos ·
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
