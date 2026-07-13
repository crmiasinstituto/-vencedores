import React from 'react';
import { ReactionBurst } from '@/hooks/useMeetSignals';

interface Props {
  bursts: ReactionBurst[];
}

// Posiciona cada burst em uma coluna semi-aleatoria estavel (deriva do id)
function colFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // 8 colunas distribuidas entre 30%-90% (canto direito-meio da tela)
  return 30 + (h % 8) * (60 / 7);
}

export default function ReactionBurstOverlay({ bursts }: Props) {
  if (bursts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      {bursts.map((b) => (
        <div
          key={b.id}
          className="absolute bottom-[12%] flex flex-col items-center"
          style={{ left: `${colFromId(b.id)}%`, animation: 'reactionRise 3.6s ease-out forwards' }}
        >
          <span className="text-7xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">{b.emoji}</span>
          <span className="mt-1 text-xs font-semibold text-white bg-black/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full whitespace-nowrap">
            {b.fromName}
          </span>
        </div>
      ))}
      <style>{`
        @keyframes reactionRise {
          0%   { transform: translateY(0)    scale(0.7); opacity: 0; }
          8%   { transform: translateY(-4vh)  scale(1.25); opacity: 1; }
          75%  { transform: translateY(-52vh) scale(1);   opacity: 1; }
          100% { transform: translateY(-72vh) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
