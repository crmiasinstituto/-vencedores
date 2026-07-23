/**
 * captura-lead — webhook público pra landing page externa (popup de nome/email/telefone).
 *
 * Recebe os dados do formulário e cria o contato no CRM, no board RPG10X, coluna "Inscritos",
 * com a tag "Inscritos" (pra identificar a origem). Deduplica por telefone/email: o mesmo
 * inscrito enviando duas vezes não vira dois cards.
 *
 * Fica na Netlify (não no Supabase) porque o Supabase está no teto de 100 edge functions.
 * A escrita no CRM é feita pela RPC public.capturar_lead_inscricao (SECURITY DEFINER), chamada
 * com a service_role — a chave nunca sai do servidor.
 *
 * POST /.netlify/functions/captura-lead
 *   Body JSON (nomes flexíveis): { nome|name, email, telefone|phone|whatsapp|celular, token? }
 *   Se LEAD_CAPTURE_TOKEN estiver setado na Netlify, o token é obrigatório (query ?token= ou body.token).
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

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ ok: false, error: 'Servidor sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  let body = {};
  try { body = await req.json(); } catch { /* aceita form vazio -> valida abaixo */ }

  // token opcional (anti-spam leve): só exige se configurado na Netlify
  const expected = process.env.LEAD_CAPTURE_TOKEN;
  if (expected) {
    const got = new URL(req.url).searchParams.get('token') || req.headers.get('x-lead-token') || body.token;
    if (got !== expected) return json({ ok: false, error: 'token inválido' }, 401);
  }

  const nome = first(body, ['nome', 'name', 'nome_completo', 'full_name']);
  const email = first(body, ['email', 'e-mail', 'mail']);
  const telefone = first(body, ['telefone', 'phone', 'whatsapp', 'celular', 'cellphone', 'fone']);

  if (!nome && !email && !telefone) {
    return json({ ok: false, error: 'Informe ao menos nome, email ou telefone.' }, 400);
  }

  let res;
  try {
    res = await fetch(`${url}/rest/v1/rpc/capturar_lead_inscricao`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_nome: nome || null, p_email: email || null, p_telefone: telefone || null }),
    });
  } catch (e) {
    return json({ ok: false, error: `Falha ao gravar no CRM: ${e.message}` }, 502);
  }

  if (!res.ok) {
    const err = await res.text();
    return json({ ok: false, error: `CRM ${res.status}: ${err.slice(0, 200)}` }, 502);
  }

  const id = await res.json();
  return json({ ok: true, id });
};
