import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Users, Trophy, DollarSign, Target, Phone, CheckCircle2, TrendingUp,
  Medal, Plus, Mail, RefreshCw, Loader2, Crown,
} from 'lucide-react';

const db = supabase as any;

type Period = '7d' | '30d' | 'all';

interface TeamMemberStats {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  leads_count: number;
  meetings_count: number;
  meetings_completed: number;
  revenue: number;
  pipeline_value: number;
  conversion_rate: number;
  no_show_rate: number;
}

export default function AdminEquipe() {
  const [period, setPeriod] = useState<Period>('30d');
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<TeamMemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'sdr' });

  const periodStart = useMemo(() => {
    if (period === 'all') return new Date(0);
    return new Date(Date.now() - (period === '7d' ? 7 : 30) * 86400_000);
  }, [period]);

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    const [tmRes, leadsRes, meetingsRes, paymentsRes, contractsRes] = await Promise.all([
      db.from('team_members').select('*').eq('is_active', true).order('name'),
      db.from('crm_leads').select('id, assigned_to, column_id, potential_value, deal_value, closed_at').gte('updated_at', periodStart.toISOString()),
      db.from('meetings').select('id, lead_id, status, started_at, ended_at, metadata').gte('created_at', periodStart.toISOString()),
      db.from('member_payments').select('value, paid_value, status, paid_at, member_id').eq('status', 'paid').gte('paid_at', periodStart.toISOString()),
      db.from('member_contracts').select('id, crm_lead_id, member_id, total_value'),
    ]);

    setMembers(tmRes.data || []);

    const team: TeamMemberStats[] = (tmRes.data || []).map((tm: any) => {
      const myLeads = (leadsRes.data || []).filter((l: any) => l.assigned_to === tm.id);
      const myLeadIds = new Set(myLeads.map((l: any) => l.id));
      const myMeetings = (meetingsRes.data || []).filter((m: any) => myLeadIds.has(m.lead_id));
      const completed = myMeetings.filter((m: any) => m.started_at);
      // Revenue: contracts linked to my leads, summed by paid payments
      const myContracts = (contractsRes.data || []).filter((c: any) => myLeadIds.has(c.crm_lead_id));
      const myMemberIds = new Set(myContracts.map((c: any) => c.member_id));
      const revenue = (paymentsRes.data || [])
        .filter((p: any) => myMemberIds.has(p.member_id))
        .reduce((s: number, p: any) => s + Number(p.paid_value || p.value || 0), 0);
      const pipelineValue = myLeads.reduce((s: number, l: any) => s + Number(l.deal_value || l.potential_value || 0), 0);
      const closed = myLeads.filter((l: any) => l.closed_at).length;
      const conversionRate = myLeads.length ? (closed / myLeads.length) * 100 : 0;
      const noShowRate = myMeetings.length ? ((myMeetings.length - completed.length) / myMeetings.length) * 100 : 0;
      return {
        id: tm.id, name: tm.name, email: tm.email, avatar_url: tm.avatar_url, role: tm.role,
        leads_count: myLeads.length,
        meetings_count: myMeetings.length,
        meetings_completed: completed.length,
        revenue, pipeline_value: pipelineValue,
        conversion_rate: conversionRate, no_show_rate: noShowRate,
      };
    }).sort((a: TeamMemberStats, b: TeamMemberStats) => b.revenue - a.revenue || b.leads_count - a.leads_count);

    setStats(team);
    setLoading(false);
  };

  const saveMember = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatorio'); return; }
    try {
      await db.from('team_members').insert({
        name: form.name.trim(), email: form.email.trim() || null,
        phone: form.phone.trim() || null, role: form.role, is_active: true,
      });
      toast.success('Membro adicionado');
      setShowAddDialog(false);
      setForm({ name: '', email: '', phone: '', role: 'sdr' });
      load();
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const totals = useMemo(() => ({
    leads: stats.reduce((s, t) => s + t.leads_count, 0),
    meetings: stats.reduce((s, t) => s + t.meetings_count, 0),
    revenue: stats.reduce((s, t) => s + t.revenue, 0),
    pipeline: stats.reduce((s, t) => s + t.pipeline_value, 0),
  }), [stats]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Equipe
          </h1>
          <p className="text-sm text-muted-foreground">Ranking, performance individual e atribuicao de leads.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar membro
          </Button>
        </div>
      </div>

      {loading && <p className="text-xs text-muted-foreground"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Carregando...</p>}

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-blue-500" /><p className="text-xs text-muted-foreground">Leads atribuidos</p></div>
          <p className="text-2xl font-bold">{totals.leads}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Phone className="w-4 h-4 text-purple-500" /><p className="text-xs text-muted-foreground">Calls realizadas</p></div>
          <p className="text-2xl font-bold">{totals.meetings}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><p className="text-xs text-muted-foreground">Receita da equipe</p></div>
          <p className="text-2xl font-bold">R$ {totals.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Pipeline em aberto</p></div>
          <p className="text-2xl font-bold">R$ {totals.pipeline.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
      </div>

      {/* Ranking */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <p className="text-sm font-bold">Ranking da equipe</p>
            <span className="text-xs text-muted-foreground">(ordenado por receita gerada)</span>
          </div>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum membro cadastrado ainda. Clique em "Adicionar membro".
            </p>
          ) : (
            <div className="space-y-2">
              {stats.map((tm, i) => (
                <div key={tm.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{
                    backgroundColor: i === 0 ? '#3B82F6' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#404040',
                    color: i < 3 ? '#000' : '#fff',
                  }}>
                    {i === 0 ? <Crown className="w-4 h-4" /> : i < 3 ? <Medal className="w-4 h-4" /> : `#${i + 1}`}
                  </div>
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={tm.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/15 text-primary text-sm">
                      {(tm.name || '').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{tm.name}</p>
                      {tm.role && <Badge variant="outline" className="text-[9px] uppercase">{tm.role}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span>{tm.leads_count} leads</span>
                      <span>{tm.meetings_count} calls ({tm.meetings_completed} compareceram)</span>
                      <span className={tm.conversion_rate >= 20 ? 'text-green-500 font-semibold' : ''}>{tm.conversion_rate.toFixed(1)}% conversao</span>
                      {tm.no_show_rate > 0 && <span className={tm.no_show_rate >= 30 ? 'text-red-400' : 'text-yellow-400'}>{tm.no_show_rate.toFixed(0)}% no-show</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-green-500">R$ {tm.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-muted-foreground">pipeline R$ {tm.pipeline_value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add member dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo membro da equipe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="cs">Customer Success</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveMember}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
