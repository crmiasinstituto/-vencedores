import { FAIXA_INFO } from '@/maisvencedores/types/member';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Award } from 'lucide-react';
import type { RankingEntry } from '@/maisvencedores/hooks/useReferrals';
import { cn } from '@/lib/utils';

interface RankingLeaderboardProps {
  ranking: RankingEntry[];
  currentProfileId?: string;
}

export function RankingLeaderboard({ ranking, currentProfileId }: RankingLeaderboardProps) {
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
        <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-display text-lg font-semibold">Ranking de Indicações</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Seja o primeiro a aparecer no ranking! Comece a indicar novos membros.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-gold" />
        <h3 className="font-display text-lg font-semibold">Top Indicadores</h3>
      </div>

      <div className="space-y-3">
        {ranking.map((entry, idx) => {
          const faixaInfo = FAIXA_INFO[entry.profile.faixa];
          const isCurrentUser = entry.profile_id === currentProfileId;
          
          return (
            <div
              key={entry.profile_id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isCurrentUser ? 'bg-gold/10 border border-gold/30' : 'bg-background/50',
                idx === 0 && 'border-2 border-yellow-500/30'
              )}
            >
              <div className="w-8 flex justify-center">
                {getRankIcon(idx + 1)}
              </div>
              
              <Avatar className="h-10 w-10">
                <AvatarImage src={entry.profile.photo_url || undefined} />
                <AvatarFallback className={faixaInfo.fundo}>
                  <span className={faixaInfo.texto}>
                    {entry.profile.owner_name.charAt(0)}
                  </span>
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {entry.profile.owner_name}
                  {isCurrentUser && <span className="text-gold text-xs ml-2">(você)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {entry.profile.company_name}
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-gold">{entry.total_referrals}</p>
                <p className="text-xs text-muted-foreground">indicações</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
