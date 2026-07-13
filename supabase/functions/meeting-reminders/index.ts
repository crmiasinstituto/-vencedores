import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UAZAPI_BASE_URL = 'https://squaad.uazapi.com'

// Admin phone (Carlos Eduardo)
const ADMIN_PHONE = '5511999999999' // Will be fetched from config

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
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_token')
      .eq('status', 'connected')
      .limit(1)

    if (!instances?.[0]) {
      console.log('No connected WhatsApp instance')
      return
    }

    const cleanPhone = normalizeBRPhone(phone)
    
    const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instances[0].instance_token },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    })
    
    const result = await res.json()
    console.log(`WhatsApp sent to ${cleanPhone}:`, result?.status || 'ok')
  } catch (e) {
    console.error('Failed to send WhatsApp:', e)
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

    // Only send during allowed hours (06:00-22:00 BRT)
    if (!isAllowedHours()) {
      console.log('Outside allowed hours, skipping reminders')
      return new Response(JSON.stringify({ ok: true, skipped: 'outside_allowed_hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 65 * 60 * 1000) // 65 min window
    const oneDayFromNow = new Date(now.getTime() + 24.5 * 60 * 60 * 1000) // 24.5 hour window
    const oneDayMinWindow = new Date(now.getTime() + 23.5 * 60 * 60 * 1000) // 23.5 hour window

    // Fetch upcoming scheduled meetings
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, title, scheduled_at, lead_id, meeting_url, metadata, crm_leads!inner(name, whatsapp)')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', oneDayFromNow.toISOString())

    if (error) {
      console.error('Error fetching meetings:', error)
      throw error
    }

    if (!meetings || meetings.length === 0) {
      console.log('No upcoming meetings')
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let remindersSent = 0

    for (const meeting of meetings) {
      const meta = (meeting.metadata as any) || {}
      const scheduledAt = new Date(meeting.scheduled_at)
      const lead = (meeting as any).crm_leads
      const leadName = lead?.name || 'Lead'
      const leadPhone = lead?.whatsapp
      const timeDiffMs = scheduledAt.getTime() - now.getTime()
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60)
      
      const dateStr = scheduledAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      const isPresencial = meta.meeting_type === 'presencial'
      const address = meta.address || ''

      // ====== 1 DAY REMINDER ======
      if (timeDiffHours >= 23.5 && timeDiffHours <= 24.5 && !meta.reminder_1d_sent) {
        // Send to lead
        if (leadPhone) {
          let msg = `Olá ${leadName}! 👋\n\n⏰ *Lembrete:* Sua reunião *"${meeting.title}"* está marcada para *amanhã*!\n\n📅 *Data:* ${dateStr}\n⏰ *Horário:* ${timeStr}`
          if (isPresencial && address) msg += `\n📍 *Local:* ${address}`
          else if (meeting.meeting_url) msg += `\n🔗 *Link:* ${meeting.meeting_url}`
          msg += '\n\nContamos com sua presença! 🚀\n\n_SQUAAD — Inteligência Artificial para Negócios_'
          await sendWhatsApp(supabase, leadPhone, msg)
        }

        // Send to admin
        const adminMsg = `📋 *Lembrete de Reunião (amanhã)*\n\n👤 *Lead:* ${leadName}\n📅 *Data:* ${dateStr}\n⏰ *Horário:* ${timeStr}\n📌 *Título:* ${meeting.title}${isPresencial ? `\n📍 *Local:* ${address}` : ''}`
        // Get admin phone from first user or hardcoded
        const { data: adminInstances } = await supabase.from('whatsapp_instances').select('phone_number').limit(1)
        const adminPhone = adminInstances?.[0]?.phone_number
        if (adminPhone) await sendWhatsApp(supabase, adminPhone, adminMsg)

        // Mark as sent
        await supabase.from('meetings').update({
          metadata: { ...meta, reminder_1d_sent: true }
        }).eq('id', meeting.id)
        remindersSent++
      }

      // ====== 1 HOUR REMINDER ======
      if (timeDiffHours >= 0.5 && timeDiffHours <= 1.1 && !meta.reminder_1h_sent) {
        // Send to lead
        if (leadPhone) {
          let msg = `${leadName}, sua reunião *"${meeting.title}"* começa em *1 hora*! ⏰\n\n📅 *Hoje:* ${timeStr}`
          if (isPresencial && address) msg += `\n📍 *Local:* ${address}`
          else if (meeting.meeting_url) msg += `\n🔗 *Link:* ${meeting.meeting_url}`
          msg += '\n\nTe esperamos! 💪'
          await sendWhatsApp(supabase, leadPhone, msg)
        }

        // Send to admin
        const adminMsg = `🔔 *Reunião em 1 hora!*\n\n👤 *Lead:* ${leadName}\n⏰ *Horário:* ${timeStr}\n📌 *Título:* ${meeting.title}${isPresencial ? `\n📍 *Local:* ${address}` : `\n🔗 ${meeting.meeting_url || ''}`}`
        const { data: adminInstances } = await supabase.from('whatsapp_instances').select('phone_number').limit(1)
        const adminPhone = adminInstances?.[0]?.phone_number
        if (adminPhone) await sendWhatsApp(supabase, adminPhone, adminMsg)

        // Mark as sent
        await supabase.from('meetings').update({
          metadata: { ...meta, reminder_1h_sent: true }
        }).eq('id', meeting.id)
        remindersSent++
      }
    }

    console.log(`Sent ${remindersSent} reminders for ${meetings.length} meetings`)

    return new Response(JSON.stringify({ ok: true, meetings: meetings.length, remindersSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Meeting reminders error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
