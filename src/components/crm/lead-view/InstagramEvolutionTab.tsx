import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, TrendingDown, Minus, Activity, Heart, MessageCircle, RefreshCw, Loader2, Instagram as InstagramIcon, ExternalLink, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Snapshot {
  id: string;
  scraped_at: string;
  username: string;
  full_name: string | null;
  biography: string | null;
  category: string | null;
  external_url: string | null;
  profile_pic_url: string | null;
  followers: number;
  following: number;
  posts_count: number;
  is_verified: boolean;
  is_business: boolean;
  engagement_rate: number | null;
  posts_last_30d: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  top_hashtags: string[] | null;
}

interface InstagramEvolutionTabProps {
  leadId: string;
  leadInstagram?: string;
}

function Delta({ current, previous }: { current: number; previous?: number | null }) {
  if (previous == null) return <span className="text-[10px] text-muted-foreground">novo</span>;
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
        <Minus className="w-2.5 h-2.5" /> sem alteração
      </span>
    );
  }
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  const color = diff > 0 ? 'text-green-400' : 'text-red-400';
  const sign = diff > 0 ? '+' : '';
  return (
    <span className={`text-[10px] flex items-center gap-0.5 ${color}`}>
      <Icon className="w-2.5 h-2.5" />
      {sign}{diff.toLocaleString('pt-BR')}
    </span>
  );
}

function Stat({
  label, value, previous, format: fmt,
}: { label: string; value: number; previous?: number | null; format?: (n: number) => string }) {
  const display = fmt ? fmt(value) : value.toLocaleString('pt-BR');
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold">{display}</p>
      <Delta current={value} previous={previous} />
    </div>
  );
}

export const InstagramEvolutionTab: React.FC<InstagramEvolutionTabProps> = ({
  leadId, leadInstagram,
}) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
  }, [leadId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('instagram_snapshots')
      .select('*')
      .eq('lead_id', leadId)
      .order('scraped_at', { ascending: false })
      .limit(20);
    setSnapshots((data || []) as any);
    setLoading(false);
  }

  async function forceSnapshot() {
    if (!leadInstagram) {
      toast.error('Lead sem @ Instagram');
      return;
    }
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-snapshot-cron', {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (data?.inserted > 0) {
        toast.success('Snapshot atualizado');
        await load();
      } else if (data?.errors?.length > 0) {
        toast.error(`Falha: ${data.errors[0].error}`);
      } else {
        toast.info('Nenhum snapshot novo');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leadInstagram) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <InstagramIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium mb-1">Sem Instagram cadastrado</p>
        <p className="text-xs text-muted-foreground">
          Adicione o @ do lead na aba <strong>Dados</strong> para começar a rastrear evolução.
        </p>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <InstagramIcon className="w-10 h-10 text-muted-foreground mx-auto" />
        <div>
          <p className="text-sm font-medium mb-1">@{leadInstagram} ainda não foi capturado</p>
          <p className="text-xs text-muted-foreground">
            O cron semanal roda toda madrugada de domingo. Para forçar agora:
          </p>
        </div>
        <Button onClick={forceSnapshot} disabled={refreshing} size="sm" className="gap-2">
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Capturar snapshot agora
        </Button>
      </div>
    );
  }

  const current = snapshots[0];
  const previous = snapshots[1] || null;
  const engagementPct = ((current.engagement_rate || 0) * 100).toFixed(2);
  const prevEngagementPct = previous ? Number(((previous.engagement_rate || 0) * 100).toFixed(2)) : null;

  return (
    <div className="space-y-4 overflow-auto max-h-[60vh] pr-1">
      <header className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          {current.profile_pic_url && (
            <img
              src={current.profile_pic_url}
              alt={current.username}
              className="w-16 h-16 rounded-full object-cover border border-border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold truncate">{current.full_name || current.username}</h3>
              {current.is_verified && <Badge variant="outline" className="text-[9px] h-4">Verificado</Badge>}
              {current.is_business && <Badge variant="outline" className="text-[9px] h-4">Business</Badge>}
            </div>
            <a
              href={`https://instagram.com/${current.username}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
            >
              @{current.username} <ExternalLink className="w-2.5 h-2.5" />
            </a>
            {current.category && (
              <p className="text-[11px] text-muted-foreground mt-1">{current.category}</p>
            )}
            {current.biography && (
              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
                {current.biography}
              </p>
            )}
          </div>
          <Button
            onClick={forceSnapshot}
            disabled={refreshing}
            size="sm"
            variant="ghost"
            className="gap-1 text-xs h-7"
          >
            {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Atualizar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Último snapshot {formatDistanceToNow(new Date(current.scraped_at), { addSuffix: true, locale: ptBR })}
          {' · '}
          {snapshots.length} snapshots no total
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Stat label="Seguidores" value={current.followers} previous={previous?.followers} />
        <Stat label="Seguindo" value={current.following} previous={previous?.following} />
        <Stat label="Posts" value={current.posts_count} previous={previous?.posts_count} />
        <Stat
          label="Engajamento"
          value={Number(engagementPct)}
          previous={prevEngagementPct}
          format={(n) => `${n}%`}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        <Stat
          label="Posts últimos 30d"
          value={current.posts_last_30d || 0}
          previous={previous?.posts_last_30d}
        />
        <Stat
          label="Média de curtidas"
          value={Math.round(current.avg_likes || 0)}
          previous={previous?.avg_likes ? Math.round(previous.avg_likes) : null}
        />
        <Stat
          label="Média de comentários"
          value={Math.round(current.avg_comments || 0)}
          previous={previous?.avg_comments ? Math.round(previous.avg_comments) : null}
        />
      </div>

      {current.top_hashtags && current.top_hashtags.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Hashtags recorrentes
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {current.top_hashtags.slice(0, 12).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {snapshots.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Histórico de snapshots
          </p>
          <div className="space-y-1">
            {snapshots.map((s, i) => {
              const prev = snapshots[i + 1];
              const followerDiff = prev ? s.followers - prev.followers : 0;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0"
                >
                  <span className="text-muted-foreground">
                    {format(new Date(s.scraped_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      {s.followers.toLocaleString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-muted-foreground" />
                      {((s.engagement_rate || 0) * 100).toFixed(2)}%
                    </span>
                    {prev && (
                      <span className={`w-12 text-right font-mono text-[10px] ${followerDiff > 0 ? 'text-green-400' : followerDiff < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {followerDiff > 0 ? '+' : ''}{followerDiff}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
