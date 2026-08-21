-- Evento em 26/09 tem que aparecer como 26/09 pra todo mundo.
--
-- event_date era timestamptz. O formulário manda '2026-09-26', o Postgres guarda
-- '2026-09-26 00:00:00+00' (meia-noite UTC) e o navegador em Brasília (UTC-3) volta 3 horas
-- ao exibir: 25/09 21:00. Daí o card mostrar "25 SET" num evento configurado pro dia 26.
--
-- Data de evento é data civil, não instante no tempo — o horário já vive separado em
-- event_time (text). Então o tipo certo é `date`, que não carrega fuso.
-- Os 2 eventos existentes estão à meia-noite UTC, então a conversão é exata.
ALTER TABLE public.events
  ALTER COLUMN event_date TYPE date USING (event_date AT TIME ZONE 'UTC')::date;

-- Evento de vários dias (o RPG10X são 2, e há formações de 3+). Vazio = evento de um dia só.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_end_date date;

-- Link de inscrição/pagamento — é o destino do botão "Garantir Vaga" no card do membro.
-- Separado de meeting_url de propósito: um evento presencial tem link de pagamento e nenhuma
-- sala; um online pode ter os dois (paga aqui, entra ali).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS payment_url text;

ALTER TABLE public.events
  ADD CONSTRAINT events_fim_depois_do_inicio
  CHECK (event_end_date IS NULL OR event_end_date >= event_date);
