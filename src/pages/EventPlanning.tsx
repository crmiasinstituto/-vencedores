import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { EventPhase1 } from "@/components/event/EventPhase1";
import { EventPhase2 } from "@/components/event/EventPhase2";
import { EventPhase3 } from "@/components/event/EventPhase3";
import { PlaybookPreview } from "@/components/event/PlaybookPreview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const initialPhase1 = {
  eventConfig: { name: '', type: '', customType: '' },
  identity: { 
    professionalStatus: [],
    customProfessionalStatus: '',
    incomeRange: [],
    extraIncomeExperience: [],
    mainGoal: [],
    customMainGoal: '',
    timeAvailability: [],
    age: [],
    profile: [],
    customProfile: '',
    keyQuestion: '' 
  },
  pains: { selected: [], customPain: '', frustration: '' },
  desires: { selected: [], customDesire: '', singleChange: '' },
  objections: { selected: [], customObjection: '', whyNotBuy: '' }
};

const initialPhase2 = {
  transformation: { target: '', goal: '', without: '' },
  differential: { whatWontHave: '', uniqueDelivery: '', uniqueExperience: '' }
};

const initialPhase3 = {
  belief: '',
  enemy: [],
  customEnemy: '',
  language: ['', '', '', '', ''],
  ritual: { selected: [], custom: '' },
  founders: [
    { name: '', archetype: '', expertise: '', bio: '' },
    { name: '', archetype: '', expertise: '', bio: '' },
    { name: '', archetype: '', expertise: '', bio: '' },
    { name: '', archetype: '', expertise: '', bio: '' }
  ]
};

export default function EventPlanning() {
  const [currentPhase, setCurrentPhase] = useState(1);
  const [phase1Data, setPhase1Data] = useState(initialPhase1);
  const [phase2Data, setPhase2Data] = useState(initialPhase2);
  const [phase3Data, setPhase3Data] = useState(initialPhase3);
  const [playbook, setPlaybook] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const totalPhases = 4;
  const progress = (currentPhase / totalPhases) * 100;

  useEffect(() => {
    const saved = localStorage.getItem('event_planning_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if data has new structure, otherwise reset
        if (parsed.phase1?.eventConfig) {
          setPhase1Data({ ...initialPhase1, ...parsed.phase1 });
        }
        if (parsed.phase2) setPhase2Data({ ...initialPhase2, ...parsed.phase2 });
        if (parsed.phase3) setPhase3Data({ ...initialPhase3, ...parsed.phase3 });
        if (parsed.currentPhase) setCurrentPhase(parsed.currentPhase);
      } catch (e) { 
        console.error(e);
        localStorage.removeItem('event_planning_data');
      }
    }
  }, []);

  useEffect(() => {
    const data = { phase1: phase1Data, phase2: phase2Data, phase3: phase3Data, currentPhase };
    localStorage.setItem('event_planning_data', JSON.stringify(data));
  }, [phase1Data, phase2Data, phase3Data, currentPhase]);

  const generatePlaybook = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-event-playbook', {
        body: { phase1: phase1Data, phase2: phase2Data, phase3: phase3Data }
      });
      if (error) throw error;
      setPlaybook(data.playbook);
      toast.success("Playbook gerado com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao gerar playbook: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const phaseNames = ["Definição de ICP", "Posicionamento", "Primal Branding", "Playbook"];

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 pointer-events-none" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Planejamento de <span className="text-primary">Evento Presencial</span>
          </h1>
          <p className="text-muted-foreground">Complete todas as fases para gerar seu Playbook estratégico</p>
        </motion.div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {phaseNames.map((name, index) => (
              <button
                key={index}
                onClick={() => setCurrentPhase(index + 1)}
                className={`text-xs md:text-sm font-medium transition-colors ${
                  currentPhase === index + 1 ? 'text-primary' : 
                  currentPhase > index + 1 ? 'text-primary/60' : 'text-muted-foreground'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <motion.div key={currentPhase} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          {currentPhase === 1 && <EventPhase1 data={phase1Data} onChange={setPhase1Data} />}
          {currentPhase === 2 && <EventPhase2 data={phase2Data} onChange={setPhase2Data} />}
          {currentPhase === 3 && <EventPhase3 data={phase3Data} onChange={setPhase3Data} />}
          {currentPhase === 4 && (
            <PlaybookPreview 
              playbook={playbook} 
              isLoading={isGenerating} 
              onGenerate={generatePlaybook}
              eventData={phase3Data}
            />
          )}
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-border/50">
          <Button
            variant="outline"
            onClick={() => setCurrentPhase(p => Math.max(1, p - 1))}
            disabled={currentPhase === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
          </Button>

          {currentPhase < 4 ? (
            <Button onClick={() => setCurrentPhase(p => p + 1)} className="bg-primary text-primary-foreground">
              Próximo <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : !playbook && (
            <Button onClick={generatePlaybook} disabled={isGenerating} className="bg-primary text-primary-foreground">
              <Sparkles className="w-4 h-4 mr-2" /> Gerar Playbook
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
