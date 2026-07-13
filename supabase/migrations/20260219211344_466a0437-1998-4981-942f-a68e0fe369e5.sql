
-- Migrate all leads from 'leads' table into the CRM AI FIRST board
-- Board ID: ed9c4f0d-22b1-4256-83a8-725e5959cda9
-- Column mapping based on client onboarding status

-- Insert leads that have a client with status 'completed' -> Concluído
INSERT INTO public.crm_leads (name, whatsapp, instagram, instagram_profile_pic_url, source, source_lead_id, board_id, column_id, tags, created_at)
SELECT 
  l.name, l.whatsapp, l.instagram, l.instagram_profile_pic_url, 
  COALESCE(l.source, 'popup_ddd'),
  l.id,
  'ed9c4f0d-22b1-4256-83a8-725e5959cda9',
  '1f70039e-cba8-4712-a16f-deef63d9451e', -- Concluído
  ARRAY['migrado', 'ai-first'],
  l.created_at
FROM public.leads l
INNER JOIN public.clients c ON c.lead_id = l.id AND c.status = 'completed'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_leads cl 
  WHERE cl.source_lead_id = l.id 
     OR cl.whatsapp = l.whatsapp
);

-- Insert leads that have a client with status 'in_progress' -> Implementando
INSERT INTO public.crm_leads (name, whatsapp, instagram, instagram_profile_pic_url, source, source_lead_id, board_id, column_id, tags, created_at)
SELECT 
  l.name, l.whatsapp, l.instagram, l.instagram_profile_pic_url, 
  COALESCE(l.source, 'popup_ddd'),
  l.id,
  'ed9c4f0d-22b1-4256-83a8-725e5959cda9',
  '6d8c8d64-88a3-43bd-9f21-771d2bd3de3a', -- Implementando
  ARRAY['migrado', 'ai-first'],
  l.created_at
FROM public.leads l
INNER JOIN public.clients c ON c.lead_id = l.id AND c.status = 'in_progress'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_leads cl 
  WHERE cl.source_lead_id = l.id 
     OR cl.whatsapp = l.whatsapp
);

-- Insert leads that have a client with status 'pending' -> Onboarding
INSERT INTO public.crm_leads (name, whatsapp, instagram, instagram_profile_pic_url, source, source_lead_id, board_id, column_id, tags, created_at)
SELECT 
  l.name, l.whatsapp, l.instagram, l.instagram_profile_pic_url, 
  COALESCE(l.source, 'popup_ddd'),
  l.id,
  'ed9c4f0d-22b1-4256-83a8-725e5959cda9',
  '260868c9-4602-44a8-98db-224f9dd35874', -- Onboarding
  ARRAY['migrado', 'ai-first'],
  l.created_at
FROM public.leads l
INNER JOIN public.clients c ON c.lead_id = l.id AND c.status = 'pending'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_leads cl 
  WHERE cl.source_lead_id = l.id 
     OR cl.whatsapp = l.whatsapp
);

-- Insert remaining leads (no client record) -> Captado
INSERT INTO public.crm_leads (name, whatsapp, instagram, instagram_profile_pic_url, source, source_lead_id, board_id, column_id, tags, created_at)
SELECT 
  l.name, l.whatsapp, l.instagram, l.instagram_profile_pic_url, 
  COALESCE(l.source, 'popup_ddd'),
  l.id,
  'ed9c4f0d-22b1-4256-83a8-725e5959cda9',
  '22debf34-9789-4a62-b867-fac80d9f0486', -- Captado
  ARRAY['migrado', 'ai-first'],
  l.created_at
FROM public.leads l
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients c WHERE c.lead_id = l.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.crm_leads cl 
  WHERE cl.source_lead_id = l.id 
     OR cl.whatsapp = l.whatsapp
);

-- Register lead_created activity for all migrated leads
INSERT INTO public.crm_activities (lead_id, activity_type, description, board_id, board_name, created_at)
SELECT 
  cl.id,
  'lead_created',
  'Lead migrado da base de leads para o board AI FIRST',
  'ed9c4f0d-22b1-4256-83a8-725e5959cda9',
  'AI FIRST',
  cl.created_at
FROM public.crm_leads cl
WHERE cl.board_id = 'ed9c4f0d-22b1-4256-83a8-725e5959cda9'
AND cl.tags @> ARRAY['migrado']
AND NOT EXISTS (
  SELECT 1 FROM public.crm_activities ca 
  WHERE ca.lead_id = cl.id AND ca.activity_type = 'lead_created'
);
