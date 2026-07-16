-- Resgate das funcoes nw_* que existiam APENAS no banco de producao.
-- Levantado em 15/07/2026 direto do pg_proc de iymlwsawrmghhbawiavz: estas 4 funcoes
-- sustentam pontos, tier de recompensa e ranking anual do netweaving, e nao tinham
-- nenhum arquivo de migration em nenhum dos dois repositorios. Sem isso, um reset do
-- banco zera pontos e ranking sem erro nenhum aparecer.
-- Definicoes copiadas verbatim de pg_get_functiondef().

-- ======================================================================
-- nw_annual_ranking
-- ======================================================================
CREATE OR REPLACE FUNCTION public.nw_annual_ranking(p_limit integer DEFAULT 100, p_year integer DEFAULT (date_part('year'::text, now()))::integer)
 RETURNS TABLE(profile_id uuid, owner_name text, company_name text, photo_url text, points integer, rank_position integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.owner_name, p.company_name, p.photo_url, (count(r.id)*10)::int,
         rank() OVER (ORDER BY count(r.id) DESC)::int
  FROM public.profiles p
  LEFT JOIN public.referrals r ON r.referrer_id=p.id AND date_part('year',r.created_at)::int=p_year
  GROUP BY p.id HAVING count(r.id)>0 ORDER BY count(r.id) DESC LIMIT p_limit; $function$
;

-- ======================================================================
-- nw_lifetime_points
-- ======================================================================
CREATE OR REPLACE FUNCTION public.nw_lifetime_points(p_profile uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (COALESCE(count(*),0)*10)::int FROM public.referrals WHERE referrer_id=p_profile; $function$
;

-- ======================================================================
-- nw_reward_tier
-- ======================================================================
CREATE OR REPLACE FUNCTION public.nw_reward_tier(p_points integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE WHEN p_points>=500 THEN 'Renovacao gratis + 10 ingressos RPX10X Diamond'
              WHEN p_points>=200 THEN 'Renovacao gratis + 2 ingressos RPX10X Diamond'
              WHEN p_points>=100 THEN 'Renovacao gratis'
              ELSE 'Plano Semente' END; $function$
;

-- ======================================================================
-- nw_season_points
-- ======================================================================
CREATE OR REPLACE FUNCTION public.nw_season_points(p_profile uuid, p_year integer DEFAULT (date_part('year'::text, now()))::integer)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT (COALESCE(count(*),0)*10)::int FROM public.referrals
  WHERE referrer_id=p_profile AND date_part('year',created_at)::int=p_year; $function$
;
