import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-member-token',
}

async function createServiceToken(apiKey: string, apiSecret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: apiKey, sub: apiKey, nbf: now, exp: now + 600, iat: now,
    jti: crypto.randomUUID(),
    video: { roomAdmin: true, roomCreate: true, roomList: true, roomRecord: true },
  }
  const enc = new TextEncoder()
  const headerB64 = base64url(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey('raw', enc.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${headerB64}.${payloadB64}`))
  return `${headerB64}.${payloadB64}.${base64url(new Uint8Array(sig))}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { roomName, action } = await req.json()
    if (!roomName) throw new Error('roomName required')

    const apiKey = Deno.env.get('LIVEKIT_API_KEY')!
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!
    const httpUrl = Deno.env.get('LIVEKIT_URL')!.replace('wss://', 'https://')

    const s3Endpoint = Deno.env.get('S3_ENDPOINT')
    const s3AccessKey = Deno.env.get('S3_ACCESS_KEY')
    const s3SecretKey = Deno.env.get('S3_SECRET_KEY')
    const s3Bucket = Deno.env.get('S3_BUCKET') || 'meeting-recordings'
    const s3Region = Deno.env.get('S3_REGION') || 'auto'
    const s3PublicUrl = Deno.env.get('S3_PUBLIC_URL')

    const token = await createServiceToken(apiKey, apiSecret)

    if (action === 'stop' || action === 'pause') {
      // List active egresses for the room
      const listRes = await fetch(`${httpUrl}/twirp/livekit.Egress/ListEgress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: roomName }),
      })
      const listData = await listRes.json()
      // IMPORTANTE: o LiveKit retorna status ora como NUMERO (0/1) ora como TEXTO
      // ('EGRESS_STARTING'/'EGRESS_ACTIVE'). Se filtrar so por numero, o pause NAO
      // acha o egress ativo -> nao para a gravacao e nao registra a pausa -> a
      // gravacao continua e o video sai continuo. Tem que cobrir os dois formatos
      // (mesma logica do cleanup de orfaos mais abaixo).
      const activeEgresses = (listData.items || []).filter((e: any) =>
        e.status === 0 || e.status === 1 ||
        e.status === 'EGRESS_STARTING' || e.status === 'EGRESS_ACTIVE'
      )
      const activeEgressIds = activeEgresses.map((e: any) => e.egress_id)

      // Bug fix: webhook nao deve usar recording_status pra detectar pause vs final,
      // pq pause -> resume rapido faz o status virar 'recording' ANTES do webhook do
      // segmento pausado chegar (LK demora ate 30s pra EGRESS_COMPLETE). Solucao:
      // registra os egress_ids que estao sendo pausados/parados na metadata e o
      // webhook olha essa lista pra decidir se dispara o pipeline ou nao.
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

      if (action === 'pause') {
        // Pause: registra os egress_ids pausados e marca 'paused'. NUNCA seta
        // 'processing' (mesmo se a lista vier vazia), senao o webhook trataria
        // o trecho como final e encerraria a gravacao no meio.
        const { data: m } = await supabase.from('meetings')
          .select('metadata')
          .eq('livekit_room_name', roomName)
          .maybeSingle()
        const prevMeta = ((m as any)?.metadata) || {}
        const prevPaused = Array.isArray(prevMeta.paused_egresses) ? prevMeta.paused_egresses : []
        const newPaused = [...new Set([...prevPaused, ...activeEgressIds])]
        await supabase.from('meetings').update({
          recording_status: 'paused',
          metadata: { ...prevMeta, paused_egresses: newPaused },
        }).eq('livekit_room_name', roomName)
      } else {
        // stop final: nao registra como pause; webhook vai disparar pipeline
        await supabase.from('meetings').update({
          recording_status: 'processing',
        }).eq('livekit_room_name', roomName)
      }

      for (const egress of activeEgresses) {
        await fetch(`${httpUrl}/twirp/livekit.Egress/StopEgress`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ egress_id: egress.egress_id }),
        })
      }

      return new Response(JSON.stringify({ success: true, stopped: activeEgresses.length, action }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Start recording
    if (!s3Endpoint || !s3AccessKey || !s3SecretKey) {
      throw new Error('S3/R2 not configured')
    }

    // Cleanup defensivo: VPS Hostinger KVM 2 (2 vCPU, cpu_cost.room_composite=1.5)
    // so suporta UM egress por vez. Se ha QUALQUER egress ativo (mesmo de
    // outra sala/sessao), o novo bate em 503 'no response from servers'.
    // Mata todos os ativos antes de iniciar — single-tenant assumption.
    try {
      const listRes = await fetch(`${httpUrl}/twirp/livekit.Egress/ListEgress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })
      const listData = await listRes.json()
      const orphans = (listData.items || []).filter((e: any) => {
        const status = typeof e.status === 'string' ? e.status : ''
        return status === 'EGRESS_STARTING' || status === 'EGRESS_ACTIVE' || e.status === 0 || e.status === 1
      })
      for (const orphan of orphans) {
        console.log(`[RECORDING] stopping orphan egress ${orphan.egress_id} (room=${orphan.room_name}, status=${orphan.status})`)
        await fetch(`${httpUrl}/twirp/livekit.Egress/StopEgress`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ egress_id: orphan.egress_id }),
        }).catch(() => {})
      }
      if (orphans.length > 0) {
        // Poll ate confirmar que cpu_cost foi liberado. Stop e' assincrono:
        // egress vai pra EGRESS_ENDING -> EGRESS_COMPLETE. Slot de cpu so
        // libera no COMPLETE. Sem polling, novo Start ainda bate em 503.
        const POLL_DEADLINE = Date.now() + 15_000
        while (Date.now() < POLL_DEADLINE) {
          await new Promise(r => setTimeout(r, 1500))
          const r = await fetch(`${httpUrl}/twirp/livekit.Egress/ListEgress`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true }),
          })
          const d = await r.json()
          if (!(d.items || []).length) break
        }
      }
    } catch (e: any) {
      console.warn('[RECORDING] orphan cleanup failed (continuing):', e.message)
    }

    const filepath = `recordings/${roomName}/${Date.now()}.mp4`

    // Template: built-in single-speaker-dark do LK self-hosted (estavel).
    // O custom template SQUAAD (recording.html) so deve ser ativado depois
    // que o frontend (Netlify squaad.com.br) tiver o arquivo com o sinal
    // START_RECORDING — caso contrario o egress trava aguardando.
    // Ativado 18/06: template SQUAAD (bolha quadrada-arredondada + borda de quem
    // fala + watermark). O recording.html tem fallback de START_RECORDING (5s no
    // connect, 1s em erro), entao se o template falhar o egress grava o splash em
    // vez de travar. REVERSIVEL: trocar o default por '' (ou setar a env vazia)
    // volta pro built-in single-speaker-dark na hora, no proximo Start.
    const customTemplateUrl = Deno.env.get('RECORDING_TEMPLATE_URL') || 'https://squaad.com.br/recording.html'

    // Encoding preset: 0 = H264_720P_30 (1280x720@30fps, ~3Mbps).
    // Testou-se preset 2 (1080p30) e gerou 49% de frames com timing irregular
    // (Chrome rendering + 1080p sobrecarrega a CPU em spikes apesar do uso
    // medio aceitavel). 720p30 e' o sweet spot pra VPS Hostinger KVM 2.
    // Pra 1080p estavel, upgrade pra KVM 4.
    const egressReq: any = {
      room_name: roomName,
      layout: 'single-speaker-dark',
      preset: 0, // H264_720P_30
      file: {
        file_type: 0, // 0 = default (inferido do .mp4); equivale a MP4
        filepath,
        s3: {
          access_key: s3AccessKey,
          secret: s3SecretKey,
          endpoint: s3Endpoint,
          bucket: s3Bucket,
          region: s3Region,
          force_path_style: true,
        },
      },
    }
    if (customTemplateUrl) {
      egressReq.custom_base_url = customTemplateUrl
    }

    const res = await fetch(`${httpUrl}/twirp/livekit.Egress/StartRoomCompositeEgress`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(egressReq),
    })

    const data = await res.json()
    console.log('[RECORDING] Egress response:', JSON.stringify(data).slice(0, 500))
    if (!res.ok || data.error || !data.egress_id) {
      throw new Error(`LK egress failed: ${data.error || data.message || JSON.stringify(data).slice(0, 300)}`)
    }

    // Update meeting status
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await supabase.from('meetings').update({
      recording_status: 'recording',
    }).eq('livekit_room_name', roomName)

    const publicUrl = s3PublicUrl ? `${s3PublicUrl}/${filepath}` : null

    return new Response(JSON.stringify({
      success: true,
      egress_id: data.egress_id,
      recording_url: publicUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[RECORDING] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
