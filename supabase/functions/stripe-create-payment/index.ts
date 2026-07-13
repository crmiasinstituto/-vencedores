import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://squaad.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { payment_id, member_id, contract_id, all_for_contract } = await req.json()

    // Get Stripe API key from billing_config
    const { data: stripeConfig, error: cfgError } = await supabase
      .from('billing_config')
      .select('api_key')
      .eq('gateway', 'stripe')
      .single()

    if (cfgError || !stripeConfig?.api_key) {
      return new Response(JSON.stringify({ error: 'Stripe API key not configured in billing_config' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripeApiKey = stripeConfig.api_key

    // Determine which payments to process
    let paymentIds: string[] = []

    if (all_for_contract) {
      // Generate for ALL pending payments of a contract
      const { data: pendingPayments, error: ppError } = await (supabase as any)
        .from('member_payments')
        .select('id')
        .eq('contract_id', all_for_contract)
        .in('status', ['pending', 'overdue'])
        .order('installment_number', { ascending: true })

      if (ppError) throw ppError
      paymentIds = (pendingPayments || []).map((p: any) => p.id)
    } else if (payment_id) {
      paymentIds = [payment_id]
    } else {
      return new Response(JSON.stringify({ error: 'payment_id or all_for_contract required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (paymentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No pending payments found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch member info
    const effectiveMemberId = member_id || null
    let member: any = null
    if (effectiveMemberId) {
      const { data: m } = await (supabase as any)
        .from('members')
        .select('id, name, email, phone')
        .eq('id', effectiveMemberId)
        .single()
      member = m
    }

    // Fetch contract info
    const effectiveContractId = contract_id || all_for_contract || null
    let contract: any = null
    if (effectiveContractId) {
      const { data: c } = await (supabase as any)
        .from('member_contracts')
        .select('id, num_installments, program')
        .eq('id', effectiveContractId)
        .single()
      contract = c
    }

    const results: { payment_id: string; url: string }[] = []

    for (const pid of paymentIds) {
      // Fetch payment
      const { data: payment, error: payError } = await (supabase as any)
        .from('member_payments')
        .select('id, value, installment_number, member_id, contract_id, status')
        .eq('id', pid)
        .single()

      if (payError || !payment) {
        console.error(`Payment ${pid} not found:`, payError)
        continue
      }

      // Fetch member if not already loaded
      if (!member && payment.member_id) {
        const { data: m } = await (supabase as any)
          .from('members')
          .select('id, name, email, phone')
          .eq('id', payment.member_id)
          .single()
        member = m
      }

      // Fetch contract if not already loaded
      if (!contract && payment.contract_id) {
        const { data: c } = await (supabase as any)
          .from('member_contracts')
          .select('id, num_installments, program')
          .eq('id', payment.contract_id)
          .single()
        contract = c
      }

      const numInstallments = contract?.num_installments || '?'
      const productName = `Metodo SQUAAD - Parcela ${payment.installment_number}/${numInstallments}`

      // Build Stripe Checkout Session params
      const params = new URLSearchParams({
        'mode': 'payment',
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'brl',
        'line_items[0][price_data][product_data][name]': productName,
        'line_items[0][price_data][unit_amount]': String(Math.round(payment.value * 100)),
        'line_items[0][quantity]': '1',
        'metadata[payment_id]': payment.id,
        'metadata[member_id]': member?.id || payment.member_id || '',
        'metadata[contract_id]': contract?.id || payment.contract_id || '',
        'success_url': 'https://squaad.com.br/membros/login?payment=success',
        'cancel_url': 'https://squaad.com.br/membros/login?payment=cancelled',
      })

      if (member?.email) {
        params.set('customer_email', member.email)
      }

      // Also allow PIX and boleto if available
      params.append('payment_method_types[]', 'boleto')
      params.append('payment_method_types[]', 'pix')

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      const stripeData = await stripeRes.json()

      if (!stripeRes.ok) {
        console.error(`Stripe error for payment ${pid}:`, stripeData)
        // If PIX/boleto not available, retry with card only
        if (stripeData.error?.message?.includes('payment_method_types')) {
          const fallbackParams = new URLSearchParams({
            'mode': 'payment',
            'payment_method_types[]': 'card',
            'line_items[0][price_data][currency]': 'brl',
            'line_items[0][price_data][product_data][name]': productName,
            'line_items[0][price_data][unit_amount]': String(Math.round(payment.value * 100)),
            'line_items[0][quantity]': '1',
            'metadata[payment_id]': payment.id,
            'metadata[member_id]': member?.id || payment.member_id || '',
            'metadata[contract_id]': contract?.id || payment.contract_id || '',
            'success_url': 'https://squaad.com.br/membros/login?payment=success',
            'cancel_url': 'https://squaad.com.br/membros/login?payment=cancelled',
          })
          if (member?.email) fallbackParams.set('customer_email', member.email)

          const fallbackRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeApiKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: fallbackParams.toString(),
          })

          const fallbackData = await fallbackRes.json()
          if (!fallbackRes.ok) {
            console.error(`Stripe fallback error for payment ${pid}:`, fallbackData)
            continue
          }

          // Save URL to payment record
          await (supabase as any)
            .from('member_payments')
            .update({ gateway_invoice_url: fallbackData.url })
            .eq('id', pid)

          results.push({ payment_id: pid, url: fallbackData.url })
          continue
        }
        continue
      }

      // Save checkout URL to payment record
      await (supabase as any)
        .from('member_payments')
        .update({ gateway_invoice_url: stripeData.url })
        .eq('id', pid)

      results.push({ payment_id: pid, url: stripeData.url })
    }

    if (results.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to create any Stripe sessions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Return first URL as `url` for convenience, plus all results
    return new Response(JSON.stringify({
      url: results[0].url,
      results,
      count: results.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('stripe-create-payment error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
