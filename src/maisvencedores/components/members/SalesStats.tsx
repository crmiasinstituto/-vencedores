import { TrendingUp, Target, Trophy, Handshake } from 'lucide-react';
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

  // "Contribuição 5%" saiu a pedido do Carlos: o ecossistema trabalha só com pontuação por
  // ora, não com repasse de venda. Os outros são celebração do que a rede gerou, não meta.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        title="Valor gerado pela rede"
        value={formatCurrency(stats.totalSales)}
        icon={TrendingUp}
        iconColor="text-primary"
      />
      <StatCard
        title="Negócios registrados"
        value={stats.totalDeals.toString()}
        icon={Handshake}
        iconColor="text-primary"
      />
      <StatCard
        title="Posição no ranking"
        value={rankPosition ? `#${rankPosition}` : '-'}
        icon={Trophy}
        iconColor="text-amber-500"
      />
    </div>
  );
}
