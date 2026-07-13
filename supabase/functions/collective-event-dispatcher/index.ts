// collective-event-dispatcher: cron a cada 5min.
// Pra cada invite com marco devido (convite, D-3, D-1, H-1), envia Email (Resend) + WA Cloud API.
// Memória project_wa_anti_ban_locks: forçar Cloud API, nunca UAZAPI pra eventos coletivos.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://squaad.com.br'

type Milestone = 'invite' | 'd3' | 'd1' | 'h1'
type Channel = 'email' | 'wa'

interface Invite {
  id: string
  event_id: string
  lead_id: string
  token: string
  invite_email_sent_at: string | null
  invite_wa_sent_at: string | null
  d3_email_sent_at: string | null
  d3_wa_sent_at: string | null
  d1_email_sent_at: string | null
  d1_wa_sent_at: string | null
  h1_email_sent_at: string | null
  h1_wa_sent_at: string | null
}

interface EventRow {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  event_format: string
  venue_name: string | null
  venue_address: string | null
  template_html: string | null
  template_wa_text: string | null
  email_template_id: string | null
  wa_template_id: string | null
  reminders_config: any
  status: string
}

interface Lead {
  id: string
  name: string | null
  email: string | null
  whatsapp: string | null
  email_opted_out: boolean | null
  whatsapp_opt_in: boolean | null
}

function firstName(name: string | null): string {
  if (!name) return ''
  return name.trim().split(/\s+/)[0]
}

function formatDateBR(iso: string): string {
  const d = new Date(iso)
  const meses = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro',
  ]
  const dias = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']
  return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} (${dias[d.getUTCDay()]})`
}

function formatTimeBR(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return mm === '00' ? `${hh}h` : `${hh}h${mm}`
}

function buildVenueLabel(ev: EventRow): string {
  if (ev.event_format === 'online') return 'online via sala SQUAAD'
  if (ev.event_format === 'presencial') {
    const parts = [ev.venue_name, ev.venue_address].filter(Boolean)
    return parts.join(', ') || 'local a confirmar'
  }
  // hybrid
  const addr = [ev.venue_name, ev.venue_address].filter(Boolean).join(', ')
  return addr ? `presencial em ${addr} ou online` : 'presencial ou online'
}

function buildLink(token: string): string {
  return `${APP_URL}/r/${token}`
}

function renderMustache(html: string, vars: Record<string, string>): string {
  return html.replace(/{{\s*([a-z_]+)\s*}}/gi, (_m, key) => vars[key.toLowerCase()] ?? '')
}

async function sendEmail(
  toEmail: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; provider_id?: string; error?: string }> {
  const resendKey = await getResendKey()
  if (!resendKey) return { ok: false, error: 'resend_not_configured' }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject,
      html,
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return { ok: false, error: j?.message ?? `resend_${r.status}` }
  return { ok: true, provider_id: j?.id }
}

let _emailConfigCache:
  | { resend_api_key: string; from_email: string; from_name: string }
  | null = null
async function getEmailConfig() {
  if (_emailConfigCache) return _emailConfigCache
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data } = await sb
    .from('email_config')
    .select('resend_api_key, from_email, from_name')
    .eq('id', 'singleton')
    .maybeSingle()
  if (data?.resend_api_key) _emailConfigCache = data as any
  return _emailConfigCache
}
async function getResendKey(): Promise<string | null> {
  const c = await getEmailConfig()
  return c?.resend_api_key ?? null
}

async function sendWaTemplate(
  sb: any,
  evt: EventRow,
  lead: Lead,
  link: string,
  vars: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  if (!evt.wa_template_id) return { ok: false, error: 'no_wa_template' }
  if (!lead.whatsapp || !lead.whatsapp_opt_in) return { ok: false, error: 'no_opt_in_or_phone' }

  // Resolve template name + variáveis semânticas
  const { data: tpl } = await sb
    .from('wa_cloud_templates')
    .select('id, name, language, provider')
    .eq('id', evt.wa_template_id)
    .maybeSingle()

  if (!tpl) return { ok: false, error: 'template_not_found' }
  if (tpl.provider !== 'cloud_api') return { ok: false, error: 'provider_blocked_must_be_cloud_api' }

  const { data: tplVars } = await sb
    .from('wa_template_variables')
    .select('variable_index, semantic_role, fallback_value')
    .eq('template_id', tpl.id)
    .order('variable_index', { ascending: true })

  const components: any[] = []
  if (tplVars && tplVars.length > 0) {
    const parameters = tplVars.map((v: any) => {
      const raw = vars[v.semantic_role] ?? v.fallback_value ?? ''
      return { type: 'text', text: raw }
    })
    components.push({ type: 'body', parameters })
    // Header text com {{1}} (primeiro nome)
    const headerVar = tplVars.find((v: any) => v.variable_index === 1)
    if (headerVar) {
      components.push({
        type: 'header',
        parameters: [{ type: 'text', text: vars[headerVar.semantic_role] ?? '' }],
      })
    }
    // CTA URL dinâmica com link
    const linkVar = tplVars.find((v: any) => v.semantic_role === 'event_link')
    if (linkVar) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: link.replace(/^https?:\/\/[^/]+\//, '') }],
      })
    }
  }

  const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/wa-send-cloud`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      action: 'send_template',
      phone: lead.whatsapp,
      lead_id: lead.id,
      template_name: tpl.name,
      template_language: tpl.language ?? 'pt_BR',
      components,
      sent_by: 'collective-event-dispatcher',
    }),
  })
  if (!sendRes.ok) {
    const txt = await sendRes.text().catch(() => '')
    return { ok: false, error: `wa_send_failed: ${txt.slice(0, 200)}` }
  }
  return { ok: true }
}

function pickMilestone(invite: Invite, scheduledAt: string): Milestone | null {
  const now = Date.now()
  const sched = new Date(scheduledAt).getTime()
  const msHour = 3600_000
  const msDay = 24 * msHour
  const minutesToEvent = (sched - now) / 60000

  if (minutesToEvent <= 0) return null // já começou

  if (invite.invite_email_sent_at === null && invite.invite_wa_sent_at === null) {
    return 'invite'
  }
  if (minutesToEvent <= 60 && (invite.h1_email_sent_at === null || invite.h1_wa_sent_at === null)) {
    return 'h1'
  }
  if (minutesToEvent <= msDay / 60000 && (invite.d1_email_sent_at === null || invite.d1_wa_sent_at === null)) {
    return 'd1'
  }
  if (
    minutesToEvent <= (3 * msDay) / 60000 &&
    (invite.d3_email_sent_at === null || invite.d3_wa_sent_at === null)
  ) {
    return 'd3'
  }
  return null
}

const SUBJECT_BY_MILESTONE: Record<Milestone, (eventName: string) => string> = {
  invite: (n) => `Você foi convidado: ${n}`,
  d3: (n) => `Faltam 3 dias pra ${n}`,
  d1: (n) => `Amanhã: ${n}`,
  h1: (n) => `Em 1 hora: ${n}`,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const stats = { processed: 0, sent_email: 0, sent_wa: 0, errors: 0 }
  const errors: string[] = []

  try {
    // 1) Eventos agendados próximos (até 4 dias)
    const horizon = new Date(Date.now() + 4 * 24 * 3600_000).toISOString()
    const { data: events } = await sb
      .from('collective_events')
      .select('*')
      .eq('status', 'scheduled')
      .gt('scheduled_at', new Date().toISOString())
      .lt('scheduled_at', horizon)

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, stats, message: 'no_events_in_horizon' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cfg = await getEmailConfig()
    const fromEmail = cfg?.from_email ?? 'no-reply@squaad.com.br'
    const fromName = (cfg as any)?.from_name ?? 'SQUAAD'

    for (const evt of events as EventRow[]) {
      const { data: invites } = await sb
        .from('collective_event_invites')
        .select(
          'id,event_id,lead_id,token,' +
            'invite_email_sent_at,invite_wa_sent_at,' +
            'd3_email_sent_at,d3_wa_sent_at,' +
            'd1_email_sent_at,d1_wa_sent_at,' +
            'h1_email_sent_at,h1_wa_sent_at',
        )
        .eq('event_id', evt.id)

      if (!invites) continue

      for (const inv of invites as Invite[]) {
        const milestone = pickMilestone(inv, evt.scheduled_at)
        if (!milestone) continue

        const { data: lead } = await sb
          .from('crm_leads')
          .select('id,name,email,whatsapp,email_opted_out,whatsapp_opt_in')
          .eq('id', inv.lead_id)
          .maybeSingle()
        if (!lead) continue

        const link = buildLink(inv.token)
        const vars: Record<string, string> = {
          // PT-BR (padrão usado pelo Gemini no brand_guidelines e pelo Mustache no template)
          primeiro_nome: firstName(lead.name),
          nome: lead.name ?? '',
          nome_evento: evt.title,
          data_evento: formatDateBR(evt.scheduled_at),
          hora_evento: formatTimeBR(evt.scheduled_at),
          local_evento: buildVenueLabel(evt),
          link_evento: link,
          // Aliases EN pra compat com wa_template_variables.semantic_role
          first_name: firstName(lead.name),
          event_name: evt.title,
          event_date_text: formatDateBR(evt.scheduled_at),
          event_time_text: formatTimeBR(evt.scheduled_at),
          event_link: link,
          event_venue: buildVenueLabel(evt),
        }

        const cfgMile = evt.reminders_config?.[milestone] ?? { email: true, wa: true }

        // Email
        const emailField = `${milestone}_email_sent_at` as keyof Invite
        if (cfgMile.email && !inv[emailField] && lead.email && !lead.email_opted_out) {
          const html = evt.template_html
            ? renderMustache(evt.template_html, vars)
            : renderFallbackEmail(milestone, vars)
          const subject = SUBJECT_BY_MILESTONE[milestone](evt.title)
          const r = await sendEmail(lead.email, fromEmail, fromName, subject, html)
          if (r.ok) {
            await sb
              .from('collective_event_invites')
              .update({ [emailField]: new Date().toISOString() })
              .eq('id', inv.id)
            stats.sent_email++
            // espelha em email_sends pra LeadTimeline (memória project_lead_email_timeline_events)
            await sb.from('email_sends').insert({
              lead_id: lead.id,
              subscriber_email: lead.email,
              subject,
              status: 'sent',
              metadata: {
                source: 'collective_event',
                event_id: evt.id,
                invite_id: inv.id,
                milestone,
                provider_id: r.provider_id ?? null,
              },
            })
          } else {
            errors.push(`email ${inv.id} ${milestone}: ${r.error}`)
            stats.errors++
          }
        }

        // WA
        const waField = `${milestone}_wa_sent_at` as keyof Invite
        if (cfgMile.wa && !inv[waField] && lead.whatsapp && lead.whatsapp_opt_in) {
          const r = await sendWaTemplate(sb, evt, lead, link, vars)
          if (r.ok) {
            await sb
              .from('collective_event_invites')
              .update({ [waField]: new Date().toISOString() })
              .eq('id', inv.id)
            stats.sent_wa++
          } else {
            errors.push(`wa ${inv.id} ${milestone}: ${r.error}`)
            stats.errors++
          }
        }

        stats.processed++
      }
    }

    return new Response(JSON.stringify({ ok: true, stats, errors: errors.slice(0, 20) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function renderFallbackEmail(m: Milestone, v: Record<string, string>): string {
  const cta = `<p><a href="${v.event_link}" style="background:#000;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;">Acessar detalhes</a></p>`
  const blocks: Record<Milestone, string> = {
    invite: `<h2>Olá ${v.first_name}, você foi convidado</h2><p>${v.event_name}</p><p>${v.event_date_text}, às ${v.event_time_text}</p><p>Local: ${v.event_venue}</p>${cta}`,
    d3: `<h2>${v.first_name}, faltam 3 dias pra ${v.event_name}</h2><p>${v.event_date_text}, às ${v.event_time_text}</p><p>Local: ${v.event_venue}</p>${cta}`,
    d1: `<h2>${v.first_name}, é amanhã</h2><p>${v.event_name}</p><p>${v.event_date_text}, às ${v.event_time_text}</p><p>Local: ${v.event_venue}</p>${cta}`,
    h1: `<h2>${v.first_name}, em 1 hora</h2><p>${v.event_name}</p><p>Hoje às ${v.event_time_text}</p><p>Local: ${v.event_venue}</p>${cta}`,
  }
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">${blocks[m]}</body></html>`
}
