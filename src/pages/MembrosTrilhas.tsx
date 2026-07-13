import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MembrosLayout } from '@/components/membros/MembrosLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Play,
  Lock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  X,
} from 'lucide-react';

const db = supabase as any;

interface Module {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  allowed_programs: string[] | null;
  sort_order: number;
  is_published: boolean;
  lessons: Lesson[];
  progress: number;
  completedCount: number;
}

interface Lesson {
  id: string;
  title: string;
  sort_order: number;
  completed: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  trilha: 'Trilha Principal',
  bonus: 'Bonus',
  masterclass: 'Masterclasses',
  'ai-first': 'AI FIRST',
};

function ScrollRow({
  title,
  modules,
  memberProgram,
  onModuleClick,
}: {
  title: string;
  modules: Module[];
  memberProgram: string;
  onModuleClick: (mod: Module) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [modules]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  if (modules.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="relative group">
        {/* Scroll left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        )}
        {/* Scroll right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {modules.map((mod) => {
            // Bloqueio por programa: NULL ou array vazio = todos podem ver
            const allowed = mod.allowed_programs;
            const isLocked = Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(memberProgram);
            return (
              <div
                key={mod.id}
                onClick={() => !isLocked && onModuleClick(mod)}
                className={`flex-shrink-0 w-[280px] md:w-[300px] rounded-xl border overflow-hidden transition-all duration-300 ${
                  isLocked
                    ? 'border-white/5 opacity-50 cursor-not-allowed'
                    : 'border-white/10 cursor-pointer hover:scale-[1.03] hover:border-[#3B82F6]/30'
                }`}
              >
                <div className="relative aspect-video bg-[#141414]">
                  {mod.thumbnail_url ? (
                    <img
                      src={mod.thumbnail_url}
                      alt={mod.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#141414] to-[#1a1a1a]">
                      <BookOpen className="w-10 h-10 text-white/10" />
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-semibold text-white line-clamp-2">
                      {mod.title}
                    </p>
                  </div>
                  {/* Badges */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {isLocked && (
                      <div
                        className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                        title={`Exclusivo para: ${(allowed || []).join(', ')}`}
                      >
                        <Lock className="w-4 h-4 text-white/60" />
                      </div>
                    )}
                    <Badge className="bg-black/60 text-white/80 border-none text-[10px]">
                      {mod.lessons.length} aulas
                    </Badge>
                  </div>
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="bg-black/70 border border-[#3B82F6]/30 rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-[#3B82F6] font-bold uppercase tracking-wider">
                          Exclusivo: {(allowed || []).map(p => p === 'metodo-squaad' ? 'Metodo' : p === 'mentoria' ? 'MentorIA' : p).join(' / ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Progress bar */}
                  {mod.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                      <div
                        className="h-full bg-[#3B82F6]"
                        style={{ width: `${mod.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MembrosTrilhas() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Record<string, Module[]>>({});
  const [memberProgram, setMemberProgram] = useState('metodo-squaad');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) return;
    const session = JSON.parse(raw);
    const memberId = session.member_id;

    const [memberRes, modulesRes, lessonsRes, progressRes] = await Promise.all([
      db.from('members').select('level, program').eq('id', memberId).single(),
      db.from('member_modules').select('*').eq('is_published', true).order('sort_order'),
      db.from('member_lessons').select('id, title, sort_order, module_id').eq('is_published', true).order('sort_order'),
      db.from('member_progress').select('lesson_id, completed').eq('member_id', memberId),
    ]);

    setMemberProgram(memberRes.data?.program || 'metodo-squaad');

    const modules = modulesRes.data || [];
    const lessons = lessonsRes.data || [];
    const progress = progressRes.data || [];
    const completedSet = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.lesson_id));

    const grouped: Record<string, Module[]> = {};

    for (const mod of modules) {
      const modLessons = lessons
        .filter((l: any) => l.module_id === mod.id)
        .map((l: any) => ({
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          completed: completedSet.has(l.id),
        }));

      const completedCount = modLessons.filter((l: Lesson) => l.completed).length;
      const progressPct = modLessons.length > 0 ? (completedCount / modLessons.length) * 100 : 0;

      const category = mod.category || 'trilha';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({
        ...mod,
        lessons: modLessons,
        progress: progressPct,
        completedCount,
      });
    }

    setCategories(grouped);
    setLoading(false);
  };

  return (
    <MembrosLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Trilhas</h1>
          <p className="text-white/40 mt-1">Explore os conteudos e evolua seu aprendizado</p>
        </div>

        {loading ? (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
                <div className="flex gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="w-[300px] aspect-video bg-white/5 rounded-xl animate-pulse flex-shrink-0" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) =>
              categories[key] ? (
                <ScrollRow
                  key={key}
                  title={label}
                  modules={categories[key]}
                  memberProgram={memberProgram}
                  onModuleClick={setSelectedModule}
                />
              ) : null
            )}
            {/* Show any categories not in CATEGORY_LABELS */}
            {Object.entries(categories)
              .filter(([key]) => !CATEGORY_LABELS[key])
              .map(([key, mods]) => (
                <ScrollRow
                  key={key}
                  title={key.charAt(0).toUpperCase() + key.slice(1)}
                  modules={mods}
                  memberProgram={memberProgram}
                  onModuleClick={setSelectedModule}
                />
              ))}
          </>
        )}
      </div>

      {/* Module Detail Overlay */}
      <AnimatePresence>
        {selectedModule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedModule(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-white/10 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative">
                <div className="aspect-video bg-[#0a0a0a]">
                  {selectedModule.thumbnail_url ? (
                    <img
                      src={selectedModule.thumbnail_url}
                      alt={selectedModule.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-white/10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                </div>
                <button
                  onClick={() => setSelectedModule(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="text-xl font-bold text-white">{selectedModule.title}</h2>
                  {selectedModule.description && (
                    <p className="text-sm text-white/50 mt-1 line-clamp-2">
                      {selectedModule.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 text-xs">
                      {selectedModule.lessons.length} aulas
                    </Badge>
                    <Badge className="bg-white/10 text-white/60 border-white/10 text-xs">
                      {selectedModule.completedCount}/{selectedModule.lessons.length} concluidas
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="px-4 pt-2">
                <Progress
                  value={selectedModule.progress}
                  className="h-1.5 bg-white/10 [&>div]:bg-[#3B82F6]"
                />
              </div>

              {/* Lessons list */}
              <div className="p-4 space-y-2">
                {selectedModule.lessons
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((lesson, i) => (
                    <Link
                      key={lesson.id}
                      to={`/membros/aula/${lesson.id}`}
                      onClick={() => setSelectedModule(null)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        lesson.completed
                          ? 'bg-[#3B82F6]/5 border-[#3B82F6]/10'
                          : 'bg-white/5 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          lesson.completed
                            ? 'bg-[#3B82F6]/20 text-[#3B82F6]'
                            : 'bg-white/10 text-white/40'
                        }`}
                      >
                        {lesson.completed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={`text-sm flex-1 ${
                          lesson.completed ? 'text-white/60' : 'text-white'
                        }`}
                      >
                        {lesson.title}
                      </span>
                      <Play className="w-4 h-4 text-white/20" />
                    </Link>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MembrosLayout>
  );
}
