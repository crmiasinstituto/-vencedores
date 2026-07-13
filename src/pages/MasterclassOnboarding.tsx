// /masterclass/onboarding/:token
// Wizard pós-compra Kirvano. Lead chega via link único enviado por WhatsApp/email.
// 6 etapas:
//   1) Boas-vindas (confirma identidade + brinde DISC se nao tem)
//   2) Perfil profissional (flexivel: empresario, CLT, transicao, autonomo)
//   3) Maturidade IA + ferramentas
//   4) Expectativa Masterclass + receptivo a mentoria
//   5) Selfie (LGPD consent + camera + upload Storage)
//   6) Confirmacao + info do evento (endereco, data, calendar)

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ChevronRight, ChevronLeft, Sparkles, Calendar, MapPin, Camera, CheckCircle2,
  AlertCircle, Briefcase, Brain, Target, Phone,
} from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  instagram: string | null;
  instagram_profile_pic_url: string | null;
  disc_profile: string | null;
  ai_analysis: any;
  perfil_profissional: string | null;
  area_interesse: string | null;
  tipo_negocio: string | null;
  faturamento_faixa: string | null;
  equipe_faixa: string | null;
  maturidade_ia: string | null;
  ferramentas_ia: string[] | null;
  expectativa_mc: string | null;
  expectativa_mc_extra: string | null;
  receptivo_mentoria: string | null;
  face_url: string | null;
  onboarding_completed_at: string | null;
  kirvano_amount: number | null;
}

const STEPS = [
  { id: 1, label: "Boas-vindas" },
  { id: 2, label: "Você" },
  { id: 3, label: "IA" },
  { id: 4, label: "Expectativa" },
  { id: 5, label: "Selfie" },
  { id: 6, label: "Pronto!" },
];

export default function MasterclassOnboarding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // form state
  const [perfil, setPerfil] = useState<string>("");
  const [areaInteresse, setAreaInteresse] = useState<string>("");
  const [tipoNegocio, setTipoNegocio] = useState<string>("");
  const [faturamento, setFaturamento] = useState<string>("");
  const [equipe, setEquipe] = useState<string>("");
  const [maturidade, setMaturidade] = useState<string>("");
  const [ferramentas, setFerramentas] = useState<string[]>([]);
  const [expectativa, setExpectativa] = useState<string>("");
  const [expectativaExtra, setExpectativaExtra] = useState<string>("");
  const [receptivoMentoria, setReceptivoMentoria] = useState<string>("");
  const [faceUrl, setFaceUrl] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    (supabase as any).rpc("onboarding_get_lead", { p_token: token }).then(({ data, error }) => {
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLead(data as Lead);
      // Pré-preenche se já tinha salvo antes
      setPerfil(data.perfil_profissional || "");
      setAreaInteresse(data.area_interesse || "");
      setTipoNegocio(data.tipo_negocio || "");
      setFaturamento(data.faturamento_faixa || "");
      setEquipe(data.equipe_faixa || "");
      setMaturidade(data.maturidade_ia || "");
      setFerramentas(data.ferramentas_ia || []);
      setExpectativa(data.expectativa_mc || "");
      setExpectativaExtra(data.expectativa_mc_extra || "");
      setReceptivoMentoria(data.receptivo_mentoria || "");
      setFaceUrl(data.face_url || "");
      // Se já completou, pula pra última etapa
      if (data.onboarding_completed_at) setStep(6);
      setLoading(false);
    });
  }, [token]);

  async function saveAndAdvance(payload: any, nextStep?: number) {
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("onboarding_save_step", {
      p_token: token,
      p_data: payload,
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast.error("Não consegui salvar", { description: error?.message || data?.reason });
      return;
    }
    if (nextStep) setStep(nextStep);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }
  if (notFound || !lead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black text-white p-6">
        <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
        <h1 className="text-xl font-bold">Link inválido ou expirado</h1>
        <p className="text-sm text-zinc-400 mt-2 text-center max-w-md">
          Esse link de onboarding não foi encontrado. Confira se você usou a URL completa que enviamos no WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Onboarding · Masterclass IA — + que Vencedores</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white pb-16">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-black/60 border-b border-zinc-800">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3B82F6]" />
              <span className="text-xs uppercase tracking-widest font-semibold text-zinc-300">Masterclass IA</span>
            </div>
            <div className="flex items-center gap-1">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    s.id <= step ? "bg-[#3B82F6]" : "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-5 pt-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepWelcome key="s1" lead={lead} onNext={() => setStep(2)} />
            )}
            {step === 2 && (
              <StepPerfil
                key="s2"
                values={{ perfil, areaInteresse, tipoNegocio, faturamento, equipe }}
                onChange={{
                  perfil: setPerfil, areaInteresse: setAreaInteresse,
                  tipoNegocio: setTipoNegocio, faturamento: setFaturamento, equipe: setEquipe,
                }}
                saving={saving}
                onBack={() => setStep(1)}
                onNext={() => saveAndAdvance({
                  perfil_profissional: perfil, area_interesse: areaInteresse,
                  tipo_negocio: tipoNegocio, equipe_faixa: equipe,
                }, 3)}
              />
            )}
            {step === 3 && (
              <StepIA
                key="s3"
                values={{ maturidade, ferramentas }}
                onChange={{ maturidade: setMaturidade, ferramentas: setFerramentas }}
                saving={saving}
                onBack={() => setStep(2)}
                onNext={() => saveAndAdvance({ maturidade_ia: maturidade, ferramentas_ia: ferramentas }, 4)}
              />
            )}
            {step === 4 && (
              <StepExpectativa
                key="s4"
                values={{ expectativa, expectativaExtra, receptivoMentoria }}
                onChange={{
                  expectativa: setExpectativa, expectativaExtra: setExpectativaExtra,
                  receptivoMentoria: setReceptivoMentoria,
                }}
                saving={saving}
                onBack={() => setStep(3)}
                onNext={() => saveAndAdvance({
                  expectativa_mc: expectativa, expectativa_mc_extra: expectativaExtra,
                }, 5)}
              />
            )}
            {step === 5 && (
              <StepSelfie
                key="s5"
                leadId={lead.id}
                token={token!}
                faceUrl={faceUrl}
                onFaceUrl={setFaceUrl}
                onBack={() => setStep(4)}
                onNext={() => saveAndAdvance({ mark_completed: true }, 6)}
              />
            )}
            {step === 6 && (
              <StepConfirma key="s6" lead={lead} />
            )}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────
function StepWelcome({ lead, onNext }: { lead: Lead; onNext: () => void }) {
  const firstName = (lead.name || "").trim().split(" ")[0];
  const hasDisc = !!lead.disc_profile;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      {lead.instagram_profile_pic_url && (
        <div className="flex justify-center">
          <img
            src={lead.instagram_profile_pic_url}
            alt={lead.name}
            className="w-20 h-20 rounded-full ring-2 ring-[#3B82F6]/60 object-cover"
          />
        </div>
      )}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Oi {firstName}! 👋
        </h1>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          Que bom ter você na <strong className="text-white">Masterclass IA para Negócios</strong>.
          Antes de te ver presencialmente no dia <strong className="text-[#3B82F6]">09/06</strong>, preciso te conhecer um pouquinho melhor.
        </p>
      </div>

      {hasDisc ? (
        <div className="rounded-xl border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#3B82F6]">
            <Sparkles className="w-3.5 h-3.5" /> Já vi seu perfil
          </div>
          <p className="text-sm mt-2">
            Seu DISC deu <strong className="text-[#3B82F6]">{lead.disc_profile}</strong>.
            {lead.kirvano_amount && <> Compra confirmada — você tá dentro! 🚀</>}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-blue-300">
            <Sparkles className="w-3.5 h-3.5" /> Brinde
          </div>
          <p className="text-sm mt-2">
            Vou te dar o DISC + análise de Instagram <strong>de presente</strong> depois desse onboarding (3 min extras).
          </p>
        </div>
      )}

      <p className="text-xs text-zinc-500 text-center">
        ⏱️ Leva uns 3 minutinhos · sem login, sem senha
      </p>

      <Button onClick={onNext} className="w-full bg-[#3B82F6] text-black font-semibold hover:bg-[#3B82F6]/90 h-12">
        Bora começar <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </motion.div>
  );
}

// ─── Step 2: Perfil profissional ──────────────────────────────────────────────
const PERFIS = [
  { value: "empresario", label: "Empresário (sócio / CEO)", icon: "🚀" },
  { value: "diretor_gerente", label: "Diretor / Gerente em empresa", icon: "💼" },
  { value: "autonomo", label: "Autônomo / Consultor", icon: "🎯" },
  { value: "clt", label: "CLT / Funcionário", icon: "🏢" },
  { value: "transicao", label: "Em transição de carreira", icon: "🔄" },
  { value: "estudante", label: "Estudante / Recém-formado", icon: "🎓" },
];

const TIPOS_NEGOCIO = [
  "E-commerce / Loja virtual", "Serviços (consultoria, agência, etc)", "Saúde / Bem-estar",
  "Beleza / Estética", "Educação / Cursos", "Indústria / Manufatura", "Tech / SaaS",
  "Imobiliário", "Alimentação / Food", "Eventos", "Outro",
];

const EQUIPES = ["Só eu", "2 a 5", "6 a 20", "21 a 100", "100+"];

function StepPerfil({ values, onChange, saving, onBack, onNext }: any) {
  const showEmpresarioFields = ["empresario", "diretor_gerente", "autonomo"].includes(values.perfil);
  const canNext = !!values.perfil && (showEmpresarioFields ? !!values.tipoNegocio : !!values.areaInteresse);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#3B82F6]">
          <Briefcase className="w-3.5 h-3.5" /> Etapa 2 de 6
        </div>
        <h2 className="text-xl font-bold mt-2">Onde você está hoje?</h2>
      </div>

      <div className="space-y-2">
        {PERFIS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange.perfil(p.value)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
              values.perfil === p.value
                ? "border-[#3B82F6] bg-[#3B82F6]/10"
                : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
            }`}
          >
            <span className="text-xl">{p.icon}</span>
            <span className="text-sm">{p.label}</span>
          </button>
        ))}
      </div>

      {showEmpresarioFields && (
        <>
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2 block">Tipo de negócio</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_NEGOCIO.map((t) => (
                <button
                  key={t}
                  onClick={() => onChange.tipoNegocio(t)}
                  className={`px-3 py-2 rounded-lg border text-xs text-left ${
                    values.tipoNegocio === t ? "border-[#3B82F6] bg-[#3B82F6]/10" : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2 block">Equipe</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPES.map((e) => (
                <button
                  key={e}
                  onClick={() => onChange.equipe(e)}
                  className={`px-3 py-2 rounded-full border text-xs ${
                    values.equipe === e ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]" : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >{e}</button>
              ))}
            </div>
          </div>
        </>
      )}
      {!showEmpresarioFields && values.perfil && (
        <div>
          <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2 block">
            Em que área você está / quer atuar?
          </label>
          <Input
            value={values.areaInteresse}
            onChange={(e) => onChange.areaInteresse(e.target.value)}
            placeholder="Ex: marketing, vendas, tecnologia, RH…"
            className="bg-zinc-900/60 border-zinc-700"
          />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!canNext || saving}
          className="flex-1 bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90 h-12"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Próximo <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Step 3: Maturidade IA ────────────────────────────────────────────────────
const MATURIDADES = [
  { value: "nao_uso", label: "Não uso ainda", desc: "Nunca mexi seriamente" },
  { value: "pessoal", label: "Pra mim mesmo", desc: "Uso ChatGPT/etc pra coisas pessoais" },
  { value: "negocio_manual", label: "Pro meu negócio (rotina manual)", desc: "Uso mas tudo na mão" },
  { value: "automatizado", label: "Automatizado", desc: "Já tenho fluxos, n8n, agentes" },
];
const FERRAMENTAS = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Midjourney", "n8n", "Make / Zapier", "Outras"];

function StepIA({ values, onChange, saving, onBack, onNext }: any) {
  const toggleFerr = (f: string) => {
    if (values.ferramentas.includes(f)) {
      onChange.ferramentas(values.ferramentas.filter((x: string) => x !== f));
    } else {
      onChange.ferramentas([...values.ferramentas, f]);
    }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#3B82F6]">
          <Brain className="w-3.5 h-3.5" /> Etapa 3 de 6
        </div>
        <h2 className="text-xl font-bold mt-2">Como você se relaciona com IA hoje?</h2>
      </div>

      <div className="space-y-2">
        {MATURIDADES.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange.maturidade(m.value)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              values.maturidade === m.value
                ? "border-[#3B82F6] bg-[#3B82F6]/10"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <div className="text-sm font-semibold">{m.label}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2 block">
          Quais ferramentas você já mexeu? (pode marcar várias)
        </label>
        <div className="flex flex-wrap gap-2">
          {FERRAMENTAS.map((f) => (
            <button
              key={f}
              onClick={() => toggleFerr(f)}
              className={`px-3 py-2 rounded-full border text-xs ${
                values.ferramentas.includes(f)
                  ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]"
                  : "border-zinc-800 bg-zinc-900/40"
              }`}
            >{f}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!values.maturidade || saving}
          className="flex-1 bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90 h-12"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Próximo <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Step 4: Expectativa ──────────────────────────────────────────────────────
const EXPECTATIVAS = [
  { value: "mais_receita", label: "+ Receita / + Vendas", icon: "💰" },
  { value: "menos_custo", label: "− Custo / + Eficiência", icon: "⚡" },
  { value: "mais_tempo", label: "+ Tempo (automatizar tarefas)", icon: "⏰" },
  { value: "treinar_equipe", label: "Treinar / escalar equipe", icon: "👥" },
  { value: "aprender_metodo", label: "Aprender método pra aplicar", icon: "🧭" },
];

function StepExpectativa({ values, onChange, saving, onBack, onNext }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#3B82F6]">
          <Target className="w-3.5 h-3.5" /> Etapa 4 de 6
        </div>
        <h2 className="text-xl font-bold mt-2">O que você quer tirar dessa Masterclass?</h2>
      </div>

      <div className="space-y-2">
        {EXPECTATIVAS.map((e) => (
          <button
            key={e.value}
            onClick={() => onChange.expectativa(e.value)}
            className={`w-full text-left px-4 py-3 rounded-xl border flex items-center gap-3 ${
              values.expectativa === e.value ? "border-[#3B82F6] bg-[#3B82F6]/10" : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <span className="text-xl">{e.icon}</span>
            <span className="text-sm">{e.label}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2 block">
          Algo específico que você quer ver no dia? (opcional)
        </label>
        <Textarea
          value={values.expectativaExtra}
          onChange={(e) => onChange.expectativaExtra(e.target.value)}
          placeholder="Ex: como cobrar mais caro, como prospectar com IA, automatizar follow-up…"
          className="bg-zinc-900/60 border-zinc-700"
          maxLength={300}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!values.expectativa || saving}
          className="flex-1 bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90 h-12"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Próximo <ChevronRight className="w-4 h-4 ml-1" /></>}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Step 5: Selfie ───────────────────────────────────────────────────────────
function StepSelfie({ leadId, token, faceUrl, onFaceUrl, onBack, onNext }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<"consent" | "camera" | "preview" | "uploading">(
    faceUrl ? "preview" : "consent",
  );
  const [previewUrl, setPreviewUrl] = useState<string>(faceUrl);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraErr, setCameraErr] = useState<string>("");

  // Atribui stream ao <video> SEMPRE que o stage virar "camera" (porque o <video>
  // só monta depois desse stage). Sem isso a tela fica preta.
  useEffect(() => {
    if (stage === "camera" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage]);

  async function startCamera() {
    setCameraErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage("camera"); // dispara useEffect acima que liga o stream no video
    } catch (e: any) {
      setCameraErr(e?.message || "Permita acesso à câmera nas configurações do navegador (cadeado da URL).");
    }
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const size = Math.min(v.videoWidth, v.videoHeight);
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    // Captura JA gera o Blob e armazena no estado. Isso evita o bug de o canvas
    // ser desmontado quando o stage muda pra 'preview' (canvas existia em 2 blocos
    // condicionais separados, ref apontava pro novo canvas vazio -> upload de 1KB preto).
    setPreviewUrl(c.toDataURL("image/jpeg", 0.85));
    c.toBlob((b) => setCapturedBlob(b), "image/jpeg", 0.85);
    setStage("preview");
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  const [uploadErr, setUploadErr] = useState<string>("");
  async function uploadAndSave() {
    if (!capturedBlob) {
      setUploadErr("Foto nao capturada. Tire de novo.");
      toast.error("Foto nao foi capturada", { description: "Clica em Tirar de novo." });
      return;
    }
    setStage("uploading");
    setUploadErr("");
    try {
      const blob = capturedBlob;
      console.log("[selfie] blob size:", blob.size, "bytes");
      const path = `${leadId}/${Date.now()}.jpg`;
      console.log("[selfie] upload path:", path);
      const { error: upErr, data: upData } = await supabase.storage
        .from("masterclass-onboarding")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) {
        console.error("[selfie] upload error:", upErr);
        const msg = `${(upErr as any).statusCode || ""} ${upErr.message || JSON.stringify(upErr)}`.trim();
        setUploadErr(`Upload falhou: ${msg}`);
        toast.error("Falha ao salvar foto", { description: msg });
        setStage("preview");
        return;
      }
      console.log("[selfie] upload OK:", upData);
      const { data: pub } = supabase.storage.from("masterclass-onboarding").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      console.log("[selfie] publicUrl:", publicUrl);
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc("onboarding_save_step", {
        p_token: token,
        p_data: { face_url: publicUrl },
      });
      if (rpcErr) {
        console.error("[selfie] rpc save error:", rpcErr);
        setUploadErr(`Salvar perfil falhou: ${rpcErr.message}`);
        toast.error("Falha ao gravar foto", { description: rpcErr.message });
        setStage("preview");
        return;
      }
      console.log("[selfie] rpc save OK:", rpcData);
      onFaceUrl(publicUrl);
      onNext();
    } catch (e: any) {
      console.error("[selfie] exception:", e);
      setUploadErr(`Erro: ${e?.message || String(e)}`);
      toast.error("Erro inesperado", { description: e?.message });
      setStage("preview");
    }
  }

  function retake() {
    setPreviewUrl("");
    setCapturedBlob(null);
    startCamera();
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#3B82F6]">
          <Camera className="w-3.5 h-3.5" /> Etapa 5 de 6
        </div>
        <h2 className="text-xl font-bold mt-2">Selfie pra check-in 📸</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Sua foto é usada SÓ pra acelerar a entrada no evento. Apagamos depois.
        </p>
      </div>

      {stage === "consent" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm space-y-2">
            <p>
              📍 <strong>Por que pedimos selfie?</strong>
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              No dia do evento (09/06), você apresenta apenas seu rosto na entrada e identificamos você
              instantaneamente. Sem fila, sem precisar abrir QR.
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              <strong className="text-amber-300">LGPD:</strong> usamos a foto APENAS pra check-in do dia 09/06.
              Apagamos todas as fotos até 7 dias depois do evento.
            </p>
          </div>
          <Button onClick={startCamera} className="w-full bg-[#3B82F6] text-black h-12 font-semibold">
            <Camera className="w-4 h-4 mr-2" /> Tô de boa, abrir câmera
          </Button>
          {cameraErr && <p className="text-xs text-red-400">{cameraErr}</p>}
        </div>
      )}

      {stage === "camera" && (
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden bg-black ring-2 ring-[#3B82F6]/40">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <Button onClick={capture} className="w-full bg-[#3B82F6] text-black h-12 font-semibold">
            📸 Tirar foto
          </Button>
        </div>
      )}

      {stage === "preview" && (
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden bg-black ring-2 ring-emerald-500/50">
            <img src={previewUrl} alt="selfie" className="w-full h-full object-cover" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {uploadErr && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200 font-mono break-all">
              ⚠️ {uploadErr}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={retake} className="flex-1 border-zinc-700">
              Tirar de novo
            </Button>
            <Button onClick={uploadAndSave} className="flex-1 bg-[#3B82F6] text-black font-semibold">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Tá boa, salvar
            </Button>
          </div>
        </div>
      )}

      {stage === "uploading" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex items-center gap-3 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
          Salvando sua foto…
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        {(stage === "consent" || stage === "preview") && faceUrl && (
          <Button onClick={onNext} className="flex-1 bg-[#3B82F6] text-black h-12 font-semibold">
            Pular (usar foto anterior) <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Step 6: Confirma + Info evento ───────────────────────────────────────────
function StepConfirma({ lead }: { lead: Lead }) {
  const firstName = (lead.name || "").split(" ")[0];
  const calendarUrl = useMemo(() => {
    const title = encodeURIComponent("Masterclass IA para Negócios — + que Vencedores");
    const details = encodeURIComponent(
      "Auditório Salvador Trade Center. Check-in 18h, início pontual 19h."
    );
    const location = encodeURIComponent("Av. Tancredo Neves, 1632 - Caminho das Árvores, Salvador - BA");
    // 9 jun 2026 18:00 BRT = 21:00 UTC
    const start = "20260609T210000Z";
    const end = "20260610T000000Z";
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6 pb-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 mb-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold">Tudo pronto, {firstName}! 🎉</h1>
        <p className="text-zinc-400 mt-2 text-sm">
          Te vejo dia <strong className="text-[#3B82F6]">09 de junho</strong>.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-[#3B82F6]/40 bg-[#3B82F6]/5 p-5 space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#3B82F6] font-bold">
          <Sparkles className="w-3 h-3" /> Masterclass IA para Negócios
        </div>
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">09 de junho · Terça-feira</div>
            <div className="text-sm text-zinc-300">
              <strong>Check-in: 18:00</strong> · <strong className="text-[#3B82F6]">Início pontual: 19:00</strong>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Chegue até <strong className="text-zinc-200">18:30</strong> pra check-in tranquilo. Começamos pontualmente às 19h.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 pt-3 border-t border-zinc-800">
          <MapPin className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Auditório Salvador Trade Center</div>
            <div className="text-sm text-zinc-300">
              Av. Tancredo Neves, 1632<br />
              Caminho das Árvores, Salvador — BA
            </div>
            <a
              href="https://maps.google.com/?q=Salvador+Trade+Center+Av+Tancredo+Neves+1632"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3B82F6] underline mt-1 inline-block"
            >
              Abrir no Google Maps →
            </a>
          </div>
        </div>
      </div>

      <a
        href={calendarUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full"
      >
        <Button variant="outline" className="w-full border-zinc-700 hover:bg-zinc-900 h-12">
          <Calendar className="w-4 h-4 mr-2" /> Adicionar ao Google Calendar
        </Button>
      </a>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400">
        💡 Salva esse link pra acessar o seu ingresso depois. Você também recebeu pelo WhatsApp.
      </div>
    </motion.div>
  );
}
