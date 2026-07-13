import React from 'react';
import { CheckCircle2, Circle, AlertTriangle, Lightbulb, MessageSquare, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { CoachState, Playbook, CoachAlert } from '@/hooks/useSalesCoach';

interface CoachPanelProps {
  playbook: Playbook;
  state: CoachState;
  isActive: boolean;
  onAdvancePhase: () => void;
}

export const CoachPanel: React.FC<CoachPanelProps> = ({ playbook, state, isActive, onAdvancePhase }) => {
  if (!isActive) return null;

  const phases = playbook.phases;
  const currentPhaseIdx = phases.findIndex(p => p.id === state.currentPhase);
  const currentPhase = phases[currentPhaseIdx];
  const progress = ((currentPhaseIdx) / phases.length) * 100;

  const checklist = currentPhase?.checklist || [];
  const phaseChecklist = state.checklistStatus[state.currentPhase] || {};
  const completedCount = Object.values(phaseChecklist).filter(Boolean).length;
  const allCompleted = completedCount >= checklist.length && checklist.length > 0;

  const highAlerts = state.alerts.filter(a => a.severity === 'high');

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
      {/* Phase Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Fase atual</span>
          <span className="text-[10px] text-white/40">{currentPhaseIdx + 1}/{phases.length}</span>
        </div>
        <div className="flex gap-1 mb-2">
          {phases.map((phase, i) => (
            <div
              key={phase.id}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                i < currentPhaseIdx ? 'bg-green-500' :
                i === currentPhaseIdx ? 'bg-green-400 animate-pulse' :
                'bg-white/10'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold text-green-400">{currentPhase?.name || 'Abertura'}</span>
          {state.isAnalyzing && <Loader2 className="w-3 h-3 text-green-400 animate-spin" />}
        </div>
      </div>

      {/* Alerts */}
      {highAlerts.length > 0 && (
        <div className="space-y-1.5">
          {highAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Checklist */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Checklist</span>
          <span className="text-[10px] text-white/40">{completedCount}/{checklist.length}</span>
        </div>
        <Progress value={(completedCount / Math.max(checklist.length, 1)) * 100} className="h-1 mb-2 bg-white/10" />
        <div className="space-y-1">
          {checklist.map((item, i) => {
            const done = phaseChecklist[i] === true;
            return (
              <div key={i} className={`flex items-start gap-2 p-1.5 rounded text-xs transition-all ${done ? 'opacity-70' : ''}`}>
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
                )}
                <span className={`${done ? 'text-green-300 line-through' : 'text-white/80'}`}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advance Phase Button */}
      {allCompleted && currentPhaseIdx < phases.length - 1 && (
        <Button
          size="sm"
          onClick={onAdvancePhase}
          className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-xs"
        >
          Avançar para {phases[currentPhaseIdx + 1]?.name}
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      )}

      {/* Tips */}
      {state.tips.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Dicas</span>
          </div>
          <div className="space-y-1">
            {state.tips.slice(0, 3).map((tip, i) => (
              <div key={i} className="bg-yellow-500/5 border border-yellow-500/10 rounded p-2 text-xs text-yellow-200/80">
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Question */}
      {state.nextQuestion && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Próxima pergunta</span>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 text-xs text-blue-200 italic">
            "{state.nextQuestion}"
          </div>
        </div>
      )}
    </div>
  );
};

const AlertCard: React.FC<{ alert: CoachAlert }> = ({ alert }) => (
  <div className="bg-red-500/15 border border-red-500/30 rounded p-2 animate-pulse">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-xs text-red-300 font-medium">{alert.message}</p>
    </div>
  </div>
);
