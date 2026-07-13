import { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertTriangle, Target, Lightbulb, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Insight {
  id: string;
  analyzed_at: string;
  message_count: number;
  sentiment: string;
  interest_level: number;
  key_topics: string[];
  objections: string[];
  pain_points: string[];
  opportunities: string[];
  suggested_actions: string[];
  raw_summary: string;
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  positivo: { label: 'Positivo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', emoji: '😊' },
  neutro: { label: 'Neutro', color: 'bg-muted text-muted-foreground border-border', emoji: '😐' },
  negativo: { label: 'Negativo', color: 'bg-red-500/20 text-red-400 border-red-500/30', emoji: '😟' },
  frustrado: { label: 'Frustrado', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', emoji: '😤' },
};

export function LeadInsightsTab({ leadId }: { leadId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadInsights = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lead_conversation_insights')
      .select('*')
      .eq('lead_id', leadId)
      .order('analyzed_at', { ascending: false })
      .limit(10);
    if (!error && data) setInsights(data as unknown as Insight[]);
    setLoading(false);
  };

  useEffect(() => { loadInsights(); }, [leadId]);

  const triggerAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke('analyze-conversation', {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      toast.success('Análise concluída!');
      await loadInsights();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao analisar');
    } finally {
      setAnalyzing(false);
    }
  };

  const latest = insights[0];
  const history = insights.slice(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Brain className="w-5 h-5 animate-pulse mr-2" /> Carregando insights...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Inteligência da Conversa</span>
        </div>
        <Button size="sm" variant="outline" onClick={triggerAnalysis} disabled={analyzing} className="h-7 text-xs gap-1.5">
          <RefreshCw className={`w-3 h-3 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analisando...' : 'Analisar Agora'}
        </Button>
      </div>

      {!latest ? (
        <div className="text-center py-8 text-muted-foreground">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma análise ainda</p>
          <p className="text-xs mt-1">Clique em "Analisar Agora" ou aguarde análise automática</p>
        </div>
      ) : (
        <>
          {/* Sentiment + Interest */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3 space-y-2">
              <span className="text-xs text-muted-foreground">Sentimento</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{SENTIMENT_CONFIG[latest.sentiment]?.emoji || '😐'}</span>
                <Badge variant="outline" className={SENTIMENT_CONFIG[latest.sentiment]?.color || ''}>
                  {SENTIMENT_CONFIG[latest.sentiment]?.label || latest.sentiment}
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <span className="text-xs text-muted-foreground">Nível de Interesse</span>
              <div className="space-y-1">
                <span className="text-lg font-bold">{latest.interest_level}%</span>
                <Progress value={latest.interest_level} className="h-2" />
              </div>
            </div>
          </div>

          {/* Summary */}
          {latest.raw_summary && (
            <div className="rounded-lg border border-border p-3">
              <span className="text-xs text-muted-foreground block mb-1">Resumo</span>
              <p className="text-sm">{latest.raw_summary}</p>
            </div>
          )}

          {/* Topics */}
          {latest.key_topics?.length > 0 && (
            <InsightSection icon={Target} title="Tópicos" items={latest.key_topics} color="text-blue-400" />
          )}

          {/* Pain Points */}
          {latest.pain_points?.length > 0 && (
            <InsightSection icon={AlertTriangle} title="Dores" items={latest.pain_points} color="text-orange-400" />
          )}

          {/* Objections */}
          {latest.objections?.length > 0 && (
            <InsightSection icon={AlertTriangle} title="Objeções" items={latest.objections} color="text-red-400" />
          )}

          {/* Opportunities */}
          {latest.opportunities?.length > 0 && (
            <InsightSection icon={TrendingUp} title="Oportunidades" items={latest.opportunities} color="text-emerald-400" />
          )}

          {/* Suggested Actions */}
          {latest.suggested_actions?.length > 0 && (
            <InsightSection icon={Lightbulb} title="Ações Sugeridas" items={latest.suggested_actions} color="text-yellow-400" />
          )}

          {/* Metadata */}
          <p className="text-[10px] text-muted-foreground text-right">
            {latest.message_count} msgs analisadas • {new Date(latest.analyzed_at).toLocaleString('pt-BR')}
          </p>

          {/* History */}
          {history.length > 0 && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground">
                  <ChevronDown className={`w-3 h-3 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                  {history.length} análise(s) anterior(es)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-2">
                {history.map(h => (
                  <div key={h.id} className="rounded-lg border border-border p-3 opacity-70">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${SENTIMENT_CONFIG[h.sentiment]?.color || ''}`}>
                          {SENTIMENT_CONFIG[h.sentiment]?.emoji} {SENTIMENT_CONFIG[h.sentiment]?.label || h.sentiment}
                        </Badge>
                        <span className="text-xs font-medium">{h.interest_level}%</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(h.analyzed_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {h.raw_summary && <p className="text-xs text-muted-foreground">{h.raw_summary}</p>}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
}

function InsightSection({ icon: Icon, title, items, color }: { icon: any; title: string; items: string[]; color: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs font-medium">{title}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
            <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
