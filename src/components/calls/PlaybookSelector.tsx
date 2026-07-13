import React from 'react';
import { BookOpen, Check } from 'lucide-react';
import type { Playbook } from '@/hooks/useSalesCoach';

interface PlaybookSelectorProps {
  playbooks: Playbook[];
  selected: Playbook | null;
  onSelect: (playbook: Playbook) => void;
}

export const PlaybookSelector: React.FC<PlaybookSelectorProps> = ({ playbooks, selected, onSelect }) => {
  if (playbooks.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-green-400" />
        <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Playbook</span>
      </div>
      <div className="space-y-1">
        {playbooks.map(pb => (
          <button
            key={pb.id}
            onClick={() => onSelect(pb)}
            className={`w-full text-left p-2 rounded text-xs transition-all flex items-center gap-2 ${
              selected?.id === pb.id
                ? 'bg-green-500/15 border border-green-500/30 text-green-300'
                : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {selected?.id === pb.id && <Check className="w-3 h-3 text-green-400 shrink-0" />}
            <div className="min-w-0">
              <p className="font-medium truncate">{pb.name}</p>
              {pb.description && <p className="text-[10px] text-white/40 truncate">{pb.description}</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
