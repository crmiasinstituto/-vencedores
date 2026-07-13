/**
 * Cobranca Asaas pra um inscrito do evento.
 *
 * 1) create_event_attendee_charge: cria member + contract + parcela e liga no inscrito.
 * 2) asaas-create-payment (edge certificada): gera a fatura Asaas (PIX/cartao/boleto).
 *
 * O webhook do Asaas marca a parcela como paga e um trigger reflete no inscrito.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ChargeResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function generateAttendeeCharge(
  attendeeId: string,
  product: string,
  amount: number,
  billingType: 'UNDEFINED' | 'PIX' | 'CREDIT_CARD' | 'BOLETO' = 'UNDEFINED',
): Promise<ChargeResult> {
  // 1) cria member/contrato/parcela e liga no inscrito
  const { data: rpc, error: rpcErr } = await (supabase.rpc as any)('create_event_attendee_charge', {
    p_attendee_id: attendeeId,
    p_product: product,
    p_amount: amount,
    p_billing_type: billingType,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };
  const res = rpc as { ok: boolean; error?: string; payment_id?: string; member_id?: string; contract_id?: string };
  if (!res?.ok) return { ok: false, error: res?.error ?? 'Falha ao preparar a cobranca' };

  // 2) gera a fatura no Asaas (fluxo certificado)
  const { data: pay, error: payErr } = await supabase.functions.invoke('asaas-create-payment', {
    body: { payment_id: res.payment_id, member_id: res.member_id, contract_id: res.contract_id },
  });
  if (payErr) return { ok: false, error: payErr.message };
  const url = (pay as any)?.url || (pay as any)?.results?.[0]?.url;
  if (!url) return { ok: false, error: (pay as any)?.error ?? 'Asaas nao retornou o link' };
  return { ok: true, url };
}
