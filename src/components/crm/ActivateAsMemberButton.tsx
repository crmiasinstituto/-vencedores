import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  GraduationCap, CheckCircle2, Loader2, Send, CreditCard, ExternalLink, Users,
} from 'lucide-react';

const db = supabase as any;

interface Props { lead: any; onActivated?: () => void }

export default function ActivateAsMemberButton({ lead, onActivated }: Props) {
  const [open, setOpen] = useState(false);
  const [member, setMember] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    program: 'metodo-vencedores',
    payment_method: 'credit_card',
    num_installments: 1,
    total_value: Number(lead?.deal_value || lead?.potential_value || 0),
    entry_value: 0,
    send_credentials: true,
    // Preposto: quando ligado, o acesso + grupo vao pra essa pessoa (funcionario do comprador),
    // e o lead vira so o contratante (dono do contrato).
    use_preposto: false,
    preposto: { name: '', phone: '', email: '', job_title: '', relationship: 'funcionario' },
  });

  const setPreposto = (patch: Partial<typeof form.preposto>) =>
    setForm(prev => ({ ...prev, preposto: { ...prev.preposto, ...patch } }));

  useEffect(() => {
    if (!lead?.id) return;
    db.from('members').select('id, status, email, phone, credentials_sent_at, program')
      .eq('crm_lead_id', lead.id).maybeSingle()
      .then(({ data }: any) => setMember(data));
    // Se a venda ja foi montada no kanban (Comprou), o contrato ja existe.
    // Nesse caso o popup so ativa + manda credenciais + grupo, sem repetir pagamento.
    db.from('member_contracts')
      .select('id, total_value, num_installments, entry_value, payment_method, payment_origin, status, gateway, program')
      .eq('crm_lead_id', lead.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => setContract(data));
  }, [lead?.id, open]);

  useEffect(() => {
    if (open) setForm(prev => ({
      ...prev,
      total_value: Number(lead?.deal_value || lead?.potential_value || prev.total_value || 0),
    }));
  }, [open, lead?.deal_value, lead?.potential_value]);

  const activate = async () => {
    if (!lead?.id) return;
    // Se ja existe contrato (venda montada no Comprou), nao precisa de pagamento aqui.
    if (!contract && (!form.total_value || form.total_value <= 0)) {
      toast.error('Defina o valor total da venda');
      return;
    }
    if (form.use_preposto && (!form.preposto.name.trim() || !form.preposto.phone.trim())) {
      toast.error('Preencha nome e WhatsApp do preposto');
      return;
    }
    setLoading(true);
    try {
      const body: any = contract
        ? {
            // Venda ja montada: so ativa + credenciais + grupo (edge nao recria contrato).
            lead_id: lead.id,
            program: contract.program || member?.program || form.program,
            send_credentials: form.send_credentials,
            force: member?.status === 'active',
          }
        : {
            lead_id: lead.id,
            program: form.program,
            payment_method: form.payment_method,
            num_installments: form.num_installments,
            total_value: form.total_value,
            entry_value: form.entry_value,
            send_credentials: form.send_credentials,
            force: member?.status === 'active', // reenvia se clicar de novo
          };
      if (form.use_preposto && form.preposto.name.trim() && form.preposto.phone.trim()) {
        body.preposto = {
          name: form.preposto.name.trim(),
          phone: form.preposto.phone.trim(),
          email: form.preposto.email.trim() || undefined,
          job_title: form.preposto.job_title.trim() || undefined,
          relationship: form.preposto.relationship,
        };
      }
      const { data, error } = await supabase.functions.invoke('activate-lead-as-member', { body });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      const d = data as any;
      if (d.skipped === 'member_already_active') {
        toast.success('Lead ja estava ativo como aluno');
      } else if (d.is_preposto) {
        toast.success(
          `✅ Venda de ${lead.name} ativada. Acesso${d.credentials_sent ? ' + credenciais' : ''} enviados pro preposto ${d.access_name}${d.group_added ? ' e ele foi adicionado ao grupo' : ''}`,
        );
      } else {
        toast.success(
          d.credentials_sent
            ? `✅ ${lead.name} ativado + credenciais enviadas no WhatsApp`
            : `✅ ${lead.name} ativado como aluno`,
        );
      }
      setOpen(false);
      onActivated?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally { setLoading(false); }
  };

  const resendCredentials = async () => {
    if (!member?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-member-credentials', {
        body: { member_id: member.id, force: true },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      toast.success('Credenciais reenviadas no WhatsApp');
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally { setLoading(false); }
  };

  // Already active → compact resend button
  if (member?.status === 'active') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-green-500/30 text-green-500 gap-1 text-[10px]">
          <CheckCircle2 className="w-3 h-3" /> Aluno ativo
        </Badge>
        <Button size="sm" variant="outline" onClick={resendCredentials} disabled={loading}
          className="text-[#25D366] border-[#25D366]/30" title="Reenviar credenciais no WhatsApp">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
        <a href={`/admin/membros`} target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline" className="gap-1 text-xs">
            Ver <ExternalLink className="w-3 h-3" />
          </Button>
        </a>
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-black gap-1.5"
      >
        <GraduationCap className="w-3.5 h-3.5" /> Ativar como aluno
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onKeyDown={(e) => {
            // Evita que Enter num campo ative a venda sem querer (precisa clicar no botao).
            if (e.key === 'Enter') {
              const tag = (e.target as HTMLElement)?.tagName;
              if (tag === 'INPUT') { e.preventDefault(); e.stopPropagation(); }
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" /> Ativar {lead?.name} como aluno
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
              <p><strong>WhatsApp:</strong> {lead?.whatsapp || '—'}</p>
              <p><strong>Email:</strong> {lead?.email || `sera criado como 55${(lead?.whatsapp || '').replace(/\D/g, '').replace(/^55/, '')}@squaad.com`}</p>
            </div>

            {contract && (
              <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-3 text-xs space-y-1">
                <p className="font-semibold text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Venda já registrada no fechamento
                </p>
                <p className="text-muted-foreground">
                  Contrato de <strong className="text-foreground">R$ {Number(contract.total_value || 0).toFixed(2)}</strong> em {contract.num_installments}x
                  {contract.payment_origin ? <> via <strong className="text-foreground">{contract.payment_origin}</strong></> : null}.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Esta ação só <strong>ativa o acesso</strong>, envia as credenciais e adiciona ao grupo. Não gera cobrança nova.
                </p>
              </div>
            )}

            {!contract && (
              <>
            <div className="space-y-1.5">
              <Label>Programa</Label>
              <Select value={form.program} onValueChange={(v) => setForm({ ...form, program: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentoria">MentorIA (3 meses)</SelectItem>
                  <SelectItem value="metodo-vencedores">Método + que Vencedores (12 meses)</SelectItem>
                  <SelectItem value="mbai">MBAI (3 meses)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (4 meses)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor total (R$)</Label>
                <Input type="number" value={form.total_value}
                  onChange={(e) => setForm({ ...form, total_value: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Entrada (R$)</Label>
                <Input type="number" value={form.entry_value}
                  onChange={(e) => setForm({ ...form, entry_value: parseFloat(e.target.value) || 0 })}
                  placeholder="0 = sem entrada" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Cartão de crédito</SelectItem>
                    <SelectItem value="pix">PIX à vista</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="bank_transfer">Transferência</SelectItem>
                    <SelectItem value="vip">⚜️ VIP (Parceria — não conta no financeiro)</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Select value={String(form.num_installments)} onValueChange={(v) => setForm({ ...form, num_installments: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}x{n > 1 ? ` de R$ ${((form.total_value - form.entry_value) / n).toFixed(2)}` : ' à vista'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

              </>
            )}

            {/* Preposto: enviar o acesso pra um funcionario do comprador, nao pro lead */}
            <div className="bg-[#3B82F6]/5 border border-[#3B82F6]/30 rounded-lg p-3 space-y-2.5">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={form.use_preposto}
                  onChange={(e) => setForm({ ...form, use_preposto: e.target.checked })}
                  className="mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#3B82F6]" /> Acesso vai para um preposto (funcionario)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Quem compra e <strong>{lead?.name}</strong> (fica como contratante, dono do contrato), mas o login e a entrada no grupo vao pra pessoa do time dele que vai usar a area de membros.
                  </p>
                </div>
              </label>

              {form.use_preposto && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome do preposto</Label>
                      <Input value={form.preposto.name} onChange={(e) => setPreposto({ name: e.target.value })} placeholder="Nome completo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">WhatsApp do preposto</Label>
                      <Input value={form.preposto.phone} onChange={(e) => setPreposto({ phone: e.target.value })} placeholder="(11) 99999-9999" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email (opcional)</Label>
                      <Input type="email" value={form.preposto.email} onChange={(e) => setPreposto({ email: e.target.value })} placeholder="email de login" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Relacao com o comprador</Label>
                      <Select value={form.preposto.relationship} onValueChange={(v) => setPreposto({ relationship: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="funcionario">Funcionario(a)</SelectItem>
                          <SelectItem value="gestor">Gestor(a) do time</SelectItem>
                          <SelectItem value="socio">Socio(a)</SelectItem>
                          <SelectItem value="filho">Filho(a)</SelectItem>
                          <SelectItem value="conjuge">Conjuge</SelectItem>
                          <SelectItem value="parente">Parente</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cargo/Funcao (opcional)</Label>
                    <Input value={form.preposto.job_title} onChange={(e) => setPreposto({ job_title: e.target.value })} placeholder="Ex: Gerente de Marketing" />
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2 cursor-pointer bg-[#25D366]/5 border border-[#25D366]/30 rounded-lg p-3">
              <input type="checkbox" checked={form.send_credentials}
                onChange={(e) => setForm({ ...form, send_credentials: e.target.checked })}
                className="mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#25D366]" /> Enviar credenciais no WhatsApp
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {form.use_preposto
                    ? 'Envia link de acesso + login + senha inicial no WhatsApp do preposto (e avisa o comprador).'
                    : 'Envia link de acesso + login + senha inicial no WhatsApp do lead.'}
                </p>
              </div>
            </label>

            {form.payment_method === 'vip' && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-[11px] space-y-1">
                <p className="font-bold text-purple-300 flex items-center gap-1.5">⚜️ Venda VIP / Parceria</p>
                <p className="text-purple-200/80">
                  O contrato de R$ {form.total_value.toFixed(2)} fica registrado pra histórico, mas <strong>nenhuma parcela vai pro financeiro</strong>. O aluno recebe acesso normal à área de membros.
                </p>
              </div>
            )}

            {form.program === 'enterprise' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-[11px] space-y-1">
                <p className="font-bold text-amber-300">🏢 Cliente Enterprise</p>
                <p className="text-amber-200/80">
                  Vai ter acesso ao Método + que Vencedores automaticamente — o sistema cria o enrollment de onboarding junto.
                </p>
              </div>
            )}

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-bold text-foreground">O que acontece ao clicar Ativar:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {contract ? (
                  <>
                    <li>Ativa o acesso {form.use_preposto ? 'do preposto' : 'do aluno'} na Área de Membros (status Ativo)</li>
                    <li>Usa o contrato que já existe, <strong>não gera cobrança nova</strong></li>
                    <li>Adiciona {form.use_preposto ? <><strong>{form.preposto.name || 'o preposto'}</strong></> : 'o aluno'} ao grupo do WhatsApp do programa</li>
                    {form.send_credentials && <li>Envia credenciais no WhatsApp {form.use_preposto ? 'do preposto (e avisa o comprador)' : 'do lead'}</li>}
                  </>
                ) : (
                  <>
                    <li>Cria registro de aluno na Área de Membros (status Ativo)</li>
                    <li>Cria contrato de R$ {form.total_value.toFixed(2)} em {form.num_installments}x</li>
                    {form.payment_method === 'vip' ? (
                      <li className="text-purple-300">VIP: nenhuma parcela é gerada no financeiro</li>
                    ) : (
                      <li>{form.num_installments === 1 ? 'Marca pagamento à vista como pago' : `Gera ${form.num_installments} parcelas pendentes no financeiro`}</li>
                    )}
                    {form.use_preposto && <li><strong>{lead?.name}</strong> fica como contratante; <strong>{form.preposto.name || 'o preposto'}</strong> recebe o acesso e entra no grupo</li>}
                    <li>Move lead para <strong>pós-venda ativo</strong></li>
                    {form.program === 'enterprise' && <li>Habilita Método + que Vencedores + envia link de onboarding</li>}
                    {form.send_credentials && <li>Envia credenciais no WhatsApp {form.use_preposto ? 'do preposto (e avisa o comprador)' : 'do lead'}</li>}
                  </>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={activate} disabled={loading || (!contract && !form.total_value)} className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-2" />}
              Ativar como aluno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
