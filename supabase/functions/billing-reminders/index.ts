import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://squaad.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UAZAPI_BASE_URL = 'https://squaad.uazapi.com'

function normalizeBRPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('55') && clean.length === 12) {
    return clean.slice(0, 4) + '9' + clean.slice(4)
  }
  return clean
}

// Check if current time is within allowed hours (06:00-22:00 BRT)
function isAllowedHours(): boolean {
  const now = new Date()
  const brtHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours()
  return brtHour >= 6 && brtHour < 22
}

async function sendWhatsApp(supabase: any, phone: string, message: string) {
  try {
    // Envio 1-to-1: so instancia uazapi nao-dedicada e com token (nunca cloud_api/blast)
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_token')
      .eq('status', 'connected')
      .eq('provider', 'uazapi')
      .or('is_dedicated_blast.is.null,is_dedicated_blast.eq.false')
      .order('created_at', { ascending: true })
      .limit(1)

    const inst = instances?.[0]
    if (!inst?.instance_token) {
      console.error('No connected uazapi instance with token, reminder NOT sent to', phone)
      return false
    }

    const cleanPhone = normalizeBRPhone(phone)

    const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': inst.instance_token },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`WhatsApp send FAILED to ${cleanPhone}: ${res.status} ${body.slice(0, 200)}`)
      return false
    }
    const result = await res.json()
    console.log(`WhatsApp sent to ${cleanPhone}:`, result?.status || 'ok')
    return true
  } catch (e) {
    console.error('Failed to send WhatsApp:', e)
    return false
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function daysDiff(dateStr: string): number {
  const now = new Date()
  const brtNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const today = new Date(brtNow.getFullYear(), brtNow.getMonth(), brtNow.getDate())
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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

    // Only send during allowed hours (06:00-22:00 BRT)
    if (!isAllowedHours()) {
      console.log('Outside allowed hours, skipping billing reminders')
      return new Response(JSON.stringify({ ok: true, skipped: 'outside_allowed_hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get PIX key + titular from billing_config
    const { data: billingConfig } = await supabase
      .from('billing_config' as any)
      .select('pix_key, pix_name')
      .eq('gateway', 'manual')
      .single()

    const pixKey = (billingConfig as any)?.pix_key || '[chave PIX nao configurada]'
    const pixName = (billingConfig as any)?.pix_name || ''
    const pixBlock = pixName
      ? `Chave PIX: ${pixKey}\nTitular: ${pixName}`
      : `Chave PIX: ${pixKey}`

    // Fetch all pending/overdue payments with member info
    const { data: payments, error } = await (supabase as any)
      .from('member_payments')
      .select('*, members!inner(name, phone, status)')
      .in('status', ['pending', 'overdue'])

    if (error) {
      console.error('Error fetching payments:', error)
      throw error
    }

    if (!payments || payments.length === 0) {
      console.log('No pending/overdue payments')
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let remindersSent = 0

    for (const payment of payments) {
      const member = payment.members
      if (!member?.phone) continue

      const name = member.name?.split(' ')[0] || 'Aluno'
      const phone = member.phone
      const value = formatCurrency(payment.value)
      const date = formatDate(payment.due_date)
      const diff = daysDiff(payment.due_date) // positive = days until due, negative = days overdue

      // ====== D-5: aviso amigavel com sinalizacao de taxa pos-vencimento ======
      if (diff === 5 && !payment.reminder_5d_sent) {
        const msg = `Ola ${name}, esta chegando a data do seu vencimento. Dia ${date} vence sua parcela do Metodo SQUAAD no valor de R$ ${value}.\n\nLembrando que apos o vencimento entra multa de 2% sobre o valor e juros de 1% ao mes. Estou por aqui pra qualquer duvida.`
        await sendWhatsApp(supabase, phone, msg)
        await (supabase as any).from('member_payments').update({ reminder_5d_sent: true }).eq('id', payment.id)
        remindersSent++
      }

      // ====== D-2: link + reforco de "sem taxa ate o vencimento" ======
      if (diff === 2 && !payment.reminder_2d_sent) {
        const payInfo = payment.gateway_invoice_url
          ? `Segue o link com PIX, boleto ou cartao na mesma pagina:\n${payment.gateway_invoice_url}`
          : pixBlock
        const msg = `Ola ${name}, faltam 2 dias pra sua parcela do Metodo SQUAAD (vence dia ${date}, R$ ${value}).\n\n${payInfo}\n\nPagando ate o vencimento nao tem nenhuma taxa adicional. Estou a disposicao se precisar.`
        await sendWhatsApp(supabase, phone, msg)
        await (supabase as any).from('member_payments').update({ reminder_2d_sent: true }).eq('id', payment.id)
        remindersSent++
      }

      // ====== D-0: e hoje o vencimento ======
      if (diff === 0 && !payment.reminder_due_sent) {
        const payInfo = payment.gateway_invoice_url
          ? `Segue o link pra resolver ainda hoje:\n${payment.gateway_invoice_url}`
          : pixBlock
        const msg = `Ola ${name}, e hoje o vencimento da sua parcela do Metodo SQUAAD, R$ ${value}.\n\n${payInfo}\n\nPagando ainda hoje nao tem taxa. A partir de amanha entra multa de 2% e juros de 1% ao mes. Estou aqui se precisar.`
        await sendWhatsApp(supabase, phone, msg)
        const updates: any = { reminder_due_sent: true }
        if (payment.status === 'pending') updates.status = 'overdue'
        await (supabase as any).from('member_payments').update(updates).eq('id', payment.id)
        remindersSent++
      }

      // ====== D+3: convite pra conversa, sem ameaca ======
      if (diff === -3 && !payment.reminder_3d_overdue_sent && payment.status === 'overdue') {
        const payInfo = payment.gateway_invoice_url
          ? `Se quiser resolver agora mesmo, segue o link atualizado ja com multa e juros do periodo:\n${payment.gateway_invoice_url}`
          : pixBlock
        const msg = `Ola ${name}, imagino que pode ter acontecido algo importante e voce nao conseguiu efetuar o pagamento da parcela do dia ${date}. Estou a sua disposicao.\n\nPrefere que eu te ligue? Me conta aqui o que aconteceu, vamos achar a melhor saida juntos.\n\n${payInfo}`
        await sendWhatsApp(supabase, phone, msg)
        await (supabase as any).from('member_payments').update({ reminder_3d_overdue_sent: true }).eq('id', payment.id)
        remindersSent++
      }

      // D+5: bloqueio automatico REMOVIDO a pedido do Carlos.
      // Quando precisar, ele bloqueia manualmente via /admin/membros.
    }

    // Handle unblocking: when a payment is marked as paid, unblock the member
    const { data: recentPaid } = await (supabase as any)
      .from('member_payments')
      .select('member_id')
      .eq('status', 'paid')
      .gte('paid_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (recentPaid && recentPaid.length > 0) {
      const memberIds = [...new Set(recentPaid.map((p: any) => p.member_id))]
      for (const mid of memberIds) {
        await (supabase as any)
          .from('members')
          .update({ status: 'active' })
          .eq('id', mid)
          .eq('status', 'blocked')
      }
    }

    console.log(`Billing reminders: sent ${remindersSent} for ${payments.length} payments`)

    // ==================== ONBOARDING REMINDER (2 days) ====================
    let onboardingReminders = 0
    try {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      // ⚠️ Idempotência: só envia se reminder_sent_at IS NULL (cron pode rodar
      // todo dia, mas cada enrollment recebe NO MÁXIMO 1 lembrete).
      // Status 'cancelled' fica de fora — admin cancelou via UI.
      const { data: pendingOnboardings } = await (supabase as any)
        .from('metodo_squaad_enrollments')
        .select('id, name, whatsapp, onboarding_token, onboarding_step, reminder_sent_at, created_at')
        .eq('status', 'pending')
        .is('reminder_sent_at', null)
        .lt('created_at', twoDaysAgo)

      for (const enrollment of (pendingOnboardings || [])) {
        if (!enrollment.whatsapp || !enrollment.onboarding_token) continue
        // Skip se já progrediu além da etapa 1 (lead já clicou e começou)
        if (enrollment.onboarding_step > 1) continue

        const url = `https://squaad.com.br/metodo-squaad/onboarding/${enrollment.onboarding_token}`
        await sendWhatsApp(supabase, enrollment.whatsapp,
          `Oi ${enrollment.name}, passando aqui pra te lembrar de preencher seu onboarding do Metodo SQUAAD. E rapidinho e vai me ajudar a montar sua trilha de aulas personalizada.\n\n${url}\n\nBora dar esse primeiro passo juntos.`
        )
        // Marca enviado pra não repetir nos próximos crons
        await (supabase as any)
          .from('metodo_squaad_enrollments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', enrollment.id)
        onboardingReminders++
      }
      console.log(`Onboarding reminders: ${onboardingReminders}`)
    } catch (e) {
      console.error('Onboarding reminders error:', e)
    }

    // ==================== PROMISE REMINDERS ====================
    let promiseReminders = 0
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: promises } = await supabase
        .from('member_contracts')
        .select('id, promise_date, member_id, members(name, phone)')
        .eq('is_promise', true)
        .eq('promise_reminder_sent', false)
        .lte('promise_date', today)

      for (const p of (promises || [])) {
        const member = (p as any).members
        if (!member?.phone) continue

        await sendWhatsApp(supabase, member.phone,
          `Oi ${member.name}, tudo certo? Hoje e o dia que voce marcou pra gente acertar o pagamento. Me diz, consegue resolver hoje? Estou aqui pra te ajudar no que precisar.`
        )

        await supabase.from('member_contracts')
          .update({ promise_reminder_sent: true })
          .eq('id', p.id)

        promiseReminders++
      }
      console.log(`Promise reminders: ${promiseReminders}`)
    } catch (e) {
      console.error('Promise reminders error:', e)
    }

    return new Response(JSON.stringify({ ok: true, payments: payments.length, remindersSent, onboardingReminders, promiseReminders }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Billing reminders error:', error)
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
