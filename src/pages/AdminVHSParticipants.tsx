import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  Target, 
  Search, 
  RefreshCw, 
  Eye, 
  Download, 
  Loader2, 
  Calendar, 
  Monitor, 
  Briefcase, 
  Heart, 
  Star, 
  Send, 
  Webhook,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Participant {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  current_situation: string | null;
  monthly_income: string | null;
  age_range: string | null;
  commitment_level: number | null;
  priority_goal: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  landing_accessed_at: string | null;
  popup_filled_at: string | null;
  payment_confirmed_at: string | null;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  work_hours_weekly: string | null;
  main_frustration: string | null;
  marital_status: string | null;
  has_children: boolean | null;
  children_count: number | null;
  family_dependents: number | null;
  biggest_dream: string | null;
  dream_deadline: string | null;
  what_would_change: string | null;
  dream_income: string | null;
  feels_undervalued: boolean | null;
  salary_covers_bills: boolean | null;
  has_financial_freedom: boolean | null;
  main_pain_points: string[] | null;
  goals_2026: string[] | null;
  why_this_event: string | null;
  expects_from_event: string | null;
  already_knows_ai: boolean | null;
  ai_experience_level: string | null;
  main_doubts: string | null;
}

interface PopupLead {
  id: string;
  name: string;
  whatsapp: string;
  instagram: string | null;
  ddd: string | null;
  estado: string | null;
  cidade: string | null;
  instagram_profile_pic_url: string | null;
  webhook_sent: boolean;
  webhook_sent_at: string | null;
  created_at: string;
  source: string | null;
}

const situationLabels: Record<string, string> = {
  clt: 'CLT',
  autonomo: 'Autônomo',
  empresario: 'Empresário',
  desempregado: 'Desempregado',
  aposentado: 'Aposentado',
  estudante: 'Estudante'
};

const incomeLabels: Record<string, string> = {
  ate_2k: 'Até R$ 2k',
  '2k_5k': 'R$ 2k - 5k',
  '5k_10k': 'R$ 5k - 10k',
  '10k_20k': 'R$ 10k - 20k',
  acima_20k: 'Acima de R$ 20k'
};

const AdminVHSParticipants: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAdminAuth();
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [popupLeads, setPopupLeads] = useState<PopupLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all');
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/admin/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchParticipants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vhs_participants')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setParticipants(data);
    }
    setLoading(false);
  };

  const fetchPopupLeads = async () => {
    setLoadingLeads(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('source', 'vhs_ao_prompt')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPopupLeads(data as PopupLead[]);
    }
    setLoadingLeads(false);
  };

  useEffect(() => {
    if (user) {
      fetchParticipants();
      fetchPopupLeads();

      const channel = supabase
        .channel('vhs_participants_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'vhs_participants' },
          () => fetchParticipants()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleSendWebhook = async (lead: PopupLead) => {
    setSendingWebhook(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-to-iautomatize-vhs', {
        body: {
          name: lead.name,
          whatsapp: lead.whatsapp,
          instagram: lead.instagram || '',
          ddd: lead.ddd || '',
          estado: lead.estado || '',
          cidade: lead.cidade || '',
          source: 'vhs_ao_prompt',
          instagram_profile_pic_url: lead.instagram_profile_pic_url || '',
        }
      });

      if (error) throw error;

      // Mark as sent
      await supabase
        .from('leads')
        .update({ webhook_sent: true, webhook_sent_at: new Date().toISOString() })
        .eq('id', lead.id);

      toast.success(`✅ Webhook disparado para ${lead.name}!`);
      fetchPopupLeads();
    } catch (err: any) {
      toast.error(`❌ Erro ao disparar webhook: ${err.message}`);
    }
    setSendingWebhook(null);
  };

  const handleSendAll = async () => {
    const unsent = popupLeads.filter(l => !l.webhook_sent);
    if (unsent.length === 0) {
      toast.info('Todos os webhooks já foram enviados!');
      return;
    }
    setSendingAll(true);
    let success = 0;
    let fail = 0;
    for (const lead of unsent) {
      try {
        await supabase.functions.invoke('send-to-iautomatize-vhs', {
          body: {
            name: lead.name,
            whatsapp: lead.whatsapp,
            instagram: lead.instagram || '',
            ddd: lead.ddd || '',
            estado: lead.estado || '',
            cidade: lead.cidade || '',
            source: 'vhs_ao_prompt',
            instagram_profile_pic_url: lead.instagram_profile_pic_url || '',
          }
        });
        await supabase
          .from('leads')
          .update({ webhook_sent: true, webhook_sent_at: new Date().toISOString() })
          .eq('id', lead.id);
        success++;
      } catch {
        fail++;
      }
    }
    toast.success(`✅ ${success} webhooks enviados${fail > 0 ? `, ${fail} falharam` : ''}`);
    fetchPopupLeads();
    setSendingAll(false);
  };

  const handleDeleteLead = async (lead: PopupLead) => {
    if (!confirm(`Tem certeza que deseja apagar o lead "${lead.name}"?`)) return;
    try {
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      if (error) throw error;
      toast.success(`🗑️ Lead "${lead.name}" apagado!`);
      fetchPopupLeads();
    } catch (err: any) {
      toast.error(`Erro ao apagar: ${err.message}`);
    }
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.whatsapp.includes(searchTerm);
    
    let matchesFilter = true;
    if (filterStatus === 'completed') matchesFilter = p.onboarding_completed;
    if (filterStatus === 'in_progress') matchesFilter = !p.onboarding_completed && p.onboarding_step > 0;
    if (filterStatus === 'not_started') matchesFilter = p.onboarding_step === 0;

    return matchesSearch && matchesFilter;
  });

  const filteredLeads = popupLeads.filter(l =>
    l.name.toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    l.whatsapp.includes(leadSearchTerm) ||
    (l.instagram || '').toLowerCase().includes(leadSearchTerm.toLowerCase())
  );

  const totalParticipants = participants.length;
  const completedCount = participants.filter(p => p.onboarding_completed).length;
  const inProgressCount = participants.filter(p => !p.onboarding_completed && p.onboarding_step > 0).length;
  const avgCommitment = participants.filter(p => p.commitment_level).reduce((acc, p) => acc + (p.commitment_level || 0), 0) / (completedCount || 1);

  const getStatusBadge = (participant: Participant) => {
    if (participant.onboarding_completed) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Completo</Badge>;
    }
    if (participant.onboarding_step > 0) {
      return <Badge className="bg-yellow/20 text-yellow border-yellow/30">🟡 Step {participant.onboarding_step}/6</Badge>;
    }
    return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">⏳ Não iniciou</Badge>;
  };

  const exportCSV = () => {
    const headers = ['Nome', 'WhatsApp', 'Situação', 'Renda', 'Comprometimento', 'Status', 'Data Inscrição'];
    const rows = participants.map(p => [
      p.name,
      p.whatsapp,
      situationLabels[p.current_situation || ''] || '-',
      incomeLabels[p.monthly_income || ''] || '-',
      p.commitment_level || '-',
      p.onboarding_completed ? 'Completo' : `Step ${p.onboarding_step}/6`,
      format(new Date(p.created_at), 'dd/MM/yyyy HH:mm')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `participantes-vhs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow animate-spin" />
      </div>
    );
  }

  const unsentCount = popupLeads.filter(l => !l.webhook_sent).length;

  return (
    <>
      <Helmet>
        <title>Participantes VHS | Admin + que Vencedores</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Participantes <span className="text-primary">VHS ao Prompt</span>
            </h1>
            <p className="text-muted-foreground text-sm">Acompanhe os inscritos em tempo real</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchParticipants(); fetchPopupLeads(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        <Tabs defaultValue="onboarding" className="w-full">
          <TabsList>
            <TabsTrigger value="onboarding">
              <Users className="w-4 h-4 mr-2" />
              Onboarding ({totalParticipants})
            </TabsTrigger>
            <TabsTrigger value="popup-leads">
              <Webhook className="w-4 h-4 mr-2" />
              Leads Popup ({popupLeads.length})
              {unsentCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">
                  {unsentCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ========== TAB: ONBOARDING ========== */}
          <TabsContent value="onboarding" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">{totalParticipants}</p>
                    <p className="text-muted-foreground text-sm">Total Inscritos</p>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-card border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-3xl font-bold">{completedCount}</p>
                    <p className="text-muted-foreground text-sm">Completo</p>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-card border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">{inProgressCount}</p>
                    <p className="text-muted-foreground text-sm">Em Progresso</p>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-card border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Target className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">{avgCommitment.toFixed(1)}</p>
                    <p className="text-muted-foreground text-sm">Média Comprometimento</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou WhatsApp..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                {(['all', 'completed', 'in_progress', 'not_started'] as const).map(status => (
                  <Button key={status} variant={filterStatus === status ? 'default' : 'outline'}
                    onClick={() => setFilterStatus(status)} size="sm">
                    {status === 'all' && 'Todos'}
                    {status === 'completed' && '✅ Completos'}
                    {status === 'in_progress' && '🟡 Em Progresso'}
                    {status === 'not_started' && '⏳ Não Iniciou'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-card border rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : filteredParticipants.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum participante encontrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Comprometimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Inscrito em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.map(participant => (
                      <TableRow key={participant.id}>
                        <TableCell className="font-medium">{participant.name}</TableCell>
                        <TableCell>{participant.whatsapp}</TableCell>
                        <TableCell>{situationLabels[participant.current_situation || ''] || '-'}</TableCell>
                        <TableCell>
                          {participant.commitment_level ? (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full"
                                  style={{ width: `${(participant.commitment_level / 10) * 100}%` }} />
                              </div>
                              <span className="text-primary font-bold">{participant.commitment_level}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(participant)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(participant.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedParticipant(participant)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* ========== TAB: POPUP LEADS ========== */}
          <TabsContent value="popup-leads" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{popupLeads.length}</p>
                    <p className="text-muted-foreground text-sm">Total Leads</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{popupLeads.filter(l => l.webhook_sent).length}</p>
                    <p className="text-muted-foreground text-sm">Webhooks Enviados</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{unsentCount}</p>
                    <p className="text-muted-foreground text-sm">Pendentes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters + Actions */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, WhatsApp ou Instagram..."
                  value={leadSearchTerm} onChange={(e) => setLeadSearchTerm(e.target.value)} className="pl-10" />
              </div>
              {unsentCount > 0 && (
                <Button onClick={handleSendAll} disabled={sendingAll} variant="default">
                  {sendingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Disparar Todos ({unsentCount})
                </Button>
              )}
            </div>

            {/* Leads Table */}
            <div className="bg-card border rounded-xl overflow-hidden">
              {loadingLeads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum lead encontrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Instagram</TableHead>
                      <TableHead>Região</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Webhook</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map(lead => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {lead.instagram_profile_pic_url && (
                              <img src={lead.instagram_profile_pic_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            )}
                            {lead.name}
                          </div>
                        </TableCell>
                        <TableCell>{lead.whatsapp}</TableCell>
                        <TableCell>
                          {lead.instagram ? (
                            <span className="text-primary">{lead.instagram}</span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {lead.estado ? `${lead.cidade || ''} - ${lead.estado}` : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(lead.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {lead.webhook_sent ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              ✅ Enviado
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                              ❌ Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant={lead.webhook_sent ? 'ghost' : 'default'}
                              size="sm"
                              onClick={() => handleSendWebhook(lead)}
                              disabled={sendingWebhook === lead.id}
                              title="Disparar webhook"
                            >
                              {sendingWebhook === lead.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLead(lead)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Apagar lead"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Detail Modal */}
        <Dialog open={!!selectedParticipant} onOpenChange={() => setSelectedParticipant(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-3">
                <span className="text-primary">{selectedParticipant?.name}</span>
                {selectedParticipant && getStatusBadge(selectedParticipant)}
              </DialogTitle>
            </DialogHeader>

            {selectedParticipant && (
              <div className="space-y-6 mt-4">
                {/* Journey Timeline */}
                <div className="bg-muted/50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Jornada do Lead
                  </h4>
                  <div className="space-y-3 text-sm">
                    {selectedParticipant.landing_accessed_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-muted-foreground">Acessou Landing Page:</span>
                        <span>{format(new Date(selectedParticipant.landing_accessed_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                      </div>
                    )}
                    {selectedParticipant.popup_filled_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-muted-foreground">Preencheu Popup:</span>
                        <span>{format(new Date(selectedParticipant.popup_filled_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                      </div>
                    )}
                    {selectedParticipant.payment_confirmed_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-muted-foreground">Pagamento Confirmado:</span>
                        <span>{format(new Date(selectedParticipant.payment_confirmed_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                      </div>
                    )}
                    {selectedParticipant.onboarding_started_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        <span className="text-muted-foreground">Iniciou Onboarding:</span>
                        <span>{format(new Date(selectedParticipant.onboarding_started_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                      </div>
                    )}
                    {selectedParticipant.onboarding_completed_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-muted-foreground">Completou Onboarding:</span>
                        <span>{format(new Date(selectedParticipant.onboarding_completed_at), "dd/MM/yyyy 'às' HH:mm")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Professional Info */}
                <div className="bg-muted/50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" />
                    Momento Profissional
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Situação:</span><p>{situationLabels[selectedParticipant.current_situation || ''] || '-'}</p></div>
                    <div><span className="text-muted-foreground">Renda:</span><p>{incomeLabels[selectedParticipant.monthly_income || ''] || '-'}</p></div>
                    <div><span className="text-muted-foreground">Horas/Semana:</span><p>{selectedParticipant.work_hours_weekly || '-'}</p></div>
                    <div><span className="text-muted-foreground">Frustração:</span><p>{selectedParticipant.main_frustration || '-'}</p></div>
                  </div>
                </div>

                {/* Personal Info */}
                <div className="bg-muted/50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-primary" />
                    Vida Pessoal
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Idade:</span><p>{selectedParticipant.age_range || '-'}</p></div>
                    <div><span className="text-muted-foreground">Estado Civil:</span><p>{selectedParticipant.marital_status || '-'}</p></div>
                    <div><span className="text-muted-foreground">Filhos:</span><p>{selectedParticipant.has_children ? `Sim, ${selectedParticipant.children_count}` : 'Não'}</p></div>
                    <div><span className="text-muted-foreground">Dependentes:</span><p>{selectedParticipant.family_dependents ?? '-'}</p></div>
                  </div>
                </div>

                {/* Dreams */}
                <div className="bg-muted/50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" />
                    Sonhos e Objetivos
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div><span className="text-muted-foreground">Maior Sonho:</span><p>{selectedParticipant.biggest_dream || '-'}</p></div>
                    <div><span className="text-muted-foreground">Salário Merecido:</span><p className="text-primary font-bold">R$ {selectedParticipant.dream_income || '-'}</p></div>
                    <div><span className="text-muted-foreground">Objetivo Prioritário:</span><p>{selectedParticipant.priority_goal || '-'}</p></div>
                    <div><span className="text-muted-foreground">Comprometimento:</span><p className="text-primary font-bold text-2xl">{selectedParticipant.commitment_level}/10</p></div>
                  </div>
                </div>

                {/* Pain Points */}
                {selectedParticipant.main_pain_points && selectedParticipant.main_pain_points.length > 0 && (
                  <div className="bg-muted/50 border rounded-xl p-4">
                    <h4 className="font-semibold mb-4">💔 Dores</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedParticipant.main_pain_points.map((pain, i) => (
                        <Badge key={i} variant="outline" className="border-red-500/30 text-red-400">{pain}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Goals 2026 */}
                {selectedParticipant.goals_2026 && selectedParticipant.goals_2026.length > 0 && (
                  <div className="bg-muted/50 border rounded-xl p-4">
                    <h4 className="font-semibold mb-4">🎯 Objetivos 2026</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedParticipant.goals_2026.map((goal, i) => (
                        <Badge key={i} variant="outline" className="border-primary/30 text-primary">{goal}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expectations */}
                <div className="bg-muted/50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-primary" />
                    Expectativas
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div><span className="text-muted-foreground">O que espera aprender:</span><p>{selectedParticipant.expects_from_event || '-'}</p></div>
                    <div><span className="text-muted-foreground">Nível de IA:</span><p>{selectedParticipant.ai_experience_level || '-'}</p></div>
                    <div><span className="text-muted-foreground">Maior dúvida:</span><p>{selectedParticipant.main_doubts || '-'}</p></div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AdminVHSParticipants;
