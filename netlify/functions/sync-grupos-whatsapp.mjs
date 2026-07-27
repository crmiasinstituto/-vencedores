/**
 * sync-grupos-whatsapp — importa TODOS os grupos que as instâncias UAZAPI conectadas
 * participam pra dentro do CRM (tabela whatsapp_groups), pra podermos ligar automação.
 *
 * Por que Netlify e não edge function: o Supabase está no teto de 100 edge functions.
 * A leitura das instâncias e o upsert dos grupos são feitos com a service_role, que
 * nunca sai do servidor. O token de cada instância vem do banco (whatsapp_instances).
 *
 * UAZAPI: GET https://squaad.uazapi.com/group/list?force=false  (header token: <instance_token>)
 *   → { groups: [{ JID, Name, Topic, ParticipantCount, OwnerPN, IsAnnounce, ... }] }
 *
 * Upsert por group_jid (só dígitos, mesma convenção do cadastro manual). Campos de
 * configuração do espião (is_spy_active, is_broadcast_enabled, linked_module_id...) NÃO
 * são enviados: em grupo já existente ficam intactos; em grupo novo caem no default do banco.
 *
 * POST /.netlify/functions/sync-grupos-whatsapp
 *   Body opcional: { instance_id?: uuid }  — se omitido, sincroniza todas as conectadas.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UAZ = process.env.UAZAPI_BASE_URL || 'https://squaad.uazapi.com';

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ ok: false, error: 'Servidor sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  const sbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

  let body = {};
  try { body = await req.json(); } catch { /* body vazio = todas as instâncias */ }
  const onlyInstance = body?.instance_id;

  // instâncias UAZAPI conectadas (com token)
  let filter = 'provider=eq.uazapi&status=eq.connected';
  if (onlyInstance) filter += `&id=eq.${onlyInstance}`;
  let instances = [];
  try {
    const r = await fetch(`${url}/rest/v1/whatsapp_instances?${filter}&select=id,instance_name,instance_token`, { headers: sbHeaders });
    if (!r.ok) return json({ ok: false, error: `Falha lendo instâncias: ${r.status} ${(await r.text()).slice(0, 160)}` }, 502);
    instances = await r.json();
  } catch (e) {
    return json({ ok: false, error: `Falha lendo instâncias: ${e.message}` }, 502);
  }
  if (!instances.length) return json({ ok: true, total: 0, instances: [], msg: 'Nenhuma instância UAZAPI conectada.' });

  const nowIso = new Date().toISOString();
  let total = 0;
  const report = [];

  for (const inst of instances) {
    if (!inst.instance_token) { report.push({ instance: inst.instance_name, error: 'sem token' }); continue; }

    let groups = [];
    try {
      const gr = await fetch(`${UAZ}/group/list?force=false`, { headers: { token: inst.instance_token } });
      if (!gr.ok) { report.push({ instance: inst.instance_name, error: `uazapi ${gr.status}` }); continue; }
      const gd = await gr.json();
      groups = Array.isArray(gd?.groups) ? gd.groups : [];
    } catch (e) {
      report.push({ instance: inst.instance_name, error: `uazapi: ${e.message}` });
      continue;
    }

    const rows = groups.map((g) => {
      const jid = String(g.JID || '').replace(/@g\.us$/, '').replace(/\D/g, '');
      return {
        group_jid: jid,
        name: g.Name || `Grupo ${jid}`,
        description: g.Topic || null,
        instance_id: inst.id,
        participants_count: g.ParticipantCount || (Array.isArray(g.Participants) ? g.Participants.length : 0) || 0,
        metadata: {
          jid: g.JID || null,
          owner: g.OwnerPN || g.OwnerJID || null,
          is_announce: !!g.IsAnnounce,
          is_locked: !!g.IsLocked,
          group_created: g.GroupCreated || null,
          synced_at: nowIso,
          synced_from: inst.instance_name,
        },
        updated_at: nowIso,
      };
    }).filter((r) => r.group_jid && r.group_jid.length >= 10);

    if (!rows.length) { report.push({ instance: inst.instance_name, groups: 0 }); continue; }

    try {
      const up = await fetch(`${url}/rest/v1/whatsapp_groups?on_conflict=group_jid`, {
        method: 'POST',
        headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!up.ok) { report.push({ instance: inst.instance_name, error: `upsert ${up.status}: ${(await up.text()).slice(0, 160)}` }); continue; }
      total += rows.length;
      report.push({ instance: inst.instance_name, groups: rows.length });
    } catch (e) {
      report.push({ instance: inst.instance_name, error: `upsert: ${e.message}` });
    }
  }

  return json({ ok: true, total, instances: report });
};
