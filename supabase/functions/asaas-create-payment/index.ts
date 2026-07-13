// Asaas: cria customer (se nao existir) e cobranca (PIX/boleto/cartao via invoiceUrl).
// Salva invoiceUrl em member_payments.gateway_invoice_url e asaas_customer_id em
// member_contracts.gateway_customer_id pra reusar nas proximas parcelas.
//
// Input:
//   { payment_id }                         -> 1 parcela
//   { all_for_contract: <contract_id> }    -> todas pendentes do contrato
//   member_id e contract_id sao opcionais (resolvidos a partir do payment)
//
// Output: { url, results: [{payment_id, url}], count }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://squaad.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  production: "https://api.asaas.com/v3",
};

function onlyDigits(v: string | null | undefined): string {
  return (v || "").replace(/\D/g, "");
}

function normalizeBRPhone(phone: string): string {
  const clean = onlyDigits(phone);
  if (clean.startsWith("55") && clean.length === 12) {
    return clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

type AsaasCustomer = {
  id: string;
  name: string;
  email: string | null;
  cpfCnpj: string;
};

async function asaasFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "access_token": apiKey,
      "Content-Type": "application/json",
      "User-Agent": "SQUAAD-CRM/1.0",
    },
  });
}

async function ensureAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  member: { id: string; name: string; email: string | null; phone: string | null; cpf: string | null },
  existingId: string | null,
): Promise<{ ok: true; customer: AsaasCustomer } | { ok: false; error: string }> {
  // 1) Se ja tem id no contrato, valida que ainda existe no Asaas
  if (existingId) {
    const r = await asaasFetch(baseUrl, apiKey, `/customers/${existingId}`);
    if (r.ok) {
      const data = await r.json();
      return { ok: true, customer: data as AsaasCustomer };
    }
  }

  const cpfCnpj = onlyDigits(member.cpf);
  if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
    return { ok: false, error: "CPF/CNPJ invalido ou ausente no cadastro do membro" };
  }

  // 2) Tenta achar por CPF (Asaas permite busca por cpfCnpj)
  const search = await asaasFetch(baseUrl, apiKey, `/customers?cpfCnpj=${cpfCnpj}`);
  if (search.ok) {
    const data = await search.json();
    if (Array.isArray(data?.data) && data.data.length > 0) {
      return { ok: true, customer: data.data[0] as AsaasCustomer };
    }
  }

  // 3) Cria
  const mobilePhone = member.phone ? normalizeBRPhone(member.phone) : undefined;
  const body: Record<string, unknown> = {
    name: member.name,
    cpfCnpj,
    email: member.email || undefined,
    mobilePhone: mobilePhone || undefined,
    notificationDisabled: true, // SQUAAD ja envia WhatsApp/email proprios
    externalReference: member.id,
  };
  const created = await asaasFetch(baseUrl, apiKey, "/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const createdData = await created.json();
  if (!created.ok) {
    return {
      ok: false,
      error: `Falha ao criar customer Asaas: ${createdData?.errors?.[0]?.description || JSON.stringify(createdData)}`,
    };
  }
  return { ok: true, customer: createdData as AsaasCustomer };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { payment_id, member_id, contract_id, all_for_contract } = await req.json();

    // === Config Asaas ===
    const { data: cfg, error: cfgError } = await (supabase as any)
      .from("billing_config")
      .select("api_key, config")
      .eq("gateway", "asaas")
      .single();

    if (cfgError || !cfg?.api_key) {
      return new Response(
        JSON.stringify({ error: "Asaas API key nao configurada em billing_config" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const environment = (cfg.config?.environment === "production") ? "production" : "sandbox";
    const baseUrl = ASAAS_BASE[environment];
    const apiKey = cfg.api_key as string;

    // === Resolve pagamentos a processar ===
    let paymentIds: string[] = [];
    if (all_for_contract) {
      const { data: pendingPayments, error: ppError } = await (supabase as any)
        .from("member_payments")
        .select("id")
        .eq("contract_id", all_for_contract)
        .in("status", ["pending", "overdue"])
        .is("gateway_payment_id", null) // pula as que JA tem cobranca (evita duplicar)
        .order("installment_number", { ascending: true });
      if (ppError) throw ppError;
      paymentIds = (pendingPayments || []).map((p: any) => p.id);
    } else if (payment_id) {
      paymentIds = [payment_id];
    } else {
      return new Response(
        JSON.stringify({ error: "payment_id ou all_for_contract obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (paymentIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma parcela pendente encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === Pre-carrega member/contract ===
    const effectiveContractId = contract_id || all_for_contract || null;
    const effectiveMemberId = member_id || null;
    let member: any = null;
    let contract: any = null;
    if (effectiveMemberId) {
      const { data: m } = await (supabase as any)
        .from("members")
        .select("id, name, email, phone, cpf")
        .eq("id", effectiveMemberId)
        .single();
      member = m;
    }
    if (effectiveContractId) {
      const { data: c } = await (supabase as any)
        .from("member_contracts")
        .select("id, num_installments, program, gateway_customer_id, member_id")
        .eq("id", effectiveContractId)
        .single();
      contract = c;
    }

    const results: { payment_id: string; url: string }[] = [];
    let asaasCustomerId: string | null = contract?.gateway_customer_id || null;

    for (const pid of paymentIds) {
      const { data: payment, error: payError } = await (supabase as any)
        .from("member_payments")
        .select("id, value, installment_number, member_id, contract_id, status, due_date, gateway_invoice_url, gateway_payment_id")
        .eq("id", pid)
        .single();

      if (payError || !payment) {
        console.error(`Payment ${pid} not found:`, payError);
        continue;
      }

      // Idempotente: se ja existe link gerado pra essa parcela e ela ainda nao foi paga,
      // reusa o mesmo link em vez de criar outra cobranca no Asaas (evita boleto duplicado
      // quando clicam em "Link" mais de uma vez).
      if (payment.gateway_invoice_url && (payment.status === "pending" || payment.status === "overdue")) {
        results.push({ payment_id: pid, url: payment.gateway_invoice_url });
        continue;
      }

      // Garante member/contract
      if (!member && payment.member_id) {
        const { data: m } = await (supabase as any)
          .from("members")
          .select("id, name, email, phone, cpf")
          .eq("id", payment.member_id)
          .single();
        member = m;
      }
      if (!contract && payment.contract_id) {
        const { data: c } = await (supabase as any)
          .from("member_contracts")
          .select("id, num_installments, program, gateway_customer_id, member_id")
          .eq("id", payment.contract_id)
          .single();
        contract = c;
        if (!asaasCustomerId) asaasCustomerId = contract?.gateway_customer_id || null;
      }

      if (!member) {
        console.error(`Member nao encontrado para payment ${pid}`);
        continue;
      }

      // 1) Garante customer no Asaas
      const customerRes = await ensureAsaasCustomer(baseUrl, apiKey, member, asaasCustomerId);
      if (!customerRes.ok) {
        return new Response(
          JSON.stringify({ error: customerRes.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const customer = customerRes.customer;

      // Persiste customer_id no contrato se mudou
      if (contract?.id && customer.id !== contract.gateway_customer_id) {
        await (supabase as any)
          .from("member_contracts")
          .update({ gateway_customer_id: customer.id })
          .eq("id", contract.id);
        asaasCustomerId = customer.id;
      }

      // 2) Cria pagamento (billingType UNDEFINED = invoiceUrl deixa cliente escolher PIX/boleto/cartao)
      const numInstallments = contract?.num_installments || "?";
      const description = `Metodo SQUAAD - Parcela ${payment.installment_number}/${numInstallments}`;
      const dueDate = (payment.due_date && payment.due_date < new Date().toISOString().slice(0, 10))
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) // se ja venceu, prorroga 3 dias
        : payment.due_date;

      const payBody = {
        customer: customer.id,
        billingType: "UNDEFINED", // habilita PIX + boleto + cartao na invoice
        value: Number(payment.value),
        dueDate,
        description,
        externalReference: payment.id,
        // SQUAAD usa regua propria de WhatsApp; desabilita comunicacao automatica do Asaas
        notificationDisabled: true,
        // Padrao brasileiro: 2% multa unica + 1% juros ao mes apos vencimento
        fine: { value: 2, type: "PERCENTAGE" },
        interest: { value: 1, type: "PERCENTAGE" },
      };

      const payRes = await asaasFetch(baseUrl, apiKey, "/payments", {
        method: "POST",
        body: JSON.stringify(payBody),
      });
      const payData = await payRes.json();

      if (!payRes.ok) {
        console.error(`Asaas payment error ${pid}:`, payData);
        return new Response(
          JSON.stringify({
            error: `Asaas: ${payData?.errors?.[0]?.description || JSON.stringify(payData)}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const invoiceUrl = payData.invoiceUrl;
      const asaasPaymentId = payData.id;

      // Salva no member_payments
      await (supabase as any)
        .from("member_payments")
        .update({
          gateway_invoice_url: invoiceUrl,
          gateway_payment_id: asaasPaymentId,
        })
        .eq("id", pid);

      results.push({ payment_id: pid, url: invoiceUrl });
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma cobranca foi gerada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        url: results[0].url,
        results,
        count: results.length,
        environment,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("asaas-create-payment error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
