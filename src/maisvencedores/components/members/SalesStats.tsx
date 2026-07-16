import { TrendingUp, Target, Percent, Trophy, Star } from 'lucide-react';
import { StatCard } from '@/maisvencedores/components/shared/StatCard';
import type { SalesStats as SalesStatsType } from '@/maisvencedores/hooks/useSalesRanking';

interface SalesStatsProps {
  stats: SalesStatsType;
  rankPosition: number | null;
}

export function SalesStats({ stats, rankPosition }: SalesStatsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        title="Total Vendido"
        value={formatCurrency(stats.totalSales)}
        icon={TrendingUp}
        iconColor="text-green-500"
      />
      <StatCard
        title="Negócios Fechados"
        value={stats.totalDeals.toString()}
        icon={Target}
        iconColor="text-blue-500"
      />
      <StatCard
        title="Contribuição 5%"
        value={formatCurrency(stats.contributionAmount)}
        icon={Percent}
        iconColor="text-gold"
        description={stats.eligibleForSpotlight ? "Meta batida!" : "Após bater meta"}
      />
      <StatCard
        title="Posição Ranking"
        value={rankPosition ? `#${rankPosition}` : '-'}
        icon={Trophy}
        iconColor="text-amber-500"
        description={stats.eligibleForSpotlight ? (
          <span className="flex items-center gap-1 text-gold">
            <Star className="w-3 h-3" /> Elegível
          </span>
        ) : undefined}
      />
    </div>
  );
}
