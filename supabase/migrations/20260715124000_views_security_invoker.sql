-- Fecha um bypass de RLS pelas views.
--
-- No Postgres, uma view roda com os privilégios do DONO (aqui: postgres, superusuário), não
-- de quem consulta — a menos que tenha security_invoker = true (PG15+). As 3 views do schema
-- public foram criadas sem essa opção, então liam as tabelas base como postgres e
-- ATRAVESSAVAM o RLS delas.
--
-- Não era teórico. Provado em 15/07/2026: com um lead de teste em crm_leads (tabela trancada),
-- a chave anon recebeu [] na tabela e a LINHA INTEIRA via crm_leads_engagement.
--
-- Passou despercebido porque o banco está vazio: toda leitura anon devolvia [] e parecia
-- protegida. O [] vinha da tabela vazia, não da policy.
--
-- security_invoker = true faz a view aplicar o RLS de quem está consultando, que é o que se
-- espera. Os consumidores são todos telas de /admin, onde is_admin() é verdadeiro — então o
-- comportamento pro admin não muda.

alter view public.crm_leads_engagement  set (security_invoker = true);
alter view public.calendar_events_all   set (security_invoker = true);
alter view public.member_activity_feed  set (security_invoker = true);
