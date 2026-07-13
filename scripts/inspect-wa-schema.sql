-- ============================================================
-- WA Cloud — Schema inspection (READ ONLY, safe to run)
-- ============================================================
-- Rode no SQL editor do Supabase e me cole o resultado de
-- CADA bloco abaixo. Não altera nada.
-- ============================================================

-- 1) Colunas das tabelas que importam
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN (
     'whatsapp_instances',
     'whatsapp_messages',
     'whatsapp_cloud_templates',
     'whatsapp_template_tags',
     'wa_campaigns',
     'wa_campaign_leads',
     'wa_campaign_instance_stats',
     'crm_leads'
   )
 ORDER BY table_name, ordinal_position;

-- 2) CHECK constraints relevantes (status, provider, category)
SELECT t.relname AS table_name, c.conname AS constraint_name,
       pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
 WHERE n.nspname = 'public'
   AND c.contype = 'c'
   AND t.relname IN ('whatsapp_instances','wa_campaign_leads','wa_campaigns','whatsapp_cloud_templates');

-- 3) Primary keys (pra confirmar se wa_campaign_instance_stats é (instance_id) ou (instance_id, date))
SELECT t.relname AS table_name, i.indisprimary, a.attname AS column_name
  FROM pg_index i
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
 WHERE n.nspname = 'public'
   AND t.relname IN ('wa_campaign_instance_stats','whatsapp_instances','wa_campaign_leads')
   AND i.indisprimary
 ORDER BY t.relname, a.attnum;

-- 4) Functions/RPCs já existentes
SELECT routine_name, routine_type
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND (routine_name LIKE 'wa\_%' ESCAPE '\'
        OR routine_name LIKE '%campaign%'
        OR routine_name = 'set_email_updated_at'
        OR routine_name = 'wa_can_send_now'
        OR routine_name = 'assert_wa_campaign_safe'
        OR routine_name = 'populate_wa_campaign_leads'
        OR routine_name = 'get_wa_audience_count')
 ORDER BY routine_name;

-- 5) Sample row de whatsapp_instances pra ver provider/purpose real
SELECT id, name, instance_name, provider, purpose, status,
       phone_number, phone_number_id, business_account_id,
       (api_key IS NOT NULL) AS has_api_key,
       is_dedicated_blast,
       created_at
  FROM public.whatsapp_instances
 ORDER BY created_at DESC
 LIMIT 5;

-- 6) Tem alguma campanha já? Se sim, qual estrutura
SELECT id, name, status, provider, dedicated_instance_id, instance_ids,
       audience_count, total_leads, sent_count
  FROM public.wa_campaigns
 ORDER BY created_at DESC
 LIMIT 3;

-- 7) RLS policies das tabelas wa_*
SELECT schemaname, tablename, policyname, permissive, roles, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('whatsapp_instances','wa_campaigns','wa_campaign_leads','wa_campaign_instance_stats','whatsapp_cloud_templates')
 ORDER BY tablename, policyname;
