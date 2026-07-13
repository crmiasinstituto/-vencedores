-- Add deal tracking and post-sale columns to crm_leads
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS deal_value numeric(12,2);
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS post_sale_stage text;
