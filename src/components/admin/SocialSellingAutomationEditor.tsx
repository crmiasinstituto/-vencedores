import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, X } from 'lucide-react';
import type { Automation, BoardOption } from '@/hooks/useSocialSellingConfig';

const ACTION_LABELS: Record<string, string> = {
  reagir_story: '❤️ Reagir story',
  responder_story: '💬 Responder story (Vision)',
  curtir_posts: '👍 Curtir posts',
  comentar_post: '🗣️ Comentar post',
  enviar_dm: '📩 Enviar DM',
  verificar_resposta: '👀 Verificar inbox',
  followup_story: '🔄 Follow-up via story',
};

const ACTION_TYPES = Object.keys(ACTION_LABELS);

const TRIGGER_LABELS: Record<string, string> = {
  new_follower: '🆕 Novo seguidor capturado no Instagram',
  stage_change: '🔄 Lead entra em etapa (board já existente)',
  manual: '✋ Manual (disparada pelo aluno)',
};

type CadenceAction = { type: string; count?: number };
type CadenceDay = { day: number; label?: string; actions: CadenceAction[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation: Automation | null;
  boards: BoardOption[];
  onSave: (id: string, patch: Partial<Automation>) => Promise<void>;
  onCreate: (a: Partial<Automation>) => Promise<string | undefined>;
  saving: boolean;
}

const SAFE_AUTO_ACTIONS = new Set(['curtir_posts', 'reagir_story', 'verificar_resposta']);

function TabIntro({ title, description, example }: { title: string; description: string; example?: string }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3.5 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <span className="text-primary">ℹ</span>
        <span>{title}</span>
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      {example && (
        <p className="text-[11px] text-muted-foreground/85 italic border-l-2 border-primary/30 pl-2 mt-1">
          💡 {example}
        </p>
      )}
    </div>
  );
}

function StageDropdown({
  label, placeholder, value, stages, onChange,
}: {
  label: string;
  placeholder: string;
  value: string | null | undefined;
  stages: BoardOption['stages'];
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? null : v)}>
        <SelectTrigger className="mt-1"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— {placeholder.toLowerCase()} —</SelectItem>
          {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

interface LocalAutomation extends Partial<Automation> {
  name: string;
  emoji: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  qualification_config: Record<string, any>;
  cadence_config: { days: CadenceDay[]; action_modes?: Record<string, string> };
  on_reply_config: Record<string, any>;
}

const EMPTY: LocalAutomation = {
  name: '',
  emoji: '🔄',
  description: '',
  is_active: false,
  trigger_type: 'new_follower',
  trigger_config: {},
  qualification_config: {},
  cadence_config: { days: [{ day: 1, label: 'Aquecer', actions: [{ type: 'curtir_posts', count: 1 }] }] },
  on_reply_config: {},
};

export function SocialSellingAutomationEditor({ open, onOpenChange, automation, boards, onSave, onCreate, saving }: Props) {
  const isNew = !automation;
  const [local, setLocal] = useState<LocalAutomation>(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (automation) {
      setLocal({
        name: automation.name || '',
        emoji: automation.emoji || '🔄',
        description: automation.description || '',
        is_active: automation.is_active,
        trigger_type: automation.trigger_type || 'manual',
        trigger_config: (automation.trigger_config as any) || {},
        qualification_config: ((automation as any).qualification_config as any) || {},
        cadence_config: { days: automation.cadence_config?.days || [], action_modes: (automation.cadence_config as any)?.action_modes || {} },
        on_reply_config: ((automation as any).on_reply_config as any) || {},
      });
    } else {
      setLocal(EMPTY);
    }
  }, [open, automation]);

  const updateTrigger = (config: Record<string, any>) =>
    setLocal({ ...local, trigger_config: { ...local.trigger_config, ...config } });

  // Board destino (trigger=new_follower)
  const targetBoardId: string = local.trigger_config?.target_board_id || local.trigger_config?.target_pipeline_id || '';
  const targetStages = boards.find((b) => b.id === targetBoardId)?.stages || [];

  // Trigger stage_change: board explícito
  const triggerBoardId: string = local.trigger_config?.board_id || local.trigger_config?.pipeline_id || '';
  const triggerBoardStages = boards.find((b) => b.id === triggerBoardId)?.stages || [];

  const addDay = () => {
    const days = [...local.cadence_config.days];
    const last = days.length > 0 ? Math.max(...days.map((d) => d.day)) : 0;
    days.push({ day: last + 1, actions: [{ type: 'reagir_story' }] });
    setLocal({ ...local, cadence_config: { ...local.cadence_config, days } });
  };

  const removeDay = (idx: number) => {
    const days = local.cadence_config.days.filter((_, i) => i !== idx);
    setLocal({ ...local, cadence_config: { ...local.cadence_config, days } });
  };

  const updateDay = (idx: number, patch: Partial<CadenceDay>) => {
    const days = local.cadence_config.days.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    setLocal({ ...local, cadence_config: { ...local.cadence_config, days } });
  };

  const addAction = (dayIdx: number) => {
    const day = local.cadence_config.days[dayIdx];
    updateDay(dayIdx, { actions: [...day.actions, { type: 'reagir_story' }] });
  };

  const removeAction = (dayIdx: number, actionIdx: number) => {
    const day = local.cadence_config.days[dayIdx];
    updateDay(dayIdx, { actions: day.actions.filter((_, i) => i !== actionIdx) });
  };

  const updateAction = (dayIdx: number, actionIdx: number, patch: Partial<CadenceAction>) => {
    const day = local.cadence_config.days[dayIdx];
    updateDay(dayIdx, { actions: day.actions.map((a, i) => (i === actionIdx ? { ...a, ...patch } : a)) });
  };

  const sortedDays = useMemo(
    () => local.cadence_config.days.map((d, idx) => ({ d, idx })).sort((a, b) => a.d.day - b.d.day),
    [local.cadence_config.days]
  );

  const handleSave = async () => {
    if (!local.name.trim() || local.cadence_config.days.length === 0) return;
    const payload: Partial<Automation> = {
      name: local.name.trim(),
      emoji: (local.emoji || '🔄').trim().slice(0, 4),
      description: local.description?.trim() || null,
      is_active: local.is_active,
      trigger_type: local.trigger_type,
      trigger_config: local.trigger_config,
      qualification_config: local.qualification_config,
      cadence_config: local.cadence_config,
      on_reply_config: local.on_reply_config,
    } as any;
    if (isNew) await onCreate(payload);
    else if (automation) await onSave(automation.id, payload);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col gap-0 overflow-hidden">
        {/* HEADER STICKY */}
        <div className="px-6 py-4 border-b shrink-0 bg-background">
          <div className="flex items-center gap-3">
            <Input
              value={local.emoji}
              onChange={(e) => setLocal({ ...local, emoji: e.target.value })}
              className="w-14 h-12 text-2xl text-center shrink-0"
              maxLength={4}
            />
            <Input
              value={local.name}
              onChange={(e) => setLocal({ ...local, name: e.target.value })}
              placeholder="Nome da cadência (ex: Aquecer médicos)"
              className="flex-1 h-12 text-base font-medium"
            />
            <div className="flex items-center gap-2 pl-2 border-l">
              <Label className="text-xs cursor-pointer">{local.is_active ? 'Ativa' : 'Pausada'}</Label>
              <Switch checked={local.is_active} onCheckedChange={(v) => setLocal({ ...local, is_active: v })} />
            </div>
          </div>
        </div>

        {/* TABS */}
        <Tabs defaultValue="trigger" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 shrink-0 border-b bg-muted/30">
            <TabsList className="bg-transparent h-auto p-0 gap-2">
              <TabsTrigger value="trigger" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">⚡ Disparo & Destino</TabsTrigger>
              <TabsTrigger value="cadence" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">📅 Cadência</TabsTrigger>
              <TabsTrigger value="approval" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">✋ Aprovação</TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">💬 Pós-resposta</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ABA 1 — Disparo & Destino */}
            <TabsContent value="trigger" className="mt-0 space-y-6">
              <TabIntro
                title="Disparo & Destino"
                description="Define o ponto de partida da cadência. Aqui você decide: (1) quando o lead começa a receber as ações, pode ser quando um seguidor novo aparece no IG ou quando alguém entra numa etapa específica do seu board; (2) pra qual board/coluna o lead vai cair durante e depois da cadência."
              />

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">⚡ Quando dispara</Label>
                <Select
                  value={local.trigger_type}
                  onValueChange={(v) => setLocal({ ...local, trigger_type: v, trigger_config: {} })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {local.trigger_type === 'stage_change' && (
                  <div className="pl-3 border-l-2 border-primary/30 space-y-3">
                    <div>
                      <Label className="text-xs">Board</Label>
                      <Select
                        value={local.trigger_config?.board_id || '__none__'}
                        onValueChange={(v) => {
                          if (v === '__none__') return;
                          updateTrigger({ board_id: v, column_id: null, stage_id: null });
                        }}
                      >
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha o board" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" disabled>Selecione o board...</SelectItem>
                          {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {triggerBoardId && (
                      <div>
                        <Label className="text-xs">Coluna que dispara a cadência</Label>
                        <Select
                          value={local.trigger_config?.column_id || '__none__'}
                          onValueChange={(v) => {
                            if (v === '__none__') return;
                            const stage = triggerBoardStages.find((s) => s.id === v);
                            updateTrigger({ column_id: v, stage_name: stage?.name });
                          }}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Escolha a coluna" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Selecione a coluna...</SelectItem>
                            {triggerBoardStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {local.trigger_type === 'new_follower' && (
                  <div className="pl-3 border-l-2 border-primary/30">
                    <Label className="text-xs">Frequência da varredura</Label>
                    <Select
                      value={local.trigger_config?.scan_frequency || 'daily'}
                      onValueChange={(v) => updateTrigger({ scan_frequency: v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">A cada hora</SelectItem>
                        <SelectItem value="daily">1x ao dia</SelectItem>
                        <SelectItem value="weekly">1x por semana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator />

              {/* new_follower: board destino + mapeamento de colunas */}
              {local.trigger_type === 'new_follower' && (
                <>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      🧱 Board destino & mapeamento de colunas
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Os leads novos que a IA qualificar vão cair neste board. Mapeie as colunas que quiser.
                    </p>

                    <div className="space-y-2">
                      <Label className="text-xs">🎯 Board destino</Label>
                      <Select
                        value={targetBoardId || '__none__'}
                        onValueChange={(v) => {
                          if (v === '__none__') return;
                          updateTrigger({
                            target_board_id: v,
                            target_column_id: null,
                            stage_warming_id: null,
                            stage_dm_sent_id: null,
                            stage_replied_id: null,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o board" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" disabled>Selecione...</SelectItem>
                          {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {targetBoardId && (
                      <div className="space-y-3 pl-3 border-l-2 border-primary/30">
                        <StageDropdown
                          label="🆕 Coluna inicial (lead recém qualificado)"
                          placeholder="Primeira coluna do board"
                          value={local.trigger_config?.target_column_id}
                          stages={targetStages}
                          onChange={(v) => updateTrigger({ target_column_id: v })}
                        />
                        <StageDropdown
                          label="🔥 Quando engajar (curtir/comentar/reagir story)"
                          placeholder="Não move automaticamente"
                          value={local.trigger_config?.stage_warming_id}
                          stages={targetStages}
                          onChange={(v) => updateTrigger({ stage_warming_id: v })}
                        />
                        <StageDropdown
                          label="📩 Quando enviar DM"
                          placeholder="Não move automaticamente"
                          value={local.trigger_config?.stage_dm_sent_id}
                          stages={targetStages}
                          onChange={(v) => updateTrigger({ stage_dm_sent_id: v })}
                        />
                        <StageDropdown
                          label="✅ Quando lead responder"
                          placeholder="Não move automaticamente"
                          value={local.trigger_config?.stage_replied_id}
                          stages={targetStages}
                          onChange={(v) => updateTrigger({ stage_replied_id: v })}
                        />
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {/* stage_change: movimento dentro do mesmo board */}
              {local.trigger_type === 'stage_change' && (
                <>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      🔄 Movimento de colunas durante a cadência
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      O lead <strong>já está</strong> no board (escolha a coluna de trigger acima). Configure pra qual coluna do mesmo board ele move durante a cadência. Deixe vazio se não quiser mover automaticamente.
                    </p>

                    {!triggerBoardId ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 pl-3 border-l-2 border-amber-500/40">
                        ⚠ Escolha primeiro a coluna que dispara a cadência (em "⚡ Quando dispara" acima).
                      </p>
                    ) : (
                      <div className="space-y-3 pl-3 border-l-2 border-primary/30">
                        <StageDropdown
                          label="🔥 Quando engajar"
                          placeholder="Não move automaticamente"
                          value={local.trigger_config?.stage_warming_id}
                          stages={triggerBoardStages}
                          onChange={(v) => updateTrigger({ stage_warming_id: v })}
                        />
                        <StageDropdown
                          label="📩 Quando enviar DM"
                          placeholder="Não move automaticamente"
                          value={local.trigger_config?.stage_dm_sent_id}
                          stages={triggerBoardStages}
                          onChange={(v) => updateTrigger({ stage_dm_sent_id: v })}
                        />
                        <StageDropdown
                          label="✅ Quando lead responder"
                          placeholder="Não move automaticamente"
                          value={local.trigger_config?.stage_replied_id}
                          stages={triggerBoardStages}
                          onChange={(v) => updateTrigger({ stage_replied_id: v })}
                        />
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {/* ICP — apenas new_follower */}
              {local.trigger_type === 'new_follower' && (
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    🎯 ICP, quem deve virar lead (qualificação IA)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Descreva em texto quem é seu ICP. A IA vai ler bio + posts do seguidor e decidir se ele passa.
                  </p>
                  <Textarea
                    rows={5}
                    placeholder="Ex: Empresários reais, donos de empresa de serviço (faturamento 50k-1M/mês). Bio mostra cargo (CEO, fundador, dono). Posts mostram trabalho, escritório, viagens de negócio. NÃO quero influencers, modelos, atletas. Mín 500 seguidores."
                    value={local.qualification_config?.ai_prompt || ''}
                    onChange={(e) => setLocal({ ...local, qualification_config: { ...local.qualification_config, ai_prompt: e.target.value } })}
                  />
                  {local.qualification_config?.ai_prompt && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Score mínimo (0-100):</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="w-20 h-8"
                        value={local.qualification_config?.ai_score_min || 70}
                        onChange={(e) => setLocal({ ...local, qualification_config: { ...local.qualification_config, ai_score_min: parseInt(e.target.value) || 70 } })}
                      />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ABA 2 — Cadência */}
            <TabsContent value="cadence" className="mt-0 space-y-4">
              <TabIntro
                title="Cadência (dias × ações)"
                description="A sequência de ações que a IA executa pra cada lead. Cada dia tem uma ou mais ações: curtir um post, reagir a story, comentar, enviar DM. Funciona como esteira de aquecimento, do contato leve (curtir) pro contato direto (DM). Recomendação: 3-5 dias progressivos."
                example="Ex: Dia 1 → reagir story + curtir 2 posts | Dia 3 → comentar 1 post | Dia 5 → reagir story | Dia 7 → enviar DM"
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    📅 Cadência ({local.cadence_config.days?.length || 0} dias × ações)
                  </Label>
                  <Button size="sm" variant="outline" onClick={addDay}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar dia
                  </Button>
                </div>

                <div className="space-y-3">
                  {sortedDays.map(({ d, idx }) => (
                    <div key={idx} className="border rounded-lg p-3 bg-muted/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">DIA {d.day}</Badge>
                        <Input
                          placeholder="Label opcional (ex: 'Aquecimento')"
                          value={d.label || ''}
                          onChange={(e) => updateDay(idx, { label: e.target.value })}
                          className="flex-1 h-7 text-xs"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={d.day}
                          onChange={(e) => updateDay(idx, { day: Number(e.target.value) || 1 })}
                          className="w-16 h-7 text-xs text-center"
                          title="Número do dia"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeDay(idx)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        {d.actions.map((action, actionIdx) => (
                          <div key={actionIdx} className="flex items-center gap-1.5">
                            <Select value={action.type} onValueChange={(v) => updateAction(idx, actionIdx, { type: v })}>
                              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{ACTION_LABELS[t]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {action.type === 'curtir_posts' && (
                              <Input
                                type="number"
                                min={1}
                                max={5}
                                placeholder="N"
                                className="h-8 w-14 text-xs text-center"
                                value={action.count || 1}
                                onChange={(e) => updateAction(idx, actionIdx, { count: parseInt(e.target.value) || 1 })}
                              />
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => removeAction(idx, actionIdx)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" className="h-7 text-xs w-full" onClick={() => addAction(idx)}>
                          <Plus className="h-3 w-3 mr-1" /> Ação
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ABA 3 — Aprovação */}
            <TabsContent value="approval" className="mt-0 space-y-4">
              <TabIntro
                title="Aprovação de ações"
                description="Decida o que a IA executa sozinha vs o que entra em fila pra você revisar antes."
                example="Recomendação: ações sem texto (curtir, reagir story) podem ser AUTO. Ações com texto (comentário, DM) deixe APROVAR, você revê o que a IA escreveu antes de enviar."
              />

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">✋ Aprovação por tipo de ação</Label>
                <p className="text-xs text-muted-foreground">
                  <strong>Auto</strong> = executa direto. <strong>Aprovar</strong> = entra em fila pra você revisar o texto antes de enviar.
                </p>
                {[
                  { type: 'curtir_posts',     label: '👍 Curtir post',         hint: 'sem texto, baixo risco, recomenda auto' },
                  { type: 'reagir_story',     label: '❤️ Reagir story',         hint: 'sem texto, baixo risco, recomenda auto' },
                  { type: 'verificar_resposta', label: '👀 Verificar inbox',    hint: 'só leitura, sempre auto' },
                  { type: 'comentar_post',    label: '🗣️ Comentar post',       hint: 'texto público, recomenda aprovar' },
                  { type: 'responder_story',  label: '💬 Responder story (DM)', hint: 'DM privada, recomenda aprovar' },
                  { type: 'enviar_dm',        label: '📩 Enviar DM frio',       hint: 'primeiro contato, recomenda aprovar' },
                  { type: 'followup_story',   label: '🔄 Follow-up via story',  hint: 'DM em resposta a story' },
                ].map((row) => {
                  const current = local.cadence_config?.action_modes?.[row.type] || (SAFE_AUTO_ACTIONS.has(row.type) ? 'auto' : 'approve');
                  return (
                    <div key={row.type} className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/30 border">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{row.label}</p>
                        <p className="text-[10px] text-muted-foreground">{row.hint}</p>
                      </div>
                      <Select
                        value={current}
                        onValueChange={(v) => {
                          const modes = { ...(local.cadence_config?.action_modes || {}), [row.type]: v };
                          setLocal({ ...local, cadence_config: { ...local.cadence_config, action_modes: modes } });
                        }}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="approve">Aprovar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ABA 4 — Pós-resposta */}
            <TabsContent value="advanced" className="mt-0 space-y-4">
              <TabIntro
                title="Pós-resposta"
                description="O que acontece automaticamente quando o lead responder uma DM ou story. É o momento de virar a chave, passar do modo prospecção pra modo vendedor humano."
                example="Ex: mover o lead pra coluna 'Atender já' do board + disparar notificação WhatsApp pro vendedor entrar no chat antes do lead esfriar."
              />

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">💬 Configurações pós-resposta</Label>

                <div className="space-y-3">
                  <Label className="text-xs">Mover lead pra coluna quando responder</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Escolha board e coluna de destino. Recomendado: uma coluna quente tipo "Atender agora" pra alertar o vendedor.
                  </p>

                  <div>
                    <Label className="text-xs">Board</Label>
                    <Select
                      value={local.on_reply_config?.move_to_board_id || local.on_reply_config?.move_to_pipeline_id || '__none__'}
                      onValueChange={(v) => setLocal({ ...local, on_reply_config: { ...local.on_reply_config, move_to_board_id: v === '__none__' ? undefined : v, move_to_column_id: undefined, move_to_stage_id: undefined } })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Manter board atual" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Manter board atual</SelectItem>
                        {boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {(local.on_reply_config?.move_to_board_id || local.on_reply_config?.move_to_pipeline_id) && (
                    <div className="pl-3 border-l-2 border-primary/30">
                      <Label className="text-xs">Coluna</Label>
                      <Select
                        value={local.on_reply_config?.move_to_column_id || local.on_reply_config?.move_to_stage_id || '__none__'}
                        onValueChange={(v) => setLocal({ ...local, on_reply_config: { ...local.on_reply_config, move_to_column_id: v === '__none__' ? undefined : v } })}
                      >
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Manter coluna atual" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Manter coluna atual</SelectItem>
                          {(boards.find((b) => b.id === (local.on_reply_config?.move_to_board_id || local.on_reply_config?.move_to_pipeline_id))?.stages || []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm pt-2">
                  <input
                    type="checkbox"
                    id="notify-wpp"
                    checked={local.on_reply_config?.notify_whatsapp || false}
                    onChange={(e) => setLocal({ ...local, on_reply_config: { ...local.on_reply_config, notify_whatsapp: e.target.checked } })}
                    className="rounded"
                  />
                  <Label htmlFor="notify-wpp" className="cursor-pointer">Notificar vendedor por WhatsApp</Label>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* FOOTER STICKY */}
        <div className="px-6 py-3 border-t bg-background flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !local.name.trim() || local.cadence_config.days.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="mr-1">💾</span>}
            {isNew ? 'Criar cadência' : 'Salvar'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
