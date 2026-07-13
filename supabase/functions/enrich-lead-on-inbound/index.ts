// Disparado pelo uazapi-webhook-receiver toda vez que um lead manda
// mensagem inbound. Faz scrap leve do Instagram dele (via ScrapCreator)
// e atualiza a foto de perfil no CRM. Tem cache de 1 dia pra nao
// estourar quota — o scrap so roda se a ultima execucao foi ha mais de
// 24h (ou nunca rodou).
//
// Fluxo:
//   1. Le crm_leads pelo id
//   2. Se nao tem `instagram` field -> skip
//   3. Le instagram_data.last_scrap_at -> se < 24h, skip
//   4. Invoca masterclass-instagram-scrap (que ja existe)
//   5. Atualiza instagram_profile_pic_url + instagram_data
//
// Why: o user quer ver a foto atualizada do lead no chat + leadview.
// How to apply: chamado fire-and-forget do webhook, nao bloqueia o
// fluxo da mensagem.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCRAP_CACHE_MS = 24 * 60 * 60 * 1000; // 1 dia

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'lead_id required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: lead, error: leadErr } = await supabase
      .from('crm_leads')
      .select('id, name, instagram, instagram_profile_pic_url, instagram_data')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ success: false, error: 'lead not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!lead.instagram) {
      return new Response(
        JSON.stringify({ success: false, skipped: 'no instagram handle' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache check — last_scrap_at no instagram_data JSONB
    const instagramData = (lead.instagram_data as any) || {};
    const lastScrapAt = instagramData.last_scrap_at;
    if (lastScrapAt && (Date.now() - new Date(lastScrapAt).getTime() < SCRAP_CACHE_MS)) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: 'cache hit',
          last_scrap_at: lastScrapAt,
          profile_pic_url: lead.instagram_profile_pic_url,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invoca a function de scrap que ja existe
    const scrapRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/masterclass-instagram-scrap`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ username: lead.instagram }),
      }
    );

    if (!scrapRes.ok) {
      const txt = await scrapRes.text();
      console.error(`[enrich-lead] scrap failed for ${lead.instagram}: ${scrapRes.status} ${txt.slice(0, 200)}`);
      // Marca tentativa mesmo em falha pra nao retentar imediatamente
      await supabase.from('crm_leads').update({
        instagram_data: { ...instagramData, last_scrap_at: new Date().toISOString(), last_scrap_error: txt.slice(0, 200) },
      }).eq('id', lead.id);
      return new Response(
        JSON.stringify({ success: false, error: 'scrap failed', status: scrapRes.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const scrapData = await scrapRes.json();
    const profilePicUrl = scrapData?.profilePicPath
      || scrapData?.profile?.profile_pic_url_hd
      || scrapData?.profile?.profile_pic_url
      || null;

    if (!profilePicUrl) {
      console.warn(`[enrich-lead] no pic in scrap for ${lead.instagram}`);
    }

    // Atualiza o lead — guarda profile pic + metadata + timestamp
    const updates: Record<string, unknown> = {
      instagram_data: {
        ...instagramData,
        last_scrap_at: new Date().toISOString(),
        last_scrap_summary: scrapData?.summary || null,
        profile_pic_url: profilePicUrl,
      },
    };
    if (profilePicUrl) {
      updates.instagram_profile_pic_url = profilePicUrl;
    }

    const { error: updErr } = await supabase
      .from('crm_leads')
      .update(updates)
      .eq('id', lead.id);

    if (updErr) {
      console.error('[enrich-lead] update failed:', updErr);
      return new Response(
        JSON.stringify({ success: false, error: updErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[enrich-lead] ${lead.name} (@${lead.instagram}) atualizado, pic=${!!profilePicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        profile_pic_url: profilePicUrl,
        followers: scrapData?.summary?.followers,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[enrich-lead] error:', e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
