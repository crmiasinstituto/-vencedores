import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Wand2, Sparkles, AlertCircle, Play, Rocket, BarChart3, Settings } from 'lucide-react';
import AgentV2Dashboard from './AgentV2Dashboard';
import KeywordRulesEditor from './KeywordRulesEditor';

const db = supabase as any;

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 (melhor raciocinio)' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (rapido + qualidade)' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (super rapido)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (multimodal)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (barato + rapido)' },
  ],
  'lovable-gemini': [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (rapido)' },
  ],
};

const ALL_TOOLS = [
  'update_lead', 'change_stage', 'schedule_meeting', 'confirm_meeting',
  'create_task', 'send_followup', 'transfer_to_human', 'notify_human',
  'qualify_bant', 'mark_lost', 'query_data',
];

export default function AgentV2Tab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testMessage, setTestMessage] = useState('Oi, quero saber mais sobre o Metodo + que Vencedores. Quanto custa?');
  const [testLeadId, setTestLeadId] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [view, setView] = useState<'config' | 'dashboard'>('config');
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    // `is_active` não existe em whatsapp_instances — o select inteiro voltava 42703 e o erro
    // era descartado no destructuring, então a lista de instâncias ficava vazia sem avisar.
    const [ra, ri] = await Promise.all([
      db.from('ai_sales_agents').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      db.from('whatsapp_instances_publicas').select('id, instance_name, agent_version, ai_agent_id, status').order('instance_name'),
    ]);

    if (ra.error) {
      console.error('Erro ao carregar agentes:', ra.error);
      toast.error(`Não consegui carregar os agentes: ${ra.error.message}`);
    }
    if (ri.error) {
      console.error('Erro ao carregar instâncias:', ri.error);
      toast.error(`Não consegui carregar os números: ${ri.error.message}`);
    }

    const a = ra.data || [];
    setAgents(a);
    setInstances(ri.data || []);
    if (!selectedId && a.length) {
      setSelectedId(a[0].id);
      setForm(a[0]);
    }
    setLoading(false);
  };

  /** Cria o primeiro agente com os padrões do banco, para a tela ter o que editar. */
  const criarPrimeiroAgente = async () => {
    setCriando(true);
    const { data, error } = await db
      .from('ai_sales_agents')
      .insert({
        name: 'Agente de Vendas',
        description: 'Atende no WhatsApp, qualifica e agenda.',
        system_prompt:
          'Você atende no WhatsApp do IAS Instituto. Responda curto, em português do Brasil, ' +
          'com o tom de quem já conhece a pessoa. Descubra o que ela precisa antes de oferecer ' +
          'qualquer coisa. Nunca invente data, preço ou promessa de resultado: se não souber, ' +
          'diga que vai confirmar e use transfer_to_human.',
        is_active: false,
        is_default: true,
      })
      .select()
      .single();
    setCriando(false);
    if (error) {
      toast.error(error.message || 'Não consegui criar o agente');
      return;
    }
    toast.success('Agente criado — configure e ative quando quiser');
    setAgents([data]);
    setSelectedId(data.id);
    setForm(data);
  };

  useEffect(() => {
    if (!selectedId) return;
    const a = agents.find(x => x.id === selectedId);
    if (a) setForm({ ...a });
  }, [selectedId, agents]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Carregando agentes...
        </CardContent>
      </Card>
    );
  }

  // Sem nenhum agente cadastrado a tela ficava em "Carregando agentes..." para sempre:
  // `form` só era preenchido quando a consulta trazia alguma linha, e a tabela está vazia.
  if (!form) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Rocket className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Nenhum agente configurado ainda</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Crie o primeiro para definir o prompt, o número que ele atende e as regras de
              pausa. Ele nasce desligado — nada é enviado até você ativar.
            </p>
          </div>
          <Button onClick={criarPrimeiroAgente} disabled={criando} className="gap-2">
            {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Criar agente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const availableModels = MODELS_BY_PROVIDER[form.provider || 'anthropic'] || [];

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        system_prompt: form.system_prompt,
        provider: form.provider,
        model: form.model,
        temperature: form.temperature,
        max_tokens: form.max_tokens,
        is_active: form.is_active,
        is_default: form.is_default,
        tools_enabled: form.tools_enabled,
        settings: form.settings,
        keyword_rules: form.keyword_rules || {},
        instance_id: form.instance_id || null,
        updated_at: new Date().toISOString(),
      };

      if (form.is_default) {
        // Unset previous default
        await db.from('ai_sales_agents').update({ is_default: false }).neq('id', form.id);
      }

      const { error } = await db.from('ai_sales_agents').update(payload).eq('id', form.id);
      if (error) throw error;
      toast.success('Agente salvo');
      await load();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const createAgent = async () => {
    const { data, error } = await db.from('ai_sales_agents').insert({
      name: 'Novo agente',
      system_prompt: 'Voce e um SDR da + que Vencedores. Qualifique leads de forma natural e conversacional.',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      tools_enabled: ALL_TOOLS,
      is_active: true,
    }).select().single();
    if (error) { toast.error('Erro: ' + error.message); return; }
    setSelectedId(data.id);
    setForm(data);
    await load();
  };

  const toggleInstance = async (instanceId: string, useV2: boolean) => {
    await db.from('whatsapp_instances').update({
      agent_version: useV2 ? 'v2' : 'v1',
      ai_agent_id: useV2 ? form.id : null,
    }).eq('id', instanceId);
    toast.success(useV2 ? 'Instancia usando v2' : 'Instancia usando v1');
    load();
  };

  const runTest = async () => {
    if (!testMessage || !testLeadId) {
      toast.error('Preencha mensagem e lead_id');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-sales-agent-v2', {
        body: { lead_id: testLeadId, message_text: testMessage, agent_id: form.id, dry_run: true },
      });
      if (error) throw error;
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const toolToggle = (tool: string) => {
    const next = (form.tools_enabled || []).includes(tool)
      ? form.tools_enabled.filter((t: string) => t !== tool)
      : [...(form.tools_enabled || []), tool];
    setForm({ ...form, tools_enabled: next });
  };

  return (
    <div className="space-y-4">
      {/* Header + agent picker */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Rocket className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold">Agente + que Vencedores AI v2</p>
            <p className="text-xs text-muted-foreground">Multi-LLM + tools + bot detection + cadencias. Configure um agente e ative nas instancias WhatsApp.</p>
          </div>
          <Select value={selectedId || ''} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} {a.is_default && '⭐'} {!a.is_active && '(inativo)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={createAgent}>+ Novo</Button>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView('config')}
              className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1 ${view === 'config' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              <Settings className="w-3.5 h-3.5" /> Config
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1 ${view === 'dashboard' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Performance
            </button>
          </div>
        </CardContent>
      </Card>

      {view === 'dashboard' && <AgentV2Dashboard agentId={selectedId} />}
      {view === 'config' && (<div className="space-y-4">

      {/* General settings */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Identidade & modelo</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descricao interna</Label>
              <Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select value={form.provider || 'anthropic'} onValueChange={(v) => setForm({ ...form, provider: v, model: MODELS_BY_PROVIDER[v][0].value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="lovable-gemini">Lovable Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableModels.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Temperatura ({form.temperature})</Label>
              <Slider value={[form.temperature * 100]} min={0} max={100} step={5}
                onValueChange={(v) => setForm({ ...form, temperature: v[0] / 100 })} />
              <p className="text-xs text-muted-foreground">Baixo = determinista. Alto = criativo.</p>
            </div>
            <div className="space-y-2">
              <Label>Max tokens</Label>
              <Input type="number" value={form.max_tokens || 1200} onChange={(e) => setForm({ ...form, max_tokens: parseInt(e.target.value) || 1200 })} />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
              <Label>Agente padrao</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System prompt */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">System prompt</p>
          </div>
          <Textarea
            value={form.system_prompt || ''}
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            className="min-h-[260px] font-mono text-xs"
            placeholder="Descreva a personalidade, objetivo, restricoes, tom de voz..."
          />
          <p className="text-xs text-muted-foreground">
            O agente sempre recebe dados do lead (nome, empresa, score, notas) no contexto automaticamente. Nao precisa colocar placeholders aqui.
          </p>
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold">Ferramentas ativas ({(form.tools_enabled || []).length} de {ALL_TOOLS.length})</p>
          <div className="flex flex-wrap gap-2">
            {ALL_TOOLS.map(t => {
              const active = (form.tools_enabled || []).includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toolToggle(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Keyword rules */}
      <KeywordRulesEditor
        value={form.keyword_rules || {}}
        onChange={(v) => setForm({ ...form, keyword_rules: v })}
      />

      {/* Comportamento e tempo */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-semibold">Comportamento e tempo de resposta</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Resposta: tempo minimo (segundos)</Label>
              <Input type="number" min={0} step={0.5}
                value={(form.settings?.response_delay_min_ms ?? 1500) / 1000}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), response_delay_min_ms: Math.round(Number(e.target.value) * 1000) } })} />
            </div>
            <div>
              <Label className="text-xs">Resposta: tempo maximo (segundos)</Label>
              <Input type="number" min={0} step={0.5}
                value={(form.settings?.response_delay_max_ms ?? 4500) / 1000}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), response_delay_max_ms: Math.round(Number(e.target.value) * 1000) } })} />
            </div>
            <div>
              <Label className="text-xs">Agrupar mensagens por (segundos)</Label>
              <Input type="number" min={0}
                value={form.settings?.debounce_seconds ?? 8}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), debounce_seconds: Number(e.target.value) } })} />
            </div>
            <div>
              <Label className="text-xs">Pausa apos humano responder (minutos)</Label>
              <Input type="number" min={0}
                value={form.settings?.auto_pause_minutes ?? 1440}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), auto_pause_minutes: Number(e.target.value) } })} />
            </div>
            <div>
              <Label className="text-xs">Atende das</Label>
              <Input type="time"
                value={form.settings?.working_hours_start ?? '08:00'}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), working_hours_start: e.target.value } })} />
            </div>
            <div>
              <Label className="text-xs">Ate as</Label>
              <Input type="time"
                value={form.settings?.working_hours_end ?? '21:00'}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), working_hours_end: e.target.value } })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Dias de atendimento</Label>
            <div className="flex gap-1.5 mt-1.5">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d, idx) => {
                const days: number[] = form.settings?.working_days ?? [1, 2, 3, 4, 5, 6];
                const on = days.includes(idx);
                return (
                  <button key={idx} type="button"
                    onClick={() => {
                      const next = on ? days.filter((x: number) => x !== idx) : [...days, idx].sort((a, b) => a - b);
                      setForm({ ...form, settings: { ...(form.settings || {}), working_days: next } });
                    }}
                    className={`w-10 h-9 rounded-md text-xs font-medium transition-all ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Max mensagens por conversa</Label>
              <Input type="number" min={0}
                value={form.settings?.max_messages_per_conversation ?? 30}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), max_messages_per_conversation: Number(e.target.value) } })} />
            </div>
            <div>
              <Label className="text-xs">Max novos contatos por dia</Label>
              <Input type="number" min={0}
                value={form.settings?.max_new_contacts_per_day ?? 50}
                onChange={(e) => setForm({ ...form, settings: { ...(form.settings || {}), max_new_contacts_per_day: Number(e.target.value) } })} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Dias e horario controlam quando o agente responde, fora disso ele ignora. "Pausa apos humano" e quanto tempo ele fica quieto depois que voce responde manualmente pelo WhatsApp.</p>
        </CardContent>
      </Card>

      {/* WhatsApp instances binding */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold">Instancias WhatsApp</p>
          <p className="text-xs text-muted-foreground">
            Escolha quais instancias devem usar este agente v2 (desliga o v1 automaticamente).
          </p>
          <div className="space-y-2">
            {instances.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma instancia configurada</p>}
            {instances.map(inst => {
              const isV2 = inst.agent_version === 'v2' && inst.ai_agent_id === form.id;
              return (
                <div key={inst.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{inst.instance_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Versao atual: <Badge variant="outline" className="ml-1">{inst.agent_version || 'v1'}</Badge>
                      {inst.ai_agent_id && inst.ai_agent_id !== form.id && (
                        <span className="text-yellow-500 ml-2">(ligada a outro agente)</span>
                      )}
                    </p>
                  </div>
                  <Switch checked={isV2} onCheckedChange={(v) => toggleInstance(inst.id, v)} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dry-run tester */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Testar ao vivo (dry-run, sem enviar)</p>
          </div>
          <div className="space-y-2">
            <Label>Lead ID</Label>
            <Input value={testLeadId} onChange={(e) => setTestLeadId(e.target.value)} placeholder="UUID de um lead existente" className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Mensagem simulada do lead</Label>
            <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
          </div>
          <Button onClick={runTest} disabled={testing} className="bg-primary text-primary-foreground">
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Rodar teste
          </Button>
          {testResult && (
            <div className="mt-2 p-3 bg-muted/40 rounded-lg space-y-2">
              {testResult.error ? (
                <div className="flex items-start gap-2 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <p className="font-mono">{testResult.error}</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Resposta</p>
                    <p className="text-sm">{testResult.response}</p>
                  </div>
                  {testResult.tools?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Ferramentas executadas</p>
                      <pre className="text-xs font-mono bg-black/20 p-2 rounded overflow-auto max-h-[200px]">{JSON.stringify(testResult.tools, null, 2)}</pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex justify-end gap-2">
        <Button size="lg" onClick={save} disabled={saving} className="bg-primary text-primary-foreground shadow-lg">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar alteracoes
        </Button>
      </div>
      </div>)}
    </div>
  );
}
