create index concurrently if not exists idx_crm_leads_email_trgm on public.crm_leads using gin (email extensions.gin_trgm_ops);
