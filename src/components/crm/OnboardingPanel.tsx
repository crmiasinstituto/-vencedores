// Painel "Onboarding Masterclass" no LeadDetailModal — mostra:
//   - Se completou (banner verde com timestamp + selfie thumbnail)
//   - Resumo das respostas (perfil, IA, expectativa)
//   - Link único do lead (com botão copiar)
//   - Status BANT inferido (rapidinho pra Carlos)
//
// Aparece se lead tem onboarding_token (admin gera token sempre que abre lead
// novo do board masterclass-ia OU lead R10X já tem desde o backfill).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Clock, Copy, ExternalLink, Briefcase, Brain, Target,
  Camera, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  leadId: string;
  leadName: string;
}

interface OnboardingData {
  onboarding_token: string | null;
  onboarding_completed_at: string | null;
  perfil_profissional: string | null;
  area_interesse: string | null;
  tipo_negocio: string | null;
  equipe_faixa: string | null;
  maturidade_ia: string | null;
  ferramentas_ia: string[] | null;
  expectativa_mc: string | null;
  expectativa_mc_extra: string | null;
  face_url: string | null;
}

const PERFIS_LABEL: Record<string, string> = {
  empresario: "Empresário (sócio / CEO)",
  diretor_gerente: "Diretor / Gerente",
  autonomo: "Autônomo / Consultor",
  clt: "CLT",
  transicao: "Em transição de carreira",
  estudante: "Estudante",
};

const MATURIDADE_LABEL: Record<string, string> = {
  nao_uso: "Não uso IA ainda",
  pessoal: "Usa pra coisas pessoais",
  negocio_manual: "Usa no negócio (rotina manual)",
  automatizado: "Tem automação (n8n, agentes)",
};

const EXPECTATIVA_LABEL: Record<string, string> = {
  mais_receita: "+ Receita / + Vendas",
  menos_custo: "− Custo / + Eficiência",
  mais_tempo: "+ Tempo (automatizar)",
  treinar_equipe: "Treinar / escalar equipe",
  aprender_metodo: "Aprender método",
};

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export function OnboardingPanel({ leadId, leadName }: Props) {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function fetchData() {
    setLoading(true);
    const { data: lead } = await (supabase as any)
      .from("crm_leads")
      .select("onboarding_token, onboarding_completed_at, perfil_profissional, area_interesse, tipo_negocio, equipe_faixa, maturidade_ia, ferramentas_ia, expectativa_mc, expectativa_mc_extra, face_url")
      .eq("id", leadId)
      .maybeSingle();
    setData(lead || null);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [leadId]);

  async function generateLink() {
    setGenerating(true);
    const { data: tk, error } = await (supabase as any).rpc("onboarding_ensure_token", { p_lead_id: leadId });
    setGenerating(false);
    if (error || !tk) {
      toast.error("Falha ao gerar link", { description: error?.message });
      return;
    }
    fetchData();
  }

  function copyLink() {
    if (!data?.onboarding_token) return;
    const url = `${window.location.origin}/m/${data.onboarding_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado", { description: url });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-md border border-border bg-muted/30">
        <Loader2 className="w-3 h-3 animate-spin" /> Carregando dados do onboarding...
      </div>
    );
  }

  if (!data) return null;

  const completed = !!data.onboarding_completed_at;
  const hasAnyResponse = !!(data.perfil_profissional || data.maturidade_ia || data.expectativa_mc);

  return (
    <div className="space-y-3">
      {/* Banner status */}
      {completed ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-3">
          {data.face_url ? (
            <img src={data.face_url} alt="selfie" className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/40 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-sm">Onboarding completo</strong>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300">
                ✓ concluído
              </Badge>
              <span className="text-[11px] text-muted-foreground">{fmtAgo(data.onboarding_completed_at!)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lead respondeu o wizard de qualificação pré-Masterclass
            </p>
          </div>
        </div>
      ) : hasAnyResponse ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <strong className="text-sm">Onboarding em andamento</strong>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lead começou mas não terminou. Veja respostas parciais abaixo.
            </p>
          </div>
        </div>
      ) : data.onboarding_token ? (
        <div className="rounded-lg border border-zinc-700 bg-muted/20 p-3 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-zinc-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <strong className="text-sm">Aguardando lead preencher</strong>
            <p className="text-xs text-muted-foreground mt-0.5">
              Link gerado mas lead ainda não acessou o wizard.
            </p>
          </div>
        </div>
      ) : null}

      {/* Link único */}
      {data.onboarding_token ? (
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <code className="text-[11px] font-mono truncate">/m/{data.onboarding_token.slice(0, 12)}…</code>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={copyLink} className="h-7 px-2 text-xs">
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
              <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
                <a href={`/m/${data.onboarding_token}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={generateLink} disabled={generating} variant="outline" className="w-full">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5 mr-2" /> Gerar link de onboarding</>}
        </Button>
      )}

      {/* Respostas */}
      {hasAnyResponse && (
        <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2 text-xs">
          {data.perfil_profissional && (
            <Row icon={<Briefcase className="w-3 h-3" />} label="Perfil">
              <span>{PERFIS_LABEL[data.perfil_profissional] || data.perfil_profissional}</span>
              {data.tipo_negocio && <span className="text-muted-foreground"> · {data.tipo_negocio}</span>}
              {data.equipe_faixa && <span className="text-muted-foreground"> · equipe {data.equipe_faixa}</span>}
              {data.area_interesse && <span className="text-muted-foreground"> · área: {data.area_interesse}</span>}
            </Row>
          )}
          {data.maturidade_ia && (
            <Row icon={<Brain className="w-3 h-3" />} label="IA">
              <span>{MATURIDADE_LABEL[data.maturidade_ia] || data.maturidade_ia}</span>
              {data.ferramentas_ia && data.ferramentas_ia.length > 0 && (
                <span className="text-muted-foreground"> · usa {data.ferramentas_ia.join(", ")}</span>
              )}
            </Row>
          )}
          {data.expectativa_mc && (
            <Row icon={<Target className="w-3 h-3" />} label="Espera">
              <span>{EXPECTATIVA_LABEL[data.expectativa_mc] || data.expectativa_mc}</span>
              {data.expectativa_mc_extra && (
                <div className="text-muted-foreground italic mt-0.5">"{data.expectativa_mc_extra}"</div>
              )}
            </Row>
          )}
          {data.face_url && (
            <Row icon={<Camera className="w-3 h-3" />} label="Selfie">
              <a href={data.face_url} target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] underline">
                ver foto check-in
              </a>
            </Row>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1.5">{label}:</span>
        {children}
      </div>
    </div>
  );
}
