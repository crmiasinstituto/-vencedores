import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DiscCaptureModal, CaptureData } from "@/components/disc/DiscCaptureModal";
import { DiscLoading } from "@/components/disc/DiscLoading";
import { DiscQuiz, Dim } from "@/components/disc/DiscQuiz";
import { DiscResultScreen } from "@/components/disc/DiscResultScreen";
import { LeadAvatar } from "@/components/disc/LeadAvatar";
import { shareStoryCard } from "@/components/disc/generateStoryCard";

type Step = "capture" | "loading" | "quiz" | "result";

interface AnalysisPayload {
  profissao_inferida?: string;
  nicho?: string;
  tom_conteudo?: string;
  frequencia?: string;
  pontos_fortes?: string[];
  elogio_personalizado?: string;
}

export default function ReprogrameDisc() {
  const [step, setStep] = useState<Step>("capture");
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [capture, setCapture] = useState<CaptureData | null>(null);
  const [profile, setProfile] = useState<string>("");
  const [profileLabel, setProfileLabel] = useState<string>("");
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [pdfRequesting, setPdfRequesting] = useState(false);
  const [pdfRequested, setPdfRequested] = useState(false);
  const { toast } = useToast();

  // Variações de mensagem do lead → + que Vencedores.
  // Tom: empolgação real (quem acabou de receber uma análise impactante e quer agir agora).
  // Emojis simples e suportados em todos os celulares.
  const LEAD_MESSAGE_VARIANTS = [
    "Preciso desse diagnóstico!",
  ];
  const SQUAAD_PUBLIC_WHATSAPP =
    (import.meta as any).env?.VITE_SQUAAD_WHATSAPP_PUBLIC || "5575983080330";

  async function handleCapture(data: CaptureData) {
    setCapture(data);
    setSubmitting(true);
    setStep("loading");
    const t0 = performance.now();
    console.log("[r10x] iniciando análise para", data.instagram);
    try {
      // Fallback robusto: fetch direto se supabase-js falhar.
      const SUPABASE_URL = "https://iymlwsawrmghhbawiavz.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWx3c2F3cm1naGhiYXdpYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjI5NjUsImV4cCI6MjA5OTUzODk2NX0.mmnCM6HjBlADVpARI3S-2rSUWdZYpEMbf8hTO5fhwoM";
      const payload = {
        nome: data.nome,
        whatsapp: data.whatsapp,
        instagram: data.instagram,
        authorized_mural: data.authorized_mural,
        utm: Object.fromEntries(new URLSearchParams(window.location.search)),
      };

      // Timeout explícito de 40s pra evitar loop infinito de loading
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 40_000);

      let res: any;
      try {
        const httpRes = await fetch(`${SUPABASE_URL}/functions/v1/disc-lead-magnet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        console.log(`[r10x] resposta em ${elapsed}s, status=${httpRes.status}`);
        if (!httpRes.ok) {
          const text = await httpRes.text().catch(() => "");
          throw new Error(`HTTP ${httpRes.status}: ${text.slice(0, 200) || "erro desconhecido"}`);
        }
        res = await httpRes.json();
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr?.name === "AbortError") {
          throw new Error("Demorou muito (40s+). Confira sua conexão e tenta de novo.");
        }
        throw fetchErr;
      }

      console.log("[r10x] resposta disc-lead-magnet:", res);
      const error = null as any;

      // Erro de rede / função inexistente
      if (error) {
        const errMsg = String(error?.message || error || "");
        if (/not found|404|Failed to send/i.test(errMsg)) {
          throw new Error(
            "A função 'disc-lead-magnet' ainda não foi publicada no Supabase. " +
            "Rode: supabase functions deploy disc-lead-magnet",
          );
        }
        throw new Error(errMsg || "Erro ao chamar a análise");
      }

      // Função respondeu mas com erro de negócio
      if (!res || res.success === false) {
        const code = res?.error || "unknown";
        const msg: Record<string, string> = {
          rate_limited: "Muitas tentativas. Aguarda 1 minuto.",
          nome_invalido: "Nome inválido. Coloca nome e sobrenome.",
          whatsapp_invalido: "WhatsApp inválido. Confere o número.",
          whatsapp_nao_existe: res?.message || "Esse WhatsApp não existe. Confere o número.",
          instagram_invalido: "@ do Instagram inválido. Confere o usuário.",
          board_not_found: "Board 'Reprograme-se 10X' não existe. Aplique a migration no Supabase.",
        };
        throw new Error(msg[code] || `Erro: ${code}`);
      }

      setLeadId(res.lead_id);
      setAnalysis(res.analysis || null);
      setProfilePicUrl(res.profile_pic_url || null);

      if (!res.instagram_available) {
        toast({
          title: "Instagram indisponível",
          description: "Seu perfil está privado ou não encontrei. Vou seguir só com o DISC.",
        });
      }

      // Pequena pausa pra "presentear" o usuário com o elogio antes do quiz
      setTimeout(() => setStep("quiz"), 800);
    } catch (e: any) {
      console.error("[r10x] capture error", e);
      toast({
        title: "Não consegui processar",
        description: e?.message || "Tenta de novo em alguns segundos.",
        variant: "destructive",
      });
      setStep("capture");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuizComplete(answers: Dim[]) {
    setStep("loading");
    try {
      const SUPABASE_URL = "https://iymlwsawrmghhbawiavz.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWx3c2F3cm1naGhiYXdpYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjI5NjUsImV4cCI6MjA5OTUzODk2NX0.mmnCM6HjBlADVpARI3S-2rSUWdZYpEMbf8hTO5fhwoM";
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25_000);
      let res: any;
      try {
        const httpRes = await fetch(`${SUPABASE_URL}/functions/v1/disc-complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ lead_id: leadId, answers }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!httpRes.ok) throw new Error(`HTTP ${httpRes.status}`);
        res = await httpRes.json();
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr?.name === "AbortError") throw new Error("Timeout — tenta de novo");
        throw fetchErr;
      }
      const error = null as any;
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error || "Erro ao calcular perfil");
      setProfile(res.profile);
      setProfileLabel(res.profile_label);
      setStep("result");
    } catch (e: any) {
      console.error("[r10x] complete error", e);
      toast({
        title: "Não consegui finalizar",
        description: e?.message || "Tenta de novo.",
        variant: "destructive",
      });
      setStep("quiz");
    }
  }

  function handleRequestPdf() {
    if (!capture || !leadId || pdfRequesting || pdfRequested) return;
    // Anti-ban WhatsApp:
    //   1. Abre wa.me SINCRONO (sem await, senao iOS/Safari bloqueia popup)
    //   2. Fire-and-forget POST queue_only=true: marca lead como 'queued' em
    //      disc_pdf_requests. Se ele mandar a msg no WhatsApp, webhook detecta
    //      e dispara o PDF na hora. Se NAO mandar em 15+ min, o cron fallback
    //      manda mesmo assim, mas devagar (max 2 por rodada, 30-90s entre cada).
    const pick = LEAD_MESSAGE_VARIANTS[Math.floor(Math.random() * LEAD_MESSAGE_VARIANTS.length)];
    const url = `https://wa.me/${SQUAAD_PUBLIC_WHATSAPP}?text=${encodeURIComponent(pick)}`;
    const opened = window.open(url, "_blank");

    // Enfileira em background. keepalive garante que completa mesmo se a
    // aba for pra WhatsApp antes da resposta do fetch.
    try {
      const SUPABASE_URL = "https://iymlwsawrmghhbawiavz.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWx3c2F3cm1naGhiYXdpYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjI5NjUsImV4cCI6MjA5OTUzODk2NX0.mmnCM6HjBlADVpARI3S-2rSUWdZYpEMbf8hTO5fhwoM";
      fetch(`${SUPABASE_URL}/functions/v1/disc-pdf-deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ lead_id: leadId, queue_only: true }),
        keepalive: true,
      }).catch(() => {});
    } catch {}

    if (!opened) {
      window.location.href = url;
      return;
    }
    setPdfRequested(true);
    toast({
      title: "Abrindo WhatsApp",
      description: "Manda a mensagem pre-pronta. Em ate 2 min voce recebe o PDF.",
    });
  }

  async function handleShare() {
    if (!capture || sharing) return;
    setSharing(true);
    try {
      const result = await shareStoryCard({
        nome: capture.nome,
        profile,
        profilePicUrl,
        instagramHandle: capture.instagram,
      });
      if (result === "downloaded") {
        toast({
          title: "Imagem baixada! 📸",
          description: "Sobe nos seus stories e marca @squaad.oficial",
        });
        // Marca como compartilhado
        if (leadId) {
          (supabase as any).from("crm_leads").update({ shared_stories: true }).eq("id", leadId);
        }
      } else if (result === "shared") {
        if (leadId) {
          (supabase as any).from("crm_leads").update({ shared_stories: true }).eq("id", leadId);
        }
      } else {
        toast({
          title: "Não consegui gerar a imagem",
          description: "Tenta de novo daqui a pouco.",
          variant: "destructive",
        });
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Análise DISC · Reprograme-se 10X</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Helmet>
      <main className="min-h-[100dvh] bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white px-4 py-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {step === "capture" && (
            <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DiscCaptureModal onSubmit={handleCapture} loading={submitting} />
            </motion.div>
          )}
          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DiscLoading onTimeout={() => setStep("capture")} />
            </motion.div>
          )}
          {step === "quiz" && capture && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)]"
            >
              {/* Header amarelo com avatar */}
              <div className="relative bg-gradient-to-br from-[#3B82F6] via-[#F5B800] to-[#E8A900] px-6 pt-6 pb-10 text-center overflow-hidden">
                <div className="absolute top-[-30px] right-[-20px] w-32 h-32 rounded-full bg-white/15" />
                <div className="absolute bottom-[-40px] left-[-15px] w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute top-4 left-6 w-8 h-8 rounded-full bg-white/20" />

                <div className="relative flex flex-col items-center">
                  <div className="ring-4 ring-white/30 rounded-full shadow-lg">
                    <LeadAvatar nome={capture.nome} profilePicUrl={profilePicUrl} size={80} />
                  </div>
                  <p className="mt-3 text-black font-bold text-lg tracking-tight">
                    Ola, {capture.nome.split(" ")[0]}
                  </p>
                  <p className="text-black/60 text-xs font-medium">@{capture.instagram}</p>
                </div>
              </div>

              {/* Conector curvo */}
              <div className="relative">
                <svg viewBox="0 0 420 24" className="w-full block" preserveAspectRatio="none">
                  <path d="M0,0 L420,0 L420,24 Q350,0 210,0 Q70,0 0,24 Z" fill="#3B82F6" />
                  <path d="M0,24 Q70,0 210,0 Q350,0 420,24 L420,24 L0,24 Z" fill="white" />
                </svg>
              </div>

              {/* Conteudo branco */}
              <div className="bg-white px-6 pb-6 pt-1">
                {analysis?.elogio_personalizado && (
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
                    <p className="text-amber-700 text-[10px] font-bold mb-1.5 uppercase tracking-[0.15em]">
                      O que percebi em voce
                    </p>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {analysis.elogio_personalizado}
                    </p>
                  </div>
                )}
                <DiscQuiz onComplete={handleQuizComplete} />
              </div>
            </motion.div>
          )}
          {step === "result" && capture && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DiscResultScreen
                nome={capture.nome}
                instagramHandle={capture.instagram}
                profile={profile}
                profileLabel={profileLabel}
                analysis={analysis}
                profilePicUrl={profilePicUrl}
                onShare={handleShare}
                sharing={sharing}
                onRequestPdf={handleRequestPdf}
                pdfRequesting={pdfRequesting}
                pdfRequested={pdfRequested}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
