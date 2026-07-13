
-- Add whatsapp_profile_pic_url column to crm_leads
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS whatsapp_profile_pic_url TEXT;

-- Fix leads with wrong name "SQUAAD - Carlos Eduardo"
-- Use inbound senderName or chat_details_name from whatsapp_messages
UPDATE crm_leads SET name = subquery.real_name
FROM (
  SELECT DISTINCT ON (lead_id) lead_id, 
    COALESCE(
      NULLIF(metadata->>'senderName', ''),
      NULLIF(metadata->>'contact_name', ''),
      NULLIF(metadata->>'chat_details_name', '')
    ) as real_name
  FROM whatsapp_messages 
  WHERE direction = 'inbound' 
    AND lead_id IN (SELECT id FROM crm_leads WHERE name ILIKE '%SQUAAD%' OR name ILIKE '%Carlos Eduardo%')
    AND (
      (metadata->>'senderName' IS NOT NULL AND metadata->>'senderName' NOT ILIKE '%SQUAAD%' AND metadata->>'senderName' != '')
      OR (metadata->>'contact_name' IS NOT NULL AND metadata->>'contact_name' NOT ILIKE '%SQUAAD%' AND metadata->>'contact_name' != '')
    )
  ORDER BY lead_id, created_at DESC
) subquery
WHERE crm_leads.id = subquery.lead_id
  AND subquery.real_name IS NOT NULL
  AND subquery.real_name != '';

-- Migrate WhatsApp profile pics from instagram_profile_pic_url to whatsapp_profile_pic_url
UPDATE crm_leads 
SET whatsapp_profile_pic_url = instagram_profile_pic_url,
    instagram_profile_pic_url = NULL
WHERE instagram_profile_pic_url LIKE '%pps.whatsapp.net%';
