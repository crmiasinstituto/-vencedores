import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UAZAPI_BASE_URL = 'https://squaad.uazapi.com'

// Names to never save as lead names (owner account names)
const NAME_BLOCKLIST = ['squaad', 'carlos eduardo']

function isBlockedName(name: string | null): boolean {
  if (!name) return true
  const lower = name.toLowerCase().trim()
  if (lower.length < 2) return true
  return NAME_BLOCKLIST.some(blocked => lower.includes(blocked))
}

// Normalize Brazilian phone numbers - ensure 13 digits (55 + DDD + 9 + 8 digits)
function normalizeBRPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('55') && clean.length === 12) {
    return clean.slice(0, 4) + '9' + clean.slice(4)
  }
  return clean
}

// Detect message type from UAZAPI flat fields
function detectMessageType(mediaType?: string, messageType?: string, type?: string): string {
  const raw = (mediaType || messageType || type || '').toLowerCase()
  if (raw.includes('sticker')) return 'sticker'
  if (raw.includes('image')) return 'image'
  if (raw.includes('video')) return 'video'
  if (raw === 'ptt' || raw.includes('ptt')) return 'ptt'
  if (raw.includes('audio')) return 'audio'
  if (raw.includes('document') || raw.includes('pdf')) return 'document'
  if (raw.includes('contact')) return 'text'
  if (raw.includes('location')) return 'text'
  return 'text'
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

    const payload = await req.json()
    console.log('Webhook payload keys:', Object.keys(payload))

    const event = payload.EventType || payload.event || payload.type || 'messages'
    console.log('Event type:', event)

    // ==================== STATUS UPDATES ====================
    if (event === 'messages_update') {
      const upd = payload.event
      if (upd?.MessageIDs && upd?.Type) {
        const newStatus = upd.Type === 'Delivered' ? 'delivered'
          : upd.Type === 'Read' ? 'read'
          : upd.Type === 'Played' ? 'read'
          : null
        if (newStatus) {
          for (const msgId of upd.MessageIDs) {
            // O id salvo no envio vem como "<remetente>:<waid>" (ex
            // 557583080330:3EB0...), mas o UAZAPI manda no status so o waid puro.
            // Casamos de forma tolerante nos dois sentidos (id exato, waid puro,
            // ou sufixo :waid) senao o status nunca vira entregue/lido.
            const bare = msgId.includes(':') ? msgId.split(':').pop() : msgId
            await supabase.from('whatsapp_messages')
              .update({ status: newStatus })
              .or(`whatsapp_message_id.eq.${msgId},whatsapp_message_id.eq.${bare},whatsapp_message_id.like.*:${bare}`)
          }
          console.log(`Updated messages to ${newStatus} (ids=${upd.MessageIDs.join(',')})`)
        }
      }
      return new Response(JSON.stringify({ ok: true, event: 'messages_update' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Skip non-message events
    if (event !== 'messages') {
      console.log('Skipping event:', event)
      return new Response(JSON.stringify({ ok: true, skipped: event }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== AUTO-HEAL INSTANCE STATUS ====================
    // If we're receiving messages, the instance IS connected - fix DB if needed
    await supabase.from('whatsapp_instances')
      .update({ status: 'connected' })
      .neq('status', 'connected')
      .then(({ error }) => { if (error) console.warn('Auto-heal status failed:', error) })

    // ==================== PROCESS MESSAGE ====================
    const message = payload.message || {}
    console.log('Message keys:', Object.keys(message))

    // ---- EXTRACT PHONE ----
    let remotePhone = ''
    const chatId = message.chatid || payload.chat?.wa_chatid || ''
    const isGroupChat = chatId.endsWith('@g.us')
    
    if (chatId) {
      remotePhone = chatId.replace('@s.whatsapp.net', '').replace('@g.us', '')
    }
    if (!remotePhone && message?.key?.remoteJid) {
      remotePhone = message.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
    }
    if (!remotePhone && message?.sender_pn) {
      remotePhone = String(message.sender_pn)
    }
    if (!remotePhone && payload.phone) {
      remotePhone = payload.phone
    }

    if (!remotePhone) {
      console.log('No phone found in payload')
      return new Response(JSON.stringify({ ok: true, skipped: 'no_phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normalize BR phone (skip for group IDs)
    if (!isGroupChat) {
      remotePhone = normalizeBRPhone(remotePhone)
    }

    // ---- CHECK fromMe ----
    const isFromMe = message.fromMe === true || message?.key?.fromMe === true
    const direction = isFromMe ? 'outbound' : 'inbound'
    console.log(`Message direction: ${direction} (fromMe=${isFromMe}), isGroup=${isGroupChat}`)

    // ==================== EXTRACT CONTENT (FLAT UAZAPI PAYLOAD) ====================
    let content = ''
    let messageType = 'text'
    let mediaUrl = ''
    const whatsappMessageId = message.id || message.messageid || message?.key?.id || null
    const senderName = message.senderName || ''
    const groupName = message.groupName || ''
    const isGroup = message.isGroup === true || isGroupChat

    // ==================== REACTION (👍 ❤️ 😂 etc) ====================
    // UAZAPI manda reactions como message.reaction (texto do emoji) ligado a um
    // message.quoted ou message.id da msg original. Quando isso vem, atualiza
    // o metadata.reactions da msg original em vez de inserir nova msg.
    const reactionText = (typeof message.reaction === 'string' && message.reaction)
      || (message?.message?.reactionMessage?.text)
      || (message?.content && typeof message.content === 'object' && message.content.reactionText)
      || null
    const reactionTargetId = message?.message?.reactionMessage?.key?.id
      || (message?.content && typeof message.content === 'object' && message.content.targetId)
      || message?.quoted?.id
      || null
    if (reactionText && reactionTargetId) {
      try {
        const { data: targetMsg } = await supabase.from('whatsapp_messages')
          .select('id, metadata').eq('whatsapp_message_id', reactionTargetId).maybeSingle()
        if (targetMsg) {
          const meta = (targetMsg.metadata || {}) as any
          const reactions = Array.isArray(meta.reactions) ? meta.reactions : []
          // Atualiza/adiciona reaction do sender (1 emoji por sender)
          const sender = message.sender_pn || message.sender || senderName || 'unknown'
          const idx = reactions.findIndex((r: any) => r.from === sender)
          const newReaction = { from: sender, name: senderName || null, emoji: reactionText, at: new Date().toISOString() }
          if (idx >= 0) reactions[idx] = newReaction
          else reactions.push(newReaction)
          await supabase.from('whatsapp_messages').update({
            metadata: { ...meta, reactions },
          }).eq('id', targetMsg.id)
          console.log(`[reaction] ${reactionText} from ${sender} on msg ${reactionTargetId}`)
        }
        return new Response(JSON.stringify({ ok: true, event: 'reaction' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (e) {
        console.error('[reaction] failed:', e)
      }
    }

    // Text content — UAZAPI 2.x manda message.content como OBJETO {PTT,URL,...}
    // pra midias, e string vazia em message.text. Se a gente colocasse o objeto
    // direto em content, o INSERT no PG (TEXT column) falhava silenciosamente
    // — root cause de "audio do lead nao chega".
    let textContent = ''
    if (typeof message.text === 'string') {
      textContent = message.text
    } else if (typeof message.content === 'string') {
      textContent = message.content
    } else if (message.content && typeof message.content === 'object') {
      // Se for caption embutida em content.text/caption, pega
      textContent = (message.content.text || message.content.caption || '') as string
    }
    messageType = detectMessageType(message.mediaType, message.messageType, message.type)

    // Se o payload jah trouxe a URL pra midia (UAZAPI 2.x faz isso em
    // message.content.URL), aproveita — eh url criptografada do WhatsApp,
    // mas o download via /message/download abaixo decifra.
    if (!mediaUrl && message.content && typeof message.content === 'object') {
      // nao usamos a URL .enc direto porque eh encrypted; manter mediaUrl
      // vazio aqui e deixar o download tentar baixar via UAZAPI.
    }

    if (messageType === 'text') {
      content = textContent
    } else {
      content = textContent
    }

    // Fallback nested format
    if (!content && message?.message) {
      const msg = message.message
      if (msg.conversation) {
        content = msg.conversation
        messageType = 'text'
      } else if (msg.extendedTextMessage?.text) {
        content = msg.extendedTextMessage.text
        messageType = 'text'
      } else if (msg.imageMessage) {
        messageType = 'image'
        content = msg.imageMessage.caption || ''
        mediaUrl = msg.imageMessage.url || ''
      } else if (msg.videoMessage) {
        messageType = 'video'
        content = msg.videoMessage.caption || ''
        mediaUrl = msg.videoMessage.url || ''
      } else if (msg.audioMessage) {
        messageType = msg.audioMessage.ptt ? 'ptt' : 'audio'
        mediaUrl = msg.audioMessage.url || ''
      } else if (msg.documentMessage) {
        messageType = 'document'
        content = msg.documentMessage.fileName || 'Documento'
        mediaUrl = msg.documentMessage.url || ''
      } else if (msg.stickerMessage) {
        messageType = 'sticker'
        mediaUrl = msg.stickerMessage.url || ''
        content = ''
      } else if (msg.contactMessage) {
        content = `📇 Contato: ${msg.contactMessage.displayName || ''}`
      } else if (msg.locationMessage) {
        content = `📍 Localização: ${msg.locationMessage.degreesLatitude}, ${msg.locationMessage.degreesLongitude}`
      }
    }

    console.log(`Content extracted: type=${messageType}, content="${content?.substring(0, 50)}", senderName="${senderName}", groupName="${groupName}", whatsappMessageId=${whatsappMessageId}`)
    if (messageType === 'audio' || messageType === 'ptt') {
      console.log(`[audio-inbound] phone=${remotePhone} msgId=${whatsappMessageId} mediaType=${message.mediaType} messageType=${message.messageType} type=${message.type} hasMessageObj=${!!message?.message}`)
    }

    // ==================== DOWNLOAD MEDIA IF NEEDED ====================
    // Find the correct instance by matching from payload headers or context
    const payloadInstanceId = payload.instance_id || payload.instanceId || null
    
    let instanceId: string | null = null
    let instanceToken: string | null = null

    if (payloadInstanceId) {
      const { data: inst } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_token, provider')
        .eq('id', payloadInstanceId)
        .eq('status', 'connected')
        .single()
      // Sanity: este webhook é UAZAPI. Se algum payload vier com instance_id de
      // Cloud API por engano, NÃO atribui (Cloud tem seu próprio webhook).
      if (inst && inst.provider !== 'cloud_api') {
        instanceId = inst.id
        instanceToken = inst.instance_token
      }
    }

    // Fallback: get any UAZAPI connected instance. NUNCA pega Cloud API aqui
    // (incidente Jane Bela 24/05/2026: webhook UAZAPI ecoava msg outbound e
    // gravava como duplicada atribuída à instância Cloud, leads viam 2 envios).
    if (!instanceToken) {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_token')
        .eq('status', 'connected')
        .eq('provider', 'uazapi')
        .limit(1)
      instanceId = instances?.[0]?.id || null
      instanceToken = instances?.[0]?.instance_token || null
    }

    const cleanPhone = remotePhone

    // OBS: o download da midia foi MOVIDO para DEPOIS do insert (secao
    // POST-INSERT ENRICH). Antes rodava aqui e segurava a gravacao da mensagem
    // por varios segundos (2 chamadas HTTP na UAZAPI + upload no Storage),
    // atrasando o realtime. Agora a mensagem e gravada primeiro e a midia
    // chega logo depois via UPDATE (segundo evento realtime).

    // ==================== HANDLE LOCATION MESSAGES ====================
    if (messageType === 'text' && content.startsWith('📍 Localização:')) {
      const coords = content.replace('📍 Localização: ', '').split(', ')
      if (coords.length === 2) {
        const [lat, lng] = coords
        content = `📍 Localização: ${lat}, ${lng}\nhttps://maps.google.com/?q=${lat},${lng}`
      }
    }

    // ==================== FIND MATCHING LEAD ====================
    const phoneVariants = [cleanPhone]
    if (!isGroupChat) {
      if (cleanPhone.startsWith('55')) {
        phoneVariants.push(cleanPhone.slice(2))
        if (cleanPhone.length === 13) {
          phoneVariants.push(cleanPhone.slice(0, 4) + cleanPhone.slice(5))
        }
      } else {
        phoneVariants.push('55' + cleanPhone)
      }
    }

    let leadId: string | null = null
    let boardId: string | null = null
    let leadMatchAmbiguous = false

    if (!isGroupChat) {
      // Match em ordem de especificidade: tenta primeiro o telefone exato como
      // veio no payload (cleanPhone normalizado), depois variantes. Assim
      // evitamos o caso "Victoria com 12 digitos" colidindo com "Ana com 13".
      const tryMatch = async (phone: string) => {
        const { data } = await supabase
          .from('crm_leads')
          .select('id, board_id')
          .eq('whatsapp', phone)
          .limit(2)
        return data || []
      }

      // 1) match exato preferencial
      let matched = await tryMatch(cleanPhone)
      // 2) se nao achou, tenta variantes (com/sem 9, com/sem 55)
      if (matched.length === 0) {
        for (const variant of phoneVariants) {
          if (variant === cleanPhone) continue
          matched = await tryMatch(variant)
          if (matched.length > 0) break
        }
      }

      if (matched.length === 1) {
        leadId = matched[0].id
        boardId = matched[0].board_id
      } else if (matched.length > 1) {
        // Multiplas leads com o mesmo telefone — anota como ambiguo e NAO escreve
        // foto pra nao contaminar a lead errada. Pega a primeira so pra link da
        // mensagem mas evita updates destrutivos.
        leadMatchAmbiguous = true
        leadId = matched[0].id
        boardId = matched[0].board_id
        console.warn(`[webhook] ambiguous lead match for phone ${cleanPhone} (${matched.length} leads). Skipping pic update.`)
      }
    }

    // ==================== NOME/FOTO BEST-EFFORT (SEM HTTP) ANTES DO INSERT ====================
    // O nome "real" do contato via /chat/details da UAZAPI e uma chamada HTTP
    // externa lenta. Antes ela rodava para TODA mensagem (ate texto puro) ANTES
    // do insert, atrasando o realtime. Agora usamos o que ja veio no payload
    // (inbound: senderName ja e o nome de quem escreveu; grupo: groupName) e o
    // /chat/details roda DEPOIS do insert refinando nome/foto via UPDATE.
    let chatDetails: any = null
    let chatDetailName: string | null = null
    let profilePic: string | null = payload.chat?.imagePreview || payload.chat?.image || null
    let contactName: string | null = null
    if (isGroup) {
      contactName = groupName || null
    } else if (isFromMe) {
      // Outbound: senderName e o NOSSO nome (ignora); o nome do contato so vem
      // do /chat/details, que roda pos-insert.
      contactName = null
    } else {
      // Inbound: senderName JA e o nome do contato
      contactName = senderName || null
    }
    if (isBlockedName(contactName)) contactName = null

    // ==================== SAVE MESSAGE ====================
    // Dedup em 2 niveis:
    //  L1) wamid bate (UAZAPI proxy salvou com wamid e webhook ecoa o mesmo)
    //  L2) outbound recente sem wamid (UAZAPI proxy as vezes salva sem wamid,
    //      e o webhook eco vem com o wamid certo). Janela: 60s, mesmo content+phone.
    //      Atualiza a row existente com wamid em vez de criar duplicada.
    //      (Incidente Jane Bela 24/05/2026: 2 mensagens iguais aparecendo na UI.)
    if (whatsappMessageId) {
      const { data: existing } = await supabase
        .from('whatsapp_messages')
        .select('id, status, media_url')
        .eq('whatsapp_message_id', whatsappMessageId)
        .limit(1)
        .maybeSingle()
      if (existing) {
        const updatePatch: Record<string, unknown> = {}
        if (mediaUrl && !existing.media_url) updatePatch.media_url = mediaUrl
        if (Object.keys(updatePatch).length > 0) {
          await supabase.from('whatsapp_messages').update(updatePatch).eq('id', existing.id)
        }
        console.log(`[dedup L1] echo ignored: ${whatsappMessageId} already saved`)
        return new Response(JSON.stringify({ ok: true, deduped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // L2: dedup defensivo pra echo de outbound sem wamid
    if (isFromMe && content && cleanPhone) {
      const sinceIso = new Date(Date.now() - 60_000).toISOString()
      const { data: recent } = await supabase
        .from('whatsapp_messages')
        .select('id, whatsapp_message_id')
        .eq('remote_phone', cleanPhone)
        .eq('direction', 'outbound')
        .eq('content', content)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (recent) {
        // Existe mensagem outbound recente igual. Em vez de duplicar, ATUALIZA
        // a row antiga com o wamid (se ainda nao tem). Webhook serve só pra
        // preencher dados que o uazapi-proxy nao tinha no momento do INSERT.
        if (whatsappMessageId && !recent.whatsapp_message_id) {
          await supabase
            .from('whatsapp_messages')
            .update({ whatsapp_message_id: whatsappMessageId })
            .eq('id', recent.id)
        }
        console.log(`[dedup L2] outbound echo ignored: same content+phone within 60s (existing: ${recent.id})`)
        return new Response(JSON.stringify({ ok: true, deduped: 'L2' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const { data: insertedRow, error: insertErr } = await supabase.from('whatsapp_messages').insert({
      instance_id: instanceId,
      lead_id: leadId,
      board_id: boardId,
      remote_phone: cleanPhone,
      direction,
      message_type: messageType,
      content: content || null,
      media_url: mediaUrl || null,
      whatsapp_message_id: whatsappMessageId,
      status: isFromMe ? 'sent' : 'received',
      is_read: isFromMe ? true : false,
      metadata: {
        senderName: senderName || null,
        contact_name: contactName || null,
        groupName: groupName || null,
        isGroup,
        chat_details_name: chatDetailName || null,
        chat_details_pic: profilePic || null,
        chat_imagePreview: payload.chat?.imagePreview || null,
        chat_image: payload.chat?.image || null,
      },
    }).select('id').maybeSingle()

    const insertedId = insertedRow?.id || null

    if (insertErr) {
      console.error('Error saving message:', insertErr, 'payload was:', { remote_phone: cleanPhone, message_type: messageType, lead_id: leadId, has_media_url: !!mediaUrl })
    } else {
      console.log(`Message saved from ${cleanPhone} -> lead: ${leadId}, type: ${messageType}, contactName: "${contactName}", content: "${content?.substring(0, 30)}"`)
    }

    // ==================== POST-INSERT ENRICH (nao segura o realtime) ====================
    // A mensagem JA foi gravada acima -> o realtime ja disparou e a UI ja
    // mostrou a bolha. Agora fazemos as chamadas HTTP lentas da UAZAPI (download
    // de midia + /chat/details pra nome/foto) e aplicamos via UPDATE, o que emite
    // um segundo evento realtime que completa a bolha. Isso vale so pra mensagens
    // genuinas (echoes/dedup ja retornaram acima antes de chegar aqui).

    // (1) Download da midia -> UPDATE media_url na row recem-criada
    if (insertedId && whatsappMessageId && ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(messageType) && !mediaUrl && instanceToken) {
      console.log(`[media-dl] starting download for ${messageType} msg=${whatsappMessageId}`)
      try {
        const dlRes = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instanceToken },
          body: JSON.stringify({ id: whatsappMessageId, return_link: true }),
        })
        const dlData = await dlRes.json()
        const url = dlData?.fileURL || dlData?.url || dlData?.link || dlData?.file_url || null
        if (url) {
          mediaUrl = url
          console.log(`[media-dl] got URL: ${mediaUrl} (mime=${dlData?.mimetype || 'unknown'})`)
        } else {
          console.warn(`[media-dl] no URL in response (keys=${Object.keys(dlData || {}).join(',')}) — tentando return_base64`)
        }
      } catch (e) {
        console.error(`[media-dl] return_link failed:`, e)
      }

      // Fallback: base64 -> upload pro Storage
      if (!mediaUrl) {
        try {
          const dlRes2 = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': instanceToken },
            body: JSON.stringify({ id: whatsappMessageId, return_base64: true }),
          })
          const dlData2 = await dlRes2.json()
          const base64Data = dlData2?.base64Data || dlData2?.data || dlData2?.fileBase64 || dlData2?.base64 || null
          if (base64Data) {
            const mimetype = dlData2?.mimetype || ''
            const ext = mimetype.includes('mpeg') ? 'mp3'
              : mimetype.includes('mp4') && messageType === 'video' ? 'mp4'
              : mimetype.includes('ogg') ? 'ogg'
              : mimetype.includes('webm') ? 'webm'
              : mimetype.includes('jpeg') || mimetype.includes('jpg') ? 'jpg'
              : mimetype.includes('png') ? 'png'
              : mimetype.includes('pdf') ? 'pdf'
              : messageType === 'image' ? 'jpg'
              : messageType === 'video' ? 'mp4'
              : messageType === 'audio' || messageType === 'ptt' ? 'mp3'
              : 'bin'
            const contentType = mimetype || (
              messageType === 'image' ? 'image/jpeg'
                : messageType === 'video' ? 'video/mp4'
                : messageType === 'audio' || messageType === 'ptt' ? 'audio/mpeg'
                : 'application/octet-stream'
            )
            const filePath = `webhook/${cleanPhone}/${Date.now()}.${ext}`
            const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '')
            const binaryString = atob(cleanBase64)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
            const { error: uploadError } = await supabase.storage
              .from('chat-media')
              .upload(filePath, bytes, { contentType })
            if (uploadError) {
              console.error(`[media-dl] storage upload failed:`, uploadError)
            } else {
              const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath)
              mediaUrl = urlData.publicUrl
              console.log(`[media-dl] uploaded to storage: ${mediaUrl}`)
            }
          } else {
            console.warn(`[media-dl] no base64 in fallback either (keys=${Object.keys(dlData2 || {}).join(',')}) — message stays without media_url`)
          }
        } catch (e) {
          console.error(`[media-dl] return_base64 fallback failed:`, e)
        }
      }

      if (mediaUrl) {
        await supabase.from('whatsapp_messages').update({ media_url: mediaUrl }).eq('id', insertedId)
      }
    }

    // (2) /chat/details -> nome/foto reais do contato. Refina o metadata da
    // mensagem e a foto do lead (com as mesmas defesas anti-vazamento).
    if (instanceToken && cleanPhone) {
      try {
        const detailsRes = await fetch(`${UAZAPI_BASE_URL}/chat/details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': instanceToken },
          body: JSON.stringify({ number: cleanPhone, preview: false }),
        })
        chatDetails = await detailsRes.json()
      } catch (e) {
        console.error('Chat details fetch failed:', e)
      }
    }

    if (chatDetails) {
      profilePic = chatDetails?.image || chatDetails?.imagePreview || profilePic
      chatDetailName = chatDetails?.lead_name || chatDetails?.wa_name || chatDetails?.wa_contactName || chatDetails?.name || null

      // Refina o contact_name: pra outbound e o unico jeito de saber o nome do
      // destinatario; pra inbound so usa como fallback se senderName veio vazio.
      let refinedName = contactName
      if (isGroup) refinedName = groupName || chatDetailName || contactName
      else if (isFromMe) refinedName = chatDetailName || contactName
      else refinedName = contactName || chatDetailName
      if (isBlockedName(refinedName)) refinedName = (chatDetailName && !isBlockedName(chatDetailName)) ? chatDetailName : null

      // UPDATE do metadata da mensagem (segundo evento realtime completa a bolha)
      if (insertedId && (refinedName !== contactName || chatDetailName || profilePic)) {
        await supabase.from('whatsapp_messages').update({
          metadata: {
            senderName: senderName || null,
            contact_name: refinedName || null,
            groupName: groupName || null,
            isGroup,
            chat_details_name: chatDetailName || null,
            chat_details_pic: profilePic || null,
            chat_imagePreview: payload.chat?.imagePreview || null,
            chat_image: payload.chat?.image || null,
          },
        }).eq('id', insertedId)
      }
      contactName = refinedName

      // UPDATE da foto do lead (mesmas defesas anti-vazamento [[wa-profile-pic-anti-leak]]):
      //  (1) match nao ambiguo  (2) URL nao em uso por OUTRA lead
      if (leadId && !isGroupChat) {
        const updateData: any = { updated_at: new Date().toISOString() }
        if (profilePic && !leadMatchAmbiguous) {
          const { count: collidingCount, error: collisionErr } = await supabase
            .from('crm_leads')
            .select('id', { count: 'exact', head: true })
            .eq('whatsapp_profile_pic_url', profilePic)
            .neq('id', leadId)
          if (collisionErr) {
            console.warn('Profile pic collision check failed, skipping save:', collisionErr.message)
          } else if ((collidingCount ?? 0) > 0) {
            console.warn(`Profile pic SKIPPED for lead ${leadId}: URL already in use by ${collidingCount} other lead(s). Suspeita de vazamento UAZAPI.`)
          } else {
            updateData.whatsapp_profile_pic_url = profilePic
          }
        }
        if (Object.keys(updateData).length > 1) {
          await supabase.from('crm_leads').update(updateData).eq('id', leadId)
        }
      }
    }

    // ==================== AUTO-ENRICH: refresh Instagram profile pic ====================
    // Toda vez que um lead manda msg pra gente, dispara o refresh da foto
    // do IG (em background, fire-and-forget). A funcao enrich-lead-on-inbound
    // Auto-trigger DISC PDF: se lead pediu o diagnostico e completou o quiz,
    // dispara envio. disc-pdf-deliver tem dedup interno via disc_pdf_requests.
    if (direction === 'inbound' && leadId && !isGroupChat && content && messageType === 'text') {
      const lower = content.toLowerCase()
      const isDiagRequest = /diagn[oó]stico|preciso.*pdf|disc.*pdf|raio-x/i.test(lower)
      if (isDiagRequest) {
        try {
          const { data: lead } = await supabase
            .from('crm_leads')
            .select('disc_profile')
            .eq('id', leadId)
            .maybeSingle()
          if (lead?.disc_profile) {
            const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/disc-pdf-deliver`
            fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({ lead_id: leadId }),
            }).catch(e => console.warn('[disc-trigger] failed:', e.message))
            console.log(`[disc-trigger] PDF requested by lead ${leadId} via inbound msg`)
          }
        } catch (e) {
          console.warn('[disc-trigger] check failed:', (e as Error).message)
        }
      }
    }

    // tem cache de 24h, entao nao estoura quota do ScrapCreator. So roda
    // pra leads identificados e com handle de Instagram preenchido.
    if (direction === 'inbound' && leadId && !isGroupChat) {
      try {
        const enrichUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-lead-on-inbound`
        // Fire-and-forget — nao espera resposta pra nao bloquear o webhook
        fetch(enrichUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ lead_id: leadId }),
        }).then(r => {
          if (!r.ok) console.warn(`[enrich-trigger] non-OK ${r.status} for lead ${leadId}`)
        }).catch(e => console.warn(`[enrich-trigger] failed for lead ${leadId}:`, e.message))
      } catch (e) {
        console.warn('[enrich-trigger] dispatch error:', (e as Error).message)
      }
    }

    // ==================== GROUP SPY: track group activity + detect questions ====================
    // Opt-in: só processa grupos ja cadastrados + com is_spy_active=true. Demais grupos sao ignorados.
    if (isGroupChat && content && instanceId) {
      try {
        const groupJid = chatId.replace('@g.us', '')

        const { data: existingGroup } = await supabase.from('whatsapp_groups')
          .select('id, is_spy_active, auto_detect_questions, total_messages').eq('group_jid', groupJid).maybeSingle()

        if (!existingGroup || !existingGroup.is_spy_active) {
          // Grupo nao cadastrado ou espiao desligado — ignora silenciosamente
          // (admin precisa adicionar manualmente em /admin/grupos)
          console.log(`[group-spy] skipping group ${groupJid} (not registered or spy off)`)
        } else {
          const groupId = existingGroup.id

          // Update message counter + last_message_at
          await supabase.from('whatsapp_groups').update({
            name: groupName || chatDetailName || undefined,
            last_message_at: new Date().toISOString(),
          }).eq('id', groupId)
          await supabase.rpc('increment_group_total_messages', { p_group_id: groupId }).catch(() => {})

          if (direction === 'inbound') {
          // Upsert participant by (group_id, phone)
          const participantPhone = (message.sender || message.participant || cleanPhone || '').replace(/@.+$/, '')
          if (participantPhone && participantPhone.length > 5) {
            const { data: existingP } = await supabase.from('whatsapp_group_participants')
              .select('id, message_count').eq('group_id', groupId).eq('phone', participantPhone).maybeSingle()

            if (existingP) {
              await supabase.from('whatsapp_group_participants').update({
                name: senderName || (existingP as any).name || null,
                message_count: ((existingP as any).message_count || 0) + 1,
                last_seen_at: new Date().toISOString(),
              }).eq('id', existingP.id)
            } else {
              // Try to match with a member by phone
              const { data: matchedMember } = await supabase.from('members')
                .select('id').eq('phone', participantPhone).limit(1).maybeSingle()
              await supabase.from('whatsapp_group_participants').insert({
                group_id: groupId,
                group_jid: groupJid,
                phone: participantPhone,
                name: senderName || null,
                matched_member_id: matchedMember?.id || null,
                message_count: 1,
              })
            }
          }

          // Detect if content is a question (simple heuristic + AI fallback)
          if (existingGroup?.auto_detect_questions !== false) {
            const looksLikeQuestion = /\?$|^(como|quando|onde|qual|quem|posso|poderia|será|alguém sabe|tem como|pode|dúvida)/i.test(content.trim())
            if (looksLikeQuestion && content.length > 10) {
              await supabase.from('whatsapp_group_questions').insert({
                group_id: groupId,
                participant_phone: participantPhone,
                participant_name: senderName || null,
                content: content.substring(0, 2000),
                priority: 'medium',
                answered: false,
              })
              await supabase.from('whatsapp_groups').update({
                total_questions: ((existingGroup as any)?.total_questions || 0) + 1,
              }).eq('id', groupId)
            }
          }
          } // end if (direction === 'inbound')
        } // end else (group is registered + spy active)
      } catch (e) {
        console.error('[group-spy] error:', e)
      }
    }

    // ==================== AUTO-PAUSE AGENT ON HUMAN TAKEOVER ====================
    // If this is an outbound message AND there's no matching agent-sent record
    // in the last 60s, it means a human replied manually from the phone.
    // Pause the agent for this lead so it doesn't step on the human's toes.
    if (direction === 'outbound' && leadId && content) {
      try {
        const sixtyAgoIso = new Date(Date.now() - 60_000).toISOString()
        const { data: priorAgentMsg } = await supabase.from('whatsapp_messages')
          .select('id, metadata')
          .eq('lead_id', leadId)
          .eq('direction', 'outbound')
          .eq('content', content)
          .gte('created_at', sixtyAgoIso)
          .limit(2)

        const wasAgentSent = (priorAgentMsg || []).some((m: any) => m.metadata?.sent_by === 'agent')
        if (!wasAgentSent) {
          const pauseHours = 24
          const pauseUntil = new Date(Date.now() + pauseHours * 3600_000).toISOString()
          await supabase.from('ai_agent_conversations').update({
            status: 'paused',
            paused_by: 'human_takeover',
            paused_at: new Date().toISOString(),
            pause_reason: 'Humano respondeu manualmente pelo WhatsApp',
            pause_until: pauseUntil,
            updated_at: new Date().toISOString(),
          }).eq('lead_id', leadId)

          // Also set chatbot_paused_until so the legacy v1 path respects it
          await supabase.from('crm_leads').update({
            chatbot_paused_until: pauseUntil,
          }).eq('id', leadId)

          console.log(`[AUTO-PAUSE] Human takeover detected for lead ${leadId}, paused until ${pauseUntil}`)
        }
      } catch (e) {
        console.error('[AUTO-PAUSE] Error:', e)
      }
    }

    // ==================== TRIGGER AI SALES AGENT (ASYNC) ====================
    if (direction === 'inbound' && !isGroupChat && content && instanceId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // Pick v2 if the instance is opted-in
        const { data: instanceRow } = await supabase.from('whatsapp_instances')
          .select('agent_version, ai_agent_id').eq('id', instanceId).maybeSingle()
        const agentVersion = (instanceRow as any)?.agent_version === 'v2' ? 'v2' : 'v1'
        const endpoint = agentVersion === 'v2' ? 'ai-sales-agent-v2' : 'ai-sales-agent'

        const body = agentVersion === 'v2'
          ? {
              lead_id: leadId,
              instance_id: instanceId,
              message_text: content,
              message_id: null,
              agent_id: (instanceRow as any)?.ai_agent_id || null,
            }
          : {
              message: content,
              lead_id: leadId || null,
              instance_id: instanceId,
              from_number: cleanPhone,
            }

        fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(body),
        }).catch(e => console.error(`AI sales agent (${agentVersion}) trigger failed:`, e))
        console.log(`AI sales agent ${agentVersion} triggered for ${cleanPhone} (instance: ${instanceId})`)
      } catch (e) {
        console.error('AI sales agent trigger error:', e)
      }
    }

    // ==================== TRIGGER SPY AGENT ANALYSIS (ASYNC) ====================
    if (leadId && direction === 'inbound' && !isGroupChat) {
      try {
        // Check if chatbot is paused for this lead
        const { data: leadPause } = await supabase
          .from('crm_leads')
          .select('chatbot_paused_until')
          .eq('id', leadId)
          .single()

        const pausedUntil = (leadPause as any)?.chatbot_paused_until
        const isPaused = pausedUntil && new Date(pausedUntil) > new Date()

        if (isPaused) {
          console.log(`Chatbot paused for lead ${leadId} until ${pausedUntil}, skipping analysis`)
        } else {
          // Count recent inbound messages since last analysis
          const { count: recentCount } = await supabase
            .from('whatsapp_messages')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', leadId)
            .eq('direction', 'inbound')
            .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())

          if (recentCount && recentCount >= 3) {
            // Fire-and-forget: call analyze-conversation
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            fetch(`${supabaseUrl}/functions/v1/analyze-conversation`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ lead_id: leadId }),
            }).catch(e => console.error('Spy agent trigger failed:', e))
            console.log(`Spy agent triggered for lead ${leadId} (${recentCount} recent inbound msgs)`)
          }
        }
      } catch (e) {
        console.error('Spy agent check failed:', e)
      }
    }

    return new Response(JSON.stringify({ ok: true, leadId, phone: cleanPhone, messageType, hasContent: !!content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
