-- Busca do topo (nome, WhatsApp, e-mail com "contém") lia os 44 mil leads um por um (~5s).
-- Índices trigram deixam o ILIKE '%texto%' instantâneo.
create extension if not exists pg_trgm with schema extensions;
