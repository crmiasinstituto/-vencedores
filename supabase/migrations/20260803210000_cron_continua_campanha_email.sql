-- Continua campanhas de e-mail que ficaram no meio.
--
-- send-email-campaign processa um lote por invocação (a edge function morre no limite de ~150s).
-- Sem alguém pra chamar de novo, a campanha travava em 'sending' pra sempre — foi o que houve
-- em 03/08: 101 de 1.000 enviados e nada mais.
--
-- A função é verify_jwt=true, então o header Authorization é obrigatório (o mesmo esquecimento
-- que deixou o email-automation-tick tomando 401 por semanas).
SELECT cron.schedule(
  'email-campaign-continua',
  '* * * * *',
  $job$
  DO $inner$
  DECLARE c record;
  BEGIN
    FOR c IN
      SELECT id FROM public.email_campaigns
       WHERE status = 'sending'
         AND EXISTS (SELECT 1 FROM public.email_campaign_leads l
                      WHERE l.campaign_id = email_campaigns.id AND l.status = 'pending')
       ORDER BY started_at
       LIMIT 1        -- uma por vez: duas campanhas em paralelo estouram o limite de 10 req/s do Resend
    LOOP
      PERFORM net.http_post(
        url := 'https://iymlwsawrmghhbawiavz.supabase.co/functions/v1/send-email-campaign',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ***SERVICE_ROLE_REMOVIDA***'
        ),
        body := jsonb_build_object('campaign_id', c.id),
        timeout_milliseconds := 150000
      );
    END LOOP;
  END
  $inner$;
  $job$
);
