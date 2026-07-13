// Asaas webhook receiver
// Eventos suportados:
//   PAYMENT_CONFIRMED / PAYMENT_RECEIVED -> marca paid + desbloqueia member + WhatsApp
//   PAYMENT_OVERDUE                      -> marca overdue
//   PAYMENT_REFUNDED / PAYMENT_DELETED   -> reverte pra pending/cancelled
//
// Auth: header `asaas-access-token` validado contra billing_config.webhook_secret.
//
// Match: usa externalReference (que e o member_payments.id) ou fallback por gateway_payment_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const UAZAPI_BASE_URL = "https://squaad.uazapi.com";

function normalizeBRPhone(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (clean.startsWith("55") && clean.length === 12) {
    return clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

async function sendWhatsApp(supabase: any, phone: string, message: string) {
  try {
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_token")
      .eq("status", "connected")
      .limit(1);
    if (!instances?.[0]) return;
    const cleanPhone = normalizeBRPhone(phone);
    await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": instances[0].instance_token },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });
    console.log(`[ASAAS] WhatsApp enviado para ${cleanPhone}`);
  } catch (e) {
    console.error("[ASAAS] sendWhatsApp erro:", e);
  }
}

async function findPayment(supabase: any, payment: any): Promise<{ id: string; member_id: string | null } | null> {
  // 1) externalReference = member_payments.id
  if (payment?.externalReference) {
    const { data } = await supabase
      .from("member_payments")
      .select("id, member_id")
      .eq("id", payment.externalReference)
      .maybeSingle();
    if (data?.id) return data;
  }
  // 2) gateway_payment_id = payment.id do Asaas
  if (payment?.id) {
    const { data } = await supabase
      .from("member_payments")
      .select("id, member_id")
      .eq("gateway_payment_id", payment.id)
      .maybeSingle();
    if (data?.id) return data;
  }
  return null;
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

    // === Auth via asaas-access-token ===
    const { data: cfg } = await supabase
      .from("billing_config")
      .select("webhook_secret")
      .eq("gateway", "asaas")
      .single();

    const expectedToken = cfg?.webhook_secret;
    const receivedToken = req.headers.get("asaas-access-token");

    if (!expectedToken) {
      console.error("[ASAAS] webhook_secret nao configurado em billing_config");
      return new Response("Webhook nao configurado", { status: 500 });
    }
    if (receivedToken !== expectedToken) {
      console.error("[ASAAS] token invalido recebido");
      return new Response("Invalid token", { status: 403 });
    }

    const event = await req.json();
    console.log(`[ASAAS] Event: ${event.event}, payment.id=${event.payment?.id}, externalRef=${event.payment?.externalReference}`);

    const payment = event.payment;
    if (!payment) {
      return new Response(JSON.stringify({ received: true, skipped: "sem payload de payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = await findPayment(supabase, payment);
    if (!match) {
      console.warn(`[ASAAS] payment nao encontrado: externalRef=${payment.externalReference} asaasId=${payment.id}`);
      return new Response(JSON.stringify({ received: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (event.event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        await (supabase as any)
          .from("member_payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_value: Number(payment.value || payment.netValue || 0),
            gateway_payment_id: payment.id,
            payment_method: payment.billingType?.toLowerCase() || "asaas",
          })
          .eq("id", match.id);

        console.log(`[ASAAS] Payment ${match.id} marcado como pago`);

        // Desbloqueia member se necessario
        if (match.member_id) {
          const { data: member } = await supabase
            .from("members")
            .select("status, name, phone")
            .eq("id", match.member_id)
            .single();

          if (member?.status === "blocked") {
            await supabase
              .from("members")
              .update({ status: "active" })
              .eq("id", match.member_id);

            if (member.phone) {
              await sendWhatsApp(
                supabase,
                member.phone,
                `Oi ${member.name}, pagamento confirmado com sucesso. Seu acesso a plataforma foi reativado. Bora continuar sua jornada.`,
              );
            }
            console.log(`[ASAAS] Member ${match.member_id} desbloqueado`);
          }
        }
        break;
      }

      case "PAYMENT_OVERDUE": {
        await (supabase as any)
          .from("member_payments")
          .update({ status: "overdue" })
          .eq("id", match.id);
        console.log(`[ASAAS] Payment ${match.id} marcado como overdue`);
        break;
      }

      case "PAYMENT_REFUNDED":
      case "PAYMENT_REFUND_IN_PROGRESS":
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_CHARGEBACK_DISPUTE": {
        await (supabase as any)
          .from("member_payments")
          .update({ status: "pending", paid_at: null, paid_value: null })
          .eq("id", match.id);
        console.log(`[ASAAS] Payment ${match.id} revertido (${event.event})`);
        break;
      }

      case "PAYMENT_DELETED": {
        await (supabase as any)
          .from("member_payments")
          .update({ status: "cancelled" })
          .eq("id", match.id);
        break;
      }

      default:
        console.log(`[ASAAS] Evento ignorado: ${event.event}`);
    }

    return new Response(JSON.stringify({ received: true, matched: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[ASAAS] Webhook error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
