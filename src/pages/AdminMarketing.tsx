import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Megaphone, Plus, Trash2, Edit2, Copy, Link, ExternalLink,
  DollarSign, Users, Target, BarChart3, TrendingUp, Eye, Brain, Sparkles, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ── Types ──

interface UtmLink {
  id: string;
  name: string;
  base_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  full_url: string | null;
  clicks: number;
  leads_generated: number;
  is_active: boolean;
  created_at: string;
}

interface MarketingCampaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: number | null;
  spent: number;
  leads: number;
  conversions: number;
  cpl: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

// ── Helpers ──

const db = supabase as any;

function buildUtmUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  return url.toString();
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const platformLabels: Record<string, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
  manual: 'Manual',
};

const statusConfig: Record<string, { label: string; variant: string; className: string }> = {
  active: { label: 'Ativo', variant: 'default', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  paused: { label: 'Pausado', variant: 'secondary', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  completed: { label: 'Concluído', variant: 'secondary', className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
};

// ── Component ──

export default function AdminMarketing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('campanhas');
  const [generatingCopyFor, setGeneratingCopyFor] = useState<string | null>(null);

  async function generateCopyForCampaign(c: MarketingCampaign) {
    setGeneratingCopyFor(c.id);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-copy', {
        body: {
          action: 'generate',
          tipo: 'ad_meta',
          briefing: {
            campanha_nome: c.name,
            plataforma: c.platform,
            budget: c.budget,
            objetivo: 'captacao',
            historico: { gasto: c.spent, leads: c.leads, cpl: c.cpl },
            notas: c.notes,
          },
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error ?? 'Falha ao gerar copy');
        return;
      }
      toast.success('Copy gerada! Veja em Marketing IA → Outputs');
      navigate('/admin/marketing-ia');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro');
    } finally {
      setGeneratingCopyFor(null);
    }
  }

  // Campaign state
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '', platform: 'meta', status: 'active', budget: '',
    spent: '', leads: '', conversions: '', start_date: '', end_date: '', notes: '',
  });

  // UTM state
  const [utmLinks, setUtmLinks] = useState<UtmLink[]>([]);
  const [showUtmDialog, setShowUtmDialog] = useState(false);
  const [utmForm, setUtmForm] = useState({
    name: '', base_url: 'https://wa.me/5575999999999',
    utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '',
  });

  const [isLoading, setIsLoading] = useState(true);

  // ── Data Fetching ──

  async function fetchCampaigns() {
    const { data, error } = await db.from('marketing_campaigns').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar campanhas'); console.error(error); return; }
    setCampaigns(data || []);
  }

  async function fetchUtmLinks() {
    const { data, error } = await db.from('utm_links').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar links UTM'); console.error(error); return; }
    setUtmLinks(data || []);
  }

  useEffect(() => {
    Promise.all([fetchCampaigns(), fetchUtmLinks()]).finally(() => setIsLoading(false));
  }, []);

  // ── Campaign CRUD ──

  function openNewCampaign() {
    setEditingCampaign(null);
    setCampaignForm({ name: '', platform: 'meta', status: 'active', budget: '', spent: '', leads: '', conversions: '', start_date: '', end_date: '', notes: '' });
    setShowCampaignDialog(true);
  }

  function openEditCampaign(c: MarketingCampaign) {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name,
      platform: c.platform,
      status: c.status,
      budget: c.budget?.toString() || '',
      spent: c.spent?.toString() || '',
      leads: c.leads?.toString() || '',
      conversions: c.conversions?.toString() || '',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      notes: c.notes || '',
    });
    setShowCampaignDialog(true);
  }

  async function saveCampaign() {
    if (!campaignForm.name) { toast.error('Nome da campanha obrigatorio'); return; }
    const budget = parseFloat(campaignForm.budget) || 0;
    const spent = parseFloat(campaignForm.spent) || 0;
    const leads = parseInt(campaignForm.leads) || 0;
    const cpl = leads > 0 ? spent / leads : null;

    const payload = {
      name: campaignForm.name,
      platform: campaignForm.platform,
      status: campaignForm.status,
      budget,
      spent,
      leads,
      conversions: parseInt(campaignForm.conversions) || 0,
      cpl,
      start_date: campaignForm.start_date || null,
      end_date: campaignForm.end_date || null,
      notes: campaignForm.notes || null,
    };

    if (editingCampaign) {
      const { error } = await db.from('marketing_campaigns').update(payload).eq('id', editingCampaign.id);
      if (error) { toast.error('Erro ao atualizar campanha'); return; }
      toast.success('Campanha atualizada');
    } else {
      const { error } = await db.from('marketing_campaigns').insert(payload);
      if (error) { toast.error('Erro ao criar campanha'); return; }
      toast.success('Campanha criada');
    }
    setShowCampaignDialog(false);
    fetchCampaigns();
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Excluir esta campanha?')) return;
    const { error } = await db.from('marketing_campaigns').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Campanha excluida');
    fetchCampaigns();
  }

  // ── UTM CRUD ──

  const previewUrl = useMemo(() => {
    try {
      return buildUtmUrl(utmForm.base_url, {
        utm_source: utmForm.utm_source,
        utm_medium: utmForm.utm_medium,
        utm_campaign: utmForm.utm_campaign,
        utm_term: utmForm.utm_term,
        utm_content: utmForm.utm_content,
      });
    } catch {
      return utmForm.base_url;
    }
  }, [utmForm]);

  async function saveUtmLink() {
    if (!utmForm.name) { toast.error('Nome do link obrigatorio'); return; }
    const full_url = previewUrl;
    const payload = { ...utmForm, full_url };
    const { error } = await db.from('utm_links').insert(payload);
    if (error) { toast.error('Erro ao criar link UTM'); console.error(error); return; }
    toast.success('Link UTM criado');
    setShowUtmDialog(false);
    setUtmForm({ name: '', base_url: 'https://wa.me/5575999999999', utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '' });
    fetchUtmLinks();
  }

  async function toggleUtmActive(link: UtmLink) {
    const { error } = await db.from('utm_links').update({ is_active: !link.is_active }).eq('id', link.id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    fetchUtmLinks();
  }

  async function deleteUtmLink(id: string) {
    if (!confirm('Excluir este link?')) return;
    const { error } = await db.from('utm_links').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Link excluido');
    fetchUtmLinks();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado!');
  }

  // ── KPIs ──

  const kpis = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const totalSpent = campaigns.reduce((s, c) => s + (c.spent || 0), 0);
    const totalLeads = campaigns.reduce((s, c) => s + (c.leads || 0), 0);
    const avgCpl = totalLeads > 0 ? totalSpent / totalLeads : 0;
    return { totalCampaigns, totalSpent, totalLeads, avgCpl };
  }, [campaigns]);

  // ── Analytics Data ──

  const leadsBySource = useMemo(() => {
    const map: Record<string, number> = {};
    utmLinks.forEach(l => {
      const src = l.utm_source || 'direto';
      map[src] = (map[src] || 0) + (l.leads_generated || 0);
    });
    return Object.entries(map).map(([name, leads]) => ({ name, leads }));
  }, [utmLinks]);

  const campaignPerformance = useMemo(() => {
    return campaigns.map(c => ({
      name: c.name.length > 20 ? c.name.slice(0, 20) + '...' : c.name,
      leads: c.leads || 0,
      gasto: c.spent || 0,
      cpl: c.cpl || 0,
    }));
  }, [campaigns]);

  // ── Render ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Marketing & Growth
          </h1>
          <p className="text-sm text-muted-foreground">Campanhas, links UTM e analytics. Pra estratégia + IA, abra Marketing IA.</p>
        </div>
        <Button onClick={() => navigate('/admin/marketing-ia')} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Brain className="w-4 h-4" /> Abrir Marketing IA
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="utm">Links UTM</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ════════════════════════ TAB: CAMPANHAS ════════════════════════ */}
        <TabsContent value="campanhas" className="space-y-4 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Campanhas</span>
                </div>
                <p className="text-2xl font-bold text-primary">{kpis.totalCampaigns}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-muted-foreground">Total Gasto</span>
                </div>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(kpis.totalSpent)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-muted-foreground">Total Leads</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">{kpis.totalLeads}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-muted-foreground">CPL Medio</span>
                </div>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(kpis.avgCpl)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={openNewCampaign} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Nova Campanha
            </Button>
          </div>

          {/* Campaigns Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>CPL</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhuma campanha criada ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {campaigns.map(c => {
                    const st = statusConfig[c.status] || statusConfig.active;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{platformLabels[c.platform] || c.platform}</TableCell>
                        <TableCell>
                          <Badge className={st.className}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatCurrency(c.budget)}</TableCell>
                        <TableCell className="text-red-400">{formatCurrency(c.spent)}</TableCell>
                        <TableCell className="text-blue-400 font-bold">{c.leads}</TableCell>
                        <TableCell className="text-foreground">{formatCurrency(c.cpl)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.start_date || '—'} {c.end_date ? `~ ${c.end_date}` : ''}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generateCopyForCampaign(c)}
                            disabled={generatingCopyFor !== null}
                            title="Gerar copy IA pra essa campanha"
                          >
                            {generatingCopyFor === c.id
                              ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              : <Sparkles className="w-4 h-4 text-primary" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditCampaign(c)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteCampaign(c.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Campaign Dialog */}
          <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Meta - Leads Abril" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Plataforma</Label>
                    <Select value={campaignForm.platform} onValueChange={v => setCampaignForm(f => ({ ...f, platform: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meta">Meta Ads</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                        <SelectItem value="tiktok">TikTok Ads</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={campaignForm.status} onValueChange={v => setCampaignForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                        <SelectItem value="completed">Concluido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Budget (R$)</Label>
                    <Input type="number" value={campaignForm.budget} onChange={e => setCampaignForm(f => ({ ...f, budget: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Gasto (R$)</Label>
                    <Input type="number" value={campaignForm.spent} onChange={e => setCampaignForm(f => ({ ...f, spent: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Leads</Label>
                    <Input type="number" value={campaignForm.leads} onChange={e => setCampaignForm(f => ({ ...f, leads: e.target.value }))} placeholder="0" />
                  </div>
                  <div>
                    <Label>Conversoes</Label>
                    <Input type="number" value={campaignForm.conversions} onChange={e => setCampaignForm(f => ({ ...f, conversions: e.target.value }))} placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Inicio</Label>
                    <Input type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Notas</Label>
                  <Textarea value={campaignForm.notes} onChange={e => setCampaignForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observacoes..." rows={2} />
                </div>
                <Button onClick={saveCampaign} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {editingCampaign ? 'Salvar Alteracoes' : 'Criar Campanha'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ════════════════════════ TAB: LINKS UTM ════════════════════════ */}
        <TabsContent value="utm" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowUtmDialog(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Novo Link UTM
            </Button>
          </div>

          {/* UTM Links List */}
          <div className="grid gap-3">
            {utmLinks.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum link UTM criado ainda.
                </CardContent>
              </Card>
            )}
            {utmLinks.map(link => (
              <Card key={link.id} className={`border-border ${!link.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="font-medium text-foreground">{link.name}</span>
                        <Badge variant={link.is_active ? 'default' : 'secondary'} className={link.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}>
                          {link.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                        {link.full_url || link.base_url}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        {link.utm_source && <span>source: <span className="text-foreground">{link.utm_source}</span></span>}
                        {link.utm_medium && <span>medium: <span className="text-foreground">{link.utm_medium}</span></span>}
                        {link.utm_campaign && <span>campaign: <span className="text-foreground">{link.utm_campaign}</span></span>}
                      </div>
                      <div className="flex gap-4 mt-2">
                        <span className="text-xs"><Eye className="w-3 h-3 inline mr-1" />{link.clicks} cliques</span>
                        <span className="text-xs text-primary"><Users className="w-3 h-3 inline mr-1" />{link.leads_generated} leads</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch checked={link.is_active} onCheckedChange={() => toggleUtmActive(link)} />
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(link.full_url || link.base_url)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteUtmLink(link.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* UTM Dialog */}
          <Dialog open={showUtmDialog} onOpenChange={setShowUtmDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Link UTM</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do Link *</Label>
                  <Input value={utmForm.name} onChange={e => setUtmForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Instagram Stories Abril" />
                </div>
                <div>
                  <Label>URL Base</Label>
                  <Input value={utmForm.base_url} onChange={e => setUtmForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://wa.me/5575999999999" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>utm_source</Label>
                    <Input value={utmForm.utm_source} onChange={e => setUtmForm(f => ({ ...f, utm_source: e.target.value }))} placeholder="instagram, google, facebook" />
                  </div>
                  <div>
                    <Label>utm_medium</Label>
                    <Input value={utmForm.utm_medium} onChange={e => setUtmForm(f => ({ ...f, utm_medium: e.target.value }))} placeholder="cpc, social, email" />
                  </div>
                </div>
                <div>
                  <Label>utm_campaign</Label>
                  <Input value={utmForm.utm_campaign} onChange={e => setUtmForm(f => ({ ...f, utm_campaign: e.target.value }))} placeholder="captacao-abril-2026" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>utm_term</Label>
                    <Input value={utmForm.utm_term} onChange={e => setUtmForm(f => ({ ...f, utm_term: e.target.value }))} placeholder="palavra-chave" />
                  </div>
                  <div>
                    <Label>utm_content</Label>
                    <Input value={utmForm.utm_content} onChange={e => setUtmForm(f => ({ ...f, utm_content: e.target.value }))} placeholder="variacao-a" />
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-lg bg-muted/50 border border-border p-3">
                  <Label className="text-xs text-muted-foreground mb-1 block">Preview da URL</Label>
                  <p className="text-xs font-mono text-primary break-all">{previewUrl}</p>
                </div>

                <Button onClick={saveUtmLink} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Criar Link UTM
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ════════════════════════ TAB: ANALYTICS ════════════════════════ */}
        <TabsContent value="analytics" className="space-y-6 mt-4">
          {/* Leads por Fonte (UTM Source) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Leads por Fonte (utm_source)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadsBySource.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados de leads por fonte ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadsBySource}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                    <Bar dataKey="leads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Leads por Campanha */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Leads por Campanha
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaignPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados de campanhas ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={campaignPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#888" fontSize={11} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="leads" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} name="Leads" />
                    <Line type="monotone" dataKey="gasto" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Gasto (R$)" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Campaign Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance de Campanhas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>CPL</TableHead>
                    <TableHead>Conversoes</TableHead>
                    <TableHead>Taxa Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Sem dados de campanhas ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {campaigns.map(c => {
                    const convRate = c.leads > 0 ? ((c.conversions / c.leads) * 100).toFixed(1) : '0.0';
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{platformLabels[c.platform] || c.platform}</TableCell>
                        <TableCell className="text-blue-400 font-bold">{c.leads}</TableCell>
                        <TableCell className="text-red-400">{formatCurrency(c.spent)}</TableCell>
                        <TableCell className="text-foreground">{formatCurrency(c.cpl)}</TableCell>
                        <TableCell className="text-primary font-bold">{c.conversions}</TableCell>
                        <TableCell className="text-foreground">{convRate}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
