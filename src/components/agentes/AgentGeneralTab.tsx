import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Save, Info, Bot, Zap, Eye, EyeOff, Plus, Trash2, User, Shield, ShoppingBag, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import type { Agent, AgentSkill } from '@/hooks/useUazapiAgents';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', color: 'bg-emerald-500', models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3', 'o3-mini'] },
  { value: 'anthropic', label: 'Anthropic', color: 'bg-orange-500', models: ['claude-4-sonnet', 'claude-4-opus', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'] },
  { value: 'gemini', label: 'Google Gemini', color: 'bg-blue-500', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'] },
  { value: 'deepseek', label: 'DeepSeek', color: 'bg-purple-500', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { value: 'elevenlabs', label: 'ElevenLabs', color: 'bg-cyan-500', models: ['eleven_multilingual_v2', 'eleven_turbo_v2_5'] },
  { value: 'twilio', label: 'Twilio', color: 'bg-red-500', models: ['voice', 'sms'] },
];

const SKILL_TEMPLATES: AgentSkill[] = [
  { title: 'Abertura e Conexão', content: 'Inicia a conversa de forma simpática e personalizada, criando conexão antes de qualquer pergunta estratégica.' },
  { title: 'Qualificação', content: 'Busca entender o momento, estrutura e objetivo do lead com perguntas simples e diretas, uma por vez.' },
  { title: 'Quebra de Objeções', content: 'Responde objeções comuns com empatia e argumentos reais, sem ser agressivo.' },
  { title: 'Reforço de Benefício', content: 'Destaca diferenciais e resultados reais de forma natural, sem promessas exageradas.' },
  { title: 'CTA Inteligente', content: 'Adapta o call-to-action conforme a temperatura do lead: quente (link direto), morno (case/prova social), frio (desafio leve).' },
  { title: 'Situações Especiais', content: 'Sabe lidar com perguntas sobre IA, pedidos de desconto, solicitações "done-for-you" e dúvidas sobre pós-venda.' },
  { title: 'Controle de Linguagem', content: 'Frases curtas (3-15 palavras), tom WhatsApp, sem emoji, sempre termina com pergunta, nunca parece robô.' },
  { title: 'Follow-up Contextual', content: 'Retoma conversas abandonadas com contexto da última interação, sem repetir mensagens.' },
];

interface Props {
  agent: Agent;
  onChange: (agent: Agent) => void;
  onSave: () => void;
  saving: boolean;
  globalApiKey?: string;
}

function TipLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm">{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
        <TooltipContent side="right" className="max-w-[250px] text-xs">{tip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function SliderField({ label, tip, value, onChange, min = 0, max = 100 }: { label: string; tip: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <TipLabel label={label} tip={tip} />
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={1} />
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value?.length || 0;
  return <span className={`text-[10px] ${len > max ? 'text-destructive' : 'text-muted-foreground'}`}>{len}/{max}</span>;
}

export function AgentGeneralTab({ agent, onChange, onSave, saving, globalApiKey }: Props) {
  const [showKey, setShowKey] = useState(false);
  const provider = PROVIDERS.find(p => p.value === agent.provider) || PROVIDERS[0];
  const update = (patch: Partial<Agent>) => {
    const newAgent = { ...agent, ...patch };
    // Auto-fill API key when switching to OpenAI and key is empty
    if (patch.provider === 'openai' && !agent.apikey && globalApiKey) {
      newAgent.apikey = globalApiKey;
    }
    // Also auto-fill if switching to OpenAI and current key doesn't look like an OpenAI key
    if (patch.provider === 'openai' && globalApiKey && !newAgent.apikey?.startsWith('sk-')) {
      newAgent.apikey = globalApiKey;
    }
    onChange(newAgent);
  };

  const updateSkill = (idx: number, patch: Partial<AgentSkill>) => {
    const skills = [...(agent.skills || [])];
    skills[idx] = { ...skills[idx], ...patch };
    update({ skills });
  };

  const removeSkill = (idx: number) => {
    const skills = [...(agent.skills || [])];
    skills.splice(idx, 1);
    update({ skills });
  };

  const moveSkill = (idx: number, dir: -1 | 1) => {
    const skills = [...(agent.skills || [])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= skills.length) return;
    [skills[idx], skills[newIdx]] = [skills[newIdx], skills[idx]];
    update({ skills });
  };

  const addSkillTemplate = (tpl: AgentSkill) => {
    update({ skills: [...(agent.skills || []), { ...tpl }] });
  };

  return (
    <div className="space-y-6">
      {/* 1. Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Bot className="w-4 h-4" /> Identidade do Agente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center">
              <TipLabel label="Nome do Agente" tip="Como o agente será identificado no sistema e nas conversas." />
              <CharCount value={agent.name} max={50} />
            </div>
            <Input className="mt-1.5" value={agent.name} onChange={e => update({ name: e.target.value })} placeholder="Ex: SDR Comercial" maxLength={50} />
          </div>
          <div>
            <div className="flex justify-between items-center">
              <TipLabel label="Descrição" tip="Resumo do propósito deste agente. Visível apenas internamente." />
              <CharCount value={agent.description || ''} max={1000} />
            </div>
            <Textarea className="mt-1.5 text-sm" value={agent.description || ''} onChange={e => update({ description: e.target.value })} placeholder="Ex: Agente SDR para qualificação de leads vindos do Instagram..." rows={3} maxLength={1000} />
          </div>
        </CardContent>
      </Card>

      {/* 2. Persona & Role */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Persona e Papel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <TipLabel label="Persona" tip="Defina o tom de voz, comportamento, como o agente se apresenta. Use variáveis como {{User_Name}}, {{instagram_mensagem}}." />
            <CharCount value={agent.persona || ''} max={2000} />
          </div>
          <Textarea
            value={agent.persona || ''}
            onChange={e => update({ persona: e.target.value })}
            placeholder={`Ex: Você é o Caduh, mentor da Imersão. Tom WhatsApp, simpático, direto. Nunca parece robô.\nSe perguntarem se é IA: "Sou um assistente de IA aqui do Carlos! Tô aqui pra te ajudar de forma rápida e prática, blz?"`}
            rows={6}
            className="text-sm"
            maxLength={2000}
          />
        </CardContent>
      </Card>

      {/* 3. Skills */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" /> Habilidades</CardTitle>
            <Button size="sm" variant="outline" onClick={() => update({ skills: [...(agent.skills || []), { title: '', content: '' }] })}>
              <Plus className="w-3 h-3 mr-1" /> Habilidade
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Skill templates */}
          <div>
            <Label className="text-xs text-muted-foreground">Templates rápidos:</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {SKILL_TEMPLATES.map(tpl => (
                <button
                  key={tpl.title}
                  onClick={() => addSkillTemplate(tpl)}
                  className="text-[10px] px-2 py-1 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  + {tpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Skills list */}
          {(agent.skills || []).map((skill, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0">#{idx + 1}</Badge>
                <Input
                  className="h-8 text-sm font-medium flex-1"
                  value={skill.title}
                  onChange={e => updateSkill(idx, { title: e.target.value })}
                  placeholder="Ex: Abertura e Conexão"
                />
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSkill(idx, -1)} disabled={idx === 0}>
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSkill(idx, 1)} disabled={idx === (agent.skills || []).length - 1}>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSkill(idx)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <Textarea
                className="text-sm"
                value={skill.content}
                onChange={e => updateSkill(idx, { content: e.target.value })}
                placeholder="Descreva o comportamento detalhado desta habilidade..."
                rows={4}
              />
            </div>
          ))}
          {(agent.skills || []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma habilidade adicionada. Use os templates acima ou crie uma personalizada.</p>
          )}
        </CardContent>
      </Card>

      {/* 4. Product Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Informações sobre Produtos/Serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-1.5">
            <TipLabel label="Dados do Produto/Serviço" tip="Tudo que o agente precisa saber: nome, formato, público ideal, dores, benefícios, preço, forma de entrega." />
            <CharCount value={agent.productInfo || ''} max={20000} />
          </div>
          <Textarea
            value={agent.productInfo || ''}
            onChange={e => update({ productInfo: e.target.value })}
            placeholder={`Ex:\nProduto: Imersão Do VHS ao Prompt\nPreço: R$ 97,00\nFormato: Imersão online + consultoria pós\nPúblico: Pessoas que querem renda extra com IA\nBenefícios: Faturar R$10.000/mês, metodologia única, acompanhamento...`}
            rows={8}
            className="text-sm"
            maxLength={20000}
          />
        </CardContent>
      </Card>

      {/* 5. Restrictions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Restrições</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-1.5">
            <TipLabel label="Regras e Limites" tip="O que o agente NÃO pode fazer. Regras de linguagem, comportamento proibido, limites." />
            <CharCount value={agent.restrictions || ''} max={2000} />
          </div>
          <Textarea
            value={agent.restrictions || ''}
            onChange={e => update({ restrictions: e.target.value })}
            placeholder={`Ex:\n- Frases curtas (3 a 15 palavras)\n- Nunca usar emoji\n- Nunca encerrar sem uma pergunta\n- Nunca usar linguagem formal ou jargão\n- Nada de parecer robô ou IA\n- Sempre humanizada, direta e leve`}
            rows={5}
            className="text-sm"
            maxLength={2000}
          />
        </CardContent>
      </Card>

      {/* 6. Provider + Model + API Key */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Bot className="w-4 h-4" /> Provedor e Modelo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <TipLabel label="Provedor de IA" tip="Serviço de inteligência artificial que processará as conversas." />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
              {PROVIDERS.map(p => (
                <button
                  key={p.value}
                  onClick={() => update({ provider: p.value, model: p.models[0] })}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all ${agent.provider === p.value ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <TipLabel label="Modelo" tip="Modelo de IA específico." />
            <Select value={agent.model} onValueChange={v => update({ model: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {provider.models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <TipLabel label="API Key" tip="Chave de API do provedor escolhido." />
              {agent.provider === 'openai' && agent.apikey && agent.apikey === globalApiKey && (
                <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">✓ Auto-preenchida</Badge>
              )}
            </div>
            <div className="flex gap-2 mt-1.5">
              <Input type={showKey ? 'text' : 'password'} value={agent.apikey || ''} onChange={e => update({ apikey: e.target.value })} placeholder="sk-..." className="flex-1" />
              <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              {agent.provider === 'openai' && globalApiKey && agent.apikey !== globalApiKey && (
                <Button variant="outline" size="sm" className="text-xs whitespace-nowrap" onClick={() => update({ apikey: globalApiKey })}>
                  Usar global
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. Generation Parameters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> Parâmetros de Geração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <SliderField label="Temperatura" tip="Controla criatividade. 0-30 = conservador, 70-100 = criativo." value={agent.temperature} onChange={v => update({ temperature: v })} />
          <SliderField label="Max Tokens" tip="Limite máximo de tokens por resposta." value={agent.maxTokens} onChange={v => update({ maxTokens: v })} min={100} max={8000} />
          <SliderField label="Diversidade" tip="Valores altos geram respostas mais variadas." value={agent.diversityLevel} onChange={v => update({ diversityLevel: v })} />
          <SliderField label="Penalidade Frequência" tip="Penaliza repetição de palavras." value={agent.frequencyPenalty} onChange={v => update({ frequencyPenalty: v })} />
          <SliderField label="Penalidade Presença" tip="Incentiva mudanças de tópico." value={agent.presencePenalty} onChange={v => update({ presencePenalty: v })} />
        </CardContent>
      </Card>

      {/* 8. Interaction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Interação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <TipLabel label="Assinar Mensagens" tip="Adiciona assinatura do agente nas mensagens enviadas." />
            <Switch checked={agent.signMessages} onCheckedChange={v => update({ signMessages: v })} />
          </div>
          <div className="flex items-center justify-between">
            <TipLabel label="Marcar como Lido" tip="Marca mensagens como lidas ao responder." />
            <Switch checked={agent.readMessages} onCheckedChange={v => update({ readMessages: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <TipLabel label="Tam. Máx. Mensagem" tip="Limite de caracteres por mensagem enviada." />
              <Input type="number" className="mt-1.5" value={agent.maxMessageLength} onChange={e => update({ maxMessageLength: Number(e.target.value) })} />
            </div>
            <div>
              <TipLabel label="Delay de Digitação (s)" tip="Pausa antes de enviar para simular digitação humana." />
              <Input type="number" className="mt-1.5" value={agent.typingDelay_seconds} onChange={e => update({ typingDelay_seconds: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <TipLabel label="Janela de Contexto (h)" tip="Horas de histórico que o agente considera." />
              <Input type="number" className="mt-1.5" value={agent.contextTimeWindow_hours} onChange={e => update({ contextTimeWindow_hours: Number(e.target.value) })} />
            </div>
            <div>
              <TipLabel label="Máx. Mensagens Ctx" tip="Máximo de mensagens do histórico para contexto." />
              <Input type="number" className="mt-1.5" value={agent.contextMaxMessages} onChange={e => update({ contextMaxMessages: Number(e.target.value) })} />
            </div>
            <div>
              <TipLabel label="Mín. Mensagens Ctx" tip="Mínimo de mensagens para o agente começar a responder." />
              <Input type="number" className="mt-1.5" value={agent.contextMinMessages} onChange={e => update({ contextMinMessages: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instagram Follow-up */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" /> Follow-up Instagram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <TipLabel label="Follow-up automatico com Instagram Scraping" tip="Quando o lead para de responder, o agente busca informacoes do Instagram (stories, posts) e envia uma mensagem personalizada para reengajar." />
            <Switch
              checked={agent.igFollowupEnabled || false}
              onCheckedChange={v => update({ igFollowupEnabled: v } as any)}
            />
          </div>
          {(agent as any).igFollowupEnabled && (
            <div className="space-y-4 pl-1 border-l-2 border-primary/30 ml-2">
              <div>
                <TipLabel label="Tempo de inatividade (min)" tip="Apos quantos minutos sem resposta o follow-up sera disparado." />
                <Input
                  type="number"
                  className="mt-1.5 max-w-[200px]"
                  value={(agent as any).igFollowupDelayMin || 60}
                  onChange={e => update({ igFollowupDelayMin: Number(e.target.value) } as any)}
                  min={15}
                  max={1440}
                />
              </div>
              <div>
                <TipLabel label="Produto/Contexto do follow-up" tip="O que o agente deve conectar na mensagem apos o gancho do Instagram." />
                <Textarea
                  className="mt-1.5 text-sm"
                  value={(agent as any).igFollowupContext || 'Metodo + que Vencedores - Mentoria onde o empresario aprende a construir suas proprias solucoes com IA.'}
                  onChange={e => update({ igFollowupContext: e.target.value } as any)}
                  rows={2}
                  placeholder="Ex: Metodo + que Vencedores - Mentoria de IA para negocios"
                />
              </div>
              <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
                <p className="font-medium mb-1">Como funciona:</p>
                <ul className="space-y-1 list-disc ml-4">
                  <li>Lead para de responder por {(agent as any).igFollowupDelayMin || 60} min</li>
                  <li>Scrape do Instagram do lead (stories, posts, bio)</li>
                  <li>IA gera mensagem personalizada com gancho do Instagram</li>
                  <li>Envia via WhatsApp automaticamente</li>
                  <li>Tag <code className="bg-background px-1 rounded">instagram_followup_sent</code> adicionada (nao repete)</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={saving} className="w-full gap-2">
        <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Agente'}
      </Button>
    </div>
  );
}
