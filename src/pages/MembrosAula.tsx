import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MembrosLayout } from '@/components/membros/MembrosLayout';
import { LessonTutorChat } from '@/components/membros/LessonTutorChat';
import { MemberHelpCard } from '@/components/membros/MemberHelpCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  Play,
  CheckCircle2,
  Download,
  FileText,
  File,
  ChevronRight,
  Award,
  Zap,
  PartyPopper,
} from 'lucide-react';

const db = supabase as any;

interface LessonData {
  id: string;
  title: string;
  description: string | null;
  content_url: string | null;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  sort_order: number;
  module_id: string;
  type: string;
  quiz_data: any;
  clip_start_seconds?: number | null;
  clip_end_seconds?: number | null;
  pdf_url?: string | null;
  ai_summary?: string | null;
  ai_key_points?: string[] | null;
}

interface Attachment {
  id: string;
  title: string;
  file_url: string;
  file_type: string;
}

interface ModuleLessonItem {
  id: string;
  title: string;
  sort_order: number;
  completed: boolean;
}

export default function MembrosAula() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveIntervalRef = useRef<number | null>(null);

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [moduleName, setModuleName] = useState('');
  const [moduleLessons, setModuleLessons] = useState<ModuleLessonItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [completed, setCompleted] = useState(false);
  const [savedPosition, setSavedPosition] = useState(0);
  const [memberId, setMemberId] = useState('');
  const [watermark, setWatermark] = useState('');
  const [celebration, setCelebration] = useState(false);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    loadLesson();
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, [lessonId]);

  const loadLesson = async () => {
    if (!lessonId) return;
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) return;
    const session = JSON.parse(raw);
    setMemberId(session.member_id);
    setWatermark([session.name, session.email].filter(Boolean).join('  ·  '));

    const [lessonRes, progressRes, attachRes] = await Promise.all([
      db.from('member_lessons').select('*').eq('id', lessonId).single(),
      db.from('member_progress').select('*').eq('member_id', session.member_id).eq('lesson_id', lessonId).single(),
      db.from('lesson_attachments').select('*').eq('lesson_id', lessonId),
    ]);

    if (!lessonRes.data) {
      navigate('/membros/trilhas');
      return;
    }

    const lessonData = lessonRes.data;
    setLesson(lessonData);
    setModuleName(lessonData.member_modules?.title || '');
    setAttachments(attachRes.data || []);

    if (progressRes.data) {
      setCompleted(progressRes.data.completed);
      setSavedPosition(progressRes.data.video_position_seconds || 0);
    }

    // Load quiz data
    if (lessonData.type === 'quiz' && lessonData.quiz_data) {
      try {
        const qd = typeof lessonData.quiz_data === 'string'
          ? JSON.parse(lessonData.quiz_data)
          : lessonData.quiz_data;
        setQuizQuestions(Array.isArray(qd) ? qd : qd.questions || []);
      } catch { /* ignore */ }
    }

    // Load module lessons for sidebar
    const { data: modLessons } = await db
      .from('member_lessons')
      .select('id, title, sort_order')
      .eq('module_id', lessonData.module_id || lessonData.member_modules?.id)
      .eq('is_published', true)
      .order('sort_order');

    const { data: allProgress } = await db
      .from('member_progress')
      .select('lesson_id, completed')
      .eq('member_id', session.member_id);

    const completedSet = new Set(
      (allProgress || []).filter((p: any) => p.completed).map((p: any) => p.lesson_id)
    );

    setModuleLessons(
      (modLessons || []).map((l: any) => ({
        ...l,
        completed: completedSet.has(l.id),
      }))
    );
  };

  // Video position saving
  const savePosition = useCallback(async () => {
    if (!videoRef.current || !lessonId || !memberId) return;
    const pos = Math.floor(videoRef.current.currentTime);
    await db
      .from('member_progress')
      .upsert(
        {
          member_id: memberId,
          lesson_id: lessonId,
          video_position_seconds: pos,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: 'member_id,lesson_id' }
      );
  }, [lessonId, memberId]);

  const handleVideoPlay = () => {
    if (!videoRef.current) return;
    const clipStart = lesson?.clip_start_seconds ?? 0;
    // Pula pra clipStart se ainda nao alcancou (e nao tem progresso salvo)
    if (savedPosition > 0 && videoRef.current.currentTime < Math.max(5, clipStart)) {
      videoRef.current.currentTime = Math.max(savedPosition, clipStart);
      setSavedPosition(0);
    } else if (clipStart > 0 && videoRef.current.currentTime < clipStart) {
      videoRef.current.currentTime = clipStart;
    }
    if (!saveIntervalRef.current) {
      saveIntervalRef.current = window.setInterval(savePosition, 30000);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (!videoRef.current || !lesson) return;
    const clipStart = lesson.clip_start_seconds ?? 0;
    if (clipStart > 0 && videoRef.current.currentTime < clipStart) {
      videoRef.current.currentTime = clipStart;
    }
    // Auto-preenche a duracao da aula (comprimento do video) quando ainda esta 0,
    // usando o trecho (clip) se definido. Assim o "(0min)" some conforme os alunos
    // vao abrindo as aulas. RPC segura: so' grava se estiver vazio.
    const full = videoRef.current.duration || 0;
    if (Number.isFinite(full) && full > 0 && !lesson.duration_minutes) {
      const clipEnd = lesson.clip_end_seconds ?? full;
      const mins = Math.max(1, Math.round(Math.max(0, clipEnd - clipStart) / 60));
      setLesson((prev) => (prev ? { ...prev, duration_minutes: mins } : prev));
      if (lessonId) {
        db.rpc('set_lesson_duration_if_empty', { p_lesson_id: lessonId, p_minutes: mins }).then(
          () => {}, () => {}
        );
      }
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !lesson || completed) return;
    const fileDuration = videoRef.current.duration || 0;
    const clipStart = lesson.clip_start_seconds ?? 0;
    const clipEnd = lesson.clip_end_seconds ?? fileDuration;
    const current = videoRef.current.currentTime;

    // Se passou do clipEnd, pausa e marca como completa
    if (clipEnd > 0 && current >= clipEnd) {
      videoRef.current.pause();
      videoRef.current.currentTime = clipEnd;
      markComplete();
      return;
    }

    const effectiveDuration = clipEnd - clipStart;
    const effectiveCurrent = current - clipStart;
    if (effectiveDuration > 0 && effectiveCurrent / effectiveDuration >= 0.9) {
      markComplete();
    }
  };

  const markComplete = async () => {
    if (completed || !lessonId || !memberId) return;
    setCompleted(true);

    // Update progress
    await db
      .from('member_progress')
      .upsert(
        {
          member_id: memberId,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
          video_position_seconds: 0,
        },
        { onConflict: 'member_id,lesson_id' }
      );

    // Award XP (10 per lesson)
    const { data: memberData } = await db
      .from('members')
      .select('xp, level, streak_current, streak_last_date')
      .eq('id', memberId)
      .single();

    if (memberData) {
      let newXp = (memberData.xp || 0) + 10;
      let newStreak = memberData.streak_current || 0;
      const today = new Date().toISOString().split('T')[0];
      const lastDate = memberData.streak_last_date?.split('T')[0];

      if (lastDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        newStreak = lastDate === yesterday ? newStreak + 1 : 1;
      }

      // Level nomeado por faixa de XP. A coluna members.level e' TEXTO
      // (iniciante/explorador/construtor/mestre/lenda), entao gravamos o rotulo,
      // nao um numero (o codigo antigo concatenava string e nunca subia de nivel).
      const tierFor = (xp: number) =>
        xp >= 2000 ? 'lenda' : xp >= 1000 ? 'mestre' : xp >= 500 ? 'construtor' : xp >= 200 ? 'explorador' : 'iniciante';
      const newLevel = tierFor(newXp);

      await db
        .from('members')
        .update({
          xp: newXp,
          level: newLevel,
          streak_current: newStreak,
          streak_last_date: today,
        })
        .eq('id', memberId);

      // Check if module is fully complete for bonus XP
      const { data: modLessons } = await db
        .from('member_lessons')
        .select('id')
        .eq('module_id', lesson?.module_id)
        .eq('is_published', true);

      const { data: modProgress } = await db
        .from('member_progress')
        .select('lesson_id')
        .eq('member_id', memberId)
        .eq('completed', true);

      const modLessonIds = new Set((modLessons || []).map((l: any) => l.id));
      const completedModLessons = (modProgress || []).filter((p: any) => modLessonIds.has(p.lesson_id));

      if (completedModLessons.length >= modLessonIds.size) {
        // Module complete bonus (recalcula o nivel com o XP ja somado)
        await db
          .from('members')
          .update({ xp: newXp + 50, level: tierFor(newXp + 50) })
          .eq('id', memberId);
      }
    }

    // Show celebration
    setCelebration(true);
    setTimeout(() => setCelebration(false), 3000);

    // Refresh sidebar
    setModuleLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, completed: true } : l))
    );

    toast({
      title: 'Aula concluida!',
      description: '+10 XP ganhos',
    });
  };

  const handleQuizSubmit = async () => {
    if (quizQuestions.length === 0) return;
    const answers = [...quizAnswers, selectedAnswer!];
    let correct = 0;
    answers.forEach((ans, i) => {
      if (quizQuestions[i] && ans === quizQuestions[i].correct) correct++;
    });
    const score = Math.round((correct / quizQuestions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);

    // Award XP for quiz
    if (memberId) {
      const { data: memberData } = await db
        .from('members')
        .select('xp')
        .eq('id', memberId)
        .single();

      await db
        .from('members')
        .update({ xp: (memberData?.xp || 0) + 100 })
        .eq('id', memberId);

      await db
        .from('member_progress')
        .upsert(
          {
            member_id: memberId,
            lesson_id: lessonId,
            completed: true,
            completed_at: new Date().toISOString(),
            quiz_score: score,
          },
          { onConflict: 'member_id,lesson_id' }
        );
    }

    setCelebration(true);
    setTimeout(() => setCelebration(false), 3000);
  };

  const fileIcon = (type: string) => {
    if (type?.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    return <File className="w-4 h-4 text-blue-400" />;
  };

  if (!lesson) {
    return (
      <MembrosLayout>
        <div className="space-y-4">
          <div className="aspect-video bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-8 w-64 bg-white/5 rounded animate-pulse" />
        </div>
      </MembrosLayout>
    );
  }

  return (
    <MembrosLayout>
      {/* Celebration overlay */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-[#141414] border border-[#3B82F6]/30 rounded-2xl p-8 text-center shadow-2xl"
            >
              <PartyPopper className="w-12 h-12 text-[#3B82F6] mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white">Parabens!</h3>
              <p className="text-white/50 mt-1">Voce concluiu esta aula</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Zap className="w-5 h-5 text-[#3B82F6]" />
                <span className="text-[#3B82F6] font-bold">
                  +{lesson.type === 'quiz' ? 100 : 10} XP
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Link to="/membros/trilhas" className="hover:text-white transition-colors">
              Trilhas
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/60">{moduleName}</span>
          </div>

          {/* Video player */}
          {lesson.content_url && lesson.type !== 'quiz' && (
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black">
              <video
                ref={videoRef}
                src={(lesson.content_url || '') + (lesson.clip_start_seconds || lesson.clip_end_seconds ? `#t=${lesson.clip_start_seconds || 0}${lesson.clip_end_seconds ? ',' + lesson.clip_end_seconds : ''}` : '')}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                className="w-full aspect-video"
                poster={lesson.thumbnail_url || undefined}
                onPlay={handleVideoPlay}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onTimeUpdate={handleVideoTimeUpdate}
              />
              {/* Marca d'agua dinamica: identifica o aluno em caso de vazamento */}
              {watermark && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div
                    className="absolute whitespace-nowrap text-white/20 text-[11px] sm:text-sm font-medium select-none drop-shadow"
                    style={{ animation: 'wm-float 19s linear infinite' }}
                  >
                    {watermark}
                  </div>
                  <style>{`@keyframes wm-float {
                    0%   { top: 8%;  left: 4%; }
                    25%  { top: 72%; left: 58%; }
                    50%  { top: 42%; left: 22%; }
                    75%  { top: 84%; left: 46%; }
                    100% { top: 8%;  left: 4%; }
                  }`}</style>
                </div>
              )}
            </div>
          )}

          {/* Lesson info */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">{lesson.title}</h1>
                {lesson.description && (
                  <p className="text-white/50 mt-2">{lesson.description}</p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  {lesson.duration_minutes && (
                    <Badge className="bg-white/10 text-white/60 border-white/10 text-xs">
                      {lesson.duration_minutes} min
                    </Badge>
                  )}
                  {completed && (
                    <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Concluida
                    </Badge>
                  )}
                </div>
              </div>
              {!completed && lesson.type !== 'quiz' && (
                <Button
                  onClick={markComplete}
                  className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90 font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Marcar como concluida
                </Button>
              )}
            </div>
          </div>

          {/* Descritivo de apoio */}
          {(lesson as any).support_description && (
            <Card className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-[#3B82F6] uppercase tracking-wider mb-2">Sobre esta aula</h3>
                <p className="text-white/80 text-sm whitespace-pre-line leading-relaxed">
                  {(lesson as any).support_description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Materiais de apoio */}
          {Array.isArray((lesson as any).support_materials) && (lesson as any).support_materials.length > 0 && (
            <Card className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-[#3B82F6] uppercase tracking-wider mb-3">
                  Materiais de apoio
                </h3>
                <div className="space-y-2">
                  {(lesson as any).support_materials.map((mat: any, i: number) => (
                    <a
                      key={i}
                      href={mat.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#3B82F6]/40 rounded-xl transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/15 flex items-center justify-center flex-shrink-0 group-hover:bg-[#3B82F6]/25">
                        <span className="text-[#3B82F6] text-xs font-bold uppercase">
                          {mat.type === 'tool' ? 'FER' : mat.type === 'doc' ? 'DOC' : mat.type === 'video' ? 'VID' : 'URL'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{mat.title || mat.url}</p>
                        {mat.description && (
                          <p className="text-xs text-white/50 mt-0.5">{mat.description}</p>
                        )}
                        <p className="text-[11px] text-white/30 mt-0.5 truncate">{mat.url}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz section */}
          {lesson.type === 'quiz' && quizQuestions.length > 0 && !quizSubmitted && (
            <Card className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-[#3B82F6]" />
                  <h3 className="text-lg font-semibold text-white">
                    Questao {currentQuestion + 1} de {quizQuestions.length}
                  </h3>
                </div>
                <Progress
                  value={((currentQuestion + 1) / quizQuestions.length) * 100}
                  className="h-1 bg-white/10 [&>div]:bg-[#3B82F6] mb-6"
                />
                <p className="text-white text-lg mb-6">
                  {quizQuestions[currentQuestion]?.question}
                </p>
                <div className="space-y-3">
                  {(quizQuestions[currentQuestion]?.options || []).map(
                    (opt: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => setSelectedAnswer(i)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          selectedAnswer === i
                            ? 'bg-[#3B82F6]/15 border-[#3B82F6]/30 text-white'
                            : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                        }`}
                      >
                        <span className="font-medium mr-2">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                      </button>
                    )
                  )}
                </div>
                <div className="flex justify-end mt-6">
                  {currentQuestion < quizQuestions.length - 1 ? (
                    <Button
                      disabled={selectedAnswer === null}
                      onClick={() => {
                        setQuizAnswers([...quizAnswers, selectedAnswer!]);
                        setSelectedAnswer(null);
                        setCurrentQuestion(currentQuestion + 1);
                      }}
                      className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90 font-semibold"
                    >
                      Proxima
                    </Button>
                  ) : (
                    <Button
                      disabled={selectedAnswer === null}
                      onClick={handleQuizSubmit}
                      className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90 font-semibold"
                    >
                      Enviar respostas
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz result */}
          {quizSubmitted && (
            <Card className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-6 text-center">
                <Award className="w-12 h-12 text-[#3B82F6] mx-auto mb-3" />
                <h3 className="text-xl font-bold text-white">Quiz concluido!</h3>
                <p className="text-4xl font-bold text-[#3B82F6] mt-4">{quizScore}%</p>
                <p className="text-white/50 mt-2">
                  Voce acertou {Math.round((quizScore / 100) * quizQuestions.length)} de{' '}
                  {quizQuestions.length} questoes
                </p>
                <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 mt-4">
                  +100 XP ganhos
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* PDF resumo da aula (gerado pela IA apos transcricao) */}
          {lesson.pdf_url && (
            <Card className="bg-gradient-to-br from-[#3B82F6]/10 to-amber-500/5 border-[#3B82F6]/30 rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-[#3B82F6]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Resumo em PDF</h3>
                    <p className="text-xs text-white/50 mb-3">
                      Material de apoio gerado por IA com os principais pontos da aula, timestamps e exercicios.
                    </p>
                    <a
                      href={lesson.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B82F6] text-black font-semibold text-sm hover:bg-[#FFE066] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Baixar PDF
                    </a>
                  </div>
                </div>
                {Array.isArray(lesson.ai_key_points) && lesson.ai_key_points.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 font-semibold">Pontos-chave</p>
                    <ul className="space-y-1.5">
                      {lesson.ai_key_points.slice(0, 5).map((kp, i) => (
                        <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                          <span className="text-[#3B82F6] font-bold">•</span>
                          {kp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <Card className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Materiais Adicionais</h3>
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-colors"
                    >
                      {fileIcon(att.file_type)}
                      <span className="text-sm text-white flex-1">{att.title}</span>
                      <Badge className="bg-white/10 text-white/50 border-white/10 text-[10px] uppercase">
                        {att.file_type}
                      </Badge>
                      <Download className="w-4 h-4 text-white/30" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: lesson list */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
          {/* Travado? Chama o time, no topo do sidebar */}
          <MemberHelpCard lessonId={lesson.id} />

          <Card className="bg-white/5 border-white/10 rounded-2xl sticky top-24">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                {moduleName}
              </h3>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {moduleLessons
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((l, i) => {
                    const isCurrent = l.id === lessonId;
                    return (
                      <Link
                        key={l.id}
                        to={`/membros/aula/${l.id}`}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          isCurrent
                            ? 'bg-[#3B82F6]/10 border border-[#3B82F6]/20'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            l.completed
                              ? 'bg-green-500/20 text-green-400'
                              : isCurrent
                              ? 'bg-[#3B82F6]/20 text-[#3B82F6]'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {l.completed ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span
                          className={`text-sm truncate ${
                            isCurrent ? 'text-[#3B82F6] font-medium' : 'text-white/70'
                          }`}
                        >
                          {l.title}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tutor IA flutuante: botao bottom-right que abre painel de chat */}
      <LessonTutorChat lessonId={lesson.id} lessonTitle={lesson.title} />
    </MembrosLayout>
  );
}
