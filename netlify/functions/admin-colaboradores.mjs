/**
 * admin-colaboradores — CRUD de quem entra no /admin, com permissão por área.
 *
 * Por que Netlify e não edge function: criar usuário no Supabase Auth exige a service_role, que
 * não pode chegar ao navegador — e o projeto Supabase está no teto de 100 edge functions.
 *
 * SEGURANÇA (o ponto sensível desta função):
 *   1. o chamador precisa mandar o próprio access_token no header Authorization;
 *   2. o token é validado em /auth/v1/user — não confiamos em nada vindo do body;
 *   3. o e-mail do token tem que estar em app_admins com is_active e acesso a
 *      /admin/configuracoes. Sem isso qualquer usuário logado (inclusive um membro do
 *      /membros) conseguiria se promover a admin.
 *
 * POST /.netlify/functions/admin-colaboradores
 *   { action: 'list' }
 *   { action: 'create', email, senha, nome?, permissoes: string[] }
 *   { action: 'update', email, permissoes?, is_active?, nome?, senha? }
 *   { action: 'delete', email }
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const AREA_COLABORADORES = '/admin/configuracoes';

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ ok: false, error: 'Servidor sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  const sb = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  // ---- 1) quem está chamando? ----
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'Não autenticado' }, 401);

  let solicitante;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
    if (!r.ok) return json({ ok: false, error: 'Sessão inválida' }, 401);
    solicitante = await r.json();
  } catch (e) {
    return json({ ok: false, error: `Falha validando sessão: ${e.message}` }, 502);
  }
  const emailSolicitante = String(solicitante?.email || '').toLowerCase();
  if (!emailSolicitante) return json({ ok: false, error: 'Sessão sem e-mail' }, 401);

  // ---- 2) o chamador pode mexer em colaboradores? ----
  let eu;
  try {
    const r = await fetch(
      `${url}/rest/v1/app_admins?email=eq.${encodeURIComponent(emailSolicitante)}&select=email,is_active,permissoes`,
      { headers: sb },
    );
    eu = (await r.json())?.[0];
  } catch (e) {
    return json({ ok: false, error: `Falha lendo permissões: ${e.message}` }, 502);
  }
  const permissoesDoSolicitante = eu?.permissoes || [];
  const podeGerenciar =
    eu?.is_active && (permissoesDoSolicitante.includes('*') || permissoesDoSolicitante.includes(AREA_COLABORADORES));
  if (!podeGerenciar) return json({ ok: false, error: 'Sem permissão para gerenciar colaboradores' }, 403);

  let body = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Body inválido' }, 400); }

  const action = body.action;
  const email = String(body.email || '').trim().toLowerCase();

  // ---- LIST ----
  if (action === 'list') {
    const r = await fetch(`${url}/rest/v1/app_admins?select=email,nome,is_active,permissoes,added_at,added_by&order=added_at.asc`, { headers: sb });
    if (!r.ok) return json({ ok: false, error: await r.text() }, 502);
    return json({ ok: true, colaboradores: await r.json() });
  }

  if (!email) return json({ ok: false, error: 'E-mail obrigatório' }, 400);

  // ---- CREATE ----
  if (action === 'create') {
    const senha = String(body.senha || '');
    if (senha.length < 6) return json({ ok: false, error: 'Senha precisa de ao menos 6 caracteres' }, 400);
    const permissoes = Array.isArray(body.permissoes) && body.permissoes.length ? body.permissoes : [];
    if (!permissoes.length) return json({ ok: false, error: 'Selecione ao menos uma área' }, 400);

    // Usuário pode já existir no Auth (ex: cadastrou no /membros). Nesse caso reaproveitamos
    // o login em vez de falhar — o que importa é a linha em app_admins.
    let criado = false;
    const rc = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: sb,
      body: JSON.stringify({ email, password: senha, email_confirm: true }),
    });
    if (rc.ok) {
      criado = true;
    } else {
      const txt = await rc.text();
      const jaExiste = /already|registered|exists/i.test(txt);
      if (!jaExiste) return json({ ok: false, error: `Falha criando usuário: ${txt.slice(0, 200)}` }, 502);
      // já existia: aplica a senha informada pra ficar igual ao que o admin digitou
      const rl = await fetch(`${url}/auth/v1/admin/users?email=eq.${encodeURIComponent(email)}`, { headers: sb });
      const lista = rl.ok ? await rl.json() : null;
      const uid = lista?.users?.[0]?.id;
      if (uid) {
        await fetch(`${url}/auth/v1/admin/users/${uid}`, {
          method: 'PUT', headers: sb, body: JSON.stringify({ password: senha, email_confirm: true }),
        });
      }
    }

    const ru = await fetch(`${url}/rest/v1/app_admins`, {
      method: 'POST',
      headers: { ...sb, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        email,
        nome: body.nome || null,
        permissoes,
        is_active: true,
        added_by: `${emailSolicitante} via tela de colaboradores`,
      }),
    });
    if (!ru.ok) return json({ ok: false, error: `Falha salvando permissões: ${(await ru.text()).slice(0, 200)}` }, 502);
    return json({ ok: true, criado, colaborador: (await ru.json())?.[0] });
  }

  // ---- UPDATE ----
  if (action === 'update') {
    const patch = {};
    if (Array.isArray(body.permissoes)) patch.permissoes = body.permissoes;
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (typeof body.nome === 'string') patch.nome = body.nome;

    // Trava de segurança: ninguém tira o próprio acesso e fica de fora do sistema.
    if (email === emailSolicitante && (patch.is_active === false || (patch.permissoes && !patch.permissoes.includes('*') && !patch.permissoes.includes(AREA_COLABORADORES)))) {
      return json({ ok: false, error: 'Você não pode remover o seu próprio acesso a Colaboradores' }, 400);
    }

    if (Object.keys(patch).length) {
      const r = await fetch(`${url}/rest/v1/app_admins?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH', headers: { ...sb, Prefer: 'return=representation' }, body: JSON.stringify(patch),
      });
      if (!r.ok) return json({ ok: false, error: (await r.text()).slice(0, 200) }, 502);
    }

    if (body.senha) {
      if (String(body.senha).length < 6) return json({ ok: false, error: 'Senha precisa de ao menos 6 caracteres' }, 400);
      const rl = await fetch(`${url}/auth/v1/admin/users?email=eq.${encodeURIComponent(email)}`, { headers: sb });
      const uid = rl.ok ? (await rl.json())?.users?.[0]?.id : null;
      if (!uid) return json({ ok: false, error: 'Usuário não encontrado no Auth' }, 404);
      const rp = await fetch(`${url}/auth/v1/admin/users/${uid}`, {
        method: 'PUT', headers: sb, body: JSON.stringify({ password: String(body.senha) }),
      });
      if (!rp.ok) return json({ ok: false, error: `Falha trocando senha: ${(await rp.text()).slice(0, 200)}` }, 502);
    }
    return json({ ok: true });
  }

  // ---- DELETE (tira o acesso ao admin; NÃO apaga o usuário do Auth) ----
  if (action === 'delete') {
    if (email === emailSolicitante) return json({ ok: false, error: 'Você não pode remover a si mesmo' }, 400);
    const r = await fetch(`${url}/rest/v1/app_admins?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', headers: sb });
    if (!r.ok) return json({ ok: false, error: (await r.text()).slice(0, 200) }, 502);
    return json({ ok: true });
  }

  return json({ ok: false, error: `Ação desconhecida: ${action}` }, 400);
};
