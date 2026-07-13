import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MembrosLayout } from '@/components/membros/MembrosLayout';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BookOpen,
  Clock,
  Zap,
  Flame,
  Award,
  Trophy,
  Target,
  CheckCircle2,
} from 'lucide-react';
import ProfileEditor from '@/components/membros/ProfileEditor';
import PrepostoManager from '@/components/membros/PrepostoManager';

const db = supabase as any;

function xpForLevel(level: number) {
  return level * 200;
}

export default function MembrosPerfil() {
  const [member, setMember] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [stats, setStats] = useState({
    lessonsCompleted: 0,
    totalLessons: 0,
    quizzesDone: 0,
    totalHours: 0,
    streak: 0,
    longestStreak: 0,
  });
  const [moduleProgress, setModuleProgress] = useState<
    { name: string; completed: number; total: number }[]
  >([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) return;
    const session = JSON.parse(raw);
    const memberId = session.member_id;

    const [memberRes, milestonesRes, progressRes, lessonsRes, modulesRes, sessionsRes] =
      await Promise.all([
        db.from('members').select('*').eq('id', memberId).single(),
        db
          .from('member_milestones')
          .select('*')
          .eq('member_id', memberId)
          .order('earned_at', { ascending: false }),
        db.from('member_progress').select('*').eq('member_id', memberId),
        db.from('member_lessons').select('id, module_id, type').eq('is_published', true),
        db.from('member_modules').select('id, title').eq('is_published', true).order('sort_order'),
        db.from('member_sessions').select('duration_minutes').eq('member_id', memberId),
      ]);

    if (memberRes.data) setMember(memberRes.data);
    setMilestones(milestonesRes.data || []);

    const progress = progressRes.data || [];
    const lessons = lessonsRes.data || [];
    const modules = modulesRes.data || [];

    const completedSet = new Set(
      progress.filter((p: any) => p.completed).map((p: any) => p.lesson_id)
    );
    const quizLessons = lessons.filter((l: any) => l.type === 'quiz');
    const quizzesDone = quizLessons.filter((l: any) => completedSet.has(l.id)).length;

    const totalSec = (sessionsRes.data || []).reduce(
      (s: number, r: any) => s + (r.duration_minutes || 0),
      0
    );

    setStats({
      lessonsCompleted: completedSet.size,
      totalLessons: lessons.length,
      quizzesDone,
      totalHours: Math.round((totalSec / 3600) * 10) / 10,
      streak: memberRes.data?.streak_current || 0,
      longestStreak: memberRes.data?.streak_longest || 0,
    });

    // Module progress
    const modProg = modules.map((mod: any) => {
      const modLessons = lessons.filter((l: any) => l.module_id === mod.id);
      const modCompleted = modLessons.filter((l: any) => completedSet.has(l.id)).length;
      return {
        name: mod.title,
        completed: modCompleted,
        total: modLessons.length,
      };
    }).filter((m: any) => m.total > 0);

    setModuleProgress(modProg);
  };

  if (!member) {
    return (
      <MembrosLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="h-48 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </MembrosLayout>
    );
  }

  const level = member.level || 1;
  const xpNext = xpForLevel(level + 1);
  const xpPrev = xpForLevel(level);
  const xpProgress = Math.min(100, ((member.xp - xpPrev) / (xpNext - xpPrev)) * 100);

  const statItems = [
    { label: 'Tempo total', value: `${stats.totalHours}h`, icon: Clock, color: '#10B981' },
    { label: 'Aulas concluidas', value: `${stats.lessonsCompleted}`, icon: BookOpen, color: '#3B82F6' },
    { label: 'Quizzes feitos', value: `${stats.quizzesDone}`, icon: Target, color: '#8B5CF6' },
    { label: 'Streak atual', value: `${stats.streak} dias`, icon: Flame, color: '#EF4444' },
    { label: 'Maior streak', value: `${stats.longestStreak} dias`, icon: Trophy, color: '#3B82F6' },
    { label: 'XP Total', value: member.xp?.toLocaleString() || '0', icon: Zap, color: '#3B82F6' },
  ];

  return (
    <MembrosLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-white/5 border-white/10 rounded-2xl overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-[#3B82F6]/20 via-[#3B82F6]/5 to-transparent" />
            <CardContent className="p-6 -mt-12">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
                <Avatar className="w-20 h-20 border-4 border-[#0a0a0a]">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="bg-[#141414] text-[#3B82F6] text-2xl font-bold">
                    {member.name?.charAt(0)?.toUpperCase() || 'M'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left flex-1">
                  <h1 className="text-xl font-bold text-white">{member.name}</h1>
                  <p className="text-sm text-white/40">{member.email}</p>
                  {member.bio && (
                    <p className="text-sm text-white/60 mt-1 leading-relaxed">{member.bio}</p>
                  )}
                </div>
                <div className="text-center sm:text-right flex flex-col items-center sm:items-end gap-3">
                  <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 text-sm font-bold px-3 py-1">
                    Nivel {level}
                  </Badge>
                  <ProfileEditor member={member} onUpdated={(m) => setMember(m)} />
                </div>
              </div>
              {/* XP progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40">Nivel {level}</span>
                  <span className="text-xs text-white/40">Nivel {level + 1}</span>
                </div>
                <Progress
                  value={xpProgress}
                  className="h-3 bg-white/10 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-[#3B82F6] [&>div]:to-[#FFE066] [&>div]:rounded-full"
                />
                <p className="text-xs text-white/30 text-center mt-2">
                  {member.xp - xpPrev} / {xpNext - xpPrev} XP para o proximo nivel
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Preposto manager — só pra contratantes (quem não tem contratante_member_id preenchido) */}
        {member && !member.contratante_member_id && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <PrepostoManager contratanteId={member.id} />
          </motion.div>
        )}

        {/* Se for preposto, mostra quem indicou */}
        {member?.contratante_member_id && (
          <Card className="bg-[#3B82F6]/5 border-[#3B82F6]/20 rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-[#3B82F6] uppercase font-bold tracking-wider">Voce e preposto</p>
              <p className="text-sm text-white/80 mt-1">
                Seu acesso foi concedido pelo contratante do programa. Voce tem todos os beneficios de aluno + que Vencedores.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {statItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <Card
                key={i}
                className="bg-white/5 border-white/10 rounded-2xl"
              >
                <CardContent className="p-4 text-center">
                  <div
                    className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <p className="text-lg font-bold text-white">{item.value}</p>
                  <p className="text-xs text-white/40">{item.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Badges / Milestones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/5 border-white/10 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-[#3B82F6]" />
                Conquistas
              </h3>
              {milestones.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-8">
                  Nenhuma conquista ainda. Continue estudando para desbloquear!
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {milestones.map((m: any, i: number) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex flex-col items-center text-center p-4 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="text-3xl mb-2">
                        {m.member_milestones?.icon || '🏆'}
                      </div>
                      <p className="text-xs font-medium text-white">
                        {m.member_milestones?.name || 'Marco'}
                      </p>
                      <p className="text-[10px] text-white/30 mt-1">
                        {new Date(m.earned_at).toLocaleDateString('pt-BR')}
                      </p>
                      <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 text-[10px] mt-2">
                        +{m.member_milestones?.xp_earned || 0} XP
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Module progress */}
        {moduleProgress.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-[#3B82F6]" />
                  Progresso por modulo
                </h3>
                <div className="space-y-4">
                  {moduleProgress.map((mod, i) => {
                    const pct = mod.total > 0 ? (mod.completed / mod.total) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-white/80 truncate max-w-[70%]">
                            {mod.name}
                          </span>
                          <span className="text-xs text-white/40">
                            {mod.completed}/{mod.total}
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#3B82F6] [&>div]:to-[#FFE066]"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </MembrosLayout>
  );
}
