/**
 * captura-pagina — recebe o formulário de qualquer landing page externa e cria o lead no CRM
 * conforme a integração configurada em Marketing > Captura de Páginas (tabela page_integrations).
 *
 * POST /.netlify/functions/captura-pagina?f=<slug>&chave=<public_key>
 *   Body JSON ou form-urlencoded, nomes flexíveis: { nome|name, email, telefone|phone|whatsapp|celular, utm_*, ...extras }
 *   ?teste=1 valida tudo e registra o envio como "teste", sem criar card.
 *
 * Formato antigo (Operação 50K, captura-lead-quadro): ?quadro=<slug>&token=<LEAD_CAPTURE_TOKEN>.
 * O token global vale pra qualquer integração; a chave da integração vale só pra ela.
 *
 * O card entra na coluna da integração (ou na primeira do quadro). As tags vão num PATCH
 * separado do INSERT porque é o UPDATE que dispara lead_tag_added nas automações de e-mail —
 * assim a automação roda pra lead novo e pra quem já estava no quadro e se inscreveu de novo.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-lead-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const first = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
const waCanon = (raw) => {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return '';
  if (!n.startsWith('55') && n.length >= 10 && n.length <= 11) n = '55' + n;
  if (n.startsWith('55') && n.length === 12) n = n.slice(0, 4) + '9' + n.slice(4);
  return n;
};

const NAME_KEYS = ['nome', 'name', 'nome_completo', 'full_name', 'fullname', 'your-name'];
const EMAIL_KEYS = ['email', 'e-mail', 'mail', 'your-email'];
const PHONE_KEYS = ['telefone', 'phone', 'whatsapp', 'celular', 'cellphone', 'fone', 'tel', 'your-phone'];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
const IGNORED_KEYS = new Set([...NAME_KEYS, ...EMAIL_KEYS, ...PHONE_KEYS, ...UTM_KEYS,
  'token', 'chave', 'f', 'quadro', 'teste', 'pagina_url']);

const readBody = async (req) => {
  const type = req.headers.get('content-type') || '';
  try {
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const form = await req.formData();
      return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    }
    return await req.json();
  } catch {
    return {};
  }
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ ok: false, error: 'Servidor sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const body = await readBody(req);
  const params = new URL(req.url).searchParams;
  const slug = params.get('f') || params.get('quadro') || first(body, ['f', 'quadro']);
  const key = params.get('chave') || params.get('token') || req.headers.get('x-lead-token')
    || first(body, ['chave', 'token']);
  const isTest = params.get('teste') === '1' || first(body, ['teste']) === '1';

  if (!slug) return json({ ok: false, error: 'Informe a integração (?f=slug-da-integracao).' }, 400);

  const db = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`CRM ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };

  let integration;
  try {
    [integration] = await db(
      `page_integrations?slug=eq.${encodeURIComponent(slug)}&select=*,board:crm_boards(id,name)&limit=1`
    );
  } catch (e) {
    console.error('captura-pagina:', e);
    return json({ ok: false, error: e.message }, 502);
  }
  if (!integration) return json({ ok: false, error: `Integração "${slug}" não encontrada` }, 404);

  const globalToken = process.env.LEAD_CAPTURE_TOKEN;
  if (key !== integration.public_key && !(globalToken && key === globalToken)) {
    return json({ ok: false, error: 'chave inválida' }, 401);
  }

  const origin = first(body, ['pagina_url']) || req.headers.get('referer') || req.headers.get('origin') || null;
  const logSubmission = (status, extra = {}) =>
    db('page_integration_submissions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ integration_id: integration.id, status, payload: body, origin, ...extra }),
    }).catch((e) => console.warn('page_integration_submissions:', e.message));

  const fail = async (error, status) => {
    await logSubmission('erro', { error });
    return json({ ok: false, error }, status);
  };

  if (!integration.is_active) return fail('Integração pausada', 403);

  const nome = first(body, NAME_KEYS);
  const email = first(body, EMAIL_KEYS).toLowerCase();
  const whatsapp = waCanon(first(body, PHONE_KEYS));

  // crm_leads exige nome e whatsapp
  if (!nome || !whatsapp) return fail('Informe nome e WhatsApp.', 400);

  const utms = {};
  for (const k of UTM_KEYS) {
    const v = first(body, [k]);
    if (v) utms[k] = v.slice(0, 160);
  }
  const extras = Object.entries(body)
    .filter(([k, v]) => !IGNORED_KEYS.has(k) && v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => [k, String(v).slice(0, 300)]);

  const board = integration.board;
  const done = (status, leadId, extra = {}) =>
    Promise.all([
      logSubmission(status, { lead_id: leadId }),
      status === 'teste' ? null : db('rpc/page_integration_bump', {
        method: 'POST',
        body: JSON.stringify({ p_id: integration.id }),
      }).catch((e) => console.warn('page_integration_bump:', e.message)),
    ]).then(() => json({
      ok: true,
      id: leadId,
      status,
      redirect_url: integration.redirect_url || null,
      success_message: integration.success_message || null,
      ...extra,
    }));

  try {
    let columnId = integration.column_id;
    let columnName = null;
    const columnFilter = columnId ? `id=eq.${columnId}` : `board_id=eq.${board.id}&order=sort_order.asc`;
    const [column] = await db(`crm_columns?${columnFilter}&select=id,name&limit=1`);
    if (!column) return fail(`Quadro "${board.name}" sem colunas`, 404);
    columnId = column.id;
    columnName = column.name;

    if (isTest) {
      return done('teste', null, {
        teste: true,
        lead: { name: nome, whatsapp, email: email || null, quadro: board.name, coluna: columnName, tags: integration.tags },
      });
    }

    const notes = [
      `Inscrição via página (${integration.name})`,
      email ? `E-mail: ${email}` : '',
      ...extras.map(([k, v]) => `${k}: ${v}`),
      ...Object.entries(utms).map(([k, v]) => `${k}: ${v}`),
      origin ? `Página: ${origin}` : '',
    ].filter(Boolean).join('\n');

    const dupFilter = email
      ? `or=${encodeURIComponent(`(whatsapp.eq.${whatsapp},email.eq."${email.replace(/"/g, '')}")`)}`
      : `whatsapp=eq.${whatsapp}`;
    const [existing] = await db(`crm_leads?board_id=eq.${board.id}&${dupFilter}&select=id,tags&limit=1`);

    const mergeTags = (current) => Array.from(new Set([...(current || []), ...(integration.tags || [])]));

    if (existing) {
      await db(`crm_leads?id=eq.${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nome, email: email || undefined, tags: mergeTags(existing.tags) }),
      });
      return done('atualizado', existing.id, { duplicado: true });
    }

    const [lead] = await db('crm_leads', {
      method: 'POST',
      body: JSON.stringify({
        board_id: board.id,
        column_id: columnId,
        name: nome,
        whatsapp,
        email: email || null,
        source: `pagina:${integration.slug}`,
        tags: [],
        notes,
      }),
    });

    if ((integration.tags || []).length > 0) {
      await db(`crm_leads?id=eq.${lead.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ tags: mergeTags([]) }),
      });
    }

    await db('crm_activities', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        lead_id: lead.id,
        board_id: board.id,
        activity_type: 'lead_created',
        description: `Lead ${nome} capturado via página (${integration.name})`,
        board_name: board.name,
        to_column_name: columnName,
        metadata: { source: `pagina:${integration.slug}`, integracao: integration.slug, origin, ...utms },
      }),
    }).catch((e) => console.warn('crm_activities:', e.message));

    return done('novo', lead.id);
  } catch (e) {
    console.error('captura-pagina:', e);
    return fail(e.message, 502);
  }
};
