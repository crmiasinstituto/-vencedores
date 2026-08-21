-- Escassez real: a vaga do evento diminui sozinha a cada venda que chega da Eduzz.
--
-- O casamento é por texto do produto porque é o que a Eduzz manda (sales_events.product_name)
-- e o que o time reconhece. Guardar o texto no evento deixa o controle na tela: se amanhã o
-- produto virar "RPG10X Salvador Setembro", basta editar o evento.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS eduzz_produto_match text;

COMMENT ON COLUMN public.events.eduzz_produto_match IS
  'Trecho do nome do produto na Eduzz. Toda venda em sales_events cujo product_name contenha '
  'este texto (sem diferenciar maiúsculas) desconta 1 vaga deste evento. Vazio = não desconta.';

CREATE OR REPLACE FUNCTION public.baixar_vaga_evento_por_venda()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(NEW.product_name, '') = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.events e
     SET spots_remaining = GREATEST(coalesce(e.spots_remaining, 0) - 1, 0)
   WHERE e.is_active
     AND coalesce(e.eduzz_produto_match, '') <> ''
     AND NEW.product_name ILIKE '%' || e.eduzz_produto_match || '%'
     -- Nunca mexe em evento já passado: venda atrasada não deve furar o contador do próximo.
     AND coalesce(e.event_end_date, e.event_date) >= current_date
     AND coalesce(e.spots_remaining, 0) > 0;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_baixar_vaga_evento ON public.sales_events;
CREATE TRIGGER trg_baixar_vaga_evento
  AFTER INSERT ON public.sales_events
  FOR EACH ROW EXECUTE FUNCTION public.baixar_vaga_evento_por_venda();
