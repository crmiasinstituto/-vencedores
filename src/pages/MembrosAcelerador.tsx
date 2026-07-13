import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MembrosLayout } from '@/components/membros/MembrosLayout';
import { TroubleshootingFAQ } from '@/components/membros/accelerators/TroubleshootingFAQ';
import {
  CATEGORY_CONFIG,
  DIFFICULTY_COLOR,
  IMPORT_METHOD_LABELS,
  type Accelerator,
} from '@/components/membros/accelerators/types';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  CheckCircle2,
  Layers,
  Sparkles,
  Rocket,
  Lightbulb,
  Eye,
  FolderDown,
  Terminal,
  Settings,
  Wand2,
  Bot,
  PlayCircle,
} from 'lucide-react';

const db = supabase as any;

// AI FIRST: membros NOVOS liberam 15 dias apos assinar (contrato vigente);
// membros ja ativos (signature_required=false) ficam sempre liberados.
async function aiFirstUnlocked(): Promise<boolean> {
  try {
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) return false;
    const sess = JSON.parse(raw);
    const { data: contract } = await db.from('member_contracts')
      .select('signed_at, access_ends_on, signature_required')
      .eq('member_id', sess.member_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!contract || contract.signature_required !== true || !contract.signed_at) return true;
    const unlockDate = new Date(contract.signed_at);
    unlockDate.setDate(unlockDate.getDate() + 15);
    const today = new Date();
    const expired = !!contract.access_ends_on && new Date(contract.access_ends_on + 'T23:59:59') < today;
    return today >= unlockDate && !expired;
  } catch { return false; }
}

// mp4/webm/mov hospedado (Backblaze) usa <video>; YouTube/Vimeo usa <iframe>.
function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

// 3 passos do "Como usar", por método de import.
const STEP_SETS: Record<
  string,
  { icon: any; color: string; title: string; desc: string }[]
> = {
  'claude-code': [
    { icon: FolderDown, color: '#3B82F6', title: 'Baixe o projeto', desc: 'Clique em "Baixar ZIP" e salve no seu computador.' },
    { icon: Terminal, color: '#8B5CF6', title: 'Abra com Claude Code', desc: 'Descompacte a pasta e abra com o Claude Code no terminal.' },
    { icon: Settings, color: '#10B981', title: 'Configure e use', desc: 'Peça ao Claude Code para configurar o projeto. Ele faz tudo pra você.' },
  ],
  lovable: [
    { icon: FolderDown, color: '#3B82F6', title: 'Baixe ou remixe', desc: 'Baixe o ZIP ou abra direto no Lovable pelo botão.' },
    { icon: Wand2, color: '#8B5CF6', title: 'Importe no Lovable', desc: 'Suba o projeto e conecte seu Supabase nas configurações.' },
    { icon: Settings, color: '#10B981', title: 'Configure e use', desc: 'Rode as migrations SQL e ajuste as variáveis de ambiente.' },
  ],
  'gpt-agent': [
    { icon: FolderDown, color: '#3B82F6', title: 'Baixe o material', desc: 'Baixe o arquivo e abra no seu agente / GPT preferido.' },
    { icon: Bot, color: '#8B5CF6', title: 'Cole o contexto', desc: 'Cole o prompt ou contexto fornecido no acelerador.' },
    { icon: Settings, color: '#10B981', title: 'Adapte e use', desc: 'Ajuste nomes de tabelas e campos pro seu projeto.' },
  ],
};

export default function MembrosAcelerador() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [accel, setAccel] = useState<Accelerator | null>(null);
  const [moduleTitle, setModuleTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [method, setMethod] = useState<string>('claude-code');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const load = async () => {
    setLoading(true);
    // Gate 30 dias: bloqueia deep-link antes da liberacao dos aceleradores.
    if (!(await aiFirstUnlocked())) { navigate('/membros/ai-first'); return; }
    const { data } = await db
      .from('member_files')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .maybeSingle();

    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setAccel(data as Accelerator);
    const methods: string[] =
      Array.isArray(data.import_methods) && data.import_methods.length
        ? data.import_methods
        : ['claude-code'];
    setMethod(methods[0]);

    if (data.related_module_id) {
      const { data: mod } = await db
        .from('modules')
        .select('title')
        .eq('id', data.related_module_id)
        .maybeSingle();
      if (mod) setModuleTitle(mod.title);
    }
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!accel) return;
    await db
      .from('member_files')
      .update({ download_count: (accel.download_count || 0) + 1 })
      .eq('id', accel.id);
    setAccel({ ...accel, download_count: (accel.download_count || 0) + 1 });
    window.open(accel.file_url, '_blank');
  };

  if (loading) {
    return (
      <MembrosLayout>
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="h-8 w-40 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-56 bg-white/5 rounded-3xl animate-pulse" />
          <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </MembrosLayout>
    );
  }

  if (notFound || !accel) {
    return (
      <MembrosLayout>
        <div className="text-center py-24">
          <p className="text-white/40">Acelerador não encontrado.</p>
          <Button
            onClick={() => navigate('/membros/ai-first')}
            variant="ghost"
            className="mt-4 text-[#3B82F6]"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Voltar pros Aceleradores
          </Button>
        </div>
      </MembrosLayout>
    );
  }

  const config = CATEGORY_CONFIG[accel.category] || CATEGORY_CONFIG.geral;
  const diffColor = accel.difficulty ? DIFFICULTY_COLOR[accel.difficulty] : null;
  const isZip = accel.file_type === 'zip';
  const downloadLabel = isZip ? 'Baixar ZIP' : 'Baixar arquivo';
  const methods: string[] =
    Array.isArray(accel.import_methods) && accel.import_methods.length
      ? accel.import_methods
      : ['claude-code'];
  const steps = STEP_SETS[method] || STEP_SETS['claude-code'];

  const DownloadBtn = ({ size = 'lg' }: { size?: 'lg' | 'default' }) => (
    <Button
      onClick={handleDownload}
      size={size}
      className="bg-[#3B82F6] text-black hover:bg-[#FFE066] font-semibold rounded-xl shadow-[0_4px_20px_rgba(250,200,0,0.25)]"
    >
      <Download className="w-5 h-5 mr-2" />
      {downloadLabel}
    </Button>
  );

  return (
    <MembrosLayout>
      <div className="max-w-4xl mx-auto space-y-10 pb-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-white/35">
          <Link to="/membros" className="hover:text-white/70">Início</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/membros/ai-first" className="hover:text-white/70">Aceleradores</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white/60 truncate">{accel.title}</span>
        </div>

        {/* Back */}
        <Link
          to="/membros/ai-first"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors -mt-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 p-8 md:p-10"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#3B82F6]/12 via-[#8B5CF6]/8 to-transparent" />
          {accel.thumbnail && (
            <div className="pointer-events-none absolute inset-0 opacity-20">
              <img src={accel.thumbnail} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-[#070707]/70" />
            </div>
          )}
          <div className="relative space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className="border"
                style={{
                  backgroundColor: `${config.color}20`,
                  color: config.color,
                  borderColor: `${config.color}40`,
                }}
              >
                {config.label}
              </Badge>
              {(accel.tags || []).slice(0, 3).map((t) => (
                <Badge key={t} className="bg-white/10 text-white/70 border border-white/15">
                  {t}
                </Badge>
              ))}
              <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                Construção guiada por IA
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white">{accel.title}</h1>
            {accel.description && (
              <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed">
                {accel.description}
              </p>
            )}

            <div className="flex items-center gap-4 flex-wrap pt-1">
              <DownloadBtn />
              {diffColor && (
                <Badge
                  className="border"
                  style={{
                    backgroundColor: `${diffColor}15`,
                    color: diffColor,
                    borderColor: `${diffColor}30`,
                  }}
                >
                  {accel.difficulty}
                </Badge>
              )}
              {accel.setup_time && (
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {accel.setup_time}
                </span>
              )}
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                {accel.download_count || 0} downloads
              </span>
            </div>
          </div>
        </motion.div>

        {/* Módulo vinculado */}
        {accel.related_module_id && (
          <Link to="/membros/trilhas" className="block group">
            <div className="rounded-2xl border border-[#8B5CF6]/30 bg-gradient-to-r from-[#8B5CF6]/10 to-transparent p-5 flex items-center gap-4 hover:border-[#8B5CF6]/50 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6 text-[#8B5CF6]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#8B5CF6] font-semibold uppercase tracking-wide">
                  Módulo vinculado
                </p>
                <p className="text-white font-medium truncate">
                  {moduleTitle || 'Ver trilha relacionada'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white transition-colors" />
            </div>
          </Link>
        )}

        {/* Aula de instrução */}
        {accel.video_url && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-[#3B82F6]" />
              {accel.video_title || 'Aula de instrução'}
            </h2>
            <div className="rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black">
              {isDirectVideo(accel.video_url) ? (
                <video src={accel.video_url} controls className="w-full h-full" />
              ) : (
                <iframe
                  src={accel.video_url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={accel.video_title || accel.title}
                />
              )}
            </div>
          </section>
        )}

        {/* Como usar */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#3B82F6]" />
              Como usar
            </h2>
            {methods.length > 1 && (
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                {methods.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      method === m
                        ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                        : 'text-white/45 hover:text-white'
                    }`}
                  >
                    {IMPORT_METHOD_LABELS[m] || m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${step.color}22` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: step.color }} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#3B82F6]">
                    Passo {i + 1}
                  </p>
                  <p className="text-white font-semibold">{step.title}</p>
                  <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>

          {method === 'lovable' && accel.lovable_remix_url && (
            <Button
              asChild
              variant="outline"
              className="border-white/15 text-white hover:bg-white/5 rounded-xl"
            >
              <a href={accel.lovable_remix_url} target="_blank" rel="noopener noreferrer">
                <Wand2 className="w-4 h-4 mr-1.5" />
                Abrir no Lovable
              </a>
            </Button>
          )}
        </section>

        {/* O que vem incluído */}
        {accel.features && accel.features.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#3B82F6]" />
              O que vem incluído
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accel.features.map((f, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70 leading-relaxed">{f}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stack */}
        {accel.stack && accel.stack.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#3B82F6]" />
              Stack
            </h2>
            <div className="flex flex-wrap gap-2">
              {accel.stack.map((s, i) => (
                <Badge key={i} className="bg-white/5 text-white/70 border border-white/10">
                  {s}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* O que você precisa saber */}
        {accel.prerequisites && accel.prerequisites.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#3B82F6]" />
              O que você precisa saber
            </h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {accel.prerequisites.map((p, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-2 flex-shrink-0" />
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#3B82F6] hover:underline"
                      >
                        {p.label}
                      </a>
                    ) : (
                      <span className="text-sm text-white/70">{p.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sobre o projeto */}
        {accel.long_description && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#3B82F6]" />
              Sobre o projeto
            </h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-sm text-white/65 whitespace-pre-wrap leading-relaxed">
                {accel.long_description}
              </p>
            </div>
          </section>
        )}

        {/* Código: env / sql / documentação */}
        {accel.env_example && (
          <CodeBlock title="Variáveis de ambiente" code={accel.env_example} />
        )}
        {accel.sql_migrations && (
          <CodeBlock title="SQL / Migrations" code={accel.sql_migrations} />
        )}
        {accel.documentation && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">Documentação</h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-sm text-white/65 whitespace-pre-wrap leading-relaxed">
                {accel.documentation}
              </p>
            </div>
          </section>
        )}

        {/* Dúvidas frequentes */}
        {accel.troubleshooting && (
          <TroubleshootingFAQ
            troubleshooting={accel.troubleshooting}
            title="Dúvidas frequentes"
          />
        )}

        {/* CTA final */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <DownloadBtn />
          <p className="text-xs text-white/35">
            {isZip
              ? 'Inclui o projeto completo pra você descompactar e montar o seu.'
              : 'Baixe e use no seu desenvolvimento.'}
          </p>
        </div>
      </div>
    </MembrosLayout>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <pre className="rounded-xl bg-black/60 border border-white/10 p-4 overflow-x-auto">
        <code className="text-xs text-white/70 font-mono whitespace-pre">{code}</code>
      </pre>
    </section>
  );
}
