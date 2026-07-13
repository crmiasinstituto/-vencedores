import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Brain, Send, Sparkles, FileText, Image as ImageIcon, BarChart3, Globe,
  Loader2, History, Plus, Copy as CopyIcon, Check, Megaphone, Settings,
  Trash2, ChevronRight, Wand2, Target, Users, Palette,
} from 'lucide-react';

const db = supabase as any;

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

interface BriefingNegocio {
  id: string;
  empresa: string;
  tipo_negocio: string | null;
  produto_servico: string | null;
  ticket_medio: number | null;
  responsavel: string | null;
  publico_perfil: string | null;
  dores: string[];
  desejos: string[];
  canais: string[];
  formalidade: string | null;
  palavras_banidas: string[];
  palavras_caracteristicas: string[];
  identidade_visual: Record<string, any>;
  is_default: boolean;
}

interface ChatSession {
  id: string;
  titulo: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent: string | null;
  metadata: any;
  created_at: string;
}

interface AcaoSugerida {
  agent: 'copy' | 'criativo' | 'midia' | 'web' | 'iniciativa';
  tipo: string;
  label: string;
  briefing: Record<string, unknown>;
}

interface AiOutput {
  id: string;
  session_id: string | null;
  initiative_id: string | null;
  agent: string;
  tipo: string;
  titulo: string | null;
  briefing: any;
  resultado: any;
  raw_text: string | null;
  status: string;
  created_at: string;
}

const agentConfig: Record<string, { label: string; icon: any; color: string }> = {
  maestro: { label: 'Maestro', icon: Brain, color: 'text-primary' },
  copy: { label: 'Copy', icon: FileText, color: 'text-blue-400' },
  criativo: { label: 'Criativo', icon: ImageIcon, color: 'text-purple-400' },
  midia: { label: 'Mídia', icon: BarChart3, color: 'text-green-400' },
  web: { label: 'Web', icon: Globe, color: 'text-amber-400' },
  iniciativa: { label: 'Iniciativa', icon: Megaphone, color: 'text-rose-400' },
};

const tipoLabels: Record<string, string> = {
  ad_meta: 'Anúncio Meta',
  email: 'Sequência Email',
  vsl: 'Roteiro VSL',
  lp: 'Copy LP',
  whatsapp: 'WhatsApp',
  brief_imagem: 'Brief Visual',
  identidade_evento: 'Identidade Evento',
  direcao_campanha: 'Direção Campanha',
  estrutura_campanha: 'Estrutura Campanha',
  analise_3periodos: 'Análise 3 Períodos',
  relatorio_4h: 'Relatório 4h',
  recomendacao: 'Recomendação',
  lp_estrutura: 'Estrutura LP',
  quiz_config: 'Quiz Page',
  auditoria: 'Auditoria',
};

// ──────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────

export default function AdminMarketingIA() {
  const [activeTab, setActiveTab] = useState('chat');

  // Briefing
  const [briefing, setBriefing] = useState<BriefingNegocio | null>(null);
  const [editingBriefing, setEditingBriefing] = useState(false);

  // Chat
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Outputs
  const [outputs, setOutputs] = useState<AiOutput[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<AiOutput | null>(null);
  const [generatingAgent, setGeneratingAgent] = useState<string | null>(null);

  // Modal de geração standalone (sem chat)
  const [showStandaloneDialog, setShowStandaloneDialog] = useState(false);
  const [standaloneAgent, setStandaloneAgent] = useState<'copy' | 'criativo' | 'midia' | 'web'>('copy');
  const [standaloneTipo, setStandaloneTipo] = useState('ad_meta');
  const [standaloneBriefing, setStandaloneBriefing] = useState('');

  // ── Fetching ──

  async function fetchBriefing() {
    const { data, error } = await db
      .from('marketing_briefing')
      .select('*')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();
    if (error) { console.error(error); return; }
    setBriefing(data);
  }

  async function fetchSessions() {
    const { data, error } = await supabase.functions.invoke('marketing-maestro', {
      body: { action: 'list_sessions', limit: 50 },
    });
    if (error || !data?.success) return;
    setSessions(data.sessions ?? []);
  }

  async function fetchSession(id: string) {
    const { data, error } = await supabase.functions.invoke('marketing-maestro', {
      body: { action: 'get_session', session_id: id },
    });
    if (error || !data?.success) return;
    setMessages(data.messages ?? []);
    setOutputs(data.outputs ?? []);
  }

  async function fetchOutputs() {
    const { data, error } = await db
      .from('marketing_ai_outputs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) { console.error(error); return; }
    setOutputs(data ?? []);
  }

  useEffect(() => {
    fetchBriefing();
    fetchSessions();
    fetchOutputs();
  }, []);

  useEffect(() => {
    if (currentSessionId) fetchSession(currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Chat actions ──

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || sending) return;

    setSending(true);
    setChatInput('');

    // Otimista: adiciona mensagem do user na UI
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      agent: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const { data, error } = await supabase.functions.invoke('marketing-maestro', {
        body: {
          action: 'chat',
          message: text,
          session_id: currentSessionId,
          briefing_id: briefing?.id,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error ?? 'Falha no maestro');
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        return;
      }

      if (!currentSessionId) {
        setCurrentSessionId(data.session_id);
        fetchSessions();
      } else {
        // recarrega histórico real
        fetchSession(data.session_id);
      }

      if (data.session_id === currentSessionId) {
        // só adiciona resposta do assistant
        const assistantMsg: ChatMessage = {
          id: `tmp-a-${Date.now()}`,
          role: 'assistant',
          content: data.resposta,
          agent: 'maestro',
          metadata: { acoes_sugeridas: data.acoes_sugeridas },
          created_at: new Date().toISOString(),
        };
        setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), { ...optimistic, id: `u-${Date.now()}` }, assistantMsg]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? 'Erro de rede');
    } finally {
      setSending(false);
    }
  }

  async function executeAction(acao: AcaoSugerida) {
    if (acao.agent === 'iniciativa') {
      // criar iniciativa
      const { error } = await db.from('marketing_initiatives').insert({
        ...acao.briefing,
        briefing_id: briefing?.id,
      });
      if (error) { toast.error('Erro ao criar iniciativa'); return; }
      toast.success('Iniciativa criada');
      return;
    }

    setGeneratingAgent(acao.agent);
    try {
      const fnName = `marketing-${acao.agent}`;
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: {
          action: 'generate',
          tipo: acao.tipo,
          briefing: acao.briefing,
          session_id: currentSessionId,
          briefing_id: briefing?.id,
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error ?? `Falha em ${acao.agent}`);
        return;
      }
      toast.success(`${agentConfig[acao.agent]?.label} entregou: ${tipoLabels[acao.tipo] ?? acao.tipo}`);
      if (currentSessionId) fetchSession(currentSessionId);
      fetchOutputs();
      setActiveTab('outputs');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? 'Erro');
    } finally {
      setGeneratingAgent(null);
    }
  }

  async function executeStandalone() {
    if (standaloneBriefing.trim().length < 5) {
      toast.error('Descreva o briefing com mais detalhes');
      return;
    }
    const briefingObj = { descricao: standaloneBriefing };
    setShowStandaloneDialog(false);
    await executeAction({
      agent: standaloneAgent,
      tipo: standaloneTipo,
      label: 'Standalone',
      briefing: briefingObj,
    });
    setStandaloneBriefing('');
  }

  function newSession() {
    setCurrentSessionId(null);
    setMessages([]);
    setOutputs([]);
  }

  async function deleteSession(id: string) {
    if (!confirm('Excluir esta conversa?')) return;
    const { error } = await db.from('marketing_ai_sessions').update({ status: 'arquivado' }).eq('id', id);
    if (error) { toast.error('Erro ao arquivar'); return; }
    if (currentSessionId === id) newSession();
    fetchSessions();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  }

  // ── Briefing ──

  async function saveBriefing(updates: Partial<BriefingNegocio>) {
    if (!briefing) return;
    const payload = {
      ...updates,
      dores: typeof updates.dores === 'string' ? (updates.dores as any).split('\n').filter(Boolean) : updates.dores,
      desejos: typeof updates.desejos === 'string' ? (updates.desejos as any).split('\n').filter(Boolean) : updates.desejos,
      canais: typeof updates.canais === 'string' ? (updates.canais as any).split(',').map((s: string) => s.trim()).filter(Boolean) : updates.canais,
      palavras_banidas: typeof updates.palavras_banidas === 'string' ? (updates.palavras_banidas as any).split(',').map((s: string) => s.trim()).filter(Boolean) : updates.palavras_banidas,
      palavras_caracteristicas: typeof updates.palavras_caracteristicas === 'string' ? (updates.palavras_caracteristicas as any).split(',').map((s: string) => s.trim()).filter(Boolean) : updates.palavras_caracteristicas,
    };
    const { error } = await db.from('marketing_briefing').update(payload).eq('id', briefing.id);
    if (error) { toast.error('Erro ao salvar briefing'); return; }
    toast.success('Briefing atualizado');
    fetchBriefing();
    setEditingBriefing(false);
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Marketing IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Maestro estratégico + Copy, Criativo, Mídia e Web. Tudo em um lugar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingBriefing(true)} className="gap-2">
            <Settings className="w-4 h-4" />
            Briefing do negócio
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowStandaloneDialog(true)} className="gap-2">
            <Wand2 className="w-4 h-4" />
            Gerar direto
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="chat" className="gap-2"><Brain className="w-4 h-4" /> Chat com Maestro</TabsTrigger>
          <TabsTrigger value="outputs" className="gap-2"><Sparkles className="w-4 h-4" /> Outputs</TabsTrigger>
          <TabsTrigger value="iniciativas" className="gap-2"><Megaphone className="w-4 h-4" /> Iniciativas</TabsTrigger>
        </TabsList>

        {/* ════════ CHAT ════════ */}
        <TabsContent value="chat" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-220px)]">
            {/* Sidebar de sessões */}
            <Card className="lg:col-span-3 bg-card border-border flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Conversas
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={newSession} className="h-7">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full px-3 pb-3">
                  <div className="space-y-1.5">
                    {sessions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Nenhuma conversa ainda. Comece pelo chat ao lado.
                      </p>
                    )}
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setCurrentSessionId(s.id)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors group ${
                          currentSessionId === s.id
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-background border-border hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {s.titulo ?? 'Conversa sem título'}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(s.updated_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-400" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat principal */}
            <Card className="lg:col-span-9 bg-card border-border flex flex-col">
              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                {/* Mensagens */}
                <ScrollArea className="flex-1 px-6 py-4">
                  {messages.length === 0 ? (
                    <EmptyChat
                      onSuggest={(s) => setChatInput(s)}
                      empresa={briefing?.empresa}
                    />
                  ) : (
                    <div className="space-y-4 max-w-3xl mx-auto">
                      {messages.map((m) => (
                        <MessageBubble
                          key={m.id}
                          msg={m}
                          onActionClick={executeAction}
                          generatingAgent={generatingAgent}
                          onCopy={copyToClipboard}
                        />
                      ))}
                      {sending && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Maestro pensando...
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="border-t border-border p-4">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex gap-2">
                      <Textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Pergunta o que quiser sobre marketing... (ex: monta um plano de captação pro lançamento de maio, R$5k budget, ticket R$2997)"
                        rows={2}
                        className="bg-background resize-none"
                        disabled={sending}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={sending || !chatInput.trim()}
                        className="h-auto px-4"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Enter pra enviar · Shift+Enter pra quebrar linha · Briefing do negócio carregado automaticamente
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════ OUTPUTS ════════ */}
        <TabsContent value="outputs" className="mt-4">
          <OutputsPanel outputs={outputs} onSelect={setSelectedOutput} onRefresh={fetchOutputs} />
        </TabsContent>

        {/* ════════ INICIATIVAS ════════ */}
        <TabsContent value="iniciativas" className="mt-4">
          <InitiativesPanel briefingId={briefing?.id ?? null} />
        </TabsContent>
      </Tabs>

      {/* Briefing dialog */}
      <Dialog open={editingBriefing} onOpenChange={setEditingBriefing}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> Briefing do Negócio
            </DialogTitle>
          </DialogHeader>
          {briefing && <BriefingForm briefing={briefing} onSave={saveBriefing} />}
        </DialogContent>
      </Dialog>

      {/* Output detail dialog */}
      <Dialog open={selectedOutput !== null} onOpenChange={(o) => !o && setSelectedOutput(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedOutput && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const cfg = agentConfig[selectedOutput.agent];
                    const Icon = cfg?.icon ?? Sparkles;
                    return <Icon className={`w-5 h-5 ${cfg?.color ?? 'text-primary'}`} />;
                  })()}
                  {selectedOutput.titulo ?? 'Output'}
                  <Badge variant="outline" className="ml-2">{tipoLabels[selectedOutput.tipo] ?? selectedOutput.tipo}</Badge>
                </DialogTitle>
              </DialogHeader>
              <OutputDetail output={selectedOutput} onCopy={copyToClipboard} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Standalone dialog */}
      <Dialog open={showStandaloneDialog} onOpenChange={setShowStandaloneDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" /> Gerar direto (sem chat)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Agente</Label>
                <Select value={standaloneAgent} onValueChange={(v: any) => {
                  setStandaloneAgent(v);
                  // ajusta tipo default
                  if (v === 'copy') setStandaloneTipo('ad_meta');
                  if (v === 'criativo') setStandaloneTipo('brief_imagem');
                  if (v === 'midia') setStandaloneTipo('estrutura_campanha');
                  if (v === 'web') setStandaloneTipo('lp_estrutura');
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="copy">Copy</SelectItem>
                    <SelectItem value="criativo">Criativo</SelectItem>
                    <SelectItem value="midia">Mídia</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={standaloneTipo} onValueChange={setStandaloneTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {standaloneAgent === 'copy' && (
                      <>
                        <SelectItem value="ad_meta">Anúncio Meta</SelectItem>
                        <SelectItem value="email">Sequência Email</SelectItem>
                        <SelectItem value="vsl">Roteiro VSL</SelectItem>
                        <SelectItem value="lp">Copy LP</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </>
                    )}
                    {standaloneAgent === 'criativo' && (
                      <>
                        <SelectItem value="brief_imagem">Brief de Imagem</SelectItem>
                        <SelectItem value="identidade_evento">Identidade Evento</SelectItem>
                        <SelectItem value="direcao_campanha">Direção Campanha</SelectItem>
                      </>
                    )}
                    {standaloneAgent === 'midia' && (
                      <>
                        <SelectItem value="estrutura_campanha">Estrutura Campanha</SelectItem>
                        <SelectItem value="analise_3periodos">Análise 3 Períodos</SelectItem>
                        <SelectItem value="relatorio_4h">Relatório 4h</SelectItem>
                        <SelectItem value="recomendacao">Recomendação</SelectItem>
                      </>
                    )}
                    {standaloneAgent === 'web' && (
                      <>
                        <SelectItem value="lp_estrutura">Estrutura de LP</SelectItem>
                        <SelectItem value="quiz_config">Quiz Page</SelectItem>
                        <SelectItem value="auditoria">Auditoria</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Briefing</Label>
              <Textarea
                value={standaloneBriefing}
                onChange={(e) => setStandaloneBriefing(e.target.value)}
                placeholder="Descreva o objetivo, público, temperatura, oferta, prazo. Quanto mais contexto, melhor o output."
                rows={6}
                className="bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowStandaloneDialog(false)}>Cancelar</Button>
              <Button onClick={executeStandalone} disabled={generatingAgent !== null} className="gap-2">
                {generatingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Subcomponentes
// ──────────────────────────────────────────────────────────────────────

function EmptyChat({ onSuggest, empresa }: { onSuggest: (s: string) => void; empresa?: string }) {
  const sugestoes = [
    'Quero rodar uma campanha de captação contínua. R$200/dia, ticket R$2997. Por onde começar?',
    'Diagnóstico: meu CPL tá em R$32 e a meta é R$15. O que pode estar acontecendo?',
    'Monta um plano de lançamento pra evento de 3 dias daqui 30 dias. R$5k budget.',
    'Preciso de copy de remarketing pra quem visitou a LP e não comprou.',
    'Briefing visual pra criativo de público frio focado na dor do operacional.',
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto py-12">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Brain className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold mb-2">Maestro de Marketing</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Estratégia + Copy + Criativo + Mídia + Web num só agente. {empresa ? `Configurado pra ${empresa}.` : ''} Pergunta o que quiser.
      </p>
      <div className="grid gap-2 w-full">
        {sugestoes.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggest(s)}
            className="text-left text-sm p-3 rounded-lg border border-border bg-background hover:bg-accent/50 hover:border-primary/50 transition-all"
          >
            <ChevronRight className="w-3.5 h-3.5 inline mr-1.5 text-primary" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  msg, onActionClick, generatingAgent, onCopy,
}: {
  msg: ChatMessage;
  onActionClick: (a: AcaoSugerida) => void;
  generatingAgent: string | null;
  onCopy: (t: string) => void;
}) {
  const isUser = msg.role === 'user';
  const acoes: AcaoSugerida[] = msg.metadata?.acoes_sugeridas ?? [];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2.5 max-w-[80%]">
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Brain className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="bg-card border border-border rounded-2xl px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-primary">Maestro</span>
            <button
              onClick={() => onCopy(msg.content)}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-sm whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>

        {/* Ações sugeridas */}
        {acoes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {acoes.map((a, i) => {
              const cfg = agentConfig[a.agent];
              const Icon = cfg?.icon ?? Sparkles;
              const isGenerating = generatingAgent === a.agent;
              return (
                <button
                  key={i}
                  onClick={() => onActionClick(a)}
                  disabled={generatingAgent !== null}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                    isGenerating
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background hover:bg-primary/10 hover:border-primary/50'
                  } disabled:opacity-50`}
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className={`w-3 h-3 ${cfg?.color ?? ''}`} />}
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OutputsPanel({
  outputs, onSelect, onRefresh,
}: {
  outputs: AiOutput[];
  onSelect: (o: AiOutput) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<string>('todos');
  const filtered = useMemo(() => {
    if (filter === 'todos') return outputs;
    return outputs.filter((o) => o.agent === filter);
  }, [outputs, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['todos', 'copy', 'criativo', 'midia', 'web'].map((k) => (
            <Button
              key={k}
              variant={filter === k ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(k)}
              className="capitalize"
            >
              {k === 'todos' ? 'Todos' : agentConfig[k]?.label ?? k}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>Atualizar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3 bg-card border-border">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum output {filter !== 'todos' ? `do ${agentConfig[filter]?.label}` : ''} ainda. Use o chat ou "Gerar direto".
            </CardContent>
          </Card>
        ) : (
          filtered.map((o) => {
            const cfg = agentConfig[o.agent];
            const Icon = cfg?.icon ?? Sparkles;
            return (
              <button
                key={o.id}
                onClick={() => onSelect(o)}
                className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg?.color ?? 'text-primary'}`} />
                    <Badge variant="outline" className="text-[10px]">{cfg?.label ?? o.agent}</Badge>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{tipoLabels[o.tipo] ?? o.tipo}</Badge>
                </div>
                <h3 className="font-medium text-sm line-clamp-2 mb-1">{o.titulo ?? 'Sem título'}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(o.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function OutputDetail({ output, onCopy }: { output: AiOutput; onCopy: (t: string) => void }) {
  const [r, setR] = useState<any>(output.resultado ?? {});
  const [generatingImage, setGeneratingImage] = useState(false);

  useEffect(() => { setR(output.resultado ?? {}); }, [output.id, output.resultado]);

  const isCriativo = output.agent === 'criativo';
  const promptImagem = r?.prompt_imagem;
  const imageBase64 = r?.image_base64;

  async function generateImage() {
    if (!promptImagem) return;
    setGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-criativo', {
        body: { action: 'generate_image', output_id: output.id, prompt: promptImagem },
      });
      if (error || !data?.success) {
        toast.error(data?.error ?? 'Falha ao gerar imagem');
        return;
      }
      setR((prev: any) => ({ ...prev, image_base64: data.image_base64 }));
      toast.success('Imagem gerada!');
    } finally {
      setGeneratingImage(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Briefing usado */}
      {output.briefing && Object.keys(output.briefing).length > 0 && (
        <Card className="bg-background border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Briefing usado</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
              {JSON.stringify(output.briefing, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Imagem gerada (se houver) */}
      {imageBase64 && (
        <Card className="bg-background border-primary/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-wide text-primary">Imagem gerada</CardTitle>
            <a href={imageBase64} download={`${output.titulo ?? 'criativo'}.png`} className="text-xs text-primary hover:underline">Baixar</a>
          </CardHeader>
          <CardContent>
            <img src={imageBase64} alt="Criativo gerado" className="w-full rounded-lg border border-border" />
          </CardContent>
        </Card>
      )}

      {/* Botao gerar imagem (so pra criativos com prompt e sem imagem) */}
      {isCriativo && promptImagem && !imageBase64 && (
        <Button onClick={generateImage} disabled={generatingImage} className="w-full gap-2">
          {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          Gerar imagem com Gemini 3 Image
        </Button>
      )}

      {/* Resultado estruturado */}
      <Card className="bg-background border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onCopy(JSON.stringify(r, null, 2))} className="h-7 gap-1.5">
            <CopyIcon className="w-3 h-3" /> Copiar JSON
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(r).filter(([k]) => k !== 'image_base64').map(([key, val]) => (
            <div key={key} className="border-l-2 border-primary/30 pl-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{key}</p>
                {typeof val === 'string' && val.length > 30 && (
                  <button onClick={() => onCopy(val as string)} className="opacity-50 hover:opacity-100">
                    <CopyIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
              {typeof val === 'string' ? (
                <p className="text-sm whitespace-pre-wrap">{val}</p>
              ) : (
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground bg-muted/30 p-2 rounded mt-1">
                  {JSON.stringify(val, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function BriefingForm({
  briefing, onSave,
}: {
  briefing: BriefingNegocio;
  onSave: (u: Partial<BriefingNegocio>) => void;
}) {
  const [form, setForm] = useState<any>({
    empresa: briefing.empresa,
    tipo_negocio: briefing.tipo_negocio,
    produto_servico: briefing.produto_servico,
    ticket_medio: briefing.ticket_medio,
    publico_perfil: briefing.publico_perfil,
    dores: (briefing.dores ?? []).join('\n'),
    desejos: (briefing.desejos ?? []).join('\n'),
    canais: (briefing.canais ?? []).join(', '),
    formalidade: briefing.formalidade,
    palavras_banidas: (briefing.palavras_banidas ?? []).join(', '),
    palavras_caracteristicas: (briefing.palavras_caracteristicas ?? []).join(', '),
    identidade_visual: briefing.identidade_visual,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Empresa</Label>
          <Input value={form.empresa ?? ''} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.tipo_negocio ?? ''} onValueChange={(v) => setForm({ ...form, tipo_negocio: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ecommerce">E-commerce</SelectItem>
              <SelectItem value="servico">Serviço</SelectItem>
              <SelectItem value="saas">SaaS</SelectItem>
              <SelectItem value="infoproduto">Infoproduto</SelectItem>
              <SelectItem value="varejo">Varejo</SelectItem>
              <SelectItem value="b2b">B2B</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Produto/Serviço</Label>
        <Textarea
          rows={2}
          value={form.produto_servico ?? ''}
          onChange={(e) => setForm({ ...form, produto_servico: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Ticket Médio (R$)</Label>
          <Input
            type="number"
            value={form.ticket_medio ?? ''}
            onChange={(e) => setForm({ ...form, ticket_medio: parseFloat(e.target.value) || null })}
          />
        </div>
        <div>
          <Label>Formalidade</Label>
          <Select value={form.formalidade ?? ''} onValueChange={(v) => setForm({ ...form, formalidade: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="informal">Informal</SelectItem>
              <SelectItem value="super_informal">Super informal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Perfil do público</Label>
        <Textarea
          rows={2}
          value={form.publico_perfil ?? ''}
          onChange={(e) => setForm({ ...form, publico_perfil: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Dores (uma por linha)</Label>
          <Textarea rows={4} value={form.dores} onChange={(e) => setForm({ ...form, dores: e.target.value })} />
        </div>
        <div>
          <Label>Desejos (uma por linha)</Label>
          <Textarea rows={4} value={form.desejos} onChange={(e) => setForm({ ...form, desejos: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Canais (separar por vírgula)</Label>
        <Input value={form.canais} onChange={(e) => setForm({ ...form, canais: e.target.value })} />
      </div>

      <div>
        <Label>Palavras BANIDAS (separar por vírgula)</Label>
        <Input value={form.palavras_banidas} onChange={(e) => setForm({ ...form, palavras_banidas: e.target.value })} />
      </div>

      <div>
        <Label>Palavras Características (separar por vírgula)</Label>
        <Input value={form.palavras_caracteristicas} onChange={(e) => setForm({ ...form, palavras_caracteristicas: e.target.value })} />
      </div>

      <div>
        <Label className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Identidade visual (JSON)</Label>
        <Textarea
          rows={3}
          value={JSON.stringify(form.identidade_visual ?? {}, null, 2)}
          onChange={(e) => {
            try { setForm({ ...form, identidade_visual: JSON.parse(e.target.value) }); } catch {}
          }}
          className="font-mono text-xs"
        />
      </div>

      <Button onClick={() => onSave(form)} className="w-full gap-2">
        <Check className="w-4 h-4" /> Salvar briefing
      </Button>
    </div>
  );
}

interface Initiative {
  id: string;
  nome: string;
  tipo: string;
  fase: string;
  objetivo: string | null;
  produto: string | null;
  ticket: number | null;
  budget: number | null;
  data_evento: string | null;
  status: string;
  publico_alvo: any;
  resultado: any;
  created_at: string;
}

function InitiativesPanel({ briefingId }: { briefingId: string | null }) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    nome: '', tipo: 'campanha_continua', fase: 'estrategia',
    objetivo: '', produto: '', ticket: '', budget: '', data_evento: '',
  });

  async function fetchAll() {
    const { data, error } = await db
      .from('marketing_initiatives')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    setInitiatives(data ?? []);
  }

  useEffect(() => { fetchAll(); }, []);

  async function save() {
    if (!form.nome) { toast.error('Nome obrigatório'); return; }
    const payload: any = {
      nome: form.nome,
      tipo: form.tipo,
      fase: form.fase,
      objetivo: form.objetivo || null,
      produto: form.produto || null,
      ticket: parseFloat(form.ticket) || null,
      budget: parseFloat(form.budget) || null,
      data_evento: form.data_evento || null,
      briefing_id: briefingId,
    };
    const { error } = await db.from('marketing_initiatives').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Iniciativa criada');
    setShowDialog(false);
    setForm({ nome: '', tipo: 'campanha_continua', fase: 'estrategia', objetivo: '', produto: '', ticket: '', budget: '', data_evento: '' });
    fetchAll();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Iniciativas</h2>
          <p className="text-xs text-muted-foreground">Campanhas, lançamentos, promoções e remarketing</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova iniciativa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {initiatives.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma iniciativa criada ainda. O Maestro pode sugerir uma pra você no chat.
            </CardContent>
          </Card>
        ) : (
          initiatives.map((it) => (
            <Card key={it.id} className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="capitalize">{it.tipo.replace(/_/g, ' ')}</Badge>
                  <Badge variant={it.status === 'ativo' ? 'default' : 'secondary'}>{it.status}</Badge>
                </div>
                <h3 className="font-semibold mb-2">{it.nome}</h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><Target className="w-3 h-3 inline mr-1" /> Fase: <span className="text-foreground capitalize">{it.fase}</span></p>
                  {it.budget && <p>Budget: <span className="text-foreground">R$ {it.budget.toLocaleString('pt-BR')}</span></p>}
                  {it.ticket && <p>Ticket: <span className="text-foreground">R$ {it.ticket.toLocaleString('pt-BR')}</span></p>}
                  {it.data_evento && <p>Evento: <span className="text-foreground">{new Date(it.data_evento).toLocaleDateString('pt-BR')}</span></p>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova iniciativa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Lançamento Imersão + que Vencedores - Maio" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campanha_continua">Campanha contínua</SelectItem>
                    <SelectItem value="lancamento">Lançamento</SelectItem>
                    <SelectItem value="promocao">Promoção</SelectItem>
                    <SelectItem value="remarketing">Remarketing</SelectItem>
                    <SelectItem value="branding">Branding</SelectItem>
                    <SelectItem value="b2b_leads">Leads B2B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fase</Label>
                <Select value={form.fase} onValueChange={(v) => setForm({ ...form, fase: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estrategia">Estratégia</SelectItem>
                    <SelectItem value="captacao">Captação</SelectItem>
                    <SelectItem value="aquecimento">Aquecimento</SelectItem>
                    <SelectItem value="conversao">Conversão</SelectItem>
                    <SelectItem value="pos">Pós</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Ex: Captar 1000 leads em 30 dias" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Produto</Label>
                <Input value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })} />
              </div>
              <div>
                <Label>Ticket (R$)</Label>
                <Input type="number" value={form.ticket} onChange={(e) => setForm({ ...form, ticket: e.target.value })} />
              </div>
              <div>
                <Label>Budget (R$)</Label>
                <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Data do evento</Label>
              <Input type="date" value={form.data_evento} onChange={(e) => setForm({ ...form, data_evento: e.target.value })} />
            </div>
            <Button onClick={save} className="w-full">Criar iniciativa</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
