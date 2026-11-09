create index concurrently if not exists idx_crm_leads_name_trgm on public.crm_leads using gin (name extensions.gin_trgm_ops);
