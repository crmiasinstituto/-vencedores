import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  BarChart3, Loader2, RefreshCw, Pause, Play, ExternalLink, AlertCircle,
  TrendingUp, TrendingDown, Minus, Sparkles, Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type Insights = {
  vitalicio: any | null;
  ultimos_7d: any | null;
  hoje: any | null;
  synced_at?: string;
  erros?: string[];
};

type MetaCampaign = {
  id: string;
  meta_campaign_id: string;
  name: string;
  objective: string;
  phase: string | null;
  status: 'draft' | 'paused' | 'active' | 'archived';
  budget_total: number | null;
  ticket: number | null;
  cpl_max: number | null;
  marketing_event_id: string | null;
  last_synced_at: string | null;
  last_insights_json: Insights | null;
  meta_adset_ids: any[];
  meta_ad_ids: any[];
  created_at: string;
};

function getAction(actions: any[] | undefined, type: string): number {
  if (!Array.isArray(actions)) return 0;
  const m = actions.find((a) => a.action_type === type);
  return m ? Number(m.value) : 0;
}

function summarize(row: any | null) {
  if (!row) return null;
  const leads = getAction(row.actions, 'lead') || getAction(row.actions, 'onsite_conversion.lead_grouped');
  const spend = Number(row.spend ?? 0);
  return {
    spend,
    impressoes: Number(row.impressions ?? 0),
    alcance: Number(row.reach ?? 0),
    cliques: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpm: Number(row.cpm ?? 0),
    leads,
    cpl: leads > 0 ? spend / leads : null,
    frequencia: Number(row.frequency ?? 0),
  };
}

function brl(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

function num(n: number | null | undefined, digits = 0) {
  if (n == null || isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

function pct(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '-';
  return `${n.toFixed(2)}%`;
}

// Veredicto pela regra dos 3 periodos: so e RUIM se mal nos 3.
// Aplica aqui apenas no CPL vs cpl_max.
function veredicto3p(c: MetaCampaign): { v: 'saudavel' | 'atencao' | 'critico' | 'sem_dados'; razao: string } {
  const insights = c.last_insights_json;
  if (!insights) return { v: 'sem_dados', razao: 'Sem sync ainda' };
  if (!c.cpl_max) return { v: 'sem_dados', razao: 'Sem CPL maximo definido' };

  const vit = summarize(insights.vitalicio);
  const sev = summarize(insights.ultimos_7d);
  const hj = summarize(insights.hoje);

  const ruim = (s: ReturnType<typeof summarize>) => s?.cpl != null && s.cpl > c.cpl_max! * 2;
  const ok = (s: ReturnType<typeof summarize>) => s?.cpl != null && s.cpl <= c.cpl_max!;

  const ruim3 = ruim(vit) && ruim(sev) && ruim(hj);
  const ok3 = ok(vit) && ok(sev) && ok(hj);

  if (ruim3) return { v: 'critico', razao: `CPL >2x meta nos 3 periodos. Pausar.` };
  if (ok3) return { v: 'saudavel', razao: 'CPL na meta nos 3 periodos. Considere escalar.' };
  return { v: 'atencao', razao: 'CPL misto entre periodos. Aguardar mais dados ou investigar.' };
}

function VeredictoPill({ c }: { c: MetaCampaign }) {
  const { v, razao } = veredicto3p(c);
  const config = {
    saudavel: { Icon: TrendingUp, cls: 'bg-green-50 text-green-700' },
    atencao: { Icon: Minus, cls: 'bg-amber-50 text-amber-700' },
    critico: { Icon: TrendingDown, cls: 'bg-red-50 text-red-700' },
    sem_dados: { Icon: AlertCircle, cls: 'bg-muted text-muted-foreground' },
  }[v];
  const { Icon } = config;
  return (
    <Badge variant="outline" className={cn('gap-1.5 border-0 font-medium', config.cls)} title={razao}>
      <Icon className="h-3 w-3" />
      {v.replace('_', ' ')}
    </Badge>
  );
}

function CampaignRow({ c, onSync, onToggleStatus }: {
  c: MetaCampaign;
  onSync: (id: string) => Promise<void>;
  onToggleStatus: (id: string, activate: boolean) => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try { await onSync(c.id); } finally { setSyncing(false); }
  };

  const handleToggle = async () => {
    setToggling(true);
    try { await onToggleStatus(c.id, c.status === 'paused'); } finally { setToggling(false); }
  };

  const vit = summarize(c.last_insights_json?.vitalicio);
  const sev = summarize(c.last_insights_json?.ultimos_7d);
  const hj = summarize(c.last_insights_json?.hoje);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{c.name}</h3>
              <Badge variant="outline">{c.status}</Badge>
              {c.phase && <Badge variant="outline" className="bg-muted">{c.phase}</Badge>}
              <VeredictoPill c={c} />
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span><code className="text-[10px]">{c.meta_campaign_id}</code></span>
              <span>Adsets: {c.meta_adset_ids?.length ?? 0}</span>
              <span>Ads: {c.meta_ad_ids?.length ?? 0}</span>
              {c.cpl_max && <span>CPL max: {brl(c.cpl_max)}</span>}
              {c.last_synced_at && <span>Sync: {new Date(c.last_synced_at).toLocaleString('pt-BR')}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="ml-1.5 hidden md:inline">Sync</span>
            </Button>
            {c.status !== 'archived' && (
              <Button size="sm" variant={c.status === 'active' ? 'destructive' : 'default'} onClick={handleToggle} disabled={toggling}>
                {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> :
                  c.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span className="ml-1.5 hidden md:inline">{c.status === 'active' ? 'Pausar' : 'Ativar'}</span>
              </Button>
            )}
            <Button asChild size="sm" variant="ghost">
              <a
                href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.meta_campaign_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { label: 'Vitalicio', s: vit },
            { label: 'Ultimos 7d', s: sev },
            { label: 'Hoje', s: hj },
          ].map((p) => (
            <div key={p.label} className="rounded-md border p-3 space-y-1.5">
              <div className="font-semibold text-muted-foreground uppercase text-[10px]">{p.label}</div>
              {p.s ? (
                <>
                  <div className="flex justify-between"><span>Gasto</span><strong>{brl(p.s.spend)}</strong></div>
                  <div className="flex justify-between"><span>Leads</span><strong>{num(p.s.leads)}</strong></div>
                  <div className="flex justify-between"><span>CPL</span>
                    <strong className={cn(
                      c.cpl_max && p.s.cpl && p.s.cpl > c.cpl_max * 2 && 'text-red-600',
                      c.cpl_max && p.s.cpl && p.s.cpl <= c.cpl_max && 'text-green-600',
                    )}>
                      {p.s.cpl ? brl(p.s.cpl) : '-'}
                    </strong>
                  </div>
                  <div className="flex justify-between"><span>CTR</span><strong>{pct(p.s.ctr)}</strong></div>
                  <div className="flex justify-between"><span>CPM</span><strong>{brl(p.s.cpm)}</strong></div>
                  <div className="flex justify-between"><span>Freq</span><strong>{num(p.s.frequencia, 2)}</strong></div>
                </>
              ) : (
                <div className="text-muted-foreground italic">Sem dados</div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MidiaDashboard() {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from('meta_campaigns')
      .select('*')
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Falha lendo campanhas: ' + error.message);
      return;
    }
    setCampaigns(data ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchCampaigns();
      setLoading(false);
    })();
  }, []);

  const syncOne = async (id: string) => {
    const { error } = await supabase.functions.invoke('marketing-meta', {
      body: { action: 'sync_insights', meta_campaign_row_id: id },
    });
    if (error) toast.error('Sync falhou: ' + error.message);
    else toast.success('Sincronizado');
    await fetchCampaigns();
  };

  const syncAll = async () => {
    setSyncingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-meta', {
        body: { action: 'sync_insights' },
      });
      if (error) toast.error('Sync falhou: ' + error.message);
      else toast.success(`Sincronizadas ${data?.synced ?? 0} campanhas`);
      await fetchCampaigns();
    } finally {
      setSyncingAll(false);
    }
  };

  const toggleStatus = async (id: string, activate: boolean) => {
    const { error } = await supabase.functions.invoke('marketing-meta', {
      body: { action: 'set_status', meta_campaign_row_id: id, activate },
    });
    if (error) {
      toast.error('Falha: ' + error.message);
      return;
    }
    toast.success(activate ? 'Campanha ativada no Meta' : 'Campanha pausada no Meta');
    await fetchCampaigns();
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return campaigns;
    return campaigns.filter((c) => c.status === filter);
  }, [campaigns, filter]);

  const summary = useMemo(() => {
    let totalSpend = 0;
    let totalLeads = 0;
    for (const c of campaigns) {
      const vit = summarize(c.last_insights_json?.vitalicio);
      if (vit) {
        totalSpend += vit.spend;
        totalLeads += vit.leads;
      }
    }
    return {
      totalSpend,
      totalLeads,
      totalCpl: totalLeads > 0 ? totalSpend / totalLeads : null,
      active: campaigns.filter((c) => c.status === 'active').length,
      paused: campaigns.filter((c) => c.status === 'paused').length,
    };
  }, [campaigns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dashboard Midia</h1>
            <p className="text-sm text-muted-foreground">
              Campanhas Meta Ads que o CRM subiu via API. Veredicto pela regra dos 3 periodos.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncAll} disabled={syncingAll}>
            {syncingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync todas
          </Button>
          <Button asChild>
            <Link to="/admin/marketing/midia/nova-campanha">
              <Plus className="h-4 w-4 mr-2" />Nova campanha
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase">Ativas</p>
            <p className="text-2xl font-bold">{summary.active}</p>
            <p className="text-xs text-muted-foreground">{summary.paused} pausadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase">Gasto total</p>
            <p className="text-2xl font-bold">{brl(summary.totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase">Leads total</p>
            <p className="text-2xl font-bold">{num(summary.totalLeads)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase">CPL agregado</p>
            <p className="text-2xl font-bold">{summary.totalCpl ? brl(summary.totalCpl) : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {(['all', 'active', 'paused'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Pausadas'}
            <Badge variant="secondary" className="ml-1.5">
              {f === 'all' ? campaigns.length : campaigns.filter((c) => c.status === f).length}
            </Badge>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center space-y-3">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma campanha ainda</p>
            <Button asChild>
              <Link to="/admin/marketing/midia/nova-campanha">Subir primeira campanha</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CampaignRow key={c.id} c={c} onSync={syncOne} onToggleStatus={toggleStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
