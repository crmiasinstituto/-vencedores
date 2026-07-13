import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-member-token',
}

const UAZAPI_BASE_URL = 'https://squaad.uazapi.com'

// Auth guard:
//   • Edge runtime já valida o JWT (verify_jwt:true).
//   • Aqui diferenciamos: service_role token (chamadas internas de outras
//     edge functions) bypassa; user JWT precisa estar em app_admins.
//   Sem essa camada, qualquer admin do projeto OU qualquer authenticated
//   user poderia tomar conta da instância UAZAPI.
async function assertCallerAuthorized(req: Request): Promise<Response | null> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  // Caminho rápido: chamada interna de outra edge function.
  if (token === SERVICE_ROLE_KEY) return null

  // Caminho admin via Supabase Auth.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: admin } = await adminClient
    .from('app_admins')
    .select('email')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (!admin) {
    console.warn(`[uazapi-proxy] forbidden: non-admin user ${user.email} tried to call`)
    return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const denial = await assertCallerAuthorized(req)
  if (denial) return denial

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, instance_id, ...params } = body

    let instance: any = null
    if (instance_id) {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instance_id)
        .single()
      if (error) throw new Error(`Instance not found: ${error.message}`)
      instance = data
    }

    let result: any

    switch (action) {
      // ==================== INSTANCE MANAGEMENT ====================

      case 'create_instance': {
        const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN')!
        const res = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
          body: JSON.stringify({ name: params.name || 'squaad-crm' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`UAZAPI create failed [${res.status}]: ${JSON.stringify(data)}`)

        const { data: saved, error: saveErr } = await supabase
          .from('whatsapp_instances')
          .insert({
            instance_name: params.name || 'squaad-crm',
            instance_token: data.token || data.instance?.token,
            subdomain: 'squaad',
            admin_token: adminToken,
            status: 'disconnected',
            channel: params.channel || 'comercial',
          })
          .select()
          .single()
        if (saveErr) throw new Error(`Save failed: ${saveErr.message}`)
        result = { ...data, instance_id: saved.id }
        break
      }

      case 'connect': {
        if (!instance) throw new Error('instance_id required')
        const connectBody: any = {}
        if (params.phone) {
          connectBody.phone = params.phone.replace(/\D/g, '')
        }
        const res = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify(connectBody),
        })
        const data = await res.json()

        const qrCode = data?.instance?.qrcode || data?.qrcode || data?.qr || null
        await supabase.from('whatsapp_instances').update({
          status: 'connecting',
          qr_code: qrCode,
        }).eq('id', instance.id)

        result = data
        break
      }

      case 'status': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
          method: 'GET',
          headers: { 'token': instance.instance_token },
        })
        const data = await res.json()
        const instanceInfo = data?.instance || data || {}

        let rawStatus = instanceInfo.status || data.status || data.state || 'disconnected'
        // Normalize status: UAZAPI may return various values for "connected"
        const connectedValues = ['connected', 'true', 'online', 'authenticated', 'ready', 'open', 'CONNECTED']
        const newStatus = connectedValues.includes(String(rawStatus)) ? 'connected' : (rawStatus === 'connecting' ? 'connecting' : 'disconnected')
        const updateData: any = { status: newStatus }
        const qrFromStatus = instanceInfo.qrcode || data.qrcode || data.qr || null
        if (qrFromStatus) updateData.qr_code = qrFromStatus
        if (newStatus === 'connected') {
          updateData.qr_code = null
          const phone = instanceInfo.owner || data.phone || data.jid || ''
          if (phone) {
            updateData.phone_number = phone.replace('@s.whatsapp.net', '')
          }
        }

        await supabase.from('whatsapp_instances').update(updateData).eq('id', instance.id)
        result = { ...data, ...updateData }
        break
      }

      case 'disconnect': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
        })
        const data = await res.json()
        await supabase.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('id', instance.id)
        result = data
        break
      }

      case 'delete_instance': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/instance`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
        })
        const data = await res.json()
        await supabase.from('whatsapp_instances').delete().eq('id', instance.id)
        result = data
        break
      }

      // ==================== PROFILE ====================

      case 'profile_name': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/profile/name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ name: params.name }),
        })
        result = await res.json()
        break
      }

      case 'profile_image': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/profile/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ image: params.image }),
        })
        result = await res.json()
        break
      }

      // ==================== WEBHOOK ====================

      case 'set_webhook': {
        if (!instance) throw new Error('instance_id required')
        const webhookUrl = params.webhook_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/uazapi-webhook-receiver`
        const events = params.events || ['messages', 'connection', 'messages_update']
        const excludeMessages = params.exclude_messages || ['wasSentByApi']
        const res = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            events,
            excludeMessages: excludeMessages,
          }),
        })
        const data = await res.json()
        await supabase.from('whatsapp_instances').update({ webhook_url: webhookUrl }).eq('id', instance.id)
        result = data
        break
      }

      case 'get_webhook': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
          method: 'GET',
          headers: { 'token': instance.instance_token },
        })
        result = await res.json()
        break
      }

      // ==================== SEND MESSAGES ====================

      case 'send_text': {
        if (!instance) throw new Error('instance_id required')
        let number = (params.phone || params.number || '').replace(/\D/g, '')
        // Normalize Brazilian phone numbers to 13 digits (55 + DDD + 9 + 8 digits)
        if (!number.startsWith('55') && number.length >= 10 && number.length <= 11) {
          number = '55' + number
        }
        if (number.startsWith('55') && number.length === 12) {
          number = number.slice(0, 4) + '9' + number.slice(4)
        }
        console.log(`[uazapi-proxy] send_text to normalized number: ${number}`)
        const text = params.message || params.text || ''
        const sendBody: any = { number, text }
        if (params.readchat) sendBody.readchat = true
        if (params.readmessages) sendBody.readmessages = true
        if (params.delay) sendBody.delay = params.delay
        if (params.replyid) sendBody.replyid = params.replyid
        // Mencao em grupo (@participante). Aditivo: so entra no payload quando
        // vem uma lista de telefones. Se a UAZAPI ignorar o campo, o envio segue
        // normal (so nao dispara a notificacao). O texto ja chega com os tokens
        // @<numero> montados no front, que e o que o WhatsApp precisa pra renderizar.
        if (Array.isArray(params.mentions) && params.mentions.length) {
          sendBody.mentions = params.mentions
            .map((m: string) => String(m).replace(/\D/g, ''))
            .filter(Boolean)
        }

        const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify(sendBody),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Send failed [${res.status}]: ${JSON.stringify(data)}`)

        await supabase.from('whatsapp_messages').insert({
          instance_id: instance.id,
          lead_id: params.lead_id || null,
          board_id: params.board_id || null,
          remote_phone: number,
          direction: 'outbound',
          message_type: 'text',
          content: text,
          whatsapp_message_id: data.key?.id || data.messageId || null,
          status: 'sent',
          metadata: { ...data, sent_by: params.sent_by || 'agent', agent_id: params.agent_id || null },
        })

        result = data
        break
      }

      case 'send_media': {
        if (!instance) throw new Error('instance_id required')
        const number = (params.phone || params.number || '').replace(/\D/g, '')
        const mediaType = params.media_type || params.type || 'image'
        const file = params.media_url || params.file
        const caption = params.caption || params.text || ''
        const sendBody: any = { number, type: mediaType, file }
        if (caption) sendBody.text = caption
        if (params.docName) sendBody.docName = params.docName
        if (params.readchat) sendBody.readchat = true
        if (params.replyid) sendBody.replyid = params.replyid

        const res = await fetch(`${UAZAPI_BASE_URL}/send/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify(sendBody),
        })
        const data = await res.json()

        await supabase.from('whatsapp_messages').insert({
          instance_id: instance.id,
          lead_id: params.lead_id || null,
          board_id: params.board_id || null,
          remote_phone: number,
          direction: 'outbound',
          message_type: mediaType,
          content: caption,
          media_url: file,
          whatsapp_message_id: data.key?.id || data.messageId || null,
          status: 'sent',
          metadata: { ...data, sent_by: params.sent_by || 'agent', agent_id: params.agent_id || null },
        })

        result = data
        break
      }

      case 'send_contact': {
        if (!instance) throw new Error('instance_id required')
        const number = (params.phone || params.number || '').replace(/\D/g, '')
        const res = await fetch(`${UAZAPI_BASE_URL}/send/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number,
            fullName: params.fullName,
            phoneNumber: params.phoneNumber,
            organization: params.organization || '',
            email: params.email || '',
            url: params.url || '',
          }),
        })
        result = await res.json()
        break
      }

      case 'send_location': {
        if (!instance) throw new Error('instance_id required')
        const number = (params.phone || params.number || '').replace(/\D/g, '')
        const res = await fetch(`${UAZAPI_BASE_URL}/send/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number,
            name: params.name || '',
            address: params.address || '',
            latitude: params.latitude,
            longitude: params.longitude,
          }),
        })
        result = await res.json()
        break
      }

      case 'send_carousel': {
        if (!instance) throw new Error('instance_id required')
        const number = (params.phone || params.number || '').replace(/\D/g, '')
        const res = await fetch(`${UAZAPI_BASE_URL}/send/carousel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number,
            text: params.text || '',
            carousel: params.carousel || [],
            readchat: params.readchat || false,
          }),
        })
        result = await res.json()
        break
      }

      // ==================== MESSAGE ACTIONS ====================

      case 'message_react': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/message/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number: params.number,
            text: params.emoji || params.text,
            id: params.message_id || params.id,
          }),
        })
        result = await res.json()
        break
      }

      case 'message_delete': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/message/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ id: params.message_id || params.id }),
        })
        result = await res.json()
        break
      }

      case 'message_edit': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/message/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            id: params.message_id || params.id,
            text: params.text,
          }),
        })
        result = await res.json()
        break
      }

      case 'message_download': {
        if (!instance) throw new Error('instance_id required')
        const downloadBody: any = { id: params.message_id || params.id }
        if (params.return_base64) downloadBody.return_base64 = true
        if (params.generate_mp3 !== undefined) downloadBody.generate_mp3 = params.generate_mp3
        if (params.return_link !== undefined) downloadBody.return_link = params.return_link
        if (params.transcribe) downloadBody.transcribe = true
        if (params.download_quoted) downloadBody.download_quoted = true

        const res = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify(downloadBody),
        })
        result = await res.json()
        break
      }

      // ==================== CHAT ACTIONS ====================

      case 'chat_read': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/chat/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number: params.number,
            read: params.read !== undefined ? params.read : true,
          }),
        })
        result = await res.json()
        break
      }

      case 'chat_find': {
        if (!instance) throw new Error('instance_id required')
        const findBody: any = {
          sort: params.sort || '-wa_lastMsgTimestamp',
          limit: params.limit || 50,
          offset: params.offset || 0,
        }
        if (params.operator) findBody.operator = params.operator
        if (params.wa_isGroup !== undefined) findBody.wa_isGroup = params.wa_isGroup
        if (params.wa_name) findBody.wa_name = params.wa_name
        if (params.wa_chatid) findBody.wa_chatid = params.wa_chatid
        if (params.lead_status) findBody.lead_status = params.lead_status

        const res = await fetch(`${UAZAPI_BASE_URL}/chat/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify(findBody),
        })
        result = await res.json()
        break
      }

      case 'chat_archive': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/chat/archive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number: params.number,
            archive: params.archive !== undefined ? params.archive : true,
          }),
        })
        result = await res.json()
        break
      }

      case 'chat_mute': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/chat/mute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number: params.number,
            muteEndTime: params.muteEndTime || 0,
          }),
        })
        result = await res.json()
        break
      }

      case 'chat_pin': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/chat/pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number: params.number,
            pin: params.pin !== undefined ? params.pin : true,
          }),
        })
        result = await res.json()
        break
      }

      case 'chat_details': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/chat/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number: params.number,
            preview: params.preview !== undefined ? params.preview : false,
          }),
        })
        result = await res.json()
        break
      }

      case 'chat_details_edit': {
        if (!instance) throw new Error('instance_id required')
        const editBody: any = { id: `${params.number}@s.whatsapp.net` }
        if (params.lead_name) editBody.lead_name = params.lead_name
        if (params.lead_email) editBody.lead_email = params.lead_email
        if (params.lead_status) editBody.lead_status = params.lead_status
        if (params.lead_notes) editBody.lead_notes = params.lead_notes
        if (params.lead_tags) editBody.lead_tags = params.lead_tags
        const res = await fetch(`${UAZAPI_BASE_URL}/chat/editLead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify(editBody),
        })
        result = await res.json()
        break
      }

      case 'chat_delete': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/chat/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            number: params.number,
            deleteChatDB: params.deleteChatDB || false,
            deleteMessagesDB: params.deleteMessagesDB || false,
            deleteChatWhatsApp: params.deleteChatWhatsApp || true,
          }),
        })
        result = await res.json()
        break
      }

      // ==================== GROUPS ====================

      case 'group_add_participant': {
        if (!instance) throw new Error('instance_id required')
        const cleanedJid = String(params.group_jid || params.groupjid || '').replace('@g.us', '').trim()
        if (!cleanedJid) throw new Error('group_jid required')
        const groupJid = `${cleanedJid}@g.us`
        const rawList: any[] = Array.isArray(params.phones) ? params.phones : [params.phone || params.number]
        const phones = rawList.filter(Boolean).map((p: any) => {
          let n = String(p).replace(/\D/g, '')
          if (!n.startsWith('55') && n.length >= 10 && n.length <= 11) n = '55' + n
          if (n.startsWith('55') && n.length === 12) n = n.slice(0, 4) + '9' + n.slice(4)
          return n
        }).filter((n: string) => n.length >= 12)
        if (phones.length === 0) throw new Error('phone(s) required')
        const action = (params.op || params.subaction || 'add').toLowerCase()
        console.log(`[uazapi-proxy] group_${action} group=${groupJid} phones=${phones.join(',')}`)
        const res = await fetch(`${UAZAPI_BASE_URL}/group/updateParticipants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({
            groupjid: groupJid,
            action,
            participants: phones,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Group ${action} failed [${res.status}]: ${JSON.stringify(data)}`)
        result = data
        break
      }

      case 'group_participants': {
        // Roster COMPLETO do grupo via /group/info (o espiao so grava quem ja
        // falou). Usado pelo autocomplete de @mencao. Retorna a lista pro front
        // e, se o grupo estiver cadastrado em whatsapp_groups, faz upsert no
        // cache whatsapp_group_participants.
        if (!instance) throw new Error('instance_id required')
        const cleanedJid = String(params.group_jid || params.groupjid || params.phone || '').replace(/@.*$/, '').replace(/\D/g, '')
        if (!cleanedJid) throw new Error('group_jid required')
        const groupJid = `${cleanedJid}@g.us`
        const res = await fetch(`${UAZAPI_BASE_URL}/group/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ groupjid: groupJid }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`group/info failed [${res.status}]: ${JSON.stringify(data)}`)
        const rawParts: any[] = data?.Participants || data?.participants || data?.members || []
        const participants = rawParts.map((p: any) => {
          const id = p?.id || p?.jid || p?.phone || p?.number || p?.user || ''
          const phone = String(id).replace(/@.*$/, '').replace(/\D/g, '')
          const name = (p?.name || p?.notify || p?.pushname || p?.short || p?.verifiedName || '').trim() || null
          return { phone, name }
        }).filter((p: any) => p.phone && p.phone.length >= 8)

        // Upsert no cache se o grupo existir (a tabela exige group_id)
        try {
          const { data: grp } = await supabase.from('whatsapp_groups').select('id').eq('group_jid', cleanedJid).maybeSingle()
          if (grp?.id && participants.length) {
            for (const pt of participants) {
              const { data: exP } = await supabase.from('whatsapp_group_participants')
                .select('id').eq('group_id', grp.id).eq('phone', pt.phone).maybeSingle()
              if (exP) {
                if (pt.name) await supabase.from('whatsapp_group_participants').update({ name: pt.name }).eq('id', exP.id)
              } else {
                await supabase.from('whatsapp_group_participants').insert({
                  group_id: grp.id, group_jid: cleanedJid, phone: pt.phone, name: pt.name, message_count: 0,
                })
              }
            }
          }
        } catch (e) {
          console.warn('[group_participants] upsert skipped:', (e as Error).message)
        }

        result = { participants, count: participants.length }
        break
      }

      // ==================== AI AGENTS ====================

      case 'agent_list': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/agent/list`, { method: 'GET', headers: { 'token': instance.instance_token } })
        result = await res.json()
        break
      }

      case 'agent_edit': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/agent/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ id: params.agent_id || '', delete: params.delete || false, agent: params.agent || {} }),
        })
        result = await res.json()
        break
      }

      case 'trigger_list': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/trigger/list`, { method: 'GET', headers: { 'token': instance.instance_token } })
        result = await res.json()
        break
      }

      case 'trigger_edit': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/trigger/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ id: params.trigger_id || '', delete: params.delete || false, trigger: params.trigger || {} }),
        })
        result = await res.json()
        break
      }

      case 'knowledge_list': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/knowledge/list`, { method: 'GET', headers: { 'token': instance.instance_token } })
        result = await res.json()
        break
      }

      case 'knowledge_edit': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/knowledge/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ id: params.knowledge_id || '', delete: params.delete || false, knowledge: params.knowledge || {} }),
        })
        result = await res.json()
        break
      }

      case 'function_list': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/function/list`, { method: 'GET', headers: { 'token': instance.instance_token } })
        result = await res.json()
        break
      }

      case 'function_edit': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/function/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify({ id: params.function_id || '', delete: params.delete || false, function: params.function_data || {} }),
        })
        result = await res.json()
        break
      }

      case 'update_chatbot_settings': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/instance/updatechatbotsettings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instance.instance_token },
          body: JSON.stringify(params.settings || {}),
        })
        result = await res.json()
        break
      }

      case 'get_chatbot_settings': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/instance/updatechatbotsettings`, {
          method: 'GET',
          headers: { 'token': instance.instance_token },
        })
        result = await res.json()
        break
      }

      // ==================== LEGACY ====================

      case 'get_chats': {
        if (!instance) throw new Error('instance_id required')
        const res = await fetch(`${UAZAPI_BASE_URL}/chats/list`, { method: 'GET', headers: { 'token': instance.instance_token } })
        result = await res.json()
        break
      }

      case 'get_messages': {
        if (!instance) throw new Error('instance_id required')
        const phone = (params.phone || '').replace(/\D/g, '')
        const res = await fetch(`${UAZAPI_BASE_URL}/chats/messages/${phone}@s.whatsapp.net?limit=${params.limit || 50}`, { method: 'GET', headers: { 'token': instance.instance_token } })
        result = await res.json()
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('uazapi-proxy error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
