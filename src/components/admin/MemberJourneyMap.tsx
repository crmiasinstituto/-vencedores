import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Flame,
  Clock,
  Search,
  TrendingUp,
  AlertTriangle,
  Activity,
  Moon,
  UserX,
  Loader2,
} from 'lucide-react';

const db = supabase as any;

interface MemberRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  program: string | null;
  status: string | null;
  level: number | null;
  xp: number | null;
  streak_current: number | null;
  total_time_minutes: number | null;
  total_lessons_completed: number | null;
  last_active_at: string | null;
  session_started_at: string | null;
  created_at: string;
}

type Health = 'ativo' | 'risco' | 'inativo' | 'nunca';

const HEALTH_META: Record<Health, { label: string; color: string; icon: any }> = {
  ativo: { label: 'Ativo', color: '#10B981', icon: Activity },
  risco: { label: 'Em risco', color: '#F59E0B', icon: AlertTriangle },
  inativo: { label: 'Inativo', color: '#EF4444', icon: Moon },
  nunca: { label: 'Nunca acessou', color: '#6B7280', icon: UserX },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function classifyHealth(m: MemberRow): Health {
  const last = m.last_active_at || m.session_started_at;
  if (!last) return 'nunca';
  const d = daysSince(last)!;
  if (d <= 7) return 'ativo';
  if (d <= 14) return 'risco';
  return 'inativo';
}

function relTime(iso: string | null): string {
  if (!iso) return 'nunca';
  const d = daysSince(iso)!;
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 30) return `${d}d atrás`;
  const meses = Math.floor(d / 30);
  return `${meses} ${meses === 1 ? 'mês' : 'meses'} atrás`;
}

export default function MemberJourneyMap() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [totalLessons, setTotalLessons] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('todos');
  const [health, setHealth] = useState<'todos' | Health>('todos');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: mems }, { count }] = await Promise.all([
      db
        .from('members')
        .select(
          'id, name, email, avatar_url, program, status, level, xp, streak_current, total_time_minutes, total_lessons_completed, last_active_at, session_started_at, created_at'
        )
        .order('last_active_at', { ascending: false, nullsFirst: false }),
      db.from('member_lessons').select('id', { count: 'exact', head: true }).eq('is_published', true),
    ]);
    setMembers(mems || []);
    setTotalLessons(count || 0);
    setLoading(false);
  };

  const enriched = useMemo(
    () =>
      members.map((m) => {
        const h = classifyHealth(m);
        const pct = totalLessons
          ? Math.min(100, Math.round(((m.total_lessons_completed || 0) / totalLessons) * 100))
          : 0;
        return { ...m, health: h, pct };
      }),
    [members, totalLessons]
  );

  const programs = useMemo(
    () => Array.from(new Set(members.map((m) => m.program).filter(Boolean))) as string[],
    [members]
  );

  const kpis = useMemo(() => {
    const k = { total: enriched.length, ativo: 0, risco: 0, inativo: 0, nunca: 0, somaPct: 0 };
    for (const m of enriched) {
      k[m.health]++;
      k.somaPct += m.pct;
    }
    return { ...k, mediaPct: k.total ? Math.round(k.somaPct / k.total) : 0 };
  }, [enriched]);

  const filtered = useMemo(
    () =>
      enriched.filter((m) => {
        const ms =
          !search ||
          m.name?.toLowerCase().includes(search.toLowerCase()) ||
          m.email?.toLowerCase().includes(search.toLowerCase());
        const mp = program === 'todos' || m.program === program;
        const mh = health === 'todos' || m.health === health;
        return ms && mp && mh;
      }),
    [enriched, search, program, health]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  const kpiCards = [
    { key: 'total', label: 'Total de alunos', value: kpis.total, icon: Users, color: '#3B82F6' },
    { key: 'ativo', label: 'Ativos (7d)', value: kpis.ativo, icon: Activity, color: '#10B981' },
    { key: 'risco', label: 'Em risco (7-14d)', value: kpis.risco, icon: AlertTriangle, color: '#F59E0B' },
    { key: 'inativo', label: 'Inativos (+14d)', value: kpis.inativo, icon: Moon, color: '#EF4444' },
    { key: 'nunca', label: 'Nunca acessaram', value: kpis.nunca, icon: UserX, color: '#6B7280' },
    { key: 'media', label: 'Progresso médio', value: `${kpis.mediaPct}%`, icon: TrendingUp, color: '#8B5CF6' },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((c) => {
          const Icon = c.icon;
          const clickable = ['ativo', 'risco', 'inativo', 'nunca'].includes(c.key);
          const active = health === c.key;
          return (
            <Card
              key={c.key}
              className={`cursor-${clickable ? 'pointer' : 'default'} transition-all ${
                active ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() =>
                clickable && setHealth(active ? 'todos' : (c.key as Health))
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4" style={{ color: c.color }} />
                </div>
                <p className="text-2xl font-bold mt-2">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setProgram('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              program === 'todos' ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'
            }`}
          >
            Todos os programas
          </button>
          {programs.map((p) => (
            <button
              key={p}
              onClick={() => setProgram(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                program === p ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {health !== 'todos' && (
        <p className="text-xs text-muted-foreground">
          Filtrando por: <span className="font-medium">{HEALTH_META[health].label}</span> ({filtered.length}){' '}
          <button onClick={() => setHealth('todos')} className="text-primary underline">limpar</button>
        </p>
      )}

      {/* Lista */}
      <div className="grid gap-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum aluno encontrado
            </CardContent>
          </Card>
        ) : (
          filtered.map((m) => {
            const hm = HEALTH_META[m.health];
            const HIcon = hm.icon;
            return (
              <Card key={m.id}>
                <CardContent className="p-3 flex items-center gap-4">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={m.avatar_url || undefined} />
                    <AvatarFallback>{m.name?.charAt(0)?.toUpperCase() || 'A'}</AvatarFallback>
                  </Avatar>

                  {/* Nome + programa */}
                  <div className="min-w-0 w-48 shrink-0">
                    <p className="font-medium text-sm truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>

                  {/* Saúde */}
                  <Badge
                    className="border shrink-0"
                    style={{ backgroundColor: `${hm.color}15`, color: hm.color, borderColor: `${hm.color}40` }}
                  >
                    <HIcon className="w-3 h-3 mr-1" />
                    {hm.label}
                  </Badge>

                  {/* Progresso */}
                  <div className="flex-1 min-w-[120px]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {m.total_lessons_completed || 0}/{totalLessons} aulas
                      </span>
                      <span className="font-medium">{m.pct}%</span>
                    </div>
                    <Progress value={m.pct} className="h-1.5" />
                  </div>

                  {/* Métricas */}
                  <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1" title="Nível">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Lv.{m.level || 1}
                    </span>
                    <span className="flex items-center gap-1" title="Sequência">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      {m.streak_current || 0}
                    </span>
                    <span className="flex items-center gap-1" title="Tempo total">
                      <Clock className="w-3.5 h-3.5" />
                      {Math.round((m.total_time_minutes || 0) / 60)}h
                    </span>
                  </div>

                  {/* Último acesso */}
                  <div className="w-24 text-right shrink-0">
                    <p className="text-xs text-muted-foreground">último acesso</p>
                    <p className="text-xs font-medium">{relTime(m.last_active_at || m.session_started_at)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
