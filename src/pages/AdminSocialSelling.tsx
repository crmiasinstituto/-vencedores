import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Save, Clock, MessageCircle, Sparkles, Calendar, AlertTriangle, Camera, Pencil, Plus,
} from 'lucide-react';
import {
  useSocialSellingConfig,
  type SocialSellingLimits,
  type SocialSellingTone,
  type PromptKey,
  type Automation,
  type BoardOption,
} from '@/hooks/useSocialSellingConfig';
import { SocialSellingAutomationEditor } from '@/components/admin/SocialSellingAutomationEditor';

const DEFAULT_LIMITS: SocialSellingLimits = {
  score_min: 60,
  chunk_size: 10,
  total_actions_per_day: 80,
  dms_per_day: 15,
  comments_per_day: 20,
  likes_per_day: 60,
  working_hours_start: '09:00',
  working_hours_end: '20:00',
  pause_weekends: true,
  delay_min_seconds: 45,
  delay_max_seconds: 180,
  min_minutes_between_actions_same_lead: 30,
  random_skip_pct: 10,
};

const PROMPT_META: { key: PromptKey; title: string; description: string }[] = [
  { key: 'qualificacao', title: 'Qualificação ICP', description: 'Critério que o Claude usa para aprovar/rejeitar seguidores capturados.' },
  { key: 'comentar_post', title: 'Comentar post', description: 'Como gerar comentário público em post do lead.' },
  { key: 'responder_story', title: 'Responder story', description: 'DM em resposta a story. Usa Vision (precisa imagem; sem imagem = skip).' },
  { key: 'enviar_dm', title: 'Enviar DM', description: 'DM fria ou follow-up. Recebe contexto de WhatsApp/calls/reuniões.' },
  { key: 'followup_story', title: 'Follow-up após story', description: 'DM depois de já ter reagido/respondido um story.' },
];

interface CardProps {
  limits: SocialSellingLimits | null;
  tone: SocialSellingTone | null;
  prompts: Record<PromptKey, string>;
  automations: Automation[];
  boards: BoardOption[];
  saving: boolean;
  loading: boolean;
  saveLimits: (v: SocialSellingLimits) => Promise<void>;
  saveTone: (v: SocialSellingTone) => Promise<void>;
  savePrompt: (k: PromptKey, v: string) => Promise<void>;
  toggleAutomation: (id: string, v: boolean) => Promise<void>;
  updateAutomation: (id: string, patch: Partial<Automation>) => Promise<void>;
  createAutomation: (a: Partial<Automation>) => Promise<string | undefined>;
}

function LimitsCard({ limits, saveLimits, saving, loading }: CardProps) {
  const [form, setForm] = useState<SocialSellingLimits>(DEFAULT_LIMITS);

  useEffect(() => {
    if (limits) setForm({ ...DEFAULT_LIMITS, ...limits });
  }, [limits]);

  const num = (key: keyof SocialSellingLimits) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: Number(e.target.value) });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" /> Limites e horários
        </CardTitle>
        <CardDescription>
          Janela operacional + tetos diários por tipo de ação. Comece conservador; aumente após 1 semana sem bloqueio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Início janela (BR)</Label>
                <Input type="time" value={form.working_hours_start} onChange={(e) => setForm({ ...form, working_hours_start: e.target.value })} />
              </div>
              <div>
                <Label>Fim janela (BR)</Label>
                <Input type="time" value={form.working_hours_end} onChange={(e) => setForm({ ...form, working_hours_end: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="font-medium">Pausar nos fins de semana</Label>
                <p className="text-xs text-muted-foreground">Sab/Dom não executa ações automaticamente.</p>
              </div>
              <Switch checked={form.pause_weekends} onCheckedChange={(v) => setForm({ ...form, pause_weekends: v })} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Total ações/dia</Label>
                <Input type="number" min={1} value={form.total_actions_per_day} onChange={num('total_actions_per_day')} />
              </div>
              <div>
                <Label>DMs/dia</Label>
                <Input type="number" min={0} value={form.dms_per_day} onChange={num('dms_per_day')} />
              </div>
              <div>
                <Label>Comentários/dia</Label>
                <Input type="number" min={0} value={form.comments_per_day} onChange={num('comments_per_day')} />
              </div>
              <div>
                <Label>Curtidas/dia</Label>
                <Input type="number" min={0} value={form.likes_per_day} onChange={num('likes_per_day')} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Delay min (s)</Label>
                <Input type="number" min={30} value={form.delay_min_seconds} onChange={num('delay_min_seconds')} />
              </div>
              <div>
                <Label>Delay max (s)</Label>
                <Input type="number" min={30} value={form.delay_max_seconds} onChange={num('delay_max_seconds')} />
              </div>
              <div>
                <Label>Min entre ações mesmo lead (min)</Label>
                <Input type="number" min={0} value={form.min_minutes_between_actions_same_lead} onChange={num('min_minutes_between_actions_same_lead')} />
              </div>
              <div>
                <Label>% skip aleatório (humanização)</Label>
                <Input type="number" min={0} max={100} value={form.random_skip_pct} onChange={num('random_skip_pct')} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Score mínimo qualificação (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.score_min} onChange={num('score_min')} />
              </div>
              <div>
                <Label>Chunk size captura</Label>
                <Input type="number" min={1} value={form.chunk_size} onChange={num('chunk_size')} />
              </div>
            </div>

            {form.delay_min_seconds < 30 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                <span>Delay menor que 30s será forçado pra 30s pela extensão. O Chrome MV3 ignora alarmes abaixo disso.</span>
              </div>
            )}

            <Button onClick={() => saveLimits(form)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar limites
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ToneCard({ tone, saveTone, saving, loading }: CardProps) {
  const [form, setForm] = useState<SocialSellingTone>({ description: '', sample_messages: '', forbidden_words: '' });

  useEffect(() => {
    if (tone) setForm({ description: tone.description || '', sample_messages: tone.sample_messages || '', forbidden_words: tone.forbidden_words || '' });
  }, [tone]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" /> Tom de voz
        </CardTitle>
        <CardDescription>
          Estilo do Claude ao gerar mensagens. Quanto mais específico, menor o tom de vendedor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <div>
              <Label>Descrição do tom</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Exemplos de mensagens reais suas (1 por linha)</Label>
              <Textarea rows={6} value={form.sample_messages} onChange={(e) => setForm({ ...form, sample_messages: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Cola 3-5 DMs ou comentários que você costuma mandar. O Claude vai aprender o jeitão.</p>
            </div>
            <div>
              <Label>Palavras proibidas (separadas por vírgula)</Label>
              <Textarea rows={2} value={form.forbidden_words} onChange={(e) => setForm({ ...form, forbidden_words: e.target.value })} />
            </div>
            <Button onClick={() => saveTone(form)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar tom
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PromptsCard({ prompts, savePrompt, saving, loading }: CardProps) {
  const [local, setLocal] = useState<Record<PromptKey, string>>(prompts);

  useEffect(() => { setLocal(prompts); }, [prompts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Prompts da IA
        </CardTitle>
        <CardDescription>
          Instruções que o Claude recebe por tipo de ação. O tom de voz é prefixado automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          PROMPT_META.map((p) => (
            <div key={p.key} className="space-y-2 rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold">{p.title}</h4>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{p.key}</Badge>
              </div>
              <Textarea rows={5} value={local[p.key] || ''} onChange={(e) => setLocal({ ...local, [p.key]: e.target.value })} />
              <Button size="sm" variant="secondary" onClick={() => savePrompt(p.key, local[p.key] || '')} disabled={saving || local[p.key] === prompts[p.key]}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                Salvar este prompt
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AutomationsCard({ automations, boards, toggleAutomation, updateAutomation, createAutomation, saving, loading }: CardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);

  const boardById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of boards) map.set(b.id, b.name);
    return map;
  }, [boards]);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (a: Automation) => { setEditing(a); setEditorOpen(true); };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Cadências
            </CardTitle>
            <CardDescription>
              Sequência de ações por dia após captura. "Dia N" = D+(N-1) dias após inscrição do lead.
            </CardDescription>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova cadência
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : automations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cadência cadastrada. Clique em "Nova cadência" pra começar.</p>
          ) : (
            automations.map((a) => {
              const days = a.cadence_config?.days || [];
              const boardId = (a.trigger_config?.target_board_id || a.trigger_config?.target_pipeline_id) as string | undefined;
              return (
                <div key={a.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{a.emoji || '🔄'}</span>
                        <h4 className="text-sm font-semibold">{a.name}</h4>
                        <Badge variant={a.is_active ? 'default' : 'outline'} className="text-[10px]">
                          {a.is_active ? 'Ativa' : 'Pausada'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{a.trigger_type}</Badge>
                      </div>
                      {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                      {boardId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Destino: <span className="font-medium">{boardById.get(boardId) || boardId}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Switch checked={a.is_active} onCheckedChange={(v) => toggleAutomation(a.id, v)} disabled={saving} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {days.map((d) => (
                      <Badge key={d.day} variant="secondary" className="font-normal">
                        Dia {d.day}: {(d.actions || []).map((act) => `${act.type}${act.count && act.count > 1 ? `×${act.count}` : ''}`).join(', ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <SocialSellingAutomationEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        automation={editing}
        boards={boards}
        onSave={updateAutomation}
        onCreate={createAutomation}
        saving={saving}
      />
    </>
  );
}

export default function AdminSocialSelling() {
  const ctx = useSocialSellingConfig();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 p-3">
          <Camera className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Social Selling Instagram</h1>
          <p className="text-sm text-muted-foreground">
            Prospecção automatizada no Instagram via extensão Chrome + Claude Haiku Vision. Roda no IP do aluno (cookies próprios) para não bater na API oficial.
          </p>
        </div>
      </div>

      {ctx.error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
          <span>{ctx.error}</span>
        </div>
      )}

      <Tabs defaultValue="limites" className="space-y-4">
        <TabsList>
          <TabsTrigger value="limites"><Clock className="w-4 h-4 mr-2" /> Limites</TabsTrigger>
          <TabsTrigger value="tom"><MessageCircle className="w-4 h-4 mr-2" /> Tom</TabsTrigger>
          <TabsTrigger value="prompts"><Sparkles className="w-4 h-4 mr-2" /> Prompts</TabsTrigger>
          <TabsTrigger value="cadencias"><Calendar className="w-4 h-4 mr-2" /> Cadências</TabsTrigger>
        </TabsList>

        <TabsContent value="limites"><LimitsCard {...ctx} /></TabsContent>
        <TabsContent value="tom"><ToneCard {...ctx} /></TabsContent>
        <TabsContent value="prompts"><PromptsCard {...ctx} /></TabsContent>
        <TabsContent value="cadencias"><AutomationsCard {...ctx} /></TabsContent>
      </Tabs>
    </div>
  );
}
