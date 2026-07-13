// collective-event-send-test
// Envia 1 email e/ou 1 WA de teste pra um lead específico, usando o template do evento
// com as variáveis substituídas. Não cria invite real, é só validação de variáveis.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://squaad.com.br';

function firstName(name: string | null): string {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]}`;
}

function formatTimeBR(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return mm === '00' ? `${hh}h` : `${hh}h${mm}`;
}

function renderMustache(text: string, vars: Record<string, string>): string {
  return text.replace(/{{\s*([a-z_]+)\s*}}/gi, (_m, key) => vars[key.toLowerCase()] ?? '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { event_id, lead_id, channels } = body as {
      event_id: string;
      lead_id: string;
      channels: { email?: boolean; wa?: boolean };
    };

    if (!event_id || !lead_id) {
      return new Response(JSON.stringify({ error: 'event_id e lead_id obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: evt }, { data: lead }] = await Promise.all([
      sb.from('collective_events').select('*').eq('id', event_id).maybeSingle(),
      sb.from('crm_leads').select('id, name, whatsapp, email').eq('id', lead_id).maybeSingle(),
    ]);

    if (!evt) return jsonResp({ error: 'event_not_found' }, 404);
    if (!lead) return jsonResp({ error: 'lead_not_found' }, 404);

    // Gera token temporário (não persiste invite real)
    const fakeToken = `test-${crypto.randomUUID().slice(0, 16)}`;
    const link = `${APP_URL}/r/${fakeToken}`;

    const vars: Record<string, string> = {
      primeiro_nome: firstName(lead.name),
      nome: lead.name ?? '',
      nome_evento: evt.title,
      data_evento: formatDateBR(evt.scheduled_at),
      hora_evento: formatTimeBR(evt.scheduled_at),
      local_evento:
        evt.event_format === 'online'
          ? 'online via sala SQUAAD'
          : [evt.venue_name, evt.venue_address].filter(Boolean).join(', ') || 'a confirmar',
      link_evento: link,
    };

    const result: Record<string, any> = { vars, sent: {} };

    // Email
    if (channels?.email !== false && evt.template_html && lead.email) {
      const { data: cfg } = await sb
        .from('email_config')
        .select('resend_api_key, from_email, from_name')
        .eq('id', 'singleton')
        .maybeSingle();

      if (!cfg?.resend_api_key) {
        result.sent.email = { ok: false, error: 'resend_not_configured' };
      } else {
        const subject = `[TESTE] ${renderMustache(evt.template_subject ?? evt.title, vars)}`;
        const html = renderMustache(evt.template_html, vars);
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${cfg.from_name ?? 'SQUAAD'} <${cfg.from_email ?? 'no-reply@squaad.com.br'}>`,
            to: [lead.email],
            subject,
            html,
          }),
        });
        const rJson = await r.json().catch(() => ({}));
        result.sent.email = r.ok
          ? { ok: true, provider_id: rJson?.id, to: lead.email }
          : { ok: false, error: rJson?.message ?? `resend_${r.status}` };
      }
    } else if (channels?.email !== false && !lead.email) {
      result.sent.email = { ok: false, error: 'lead_sem_email' };
    }

    // WhatsApp (envio direto via wa-send-cloud)
    if (channels?.wa && lead.whatsapp && evt.template_wa_text) {
      const text = renderMustache(evt.template_wa_text, vars);
      const r = await fetch(`${SUPABASE_URL}/functions/v1/wa-send-cloud`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          action: 'send_text',
          phone: lead.whatsapp,
          lead_id: lead.id,
          text: `[TESTE]\n\n${text}`,
          sent_by: 'collective-event-send-test',
        }),
      });
      const rJson = await r.json().catch(() => ({}));
      result.sent.wa = r.ok ? { ok: true, ...rJson } : { ok: false, error: rJson?.error ?? `wa_${r.status}` };
    }

    return jsonResp({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: msg }, 500);
  }
});

function jsonResp(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
