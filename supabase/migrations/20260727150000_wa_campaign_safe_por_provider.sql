-- O guard anti-ban exigia is_dedicated_blast=true na instancia da campanha. Isso faz sentido
-- pra UAZAPI (numero nao-oficial: blast em numero compartilhado derruba a sessao / toma ban),
-- mas estava sendo aplicado tambem a cloud_api — a API oficial da Meta, que E o canal
-- sancionado pra template broadcast e nao tem esse risco.
--
-- Efeito do bug: toda campanha cloud_api saia de 'sending' e voltava pra 'paused' no primeiro
-- tick do wa-blast-processor (a cada 2 min), com 0 enviados e os leads presos em 'pending'.
-- Continua obrigatorio ter dedicated_instance_id nos dois casos — sem ele nao ha de onde enviar.
CREATE OR REPLACE FUNCTION public.assert_wa_campaign_safe(p_campaign_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_instance_id uuid;
  v_is_dedicated boolean;
  v_provider text;
BEGIN
  SELECT c.dedicated_instance_id, i.is_dedicated_blast, coalesce(c.provider, 'uazapi')
    INTO v_instance_id, v_is_dedicated, v_provider
  FROM wa_campaigns c
  LEFT JOIN whatsapp_instances i ON i.id = c.dedicated_instance_id
  WHERE c.id = p_campaign_id;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'wa_campaign %: dedicated_instance_id e obrigatorio', p_campaign_id;
  END IF;

  IF v_provider <> 'cloud_api' AND v_is_dedicated IS NOT TRUE THEN
    RAISE EXCEPTION 'wa_campaign %: instancia % nao esta marcada como is_dedicated_blast=true (anti-ban)', p_campaign_id, v_instance_id;
  END IF;
END;
$function$;
