import { Progress } from '@/components/ui/progress';
import { Star, PartyPopper, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SalesStats } from '@/maisvencedores/hooks/useSalesRanking';

interface SalesProgressProps {
  stats: SalesStats;
}

export function SalesProgress({ stats }: SalesProgressProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const progressCapped = Math.min(stats.progressPercentage, 100);
  const exceededGoal = stats.totalSales > stats.investmentAmount;
  const excessAmount = exceededGoal ? stats.totalSales - stats.investmentAmount : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Meta de Vendas</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          Meta: {formatCurrency(stats.investmentAmount)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className={cn(
            "font-semibold",
            exceededGoal ? "text-green-500" : "text-foreground"
          )}>
            {stats.progressPercentage.toFixed(0)}%
          </span>
        </div>
        <Progress 
          value={progressCapped} 
          className={cn(
            "h-3",
            exceededGoal && "[&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-gold"
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(stats.totalSales)}</span>
          <span>{formatCurrency(stats.investmentAmount)}</span>
        </div>
      </div>

      {exceededGoal && (
        <div className="bg-gradient-to-r from-gold/10 to-green-500/10 border border-gold/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-gold" />
            <span className="font-semibold text-gold">Parabéns! Você bateu a meta!</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Excedente</p>
              <p className="font-semibold text-green-500">{formatCurrency(excessAmount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contribuição 5%</p>
              <p className="font-semibold text-gold">{formatCurrency(stats.contributionAmount)}</p>
            </div>
          </div>

          {stats.eligibleForSpotlight && (
            <div className="flex items-center gap-2 pt-2 border-t border-gold/20">
              <Star className="w-4 h-4 text-gold" />
              <span className="text-sm">
                <span className="font-medium text-gold">Elegível para inserção</span>
                <span className="text-muted-foreground"> no evento semanal do + que Vencedores!</span>
              </span>
            </div>
          )}
        </div>
      )}

      {!exceededGoal && (
        <div className="text-sm text-muted-foreground text-center pt-2">
          Faltam <span className="font-semibold text-foreground">{formatCurrency(stats.investmentAmount - stats.totalSales)}</span> para bater a meta e ganhar a inserção no evento semanal!
        </div>
      )}
    </div>
  );
}
