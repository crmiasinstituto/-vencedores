import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

export type Dim = "D" | "I" | "S" | "C";

interface Question {
  prompt: string;
  options: { dim: Dim; label: string }[];
}

const QUESTIONS: Question[] = [
  {
    prompt: "Quando entro em uma reuniao nova, geralmente eu...",
    options: [
      { dim: "D", label: "Ja chego direto ao ponto, quero resultado" },
      { dim: "I", label: "Puxo conversa, conecto rapido com a galera" },
      { dim: "S", label: "Observo primeiro, escuto antes de falar" },
      { dim: "C", label: "Anoto detalhes, quero entender o contexto" },
    ],
  },
  {
    prompt: "Sob pressao, minha tendencia e...",
    options: [
      { dim: "D", label: "Acelerar e tomar decisao rapida" },
      { dim: "I", label: "Buscar apoio do time, conversar" },
      { dim: "S", label: "Manter a calma e seguir o plano" },
      { dim: "C", label: "Reanalisar os dados antes de agir" },
    ],
  },
  {
    prompt: "O que mais me motiva no trabalho e...",
    options: [
      { dim: "D", label: "Bater meta, ganhar, conquistar" },
      { dim: "I", label: "Reconhecimento, conexao com pessoas" },
      { dim: "S", label: "Estabilidade, time harmonioso" },
      { dim: "C", label: "Qualidade tecnica, fazer certo" },
    ],
  },
  {
    prompt: "Meu maior incomodo e quando...",
    options: [
      { dim: "D", label: "Perco tempo com burocracia" },
      { dim: "I", label: "Sinto que nao estao me ouvindo" },
      { dim: "S", label: "Mudam tudo de uma vez sem aviso" },
      { dim: "C", label: "Tomam decisao sem dados" },
    ],
  },
];

interface Props {
  onComplete: (answers: Dim[]) => void;
}

export function DiscQuiz({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Dim[]>([]);

  function select(dim: Dim) {
    const next = [...answers, dim];
    setAnswers(next);
    if (step === QUESTIONS.length - 1) {
      onComplete(next);
    } else {
      setStep(step + 1);
    }
  }

  const q = QUESTIONS[step];
  const pct = Math.round(((step + 1) / QUESTIONS.length) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-gray-500 font-medium">Pergunta {step + 1} de {QUESTIONS.length}</span>
        <span className="text-amber-700 font-bold">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-6">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#E8A900] rounded-full"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-5 leading-snug">
            {q.prompt}
          </h3>
          <div className="space-y-2.5">
            {q.options.map((opt) => (
              <button
                key={opt.dim}
                onClick={() => select(opt.dim)}
                className="w-full text-left px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-[#3B82F6]/60 text-gray-800 text-sm transition-all flex items-center justify-between group"
              >
                <span className="font-medium">{opt.label}</span>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#3B82F6] transition-colors" />
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
