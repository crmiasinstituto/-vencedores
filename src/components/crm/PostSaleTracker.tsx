import React from 'react';
import { CheckCircle } from 'lucide-react';

const POST_SALE_STAGES = [
  { value: 'awaiting_onboarding', label: 'Aguardando Onboarding' },
  { value: 'in_onboarding', label: 'Em Onboarding' },
  { value: 'complete', label: 'Onboarding Completo' },
  { value: '30day_followup', label: 'Follow-up 30 dias' },
  { value: 'active_client', label: 'Cliente Ativo' },
];

interface PostSaleTrackerProps {
  currentStage: string | null;
  onStageChange: (stage: string) => void;
}

export const PostSaleTracker: React.FC<PostSaleTrackerProps> = ({
  currentStage,
  onStageChange,
}) => {
  return (
    <div className="mt-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <h4 className="text-sm font-semibold text-green-400">Pos-Venda</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {POST_SALE_STAGES.map((stage) => (
          <button
            key={stage.value}
            onClick={() => onStageChange(stage.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentStage === stage.value
                ? 'bg-green-600 text-white'
                : 'bg-background border border-border text-muted-foreground hover:border-green-500/50'
            }`}
          >
            {stage.label}
          </button>
        ))}
      </div>
    </div>
  );
};
