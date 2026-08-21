-- Garante, no banco, que um lead recebe UMA vez cada campanha.
--
-- Em 03/08 uma campanha enviou 16.991 e-mails para 251 pessoas — alguém recebeu a mesma
-- mensagem 198 vezes. A causa foi lógica de aplicação: send-email-campaign resolve a audiência
-- pelos `audience_filters` quando eles existem, e não pela fila de pendentes. Ao processar em
-- lotes, o "primeiros 200" era sempre o MESMO grupo; marcar o lead como enviado não alterava a
-- resolução. O cron reinvocava a cada minuto e o grupo era servido de novo.
--
-- Trava de aplicação não basta: qualquer regressão futura repete o estrago. O índice único
-- abaixo torna o reenvio impossível — a segunda inserção falha, e o código trata isso como
-- "já enviou, pula".

-- 1) Preserva as linhas duplicadas antes de limpar. São a prova do ocorrido e podem ser
--    necessárias se houver reclamação de spam.
CREATE TABLE IF NOT EXISTS public.email_sends_duplicados_20260804 AS
SELECT * FROM public.email_sends s
 WHERE EXISTS (
   SELECT 1 FROM public.email_sends o
    WHERE o.campaign_id = s.campaign_id
      AND lower(o.email) = lower(s.email)
      AND o.created_at < s.created_at
 );

-- 2) Mantém só o primeiro envio de cada (campanha, e-mail).
DELETE FROM public.email_sends s
 WHERE EXISTS (
   SELECT 1 FROM public.email_sends o
    WHERE o.campaign_id = s.campaign_id
      AND lower(o.email) = lower(s.email)
      AND o.created_at < s.created_at
 );

-- 3) A partir daqui é fisicamente impossível enviar duas vezes a mesma campanha pro mesmo
--    e-mail. Vale também pra campaign_id nulo? Não: envios avulsos não têm campanha.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_sends_campanha_email
  ON public.email_sends (campaign_id, lower(email))
  WHERE campaign_id IS NOT NULL;
