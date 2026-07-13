import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))

    // Get connected instance
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_token')
      .eq('status', 'connected')
      .limit(1)

    if (!instances?.[0]) {
      return new Response(JSON.stringify({ error: 'No connected instance' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const instance = instances[0]
    console.log(`[SYNC] Starting sync for instance ${instance.id}`)

    // Use chat_find with empty query to get all recent chats
    const res = await fetch(`${UAZAPI_BASE_URL}/chat/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
      body: JSON.stringify({ query: '' }),
    })
    const chatData = await res.json()

    const allChats = chatData?.chats || chatData?.data?.chats || (Array.isArray(chatData) ? chatData : [])
    console.log(`[SYNC] Got ${allChats.length} chats from UAZAPI`)

    if (!allChats.length) {
      return new Response(JSON.stringify({ error: 'No chats found', raw_keys: Object.keys(chatData) }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get existing CRM leads
    const { data: leads } = await supabase
      .from('crm_leads')
      .select('id, name, whatsapp, whatsapp_profile_pic_url')

    const leadMap = new Map<string, any>()
    if (leads) {
      for (const lead of leads) {
        const clean = normalizeBRPhone(lead.whatsapp?.replace(/\D/g, '') || '')
        if (clean) leadMap.set(clean, lead)
      }
    }

    // Get all existing phones in whatsapp_messages to avoid duplicates
    const { data: existingPhones } = await supabase
      .from('whatsapp_messages')
      .select('remote_phone')
    const existingSet = new Set((existingPhones || []).map((p: any) => p.remote_phone))

    // Process chats in batch
    const toInsert: any[] = []
    const photoUpdates: { id: string; pic: string }[] = []

    for (const chat of allChats) {
      const chatId = chat.wa_chatid || chat.id || ''
      if (!chatId) continue

      const isGroup = chatId.endsWith('@g.us')
      const rawPhone = chatId.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '')
      if (!rawPhone || rawPhone.length < 8) continue

      const phone = isGroup ? rawPhone : normalizeBRPhone(rawPhone)
      const chatName = chat.name || chat.pushName || chat.notify || chat.subject || phone
      const chatPic = chat.image || chat.imagePreview || null
      const lastMsg = chat.lastMessage || chat.body || ''
      const lead = isGroup ? null : leadMap.get(phone)

      if (!existingSet.has(phone)) {
        toInsert.push({
          instance_id: instance.id,
          remote_phone: phone,
          direction: 'inbound',
          content: lastMsg ? String(lastMsg).substring(0, 500) : '(sincronizado)',
          message_type: 'text',
          status: 'delivered',
          is_read: true,
          lead_id: lead?.id || null,
          metadata: {
            contact_name: chatName,
            senderName: chatName,
            isGroup,
            groupName: isGroup ? chatName : null,
            chat_details_pic: chatPic,
            synced: true,
          },
        })
        existingSet.add(phone)
      }

      if (lead && chatPic && !lead.whatsapp_profile_pic_url) {
        photoUpdates.push({ id: lead.id, pic: chatPic })
      }
    }

    // Batch insert messages (chunks of 50)
    let synced = 0
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50)
      const { error } = await supabase.from('whatsapp_messages').insert(chunk)
      if (!error) synced += chunk.length
      else console.error('[SYNC] Batch insert error:', error.message)
    }

    // Batch update photos
    let photosUpdated = 0
    for (const { id, pic } of photoUpdates) {
      await supabase.from('crm_leads').update({ whatsapp_profile_pic_url: pic }).eq('id', id)
      photosUpdated++
    }

    console.log(`[SYNC] Done: ${synced} new contacts, ${photosUpdated} photos`)

    return new Response(JSON.stringify({
      success: true,
      total_chats: allChats.length,
      new_contacts_synced: synced,
      photos_updated: photosUpdated,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[SYNC] Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
