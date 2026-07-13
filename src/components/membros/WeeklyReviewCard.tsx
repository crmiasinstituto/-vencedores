import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Sparkles, X, ArrowRight, Clock } from 'lucide-react';

// Card "Novidades": mostra as aulas mais recentes (created_at DESC) que
// o aluno ainda nao completou nem comecou. Sumido depois que o aluno
// dispensa (TTL 7 dias). Reaparece automaticamente sem precisar de cron.

const STORAGE_KEY = 'squaad_novidades_dismissed_at';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Lesson {
  id: string;
  title: string;
  duration_minutes?: number | null;
  module_id?: string | null;
  created_at?: string | null;
}

interface Props {
  // Aulas mais recentes (created_at DESC) ainda nao completadas/iniciadas
  // pelo aluno. Fonte primaria do card "Novidades".
  suggestedLessons: Lesson[];
  // Em progresso entra como fallback so se nao tiver novidades de verdade.
  inProgressLessons?: Lesson[];
}

function isStillDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < TTL_MS;
  } catch {
    return false;
  }
}

export function WeeklyReviewCard({ suggestedLessons, inProgressLessons = [] }: Props) {
  const [dismissed, setDismissed] = useState(() => isStillDismissed());

  // Primario: novidades (suggestedLessons ja vem ordenado por created_at DESC).
  // Fallback: 1 em progresso se sobrar espaco e nao houver novidade suficiente.
  const planned = useMemo(() => {
    const pool = [...suggestedLessons, ...inProgressLessons];
    const seen = new Set<string>();
    const result: Lesson[] = [];
    for (const l of pool) {
      if (!l?.id || seen.has(l.id)) continue;
      seen.add(l.id);
      result.push(l);
      if (result.length >= 3) break;
    }
    return result;
  }, [suggestedLessons, inProgressLessons]);

  const totalMinutes = planned.reduce(
    (acc, l) => acc + (l.duration_minutes || 10),
    0,
  );

  // Mostra "ha N dias" da aula mais recente do conjunto
  const newestDaysAgo = (() => {
    const dates = planned.map((l) => (l.created_at ? new Date(l.created_at).getTime() : 0)).filter(Boolean);
    if (dates.length === 0) return null;
    const newest = Math.max(...dates);
    const days = Math.max(0, Math.round((Date.now() - newest) / (24 * 60 * 60 * 1000)));
    return days;
  })();

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  if (dismissed || planned.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35 }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-[#3B82F6]/30 bg-gradient-to-br from-[#3B82F6]/10 via-[#3B82F6]/5 to-transparent p-5 md:p-6 backdrop-blur-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#3B82F6]/10 rounded-full blur-3xl pointer-events-none" />
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Dispensar plano da semana"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-[#3B82F6]/20">
                <Sparkles className="w-4 h-4 text-[#3B82F6]" />
              </div>
              <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 font-semibold text-[10px] uppercase tracking-wider">
                Novidades
              </Badge>
              {newestDaysAgo !== null && newestDaysAgo <= 14 && (
                <span className="text-[10px] text-emerald-400/80 font-medium">
                  {newestDaysAgo === 0 ? 'hoje' : `ha ${newestDaysAgo}d`}
                </span>
              )}
            </div>

            <h3 className="text-lg md:text-xl font-bold text-white mt-2">
              {planned.length === 1
                ? 'Aula nova na area de membros'
                : `${planned.length} aulas novas na area de membros`}
            </h3>
            <p className="text-sm text-white/55 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              ~{totalMinutes} min no total
            </p>

            <div className="mt-4 space-y-2">
              {planned.map((lesson, i) => (
                <Link
                  key={lesson.id}
                  to={`/membros/aula/${lesson.id}`}
                  className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#3B82F6]/30 hover:bg-white/[0.07] transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/15 text-[#3B82F6] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
                    {lesson.duration_minutes ? (
                      <p className="text-[11px] text-white/40 mt-0.5">{lesson.duration_minutes} min</p>
                    ) : null}
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-[#3B82F6] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-white/35">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Aparece de novo daqui 7 dias
              </span>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-white/40 hover:text-white hover:bg-white/5"
              >
                Dispensar
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
