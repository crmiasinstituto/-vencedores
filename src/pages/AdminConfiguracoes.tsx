import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Settings,
  Globe,
  Webhook,
  Save,
  TestTube,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  KeyRound,
  Brain,
  MessageSquare,
  Phone,
  Mic,
  MapPin,
  Megaphone,
  Instagram,
  Bot,
  Calendar,
  Eye,
  EyeOff,
  Kanban,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Flag,
  Flame,
  Search,
  Sparkles,
  Copy,
  ShoppingCart,
} from 'lucide-react';
import CsAgentSettings from '@/components/admin/CsAgentSettings';

// ─── Webhook Types & Section ────────────────────────────────────────────────

interface WebhookConfig {
  id: string;
  page_slug: string;
  page_name: string;
  webhook_url: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Integration Keys Types & Config ────────────────────────────────────────

interface IntegrationKey {
  service: string;
  // Valores CRUS nunca vêm do banco pro front (Migration A, RLS service_role
  // only). Estes campos só carregam o que o admin DIGITOU nessa sessão pra
  // mandar pro save-integration-key. Pra status visual usar last4/has_secret.
  api_key: string | null;
  api_secret: string | null;
  account_id: string | null;
  api_key_last4: string | null;
  api_key_masked: string | null;
  has_secret: boolean;
  is_active: boolean;
  updated_at: string;
  // metadata JSONB. Hoje usado pra display_label (override do nome do card
  // quando admin renomeia "Falar com Simone" pra outra coisa).
  metadata: Record<string, any>;
}

type ServiceFieldKey = 'api_key' | 'api_secret' | 'account_id' | 'display_label';

interface ServiceConfig {
  service: string;
  label: string;
  icon: React.ReactNode;
  fields: Array<{ key: ServiceFieldKey; label: string; secret?: boolean }>;
}

const SERVICE_CONFIGS: ServiceConfig[] = [
  {
    service: 'openai',
    label: 'OpenAI',
    icon: <Brain className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key' }],
  },
  {
    service: 'uazapi',
    label: 'UAZAPI',
    icon: <MessageSquare className="w-5 h-5" />,
    fields: [
      { key: 'api_key', label: 'API Key' },
      { key: 'account_id', label: 'Account ID' },
    ],
  },
  {
    service: 'wavoip',
    label: 'WaVoIP',
    icon: <Phone className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key' }],
  },
  {
    service: 'soniox',
    label: 'Soniox',
    icon: <Mic className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key' }],
  },
  {
    service: 'google_places',
    label: 'Google Places',
    icon: <MapPin className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key' }],
  },
  {
    service: 'meta_ads',
    label: 'Meta Ads',
    icon: <Megaphone className="w-5 h-5" />,
    fields: [
      { key: 'api_key', label: 'API Key' },
      { key: 'account_id', label: 'Account ID' },
    ],
  },
  {
    service: 'instagram',
    label: 'Instagram',
    icon: <Instagram className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key' }],
  },
  {
    service: 'anthropic',
    label: 'Anthropic (Claude)',
    icon: <Bot className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key' }],
  },
  {
    service: 'lovable',
    label: 'Lovable AI (gateway LLM)',
    icon: <Sparkles className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key (gateway usado por varios agentes de IA)' }],
  },
  {
    service: 'google_calendar',
    label: 'Google Calendar',
    icon: <Calendar className="w-5 h-5" />,
    fields: [
      { key: 'api_key', label: 'API Key' },
      { key: 'api_secret', label: 'API Secret' },
    ],
  },
  // ─── Prospecção Pro ────────────────────────────────────────────────────
  {
    service: 'firecrawl',
    label: 'Firecrawl (Prospecção)',
    icon: <Flame className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key (fc-xxxxx)' }],
  },
  {
    service: 'scrapecreators',
    label: 'ScrapeCreators (Prospecção)',
    icon: <Search className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key' }],
  },
  {
    service: 'gemini',
    label: 'Google Gemini (Prospecção)',
    icon: <Sparkles className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Key (AIza...)' }],
  },
  {
    service: 'replicate',
    label: 'Replicate (Face Swap para criativos)',
    icon: <Sparkles className="w-5 h-5" />,
    fields: [{ key: 'api_key', label: 'API Token (r8_...) - replicate.com/account/api-tokens' }],
  },
  // Contatos humanos da area de membros. Telefone WhatsApp no campo
  // account_id; nao usa api_key. Lidos pela edge function request-member-help.
  // display_label vai pra metadata.display_label e sobrescreve o titulo
  // do card (pra renomear "Falar com Simone" sem mexer em codigo).
  {
    service: 'cs_contact',
    label: 'CS, Falar com a equipe',
    icon: <Phone className="w-5 h-5" />,
    fields: [
      { key: 'display_label', label: 'Nome de exibicao (ex: Falar com Simone)' },
      { key: 'account_id', label: 'Telefone WhatsApp (so digitos, ex: 5511999999999)' },
    ],
  },
  {
    service: 'tech_support',
    label: 'Suporte Tecnico',
    icon: <Phone className="w-5 h-5" />,
    fields: [
      { key: 'display_label', label: 'Nome de exibicao (ex: Falar com Luiz)' },
      { key: 'account_id', label: 'Telefone WhatsApp (so digitos, ex: 5511999999999)' },
    ],
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────

const AdminConfiguracoes: React.FC = () => {
  // Webhook state
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [editedUrls, setEditedUrls] = useState<Record<string, string>>({});

  // Integration keys state
  const [integrations, setIntegrations] = useState<IntegrationKey[]>([]);
  const [intLoading, setIntLoading] = useState(true);
  const [intSaving, setIntSaving] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, Record<string, string>>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  // Kirvano inbound webhook state
  const [kirvanoLastSale, setKirvanoLastSale] = useState<{ name: string; created_at: string } | null>(null);
  const [kirvanoTotal, setKirvanoTotal] = useState(0);
  const [kirvanoCopied, setKirvanoCopied] = useState(false);

  // Pipeline state
  const [boards, setBoards] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [activeBoard, setActiveBoard] = useState<string>('');
  const [pipeLoading, setPipeLoading] = useState(true);
  const [pipeSaving, setPipeSaving] = useState<string | null>(null);
  const [newColName, setNewColName] = useState('');
  const [newColColor, setNewColColor] = useState('#3B82F6');
  const [addColOpen, setAddColOpen] = useState(false);
  const [deleteColConfirm, setDeleteColConfirm] = useState<string | null>(null);

  // ─── Webhook handlers ───────────────────────────────────────────────────

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('webhook_configs')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setConfigs(data);
      const urls: Record<string, string> = {};
      data.forEach(c => { urls[c.id] = c.webhook_url; });
      setEditedUrls(urls);
    }
    setLoading(false);
  };

  const handleSave = async (config: WebhookConfig) => {
    setSaving(config.id);
    const newUrl = editedUrls[config.id] || config.webhook_url;
    const { error } = await supabase
      .from('webhook_configs')
      .update({ webhook_url: newUrl, updated_at: new Date().toISOString() })
      .eq('id', config.id);

    if (error) {
      toast.error('Erro ao salvar webhook');
    } else {
      toast.success(`Webhook "${config.page_name}" atualizado!`);
      fetchConfigs();
    }
    setSaving(null);
  };

  const handleToggle = async (config: WebhookConfig) => {
    const { error } = await supabase
      .from('webhook_configs')
      .update({ is_active: !config.is_active, updated_at: new Date().toISOString() })
      .eq('id', config.id);

    if (!error) {
      toast.success(`Webhook ${!config.is_active ? 'ativado' : 'desativado'}`);
      fetchConfigs();
    }
  };

  const handleTest = async (config: WebhookConfig) => {
    setTesting(config.id);
    try {
      const testPayload = {
        evento: 'webhook_test',
        timestamp: new Date().toISOString(),
        test: true,
        source: config.page_slug,
        message: `Teste de webhook da página: ${config.page_name}`,
      };

      const response = await fetch(editedUrls[config.id] || config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        toast.success(`Webhook "${config.page_name}" respondeu OK!`);
      } else {
        toast.error(`Webhook respondeu com status ${response.status}`);
      }
    } catch (err: any) {
      toast.error(`Erro ao testar: ${err.message}`);
    }
    setTesting(null);
  };

  const getSlugIcon = (slug: string) => {
    switch (slug) {
      case 'landing_page': return '🏠';
      case 'vhs_ao_prompt': return '🎬';
      case 'sales_webhook': return '💰';
      case 'whatsapp_receiver': return '💬';
      default: return '🔗';
    }
  };

  // ─── Integration keys handlers ──────────────────────────────────────────

  const fetchIntegrations = async () => {
    setIntLoading(true);
    // RPC com SECURITY DEFINER + filtro is_admin(). Retorna valores MASCARADOS;
    // o api_key cru nunca trafega pelo browser. Editar = digitar novo valor.
    const { data, error } = await (supabase as any).rpc('get_integration_keys_masked');

    if (error) {
      console.error('[integration_keys] rpc error:', error);
      toast.error(`Erro ao carregar chaves: ${error.message}`);
      setIntLoading(false);
      return;
    }

    const rows: IntegrationKey[] = (data || []).map((r: any) => ({
      service: r.service,
      api_key: null,            // valor cru não vem mais do banco
      api_secret: null,         // idem
      account_id: r.account_id ?? null,
      api_key_last4: r.api_key_last4 ?? null,
      api_key_masked: r.api_key_masked ?? null,
      has_secret: !!r.has_secret,
      is_active: !!r.is_active,
      updated_at: r.updated_at,
      metadata: (r.metadata as Record<string, any>) || {},
    }));

    setIntegrations(rows);
    // editedFields parte vazio — admin digita novos valores pra salvar
    setEditedFields({});
    setIntLoading(false);
  };

  const handleIntSave = async (service: string) => {
    setIntSaving(service);
    const row = integrations.find((r) => r.service === service);
    const updates = editedFields[service] || {};

    // Só envia campos que o admin DIGITOU. Campo vazio = não mexer
    // (mantém valor atual no banco). Pra apagar, usar um botão "Limpar"
    // dedicado (a implementar conforme demanda).
    const body: Record<string, unknown> = {
      service,
      is_active: row?.is_active ?? true,
    };
    if (updates.api_key && updates.api_key.trim().length > 0) body.api_key = updates.api_key.trim();
    if (updates.api_secret && updates.api_secret.trim().length > 0) body.api_secret = updates.api_secret.trim();
    if (updates.account_id !== undefined) body.account_id = (updates.account_id || '').trim() || null;
    // display_label nao e coluna top-level, vai pra metadata (merge no edge).
    if (updates.display_label !== undefined) {
      body.metadata = { display_label: updates.display_label.trim() || null };
    }

    // save-integration-key roda com service_role — única forma de gravar
    // já que a RLS de integration_keys é "service_role only".
    const { data, error } = await (supabase as any).functions.invoke('save-integration-key', { body });

    if (error || data?.error) {
      const msg = error?.message || data?.error || 'erro desconhecido';
      console.error(`[integration_keys] save error for ${service}:`, error || data);
      toast.error(`Erro ao salvar ${service}: ${msg}`);
    } else {
      toast.success(`${service} atualizado com sucesso!`);
      fetchIntegrations();
    }
    setIntSaving(null);
  };

  const handleIntToggle = async (row: IntegrationKey) => {
    // Toggle só muda is_active — não reenvia api_key/secret (que aliás
    // não temos mais no estado depois do hardening). Edge function
    // mantém colunas não enviadas intactas.
    const { data, error } = await (supabase as any).functions.invoke('save-integration-key', {
      body: { service: row.service, is_active: !row.is_active },
    });
    if (error || data?.error) {
      toast.error(`Erro: ${error?.message || data?.error}`);
    } else {
      toast.success(`${row.service} ${!row.is_active ? 'ativado' : 'desativado'}`);
      fetchIntegrations();
    }
  };

  const toggleFieldVisibility = (fieldId: string) => {
    setVisibleFields((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const updateField = (service: string, field: string, value: string) => {
    setEditedFields((prev) => ({
      ...prev,
      [service]: { ...(prev[service] || {}), [field]: value },
    }));
  };

  const isConfigured = (service: string): boolean => {
    const row = integrations.find((r) => r.service === service);
    if (row?.api_key_last4 || row?.has_secret) return true;
    if (row?.account_id && row.account_id.trim().length > 0) return true;
    // Edição pendente: admin digitou mas ainda não salvou
    const fields = editedFields[service];
    return !!(fields && Object.values(fields).some((v) => v && v.trim().length > 0));
  };

  // ─── Pipeline handlers ───────────────────────────────────────────────────

  const fetchBoards = async () => {
    const { data } = await supabase
      .from('crm_boards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (data && data.length > 0) {
      setBoards(data);
      if (!activeBoard) setActiveBoard(data[0].id);
    }
  };

  const fetchColumns = async (boardId: string) => {
    if (!boardId) return;
    setPipeLoading(true);
    const { data } = await supabase
      .from('crm_columns')
      .select('*')
      .eq('board_id', boardId)
      .order('sort_order', { ascending: true });
    if (data) setColumns(data);
    setPipeLoading(false);
  };

  const updateColumn = async (colId: string, updates: Record<string, any>) => {
    setPipeSaving(colId);
    const { error } = await supabase
      .from('crm_columns')
      .update(updates)
      .eq('id', colId);
    if (error) {
      toast.error('Erro ao atualizar coluna');
    } else {
      toast.success('Coluna atualizada!');
      fetchColumns(activeBoard);
    }
    setPipeSaving(null);
  };

  const moveColumn = async (colId: string, direction: 'up' | 'down') => {
    const idx = columns.findIndex((c: any) => c.id === colId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;

    const currentOrder = columns[idx].sort_order ?? idx;
    const swapOrder = columns[swapIdx].sort_order ?? swapIdx;

    await Promise.all([
      supabase.from('crm_columns').update({ sort_order: swapOrder }).eq('id', columns[idx].id),
      supabase.from('crm_columns').update({ sort_order: currentOrder }).eq('id', columns[swapIdx].id),
    ]);
    fetchColumns(activeBoard);
  };

  const addColumn = async () => {
    if (!newColName.trim()) { toast.error('Nome obrigatorio'); return; }
    const maxOrder = Math.max(...columns.map((c: any) => c.sort_order ?? 0), 0);
    const { error } = await supabase.from('crm_columns').insert({
      name: newColName,
      color: newColColor,
      board_id: activeBoard,
      sort_order: maxOrder + 1,
      is_final_stage: false,
    });
    if (error) { toast.error('Erro ao criar coluna'); return; }
    toast.success('Coluna adicionada!');
    setNewColName('');
    setNewColColor('#3B82F6');
    setAddColOpen(false);
    fetchColumns(activeBoard);
  };

  const deleteColumn = async (colId: string) => {
    const { error } = await supabase.from('crm_columns').delete().eq('id', colId);
    if (error) { toast.error('Erro ao remover coluna'); return; }
    toast.success('Coluna removida!');
    setDeleteColConfirm(null);
    fetchColumns(activeBoard);
  };

  // ─── Kirvano stats ──────────────────────────────────────────────────────

  const KIRVANO_WEBHOOK_URL = 'https://iymlwsawrmghhbawiavz.supabase.co/functions/v1/kirvano-webhook';

  const KIRVANO_EVENTS = [
    { event: 'SALE_APPROVED', desc: 'Venda aprovada' },
    { event: 'ABANDONED_CART', desc: 'Carrinho abandonado' },
    { event: 'PIX_GENERATED', desc: 'PIX gerado' },
    { event: 'PIX_EXPIRED', desc: 'PIX expirado' },
    { event: 'BOLETO_GENERATED', desc: 'Boleto gerado' },
    { event: 'BOLETO_EXPIRED', desc: 'Boleto expirado' },
    { event: 'SALE_REFUSED', desc: 'Cartao recusado' },
    { event: 'SALE_REFUNDED', desc: 'Reembolso' },
    { event: 'SALE_CHARGEBACK', desc: 'Chargeback' },
  ];

  const fetchKirvanoStats = async () => {
    const [lastRes, countRes] = await Promise.all([
      supabase
        .from('sales_events')
        .select('name, created_at')
        .eq('source', 'kirvano')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sales_events')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'kirvano'),
    ]);
    if (lastRes.data) setKirvanoLastSale(lastRes.data);
    if (countRes.count != null) setKirvanoTotal(countRes.count);
  };

  const copyKirvanoUrl = () => {
    navigator.clipboard.writeText(KIRVANO_WEBHOOK_URL);
    setKirvanoCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setKirvanoCopied(false), 2000);
  };

  // ─── Effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchConfigs();
    fetchIntegrations();
    fetchBoards();
    fetchKirvanoStats();
  }, []);

  useEffect(() => {
    if (activeBoard) fetchColumns(activeBoard);
  }, [activeBoard]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading && intLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Configurações | Admin + que Vencedores</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" />
              Configurações
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie os webhooks e integrações de cada página
            </p>
          </div>
          <Button variant="outline" onClick={() => { fetchConfigs(); fetchIntegrations(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="webhooks" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Chaves de Integracao
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <Kanban className="w-4 h-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="cs-ia" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              CS IA
            </TabsTrigger>
          </TabsList>

          {/* ── Webhooks Tab ────────────────────────────────────────────── */}
          <TabsContent value="webhooks">
            {/* ── Kirvano Inbound Webhook ─────────────────────────────── */}
            <Card className="border-primary/40 bg-primary/5 mt-4 mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-6 h-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Webhook Kirvano (Recebimento)</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Cole esta URL na Kirvano para receber vendas automaticamente no CRM
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={kirvanoLastSale ? 'default' : 'secondary'} className="text-xs">
                    {kirvanoLastSale ? `${kirvanoTotal} vendas` : 'Sem vendas'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={KIRVANO_WEBHOOK_URL}
                    readOnly
                    className="font-mono text-xs bg-background"
                  />
                  <Button variant="outline" size="sm" onClick={copyKirvanoUrl}>
                    {kirvanoCopied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                {kirvanoLastSale && (
                  <p className="text-xs text-muted-foreground">
                    Ultima venda: <strong>{kirvanoLastSale.name}</strong> em{' '}
                    {new Date(kirvanoLastSale.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Eventos suportados:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {KIRVANO_EVENTS.map(e => (
                      <Badge key={e.event} variant="outline" className="text-[10px] font-mono">
                        {e.event}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Como configurar na Kirvano:</p>
                  <p>1. Acesse o painel Kirvano &gt; Produto &gt; Webhooks</p>
                  <p>2. Cole a URL acima no campo de webhook</p>
                  <p>3. Marque todos os eventos listados acima</p>
                  <p>4. Salve. As vendas aparecerao no Kanban automaticamente.</p>
                </div>
              </CardContent>
            </Card>

            <h3 className="text-sm font-medium text-muted-foreground mb-3">Webhooks de saida</h3>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4">
                {configs.map(config => (
                  <Card key={config.id} className={`border ${config.is_active ? 'border-primary/30' : 'border-muted opacity-60'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getSlugIcon(config.page_slug)}</span>
                          <div>
                            <CardTitle className="text-lg">{config.page_name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              {config.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={config.is_active ? 'default' : 'secondary'} className="text-xs">
                            {config.is_active ? '🟢 Ativo' : '🔴 Inativo'}
                          </Badge>
                          <Switch
                            checked={config.is_active}
                            onCheckedChange={() => handleToggle(config)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            value={editedUrls[config.id] || ''}
                            onChange={(e) => setEditedUrls(prev => ({ ...prev, [config.id]: e.target.value }))}
                            className="pl-10 font-mono text-xs"
                            placeholder="https://..."
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSave(config)}
                          disabled={saving === config.id || editedUrls[config.id] === config.webhook_url}
                        >
                          {saving === config.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(config)}
                          disabled={testing === config.id}
                        >
                          {testing === config.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Slug: <code className="bg-muted px-1 rounded">{config.page_slug}</code> ·
                        Atualizado: {new Date(config.updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Integration Keys Tab ────────────────────────────────────── */}
          <TabsContent value="integrations">
            {intLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-4">
                {SERVICE_CONFIGS.map((svc) => {
                  const row = integrations.find((r) => r.service === svc.service);
                  const configured = isConfigured(svc.service);
                  const active = row?.is_active ?? false;

                  return (
                    <Card
                      key={svc.service}
                      className={`border ${active ? 'border-primary/30' : 'border-muted opacity-60'} flex flex-col`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              {svc.icon}
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {row?.metadata?.display_label || svc.label}
                              </CardTitle>
                              <CardDescription className="text-xs mt-0.5">
                                {svc.service}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={configured ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {configured ? (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Configurado
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Pendente
                                </span>
                              )}
                            </Badge>
                            {row && (
                              <Switch
                                checked={active}
                                onCheckedChange={() => handleIntToggle(row)}
                              />
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 flex-1 flex flex-col">
                        <div className="space-y-2 flex-1">
                          {svc.fields.map((field) => {
                            const fieldId = `${svc.service}_${field.key}`;
                            const isVisible = visibleFields[fieldId] || false;
                            const value = editedFields[svc.service]?.[field.key] || '';
                            // Campos sensiveis usam mask + password input; display_label
                            // e account_id sao texto claro normal.
                            const isSecretField = field.key === 'api_key' || field.key === 'api_secret';

                            // Hint do valor salvo (so pra campos sensiveis). Os
                            // campos abertos (account_id, display_label) ja mostram
                            // valor real no Salvo abaixo.
                            let savedHint: string | null = null;
                            if (!value && row) {
                              if (field.key === 'api_key' && row.api_key_masked) {
                                savedHint = row.api_key_masked;
                              } else if (field.key === 'api_secret' && row.has_secret) {
                                savedHint = '●●●●●●●●●●';
                              } else if (field.key === 'account_id' && row.account_id) {
                                savedHint = row.account_id;
                              } else if (field.key === 'display_label' && row.metadata?.display_label) {
                                savedHint = row.metadata.display_label;
                              }
                            }

                            return (
                              <div key={field.key}>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-xs text-muted-foreground">
                                    {field.label}
                                  </label>
                                  {savedHint && (
                                    <span className="text-[10px] font-mono text-emerald-400/70" title="Valor salvo, digite pra substituir">
                                      Salvo: {savedHint}
                                    </span>
                                  )}
                                </div>
                                <div className="relative flex gap-1">
                                  <Input
                                    type={isSecretField && !isVisible ? 'password' : 'text'}
                                    value={value}
                                    onChange={(e) =>
                                      updateField(svc.service, field.key, e.target.value)
                                    }
                                    className={`text-xs ${isSecretField ? 'font-mono pr-10' : ''}`}
                                    placeholder={savedHint ? 'Digite pra substituir...' : `Insira ${field.label}...`}
                                  />
                                  {isSecretField && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                      onClick={() => toggleFieldVisibility(fieldId)}
                                    >
                                      {isVisible ? (
                                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleIntSave(svc.service)}
                            disabled={intSaving === svc.service}
                          >
                            {intSaving === svc.service ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Salvar
                          </Button>
                        </div>

                        {row && (
                          <p className="text-xs text-muted-foreground">
                            Atualizado: {new Date(row.updated_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          {/* ── Pipeline Tab ──────────────────────────────────────────── */}
          <TabsContent value="pipeline">
            <div className="space-y-4 mt-4">
              {/* Board selector */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Board:</label>
                <Select value={activeBoard} onValueChange={setActiveBoard}>
                  <SelectTrigger className="w-[240px]"><SelectValue placeholder="Selecione um board" /></SelectTrigger>
                  <SelectContent>
                    {boards.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto">
                  <Dialog open={addColOpen} onOpenChange={setAddColOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Nova Coluna</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-2">
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
                          <Input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Nome da coluna" />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Cor</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={newColColor}
                              onChange={(e) => setNewColColor(e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent"
                            />
                            <Input value={newColColor} onChange={(e) => setNewColColor(e.target.value)} className="font-mono text-xs w-28" />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button onClick={addColumn}>Adicionar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Columns list */}
              {pipeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : columns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma coluna encontrada para este board.
                </div>
              ) : (
                <div className="space-y-2">
                  {columns.map((col: any, idx: number) => (
                    <Card key={col.id} className="border-border">
                      <CardContent className="p-4 flex items-center gap-4">
                        {/* Sort order */}
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === 0}
                            onClick={() => moveColumn(col.id, 'up')}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === columns.length - 1}
                            onClick={() => moveColumn(col.id, 'down')}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Color */}
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={col.color || '#3B82F6'}
                            onChange={(e) => updateColumn(col.id, { color: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                          />
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{col.name}</p>
                          <p className="text-xs text-muted-foreground">Ordem: {col.sort_order ?? idx}</p>
                        </div>

                        {/* Final stage toggle */}
                        <div className="flex items-center gap-2">
                          <Flag className={`w-4 h-4 ${col.is_final_stage ? 'text-primary' : 'text-muted-foreground'}`} />
                          <Switch
                            checked={col.is_final_stage || false}
                            onCheckedChange={(checked) => updateColumn(col.id, { is_final_stage: checked })}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Estagio final</span>
                        </div>

                        {/* Saving indicator */}
                        {pipeSaving === col.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}

                        {/* Delete */}
                        <Dialog open={deleteColConfirm === col.id} onOpenChange={(open) => setDeleteColConfirm(open ? col.id : null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Confirmar exclusao</DialogTitle></DialogHeader>
                            <p className="text-sm text-muted-foreground py-2">
                              Tem certeza que deseja remover a coluna <strong>{col.name}</strong>?
                              Leads nesta coluna podem ficar sem coluna.
                            </p>
                            <DialogFooter>
                              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                              <Button variant="destructive" onClick={() => deleteColumn(col.id)}>Remover</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cs-ia">
            <CsAgentSettings />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminConfiguracoes;
