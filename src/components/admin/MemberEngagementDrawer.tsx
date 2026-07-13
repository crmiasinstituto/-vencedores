import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Activity,
  BookOpen,
  Calendar,
  Clock,
  Flame,
  MessageCircle,
  Phone,
  PlayCircle,
  Sparkles,
  Trophy,
  Video,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface EngagementSummary {
  member_id: string;
  member_name: string;
  member_email: string;
  member_phone: string | null;
  last_active_at: string | null;
  days_since_last_access: number;
  total_lessons_completed: number;
  lessons_completed_7d: number;
  tutor_questions_7d: number;
  sessions_7d: number;
  live_meetings_30d: number;
  current_streak: number;
  engagement_score: number;
  classification: 'ativo' | 'esfriando' | 'em_risco' | 'inativo';
}

interface TimelineEvent {
  event_type: string;
  event_title: string;
  payload: Record<string, any>;
  event_at: string;
}

interface Props {
  memberId: string | null;
  onClose: () => void;
}

const CLASS_VISUAL: Record<EngagementSummary['classification'], { color: string; emoji: string; label: string; ring: string }> = {
  ativo:      { color: '#10B981', emoji: '🟢', label: 'Ativo',     ring: 'ring-emerald-500/40' },
  esfriando:  { color: '#F59E0B', emoji: '🟡', label: 'Esfriando', ring: 'ring-amber-500/40' },
  em_risco:   { color: '#EF4444', emoji: '🔴', label: 'Em risco',  ring: 'ring-red-500/40' },
  inativo:    { color: '#71717A', emoji: '⚫', label: 'Inativo',   ring: 'ring-zinc-500/40' },
};

const EVENT_VISUAL: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  session:          { icon: Activity,    color: '#3B82F6', label: 'Acesso' },
  lesson_started:   { icon: PlayCircle,  color: '#A78BFA', label: 'Aula iniciada' },
  lesson_completed: { icon: CheckCircle2, color: '#10B981', label: 'Aula concluida' },
  tutor_question:   { icon: Sparkles,    color: '#3B82F6', label: 'Tutor IA' },
  live_meeting:     { icon: Video,       color: '#EC4899', label: 'Live' },
  milestone:        { icon: Trophy,      color: '#3B82F6', label: 'Marco' },
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atras`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atras`;
  return d.toLocaleDateString('pt-BR');
}

export function MemberEngagementDrawer({ memberId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<EngagementSummary | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    setSummary(null);
    setEvents([]);
    Promise.all([
      (supabase as any).rpc('member_engagement_summary', { p_member_id: memberId }),
      (supabase as any).rpc('member_activity_timeline', { p_member_id: memberId, p_limit: 200 }),
    ]).then(([sumRes, timeRes]) => {
      const sRow = Array.isArray(sumRes?.data) ? sumRes.data[0] : null;
      if (sRow) setSummary(sRow as EngagementSummary);
      if (Array.isArray(timeRes?.data)) setEvents(timeRes.data as TimelineEvent[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [memberId]);

  const open = memberId !== null;
  const visual = summary ? CLASS_VISUAL[summary.classification] : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-[#0a0a0a] border-white/10 text-white p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent">
          <SheetTitle className="text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#3B82F6]" />
            Engajamento do membro
          </SheetTitle>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-10 text-white/40">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {!loading && summary && visual && (
            <>
              {/* Stats card */}
              <div className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-5 ring-1 ${visual.ring}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs text-white/40 uppercase tracking-wider">{summary.member_email}</p>
                    <h2 className="text-xl font-bold text-white mt-0.5">{summary.member_name}</h2>
                    <div className="flex items-center gap-1.5 text-xs text-white/50 mt-1">
                      <Clock className="w-3 h-3" />
                      {summary.last_active_at
                        ? `Ultimo acesso ${formatRelative(summary.last_active_at)} (${summary.days_since_last_access} dias)`
                        : 'Nunca acessou'}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      className="font-bold border-0 text-[10px] uppercase tracking-wider"
                      style={{ backgroundColor: `${visual.color}25`, color: visual.color }}
                    >
                      {visual.emoji} {visual.label}
                    </Badge>
                    <div className="text-3xl font-bold mt-2" style={{ color: visual.color }}>
                      {summary.engagement_score}
                      <span className="text-xs text-white/30 ml-1">/100</span>
                    </div>
                  </div>
                </div>

                {/* Metricas */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                  <Metric icon={BookOpen}     label="Aulas (7d)"     value={String(summary.lessons_completed_7d)} sub={`${summary.total_lessons_completed} total`} color="#10B981" />
                  <Metric icon={Activity}     label="Sessoes (7d)"   value={String(summary.sessions_7d)}                                                          color="#3B82F6" />
                  <Metric icon={Sparkles}     label="Tutor IA (7d)"  value={String(summary.tutor_questions_7d)}                                                   color="#3B82F6" />
                  <Metric icon={Video}        label="Lives (30d)"    value={String(summary.live_meetings_30d)}                                                    color="#EC4899" />
                  <Metric icon={Flame}        label="Streak atual"   value={`${summary.current_streak}d`}                                                          color="#F97316" />
                  {summary.classification === 'em_risco' || summary.classification === 'inativo' ? (
                    <Metric icon={AlertTriangle} label="Atencao" value={summary.classification === 'inativo' ? 'Inativo' : 'Em risco'} color={visual.color} />
                  ) : (
                    <Metric icon={Trophy} label="Saude" value="OK" color="#10B981" />
                  )}
                </div>

                {/* WhatsApp quick action */}
                {summary.member_phone && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="bg-[#25D366] hover:bg-[#1da851] text-white"
                    >
                      <a
                        href={`https://wa.me/${String(summary.member_phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Oi ${summary.member_name?.split(' ')[0] || ''}! Tudo bem? Notei que faz uns dias que voce nao entra na plataforma, posso te ajudar com algo?`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone className="w-3.5 h-3.5 mr-2" />
                        Chamar no WhatsApp
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Linha do tempo ({events.length})
                </h3>
                {events.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">
                    Sem atividades registradas ainda.
                  </p>
                ) : (
                  <div className="relative pl-6 space-y-3">
                    {/* Vertical line */}
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
                    {events.map((e, i) => {
                      const visual = EVENT_VISUAL[e.event_type] || {
                        icon: Activity, color: '#71717A', label: e.event_type,
                      };
                      const Icon = visual.icon;
                      return (
                        <motion.div
                          key={`${e.event_at}-${i}`}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="relative"
                        >
                          <div
                            className="absolute -left-[18px] top-2 w-4 h-4 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center"
                            style={{ backgroundColor: visual.color }}
                          >
                            <Icon className="w-2 h-2 text-white" />
                          </div>
                          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 hover:bg-white/[0.04] transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm text-white truncate">{e.event_title}</p>
                              <span className="text-[10px] text-white/40 flex-shrink-0">
                                {formatRelative(e.event_at)}
                              </span>
                            </div>
                            {e.event_type === 'tutor_question' && e.payload?.question_preview && (
                              <p className="text-xs text-white/50 mt-1 italic">"{e.payload.question_preview}"</p>
                            )}
                            {e.event_type === 'milestone' && e.payload?.xp_earned && (
                              <p className="text-xs text-[#3B82F6] mt-1">+{e.payload.xp_earned} XP</p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !summary && memberId && (
            <p className="text-sm text-white/40 text-center py-8">
              Sem dados de engajamento pra esse membro.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  icon: Icon, label, value, sub, color,
}: { icon: typeof Activity; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-wider">
        <Icon className="w-3 h-3" style={{ color }} />
        {label}
      </div>
      <p className="text-lg font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-white/30">{sub}</p>}
    </div>
  );
}
