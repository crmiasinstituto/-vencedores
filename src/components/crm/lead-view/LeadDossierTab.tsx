import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, Loader2, Copy, User, MessageSquare, Target, Shield, Activity, AlertTriangle, CheckCircle, XCircle, Lightbulb, TrendingUp, Clock, Heart, Phone, Flag, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LeadDossierTabProps {
  leadId: string;
  leadName: string;
  leadWhatsapp: string;
  leadInstagram?: string;
  leadSource?: string;
  leadScore: number;
  leadNotes?: string;
}

interface DossierData {
  disc_profile: {
    primary: string;
    description: string;
    communication_tips: string[];
  };
  buyer_persona: string;
  spin_questions: {
    situation: string[];
    problem: string[];
    implication: string[];
    need_payoff: string[];
  };
  opening_script: string;
  rapport_techniques: string[];
  objection_handling: { objection: string; response: string }[];
  closing_techniques: string[];
  urgency_triggers: string[];
  red_flags: string[];
  green_flags: string[];
  call_agenda: { phase: string; duration: string; objective: string }[];
  confidence_score: number;
}

interface LeadAnalysis {
  health_score: number;
  risk_level: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'neutral' | 'negative';
  engagement: 'high' | 'medium' | 'low';
  predicted_outcome: 'likely_win' | 'uncertain' | 'likely_loss';
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  attention_points: string[];
}

const DISC_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  D: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Dominante' },
  I: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'Influente' },
  S: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', label: 'Estavel' },
  C: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Conforme' },
};

const SPIN_LABELS: Record<string, { label: string; color: string }> = {
  situation: { label: 'Situacao', color: 'text-blue-400' },
  problem: { label: 'Problema', color: 'text-red-400' },
  implication: { label: 'Implicacao', color: 'text-amber-400' },
  need_payoff: { label: 'Need-Payoff', color: 'text-green-400' },
};

const getScoreColor = (score: number) => {
  if (score >= 70) return { stroke: 'text-green-500', bg: 'text-green-500/20', label: 'text-green-400' };
  if (score >= 40) return { stroke: 'text-yellow-500', bg: 'text-yellow-500/20', label: 'text-yellow-400' };
  return { stroke: 'text-red-500', bg: 'text-red-500/20', label: 'text-red-400' };
};

const riskBadge: Record<string, string> = {
  low: 'bg-green-500/15 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const sentimentBadge: Record<string, string> = {
  positive: 'bg-green-500/15 text-green-400 border-green-500/30',
  neutral: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  negative: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const outcomeBadge: Record<string, { class: string; label: string }> = {
  likely_win: { class: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'Provavel Ganho' },
  uncertain: { class: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label: 'Incerto' },
  likely_loss: { class: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Provavel Perda' },
};

const engagementBadge: Record<string, string> = {
  high: 'bg-green-500/15 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const DossierSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="h-4 w-32 bg-muted rounded mb-3" />
      <div className="h-3 w-full bg-muted rounded mb-2" />
      <div className="h-3 w-3/4 bg-muted rounded mb-2" />
      <div className="h-3 w-1/2 bg-muted rounded" />
    </div>
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="h-4 w-40 bg-muted rounded mb-3" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-3 w-full bg-muted rounded" />
        ))}
      </div>
    </div>
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="h-4 w-36 bg-muted rounded mb-3" />
      <div className="h-20 w-full bg-muted rounded" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-3 w-full bg-muted rounded mb-2" />
        <div className="h-3 w-2/3 bg-muted rounded" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-3 w-full bg-muted rounded mb-2" />
        <div className="h-3 w-2/3 bg-muted rounded" />
      </div>
    </div>
  </div>
);

export const LeadDossierTab: React.FC<LeadDossierTabProps> = ({
  leadId, leadName, leadWhatsapp, leadInstagram, leadSource, leadScore, leadNotes
}) => {
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load last saved dossier from activities on mount
  useEffect(() => {
    const loadSavedDossier = async () => {
      const { data } = await supabase
        .from('crm_activities')
        .select('metadata, created_at')
        .eq('lead_id', leadId)
        .eq('activity_type', 'ai_dossier')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data[0] && data[0].metadata) {
        const meta = data[0].metadata as Record<string, unknown>;
        if (meta.sales_dossier) {
          setDossier(meta.sales_dossier as DossierData);
          setLastGenerated(data[0].created_at);
        }
      }
    };
    loadSavedDossier();
  }, [leadId]);

  const analyzeLeadWithAI = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { leadId }
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        toast.success('Analise concluida!');
      } else {
        throw new Error('Resposta invalida da IA');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar lead';
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateDossier = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sales-dossier', {
        body: { leadId }
      });

      if (error) throw error;

      if (data?.dossier) {
        setDossier(data.dossier);
        setLastGenerated(new Date().toISOString());
        toast.success('Dossie de Vendas gerado com sucesso!');
      } else {
        throw new Error('Resposta da IA sem dossie');
      }
    } catch (err: unknown) {
      console.error('Dossier generation error:', err);
      const message = err instanceof Error ? err.message : 'Erro ao gerar dossie';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  // Render AI Analysis section (preserved from original)
  const renderAnalysis = () => {
    if (!analysis) return null;

    const scoreColors = getScoreColor(analysis.health_score);
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (analysis.health_score / 100) * circumference;

    return (
      <div className="space-y-4 mb-6">
        {/* Health Score + Badges Row */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Analise IA do Lead</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Circular Score */}
            <div className="relative flex-shrink-0">
              <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90">
                <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle
                  cx="48" cy="48" r="40" fill="none" strokeWidth="6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={`${scoreColors.stroke} transition-all duration-1000`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${scoreColors.label}`}>{analysis.health_score}</span>
                <span className="text-[9px] text-muted-foreground">Health</span>
              </div>
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Risco</p>
                <Badge variant="outline" className={`text-[10px] ${riskBadge[analysis.risk_level]}`}>
                  {analysis.risk_level === 'low' ? 'Baixo' : analysis.risk_level === 'medium' ? 'Medio' : 'Alto'}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Sentimento</p>
                <Badge variant="outline" className={`text-[10px] ${sentimentBadge[analysis.sentiment]}`}>
                  {analysis.sentiment === 'positive' ? 'Positivo' : analysis.sentiment === 'neutral' ? 'Neutro' : 'Negativo'}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Engajamento</p>
                <Badge variant="outline" className={`text-[10px] ${engagementBadge[analysis.engagement]}`}>
                  {analysis.engagement === 'high' ? 'Alto' : analysis.engagement === 'medium' ? 'Medio' : 'Baixo'}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Previsao</p>
                <Badge variant="outline" className={`text-[10px] ${outcomeBadge[analysis.predicted_outcome]?.class}`}>
                  {outcomeBadge[analysis.predicted_outcome]?.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Strengths */}
        {analysis.strengths.length > 0 && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-green-400">Pontos Fortes</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-green-400 mt-0.5">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {analysis.weaknesses.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-red-400">Pontos Fracos</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-red-400 mt-0.5">-</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-blue-400">Recomendacoes</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-blue-400 mt-0.5">*</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Attention Points */}
        {analysis.attention_points.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">Pontos de Atencao</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.attention_points.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-amber-400 mt-0.5">!</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Re-analyze button */}
        <Button variant="outline" className="w-full gap-2 text-xs" onClick={analyzeLeadWithAI} disabled={isAnalyzing}>
          {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
          Reanalisar Lead
        </Button>
      </div>
    );
  };

  // Empty state: no dossier, no analysis, not loading
  if (!dossier && !analysis && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold mb-2">Dossie de Vendas com IA</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Gere um dossie completo com perfil DISC, persona do comprador, perguntas SPIN Selling, scripts personalizados,
          tecnicas de rapport, quebra de objecoes e agenda de chamada.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={generateDossier} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'Gerando Dossie...' : 'Gerar Dossie de Vendas'}
          </Button>
          <Button onClick={analyzeLeadWithAI} disabled={isAnalyzing} variant="outline" className="gap-2">
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {isAnalyzing ? 'Analisando...' : 'Analisar Lead com IA'}
          </Button>
        </div>
      </div>
    );
  }

  // Loading state for dossier generation
  if (isGenerating && !dossier) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Gerando dossie personalizado para {leadName}...</span>
        </div>
        <DossierSkeleton />
      </div>
    );
  }

  const discKey = dossier?.disc_profile?.primary?.charAt(0)?.toUpperCase() || 'D';
  const discStyle = DISC_COLORS[discKey] || DISC_COLORS['D'];

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-4 pr-2">
        {/* AI Lead Analysis */}
        {analysis ? (
          renderAnalysis()
        ) : (
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Analise IA do Lead</span>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={analyzeLeadWithAI} disabled={isAnalyzing}>
              {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {isAnalyzing ? 'Analisando...' : 'Analisar'}
            </Button>
          </div>
        )}

        {/* Sales Dossier Content */}
        {dossier && (
          <>
            {/* Header with regenerate + confidence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={generateDossier} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Regenerar Dossie
                </Button>
                {lastGenerated && (
                  <span className="text-[10px] text-muted-foreground">
                    Gerado em {new Date(lastGenerated).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {dossier.confidence_score != null && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    dossier.confidence_score >= 70 ? 'border-green-500/30 text-green-400' :
                    dossier.confidence_score >= 40 ? 'border-yellow-500/30 text-yellow-400' :
                    'border-red-500/30 text-red-400'
                  }`}
                >
                  Confianca: {dossier.confidence_score}%
                </Badge>
              )}
            </div>

            {/* DISC Profile Card */}
            <div className={`rounded-xl border ${discStyle.border} ${discStyle.bg} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <User className={`w-4 h-4 ${discStyle.text}`} />
                <span className="text-sm font-bold">Perfil DISC</span>
                <Badge variant="outline" className={`${discStyle.border} ${discStyle.text} text-xs font-bold`}>
                  {discKey} - {discStyle.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{dossier.disc_profile.description}</p>
              <div className="space-y-1.5">
                {dossier.disc_profile.communication_tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`${discStyle.text} mt-0.5 shrink-0`}>&#x2022;</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buyer Persona */}
            {dossier.buyer_persona && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold">Persona do Comprador</span>
                </div>
                <p className="text-sm text-muted-foreground">{dossier.buyer_persona}</p>
              </div>
            )}

            {/* SPIN Questions - Collapsible */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold">Perguntas SPIN Selling</span>
              </div>
              <Accordion type="multiple" defaultValue={['situation']} className="w-full">
                {(['situation', 'problem', 'implication', 'need_payoff'] as const).map(type => {
                  const style = SPIN_LABELS[type];
                  const questions = dossier.spin_questions[type] || [];
                  return (
                    <AccordionItem key={type} value={type} className="border-b-border/50">
                      <AccordionTrigger className="py-2 text-xs font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${style.color} border-current/30`}>
                            {style.label}
                          </Badge>
                          <span className="text-muted-foreground text-[10px]">
                            ({questions.length} perguntas)
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-1.5 pl-1">
                          {questions.map((q, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className={`${style.color} mt-0.5 shrink-0`}>&#x2022;</span> {q}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Opening Script */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-bold">Script de Abertura</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(dossier.opening_script, 'Script')}>
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
              </div>
              <p className="text-sm text-foreground/80 bg-muted/30 rounded-lg p-3 italic leading-relaxed">
                &quot;{dossier.opening_script}&quot;
              </p>
            </div>

            {/* Rapport Techniques */}
            {dossier.rapport_techniques && dossier.rapport_techniques.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-pink-400" />
                  <span className="text-sm font-bold">Tecnicas de Rapport</span>
                </div>
                <div className="space-y-2">
                  {dossier.rapport_techniques.map((tech, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                      <span className="text-pink-400 font-bold shrink-0 w-5 text-right">{i + 1}.</span>
                      <span>{tech}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Objection Handling */}
            {dossier.objection_handling && dossier.objection_handling.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-bold">Quebra de Objecoes</span>
                </div>
                <div className="space-y-3">
                  {dossier.objection_handling.map((obj, i) => (
                    <div key={i} className="text-xs">
                      <p className="font-semibold text-red-400 mb-1 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> &quot;{obj.objection}&quot;
                      </p>
                      <p className="text-muted-foreground bg-green-500/5 border border-green-500/20 rounded-lg p-2 flex items-start gap-1">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-400" /> {obj.response}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Closing Techniques */}
            {dossier.closing_techniques && dossier.closing_techniques.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold">Tecnicas de Fechamento</span>
                </div>
                <div className="space-y-2">
                  {dossier.closing_techniques.map((tech, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5">
                      <span className="text-purple-400 font-bold shrink-0 w-5 text-right">{i + 1}.</span>
                      <span>{tech}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Urgency Triggers */}
            {dossier.urgency_triggers && dossier.urgency_triggers.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold">Gatilhos de Urgencia</span>
                </div>
                <div className="space-y-1.5">
                  {dossier.urgency_triggers.map((trigger, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-amber-400 mt-0.5 shrink-0">&#x26A1;</span>
                      <span>{trigger}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Green Flags & Red Flags */}
            {((dossier.green_flags && dossier.green_flags.length > 0) || (dossier.red_flags && dossier.red_flags.length > 0)) && (
              <div className="grid grid-cols-2 gap-3">
                {dossier.green_flags && dossier.green_flags.length > 0 && (
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Flag className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-bold">Green Flags</span>
                    </div>
                    <div className="space-y-1.5">
                      {dossier.green_flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-400" />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dossier.red_flags && dossier.red_flags.length > 0 && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Flag className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-bold">Red Flags</span>
                    </div>
                    <div className="space-y-1.5">
                      {dossier.red_flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Call Agenda */}
            {dossier.call_agenda && dossier.call_agenda.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold">Agenda da Chamada</span>
                </div>
                <div className="space-y-0">
                  {dossier.call_agenda.map((item, i) => (
                    <div key={i} className="flex items-stretch gap-3 text-xs">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-2.5 ${i === 0 ? 'bg-cyan-400' : 'bg-muted-foreground/40'}`} />
                        {i < dossier.call_agenda.length - 1 && (
                          <div className="w-px flex-1 bg-border min-h-[24px]" />
                        )}
                      </div>
                      <div className="pb-3 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-foreground">{item.phase}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-cyan-500/30 text-cyan-400">
                            {item.duration}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{item.objective}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Generate Dossier CTA if not yet generated */}
        {!dossier && !isGenerating && (
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Dossie de Vendas</span>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={generateDossier} disabled={isGenerating}>
              <Sparkles className="w-3 h-3" />
              Gerar Dossie
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
