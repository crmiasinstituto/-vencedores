// Sincroniza um membro com Asaas:
//   - Atualiza customer existente (nome, email, telefone, cpf) no Asaas
//   - Se nao tinha customer e agora tem CPF valido, cria + gera boletos pendentes sem URL
//
// Chamado pelo MemberEditDialog logo apos um save bem-sucedido.

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

async function asaasFetch(baseUrl: string, apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { member_id } = await req.json();
    if (!member_id) {
      return new Response(JSON.stringify({ error: "member_id obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Member data ===
    const { data: member } = await (supabase as any)
      .from("members")
      .select("id, name, email, phone, cpf")
      .eq("id", member_id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: "Member nao encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Asaas config ===
    const { data: cfg } = await (supabase as any)
      .from("billing_config")
      .select("api_key, config, is_active")
      .eq("gateway", "asaas")
      .single();

    if (!cfg?.api_key || !cfg?.is_active) {
      return new Response(JSON.stringify({
        ok: true,
        skipped: "asaas_inativo",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const environment = (cfg.config?.environment === "production") ? "production" : "sandbox";
    const baseUrl = ASAAS_BASE[environment as keyof typeof ASAAS_BASE];
    const apiKey = cfg.api_key as string;

    const cpfCnpj = onlyDigits(member.cpf);
    const hasCpf = cpfCnpj.length === 11 || cpfCnpj.length === 14;

    // === Contratos ativos do membro ===
    const { data: contracts } = await (supabase as any)
      .from("member_contracts")
      .select("id, gateway_customer_id, status, num_installments")
      .eq("member_id", member_id);

    let customersUpdated = 0;
    let customersCreated = 0;
    let invoicesGenerated = 0;
    const errors: string[] = [];

    for (const contract of (contracts || [])) {
      // VIP ou cancelado nao precisa sync
      if (contract.status === "vip" || contract.status === "cancelled") continue;

      const mobilePhone = member.phone ? normalizeBRPhone(member.phone) : undefined;
      const customerBody: Record<string, unknown> = {
        name: member.name,
        cpfCnpj: hasCpf ? cpfCnpj : undefined,
        email: member.email || undefined,
        mobilePhone,
        notificationDisabled: true,
        externalReference: member.id,
      };

      if (contract.gateway_customer_id) {
        // === Atualiza customer existente ===
        const r = await asaasFetch(baseUrl, apiKey, `/customers/${contract.gateway_customer_id}`, {
          method: "POST",
          body: JSON.stringify(customerBody),
        });
        if (r.ok) {
          customersUpdated++;
        } else {
          const err = await r.text();
          console.error(`Falha update customer ${contract.gateway_customer_id}:`, err);
          errors.push(`update_customer: ${err.slice(0, 100)}`);
        }
      } else if (hasCpf) {
        // === Cria customer novo + gera invoices pendentes ===
        // Busca por CPF antes de criar (evita duplicar)
        let customer: any = null;
        const search = await asaasFetch(baseUrl, apiKey, `/customers?cpfCnpj=${cpfCnpj}`);
        if (search.ok) {
          const data = await search.json();
          if (Array.isArray(data?.data) && data.data.length > 0) {
            customer = data.data[0];
            // Atualiza dados do customer achado
            await asaasFetch(baseUrl, apiKey, `/customers/${customer.id}`, {
              method: "POST",
              body: JSON.stringify(customerBody),
            });
          }
        }
        if (!customer) {
          const created = await asaasFetch(baseUrl, apiKey, "/customers", {
            method: "POST",
            body: JSON.stringify(customerBody),
          });
          const createdData = await created.json();
          if (created.ok) {
            customer = createdData;
          } else {
            errors.push(`create_customer: ${createdData?.errors?.[0]?.description || JSON.stringify(createdData)}`);
          }
        }

        if (customer?.id) {
          await (supabase as any)
            .from("member_contracts")
            .update({ gateway_customer_id: customer.id })
            .eq("id", contract.id);
          customersCreated++;

          // Gera invoices das parcelas pending sem URL
          const { data: pending } = await (supabase as any)
            .from("member_payments")
            .select("id, value, installment_number, due_date")
            .eq("contract_id", contract.id)
            .in("status", ["pending", "overdue"])
            .is("gateway_invoice_url", null)
            .order("installment_number", { ascending: true });

          const numInstallments = contract.num_installments || "?";

          for (const pay of (pending || [])) {
            const dueDate = (pay.due_date && pay.due_date < new Date().toISOString().slice(0, 10))
              ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
              : pay.due_date;

            const payBody = {
              customer: customer.id,
              billingType: "UNDEFINED",
              value: Number(pay.value),
              dueDate,
              description: `Metodo SQUAAD - Parcela ${pay.installment_number}/${numInstallments}`,
              externalReference: pay.id,
              notificationDisabled: true,
              fine: { value: 2, type: "PERCENTAGE" },
              interest: { value: 1, type: "PERCENTAGE" },
            };

            const payRes = await asaasFetch(baseUrl, apiKey, "/payments", {
              method: "POST",
              body: JSON.stringify(payBody),
            });
            const payData = await payRes.json();

            if (payRes.ok) {
              await (supabase as any)
                .from("member_payments")
                .update({
                  gateway_invoice_url: payData.invoiceUrl,
                  gateway_payment_id: payData.id,
                })
                .eq("id", pay.id);
              invoicesGenerated++;
            } else {
              errors.push(`create_invoice ${pay.id}: ${payData?.errors?.[0]?.description || JSON.stringify(payData)}`);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      member_id,
      environment,
      customers_updated: customersUpdated,
      customers_created: customersCreated,
      invoices_generated: invoicesGenerated,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("asaas-sync-member error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
