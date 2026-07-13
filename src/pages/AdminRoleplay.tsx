import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dumbbell, Send, Loader2, RefreshCw, CheckCircle2, XCircle, Trophy,
  TrendingUp, TrendingDown, User, Bot, Sparkles, ArrowLeft,
} from 'lucide-react';

const db = supabase as any;

interface Scenario {
  key: string;
  persona: string;
  objective: string;
  difficulty: string;
}

interface Msg { role: 'rep' | 'lead'; content: string }

const DIFFICULTY_COLOR: Record<string, string> = {
  'Facil-medio — lead quer ser vendido, basta conduzir.': 'text-green-500 border-green-500/30 bg-green-500/10',
  'Medio — objecao sutil, exige reframing.': 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  'Medio — tentacao de forcar agendamento mesmo sem fit.': 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  'Medio — tentador mandar PDFs, mas a estrategia certa e envolver o socio na call.': 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  'Dificil — lead testa paciencia, insiste no preco, questiona valor.': 'text-red-500 border-red-500/30 bg-red-500/10',
};

export default function AdminRoleplay() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.functions.invoke('roleplay-turn', { body: { action: 'scenarios' } })
      .then(({ data }) => setScenarios((data as any)?.scenarios || []));
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, evaluation]);

  const startScenario = (s: Scenario) => {
    setCurrentScenario(s);
    setHistory([]);
    setEvaluation(null);
    setInput('');
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentScenario) return;
    const text = input.trim();
    setInput('');
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('roleplay-turn', {
        body: { action: 'turn', scenario: currentScenario.key, history, rep_message: text },
      });
      if (error || !data?.ok) throw new Error((data as any)?.error || error?.message);
      setHistory((data as any).history);
    } catch (e: any) {
      toast.error(e.message || 'Erro');
      setHistory(prev => [...prev, { role: 'rep', content: text }]);
    } finally { setThinking(false); }
  };

  const evaluate = async () => {
    if (history.length < 2) { toast.error('Converse um pouco antes de avaliar'); return; }
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke('roleplay-turn', {
        body: { action: 'evaluate', scenario: currentScenario?.key, history },
      });
      if (error || !data?.ok) throw new Error((data as any)?.error || error?.message);
      setEvaluation((data as any).evaluation);
    } catch (e: any) { toast.error(e.message || 'Erro'); }
    finally { setEvaluating(false); }
  };

  const reset = () => { setCurrentScenario(null); setHistory([]); setEvaluation(null); };

  if (!currentScenario) {
    return (
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" /> Roleplay de Treinamento
          </h1>
          <p className="text-sm text-muted-foreground">Treine suas calls com IA simulando leads reais. Receba feedback detalhado.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenarios.map(s => (
            <Card key={s.key} className="cursor-pointer hover:border-primary transition-colors" onClick={() => startScenario(s)}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_COLOR[s.difficulty] || ''}`}>
                    {s.difficulty.split(' — ')[0]}
                  </Badge>
                </div>
                <div>
                  <p className="font-bold capitalize mb-1">{s.key.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">{s.persona}</p>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-primary font-bold uppercase mb-1">Objetivo</p>
                  <p className="text-[11px] text-muted-foreground">{s.objective}</p>
                </div>
                <Button size="sm" className="w-full">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Iniciar cenario
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={reset}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="font-bold capitalize">{currentScenario.key.replace(/_/g, ' ')}</h1>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{currentScenario.persona}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setHistory([]); setEvaluation(null); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reiniciar
          </Button>
          <Button size="sm" onClick={evaluate} disabled={evaluating || history.length < 2}>
            {evaluating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5 mr-1.5" />}
            Avaliar performance
          </Button>
        </div>
      </div>

      {/* Objective banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-3 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-primary font-bold uppercase">Seu objetivo</p>
            <p className="text-sm">{currentScenario.objective}</p>
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card>
        <CardContent className="p-4">
          <div className="h-[400px] overflow-y-auto space-y-3 mb-3 px-1">
            {history.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>O lead vai responder apos voce mandar a primeira mensagem.</p>
                <p className="text-[11px] mt-1">Comece com uma abertura (ex: "Opa, aqui e a Carol da + que Vencedores...")</p>
              </div>
            )}
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'rep' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'rep' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'
                }`}>
                  <p className="text-[10px] opacity-70 mb-0.5">{m.role === 'rep' ? 'Voce (vendedor)' : 'Lead'}</p>
                  <p className="whitespace-pre-wrap leading-snug">{m.content}</p>
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> lead esta digitando...
                </div>
              </div>
            )}
            <div ref={msgEndRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !thinking && sendMessage()}
              placeholder="Sua mensagem pro lead..."
              disabled={thinking}
            />
            <Button onClick={sendMessage} disabled={thinking || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Evaluation */}
      {evaluation && (
        <Card className="border-primary">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl"
                  style={{
                    backgroundColor: evaluation.score >= 7 ? '#10B98122' : evaluation.score >= 5 ? '#3B82F622' : '#EF444422',
                    color: evaluation.score >= 7 ? '#10B981' : evaluation.score >= 5 ? '#3B82F6' : '#EF4444',
                  }}>
                  {evaluation.score}
                </div>
                <div>
                  <p className="text-sm font-bold">Sua performance</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {evaluation.achieved_objective ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs text-green-500">Objetivo alcancado</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs text-red-500">Objetivo nao alcancado</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {evaluation.key_moment && (
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Momento chave</p>
                <p className="text-sm">{evaluation.key_moment}</p>
              </div>
            )}

            {evaluation.strengths?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-500 uppercase mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Pontos fortes
                </p>
                <ul className="text-sm space-y-1">
                  {evaluation.strengths.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="text-green-500">·</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.weaknesses?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-500 uppercase mb-2 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" /> Pontos a melhorar
                </p>
                <ul className="text-sm space-y-1">
                  {evaluation.weaknesses.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="text-red-500">·</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.missed_opportunities?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-yellow-500 uppercase mb-2">Oportunidades perdidas</p>
                <ul className="text-sm space-y-1">
                  {evaluation.missed_opportunities.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="text-yellow-500">·</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.tone_feedback && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-[10px] text-primary font-bold uppercase mb-1">Feedback de tom</p>
                <p className="text-sm">{evaluation.tone_feedback}</p>
              </div>
            )}

            {evaluation.next_steps_for_improvement?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-primary uppercase mb-2">Proximos passos pra evoluir</p>
                <ol className="text-sm space-y-1 list-decimal pl-5">
                  {evaluation.next_steps_for_improvement.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setEvaluation(null)} className="flex-1">
                Continuar treinando
              </Button>
              <Button size="sm" onClick={reset} className="flex-1">
                Outro cenario
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
