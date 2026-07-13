import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://squaad.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

const UAZAPI_BASE_URL = 'https://squaad.uazapi.com'

function normalizeBRPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('55') && clean.length === 12) {
    return clean.slice(0, 4) + '9' + clean.slice(4)
  }
  return clean
}

async function sendWhatsApp(supabase: any, phone: string, message: string) {
  try {
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_token')
      .eq('status', 'connected')
      .limit(1)

    if (!instances?.[0]) return

    const cleanPhone = normalizeBRPhone(phone)
    await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instances[0].instance_token },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    })
    console.log(`WhatsApp sent to ${cleanPhone}`)
  } catch (e) {
    console.error('WhatsApp send failed:', e)
  }
}

// Simple HMAC-SHA256 verification for Stripe webhook signature
async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1]

    if (!timestamp || !sig) return false

    const signedPayload = `${timestamp}.${payload}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')

    return expected === sig
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.text()
    const signature = req.headers.get('stripe-signature') || ''

    // Get webhook secret from billing_config
    const { data: stripeConfig } = await supabase
      .from('billing_config')
      .select('webhook_secret, api_key')
      .eq('gateway', 'stripe')
      .single()

    if (!stripeConfig?.webhook_secret) {
      console.error('Stripe webhook secret not configured')
      return new Response('Webhook not configured', { status: 500 })
    }
    const valid = await verifyStripeSignature(body, signature, stripeConfig.webhook_secret)
    if (!valid) {
      console.error('Invalid Stripe signature')
      return new Response('Invalid signature', { status: 403 })
    }

    const event = JSON.parse(body)
    console.log(`[STRIPE] Event: ${event.type}, ID: ${event.id}`)

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'invoice.paid': {
        const paymentIntent = event.data.object
        const metadata = paymentIntent.metadata || {}
        const paymentId = metadata.payment_id
        const memberId = metadata.member_id

        if (paymentId) {
          // Mark payment as paid
          await supabase
            .from('member_payments')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              paid_value: (paymentIntent.amount_received || paymentIntent.amount || 0) / 100,
              gateway_payment_id: paymentIntent.id,
              payment_method: 'stripe',
            })
            .eq('id', paymentId)

          console.log(`[STRIPE] Payment ${paymentId} marked as paid`)

          // Unblock member if blocked
          if (memberId) {
            const { data: member } = await supabase
              .from('members')
              .select('status, name, phone')
              .eq('id', memberId)
              .single()

            if (member?.status === 'blocked') {
              await supabase
                .from('members')
                .update({ status: 'active' })
                .eq('id', memberId)

              // Notify via WhatsApp
              if (member.phone) {
                await sendWhatsApp(
                  supabase,
                  member.phone,
                  `Oi ${member.name}, pagamento confirmado com sucesso. Seu acesso a plataforma foi reativado. Bora continuar sua jornada.`
                )
              }
              console.log(`[STRIPE] Member ${memberId} unblocked`)
            }
          }
        } else {
          // Try to match by email from Stripe
          const customerEmail = paymentIntent.receipt_email || paymentIntent.customer_email
          if (customerEmail) {
            const { data: member } = await supabase
              .from('members')
              .select('id, name, phone')
              .eq('email', customerEmail)
              .single()

            if (member) {
              // Find oldest pending payment for this member
              const { data: pendingPayment } = await supabase
                .from('member_payments')
                .select('id')
                .eq('member_id', member.id)
                .eq('status', 'pending')
                .order('due_date', { ascending: true })
                .limit(1)
                .single()

              if (pendingPayment) {
                await supabase
                  .from('member_payments')
                  .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    paid_value: (paymentIntent.amount_received || paymentIntent.amount || 0) / 100,
                    gateway_payment_id: paymentIntent.id,
                    payment_method: 'stripe',
                  })
                  .eq('id', pendingPayment.id)

                console.log(`[STRIPE] Matched payment by email ${customerEmail}`)
              }
            }
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const metadata = invoice.metadata || {}
        const memberId = metadata.member_id

        if (memberId) {
          const { data: member } = await supabase
            .from('members')
            .select('name, phone')
            .eq('id', memberId)
            .single()

          if (member?.phone) {
            await sendWhatsApp(
              supabase,
              member.phone,
              `Oi ${member.name}, tivemos um problema ao processar seu pagamento. Pode verificar os dados do cartao? Qualquer coisa me chama aqui que resolvo rapidinho.`
            )
          }
        }
        break
      }

      default:
        console.log(`[STRIPE] Unhandled event: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[STRIPE] Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
