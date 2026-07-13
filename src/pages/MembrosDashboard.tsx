import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MembrosLayout } from '@/components/membros/MembrosLayout';
import LiveMeetingBanner from '@/components/membros/LiveMeetingBanner';
import { WeeklyReviewCard } from '@/components/membros/WeeklyReviewCard';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  BookOpen,
  Clock,
  Zap,
  Flame,
  Trophy,
  Star,
  Play,
  Crown,
} from 'lucide-react';

const db = supabase as any;

interface MemberSession {
  member_id: string;
  session_token: string;
  member_name: string;
  member_email: string;
}

function xpForLevel(level: number) {
  return level * 200;
}

export default function MembrosDashboard() {
  const navigate = useNavigate();
  const [member, setMember] = useState<any>(null);
  const [inProgress, setInProgress] = useState<any[]>([]);
  const [nextUp, setNextUp] = useState<any[]>([]);
  const [stats, setStats] = useState({
    completed: 0,
    total: 0,
    hours: 0,
    xp: 0,
    streak: 0,
  });
  const [milestones, setMilestones] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) return;
    const session: MemberSession = JSON.parse(raw);
    const memberId = session.member_id;

    // Ranking via RPC member_leaderboard — campos restritos, sem PII.
    // Demais queries seguem direto (RLS de members agora libera SELECT só
    // da própria row do member; o filtro .eq('id', memberId) bate com a
    // policy `id = current_member_id()`).
    const [memberRes, progressRes, lessonsRes, milestonesRes, rankingRes, sessionsRes] =
      await Promise.all([
        db.from('members').select('*').eq('id', memberId).single(),
        db.from('member_progress').select('*').eq('member_id', memberId),
        db.from('member_lessons').select('id, title, description, content_url, thumbnail_url, duration_minutes, sort_order, module_id, created_at').eq('is_published', true),
        db.from('member_milestones').select('*').eq('member_id', memberId).order('earned_at', { ascending: false }).limit(5),
        db.rpc('member_leaderboard', { p_limit: 5 }),
        db.from('member_sessions').select('duration_minutes').eq('member_id', memberId),
      ]);

    if (memberRes.data) setMember(memberRes.data);

    const allLessons = lessonsRes.data || [];
    const progress = progressRes.data || [];
    const completedIds = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.lesson_id));

    // In progress lessons (started but not completed)
    const inProg = progress
      .filter((p: any) => !p.completed && p.video_position_seconds > 0)
      .map((p: any) => {
        const lesson = allLessons.find((l: any) => l.id === p.lesson_id);
        if (!lesson) return null;
        const totalSec = (lesson.duration_minutes || 10) * 60;
        return {
          ...lesson,
          progress: Math.min(100, (p.video_position_seconds / totalSec) * 100),
          position: p.video_position_seconds,
        };
      })
      .filter(Boolean);
    setInProgress(inProg);

    // "Novidades" pro WeeklyReview: aulas publicadas MAIS RECENTES, ordenadas
    // por created_at DESC. Mostra ao aluno o que entrou de novo na area.
    // (Carlos pediu: "ultimas aulas que subimos" em vez de curriculum order.)
    const inProgressIds = new Set(inProg.map((l: any) => l.id));
    const next = allLessons
      .filter((l: any) => !completedIds.has(l.id) && !inProgressIds.has(l.id))
      .sort((a: any, b: any) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 6);
    setNextUp(next);

    const totalHours = (sessionsRes.data || []).reduce(
      (s: number, r: any) => s + (r.duration_minutes || 0),
      0
    ) / 3600;

    setStats({
      completed: completedIds.size,
      total: allLessons.length,
      hours: Math.round(totalHours * 10) / 10,
      xp: memberRes.data?.xp || 0,
      streak: memberRes.data?.streak_current || 0,
    });

    setMilestones(milestonesRes.data || []);
    setRanking(rankingRes.data || []);
  };

  if (!member) {
    return (
      <MembrosLayout>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </MembrosLayout>
    );
  }

  const level = member.level || 1;
  const xpNext = xpForLevel(level + 1);
  const xpPrev = xpForLevel(level);
  const xpProgress = Math.min(100, ((member.xp - xpPrev) / (xpNext - xpPrev)) * 100);

  const statCards = [
    { label: 'Aulas concluidas', value: `${stats.completed}/${stats.total}`, icon: BookOpen, color: '#3B82F6' },
    { label: 'Tempo na plataforma', value: `${stats.hours}h`, icon: Clock, color: '#10B981' },
    { label: 'XP Total', value: stats.xp.toLocaleString(), icon: Zap, color: '#3B82F6' },
    { label: 'Streak atual', value: `${stats.streak} dias`, icon: Flame, color: '#EF4444' },
  ];

  return (
    <MembrosLayout>
      <div className="space-y-8">
        {/* Upcoming live meetings banner */}
        <LiveMeetingBanner />

        {/* Plano da semana (some apos dismiss, volta em 7 dias) */}
        <WeeklyReviewCard inProgressLessons={inProgress} suggestedLessons={nextUp} />

        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8">
            <div className="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/10 via-transparent to-[#3B82F6]/5" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#3B82F6]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Bem-vindo, {member.name?.split(' ')[0]}!
              </h1>
              <p className="text-white/50 mt-2 max-w-lg">
                Continue sua jornada de aprendizado. Cada aula te aproxima do proximo nivel.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">
                    {stats.streak} dias consecutivos
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 font-bold">
                    Nivel {level}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={xpProgress}
                      className="w-32 h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#3B82F6] [&>div]:to-[#FFE066]"
                    />
                    <span className="text-xs text-white/40">
                      {member.xp - xpPrev}/{xpNext - xpPrev} XP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Continue Assistindo */}
        {inProgress.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Continue assistindo</h2>
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {inProgress.map((lesson: any) => (
                  <Link
                    key={lesson.id}
                    to={`/membros/aula/${lesson.id}`}
                    className="group flex-shrink-0 w-[280px]"
                  >
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all duration-300 group-hover:scale-[1.02] group-hover:border-[#3B82F6]/30">
                      <div className="relative aspect-video bg-[#141414]">
                        {lesson.thumbnail_url || lesson.member_modules?.thumbnail_url ? (
                          <img
                            src={lesson.thumbnail_url || lesson.member_modules?.thumbnail_url}
                            alt={lesson.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-10 h-10 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center">
                            <Play className="w-5 h-5 text-black ml-0.5" />
                          </div>
                        </div>
                        {/* Progress bar at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                          <div
                            className="h-full bg-[#3B82F6]"
                            style={{ width: `${lesson.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-white truncate">
                          {lesson.title}
                        </p>
                        <p className="text-xs text-white/40 mt-1 truncate">
                          {lesson.member_modules?.title}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </motion.div>
        )}

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card
                key={i}
                className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl"
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${card.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{card.value}</p>
                      <p className="text-xs text-white/40">{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Marcos recentes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-[#3B82F6]" />
                  Marcos recentes
                </h3>
                {milestones.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-6">
                    Nenhum marco conquistado ainda. Continue estudando!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {milestones.map((m: any, i: number) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * i }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center text-lg">
                          {m.member_milestones?.icon || '🏆'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {m.member_milestones?.name || 'Marco'}
                          </p>
                          <p className="text-xs text-white/40">
                            {new Date(m.earned_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 text-xs">
                          +{m.member_milestones?.xp_earned || 0} XP
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Ranking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Crown className="w-5 h-5 text-[#3B82F6]" />
                  Ranking
                </h3>
                {ranking.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-6">
                    Nenhum membro no ranking ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {ranking.map((r: any, i: number) => {
                      const raw = localStorage.getItem('squaad_member_session');
                      const session = raw ? JSON.parse(raw) : null;
                      const isMe = session?.member_id === r.id;
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border ${
                            isMe
                              ? 'bg-[#3B82F6]/10 border-[#3B82F6]/20'
                              : 'bg-white/5 border-white/5'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              i === 0
                                ? 'bg-[#3B82F6] text-black'
                                : i === 1
                                ? 'bg-gray-300 text-black'
                                : i === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {i + 1}
                          </div>
                          <Avatar className="w-8 h-8 border border-white/10">
                            <AvatarImage src={r.avatar_url || undefined} />
                            <AvatarFallback className="bg-[#141414] text-[#3B82F6] text-xs font-bold">
                              {r.name?.charAt(0)?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {r.name}
                              {isMe && (
                                <span className="text-[#3B82F6] ml-1">(voce)</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#3B82F6]">
                              {r.xp?.toLocaleString()} XP
                            </p>
                            <p className="text-[10px] text-white/40">Lv.{r.level || 1}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </MembrosLayout>
  );
}
