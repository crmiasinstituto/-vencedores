
-- ================================================================
-- FASE 1: Limpeza de duplicatas e normalização de WhatsApp
-- ================================================================

-- 1. Normalizar WhatsApp em crm_leads (adicionar prefixo 55 onde falta)
UPDATE crm_leads 
SET whatsapp = '55' || whatsapp 
WHERE whatsapp !~ '^55' AND length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) <= 11;

-- 2. Normalizar WhatsApp em sales_events
UPDATE sales_events 
SET whatsapp = '55' || whatsapp 
WHERE whatsapp !~ '^55' AND length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) <= 11;

-- 3. Normalizar WhatsApp em vhs_participants
UPDATE vhs_participants 
SET whatsapp = '55' || whatsapp 
WHERE whatsapp !~ '^55' AND length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) <= 11;

-- ================================================================
-- DEDUPLICAR CRM_LEADS - First reassign FK references to the keeper
-- ================================================================

-- For each duplicate group, reassign call_history, crm_activities, meetings, crm_call_reminders, sales_events
-- to the "keeper" lead (the one we want to keep)

-- Create a temp table mapping duplicates to keepers
CREATE TEMP TABLE lead_dedup_map AS
SELECT id, 
  regexp_replace(whatsapp, '[^0-9]', '', 'g') as clean_phone,
  board_id,
  ROW_NUMBER() OVER (
    PARTITION BY regexp_replace(whatsapp, '[^0-9]', '', 'g'), board_id
    ORDER BY 
      CASE WHEN closed_at IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN source = 'checkout_vhs' THEN 0 ELSE 1 END,
      updated_at DESC
  ) as rn
FROM crm_leads;

-- Get keeper IDs
CREATE TEMP TABLE lead_keepers AS
SELECT clean_phone, board_id, id as keeper_id
FROM lead_dedup_map WHERE rn = 1;

-- Reassign call_history references
UPDATE call_history ch
SET lead_id = k.keeper_id
FROM lead_dedup_map d
JOIN lead_keepers k ON k.clean_phone = d.clean_phone AND k.board_id = d.board_id
WHERE ch.lead_id = d.id AND d.rn > 1;

-- Reassign crm_activities references
UPDATE crm_activities ca
SET lead_id = k.keeper_id
FROM lead_dedup_map d
JOIN lead_keepers k ON k.clean_phone = d.clean_phone AND k.board_id = d.board_id
WHERE ca.lead_id = d.id AND d.rn > 1;

-- Reassign meetings references
UPDATE meetings m
SET lead_id = k.keeper_id
FROM lead_dedup_map d
JOIN lead_keepers k ON k.clean_phone = d.clean_phone AND k.board_id = d.board_id
WHERE m.lead_id = d.id AND d.rn > 1;

-- Reassign crm_call_reminders references
UPDATE crm_call_reminders cr
SET lead_id = k.keeper_id
FROM lead_dedup_map d
JOIN lead_keepers k ON k.clean_phone = d.clean_phone AND k.board_id = d.board_id
WHERE cr.lead_id = d.id AND d.rn > 1;

-- Reassign sales_events references
UPDATE sales_events se
SET crm_lead_id = k.keeper_id
FROM lead_dedup_map d
JOIN lead_keepers k ON k.clean_phone = d.clean_phone AND k.board_id = d.board_id
WHERE se.crm_lead_id = d.id AND d.rn > 1;

-- Now safe to delete duplicates
DELETE FROM crm_leads 
WHERE id IN (SELECT id FROM lead_dedup_map WHERE rn > 1);

DROP TABLE lead_dedup_map;
DROP TABLE lead_keepers;

-- ================================================================
-- DEDUPLICAR SALES_EVENTS (manter o mais recente por whatsapp+product_name)
-- ================================================================

DELETE FROM sales_events 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY regexp_replace(whatsapp, '[^0-9]', '', 'g'), product_name
        ORDER BY created_at DESC
      ) as rn
    FROM sales_events
  ) ranked
  WHERE rn > 1
);

-- ================================================================
-- DEDUPLICAR VHS_PARTICIPANTS (manter o com mais progresso)
-- ================================================================

DELETE FROM vhs_participants 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY regexp_replace(whatsapp, '[^0-9]', '', 'g')
        ORDER BY onboarding_step DESC, created_at DESC
      ) as rn
    FROM vhs_participants
  ) ranked
  WHERE rn > 1
);

-- ================================================================
-- Adicionar RLS policies faltantes para sales_events (DELETE/UPDATE)
-- ================================================================

CREATE POLICY "Allow public delete sales_events"
ON public.sales_events
FOR DELETE
USING (true);

CREATE POLICY "Allow public update sales_events"
ON public.sales_events
FOR UPDATE
USING (true);
