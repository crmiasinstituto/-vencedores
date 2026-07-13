// base64url inline (sem deno.land/std nem jsr: pra evitar BOOT_ERROR no edge).
function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-member-token',
}

// Generate LiveKit JWT token manually (no SDK needed)
async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  identity: string,
  name: string,
  grants: Record<string, any>,
  metadata?: string,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)

  const payload: Record<string, any> = {
    iss: apiKey,
    sub: identity,
    name,
    nbf: now,
    exp: now + 6 * 60 * 60, // 6 hours
    iat: now,
    jti: crypto.randomUUID(),
    video: {
      room: roomName,
      roomJoin: true,
      ...grants,
    },
  }
  if (metadata) payload.metadata = metadata

  const enc = new TextEncoder()
  const headerB64 = base64url(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput))
  const sigB64 = base64url(new Uint8Array(sig))

  return `${headerB64}.${payloadB64}.${sigB64}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { roomName, participantName, role, leadId, metadata } = await req.json()

    if (!roomName || !participantName) {
      return new Response(JSON.stringify({ error: 'roomName and participantName required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('LIVEKIT_API_KEY')
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const wsUrl = Deno.env.get('LIVEKIT_URL')

    if (!apiKey || !apiSecret || !wsUrl) {
      throw new Error('LiveKit not configured')
    }

    let grants: Record<string, any> = {}
    const meta = JSON.stringify({ role: role || 'guest', leadId, ...(metadata || {}) })

    if (role === 'observer') {
      grants = { canPublish: false, canSubscribe: true, canPublishData: true, hidden: true }
    } else if (role === 'host') {
      grants = { canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: true, roomRecord: true }
    } else {
      grants = { canPublish: true, canSubscribe: true, canPublishData: true }
    }

    // Identity tem que ser UNICA por participante — se duas conexoes usarem
    // a mesma identity (ex.: dois "Host", ou dois leads sem name diferenciado),
    // a 2a conexao kica a 1a (DUPLICATE_IDENTITY) e ninguem se ve.
    // - guest com leadId: usa leadId (estavel, permite reconexao)
    // - guest sem leadId: nome + sufixo random
    // - host: 'host-' + sufixo random
    // - observer: 'observer-' + sufixo random
    const rand = crypto.randomUUID().slice(0, 8)
    let identity: string
    if (role === 'host') {
      identity = `host-${rand}`
    } else if (role === 'observer') {
      identity = `observer-${rand}`
    } else if (leadId) {
      identity = `lead-${leadId}`
    } else {
      identity = `guest-${(participantName || 'p').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}-${rand}`
    }

    const token = await createLiveKitToken(
      apiKey, apiSecret, roomName, identity, participantName, grants, meta
    )

    return new Response(JSON.stringify({ token, url: wsUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('livekit-token error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
