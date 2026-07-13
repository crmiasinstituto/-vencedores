import { motion } from "framer-motion";
import { Share2, Sparkles, Instagram, Target, TrendingUp, FileDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadAvatar } from "./LeadAvatar";

interface PontoMelhoria {
  titulo: string;
  descricao: string;
}

interface AiAnalysis {
  profissao_inferida?: string;
  nicho?: string;
  tom_conteudo?: string;
  frequencia?: string;
  pontos_fortes?: string[];
  pontos_melhoria?: PontoMelhoria[];
  elogio_personalizado?: string;
}

interface Props {
  nome: string;
  instagramHandle: string;
  profile: string;
  profileLabel: string;
  analysis: AiAnalysis | null;
  profilePicUrl: string | null;
  onShare?: () => void;
  sharing?: boolean;
  onRequestPdf?: () => void;
  pdfRequesting?: boolean;
  pdfRequested?: boolean;
}

const DISC_COLORS: Record<string, string> = {
  D: "#EF4444",
  I: "#F59E0B",
  S: "#10B981",
  C: "#3B82F6",
};

const DISC_INSIGHTS: Record<string, string> = {
  D: "Pessoas dominantes que atuam em alta exigência costumam travar em delegar tarefas repetitivas. A IA assume esses gargalos e te libera pra decisão estratégica, onde você é insubstituível.",
  I: "Influentes brilham em conexão, mas perdem horas em conversas que não convertem. Agentes de IA filtram lead, qualificam no automático e só te entregam quem está pronto pra fechar.",
  S: "Estáveis valorizam processo. O risco é morrer na consistência sem escalar. A IA mantém a qualidade do seu atendimento idêntica 24/7 enquanto você dorme.",
  C: "Cautelosos exigem dados pra agir. A IA cruza informações que o humano não consegue e te entrega o relatório pronto. Sua decisão vira mais rápida sem perder rigor.",
};

function insightFor(profile: string): string {
  if (profile.includes("-")) {
    const [a] = profile.split("-");
    return DISC_INSIGHTS[a] || DISC_INSIGHTS.D;
  }
  return DISC_INSIGHTS[profile] || DISC_INSIGHTS.D;
}

function dominantLetter(profile: string): string {
  return profile.split("-")[0] || profile;
}

function formatLabel(profile: string, profileLabel: string): string {
  // Substitui hífens/travessões da label oficial por dot separator
  return profileLabel.replace(/\s*\/\s*/g, " · ").replace(/\s*-\s*/g, " · ");
}

export function DiscResultScreen({
  nome,
  instagramHandle,
  profile,
  profileLabel,
  analysis,
  profilePicUrl,
  onShare,
  sharing,
  onRequestPdf,
  pdfRequesting,
  pdfRequested,
}: Props) {
  const primeiro = nome.split(" ")[0] || nome;
  const letter = dominantLetter(profile);
  const color = DISC_COLORS[letter] || "#3B82F6";
  const labelFmt = formatLabel(profile, profileLabel);

  return (
    <div className="w-full max-w-md mx-auto space-y-5">
      {/* Identificação no topo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center"
      >
        <LeadAvatar nome={nome} profilePicUrl={profilePicUrl} size={96} ringColor={color} />
        <p className="mt-3 text-white font-semibold tracking-tight text-lg">
          {nome}
        </p>
        <p className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
          <Instagram className="h-3 w-3" /> @{instagramHandle}
        </p>
      </motion.div>

      {/* Bloco 1: Badge DISC */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.6, delay: 0.1 }}
        className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 text-center backdrop-blur"
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">
          Seu perfil DISC
        </p>
        <div
          className="mx-auto h-24 w-24 rounded-2xl flex items-center justify-center text-5xl font-black text-white mb-4"
          style={{
            background: color,
            boxShadow: `0 18px 40px ${color}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
          }}
        >
          {letter}
        </div>
        <p className="text-xl font-semibold text-white tracking-tight">{labelFmt}</p>
        <div className="mt-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          <span className="h-px w-6 bg-zinc-700" />
          {profile}
          <span className="h-px w-6 bg-zinc-700" />
        </div>
      </motion.div>

      {/* Bloco 2: O que vi no Instagram */}
      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 backdrop-blur"
        >
          <div className="flex items-center gap-2 text-[#3B82F6] text-[10px] uppercase tracking-[0.3em] font-medium mb-3">
            <Sparkles className="h-3 w-3" />
            O que vi no seu Instagram
          </div>
          <p className="text-white text-[15px] leading-relaxed">
            {analysis.elogio_personalizado || `${primeiro}, sua presença digital está no caminho.`}
          </p>
          <div className="mt-5 pt-4 border-t border-zinc-800 grid grid-cols-1 gap-2.5 text-sm">
            {analysis.profissao_inferida && (
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500 text-xs uppercase tracking-wider">Profissão</span>
                <span className="text-zinc-100 text-right">{analysis.profissao_inferida}</span>
              </div>
            )}
            {analysis.nicho && (
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500 text-xs uppercase tracking-wider">Nicho</span>
                <span className="text-zinc-100 text-right">{analysis.nicho}</span>
              </div>
            )}
            {analysis.frequencia && (
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500 text-xs uppercase tracking-wider">Frequência</span>
                <span className="text-zinc-100 text-right capitalize">{analysis.frequencia}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Bloco 2.5: Onde você está deixando dinheiro na mesa */}
      {analysis?.pontos_melhoria && analysis.pontos_melhoria.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 backdrop-blur"
        >
          <div className="flex items-center gap-2 text-[#3B82F6] text-[10px] uppercase tracking-[0.3em] font-medium mb-1">
            <Target className="h-3 w-3" />
            Onde você está deixando dinheiro na mesa
          </div>
          <p className="text-zinc-400 text-xs mb-4">
            3 ajustes específicos no seu posicionamento que destravam conversão.
          </p>

          <div className="space-y-4">
            {analysis.pontos_melhoria.map((ponto, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex gap-3"
              >
                <div
                  className="flex-shrink-0 h-7 w-7 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/40 flex items-center justify-center text-[#3B82F6] text-xs font-bold mt-0.5"
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-snug">
                    {ponto.titulo}
                  </p>
                  <p className="mt-1 text-zinc-300 text-[13px] leading-relaxed">
                    {ponto.descricao}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center gap-2 text-[11px] text-zinc-500">
            <TrendingUp className="h-3 w-3 text-[#3B82F6]" />
            <span>Diagnóstico gerado por IA com base no seu Instagram real.</span>
          </div>
        </motion.div>
      )}

      {/* Bloco 3: Cruzamento DISC × Negócio */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl p-5 border"
        style={{
          background: `linear-gradient(135deg, ${color}1f, rgba(24,24,27,0.9))`,
          borderColor: `${color}44`,
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.3em] font-medium mb-3"
          style={{ color }}
        >
          DISC × IA × Negócio
        </p>
        <p className="text-white text-[15px] leading-relaxed">
          {insightFor(profile)}
        </p>
      </motion.div>

      {/* Bloco 4: CTAs — PDF (primário) + Stories (secundário) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <Button
          size="lg"
          onClick={onRequestPdf}
          disabled={pdfRequesting || pdfRequested}
          className="w-full h-14 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6] hover:brightness-110 text-black font-semibold text-base shadow-[0_18px_40px_-10px_rgba(250,200,0,0.45)] transition-all"
        >
          {pdfRequested ? (
            <>
              <Check className="h-5 w-5 mr-2" />
              Pedido enviado · confere o WhatsApp
            </>
          ) : pdfRequesting ? (
            <>
              <FileDown className="h-5 w-5 mr-2 animate-pulse" />
              Solicitando...
            </>
          ) : (
            <>
              <FileDown className="h-5 w-5 mr-2" />
              Receber DISC + Diagnóstico em PDF
            </>
          )}
        </Button>
        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          {pdfRequested
            ? "✨ Seu PDF chega no WhatsApp em até 2 minutos."
            : "Vamos te enviar pelo WhatsApp, sem cadastro."}
        </p>

        <Button
          size="lg"
          variant="outline"
          onClick={onShare}
          disabled={sharing}
          className="w-full h-12 rounded-xl border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 font-medium text-sm"
        >
          <Share2 className="h-4 w-4 mr-2" />
          {sharing ? "Gerando..." : "Compartilhar nos Stories"}
        </Button>

        <p className="mt-3 text-[10px] uppercase tracking-[0.3em] text-zinc-600 text-center">
          @{instagramHandle} · #Reprograme10X
        </p>
      </motion.div>
    </div>
  );
}
