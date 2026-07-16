import { Trophy, Medal, Award, Star, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FAIXA_INFO } from '@/maisvencedores/types/member';
import { cn } from '@/lib/utils';
import type { SalesRankingEntry } from '@/maisvencedores/hooks/useSalesRanking';

interface SalesLeaderboardProps {
  ranking: SalesRankingEntry[];
  currentProfileId?: string;
}

export function SalesLeaderboard({ ranking, currentProfileId }: SalesLeaderboardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{position}</span>;
    }
  };

  if (ranking.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display text-lg font-semibold">Ranking de Vendas</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Seja o primeiro! Declare suas vendas e apareça no ranking.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-500" />
        <h3 className="font-display text-lg font-semibold">Top Vendedores</h3>
      </div>

      <div className="space-y-3">
        {ranking.map((entry, idx) => {
          const faixaInfo = FAIXA_INFO[entry.profile?.faixa || 'branco'];
          const isCurrentUser = entry.profile_id === currentProfileId;
          
          return (
            <div
              key={entry.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isCurrentUser ? 'bg-green-500/10 border border-green-500/30' : 'bg-background/50',
                idx === 0 && 'border-2 border-yellow-500/30'
              )}
            >
              <div className="w-8 flex justify-center">
                {getRankIcon(idx + 1)}
              </div>
              
              <Avatar className="h-10 w-10">
                <AvatarImage src={entry.profile?.photo_url || undefined} />
                <AvatarFallback className={faixaInfo.fundo}>
                  <span className={faixaInfo.texto}>
                    {entry.profile?.owner_name?.charAt(0) || 'M'}
                  </span>
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {entry.profile?.owner_name || 'Membro'}
                  </p>
                  {isCurrentUser && <span className="text-green-500 text-xs">(você)</span>}
                  {entry.eligible_for_spotlight && (
                    <Star className="w-4 h-4 text-gold" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {entry.profile?.company_name || ''} • {entry.total_deals} negócios
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-green-500">{formatCurrency(Number(entry.total_sales))}</p>
                {entry.contribution_amount > 0 && (
                  <p className="text-xs text-gold">
                    5%: {formatCurrency(Number(entry.contribution_amount))}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
