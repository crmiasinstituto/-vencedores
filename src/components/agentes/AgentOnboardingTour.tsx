import { useState, useEffect } from 'react';
import { X, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const TOUR_KEY = 'agentes_tour_completed';

const STEPS = [
  {
    title: '📋 Lista de Agentes',
    description: 'Aqui ficam todos os seus agentes IA. Clique em "+" para criar um novo ou selecione um existente para editar.',
    selector: '[data-tour="agent-list"]',
    position: 'right' as const,
  },
  {
    title: '🤖 Aba Geral',
    description: 'Defina o nome, persona, habilidades e provedor de IA. A API Key OpenAI é preenchida automaticamente!',
    selector: '[data-tour="tab-geral"]',
    position: 'bottom' as const,
  },
  {
    title: '📝 Aba Prompt',
    description: 'Veja o prompt composto automaticamente a partir da Persona, Habilidades e Restrições que você definiu na aba Geral.',
    selector: '[data-tour="tab-prompt"]',
    position: 'bottom' as const,
  },
  {
    title: '📚 Knowledge',
    description: 'Adicione bases de conhecimento (textos, URLs, PDFs) para o agente consultar durante as conversas.',
    selector: '[data-tour="tab-knowledge"]',
    position: 'bottom' as const,
  },
  {
    title: '⚡ Triggers',
    description: 'Configure gatilhos por palavras-chave ou entrada em colunas do Kanban para ativar o agente automaticamente.',
    selector: '[data-tour="tab-triggers"]',
    position: 'bottom' as const,
  },
  {
    title: '🔄 Cadência',
    description: 'Defina follow-ups automáticos e lembretes de reunião que o agente envia quando o lead não responde.',
    selector: '[data-tour="tab-cadencia"]',
    position: 'bottom' as const,
  },
];

export function AgentOnboardingTour() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const finish = () => {
    setShow(false);
    localStorage.setItem(TOUR_KEY, 'true');
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  if (!show) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[99]" onClick={finish} />
      
      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[100] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] bg-card border border-border rounded-xl shadow-2xl p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">{current.title}</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1" onClick={finish}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {current.description}
          </p>

          {/* Progress */}
          <div className="flex gap-1 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={finish}>
              <SkipForward className="w-3 h-3 mr-1" /> Pular tour
            </Button>
            <Button size="sm" className="text-xs gap-1" onClick={next}>
              {step < STEPS.length - 1 ? (
                <>Próximo <ChevronRight className="w-3 h-3" /></>
              ) : (
                'Concluir ✓'
              )}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {step + 1} de {STEPS.length}
          </p>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
