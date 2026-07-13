// One-shot admin function — itera todas as instances conectadas e
// re-registra o webhook UAZAPI com events corretos (incluindo
// `messages_update` que entrega os Delivered/Read receipts). Sem isso,
// instances antigas ficam sem confirmacao de leitura (CheckCheck azul
// nunca aparece). Roda manualmente uma vez via:
//   npx supabase functions invoke refresh-webhooks-once --no-verify-jwt
// ou via curl com service role key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UAZAPI_BASE_URL = 'https://squaad.uazapi.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: instances } = await supabase
    .from('whatsapp_instances')
    .select('id, instance_name, instance_token, status')
    .eq('status', 'connected');

  const results: Array<Record<string, unknown>> = [];

  for (const inst of instances || []) {
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/uazapi-webhook-receiver`;
    try {
      const res = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': inst.instance_token },
        body: JSON.stringify({
          url: webhookUrl,
          enabled: true,
          events: ['messages', 'connection', 'messages_update'],
          excludeMessages: ['wasSentByApi'],
        }),
      });
      const ok = res.ok;
      const txt = await res.text();
      results.push({
        instance: inst.instance_name,
        ok,
        status: res.status,
        body: txt.slice(0, 200),
      });
      if (ok) {
        await supabase.from('whatsapp_instances').update({ webhook_url: webhookUrl }).eq('id', inst.id);
      }
    } catch (e) {
      results.push({ instance: inst.instance_name, ok: false, error: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ count: results.length, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
