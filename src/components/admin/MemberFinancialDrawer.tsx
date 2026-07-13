import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2, Undo2, Plus, Trash2, Save, Loader2, Send,
  CreditCard, Calendar, AlertTriangle, Bell, X, FileSignature, Download,
} from 'lucide-react';

interface Props {
  memberId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartao Credito' },
  { value: 'cartao_debito', label: 'Cartao Debito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'paid', label: 'Pago' },
  { value: 'overdue', label: 'Em Atraso' },
  { value: 'cancelled', label: 'Cancelado' },
];

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function brl(n: number) {
  return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SIG_LABEL: Record<string, { text: string; cls: string }> = {
  pending_data: { text: 'Aguardando dados do aluno', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  ready_to_sign: { text: 'Pronto para assinar', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  signed: { text: 'Assinado', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

export function MemberFinancialDrawer({ memberId, open, onOpenChange, onChanged }: Props) {
  const [member, setMember] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [contractDraft, setContractDraft] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState<any>({
    installment_number: 1,
    value: '',
    due_date: new Date().toISOString().slice(0, 10),
    payment_method: 'pix',
    status: 'pending',
    notes: '',
  });

  // Baixa (integral ou parcial) — dialog com saldo negativo
  const [baixaPayment, setBaixaPayment] = useState<any>(null);
  const [baixaValue, setBaixaValue] = useState('');
  const [baixaDate, setBaixaDate] = useState(new Date().toISOString().slice(0, 10));
  const [baixaMethod, setBaixaMethod] = useState('pix');
  const [baixaNextDue, setBaixaNextDue] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (open && memberId) load();
    else {
      setDrafts({});
      setContractDraft({});
    }
  }, [open, memberId]);

  async function load() {
    if (!memberId) return;
    setLoading(true);
    try {
      const [{ data: m }, { data: c }, { data: p }] = await Promise.all([
        (supabase as any).from('members').select('id, name, email, phone, status, program, cpf, rg, birth_date, nationality, marital_status, profession, address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state').eq('id', memberId).maybeSingle(),
        (supabase as any).from('member_contracts').select('*').eq('member_id', memberId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from('member_payments').select('*').eq('member_id', memberId).order('installment_number', { ascending: true }).order('due_date', { ascending: true }),
      ]);
      setMember(m);
      setContract(c);
      setContractDraft(c || {});
      setPayments(p || []);
    } catch (e: any) {
      toast.error('Erro ao carregar: ' + (e?.message || ''));
    }
    setLoading(false);
  }

  const totals = useMemo(() => {
    const receivable = payments.filter(p => p.status !== 'cancelled').reduce((s, p) => {
      const v = parseFloat(p.value) || 0;
      const paid = parseFloat(p.paid_value) || 0;
      const due = p.status === 'paid' ? Math.max(0, v - paid) : v;
      return s + due;
    }, 0);
    const received = payments.filter(p => parseFloat(p.paid_value) > 0).reduce((s, p) => s + (parseFloat(p.paid_value) || 0), 0);
    const overdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
    const pending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
    return { receivable, received, overdue, pending };
  }, [payments]);

  function draftFor(p: any) {
    return drafts[p.id] ? { ...p, ...drafts[p.id] } : p;
  }

  function setField(id: string, field: string, value: any) {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  }

  const hasChanges = (id: string) => !!drafts[id] && Object.keys(drafts[id]).length > 0;

  async function savePayment(p: any) {
    if (!hasChanges(p.id)) return;
    setSavingId(p.id);
    try {
      const patch = drafts[p.id];
      if ('value' in patch) patch.value = parseFloat(String(patch.value).replace(',', '.')) || 0;
      const { error } = await (supabase as any).from('member_payments').update(patch).eq('id', p.id);
      if (error) throw error;
      toast.success(`Parcela #${p.installment_number} atualizada`);
      setDrafts(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e?.message || ''));
    }
    setSavingId(null);
  }

  function openBaixa(p: any, mode: 'full' | 'partial') {
    const expected = parseFloat(p.value);
    setBaixaPayment({ ...p, _mode: mode, _expected: expected });
    setBaixaValue(mode === 'full' ? expected.toFixed(2) : '');
    setBaixaDate(new Date().toISOString().slice(0, 10));
    setBaixaMethod(p.payment_method || 'pix');
    const d = new Date(); d.setDate(d.getDate() + 15);
    setBaixaNextDue(d.toISOString().slice(0, 10));
  }

  async function confirmBaixa() {
    if (!baixaPayment) return;
    const p = baixaPayment;
    const expected = p._expected;
    const paid = parseFloat(baixaValue.replace(',', '.'));
    if (isNaN(paid) || paid <= 0) { toast.error('Valor invalido'); return; }
    if (paid > expected) { toast.error('Valor pago nao pode ser maior que o total'); return; }

    setSavingId(p.id);
    try {
      const isPartial = paid < expected;
      const remaining = Math.round((expected - paid) * 100) / 100;

      await (supabase as any).from('member_payments').update({
        status: 'paid',
        paid_at: new Date(baixaDate + 'T12:00:00').toISOString(),
        paid_value: paid,
        payment_method: baixaMethod,
        notes: isPartial
          ? `Baixa parcial: R$ ${brl(paid)} de R$ ${brl(expected)} em ${new Date(baixaDate + 'T12:00:00').toLocaleDateString('pt-BR')} (saldo devedor R$ ${brl(remaining)})`
          : (p.notes || `Pago integral em ${new Date(baixaDate + 'T12:00:00').toLocaleDateString('pt-BR')}`),
      }).eq('id', p.id);

      if (isPartial && remaining > 0) {
        await (supabase as any).from('member_payments').insert({
          contract_id: p.contract_id,
          member_id: p.member_id,
          installment_number: p.installment_number,
          value: remaining,
          due_date: baixaNextDue,
          status: 'pending',
          payment_method: baixaMethod,
          notes: `SALDO DEVEDOR da parcela #${p.installment_number} (pagou R$ ${brl(paid)} de R$ ${brl(expected)})`,
        });
      }

      // Desbloqueia membro
      if (p.member_id) {
        await (supabase as any).from('members').update({ status: 'active' }).eq('id', p.member_id).eq('status', 'blocked');
      }

      toast.success(isPartial ? `Baixa parcial de R$ ${brl(paid)}. Saldo R$ ${brl(remaining)} gerado.` : 'Pagamento integral confirmado');
      setBaixaPayment(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    }
    setSavingId(null);
  }

  async function undoPaid(p: any) {
    if (!confirm(`Desfazer baixa da parcela #${p.installment_number}? Ela voltara para "Pendente".`)) return;
    setSavingId(p.id);
    try {
      await (supabase as any).from('member_payments').update({
        status: 'pending',
        paid_at: null,
        paid_value: null,
        notes: (p.notes || '') + ` | Baixa revertida em ${new Date().toLocaleDateString('pt-BR')}`,
      }).eq('id', p.id);
      toast.success(`Baixa da parcela #${p.installment_number} desfeita`);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    }
    setSavingId(null);
  }

  async function removePayment(p: any) {
    if (!confirm(`Excluir definitivamente a parcela #${p.installment_number} (R$ ${brl(p.value)})?`)) return;
    setSavingId(p.id);
    try {
      await (supabase as any).from('member_payments').delete().eq('id', p.id);
      toast.success('Parcela excluida');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    }
    setSavingId(null);
  }

  async function addPayment() {
    if (!contract?.id) { toast.error('Aluno sem contrato — crie um contrato primeiro.'); return; }
    const value = parseFloat(String(newRow.value).replace(',', '.'));
    if (isNaN(value) || value <= 0) { toast.error('Valor invalido'); return; }
    try {
      await (supabase as any).from('member_payments').insert({
        contract_id: contract.id,
        member_id: memberId,
        installment_number: parseInt(newRow.installment_number) || 1,
        value,
        due_date: newRow.due_date,
        status: newRow.status,
        payment_method: newRow.payment_method,
        notes: newRow.notes || null,
      });
      toast.success('Parcela adicionada');
      setShowAdd(false);
      setNewRow({ installment_number: payments.length + 1, value: '', due_date: new Date().toISOString().slice(0, 10), payment_method: 'pix', status: 'pending', notes: '' });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    }
  }

  async function saveContract() {
    if (!contract?.id) return;
    try {
      const patch: any = {
        total_value: parseFloat(String(contractDraft.total_value).replace(',', '.')) || 0,
        entry_value: parseFloat(String(contractDraft.entry_value).replace(',', '.')) || 0,
        num_installments: parseInt(contractDraft.num_installments) || 1,
        payment_method: contractDraft.payment_method,
        status: contractDraft.status,
        notes: contractDraft.notes || null,
      };
      await (supabase as any).from('member_contracts').update(patch).eq('id', contract.id);
      toast.success('Contrato atualizado');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    }
  }

  async function sendLink(p: any) {
    try {
      // Resolve gateway ativo via RPC (billing_config e service-role-only por RLS; ler direto
      // no client volta vazio e caia no stripe quebrado). A RPC devolve so o nome do gateway.
      const { data: gw } = await (supabase as any).rpc('get_active_billing_gateway');
      const gateway = gw || null;
      if (!gateway) {
        toast.error('Nenhum gateway de cobranca ativo. Ative o Asaas ou Stripe em Financeiro.');
        return;
      }
      const fnName = gateway === 'asaas' ? 'asaas-create-payment' : 'stripe-create-payment';

      // Asaas exige CPF
      if (gateway === 'asaas') {
        let cpf = (member?.cpf || '').replace(/\D/g, '');
        if (cpf.length !== 11 && cpf.length !== 14) {
          const input = window.prompt('CPF ou CNPJ do membro (so numeros, exigencia do Asaas):');
          if (input === null) return;
          cpf = input.replace(/\D/g, '');
          if (cpf.length !== 11 && cpf.length !== 14) {
            toast.error('CPF/CNPJ invalido. Precisa ter 11 ou 14 digitos.');
            return;
          }
          await (supabase as any).from('members').update({ cpf }).eq('id', p.member_id);
        }
      }

      const gwRes = await supabase.functions.invoke(fnName, {
        body: { payment_id: p.id, member_id: p.member_id, contract_id: p.contract_id },
      });
      if (gwRes.error || !gwRes.data?.url) {
        toast.error(`Erro ao gerar link ${gateway}: ` + (gwRes.error?.message || gwRes.data?.error || 'sem URL'));
        return;
      }
      const url = gwRes.data.url;
      const phone = member?.phone?.replace(/\D/g, '');
      if (phone) {
        const phoneNumber = phone.startsWith('55') ? phone : '55' + phone;
        // Link de pagamento 1-to-1: instancia UAZAPI, nunca Cloud API/blast.
        const { data: inst } = await (supabase as any).from('whatsapp_instances').select('id')
          .eq('status', 'connected')
          .eq('provider', 'uazapi')
          .not('is_dedicated_blast', 'is', true)
          .order('created_at')
          .limit(1);
        if (inst?.[0]) {
          await supabase.functions.invoke('uazapi-proxy', {
            body: {
              action: 'send_text',
              instance_id: inst[0].id,
              number: phoneNumber,
              text: `Oi ${member.name?.split(' ')[0]}, segue link de pagamento da parcela #${p.installment_number}:\n\n${url}`,
            },
          });
          toast.success('Link enviado por WhatsApp');
        }
      }
      await navigator.clipboard.writeText(url);
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Financeiro — {member?.name || '...'}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card><CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase">A Receber</p>
                <p className="text-sm font-bold">R$ {brl(totals.receivable - totals.received)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase">Recebido</p>
                <p className="text-sm font-bold text-green-400">R$ {brl(totals.received)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase">Atraso</p>
                <p className="text-sm font-bold text-red-400">R$ {brl(totals.overdue)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase">Pendente</p>
                <p className="text-sm font-bold text-yellow-400">R$ {brl(totals.pending)}</p>
              </CardContent></Card>
            </div>

            <Tabs defaultValue="parcelas" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
                <TabsTrigger value="regua">Regua</TabsTrigger>
                <TabsTrigger value="contrato">Contrato</TabsTrigger>
              </TabsList>

              {/* ─── Parcelas ─── */}
              <TabsContent value="parcelas" className="space-y-3 mt-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{payments.length} parcelas — edite inline e clique em Salvar</p>
                  <Button size="sm" variant="outline" onClick={() => { setNewRow({ ...newRow, installment_number: payments.length + 1 }); setShowAdd(true); }}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar parcela
                  </Button>
                </div>

                {showAdd && (
                  <Card className="border-primary/40">
                    <CardContent className="p-3 space-y-2">
                      <div className="grid grid-cols-6 gap-2">
                        <div>
                          <Label className="text-[10px]">N°</Label>
                          <Input className="h-8 text-sm" type="number" value={newRow.installment_number} onChange={e => setNewRow({ ...newRow, installment_number: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px]">Valor</Label>
                          <Input className="h-8 text-sm" type="number" step="0.01" value={newRow.value} onChange={e => setNewRow({ ...newRow, value: e.target.value })} placeholder="0,00" />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px]">Vencimento</Label>
                          <Input className="h-8 text-sm" type="date" value={newRow.due_date} onChange={e => setNewRow({ ...newRow, due_date: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-[10px]">Status</Label>
                          <Select value={newRow.status} onValueChange={v => setNewRow({ ...newRow, status: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px]">Metodo</Label>
                          <Select value={newRow.payment_method} onValueChange={v => setNewRow({ ...newRow, payment_method: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px]">Observacao</Label>
                          <Input className="h-8 text-sm" value={newRow.notes} onChange={e => setNewRow({ ...newRow, notes: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
                        <Button size="sm" onClick={addPayment}>Adicionar</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  {payments.map(p => {
                    const d = draftFor(p);
                    const changed = hasChanges(p.id);
                    const isSaldo = (p.notes || '').toUpperCase().includes('SALDO DEVEDOR') || (p.notes || '').toLowerCase().includes('saldo restante');
                    const paidVal = parseFloat(p.paid_value) || 0;
                    const fullVal = parseFloat(p.value);
                    const isPartial = p.status === 'paid' && paidVal > 0 && paidVal < fullVal;
                    const remainingVal = Math.round((fullVal - paidVal) * 100) / 100;
                    return (
                      <Card key={p.id} className={changed ? 'border-amber-500/40' : isSaldo ? 'border-red-500/40 bg-red-500/5' : isPartial ? 'border-amber-500/40 bg-amber-500/5' : ''}>
                        <CardContent className="p-3 space-y-2">
                          {isSaldo && (
                            <div className="flex items-center gap-1 text-[11px] text-red-400 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              SALDO DEVEDOR — -R$ {brl(parseFloat(p.value))}
                            </div>
                          )}
                          {isPartial && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              BAIXA PARCIAL — Pago R$ {brl(paidVal)} de R$ {brl(fullVal)} · Falta -R$ {brl(remainingVal)}
                            </div>
                          )}
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-1">
                              <Label className="text-[10px]">N°</Label>
                              <Input className="h-8 text-sm" type="number" value={d.installment_number} onChange={e => setField(p.id, 'installment_number', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px]">{isSaldo ? 'Saldo (-)' : 'Valor'}</Label>
                              <Input className={`h-8 text-sm ${isSaldo ? 'text-red-400' : ''}`} type="number" step="0.01" value={d.value} onChange={e => setField(p.id, 'value', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px]">Vencimento</Label>
                              <Input className="h-8 text-sm" type="date" value={d.due_date} onChange={e => setField(p.id, 'due_date', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px]">Metodo</Label>
                              <Select value={d.payment_method || 'pix'} onValueChange={v => setField(p.id, 'payment_method', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px]">Status</Label>
                              <Select value={d.status} onValueChange={v => setField(p.id, 'status', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3 flex gap-1 justify-end">
                              {changed && (
                                <Button size="sm" className="h-8 px-2" onClick={() => savePayment(p)} disabled={savingId === p.id}>
                                  {savingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" />Salvar</>}
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={STATUS_COLOR[p.status]}>{p.status}</Badge>
                              {p.paid_at && (
                                <span className="text-muted-foreground">
                                  Pago em {new Date(p.paid_at).toLocaleDateString('pt-BR')}
                                  {p.paid_value && parseFloat(p.paid_value) !== parseFloat(p.value) && ` (R$ ${brl(p.paid_value)})`}
                                </span>
                              )}
                              {p.notes && <span className="text-muted-foreground italic truncate max-w-[300px]">— {p.notes}</span>}
                            </div>
                            <div className="flex gap-1">
                              {p.status === 'paid' ? (
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10" onClick={() => undoPaid(p)} disabled={savingId === p.id}>
                                  <Undo2 className="w-3 h-3 mr-1" />Desfazer baixa
                                </Button>
                              ) : (
                                <>
                                  <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => openBaixa(p, 'full')} disabled={savingId === p.id}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />Baixa integral
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10" onClick={() => openBaixa(p, 'partial')} disabled={savingId === p.id}>
                                    Parcial
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10" onClick={() => sendLink(p)}>
                                    <Send className="w-3 h-3 mr-1" />Link
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => removePayment(p)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {payments.length === 0 && (
                    <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma parcela. Clique em "Adicionar parcela".</p>
                  )}
                </div>
              </TabsContent>

              {/* ─── Regua ─── */}
              <TabsContent value="regua" className="space-y-2 mt-3">
                <Card>
                  <CardContent className="p-3 text-xs space-y-2">
                    <p className="font-semibold">Como funciona a regua automatica (10h BRT todo dia):</p>
                    <ul className="space-y-1 text-muted-foreground pl-4 list-disc">
                      <li>5 dias antes do vencimento — lembrete amigavel</li>
                      <li>2 dias antes — lembrete com chave PIX/link</li>
                      <li>No vencimento — cobranca + marca como "em atraso"</li>
                      <li>3 dias apos — pergunta se precisa suporte</li>
                      <li>5 dias apos — <span className="text-red-400">bloqueia acesso a plataforma</span></li>
                      <li>Ao confirmar pagamento — desbloqueia automatico</li>
                    </ul>
                  </CardContent>
                </Card>
                <p className="text-xs font-semibold text-muted-foreground mt-3">Lembretes enviados por parcela:</p>
                {payments.map(p => {
                  const sent: string[] = [];
                  if (p.reminder_5d_sent) sent.push('5d antes');
                  if (p.reminder_2d_sent) sent.push('2d antes');
                  if (p.reminder_due_sent) sent.push('no vencimento');
                  if (p.reminder_3d_overdue_sent) sent.push('3d atraso');
                  if (p.blocked_at_5d) sent.push('5d atraso (bloqueou)');
                  return (
                    <Card key={p.id}>
                      <CardContent className="p-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">#{p.installment_number}</span>
                          <span className="text-muted-foreground">{new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          <Badge variant="outline" className={STATUS_COLOR[p.status]}>{p.status}</Badge>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {sent.length > 0 ? sent.map(s => (
                            <Badge key={s} variant="outline" className="text-[10px]"><Bell className="w-2.5 h-2.5 mr-1" />{s}</Badge>
                          )) : <span className="text-muted-foreground">nenhum lembrete ainda</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              {/* ─── Contrato ─── */}
              <TabsContent value="contrato" className="space-y-3 mt-3">
                {/* Assinatura eletronica do contrato legal */}
                <Card className="border-primary/30">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <FileSignature className="w-4 h-4 text-primary" />
                        Assinatura do Contrato
                        {contract?.product_label && (
                          <span className="text-muted-foreground font-normal">
                            — {contract.product_label} ({contract.modality_label})
                          </span>
                        )}
                      </div>
                      {contract?.signature_required !== false && (
                        <Badge variant="outline" className={SIG_LABEL[contract?.signature_status || 'pending_data']?.cls}>
                          {SIG_LABEL[contract?.signature_status || 'pending_data']?.text || contract?.signature_status}
                        </Badge>
                      )}
                    </div>

                    {contract?.signature_status === 'signed' ? (
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p className="text-green-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Assinado em {contract.signed_at ? new Date(contract.signed_at).toLocaleString('pt-BR') : '-'}
                        </p>
                        {contract.signature_ip && <p>IP do aceite: {contract.signature_ip}</p>}
                        {contract.pdf_hash && <p className="truncate">Hash SHA-256: {contract.pdf_hash}</p>}
                        {contract.copy_sent_channels?.length > 0 && <p>Copia enviada: {contract.copy_sent_channels.join(', ')}</p>}
                        {contract.pdf_url && (
                          <a href={contract.pdf_url} target="_blank" rel="noreferrer" className="inline-block mt-2">
                            <Button size="sm" variant="outline" className="h-8"><Download className="w-3 h-3 mr-1" />Baixar contrato assinado</Button>
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-blue-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Aguardando o aluno assinar o contrato na area de membros.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {!contract ? (
                  <Card><CardContent className="p-4 text-sm text-muted-foreground">
                    Este aluno nao possui contrato. Crie parcelas diretamente na aba Parcelas.
                  </CardContent></Card>
                ) : (
                  <Card>
                    <CardContent className="p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Valor Total</Label>
                          <Input className="h-8 text-sm" type="number" step="0.01"
                            value={contractDraft.total_value ?? ''}
                            onChange={e => setContractDraft({ ...contractDraft, total_value: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Entrada</Label>
                          <Input className="h-8 text-sm" type="number" step="0.01"
                            value={contractDraft.entry_value ?? ''}
                            onChange={e => setContractDraft({ ...contractDraft, entry_value: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">N° Parcelas</Label>
                          <Input className="h-8 text-sm" type="number"
                            value={contractDraft.num_installments ?? ''}
                            onChange={e => setContractDraft({ ...contractDraft, num_installments: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Metodo Padrao</Label>
                          <Select value={contractDraft.payment_method || 'pix'} onValueChange={v => setContractDraft({ ...contractDraft, payment_method: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Status do Contrato</Label>
                          <Select value={contractDraft.status || 'active'} onValueChange={v => setContractDraft({ ...contractDraft, status: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="completed">Concluido</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                              <SelectItem value="suspended">Suspenso</SelectItem>
                              <SelectItem value="promise">Promessa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Observacoes</Label>
                        <Input className="h-8 text-sm" value={contractDraft.notes ?? ''} onChange={e => setContractDraft({ ...contractDraft, notes: e.target.value })} />
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={saveContract}><Save className="w-3 h-3 mr-1" />Salvar Contrato</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Dialog de Baixa (integral ou parcial) com saldo devedor visivel */}
        <Dialog open={!!baixaPayment} onOpenChange={(o) => { if (!o) setBaixaPayment(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                {baixaPayment?._mode === 'partial' ? 'Baixa Parcial' : 'Confirmar Pagamento'} — Parcela #{baixaPayment?.installment_number}
              </DialogTitle>
            </DialogHeader>
            {baixaPayment && (() => {
              const expected = baixaPayment._expected;
              const paid = parseFloat((baixaValue || '0').replace(',', '.')) || 0;
              const remaining = Math.max(0, Math.round((expected - paid) * 100) / 100);
              const overpay = paid > expected;
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Card><CardContent className="p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                      <p className="text-sm font-bold">R$ {brl(expected)}</p>
                    </CardContent></Card>
                    <Card><CardContent className="p-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Recebido</p>
                      <p className="text-sm font-bold text-green-400">R$ {brl(paid)}</p>
                    </CardContent></Card>
                    <Card className={remaining > 0 ? 'border-red-500/40 bg-red-500/5' : ''}>
                      <CardContent className="p-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                        <p className={`text-sm font-bold ${remaining > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {remaining > 0 ? `-R$ ${brl(remaining)}` : 'R$ 0,00'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <Label className="text-xs">Valor Recebido (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={baixaValue}
                      onChange={e => setBaixaValue(e.target.value)}
                      placeholder={expected.toFixed(2)}
                      className={overpay ? 'border-red-500/50' : ''}
                      autoFocus
                    />
                    {overpay && <p className="text-[10px] text-red-400 mt-1">Maior que o valor total da parcela</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Data do Pagamento</Label>
                      <Input type="date" value={baixaDate} onChange={e => setBaixaDate(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Metodo</Label>
                      <Select value={baixaMethod} onValueChange={setBaixaMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {remaining > 0 && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded p-2 space-y-2">
                      <p className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Saldo devedor de -R$ {brl(remaining)} sera gerado como nova parcela
                      </p>
                      <div>
                        <Label className="text-xs">Vencimento do Saldo</Label>
                        <Input type="date" value={baixaNextDue} onChange={e => setBaixaNextDue(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBaixaPayment(null)}>Cancelar</Button>
                    <Button
                      onClick={confirmBaixa}
                      disabled={paid <= 0 || overpay || savingId === baixaPayment.id}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {savingId === baixaPayment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>{remaining > 0 ? `Registrar R$ ${brl(paid)} + Gerar Saldo` : `Baixar R$ ${brl(paid)}`}</>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
