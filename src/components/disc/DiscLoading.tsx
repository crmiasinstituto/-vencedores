import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESSAGES = [
  "Lendo sua bio...",
  "Analisando seus posts...",
  "Cruzando com IA...",
  "Identificando seu nicho...",
  "Montando seu diagnóstico...",
];

interface Props {
  onTimeout?: () => void;
}

export function DiscLoading({ onTimeout }: Props = {}) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 1800);
    const sec = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { clearInterval(t); clearInterval(sec); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#3B82F6]/30 flex items-center justify-center mb-6 shadow-lg shadow-[#3B82F6]/30"
      >
        <Sparkles className="h-8 w-8 text-black" />
      </motion.div>

      <h3 className="text-xl font-semibold text-white">
        Analisando seu Instagram com IA
      </h3>

      <div className="h-6 mt-3 relative w-full max-w-xs overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-zinc-400 absolute inset-0"
          >
            {MESSAGES[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]"
          />
        ))}
      </div>

      {/* Tempo decorrido + opção de reset se demorar muito */}
      <p className="mt-5 text-[11px] text-zinc-600 tracking-wider tabular-nums">
        {elapsed}s
      </p>
      {elapsed >= 35 && onTimeout && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-col items-center"
        >
          <p className="text-xs text-zinc-500 mb-2 text-center max-w-xs">
            Tá demorando mais que o normal. Quer tentar de novo?
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onTimeout}
            className="border-zinc-700 text-zinc-300"
          >
            Voltar e tentar novamente
          </Button>
        </motion.div>
      )}
    </div>
  );
}
