import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verify LiveKit webhook signature (HMAC-SHA256)
async function verifyWebhook(body: string, authHeader: string, apiKey: string, apiSecret: string): Promise<any> {
  // authHeader format: "Bearer <jwt>"
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) throw new Error('No token in Authorization header')

  // Decode JWT without verification first to get the payload
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')

  // Verify HMAC-SHA256 signature
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${parts[0]}.${parts[1]}`))

  if (!valid) throw new Error('Invalid signature')

  // Decode payload
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

  // Verify issuer matches API key
  if (payload.iss !== apiKey) throw new Error('Invalid issuer')

  // The body contains the actual event
  return JSON.parse(body)
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

    const apiKey = Deno.env.get('LIVEKIT_API_KEY')!
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!
    const s3PublicUrl = Deno.env.get('S3_PUBLIC_URL')

    const body = await req.text()
    const authHeader = req.headers.get('Authorization') || ''

    let event: any
    try {
      event = await verifyWebhook(body, authHeader, apiKey, apiSecret)
    } catch (e) {
      console.error('[LK-WEBHOOK] Verification failed:', e)
      // Still try to parse - some events might not be signed
      try { event = JSON.parse(body) } catch { return new Response('Invalid', { status: 400 }) }
    }

    const eventType = event.event
    const roomName = event.room?.name
    console.log(`[LK-WEBHOOK] Event: ${eventType}, room: ${roomName}`)

    switch (eventType) {
      case 'egress_ended': {
        const egressInfo = event.egressInfo || event.egress_info || {}
        const egressId = egressInfo.egressId || egressInfo.egress_id || ''
        const fileResults = egressInfo.fileResults || egressInfo.file_results || []
        const file = fileResults[0] || egressInfo.file || {}
        const filename = file.filename || file.filepath || ''
        const egressRoom = egressInfo.roomName || egressInfo.room_name || roomName

        let recordingUrl = ''
        if (s3PublicUrl && filename) {
          recordingUrl = `${s3PublicUrl}/${filename}`
        } else if (file.location) {
          recordingUrl = file.location
        }

        console.log(`[LK-WEBHOOK] Egress ended, room: ${egressRoom}, egress_id: ${egressId}, file: ${filename}`)

        // Fire-and-forget: pos-processamento de faststart na VPS pra streaming
        // progressivo (move moov atom pro inicio do MP4). Sem isso o browser
        // precisa baixar o arquivo inteiro antes de comecar a tocar.
        if (filename) {
          const ppUrl = Deno.env.get('POSTPROCESS_URL') || 'https://meet.squaad.com.br/postprocess/faststart'
          fetch(ppUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiSecret}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filepath: filename }),
          })
            .then(r => console.log(`[LK-WEBHOOK] postprocess queued: ${r.status}`))
            .catch(e => console.error('[LK-WEBHOOK] postprocess err:', e.message))
        }

        if (egressRoom && recordingUrl) {
          const { data: current } = await supabase.from('meetings')
            .select('id, lesson_mode, target_module_id, target_accelerator_id, collective_event_id, recording_url, recording_status, metadata')
            .eq('livekit_room_name', egressRoom)
            .maybeSingle()

          const meeting = current as any
          // Bug fix: detectar pause via lista de egress_ids registrados em metadata
          // pela edge livekit-start-recording (action=pause), NAO pelo recording_status
          // atual. Pause -> resume rapido faz o status virar 'recording' antes do
          // webhook do segmento pausado chegar (LK demora ate 30s).
          const pausedEgresses: string[] = Array.isArray(meeting?.metadata?.paused_egresses)
            ? meeting.metadata.paused_egresses
            : []
          const wasPaused = !!egressId && pausedEgresses.includes(egressId)
          // Finaliza SO quando o host realmente parou (acao 'stop' seta
          // recording_status='processing'). Pause/resume setam 'paused'/'recording',
          // entao um trecho de pausa (mesmo com paused_egresses em corrida) NUNCA
          // dispara finalize cedo. Robusto contra a corrida do egress_id.
          const isFinal = (meeting?.recording_status || '') === 'processing'
          const prevSegments = Array.isArray(meeting?.metadata?.recording_segments)
            ? meeting.metadata.recording_segments
            : []
          const newSegments = [...prevSegments, {
            url: recordingUrl,
            ended_at: new Date().toISOString(),
            egress_id: egressId,
            paused: wasPaused,
          }]
          // Limpa o egress_id da lista de paused depois de processar (housekeeping)
          const newPausedEgresses = wasPaused
            ? pausedEgresses.filter((id) => id !== egressId)
            : pausedEgresses
          const newMetadata = {
            ...(meeting?.metadata || {}),
            recording_segments: newSegments,
            paused_egresses: newPausedEgresses,
          }

          const update: any = {
            metadata: newMetadata,
            // Se foi pause, NAO toca em recording_status (UI ja setou 'paused' ou
            // ate' ja resumiu pra 'recording'). Se foi stop final, marca completed.
          }
          if (isFinal) update.recording_status = 'completed'
          if (!meeting?.recording_url) update.recording_url = recordingUrl

          await supabase.from('meetings').update(update).eq('id', meeting.id)
          console.log(`[LK-WEBHOOK] Segment ${newSegments.length} saved (wasPaused=${wasPaused}) for ${egressRoom}`)

          // Finaliza so quando o host parou de verdade (recording_status='processing').
          if (isFinal) {
            if (newSegments.length > 1) {
              // Houve pausa(s): junta todos os trechos num MP4 unico no VPS.
              // O callback recording-merged seta o recording_url final e dispara o pipeline.
              const ordered = [...newSegments]
                .sort((a: any, b: any) => new Date(a.ended_at).getTime() - new Date(b.ended_at).getTime())
                .map((s: any) => s.url)
              const ts = Date.now()
              // Prefixo recordings/ (a app key do B2 so escreve nele; merged/ da AccessDenied).
              const outputKey = `recordings/${egressRoom}/merged-${ts}.mp4`
              const outputUrl = `${s3PublicUrl}/${outputKey}`
              const ppBase = (Deno.env.get('POSTPROCESS_URL') || 'https://meet.squaad.com.br/postprocess/faststart').replace(/\/faststart$/, '')
              console.log(`[LK-WEBHOOK] Concat ${ordered.length} segments for meeting ${meeting.id}`)
              fetch(`${ppBase}/concat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiSecret}` },
                body: JSON.stringify({
                  segments: ordered,
                  output_key: outputKey,
                  output_url: outputUrl,
                  meeting_id: meeting.id,
                  callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/recording-merged`,
                }),
              })
                .then((r) => console.log(`[LK-WEBHOOK] concat queued: ${r.status}`))
                .catch((e) => console.error('[LK-WEBHOOK] concat err:', e.message))
            } else if (meeting?.collective_event_id || (meeting?.lesson_mode && (meeting?.target_module_id || meeting?.target_accelerator_id))) {
              // 1 trecho so (sem pausa): finaliza via recording-merged, que arquiva
              // no evento coletivo e/ou publica a aula. Unifica com o caminho do concat.
              console.log(`[LK-WEBHOOK] Finalizing single-segment recording for meeting ${meeting.id}`)
              try {
                const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/recording-merged`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({ meeting_id: meeting.id, merged_url: recordingUrl }),
                })
                console.log(`[LK-WEBHOOK] Finalize triggered: ${res.status}`)
              } catch (err: any) {
                console.error(`[LK-WEBHOOK] Failed to finalize:`, err)
              }
            }
          }
        }
        break
      }

      case 'room_finished': {
        if (roomName) {
          const { data: finishedRows } = await supabase.from('meetings').update({
            status: 'completed',
            ended_at: new Date().toISOString(),
          }).eq('livekit_room_name', roomName).select('id')
          console.log(`[LK-WEBHOOK] Room ${roomName} finished`)
          // A reuniao encerrou DE VERDADE: agora sim tenta mandar o PDF pro grupo
          // (o process-lesson-recording gate confere PDF pronto + reuniao completed).
          for (const r of (finishedRows || [])) {
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-lesson-recording`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
              body: JSON.stringify({ meeting_id: r.id, broadcast_only: true }),
            }).then(() => {}, () => {})
          }
        }
        break
      }

      default:
        console.log(`[LK-WEBHOOK] Event: ${eventType} (no action)`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[LK-WEBHOOK] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
