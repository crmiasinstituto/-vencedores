import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-member-token',
}

async function createServiceToken(apiKey: string, apiSecret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: apiKey, sub: apiKey, nbf: now, exp: now + 60, iat: now,
    jti: crypto.randomUUID(),
    video: { roomAdmin: true, roomCreate: true, roomList: true },
  }
  const enc = new TextEncoder()
  const headerB64 = base64url(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey('raw', enc.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${headerB64}.${payloadB64}`))
  return `${headerB64}.${payloadB64}.${base64url(new Uint8Array(sig))}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { roomName } = await req.json()
    if (!roomName) throw new Error('roomName required')

    const apiKey = Deno.env.get('LIVEKIT_API_KEY')!
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!
    const httpUrl = Deno.env.get('LIVEKIT_URL')!.replace('wss://', 'https://')

    const token = await createServiceToken(apiKey, apiSecret)

    await fetch(`${httpUrl}/twirp/livekit.RoomService/DeleteRoom`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomName }),
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
