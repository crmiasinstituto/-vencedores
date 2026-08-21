-- crm_leads acumulou 104 mil varreduras sequenciais sobre 43.650 linhas. Duas colunas quentes
-- estavam sem índice:
--
-- 1) tags — é o que a montagem de audiência de campanha usa (`l.tags && ARRAY[...]` em
--    populate_wa_campaign_leads e get_wa_audience_count). Sem GIN, cada prévia de audiência e
--    cada disparo varria a tabela inteira. GIN é o tipo certo pra operador de sobreposição.
-- 2) email — usado em deduplicação e nos cruzamentos com vendas/membros.
CREATE INDEX IF NOT EXISTS idx_crm_leads_tags_gin ON public.crm_leads USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email_lower ON public.crm_leads (lower(email)) WHERE email IS NOT NULL;
