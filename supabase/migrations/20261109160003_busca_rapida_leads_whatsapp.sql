create index concurrently if not exists idx_crm_leads_whatsapp_trgm on public.crm_leads using gin (whatsapp extensions.gin_trgm_ops);
