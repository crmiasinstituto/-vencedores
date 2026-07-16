import { Progress } from '@/components/ui/progress';
import { Trophy, Sparkles, Gift, Check } from 'lucide-react';
import { REWARD_TIERS, getRewardProgress } from '@/maisvencedores/lib/netweaving';
import { cn } from '@/lib/utils';

interface RewardsProgressProps {
  seasonPoints: number;
  lifetimePoints: number;
  tierLabel?: string | null;
}

export function RewardsProgress({ seasonPoints, lifetimePoints, tierLabel }: RewardsProgressProps) {
  const { nextTier, percentage, remaining } = getRewardProgress(seasonPoints);

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      {/* Pontos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Pontos da temporada</span>
          </div>
          <p className="text-3xl font-bold text-primary">{seasonPoints}</p>
        </div>
        <div className="rounded-lg bg-muted/40 border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Pontos vitalícios</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{lifetimePoints}</p>
        </div>
      </div>

      {tierLabel && (
        <div className="flex items-center gap-2 text-sm">
          <Gift className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">Nível atual:</span>
          <span className="font-semibold text-foreground">{tierLabel}</span>
        </div>
      )}

      {/* Progresso para próxima recompensa */}
      {nextTier ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Próxima recompensa</span>
            <span className="font-semibold text-foreground">
              {seasonPoints} / {nextTier.points} pts
            </span>
          </div>
          <Progress value={percentage} className="h-3" />
          <p className="text-xs text-muted-foreground">
            Faltam <span className="font-semibold text-primary">{remaining} pontos</span> para:{' '}
            {nextTier.title}
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-center text-sm text-primary font-medium">
          Você atingiu o nível máximo de recompensas da temporada!
        </div>
      )}

      {/* Escada de recompensas */}
      <div className="space-y-2 pt-2 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Recompensas por pontos
        </p>
        {REWARD_TIERS.map((tier) => {
          const reached = seasonPoints >= tier.points;
          return (
            <div
              key={tier.points}
              className={cn(
                'flex items-start gap-3 rounded-lg p-2.5 text-sm',
                reached ? 'bg-primary/10 border border-primary/20' : 'bg-background/50'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold',
                  reached ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {reached ? <Check className="w-3.5 h-3.5" /> : tier.points}
              </div>
              <div>
                <p className={cn('font-medium', reached ? 'text-foreground' : 'text-muted-foreground')}>
                  {tier.points} pts
                </p>
                <p className="text-xs text-muted-foreground">{tier.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
