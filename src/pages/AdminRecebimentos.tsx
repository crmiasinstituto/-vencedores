import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  LogOut, DollarSign, Calendar, AlertTriangle, CheckCircle, 
  Plus, Eye, Trash2, RefreshCw, FileText, CreditCard, Edit2, Send, X, Check, Settings
} from 'lucide-react';

interface Client {
  id: string;
  company_name: string;
  responsible_name: string;
  lead_id?: string;
  whatsapp?: string;
}

interface Contract {
  id: string;
  client_id: string;
  service_name: string;
  setup_value: number;
  setup_paid: boolean;
  setup_payment_date: string | null;
  monthly_value: number;
  due_day: number;
  contract_date: string;
  status: string;
  notes: string | null;
  client?: Client;
}

interface Payment {
  id: string;
  contract_id: string;
  value: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  month_reference: string;
  webhook_sent: boolean;
}

export default function AdminRecebimentos() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAdminAuth();
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewContract, setShowNewContract] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [monthsToGenerate, setMonthsToGenerate] = useState(12);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('squaad_webhook_url') || 'https://app.iautomatize.me/api/iwh/';
  });
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    client_id: '',
    service_name: '',
    setup_value: '',
    monthly_value: '',
    due_day: '10',
    contract_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/admin/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, company_name, responsible_name')
        .order('company_name');
      
      setClients(clientsData || []);

      // Load contracts with client info
      const { data: contractsData } = await supabase
        .from('client_contracts')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch client info for each contract including WhatsApp from leads
      const contractsWithClients = await Promise.all(
        (contractsData || []).map(async (contract) => {
          if (contract.client_id) {
            const { data: client } = await supabase
              .from('clients')
              .select('id, company_name, responsible_name, lead_id')
              .eq('id', contract.client_id)
              .maybeSingle();
            
            // Fetch WhatsApp from leads if lead_id exists
            let whatsapp = '';
            if (client?.lead_id) {
              const { data: lead } = await supabase
                .from('leads')
                .select('whatsapp')
                .eq('id', client.lead_id)
                .maybeSingle();
              whatsapp = lead?.whatsapp || '';
            }
            
            return { ...contract, client: { ...client, whatsapp } };
          }
          return contract;
        })
      );

      setContracts(contractsWithClients);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPayments = async (contractId: string) => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('due_date', { ascending: true });
    
    setPayments(data || []);
  };

  const handleCreateContract = async () => {
    if (!formData.client_id || !formData.service_name || !formData.monthly_value) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const { error } = await supabase
        .from('client_contracts')
        .insert({
          client_id: formData.client_id,
          service_name: formData.service_name,
          setup_value: parseFloat(formData.setup_value) || 0,
          monthly_value: parseFloat(formData.monthly_value),
          due_day: parseInt(formData.due_day),
          contract_date: formData.contract_date,
          notes: formData.notes || null
        });

      if (error) throw error;

      toast.success('Contrato criado com sucesso!');
      setShowNewContract(false);
      setFormData({
        client_id: '',
        service_name: '',
        setup_value: '',
        monthly_value: '',
        due_day: '10',
        contract_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      loadData();
    } catch (error: any) {
      toast.error('Erro ao criar contrato: ' + error.message);
    }
  };

  const handleMarkSetupPaid = async (contract: Contract) => {
    try {
      await supabase
        .from('client_contracts')
        .update({ 
          setup_paid: true, 
          setup_payment_date: new Date().toISOString().split('T')[0] 
        })
        .eq('id', contract.id);

      toast.success('Setup marcado como pago!');
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleMarkPaymentPaid = async (payment: Payment) => {
    try {
      await supabase
        .from('payments')
        .update({ 
          status: 'paid', 
          payment_date: new Date().toISOString().split('T')[0] 
        })
        .eq('id', payment.id);

      toast.success('Parcela marcada como paga!');
      if (selectedContract) loadPayments(selectedContract.id);
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleGeneratePayments = async () => {
    if (!selectedContract) return;

    try {
      const response = await supabase.functions.invoke('generate-monthly-payments', {
        body: {
          contract_id: selectedContract.id,
          months_count: monthsToGenerate
        }
      });

      if (response.error) throw response.error;

      toast.success(`${response.data.created} parcelas geradas!`);
      if (selectedContract) loadPayments(selectedContract.id);
    } catch (error: any) {
      toast.error('Erro ao gerar parcelas: ' + error.message);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Tem certeza que deseja excluir este contrato e todas as parcelas?')) return;

    try {
      await supabase.from('client_contracts').delete().eq('id', contractId);
      toast.success('Contrato excluído!');
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const handleStartEdit = (payment: Payment) => {
    setEditingPayment(payment.id);
    setEditValue(String(payment.value));
    setEditDueDate(payment.due_date);
  };

  const handleCancelEdit = () => {
    setEditingPayment(null);
    setEditValue('');
    setEditDueDate('');
  };

  const handleSaveEdit = async (paymentId: string) => {
    try {
      await supabase
        .from('payments')
        .update({ 
          value: parseFloat(editValue),
          due_date: editDueDate
        })
        .eq('id', paymentId);

      toast.success('Parcela atualizada!');
      setEditingPayment(null);
      if (selectedContract) loadPayments(selectedContract.id);
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleSaveWebhookUrl = () => {
    localStorage.setItem('squaad_webhook_url', webhookUrl);
    toast.success('URL do Webhook salva!');
    setShowWebhookConfig(false);
  };

  const handleTriggerWebhook = async (payment: Payment) => {
    if (!webhookUrl || webhookUrl === 'https://app.iautomatize.me/api/iwh/') {
      toast.error('Configure a URL do Webhook primeiro!');
      setShowWebhookConfig(true);
      return;
    }

    try {
      const contract = selectedContract;
      if (!contract) return;

      const payload = {
        evento: "vencimento_parcela",
        timestamp: new Date().toISOString(),
        contrato: {
          id: contract.id,
          servico: contract.service_name,
          valor_mensalidade: contract.monthly_value
        },
        cliente: {
          nome: contract.client?.company_name,
          responsavel: contract.client?.responsible_name,
          whatsapp: contract.client?.whatsapp || ""
        },
        parcela: {
          id: payment.id,
          valor: payment.value,
          vencimento: payment.due_date,
          referencia: payment.month_reference,
          status: payment.status
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      await supabase
        .from('payments')
        .update({ 
          webhook_sent: true, 
          webhook_sent_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      toast.success('Webhook disparado com sucesso!');
      if (selectedContract) loadPayments(selectedContract.id);
    } catch (error: any) {
      toast.error('Erro ao disparar webhook: ' + error.message);
    }
  };

  const handleCheckDuePayments = async () => {
    try {
      const response = await supabase.functions.invoke('check-payment-due');
      if (response.error) throw response.error;
      toast.success(`Verificação concluída! ${response.data.processed} pagamentos processados.`);
      loadData();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  // Stats calculations
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const pendingSetups = contracts.filter(c => !c.setup_paid && c.setup_value > 0).length;
  const totalMonthlyRevenue = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (c.monthly_value || 0), 0);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      paid: 'bg-green-500/20 text-green-400 border-green-500/30',
      overdue: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400';
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Webhook Config Dialog */}
      <Dialog open={showWebhookConfig} onOpenChange={setShowWebhookConfig}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">⚙️ Configurar Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">URL do Webhook (iAutomatize)</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://app.iautomatize.me/api/iwh/SEU_ID"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Cole a URL completa do webhook do iAutomatize para receber notificações de vencimento.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowWebhookConfig(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveWebhookUrl}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">💰 Recebimentos</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowWebhookConfig(true)}>
          <Settings className="w-4 h-4 mr-2" /> Webhook
        </Button>
      </div>

      <div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contratos Ativos</p>
                  <p className="text-2xl font-bold text-foreground">{activeContracts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Mensal</p>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {totalMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Setups Pendentes</p>
                  <p className="text-2xl font-bold text-foreground">{pendingSetups}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/40">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <CreditCard className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                  <p className="text-2xl font-bold text-foreground">{clients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Dialog open={showNewContract} onOpenChange={setShowNewContract}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Novo Contrato
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Criar Novo Contrato</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Cliente *</Label>
                  <Select value={formData.client_id} onValueChange={(v) => setFormData({...formData, client_id: v})}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name} - {client.responsible_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Serviço Contratado *</Label>
                  <Input
                    value={formData.service_name}
                    onChange={(e) => setFormData({...formData, service_name: e.target.value})}
                    placeholder="Ex: IA de Atendimento"
                    className="bg-background border-border"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Setup (R$)</Label>
                    <Input
                      type="number"
                      value={formData.setup_value}
                      onChange={(e) => setFormData({...formData, setup_value: e.target.value})}
                      placeholder="0,00"
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Label>Mensalidade (R$) *</Label>
                    <Input
                      type="number"
                      value={formData.monthly_value}
                      onChange={(e) => setFormData({...formData, monthly_value: e.target.value})}
                      placeholder="997,00"
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Dia de Vencimento *</Label>
                    <Select value={formData.due_day} onValueChange={(v) => setFormData({...formData, due_day: v})}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                          <SelectItem key={day} value={String(day)}>Dia {day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data de Contratação</Label>
                    <Input
                      type="date"
                      value={formData.contract_date}
                      onChange={(e) => setFormData({...formData, contract_date: e.target.value})}
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Notas adicionais..."
                    className="bg-background border-border"
                  />
                </div>

                <Button onClick={handleCreateContract} className="w-full bg-primary text-primary-foreground">
                  Criar Contrato
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleCheckDuePayments}>
            <RefreshCw className="w-4 h-4 mr-2" /> Verificar Vencimentos
          </Button>
        </div>

        {/* Contracts Table */}
        <Card className="bg-card/50 border-border/40">
          <CardHeader>
            <CardTitle className="text-foreground">Contratos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(contract => (
                  <TableRow key={contract.id} className="border-border/40">
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{contract.client?.company_name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{contract.client?.responsible_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{contract.service_name}</TableCell>
                    <TableCell>
                      {contract.setup_value > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">
                            R$ {contract.setup_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {contract.setup_paid ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle className="w-3 h-3 mr-1" /> Pago
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleMarkSetupPaid(contract)}>
                              Marcar Pago
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground">
                      R$ {contract.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-foreground">Dia {contract.due_day}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(contract.status)}>
                        {contract.status === 'active' ? 'Ativo' : contract.status === 'cancelled' ? 'Cancelado' : 'Pausado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedContract(contract);
                            loadPayments(contract.id);
                            setShowPayments(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteContract(contract.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {contracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum contrato cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payments Modal */}
        <Dialog open={showPayments} onOpenChange={setShowPayments}>
          <DialogContent className="bg-card border-border max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Parcelas - {selectedContract?.client?.company_name || 'Cliente'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Generate payments */}
              <div className="flex items-center gap-4 p-4 bg-background/50 rounded-lg border border-border/40">
                <Label>Gerar próximos</Label>
                <Select value={String(monthsToGenerate)} onValueChange={(v) => setMonthsToGenerate(parseInt(v))}>
                  <SelectTrigger className="w-24 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 6, 12, 24].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} meses</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleGeneratePayments} className="bg-primary text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" /> Gerar Parcelas
                </Button>
              </div>

              {/* Payments list */}
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead>Referência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Webhook</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow key={payment.id} className="border-border/40">
                      <TableCell className="text-foreground font-medium">{payment.month_reference}</TableCell>
                      <TableCell className="text-foreground">
                        {editingPayment === payment.id ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-28 bg-background border-border"
                          />
                        ) : (
                          `R$ ${payment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {editingPayment === payment.id ? (
                          <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="w-36 bg-background border-border"
                          />
                        ) : (
                          new Date(payment.due_date).toLocaleDateString('pt-BR')
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {payment.payment_date 
                          ? new Date(payment.payment_date).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(payment.status)}>
                          {payment.status === 'pending' ? 'Pendente' : payment.status === 'paid' ? 'Pago' : 'Atrasado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.webhook_sent ? (
                          <Badge className="bg-blue-500/20 text-blue-400">Enviado</Badge>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300"
                            onClick={() => handleTriggerWebhook(payment)}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingPayment === payment.id ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-green-400 hover:text-green-300"
                                onClick={() => handleSaveEdit(payment.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleStartEdit(payment)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {payment.status !== 'paid' && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleMarkPaymentPaid(payment)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" /> Pago
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma parcela gerada. Clique em "Gerar Parcelas" acima.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
