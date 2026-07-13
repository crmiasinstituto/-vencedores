// collective-event-create: cria evento coletivo (Masterclass/Workshop/Aulão),
// pré-cria salas LiveKit shards e popula invites varrendo segmento do kanban.
// Memória: deploy via Management API = 1 arquivo, sem imports relativos.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type EventFormat = 'online' | 'presencial' | 'hybrid'

interface CreatePayload {
  // Atualizar evento existente em vez de criar novo (pra continuar editando rascunho)
  event_id?: string
  // status='draft' não popula invites e mantém escondido do dispatcher
  status?: 'draft' | 'scheduled'
  title: string
  description?: string
  scheduled_at: string
  duration_minutes?: number
  event_format: EventFormat
  target_segment: {
    column_ids?: string[]
    tag_filters?: string[]
    post_sale_stages?: string[]
    exclude_lost?: boolean
  }
  max_per_room?: number
  venue?: {
    name?: string
    address?: string
    complement?: string
    map_url?: string
    capacity?: number
    lat?: number
    lng?: number
  }
  template_audio_url?: string
  template_brief?: string
  template_subject?: string
  template_preheader?: string
  template_html?: string
  template_wa_text?: string
  template_generation?: {
    at?: string
    model?: string
    brief?: string
    subject?: string
    html_excerpt?: string
  }
  email_template_id?: string | null
  wa_template_id?: string | null
  reminders_config?: Record<string, { email?: boolean; wa?: boolean }>
  recording_enabled?: boolean
  host_user_id?: string | null
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function shardLetter(idx: number): string {
  return String.fromCharCode(65 + idx)
}

async function supabaseFetch(
  path: string,
  options: RequestInit & { service?: boolean } = {},
): Promise<Response> {
  const url = `${Deno.env.get('SUPABASE_URL')}${path}`
  const key = options.service
    ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    : Deno.env.get('SUPABASE_ANON_KEY')!
  const headers = new Headers(options.headers)
  headers.set('apikey', key)
  headers.set('Authorization', `Bearer ${key}`)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Prefer', headers.get('Prefer') ?? 'return=representation')
  return fetch(url, { ...options, headers })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = (await req.json()) as CreatePayload

    if (!payload?.title || !payload?.scheduled_at || !payload?.event_format) {
      return new Response(
        JSON.stringify({ error: 'missing_required_fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const scheduledDate = new Date(payload.scheduled_at)
    const datePart = scheduledDate.toISOString().slice(0, 10)
    const room_prefix = `evento-${datePart}-${slugify(payload.title)}`

    const max_per_room = payload.max_per_room ?? 50
    const recording_enabled = payload.recording_enabled ?? true
    const isDraft = payload.status === 'draft'

    const eventBody: Record<string, any> = {
      title: payload.title,
      description: payload.description ?? null,
      event_format: payload.event_format,
      scheduled_at: payload.scheduled_at,
      duration_minutes: payload.duration_minutes ?? 60,
      target_segment: payload.target_segment ?? {},
      max_per_room,
      room_prefix,
      venue_name: payload.venue?.name ?? null,
      venue_address: payload.venue?.address ?? null,
      venue_complement: payload.venue?.complement ?? null,
      venue_map_url: payload.venue?.map_url ?? null,
      venue_capacity: payload.venue?.capacity ?? null,
      venue_lat: payload.venue?.lat ?? null,
      venue_lng: payload.venue?.lng ?? null,
      template_audio_url: payload.template_audio_url ?? null,
      template_brief: payload.template_brief ?? null,
      template_subject: payload.template_subject ?? null,
      template_preheader: payload.template_preheader ?? null,
      template_html: payload.template_html ?? null,
      template_wa_text: payload.template_wa_text ?? null,
      email_template_id: payload.email_template_id ?? null,
      wa_template_id: payload.wa_template_id ?? null,
      reminders_config:
        payload.reminders_config ?? {
          d3: { email: true, wa: true },
          d1: { email: true, wa: true },
          h1: { email: true, wa: true },
        },
      recording_enabled,
      host_user_id: payload.host_user_id ?? null,
      status: isDraft ? 'draft' : 'scheduled',
    }

    let event_id: string
    if (payload.event_id) {
      // Atualizar rascunho existente
      const updRes = await supabaseFetch(
        `/rest/v1/collective_events?id=eq.${payload.event_id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(eventBody),
          service: true,
        },
      )
      if (!updRes.ok) {
        throw new Error(`update_event_failed: ${await updRes.text()}`)
      }
      event_id = payload.event_id

      // Append na lista de gerações (histórico)
      if (payload.template_generation) {
        // RPC seria mais limpo mas pra simplificar lemos+update
        const getRes = await supabaseFetch(
          `/rest/v1/collective_events?id=eq.${event_id}&select=template_generations`,
          { method: 'GET', service: true },
        )
        const rows = (await getRes.json()) as Array<{ template_generations: any[] }>
        const generations = Array.isArray(rows?.[0]?.template_generations)
          ? rows[0].template_generations
          : []
        generations.push(payload.template_generation)
        await supabaseFetch(
          `/rest/v1/collective_events?id=eq.${event_id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ template_generations: generations }),
            service: true,
          },
        )
      }
    } else {
      const createRes = await supabaseFetch(
        '/rest/v1/collective_events',
        {
          method: 'POST',
          body: JSON.stringify(eventBody),
          service: true,
        },
      )
      if (!createRes.ok) {
        throw new Error(`create_event_failed: ${await createRes.text()}`)
      }
      const [event] = (await createRes.json()) as Array<{ id: string }>
      event_id = event.id

      if (payload.template_generation) {
        await supabaseFetch(`/rest/v1/collective_events?id=eq.${event_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ template_generations: [payload.template_generation] }),
          service: true,
        })
      }
    }

    // Rascunho: para aqui. Não cria salas, não popula invites.
    if (isDraft) {
      return new Response(
        JSON.stringify({
          ok: true,
          event_id,
          status: 'draft',
          room_prefix,
          invites_created: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2) Trava anti-ban: se tem wa_template_id, valida provider cloud_api
    if (payload.wa_template_id) {
      const assertRes = await supabaseFetch(
        '/rest/v1/rpc/assert_collective_event_uses_cloud_api',
        {
          method: 'POST',
          body: JSON.stringify({ p_event_id: event_id }),
          service: true,
        },
      )
      if (!assertRes.ok) {
        const txt = await assertRes.text()
        // rollback
        await supabaseFetch(`/rest/v1/collective_events?id=eq.${event_id}`, {
          method: 'DELETE',
          service: true,
        })
        return new Response(
          JSON.stringify({ error: 'anti_ban_check_failed', detail: txt }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    }

    // 3) Pre-cria salas (shard 0) conforme formato
    const initialRooms: Array<{
      event_id: string
      shard_index: number
      room_name: string
      attendance_mode: string
      capacity: number
    }> = []
    if (payload.event_format === 'online' || payload.event_format === 'hybrid') {
      initialRooms.push({
        event_id,
        shard_index: 0,
        room_name: `${room_prefix}-${shardLetter(0)}`,
        attendance_mode: 'online',
        capacity: max_per_room,
      })
    }
    if (payload.event_format === 'presencial' || payload.event_format === 'hybrid') {
      initialRooms.push({
        event_id,
        shard_index: 0,
        room_name: `${room_prefix}-presencial`,
        attendance_mode: 'presencial',
        capacity: payload.venue?.capacity ?? 999,
      })
    }
    if (initialRooms.length > 0) {
      const roomsRes = await supabaseFetch(
        '/rest/v1/collective_event_rooms',
        {
          method: 'POST',
          body: JSON.stringify(initialRooms),
          service: true,
        },
      )
      if (!roomsRes.ok) {
        const txt = await roomsRes.text()
        throw new Error(`create_rooms_failed: ${txt}`)
      }
    }

    // 4) Popula invites do segmento via RPC
    const populateRes = await supabaseFetch(
      '/rest/v1/rpc/populate_collective_invites',
      {
        method: 'POST',
        body: JSON.stringify({ p_event_id: event_id }),
        service: true,
      },
    )
    if (!populateRes.ok) {
      const txt = await populateRes.text()
      throw new Error(`populate_invites_failed: ${txt}`)
    }
    const invites_created = (await populateRes.json()) as number

    return new Response(
      JSON.stringify({
        ok: true,
        event_id,
        room_prefix,
        invites_created,
        recording_enabled,
        max_per_room,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: 'internal_error', detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
