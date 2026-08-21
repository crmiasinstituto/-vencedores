-- Registra quem tentou comprar e não concluiu (boleto/PIX gerado, cartão recusado).
--
-- Até aqui o eduzz-webhook descartava todo evento que não fosse "pago" — inclusive
-- `myeduzz.contract_card_attempted`, que é a pessoa com o cartão recusado, o lead mais quente
-- que existe. Ninguém ficava sabendo.
--
-- Estes NÃO viram venda: sales_events continua exclusivo de pagamento confirmado, senão o
-- faturamento infla. Aqui é só lead + tag de estágio, pra alimentar automação de recuperação.
CREATE OR REPLACE FUNCTION public.eduzz_registrar_intencao(
  p_email    text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_nome     text DEFAULT NULL,
  p_tag      text DEFAULT 'checkout-abandonado',
  p_motivo   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_lead   uuid;
  v_tel    text := nullif(regexp_replace(coalesce(p_telefone,''), '[^0-9]', '', 'g'), '');
  v_email  text := nullif(lower(trim(p_email)), '');
  v_nome   text := nullif(trim(coalesce(p_nome, '')), '');
  v_tags   text[] := ARRAY[p_tag, 'eduzz-intencao'];
BEGIN
  IF v_email IS NULL AND v_tel IS NULL THEN
    RETURN NULL;
  END IF;

  -- Casa pelos últimos 9 dígitos do telefone (o 9º dígito e o DDI variam entre origens) ou
  -- pelo e-mail. Mesma convenção do atribuir_indicacao, pra não criar lead duplicado.
  SELECT id INTO v_lead
    FROM public.crm_leads
   WHERE (v_tel IS NOT NULL AND length(v_tel) >= 8
          AND regexp_replace(coalesce(whatsapp,''), '[^0-9]', '', 'g') LIKE '%' || right(v_tel, 9))
      OR (v_email IS NOT NULL AND lower(email) = v_email)
   ORDER BY updated_at DESC NULLS LAST
   LIMIT 1;

  IF v_lead IS NULL THEN
    INSERT INTO public.crm_leads (name, email, whatsapp, source, tags)
    VALUES (coalesce(v_nome, split_part(coalesce(v_email,'lead'), '@', 1)), v_email, v_tel,
            'eduzz_intencao', v_tags)
    RETURNING id INTO v_lead;
  ELSE
    -- Lead existente: acrescenta as tags sem apagar as que já tinha, e completa os campos
    -- que estiverem vazios (nunca sobrescreve dado bom com dado da Eduzz).
    UPDATE public.crm_leads
       SET tags = (SELECT array_agg(DISTINCT t)
                     FROM unnest(coalesce(tags, '{}') || v_tags) t),
           name = coalesce(nullif(name, ''), v_nome, name),
           email = coalesce(nullif(email, ''), v_email, email),
           whatsapp = coalesce(nullif(whatsapp, ''), v_tel, whatsapp),
           updated_at = now()
     WHERE id = v_lead;
  END IF;

  -- Deixa o motivo na timeline do lead ("Cartão bloqueado", "Saldo insuficiente"...) — é o que
  -- o time precisa saber pra abordar a pessoa.
  BEGIN
    INSERT INTO public.crm_activities (lead_id, activity_type, description, metadata)
    VALUES (v_lead, 'eduzz_intencao',
            coalesce('Eduzz: ' || p_tag || coalesce(' — ' || p_motivo, ''), 'Eduzz: intenção de compra'),
            jsonb_build_object('tag', p_tag, 'motivo', p_motivo));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'timeline da intenção falhou: %', sqlerrm;
  END;

  RETURN v_lead;
END;
$function$;
