-- ============================================================
-- 01_extensions.sql
-- Liga as extensoes que o sistema usa. Rodar no PROJETO NOVO antes do schema.
-- (plpgsql, pg_stat_statements, supabase_vault, pgsodium ja vem ligadas por padrao
--  num projeto Supabase novo, entao nao precisam estar aqui.)
-- ============================================================

create extension if not exists pg_net    with schema extensions;  -- net.http_post (cron chama edges)
create extension if not exists pg_cron;                            -- agendador (cron.schedule)
create extension if not exists pgcrypto  with schema extensions;   -- gen_random_uuid, hashes
create extension if not exists "uuid-ossp" with schema extensions; -- uuid_generate_v4

-- Algumas tarefas antigas usam extensions.http_post (extensao http). Se o cron
-- 'instagram-followup-check' falhar por funcao inexistente, ligue tambem:
-- create extension if not exists http with schema extensions;
