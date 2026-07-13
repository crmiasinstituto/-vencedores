import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Lightbulb, FileText, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Agent } from '@/hooks/useUazapiAgents';
import { composePrompt } from '@/utils/composeAgentPrompt';

const TEMPLATES = [
  {
    name: 'SDR Qualificação',
    prompt: `Você é um SDR (Sales Development Representative) especializado em qualificação de leads. Seu objetivo é:
1. Cumprimentar o lead de forma profissional e amigável
2. Entender as necessidades e dores do lead
3. Qualificar usando framework BANT (Budget, Authority, Need, Timeline)
4. Agendar uma reunião/call com o closer quando qualificado
5. Manter o tom consultivo, nunca agressivo

Regras:
- Faça perguntas abertas para entender o cenário
- Não envie mensagens muito longas (máx 3 parágrafos)
- Se o lead não responder, use o fluxo de cadência
- Identifique sinais de lead frio/curioso e marque adequadamente
- Sempre confirme dados antes de agendar`,
  },
  {
    name: 'Social Seller (Facebook/Instagram)',
    prompt: `Você é um Social Seller especializado em engajamento e conversão via Facebook e Instagram. Seu objetivo é:
1. Responder comentários e DMs de forma rápida e personalizada
2. Identificar interesse genuíno vs curiosidade casual
3. Conduzir a conversa da rede social para o WhatsApp ou agendamento
4. Usar linguagem adequada à plataforma (mais leve e visual)
5. Criar rapport antes de fazer qualquer oferta

Regras:
- Responda em até 2 minutos quando possível
- Use emojis com moderação (1-2 por mensagem)
- Nunca envie links de venda direto no primeiro contato
- Personalize com base no perfil do lead`,
  },
  {
    name: 'Suporte Técnico',
    prompt: `Você é um agente de suporte técnico. Seu objetivo é:
1. Identificar o problema do cliente rapidamente
2. Consultar a base de conhecimento para soluções
3. Fornecer instruções claras e passo a passo
4. Escalar para humano quando necessário

Regras:
- Seja empático e paciente
- Use linguagem simples e objetiva
- Confirme se o problema foi resolvido
- Registre o tipo de problema para análise`,
  },
  {
    name: 'Customer Success',
    prompt: `Você é um agente de Customer Success. Seu objetivo é:
1. Acompanhar a satisfação do cliente
2. Identificar oportunidades de upsell
3. Prevenir churn detectando sinais de insatisfação
4. Coletar feedback e NPS

Regras:
- Mantenha contato proativo
- Celebre conquistas do cliente
- Ofereça recursos e treinamentos relevantes
- Encaminhe problemas técnicos para suporte`,
  },
  {
    name: 'Atendimento Geral',
    prompt: `Você é um assistente virtual de atendimento. Seu objetivo é:
1. Responder dúvidas frequentes
2. Direcionar para o setor correto
3. Coletar informações iniciais do contato
4. Manter o lead engajado até o atendimento humano

Regras:
- Seja cordial e objetivo
- Não invente informações
- Quando não souber, diga que vai verificar
- Colete nome e necessidade principal`,
  },
];

interface Props {
  agent: Agent;
  onChange: (agent: Agent) => void;
  onSave: () => void;
  saving: boolean;
}

export function AgentPromptTab({ agent, onChange, onSave, saving }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [composedOpen, setComposedOpen] = useState(false);
  const [composedPrompt, setComposedPrompt] = useState('');

  const openPreview = (t: typeof TEMPLATES[number]) => {
    setPreviewName(t.name);
    setPreviewPrompt(t.prompt);
    setPreviewOpen(true);
  };

  const applyPreview = () => {
    onChange({ ...agent, basePrompt: previewPrompt });
    setPreviewOpen(false);
  };

  const openComposed = () => {
    setComposedPrompt(composePrompt(agent));
    setComposedOpen(true);
  };

  const applyComposed = () => {
    onChange({ ...agent, basePrompt: composedPrompt });
    setComposedOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Generate composed prompt */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Wand2 className="w-4 h-4" /> Gerar Prompt Composto</p>
              <p className="text-xs text-muted-foreground mt-0.5">Combina Persona, Habilidades, Produtos e Restrições da aba Geral em um prompt final.</p>
            </div>
            <Button size="sm" onClick={openComposed} variant="outline">
              <Wand2 className="w-3 h-3 mr-1" /> Gerar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Composed prompt preview dialog */}
      <Dialog open={composedOpen} onOpenChange={setComposedOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Prompt Composto do Agente</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Revise e edite antes de aplicar. Este prompt substitui o Prompt Base atual.</p>
          <Textarea
            value={composedPrompt}
            onChange={e => setComposedPrompt(e.target.value)}
            rows={20}
            className="font-mono text-sm flex-1 min-h-[300px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setComposedOpen(false)}>Cancelar</Button>
            <Button onClick={applyComposed}>Aplicar como Prompt Base</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => openPreview(t)}
                className="text-left p-3 rounded-lg border border-border hover:border-primary/40 transition-all"
              >
                <span className="text-sm font-medium">{t.name}</span>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{t.prompt.slice(0, 100)}...</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Template: {previewName}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={previewPrompt}
            onChange={e => setPreviewPrompt(e.target.value)}
            rows={16}
            className="font-mono text-sm flex-1 min-h-[300px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
            <Button onClick={applyPreview}>Aplicar no Prompt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Prompt Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={agent.basePrompt}
            onChange={e => onChange({ ...agent, basePrompt: e.target.value })}
            rows={16}
            placeholder="Escreva as instruções de comportamento do agente..."
            className="font-mono text-sm"
          />
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Dicas para um bom prompt:</strong></p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Use "Gerar Prompt Composto" para combinar todas as configurações da aba Geral</li>
                <li>Defina claramente o papel e objetivo do agente</li>
                <li>Liste regras e limites de comportamento</li>
                <li>Inclua exemplos de respostas ideais</li>
                <li>Especifique quando escalar para humano</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={saving} className="w-full gap-2">
        <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Prompt'}
      </Button>
    </div>
  );
}
