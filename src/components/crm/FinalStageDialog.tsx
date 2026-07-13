import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, XCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const LOSS_REASONS = [
  'Preco alto',
  'Escolheu concorrente',
  'Sem orcamento',
  'Timing ruim',
  'Sem resposta',
  'Produto inadequado',
  'Desistiu',
  'Outro',
];

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartao Credito' },
  { value: 'cartao_debito', label: 'Cartao Debito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'vip', label: 'VIP (Parceria)' },
];

const INSTALLMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartao Credito' },
  { value: 'cartao_debito', label: 'Cartao Debito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'vip', label: 'VIP (Parceria)' },
];

// Gateway / origem do pagamento. online=true gera link de cobranca (Asaas/Stripe).
// Os demais sao registrados como origem (cobranca presencial / maquina / manual).
const PAYMENT_GATEWAYS = [
  { value: 'asaas', label: 'Asaas (gera link)', online: true },
  { value: 'stripe', label: 'Stripe (gera link)', online: true },
  { value: 'stone', label: 'Stone', online: false },
  { value: 'sicoob', label: 'Sicoob', online: false },
  { value: 'pix_presencial', label: 'PIX presencial', online: false },
  { value: 'dinheiro', label: 'Dinheiro', online: false },
  { value: 'outro', label: 'Outro', online: false },
];

const GATEWAY_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_GATEWAYS.map((g) => [g.value, g.label]),
);

const INSTALLMENT_OPTIONS = [
  { value: 1, label: '1x a vista' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
  { value: 5, label: '5x' },
  { value: 6, label: '6x' },
  { value: 7, label: '7x' },
  { value: 8, label: '8x' },
  { value: 9, label: '9x' },
  { value: 10, label: '10x' },
  { value: 11, label: '11x' },
  { value: 12, label: '12x' },
];

const METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartao Credito',
  cartao_debito: 'Cartao Debito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  vip: 'VIP (Parceria)',
};

interface SaleData {
  totalValue: number;
  entryValue: number;
  entryMethod: string;
  numInstallments: number;
  installmentMethod: string;
  firstDueDate: string;
  isPromise: boolean;
  promiseDate: string;
  paymentGateway: string;
  alreadyPaid: boolean;
  anticipated: boolean;
}

interface FinalStageDialogProps {
  isOpen: boolean;
  leadName: string;
  leadId?: string;
  onConfirmWon: (dealValue: number | null, saleData?: SaleData) => void;
  onConfirmLost: (reason: string) => void;
  onCancel: () => void;
}

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const FinalStageDialog: React.FC<FinalStageDialogProps> = ({
  isOpen,
  leadName,
  leadId,
  onConfirmWon,
  onConfirmLost,
  onCancel,
}) => {
  const [step, setStep] = useState<'choice' | 'won' | 'lost'>('choice');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Sale form state
  const [totalValue, setTotalValue] = useState('');
  const [entryValue, setEntryValue] = useState('');
  const [entryMethod, setEntryMethod] = useState('pix');
  const [numInstallments, setNumInstallments] = useState(1);
  const [installmentMethod, setInstallmentMethod] = useState('pix');
  const [firstDueDate, setFirstDueDate] = useState(getDefaultDueDate());
  const [isPromise, setIsPromise] = useState(false);
  const [promiseDate, setPromiseDate] = useState('');
  const [paymentGateway, setPaymentGateway] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [anticipated, setAnticipated] = useState(false);

  const parsedTotal = useMemo(() => parseFloat(totalValue) || 0, [totalValue]);
  const parsedEntry = useMemo(() => parseFloat(entryValue) || 0, [entryValue]);
  const installmentValue = useMemo(() => {
    const remaining = parsedTotal - parsedEntry;
    if (remaining <= 0 || numInstallments <= 0) return 0;
    return remaining / numInstallments;
  }, [parsedTotal, parsedEntry, numInstallments]);

  const dueDay = useMemo(() => {
    if (!firstDueDate) return '';
    const d = new Date(firstDueDate + 'T12:00:00');
    return d.getDate().toString().padStart(2, '0');
  }, [firstDueDate]);

  if (!isOpen) return null;

  const handleWonConfirm = async () => {
    if (parsedTotal <= 0) {
      toast.error('Informe o valor total');
      return;
    }
    if (parsedEntry > parsedTotal) {
      toast.error('Entrada nao pode ser maior que o valor total');
      return;
    }

    if (isPromise && !promiseDate) {
      toast.error('Informe a data da promessa de pagamento');
      return;
    }

    const saleData: SaleData = {
      totalValue: parsedTotal,
      entryValue: parsedEntry,
      entryMethod,
      numInstallments,
      installmentMethod,
      firstDueDate,
      isPromise,
      promiseDate,
      paymentGateway,
      alreadyPaid,
      anticipated: alreadyPaid && anticipated,
    };

    onConfirmWon(parsedTotal, saleData);
    resetState();
  };

  const handleLostConfirm = () => {
    const reason = selectedReason === 'Outro' ? (customReason || 'Outro') : selectedReason;
    if (!reason) return;
    onConfirmLost(reason);
    resetState();
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  const resetState = () => {
    setStep('choice');
    setTotalValue('');
    setEntryValue('');
    setEntryMethod('pix');
    setNumInstallments(1);
    setInstallmentMethod('pix');
    setFirstDueDate(getDefaultDueDate());
    setPaymentGateway('');
    setAlreadyPaid(false);
    setAnticipated(false);
    setIsPromise(false);
    setPromiseDate('');
    setSelectedReason('');
    setCustomReason('');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border p-6 rounded-xl max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {step === 'choice' && (
          <>
            <h3 className="font-semibold text-lg mb-1 text-foreground">Resultado do Lead</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Este lead <strong className="text-foreground">{leadName}</strong> fechou ou foi perdido?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setStep('won')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <Trophy className="w-4 h-4" />
                Fechou (Ganho)
              </Button>
              <Button
                onClick={() => setStep('lost')}
                variant="destructive"
                className="flex-1 gap-2"
              >
                <XCircle className="w-4 h-4" />
                Perdido
              </Button>
            </div>
            <Button variant="ghost" onClick={handleCancel} className="w-full mt-3 text-muted-foreground">
              Cancelar
            </Button>
          </>
        )}

        {step === 'won' && (
          <>
            <h3 className="font-semibold text-lg mb-1 text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-green-500" />
              Dados da Venda
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Preencha os dados do contrato de <strong className="text-foreground">{leadName}</strong>
            </p>

            <div className="space-y-4">
              {/* Valor Total */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor Total</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
              </div>

              {/* Entrada */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrada (opcional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <input
                      type="number"
                      placeholder="0,00"
                      value={entryValue}
                      onChange={(e) => setEntryValue(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Metodo da Entrada</label>
                  <select
                    value={entryMethod}
                    onChange={(e) => setEntryMethod(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Promessa de pagamento da entrada */}
              {parsedEntry > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-amber-400">Entrada e promessa de pagamento?</label>
                    <button
                      type="button"
                      onClick={() => setIsPromise(!isPromise)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${isPromise ? 'bg-amber-500' : 'bg-border'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPromise ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {isPromise && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Data que o lead prometeu pagar a entrada</label>
                      <input
                        type="date"
                        value={promiseDate}
                        onChange={(e) => setPromiseDate(e.target.value)}
                        className="w-full px-3 py-2.5 bg-background border border-amber-500/30 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">O sistema vai lembrar o lead na data marcada</p>
                    </div>
                  )}
                </div>
              )}

              {/* Parcelas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Numero de Parcelas</label>
                  <select
                    value={numInstallments}
                    onChange={(e) => setNumInstallments(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  >
                    {INSTALLMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Metodo das Parcelas</label>
                  <select
                    value={installmentMethod}
                    onChange={(e) => setInstallmentMethod(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  >
                    {INSTALLMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data primeiro vencimento */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Primeiro Vencimento</label>
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => setFirstDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>

              {/* Gateway / Origem do pagamento */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Gateway / Origem do pagamento</label>
                <select
                  value={paymentGateway}
                  onChange={(e) => setPaymentGateway(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                >
                  <option value="">Selecione (nao gera cobranca)</option>
                  {PAYMENT_GATEWAYS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  So gera cobranca online se voce escolher <strong>Asaas</strong> ou <strong>Stripe</strong>. Os demais sao so registro de origem.
                </p>
              </div>

              {/* Ja recebido presencial — nao gera cobranca */}
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-green-400">Ja recebido (presencial / maquina, nao gera cobranca)</label>
                  <button
                    type="button"
                    onClick={() => setAlreadyPaid(!alreadyPaid)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${alreadyPaid ? 'bg-green-500' : 'bg-border'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${alreadyPaid ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {alreadyPaid && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-green-300/80">
                      Marca como <strong>pago</strong> via {GATEWAY_LABELS[paymentGateway] || paymentGateway}. Nenhuma cobranca online sera gerada.
                    </p>
                    <div className="flex items-center justify-between border-t border-green-500/20 pt-2">
                      <label className="text-[11px] font-medium text-green-300">Antecipado (recebido tudo de uma vez)</label>
                      <button
                        type="button"
                        onClick={() => setAnticipated(!anticipated)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${anticipated ? 'bg-green-500' : 'bg-border'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${anticipated ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {anticipated && (
                      <p className="text-[10px] text-green-300/80">
                        Lanca <strong>um recebimento unico hoje</strong>, sem parcelas em datas futuras. O cliente parcelou no cartao mas a maquina antecipou tudo.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Aviso VIP */}
              {(entryMethod === 'vip' || installmentMethod === 'vip') && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    ⚜️ Venda VIP / Parceria
                  </p>
                  <p className="text-[11px] text-purple-200/80">
                    {entryMethod === 'vip' && installmentMethod === 'vip'
                      ? 'Venda integral autorizada como parceria — nada vai contabilizar no financeiro. Contrato fica registrado pra histórico.'
                      : entryMethod === 'vip'
                      ? `A entrada de R$ ${formatCurrency(parsedEntry)} é VIP (não conta no financeiro). As ${numInstallments} parcelas seguem normais.`
                      : `As ${numInstallments} parcelas são VIP (não contam no financeiro). Só a entrada de R$ ${formatCurrency(parsedEntry)} entra como receita.`}
                  </p>
                </div>
              )}

              {/* Preview */}
              {parsedTotal > 0 && (
                <div className="bg-muted/30 border border-border/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-primary mb-1">Resumo do Contrato</p>
                  {parsedEntry > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Entrada: <span className="text-foreground font-medium">R$ {formatCurrency(parsedEntry)}</span> via {METHOD_LABELS[entryMethod] || entryMethod}
                      {isPromise && promiseDate && (
                        <span className="text-amber-400 ml-1">(promessa: {new Date(promiseDate + 'T12:00:00').toLocaleDateString('pt-BR')})</span>
                      )}
                    </p>
                  )}
                  {numInstallments > 0 && installmentValue > 0 && (
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">{numInstallments}x de R$ {formatCurrency(installmentValue)}</span>{' '}
                      no {METHOD_LABELS[installmentMethod] || installmentMethod}
                      {anticipated ? ' (antecipado, recebido a vista)' : ` - Vencimento dia ${dueDay} de cada mes`}
                    </p>
                  )}
                  {isPromise && promiseDate && (
                    <p className="text-sm text-amber-400">
                      Promessa de pagamento: <span className="font-medium">{new Date(promiseDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </p>
                  )}
                  <p className={`text-xs mt-1 ${alreadyPaid ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {alreadyPaid
                      ? `Ja recebido via ${GATEWAY_LABELS[paymentGateway] || paymentGateway || 'origem nao definida'}${anticipated ? ', antecipado (sem parcelas futuras)' : ''} (sem cobranca gerada)`
                      : (!paymentGateway
                          ? 'Sem cobranca automatica (gere depois no financeiro se precisar)'
                          : PAYMENT_GATEWAYS.find((g) => g.value === paymentGateway)?.online
                            ? `Cobranca via ${GATEWAY_LABELS[paymentGateway]} (gera link)`
                            : `A cobrar via ${GATEWAY_LABELS[paymentGateway]}`)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/30">
                    Total: R$ {formatCurrency(parsedTotal)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="outline" onClick={() => setStep('choice')} className="flex-1 gap-1">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button
                onClick={handleWonConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={saving || parsedTotal <= 0}
              >
                {saving ? 'Salvando...' : 'Confirmar Venda'}
              </Button>
            </div>
          </>
        )}

        {step === 'lost' && (
          <>
            <h3 className="font-semibold text-lg mb-1 text-foreground flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Motivo da Perda
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione o motivo principal:
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {LOSS_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                    selectedReason === reason
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            {selectedReason === 'Outro' && (
              <input
                type="text"
                placeholder="Descreva o motivo..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-4 py-2.5 mb-4 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('choice')} className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={handleLostConfirm}
                variant="destructive"
                className="flex-1"
                disabled={!selectedReason}
              >
                Confirmar Perda
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
