import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Copy, Check, Trash2, Search, 
  Plus, Instagram, Phone, ArrowLeft,
  Building2, Clock, CheckCircle2, AlertCircle, LogOut, Eye, UserPlus, QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { ClientDetailModal } from '@/components/admin/ClientDetailModal';
import { StatsCards } from '@/components/admin/StatsCards';
import { CreateManualOnboardingModal } from '@/components/admin/CreateManualOnboardingModal';
import { OnboardingSuccessModal } from '@/components/admin/OnboardingSuccessModal';
import { QRCodeModal } from '@/components/admin/QRCodeModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Lead {
  id: string;
  name: string;
  instagram: string | null;
  whatsapp: string;
  instagram_profile_pic_url: string | null;
  created_at: string;
}

interface Client {
  id: string;
  lead_id: string;
  company_name: string;
  responsible_name: string;
  onboarding_token: string;
  onboarding_step: number;
  status: string;
  created_at: string;
}

interface LeadWithClient extends Lead {
  client?: Client;
}

interface ClientFullData {
  client: any;
  audience: any;
  products: any;
  branding: any;
  operations: any;
  policies: any;
  goals: any;
  materials: any;
  technical: any;
  expansion: any;
}

export default function AdminOnboarding() {
  const { user, loading: authLoading, signOut } = useAdminAuth();
  const [leads, setLeads] = useState<LeadWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithClient | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [clientFullData, setClientFullData] = useState<ClientFullData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [manualOnboardingModalOpen, setManualOnboardingModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdOnboardingLink, setCreatedOnboardingLink] = useState('');
  const [createdOnboardingToken, setCreatedOnboardingToken] = useState('');
  const [qrCodeModalOpen, setQrCodeModalOpen] = useState(false);
  const [selectedClientForQR, setSelectedClientForQR] = useState<{ link: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchLeadsWithClients();
    }
  }, [user]);

  async function fetchLeadsWithClients() {
    try {
      // Buscar todos os leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Buscar todos os clientes
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*');

      if (clientsError) throw clientsError;

      // Mapear leads com seus clientes
      const leadsWithClients: LeadWithClient[] = (leadsData || []).map((lead) => ({
        ...lead,
        client: clientsData?.find((c) => c.lead_id === lead.id),
      }));

      setLeads(leadsWithClients);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function createOnboarding(lead: LeadWithClient) {
    if (!newCompanyName.trim()) {
      toast.error('Digite o nome da empresa');
      return;
    }

    setCreating(true);
    try {
      const token = `${lead.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      const { error } = await supabase.from('clients').insert({
        lead_id: lead.id,
        company_name: newCompanyName,
        responsible_name: lead.name,
        onboarding_token: token,
        status: 'pending',
        onboarding_step: 1,
      });

      if (error) throw error;

      toast.success('Link de onboarding criado!');
      setCreateDialogOpen(false);
      setNewCompanyName('');
      setSelectedLead(null);
      fetchLeadsWithClients();
    } catch (err) {
      console.error('Erro ao criar onboarding:', err);
      toast.error('Erro ao criar onboarding');
    } finally {
      setCreating(false);
    }
  }

  async function deleteOnboarding(client: Client) {
    try {
      // Deletar dados relacionados primeiro
      const tables = [
        'client_audience',
        'client_branding',
        'client_expansion',
        'client_goals',
        'client_materials',
        'client_operations',
        'client_policies',
        'client_products',
        'client_technical',
      ];

      for (const table of tables) {
        await supabase.from(table as any).delete().eq('client_id', client.id);
      }

      // Deletar o cliente
      const { error } = await supabase.from('clients').delete().eq('id', client.id);

      if (error) throw error;

      toast.success('Onboarding excluído!');
      setDeleteDialogOpen(false);
      setSelectedLead(null);
      fetchLeadsWithClients();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast.error('Erro ao excluir onboarding');
    }
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/onboarding/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function fetchClientDetails(lead: LeadWithClient) {
    if (!lead.client) return;
    
    setLoadingDetails(true);
    setSelectedLead(lead);
    setDetailModalOpen(true);
    
    try {
      const clientId = lead.client.id;
      
      const [audience, products, branding, operations, policies, goals, materials, technical, expansion] = await Promise.all([
        supabase.from('client_audience').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_products').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_branding').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_operations').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_policies').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_goals').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_materials').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_technical').select('*').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_expansion').select('*').eq('client_id', clientId).maybeSingle(),
      ]);

      setClientFullData({
        client: lead.client,
        audience: audience.data,
        products: products.data,
        branding: branding.data,
        operations: operations.data,
        policies: policies.data,
        goals: goals.data,
        materials: materials.data,
        technical: technical.data,
        expansion: expansion.data,
      });
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
      toast.error('Erro ao carregar detalhes do cliente');
    } finally {
      setLoadingDetails(false);
    }
  }

  const stats = {
    totalLeads: leads.length,
    totalClients: leads.filter(l => l.client).length,
    completed: leads.filter(l => l.client?.status === 'completed').length,
    inProgress: leads.filter(l => l.client?.status === 'in_progress').length,
    pending: leads.filter(l => l.client?.status === 'pending').length,
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.instagram?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.whatsapp.includes(searchTerm) ||
      lead.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (client?: Client) => {
    if (!client) return null;
    
    switch (client.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            Concluído
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
            <Clock className="w-3 h-3" />
            Em andamento ({client.onboarding_step}/12)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            Pendente
          </span>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gerenciar Onboardings
          </h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} leads • {leads.filter((l) => l.client).length} com onboarding
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setManualOnboardingModalOpen(true)}
          className="gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Novo Onboarding
        </Button>
      </div>

      <div className="space-y-6">
        {/* Stats Cards */}
        <StatsCards {...stats} />

        {/* Search */}
        <div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, Instagram, WhatsApp ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Leads Grid */}
        <div className="grid gap-4">
          <AnimatePresence>
            {filteredLeads.map((lead, index) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {lead.instagram_profile_pic_url ? (
                      <img
                        src={lead.instagram_profile_pic_url}
                        alt={lead.name}
                        className="w-14 h-14 rounded-full border-2 border-primary/30 object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          {lead.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-foreground truncate">{lead.name}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {lead.instagram && (
                            <span className="inline-flex items-center gap-1">
                              <Instagram className="w-3 h-3" />
                              {lead.instagram.replace('@', '')}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.whatsapp}
                          </span>
                        </div>
                        
                        {lead.client && (
                          <div className="mt-2 flex items-center gap-2">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{lead.client.company_name}</span>
                            {getStatusBadge(lead.client)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {lead.client ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyLink(lead.client!.onboarding_token)}
                              className="gap-1"
                            >
                              {copiedToken === lead.client.onboarding_token ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                              Copiar Link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = `${window.location.origin}/onboarding/${lead.client!.onboarding_token}`;
                                setSelectedClientForQR({ link, name: lead.client!.company_name });
                                setQrCodeModalOpen(true);
                              }}
                              title="Ver QR Code"
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchClientDetails(lead)}
                              disabled={loadingDetails}
                              title="Ver Detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLead(lead);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedLead(lead);
                              setNewCompanyName('');
                              setCreateDialogOpen(true);
                            }}
                            className="gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Criar Onboarding
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead encontrado
            </div>
          )}
        </div>
      </div>

      {/* Create Onboarding Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Link de Onboarding</DialogTitle>
            <DialogDescription>
              Crie um link único de onboarding para {selectedLead?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              {selectedLead?.instagram_profile_pic_url ? (
                <img
                  src={selectedLead.instagram_profile_pic_url}
                  alt={selectedLead.name}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {selectedLead?.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">{selectedLead?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedLead?.instagram}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Nome da Empresa *
              </label>
              <Input
                placeholder="Ex: Clínica São Lucas"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => selectedLead && createOnboarding(selectedLead)}
              disabled={creating || !newCompanyName.trim()}
            >
              {creating ? 'Criando...' : 'Criar Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente o onboarding e todos os dados preenchidos de{' '}
              <strong>{selectedLead?.client?.company_name}</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedLead?.client && deleteOnboarding(selectedLead.client)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Detail Modal */}
      <ClientDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setClientFullData(null);
        }}
        data={clientFullData}
        lead={selectedLead}
      />

      {/* Manual Onboarding Modal */}
      <CreateManualOnboardingModal
        open={manualOnboardingModalOpen}
        onClose={() => setManualOnboardingModalOpen(false)}
        onSuccess={(link, token) => {
          setManualOnboardingModalOpen(false);
          setCreatedOnboardingLink(link);
          setCreatedOnboardingToken(token);
          setSuccessModalOpen(true);
          fetchLeadsWithClients();
        }}
      />

      {/* Success Modal with QR Code */}
      <OnboardingSuccessModal
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        link={createdOnboardingLink}
        token={createdOnboardingToken}
      />

      {/* QR Code Modal for existing clients */}
      <QRCodeModal
        open={qrCodeModalOpen}
        onClose={() => {
          setQrCodeModalOpen(false);
          setSelectedClientForQR(null);
        }}
        link={selectedClientForQR?.link || ''}
        clientName={selectedClientForQR?.name || ''}
      />
    </div>
  );
}
