import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Megaphone, Sparkles, Loader2, CheckCircle2, XCircle, ExternalLink,
  Plus, Trash2, AlertCircle, Image as ImageIcon, ShieldAlert, Wand2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type AdsetForm = {
  nome: string;
  publico_descricao: string;
  targeting: string;
  budget_diario: number;
  optimization_goal:
    | 'LEAD_GENERATION'
    | 'OFFSITE_CONVERSIONS'
    | 'LANDING_PAGE_VIEWS'
    | 'POST_ENGAGEMENT'
    | 'REACH';
  age_min?: number;
  age_max?: number;
};

type CreativeForm = {
  output_id?: string;
  output_label?: string;
  image_preview?: string;
  primary_text: string;
  headline: string;
  description: string;
  cta_button: 'LEARN_MORE' | 'SIGN_UP' | 'SUBSCRIBE' | 'GET_OFFER' | 'WATCH_MORE' | 'CONTACT_US';
};

const emptyAdset: AdsetForm = {
  nome: '',
  publico_descricao: '',
  targeting: '',
  budget_diario: 50,
  optimization_goal: 'LEAD_GENERATION',
  age_min: 25,
  age_max: 55,
};

const emptyCreative: CreativeForm = {
  primary_text: '',
  headline: '',
  description: '',
  cta_button: 'LEARN_MORE',
};

type PublishResult = {
  success: boolean;
  meta_campaign_id?: string;
  meta_campaign_row_id?: string;
  ads_manager_url?: string;
  adset_ids?: { id: string; nome: string }[];
  creative_ids?: { id: string; index: number }[];
  ad_ids?: { id: string; adset_id: string; creative_id: string }[];
  step_logs?: Array<{
    step: string;
    success: boolean;
    error_message?: string;
  }>;
  error?: string;
  aviso?: string;
};

export default function MidiaNovaCampanha() {
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState<
    'OUTCOME_AWARENESS' | 'OUTCOME_TRAFFIC' | 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEADS' | 'OUTCOME_SALES'
  >('OUTCOME_LEADS');
  const [phase, setPhase] = useState<'captacao' | 'aquecimento' | 'conversao' | 'remarketing'>('captacao');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [ticket, setTicket] = useState<number | ''>('');
  const [cplMax, setCplMax] = useState<number | ''>('');
  const [adsets, setAdsets] = useState<AdsetForm[]>([{ ...emptyAdset }]);
  const [creatives, setCreatives] = useState<CreativeForm[]>([{ ...emptyCreative }]);
  const [availableOutputs, setAvailableOutputs] = useState<Array<{ id: string; titulo: string; image_base64?: string }>>([]);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [metaReady, setMetaReady] = useState<boolean | null>(null);

  // AI Estrategista (Claude Sonnet via marketing-midia action=estrategista)
  const [aiBrief, setAiBrief] = useState({
    produto: '', cidade: '', raio_km: '', publico: '', verba_dia: '', ticket: '', objetivo: '', contexto: '',
  });
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [aiPlan, setAiPlan] = useState<any>(null);

  // Verifica se Meta ja foi configurada
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_integration_keys_masked');
      const meta = (data ?? []).find((r: any) => r.service === 'meta_ads');
      const md = meta?.metadata ?? {};
      setMetaReady(!!(meta?.api_key_last4 && meta?.account_id && md.page_id && md.pixel_id && meta?.is_active !== false));
    })();
  }, []);

  // Carrega criativos disponiveis (marketing_ai_outputs do agente Criativo com imagem)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('marketing_ai_outputs')
        .select('id, titulo, resultado')
        .eq('agent', 'criativo')
        .order('created_at', { ascending: false })
        .limit(50);
      setAvailableOutputs(
        (data ?? [])
          .map((o: any) => ({
            id: o.id,
            titulo: o.titulo ?? 'Sem titulo',
            image_base64: o.resultado?.image_base64,
          }))
          .filter((o) => o.image_base64),
      );
    })();
  }, []);

  const addAdset = () => setAdsets((a) => [...a, { ...emptyAdset, nome: `Adset ${a.length + 1}` }]);
  const removeAdset = (i: number) => setAdsets((a) => a.filter((_, idx) => idx !== i));
  const updateAdset = (i: number, patch: Partial<AdsetForm>) =>
    setAdsets((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const addCreative = () => setCreatives((c) => [...c, { ...emptyCreative }]);
  const removeCreative = (i: number) => setCreatives((c) => c.filter((_, idx) => idx !== i));
  const updateCreative = (i: number, patch: Partial<CreativeForm>) =>
    setCreatives((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const linkCreativeOutput = (i: number, outputId: string) => {
    const o = availableOutputs.find((x) => x.id === outputId);
    if (!o) return;
    updateCreative(i, {
      output_id: o.id,
      output_label: o.titulo,
      image_preview: o.image_base64,
    });
  };

  const isReady = useMemo(() => {
    if (!metaReady) return false;
    if (!campaignName || !destinationUrl) return false;
    if (adsets.some((a) => !a.nome || a.budget_diario <= 0)) return false;
    if (creatives.some((c) => (!c.output_id && !c.image_preview) || !c.primary_text || !c.headline)) return false;
    return true;
  }, [metaReady, campaignName, destinationUrl, adsets, creatives]);

  const handlePublish = async () => {
    if (!isReady) {
      toast.error('Complete todos os campos obrigatorios antes de publicar');
      return;
    }
    setPublishing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-meta', {
        body: {
          action: 'publish',
          campaign_name: campaignName,
          objective,
          phase,
          ticket: ticket === '' ? undefined : ticket,
          cpl_max: cplMax === '' ? undefined : cplMax,
          adsets,
          creatives: creatives.map((c) => ({
            output_id: c.output_id,
            image_base64: c.output_id ? undefined : c.image_preview,
            name: c.output_label,
            copy: {
              primary_text: c.primary_text,
              headline: c.headline,
              description: c.description || undefined,
              cta_button: c.cta_button,
            },
          })),
          destination_url: destinationUrl,
          briefing_json: { campaignName, objective, phase, ticket, cplMax },
        },
      });
      if (error) {
        toast.error('Erro: ' + error.message);
        setResult({ success: false, error: error.message });
        return;
      }
      setResult(data);
      if (data?.success) {
        toast.success('Campanha criada em PAUSED. Revise no Ads Manager antes de ativar.');
      } else {
        toast.error(data?.error ?? 'Falha');
      }
    } finally {
      setPublishing(false);
    }
  };

  const updateBrief = (patch: Partial<typeof aiBrief>) => setAiBrief((b) => ({ ...b, ...patch }));

  const handleGeneratePlan = async () => {
    setGeneratingPlan(true);
    setAiPlan(null);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-midia', {
        body: { action: 'estrategista', brief: aiBrief },
      });
      if (error || !data?.success) {
        toast.error('Erro ao gerar plano: ' + (error?.message ?? data?.error ?? 'desconhecido'));
        return;
      }
      const p = data.plano;
      setAiPlan(p);
      if (p.campaign_name) setCampaignName(p.campaign_name);
      if (p.objective) setObjective(p.objective);
      if (p.phase) setPhase(p.phase);
      if (p.destination_url) setDestinationUrl(p.destination_url);
      if (typeof p.ticket === 'number') setTicket(p.ticket);
      if (typeof p.cpl_max === 'number') setCplMax(p.cpl_max);
      if (Array.isArray(p.adsets) && p.adsets.length) {
        setAdsets(p.adsets.map((a: any) => ({
          nome: a.nome ?? '',
          publico_descricao: a.publico_descricao ?? '',
          targeting: a.targeting ?? '',
          budget_diario: Number(a.budget_diario) || 0,
          optimization_goal: a.optimization_goal ?? 'LEAD_GENERATION',
          age_min: a.age_min ?? 25,
          age_max: a.age_max ?? 55,
        })));
      }
      if (Array.isArray(p.creatives) && p.creatives.length) {
        setCreatives(p.creatives.map((c: any) => ({
          primary_text: c.primary_text ?? '',
          headline: c.headline ?? '',
          description: c.description ?? '',
          cta_button: c.cta_button ?? 'LEARN_MORE',
        })));
      }
      toast.success('Plano gerado pela IA. Revise e ajuste antes de subir.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (metaReady === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metaReady) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-600 mt-0.5" />
              <div className="space-y-2">
                <h2 className="font-semibold text-lg">Meta Ads ainda nao configurada</h2>
                <p className="text-sm text-muted-foreground">
                  Pra subir campanhas voce precisa configurar token, ad account, page e pixel antes.
                </p>
                <Button asChild>
                  <a href="/admin/marketing/integracoes/meta">Configurar agora</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Nova Campanha Meta Ads</h1>
          <p className="text-sm text-muted-foreground">
            Estrutura, sobe como PAUSED e te entrega o link do Ads Manager pra revisar antes de ativar.
          </p>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> AI Estrategista (Claude Sonnet)
          </CardTitle>
          <Badge variant="outline" className="text-xs">pre-preenche o formulario</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Descreva o briefing em 4 toques. A IA monta posicionamento, publicos, split de verba, copy e roteiros, e ja preenche os campos abaixo pra voce revisar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Produto / evento</Label>
              <Input value={aiBrief.produto} onChange={(e) => updateBrief({ produto: e.target.value })} placeholder="Masterclass IA para Negocios, presencial" />
            </div>
            <div>
              <Label>Cidade / regiao</Label>
              <Input value={aiBrief.cidade} onChange={(e) => updateBrief({ cidade: e.target.value })} placeholder="Feira de Santana, BA" />
            </div>
            <div>
              <Label>Raio (km)</Label>
              <Input value={aiBrief.raio_km} onChange={(e) => updateBrief({ raio_km: e.target.value })} placeholder="80" />
            </div>
            <div>
              <Label>Verba diaria total (R$)</Label>
              <Input value={aiBrief.verba_dia} onChange={(e) => updateBrief({ verba_dia: e.target.value })} placeholder="30" />
            </div>
            <div>
              <Label>Ticket (R$)</Label>
              <Input value={aiBrief.ticket} onChange={(e) => updateBrief({ ticket: e.target.value })} placeholder="47" />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={aiBrief.objetivo} onChange={(e) => updateBrief({ objetivo: e.target.value })} placeholder="encher a sala e vender no palco" />
            </div>
            <div className="md:col-span-2">
              <Label>Publico-alvo</Label>
              <Input value={aiBrief.publico} onChange={(e) => updateBrief({ publico: e.target.value })} placeholder="empresarios 28+, faturamento acima de 30k, donos de negocio" />
            </div>
            <div className="md:col-span-2">
              <Label>Contexto extra (opcional)</Label>
              <Textarea value={aiBrief.contexto} onChange={(e) => updateBrief({ contexto: e.target.value })} rows={2} placeholder="material de podcast, autoridade, prova social, urgencia de vagas..." />
            </div>
          </div>
          <Button onClick={handleGeneratePlan} disabled={generatingPlan || !aiBrief.produto}>
            {generatingPlan ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando plano...</>
            ) : (
              <><Wand2 className="h-4 w-4 mr-2" />Gerar plano com IA</>
            )}
          </Button>

          {aiPlan && (
            <div className="space-y-3 rounded-md border bg-background p-4 text-sm">
              {aiPlan.posicionamento && (
                <div>
                  <p className="font-medium text-primary">Posicionamento</p>
                  <p className="text-muted-foreground">{aiPlan.posicionamento}</p>
                </div>
              )}
              {Array.isArray(aiPlan.roteiros) && aiPlan.roteiros.length > 0 && (
                <div className="space-y-3">
                  <p className="font-medium">Roteiros de criativo</p>
                  {aiPlan.roteiros.map((r: any, ri: number) => (
                    <div key={ri} className="rounded border p-3">
                      <p className="font-medium text-xs">
                        {r.titulo} {r.campanha ? `· ${r.campanha}` : ''} {r.duracao_seg ? `· ${r.duracao_seg}s` : ''}
                      </p>
                      <div className="mt-2 space-y-1">
                        {(r.cenas ?? []).map((c: any, ci: number) => (
                          <div key={ci} className="grid grid-cols-[60px_1fr] gap-2 text-xs border-t pt-1">
                            <span className="text-muted-foreground">{c.tempo}</span>
                            <span>
                              <span className="font-medium">{c.texto_tela}</span>
                              {c.fala ? <span className="text-muted-foreground">: {c.fala}</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {aiPlan.observacoes && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{aiPlan.observacoes}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuracao da campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome da campanha</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Masterclass IA - Captacao - Frio"
              />
            </div>
            <div>
              <Label>URL de destino</Label>
              <Input
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://squaad.com.br/masterclass"
              />
            </div>
            <div>
              <Label>Objetivo (ODAX)</Label>
              <Select value={objective} onValueChange={(v) => setObjective(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTCOME_LEADS">Leads (captacao)</SelectItem>
                  <SelectItem value="OUTCOME_SALES">Vendas / Conversoes</SelectItem>
                  <SelectItem value="OUTCOME_TRAFFIC">Trafego (LP views)</SelectItem>
                  <SelectItem value="OUTCOME_ENGAGEMENT">Engajamento</SelectItem>
                  <SelectItem value="OUTCOME_AWARENESS">Awareness / Reach</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fase do funil</Label>
              <Select value={phase} onValueChange={(v) => setPhase(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="captacao">Captacao</SelectItem>
                  <SelectItem value="aquecimento">Aquecimento</SelectItem>
                  <SelectItem value="conversao">Conversao</SelectItem>
                  <SelectItem value="remarketing">Remarketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ticket (R$)</Label>
              <Input
                type="number"
                value={ticket}
                onChange={(e) => setTicket(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="997"
              />
            </div>
            <div>
              <Label>CPL maximo (R$)</Label>
              <Input
                type="number"
                value={cplMax}
                onChange={(e) => setCplMax(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="15"
              />
              <p className="text-xs text-muted-foreground mt-1">
                CPL_max = ticket × taxa_conversao × margem. Ex: R$997 × 3% × 0.5 = R$15.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Adsets ({adsets.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={addAdset}>
            <Plus className="h-4 w-4 mr-1" /> Adset
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {adsets.map((adset, i) => (
            <div key={i} className="rounded-md border p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Adset {i + 1}</Badge>
                {adsets.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => removeAdset(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={adset.nome} onChange={(e) => updateAdset(i, { nome: e.target.value })} placeholder="Broad BR 28-55" />
                </div>
                <div>
                  <Label>Budget diario (R$)</Label>
                  <Input
                    type="number"
                    value={adset.budget_diario}
                    onChange={(e) => updateAdset(i, { budget_diario: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Optimization goal</Label>
                  <Select value={adset.optimization_goal} onValueChange={(v) => updateAdset(i, { optimization_goal: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEAD_GENERATION">Lead Generation</SelectItem>
                      <SelectItem value="OFFSITE_CONVERSIONS">Offsite Conversions (Purchase)</SelectItem>
                      <SelectItem value="LANDING_PAGE_VIEWS">Landing Page Views</SelectItem>
                      <SelectItem value="POST_ENGAGEMENT">Post Engagement</SelectItem>
                      <SelectItem value="REACH">Reach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Idade min</Label>
                    <Input
                      type="number"
                      value={adset.age_min ?? 18}
                      onChange={(e) => updateAdset(i, { age_min: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Idade max</Label>
                    <Input
                      type="number"
                      value={adset.age_max ?? 65}
                      onChange={(e) => updateAdset(i, { age_max: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Publico (descricao)</Label>
                  <Input
                    value={adset.publico_descricao}
                    onChange={(e) => updateAdset(i, { publico_descricao: e.target.value })}
                    placeholder="LAL 1% compradores"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Criativos ({creatives.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={addCreative}>
            <Plus className="h-4 w-4 mr-1" /> Criativo
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {creatives.map((c, i) => (
            <div key={i} className="rounded-md border p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Criativo {i + 1}</Badge>
                {creatives.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => removeCreative(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Label>Imagem (do agente Criativo)</Label>
                  <Select
                    value={c.output_id ?? ''}
                    onValueChange={(v) => linkCreativeOutput(i, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar criativo gerado" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOutputs.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">
                          Nenhum criativo com imagem disponivel. Gere um pelo agente Criativo antes.
                        </div>
                      ) : (
                        availableOutputs.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.titulo}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {c.image_preview && (
                    <div className="mt-2 rounded border overflow-hidden bg-black">
                      <a href={c.image_preview} target="_blank" rel="noopener noreferrer" title="Abrir tamanho real em nova aba">
                        <img src={c.image_preview} alt={c.output_label} className="w-full max-h-96 object-contain" />
                      </a>
                    </div>
                  )}
                  {!c.image_preview && (
                    <div className="mt-2 rounded border border-dashed h-48 flex items-center justify-center text-xs text-muted-foreground">
                      <ImageIcon className="h-4 w-4 mr-1" /> Sem preview
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <Label>Primary text (texto principal)</Label>
                    <Textarea
                      value={c.primary_text}
                      onChange={(e) => updateCreative(i, { primary_text: e.target.value })}
                      placeholder="Hook que abre o anuncio. Ate ~125 chars no preview."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Headline (40 chars)</Label>
                      <Input
                        value={c.headline}
                        maxLength={40}
                        onChange={(e) => updateCreative(i, { headline: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Description (30 chars)</Label>
                      <Input
                        value={c.description}
                        maxLength={30}
                        onChange={(e) => updateCreative(i, { description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>CTA button</Label>
                    <Select value={c.cta_button} onValueChange={(v) => updateCreative(i, { cta_button: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LEARN_MORE">Saiba mais</SelectItem>
                        <SelectItem value="SIGN_UP">Inscreva-se</SelectItem>
                        <SelectItem value="SUBSCRIBE">Cadastre-se</SelectItem>
                        <SelectItem value="GET_OFFER">Receba oferta</SelectItem>
                        <SelectItem value="WATCH_MORE">Assista</SelectItem>
                        <SelectItem value="CONTACT_US">Fale conosco</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={cn(isReady && 'border-green-300 bg-green-50/30')}>
        <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium">
              {isReady
                ? 'Pronto pra subir como PAUSED'
                : 'Complete nome, URL, adsets (>=1) e criativos (>=1, com imagem e copy)'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Tudo entra como PAUSED no Meta. Voce ativa manual no Ads Manager.
            </p>
          </div>
          <Button onClick={handlePublish} disabled={!isReady || publishing}>
            {publishing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Subindo...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Subir campanha PAUSED</>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className={cn(result.success ? 'border-green-300' : 'border-red-300')}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {result.success ? 'Campanha criada' : 'Falha'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.aviso && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{result.aviso}</span>
              </div>
            )}
            {result.error && (
              <p className="text-red-600">{result.error}</p>
            )}
            {result.meta_campaign_id && (
              <p><strong>Meta Campaign ID:</strong> <code className="text-xs">{result.meta_campaign_id}</code></p>
            )}
            {result.adset_ids && result.adset_ids.length > 0 && (
              <div>
                <strong>Adsets criados:</strong>
                <ul className="text-xs text-muted-foreground ml-4 list-disc">
                  {result.adset_ids.map((a) => <li key={a.id}>{a.nome} - <code>{a.id}</code></li>)}
                </ul>
              </div>
            )}
            {result.ad_ids && result.ad_ids.length > 0 && (
              <p className="text-xs text-muted-foreground">{result.ad_ids.length} ads criados</p>
            )}
            {result.ads_manager_url && (
              <Button asChild variant="outline" size="sm">
                <a href={result.ads_manager_url} target="_blank" rel="noopener noreferrer">
                  Abrir no Ads Manager <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {result.step_logs && result.step_logs.some((s) => !s.success) && (
              <>
                <Separator />
                <div className="text-xs">
                  <strong>Steps com erro:</strong>
                  <ul className="ml-4 list-disc text-red-600">
                    {result.step_logs.filter((s) => !s.success).map((s, i) => (
                      <li key={i}>{s.step}: {s.error_message}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
