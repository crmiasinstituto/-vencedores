-- ===========================================================
-- BACKFILL Kirvano → CRM Masterclass IA
-- Insere vendas que nao chegaram pelo webhook em sales_events + crm_leads.
-- Idempotente: usa dedupe_key (kirvano:<codigo>) pra nao duplicar.
-- NAO dispara WhatsApp (carregar a mao depois pra nao tomar ban).
-- ===========================================================

DO $$
DECLARE
  v_board_id      uuid;
  v_col_comprou   uuid;
  v_lead_id       uuid;
  v_existing      uuid;
  v_inserted      int := 0;
  v_skipped       int := 0;
BEGIN
  SELECT id INTO v_board_id   FROM crm_boards  WHERE slug = 'masterclass-ia';
  SELECT id INTO v_col_comprou FROM crm_columns WHERE board_id = v_board_id AND name = 'Comprou';

  IF v_board_id IS NULL OR v_col_comprou IS NULL THEN
    RAISE EXCEPTION 'Board masterclass-ia ou coluna Comprou nao encontrado';
  END IF;

  -- 32 vendas APROVADAS pra backfill

  -- 8VN6MMPV Carla Christine Brito Da Silva (5571988869894)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8VN6MMPV' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571988869894' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Carla Christine Brito Da Silva', '5571988869894', 'cchristinebrito.contabil@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T17:41:00-03:00'::timestamptz, '2026-05-17T17:41:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Carla Christine Brito Da Silva - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8VN6MMPV','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T17:41:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Carla Christine Brito Da Silva', 'cchristinebrito.contabil@gmail.com', '5571988869894', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '8VN6MMPV', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8VN6MMPV',
            '{"event": "SALE_APPROVED", "sale_id": "8VN6MMPV", "transaction_id": "8VN6MMPV", "customer": {"name": "Carla Christine Brito Da Silva", "email": "cchristinebrito.contabil@gmail.com", "phone_number": "5571988869894"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T17:41:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5GM4DDKQ Gilva Moura (5571988740740)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5GM4DDKQ' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571988740740' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Gilva Moura', '5571988740740', 'ujgil.gm@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T17:38:00-03:00'::timestamptz, '2026-05-17T17:38:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Gilva Moura - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5GM4DDKQ','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T17:38:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Gilva Moura', 'ujgil.gm@gmail.com', '5571988740740', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '5GM4DDKQ', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5GM4DDKQ',
            '{"event": "SALE_APPROVED", "sale_id": "5GM4DDKQ", "transaction_id": "5GM4DDKQ", "customer": {"name": "Gilva Moura", "email": "ujgil.gm@gmail.com", "phone_number": "5571988740740"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T17:38:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 57ZP4PJM Jacqueline Cabral (5571991916060)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:57ZP4PJM' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571991916060' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Jacqueline Cabral', '5571991916060', 'jacqueline.cabral@hotmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T15:02:00-03:00'::timestamptz, '2026-05-17T15:02:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Jacqueline Cabral - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','57ZP4PJM','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T15:02:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Jacqueline Cabral', 'jacqueline.cabral@hotmail.com', '5571991916060', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '57ZP4PJM', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:57ZP4PJM',
            '{"event": "SALE_APPROVED", "sale_id": "57ZP4PJM", "transaction_id": "57ZP4PJM", "customer": {"name": "Jacqueline Cabral", "email": "jacqueline.cabral@hotmail.com", "phone_number": "5571991916060"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T15:02:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- XEQ62WME priscila kaiala Neris da Silva (5571992333823)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:XEQ62WME' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571992333823' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'priscila kaiala Neris da Silva', '5571992333823', 'priscilakaiala@hotmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T13:05:00-03:00'::timestamptz, '2026-05-17T13:05:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'priscila kaiala Neris da Silva - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','XEQ62WME','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T13:05:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('priscila kaiala Neris da Silva', 'priscilakaiala@hotmail.com', '5571992333823', 'Masterclass AI', 47.0, 'BRL', 'pix',
            'XEQ62WME', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:XEQ62WME',
            '{"event": "SALE_APPROVED", "sale_id": "XEQ62WME", "transaction_id": "XEQ62WME", "customer": {"name": "priscila kaiala Neris da Silva", "email": "priscilakaiala@hotmail.com", "phone_number": "5571992333823"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T13:05:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 8B7DEJW0 Andrea Campos (5571991384059)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8B7DEJW0' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571991384059' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Andrea Campos', '5571991384059', 'andreacamps12@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T13:05:00-03:00'::timestamptz, '2026-05-17T13:05:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Andrea Campos - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8B7DEJW0','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T13:05:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Andrea Campos', 'andreacamps12@gmail.com', '5571991384059', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '8B7DEJW0', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8B7DEJW0',
            '{"event": "SALE_APPROVED", "sale_id": "8B7DEJW0", "transaction_id": "8B7DEJW0", "customer": {"name": "Andrea Campos", "email": "andreacamps12@gmail.com", "phone_number": "5571991384059"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T13:05:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5D7NKW26 Anderson Lima (5571982836626)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5D7NKW26' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571982836626' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Anderson Lima', '5571982836626', 'anderson.lima.baloes@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T12:44:00-03:00'::timestamptz, '2026-05-17T12:44:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Anderson Lima - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5D7NKW26','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T12:44:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Anderson Lima', 'anderson.lima.baloes@gmail.com', '5571982836626', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '5D7NKW26', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5D7NKW26',
            '{"event": "SALE_APPROVED", "sale_id": "5D7NKW26", "transaction_id": "5D7NKW26", "customer": {"name": "Anderson Lima", "email": "anderson.lima.baloes@gmail.com", "phone_number": "5571982836626"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T12:44:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 8VN6M01N Pepe Senra Jr (5571988541407)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8VN6M01N' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571988541407' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Pepe Senra Jr', '5571988541407', 'groupteampsj@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T12:26:00-03:00'::timestamptz, '2026-05-17T12:26:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Pepe Senra Jr - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8VN6M01N','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T12:26:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Pepe Senra Jr', 'groupteampsj@gmail.com', '5571988541407', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '8VN6M01N', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8VN6M01N',
            '{"event": "SALE_APPROVED", "sale_id": "8VN6M01N", "transaction_id": "8VN6M01N", "customer": {"name": "Pepe Senra Jr", "email": "groupteampsj@gmail.com", "phone_number": "5571988541407"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T12:26:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5MVMP6KY Fernando Requiao (5571984410970)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5MVMP6KY' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571984410970' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Fernando Requiao', '5571984410970', 'contato@fernandorequiao.com.br', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T12:12:00-03:00'::timestamptz, '2026-05-17T12:12:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Fernando Requiao - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5MVMP6KY','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T12:12:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Fernando Requiao', 'contato@fernandorequiao.com.br', '5571984410970', 'Masterclass AI', 47.0, 'BRL', 'credit_card',
            '5MVMP6KY', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5MVMP6KY',
            '{"event": "SALE_APPROVED", "sale_id": "5MVMP6KY", "transaction_id": "5MVMP6KY", "customer": {"name": "Fernando Requia\u0003o", "email": "contato@fernandorequiao.com.br", "phone_number": "5571984410970"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "credit_card", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T12:12:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 8R1ZW06G cristiane silva (5575991911297)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8R1ZW06G' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5575991911297' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'cristiane silva', '5575991911297', 'crysfitnessmaia@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T12:04:00-03:00'::timestamptz, '2026-05-17T12:04:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'cristiane silva - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8R1ZW06G','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T12:04:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('cristiane silva', 'crysfitnessmaia@gmail.com', '5575991911297', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '8R1ZW06G', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8R1ZW06G',
            '{"event": "SALE_APPROVED", "sale_id": "8R1ZW06G", "transaction_id": "8R1ZW06G", "customer": {"name": "cristiane silva", "email": "crysfitnessmaia@gmail.com", "phone_number": "5575991911297"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T12:04:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- X993VQDB Alexsandra de (5571999205013)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:X993VQDB' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571999205013' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Alexsandra de', '5571999205013', 'hannanicole@hotmail.com.br', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T11:59:00-03:00'::timestamptz, '2026-05-17T11:59:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Alexsandra de - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','X993VQDB','amount',94.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T11:59:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Alexsandra de', 'hannanicole@hotmail.com.br', '5571999205013', 'Masterclass AI', 94.0, 'BRL', 'pix',
            'X993VQDB', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:X993VQDB',
            '{"event": "SALE_APPROVED", "sale_id": "X993VQDB", "transaction_id": "X993VQDB", "customer": {"name": "Alexsandra de", "email": "hannanicole@hotmail.com.br", "phone_number": "5571999205013"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 94,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T11:59:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5LZ74NBB ADRIANO CARMO SAMPAIO DE ARAUJO (5571988986604)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5LZ74NBB' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571988986604' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'ADRIANO CARMO SAMPAIO DE ARAUJO', '5571988986604', 'adrianocsac@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T11:54:00-03:00'::timestamptz, '2026-05-17T11:54:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'ADRIANO CARMO SAMPAIO DE ARAUJO - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5LZ74NBB','amount',141.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T11:54:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('ADRIANO CARMO SAMPAIO DE ARAUJO', 'adrianocsac@gmail.com', '5571988986604', 'Masterclass AI', 141.0, 'BRL', 'credit_card',
            '5LZ74NBB', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5LZ74NBB',
            '{"event": "SALE_APPROVED", "sale_id": "5LZ74NBB", "transaction_id": "5LZ74NBB", "customer": {"name": "ADRIANO CARMO SAMPAIO DE ARAU\u0001JO", "email": "adrianocsac@gmail.com", "phone_number": "5571988986604"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 141,00", "payment_method": "credit_card", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T11:54:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 51WJZQPM Isa Carla Borges Ribeiro (5571983372486)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:51WJZQPM' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571983372486' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Isa Carla Borges Ribeiro', '5571983372486', 'ysscarla@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T11:45:00-03:00'::timestamptz, '2026-05-17T11:45:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Isa Carla Borges Ribeiro - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','51WJZQPM','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T11:45:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Isa Carla Borges Ribeiro', 'ysscarla@gmail.com', '5571983372486', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '51WJZQPM', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:51WJZQPM',
            '{"event": "SALE_APPROVED", "sale_id": "51WJZQPM", "transaction_id": "51WJZQPM", "customer": {"name": "Isa Carla Borges Ribeiro", "email": "ysscarla@gmail.com", "phone_number": "5571983372486"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T11:45:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5GM4DQDL Odilardo Galvao (5571986677624)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5GM4DQDL' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571986677624' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Odilardo Galvao', '5571986677624', 'odilardo@farmo.com.br', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T11:15:00-03:00'::timestamptz, '2026-05-17T11:15:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Odilardo Galvao - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5GM4DQDL','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T11:15:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Odilardo Galvao', 'odilardo@farmo.com.br', '5571986677624', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '5GM4DQDL', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5GM4DQDL',
            '{"event": "SALE_APPROVED", "sale_id": "5GM4DQDL", "transaction_id": "5GM4DQDL", "customer": {"name": "Odilardo Galva\u0003o", "email": "odilardo@farmo.com.br", "phone_number": "5571986677624"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T11:15:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 82R9D06M Maria Adrielle de Oliveira da Costa (5571991149307)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:82R9D06M' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571991149307' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Maria Adrielle de Oliveira da Costa', '5571991149307', 'adrielle.eu@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T09:48:00-03:00'::timestamptz, '2026-05-17T09:48:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Maria Adrielle de Oliveira da Costa - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','82R9D06M','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T09:48:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Maria Adrielle de Oliveira da Costa', 'adrielle.eu@gmail.com', '5571991149307', 'Masterclass AI', 47.0, 'BRL', 'apple_pay',
            '82R9D06M', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:82R9D06M',
            '{"event": "SALE_APPROVED", "sale_id": "82R9D06M", "transaction_id": "82R9D06M", "customer": {"name": "Maria Adrielle de Oliveira da Costa", "email": "adrielle.eu@gmail.com", "phone_number": "5571991149307"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "apple_pay", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T09:48:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 51WJZL4P Felipe Santos de Freitas (5571991264863)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:51WJZL4P' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571991264863' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Felipe Santos de Freitas', '5571991264863', 'felipe.dsfreitas@hotmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T09:13:00-03:00'::timestamptz, '2026-05-17T09:13:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Felipe Santos de Freitas - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','51WJZL4P','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T09:13:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Felipe Santos de Freitas', 'felipe.dsfreitas@hotmail.com', '5571991264863', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '51WJZL4P', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:51WJZL4P',
            '{"event": "SALE_APPROVED", "sale_id": "51WJZL4P", "transaction_id": "51WJZL4P", "customer": {"name": "Felipe Santos de Freitas", "email": "felipe.dsfreitas@hotmail.com", "phone_number": "5571991264863"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T09:13:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- XEQ62K36 Marcel Ferreira (5571991092368)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:XEQ62K36' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571991092368' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Marcel Ferreira', '5571991092368', 'marcelnferreira@outlook.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-17T08:58:00-03:00'::timestamptz, '2026-05-17T08:58:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Marcel Ferreira - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','XEQ62K36','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-17T08:58:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Marcel Ferreira', 'marcelnferreira@outlook.com', '5571991092368', 'Masterclass AI', 47.0, 'BRL', 'pix',
            'XEQ62K36', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:XEQ62K36',
            '{"event": "SALE_APPROVED", "sale_id": "XEQ62K36", "transaction_id": "XEQ62K36", "customer": {"name": "Marcel Ferreira", "email": "marcelnferreira@outlook.com", "phone_number": "5571991092368"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": "ig", "medium": "social", "content": "link_in_bio"}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-17T08:58:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 86D4LJ2G Fabio Henrique felix da silva (557599231416)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:86D4LJ2G' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '557599231416' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Fabio Henrique felix da silva', '557599231416', 'contatofabiofelix@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:48:00-03:00'::timestamptz, '2026-05-16T20:48:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Fabio Henrique felix da silva - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','86D4LJ2G','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:48:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Fabio Henrique felix da silva', 'contatofabiofelix@gmail.com', '557599231416', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '86D4LJ2G', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:86D4LJ2G',
            '{"event": "SALE_APPROVED", "sale_id": "86D4LJ2G", "transaction_id": "86D4LJ2G", "customer": {"name": "Fabio Henrique felix da\u0001 silva", "email": "contatofabiofelix@gmail.com", "phone_number": "557599231416"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:48:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5D7NKJ6W Amanda Franco (5571999946384)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5D7NKJ6W' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571999946384' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Amanda Franco', '5571999946384', 'amdfranco1@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:47:00-03:00'::timestamptz, '2026-05-16T20:47:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Amanda Franco - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5D7NKJ6W','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:47:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Amanda Franco', 'amdfranco1@gmail.com', '5571999946384', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '5D7NKJ6W', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5D7NKJ6W',
            '{"event": "SALE_APPROVED", "sale_id": "5D7NKJ6W", "transaction_id": "5D7NKJ6W", "customer": {"name": "Amanda Franco", "email": "amdfranco1@gmail.com", "phone_number": "5571999946384"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:47:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 8426NJRG Priscila Guedes (5571987248786)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8426NJRG' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571987248786' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Priscila Guedes', '5571987248786', 'priscilags2022@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:43:00-03:00'::timestamptz, '2026-05-16T20:43:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Priscila Guedes - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8426NJRG','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:43:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Priscila Guedes', 'priscilags2022@gmail.com', '5571987248786', 'Masterclass AI', 47.0, 'BRL', 'credit_card',
            '8426NJRG', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8426NJRG',
            '{"event": "SALE_APPROVED", "sale_id": "8426NJRG", "transaction_id": "8426NJRG", "customer": {"name": "Priscila Guedes", "email": "priscilags2022@gmail.com", "phone_number": "5571987248786"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "credit_card", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:43:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 86D4LJ04 Ana Gracely de Jesus (5571988759693)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:86D4LJ04' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571988759693' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Ana Gracely de Jesus', '5571988759693', 'anagracely1969@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:43:00-03:00'::timestamptz, '2026-05-16T20:43:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Ana Gracely de Jesus - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','86D4LJ04','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:43:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Ana Gracely de Jesus', 'anagracely1969@gmail.com', '5571988759693', 'Masterclass AI', 47.0, 'BRL', 'credit_card',
            '86D4LJ04', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:86D4LJ04',
            '{"event": "SALE_APPROVED", "sale_id": "86D4LJ04", "transaction_id": "86D4LJ04", "customer": {"name": "Ana Gracely de Jesus", "email": "anagracely1969@gmail.com", "phone_number": "5571988759693"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "credit_card", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:43:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 8426NJ4G Dilson do Amor Divino Moscoso (5571987802131)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8426NJ4G' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571987802131' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Dilson do Amor Divino Moscoso', '5571987802131', 'moscoso.hipnoterapia@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:41:00-03:00'::timestamptz, '2026-05-16T20:41:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Dilson do Amor Divino Moscoso - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8426NJ4G','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:41:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Dilson do Amor Divino Moscoso', 'moscoso.hipnoterapia@gmail.com', '5571987802131', 'Masterclass AI', 47.0, 'BRL', 'credit_card',
            '8426NJ4G', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8426NJ4G',
            '{"event": "SALE_APPROVED", "sale_id": "8426NJ4G", "transaction_id": "8426NJ4G", "customer": {"name": "Dilson do Amor Divino Moscoso", "email": "moscoso.hipnoterapia@gmail.com", "phone_number": "5571987802131"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "credit_card", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:41:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5Q127N1N Cristiane Pires Da Silva (5571981292864)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5Q127N1N' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571981292864' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Cristiane Pires Da Silva', '5571981292864', 'cristiane7703@yahoo.com.br', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:39:00-03:00'::timestamptz, '2026-05-16T20:39:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Cristiane Pires Da Silva - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5Q127N1N','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:39:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Cristiane Pires Da Silva', 'cristiane7703@yahoo.com.br', '5571981292864', 'Masterclass AI', 47.0, 'BRL', 'credit_card',
            '5Q127N1N', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5Q127N1N',
            '{"event": "SALE_APPROVED", "sale_id": "5Q127N1N", "transaction_id": "5Q127N1N", "customer": {"name": "Cristiane Pires Da Silva", "email": "cristiane7703@yahoo.com.br", "phone_number": "5571981292864"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "credit_card", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:39:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 53WN9KPY Rafaela Pereira (5571988150793)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:53WN9KPY' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571988150793' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Rafaela Pereira', '5571988150793', 'wrafaelafrei@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:40:00-03:00'::timestamptz, '2026-05-16T20:40:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Rafaela Pereira - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','53WN9KPY','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:40:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Rafaela Pereira', 'wrafaelafrei@gmail.com', '5571988150793', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '53WN9KPY', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:53WN9KPY',
            '{"event": "SALE_APPROVED", "sale_id": "53WN9KPY", "transaction_id": "53WN9KPY", "customer": {"name": "Rafaela Pereira", "email": "wrafaelafrei@gmail.com", "phone_number": "5571988150793"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:40:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5Z7V2YBM Luciana Brasileiro (5571999656147)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5Z7V2YBM' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571999656147' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Luciana Brasileiro', '5571999656147', 'brasileiroluciana@yahoo.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:38:00-03:00'::timestamptz, '2026-05-16T20:38:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Luciana Brasileiro - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5Z7V2YBM','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:38:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Luciana Brasileiro', 'brasileiroluciana@yahoo.com', '5571999656147', 'Masterclass AI', 47.0, 'BRL', 'credit_card',
            '5Z7V2YBM', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5Z7V2YBM',
            '{"event": "SALE_APPROVED", "sale_id": "5Z7V2YBM", "transaction_id": "5Z7V2YBM", "customer": {"name": "Luciana Brasileiro", "email": "brasileiroluciana@yahoo.com", "phone_number": "5571999656147"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "credit_card", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:38:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5MVMPDBY Victor Hugo maia dos santos (5571992703711)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5MVMPDBY' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571992703711' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Victor Hugo maia dos santos', '5571992703711', 'victormaia86@hotmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:38:00-03:00'::timestamptz, '2026-05-16T20:38:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Victor Hugo maia dos santos - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5MVMPDBY','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:38:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Victor Hugo maia dos santos', 'victormaia86@hotmail.com', '5571992703711', 'Masterclass AI', 47.0, 'BRL', 'apple_pay',
            '5MVMPDBY', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5MVMPDBY',
            '{"event": "SALE_APPROVED", "sale_id": "5MVMPDBY", "transaction_id": "5MVMPDBY", "customer": {"name": "Victor Hugo maia dos santos", "email": "victormaia86@hotmail.com", "phone_number": "5571992703711"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "apple_pay", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:38:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 51WJZNWD Eliene Dultra Goes Santana (5571986072091)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:51WJZNWD' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571986072091' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Eliene Dultra Goes Santana', '5571986072091', 'elienemaquiadora@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:39:00-03:00'::timestamptz, '2026-05-16T20:39:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Eliene Dultra Goes Santana - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','51WJZNWD','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:39:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Eliene Dultra Goes Santana', 'elienemaquiadora@gmail.com', '5571986072091', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '51WJZNWD', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:51WJZNWD',
            '{"event": "SALE_APPROVED", "sale_id": "51WJZNWD", "transaction_id": "51WJZNWD", "customer": {"name": "Eliene Dultra Goes Santana", "email": "elienemaquiadora@gmail.com", "phone_number": "5571986072091"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:39:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5W1LEN1E Rosangela Garcia de Sousa (5571996800225)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5W1LEN1E' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571996800225' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Rosangela Garcia de Sousa', '5571996800225', 'rosagarcia30@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:37:00-03:00'::timestamptz, '2026-05-16T20:37:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Rosangela Garcia de Sousa - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5W1LEN1E','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:37:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Rosangela Garcia de Sousa', 'rosagarcia30@gmail.com', '5571996800225', 'Masterclass AI', 47.0, 'BRL', 'credit_card',
            '5W1LEN1E', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5W1LEN1E',
            '{"event": "SALE_APPROVED", "sale_id": "5W1LEN1E", "transaction_id": "5W1LEN1E", "customer": {"name": "Rosangela Garcia de Sousa", "email": "rosagarcia30@gmail.com", "phone_number": "5571996800225"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "credit_card", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:37:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5NYEV9YN Adilane rebelo (5571999354100)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5NYEV9YN' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571999354100' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Adilane rebelo', '5571999354100', 'adilane2.2@hotmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:37:00-03:00'::timestamptz, '2026-05-16T20:37:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Adilane rebelo - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5NYEV9YN','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:37:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Adilane rebelo', 'adilane2.2@hotmail.com', '5571999354100', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '5NYEV9YN', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5NYEV9YN',
            '{"event": "SALE_APPROVED", "sale_id": "5NYEV9YN", "transaction_id": "5NYEV9YN", "customer": {"name": "Adilane rebelo", "email": "adilane2.2@hotmail.com", "phone_number": "5571999354100"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:37:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 8K4GL04R RICARDO SOUZA (5571992133929)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8K4GL04R' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571992133929' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'RICARDO SOUZA', '5571992133929', 'rantonio.souza@hotmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:37:00-03:00'::timestamptz, '2026-05-16T20:37:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'RICARDO SOUZA - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8K4GL04R','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:37:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('RICARDO SOUZA', 'rantonio.souza@hotmail.com', '5571992133929', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '8K4GL04R', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8K4GL04R',
            '{"event": "SALE_APPROVED", "sale_id": "8K4GL04R", "transaction_id": "8K4GL04R", "customer": {"name": "RICARDO SOUZA", "email": "rantonio.souza@hotmail.com", "phone_number": "5571992133929"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:37:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 5MVMPDVY Carlos Humberto dos reis Junior (5571996392925)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:5MVMPDVY' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571996392925' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Carlos Humberto dos reis Junior', '5571996392925', 'juniorreis63@hotmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:37:00-03:00'::timestamptz, '2026-05-16T20:37:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Carlos Humberto dos reis Junior - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','5MVMPDVY','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:37:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Carlos Humberto dos reis Junior', 'juniorreis63@hotmail.com', '5571996392925', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '5MVMPDVY', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:5MVMPDVY',
            '{"event": "SALE_APPROVED", "sale_id": "5MVMPDVY", "transaction_id": "5MVMPDVY", "customer": {"name": "Carlos Humberto dos reis Ju\u0001nior", "email": "juniorreis63@hotmail.com", "phone_number": "5571996392925"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:37:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- 8YYPK4Y7 Raniton Fernandes de oliveira (5571991045220)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:8YYPK4Y7' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5571991045220' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'Raniton Fernandes de oliveira', '5571991045220', 'raniton@bol.com.br', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:37:00-03:00'::timestamptz, '2026-05-16T20:37:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'Raniton Fernandes de oliveira - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','8YYPK4Y7','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:37:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('Raniton Fernandes de oliveira', 'raniton@bol.com.br', '5571991045220', 'Masterclass AI', 47.0, 'BRL', 'pix',
            '8YYPK4Y7', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:8YYPK4Y7',
            '{"event": "SALE_APPROVED", "sale_id": "8YYPK4Y7", "transaction_id": "8YYPK4Y7", "customer": {"name": "Raniton Fernandes de oliveira", "email": "raniton@bol.com.br", "phone_number": "5571991045220"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:37:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  -- XJN36KNY ALESSANDRO MARQUES GOMES (5575991329733)
  SELECT id INTO v_existing FROM sales_events
    WHERE source = 'kirvano' AND dedupe_key = 'SALE_APPROVED:XJN36KNY' LIMIT 1;
  IF v_existing IS NULL THEN
    SELECT id INTO v_lead_id FROM crm_leads
      WHERE board_id = v_board_id AND whatsapp = '5575991329733' LIMIT 1;
    IF v_lead_id IS NULL THEN
      INSERT INTO crm_leads (board_id, column_id, name, whatsapp, email, source, tags, closed_at, created_at, updated_at)
      VALUES (v_board_id, v_col_comprou, 'ALESSANDRO MARQUES GOMES', '5575991329733', 'alessandromarquesx@gmail.com', 'kirvano',
              ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador'], '2026-05-16T20:38:00-03:00'::timestamptz, '2026-05-16T20:38:00-03:00'::timestamptz, now())
      RETURNING id INTO v_lead_id;
      INSERT INTO crm_activities (lead_id, board_id, activity_type, description, to_column_name, metadata)
      VALUES (v_lead_id, v_board_id, 'lead_created',
              'ALESSANDRO MARQUES GOMES - importado via CSV Kirvano (SALE_APPROVED)', 'Comprou',
              jsonb_build_object('source','backfill_csv','sale_id','XJN36KNY','amount',47.0));
    ELSE
      UPDATE crm_leads SET
        column_id = v_col_comprou,
        tags      = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags,'{}'::text[]) || ARRAY['Masterclass IA','Aluno Masterclass IA','Comprador']))),
        closed_at = COALESCE(closed_at, '2026-05-16T20:38:00-03:00'::timestamptz),
        updated_at = now()
      WHERE id = v_lead_id;
    END IF;
    INSERT INTO sales_events (name, email, whatsapp, product_name, amount, currency, payment_method,
        transaction_id, crm_lead_id, crm_board_id, source, dedupe_key, raw_payload, created_at)
    VALUES ('ALESSANDRO MARQUES GOMES', 'alessandromarquesx@gmail.com', '5575991329733', 'Masterclass AI', 47.0, 'BRL', 'pix',
            'XJN36KNY', v_lead_id, v_board_id, 'kirvano', 'SALE_APPROVED:XJN36KNY',
            '{"event": "SALE_APPROVED", "sale_id": "XJN36KNY", "transaction_id": "XJN36KNY", "customer": {"name": "ALESSANDRO MARQUES GOMES", "email": "alessandromarquesx@gmail.com", "phone_number": "5575991329733"}, "products": [{"name": "Masterclass AI"}], "total_price": "R$ 47,00", "payment_method": "pix", "utm": {"source": null, "medium": null, "content": null}, "_imported_via": "backfill_csv_2026_05_18"}'::jsonb, '2026-05-16T20:38:00-03:00'::timestamptz);
    v_inserted := v_inserted + 1;
  ELSE
    v_skipped := v_skipped + 1;
  END IF;

  RAISE NOTICE 'BACKFILL FINALIZADO: % inseridos, % já existiam', v_inserted, v_skipped;
END $$;
