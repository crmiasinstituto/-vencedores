-- Busca contínua das fotos de perfil dos leads.
--
-- São ~7.200 leads com conversa e a UAZAPI limita chamadas — fazer tudo de uma vez derruba
-- a sessão da Camila (já aconteceu antes, ver memória). Então: 50 por rodada, de 10 em 10
-- minutos, dentro do horário comercial. Dá ~300/hora e cobre a base em poucos dias, sem
-- pressa e sem risco.
--
-- A função é da Netlify porque o Supabase está no teto de 100 edge functions.

select cron.unschedule('sync-fotos-leads')
  where exists (select 1 from cron.job where jobname = 'sync-fotos-leads');

select cron.schedule(
  'sync-fotos-leads',
  '*/10 11-23 * * *',   -- UTC = 8h às 20h de Brasília
  $cron$
  select public.cron_http_call(
    'sync-fotos-leads',
    'https://iasinstituto.com.br/.netlify/functions/sync-fotos-leads',
    jsonb_build_object('Content-Type','application/json'),
    jsonb_build_object('limite', 50),
    120000
  );
  $cron$
);

insert into public.system_automation_meta (key, source, label, description, category) values
  ('sync-fotos-leads', 'cron', 'Fotos de perfil dos leads',
   'Baixa a foto do WhatsApp e guarda no nosso storage — o link do WhatsApp expira em poucos dias. 50 por rodada para não derrubar a sessão da linha não-oficial.',
   'WhatsApp')
on conflict (key) do update set label = excluded.label, description = excluded.description;
