import React from 'react';
import { Brain } from 'lucide-react';

interface Props {
  discProfile?: string | null;
  discScores?: Record<string, number> | null;
}

const DISC_COLORS: Record<string, { hex: string; bg: string; border: string; text: string }> = {
  D: { hex: '#EF4444', bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400' },
  I: { hex: '#F59E0B', bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400' },
  S: { hex: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  C: { hex: '#3B82F6', bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400' },
};

const DISC_LABELS: Record<string, string> = {
  D: 'Dominante',
  I: 'Influente',
  S: 'Estável',
  C: 'Cauteloso',
};

const DISC_INSIGHTS: Record<string, string> = {
  D: 'Pessoas dominantes que atuam em alta exigência costumam travar em delegar tarefas repetitivas. A IA assume esses gargalos e libera pra decisão estratégica.',
  I: 'Influentes brilham em conexão, mas perdem horas em conversas que não convertem. Agentes de IA filtram lead, qualificam no automático e só entregam quem está pronto.',
  S: 'Estáveis valorizam processo. O risco é morrer na consistência sem escalar. A IA mantém a qualidade do atendimento idêntica 24/7.',
  C: 'Cautelosos exigem dados pra agir. A IA cruza informações que o humano não consegue e entrega o relatório pronto. Decisão mais rápida sem perder rigor.',
};

function dominantLetter(profile: string): string {
  return (profile.split('-')[0] || profile).toUpperCase();
}

function formatProfileLabel(profile: string): string {
  if (profile.toLowerCase() === 'equilibrado') return 'Equilibrado';
  if (profile.includes('-')) {
    const [a, b] = profile.split('-').map((s) => s.toUpperCase());
    return `${DISC_LABELS[a] || a} · ${DISC_LABELS[b] || b}`;
  }
  return DISC_LABELS[profile.toUpperCase()] || profile;
}

export const DiscProfileCard: React.FC<Props> = ({ discProfile, discScores }) => {
  if (!discProfile) return null;

  const letter = dominantLetter(discProfile);
  const palette = DISC_COLORS[letter] || DISC_COLORS.D;
  const label = formatProfileLabel(discProfile);
  const insight = DISC_INSIGHTS[letter] || DISC_INSIGHTS.D;

  const scoresArr: Array<{ key: 'D' | 'I' | 'S' | 'C'; value: number }> = (['D', 'I', 'S', 'C'] as const).map(
    (k) => ({ key: k, value: Number(discScores?.[k] ?? 0) })
  );
  const maxScore = Math.max(1, ...scoresArr.map((s) => s.value));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Brain className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-semibold">Perfil DISC</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0"
          style={{
            background: palette.hex,
            boxShadow: `0 10px 24px ${palette.hex}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          {letter}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
            {discProfile}
          </p>
        </div>
      </div>

      {discScores && (
        <div className="space-y-1.5 mb-4">
          {scoresArr.map(({ key, value }) => {
            const c = DISC_COLORS[key];
            const pct = (value / maxScore) * 100;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className={`text-[11px] font-bold w-3 ${c.text}`}>{key}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: c.hex }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground w-4 text-right tabular-nums">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className={`rounded-lg border ${palette.border} ${palette.bg} p-2.5`}>
        <p className={`text-[10px] uppercase tracking-[0.2em] font-medium mb-1 ${palette.text}`}>
          DISC × IA × Negócio
        </p>
        <p className="text-[11px] leading-relaxed text-foreground/90">{insight}</p>
      </div>
    </div>
  );
};
