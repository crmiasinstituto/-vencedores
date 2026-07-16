import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, Crown, Plane, Globe, GraduationCap } from 'lucide-react';
import { ANNUAL_RANKING_PRIZES } from '@/maisvencedores/lib/netweaving';
import { cn } from '@/lib/utils';

interface AnnualRankingEntry {
  profile_id: string;
  owner_name: string;
  company_name: string | null;
  photo_url: string | null;
  points: number;
  rank_position: number;
}

interface AnnualRankingProps {
  currentProfileId?: string;
}

const prizeIcon: Record<number, JSX.Element> = {
  1: <Crown className="w-4 h-4 text-yellow-500" />,
  2: <Globe className="w-4 h-4 text-gray-400" />,
  3: <GraduationCap className="w-4 h-4 text-amber-600" />,
};

export function AnnualRanking({ currentProfileId }: AnnualRankingProps) {
  const [entries, setEntries] = useState<AnnualRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('nw_annual_ranking', { p_limit: 10 });
      if (!error && data) {
        setEntries(data as unknown as AnnualRankingEntry[]);
      }
      setLoading(false);
    })();
  }, []);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return (
          <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">
            {position}
          </span>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-gold" />
          Ranking Anual
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          No fim do ciclo, os primeiros colocados levam prêmios exclusivos do Instituto Isaac Santos.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prêmios top 3 */}
        <div className="grid gap-3 sm:grid-cols-3">
          {ANNUAL_RANKING_PRIZES.sort((a, b) => a.position - b.position).map((prize) => (
            <div
              key={prize.position}
              className="rounded-lg border border-gold/20 bg-gold/5 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 font-semibold text-foreground">
                {prizeIcon[prize.position]}
                {prize.label}
              </div>
              <ul className="space-y-1">
                {prize.perks.map((perk) => (
                  <li key={perk} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-gold mt-0.5">•</span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Lista do ranking */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando ranking…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            O ranking anual ainda não tem pontuações. Comece a indicar para aparecer aqui!
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const isCurrentUser = entry.profile_id === currentProfileId;
              return (
                <div
                  key={entry.profile_id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg transition-colors',
                    isCurrentUser ? 'bg-gold/10 border border-gold/30' : 'bg-background/50'
                  )}
                >
                  <div className="w-8 flex justify-center">{getRankIcon(entry.rank_position)}</div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={entry.photo_url || undefined} />
                    <AvatarFallback>{(entry.owner_name || '?').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {entry.owner_name}
                      {isCurrentUser && <span className="text-gold text-xs ml-2">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{entry.company_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gold">{entry.points}</p>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
