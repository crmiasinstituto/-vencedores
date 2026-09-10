/**
 * sync-fotos-leads — baixa a foto de perfil do WhatsApp dos leads e guarda no NOSSO storage.
 *
 * Por que baixar em vez de só apontar: a URL que o WhatsApp devolve (pps.whatsapp.net) tem
 * expiração no próprio link (`oe=...`). Guardar a URL crua significa foto quebrada em poucos
 * dias — que é onde estávamos: 7 leads com foto em 43.728, e nenhuma no nosso storage.
 *
 * Por que Netlify e não edge function: o Supabase está no teto de 100 (ver memória).
 *
 * Só a linha UAZAPI consegue essa informação. A Cloud API da Meta NÃO expõe foto de perfil
 * de contato — é limitação da plataforma, não do CRM. Então a foto vem sempre pela Camila,
 * independente de por qual número a conversa aconteceu.
 *
 * POST /.netlify/functions/sync-fotos-leads
 *   { limite?: number = 60, refazer?: boolean = false }
 *   - por padrão pega só quem ainda não tem foto nossa
 *   - `refazer: true` reprocessa quem já tem (para atualizar foto trocada)
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body, status = 200) => ({
  statusCode: status,
  headers: { ...cors, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Só dígitos, sem DDI duplicado. */
const soDigitos = (s) => String(s || '').replace(/\D/g, '');

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Servidor sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const { limite = 60, refazer = false } = JSON.parse(event.body || '{}');

  const sb = (caminho, init = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

  // 1. Credencial da linha UAZAPI (a única que devolve foto de contato).
  const instRes = await sb('whatsapp_instances?provider=eq.uazapi&select=id,instance_token,api_url&limit=1');
  const [inst] = await instRes.json();
  if (!inst?.instance_token) return json({ error: 'Sem instância UAZAPI com token' }, 424);
  const uazUrl = inst.api_url || 'https://squaad.uazapi.com';

  // 2. Leads que têm conversa (são os que aparecem no inbox) e ainda não têm foto nossa.
  //    `whatsapp_profile_pic_url` que não aponte pro nosso storage conta como sem foto:
  //    é link do WhatsApp, que expira.
  const filtro = refazer
    ? 'whatsapp=not.is.null'
    : 'whatsapp=not.is.null&or=(whatsapp_profile_pic_url.is.null,whatsapp_profile_pic_url.not.like.*supabase*)';
  const leadsRes = await sb(
    `crm_leads?${filtro}&select=id,whatsapp,name&order=updated_at.desc&limit=${Math.min(limite, 200)}`,
  );
  const leads = await leadsRes.json();
  if (!Array.isArray(leads) || !leads.length) {
    return json({ ok: true, processados: 0, motivo: 'nenhum lead pendente' });
  }

  let comFoto = 0;
  let semFoto = 0;
  let erros = 0;

  for (const lead of leads) {
    const numero = soDigitos(lead.whatsapp);
    if (numero.length < 10) { semFoto++; continue; }

    try {
      // 3. Pergunta a foto à UAZAPI.
      const r = await fetch(`${uazUrl}/chat/GetNameAndImageURL`, {
        method: 'POST',
        headers: { token: inst.instance_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: numero, preview: false }),
      });
      const dados = await r.json().catch(() => ({}));
      const urlFoto = dados?.image || dados?.imagePreview;
      if (!urlFoto) { semFoto++; continue; }

      // 4. Baixa e guarda. É este passo que faz a foto parar de sumir.
      const img = await fetch(urlFoto);
      if (!img.ok) { erros++; continue; }
      const bytes = Buffer.from(await img.arrayBuffer());
      const mime = img.headers.get('content-type') || 'image/jpeg';
      const caminho = `perfis/${numero}.jpg`;

      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/chat-media/${caminho}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': mime,
          'x-upsert': 'true',
        },
        body: bytes,
      });
      if (!up.ok) { erros++; continue; }

      const publica = `${SUPABASE_URL}/storage/v1/object/public/chat-media/${caminho}`;

      // 5. Grava no lead. O nome do WhatsApp entra só se o lead não tiver nome de verdade.
      const patch = { whatsapp_profile_pic_url: publica, updated_at: new Date().toISOString() };
      const semNome = !lead.name || /^\+?\d[\d\s()-]*$/.test(lead.name) || lead.name === 'Sem nome';
      if (semNome && dados?.name) patch.name = dados.name;

      await sb(`crm_leads?id=eq.${lead.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      comFoto++;

      // Respiro entre chamadas: a UAZAPI limita e derrubar a sessão custa mais caro
      // do que demorar um pouco.
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      console.error(`[foto] lead ${lead.id}: ${e.message}`);
      erros++;
    }
  }

  return json({ ok: true, processados: leads.length, comFoto, semFoto, erros });
}
