-- Novo modelo de pontuação (decisão do Carlos, 18/07/2026):
--   indicação direta que só se cadastra  = +1 ponto pro padrinho
--   indicação que COMPRA (Eduzz/outra)   = +10 pontos pro padrinho (via referral_conversions.pontos)
--
-- Antes, a indicação aprovada valia 10 (count(*) * 10). Agora vale 1. A compra continua vindo de
-- referral_conversions.pontos, que o webhook grava como 10.

create or replace function public.nw_lifetime_points(p_profile uuid)
returns integer language sql stable security definer set search_path to 'public'
as $$
  select (
    (select coalesce(count(*), 0) * 1 from public.referrals
      where referrer_id = p_profile and status = 'approved')
    + (select coalesce(sum(pontos), 0) from public.referral_conversions where referrer_id = p_profile)
  )::int;
$$;

create or replace function public.nw_season_points(p_profile uuid, p_year integer default (date_part('year', now()))::integer)
returns integer language sql stable security definer set search_path to 'public'
as $$
  select (
    (select coalesce(count(*), 0) * 1 from public.referrals
      where referrer_id = p_profile and status = 'approved'
        and date_part('year', created_at)::int = p_year)
    + (select coalesce(sum(pontos), 0) from public.referral_conversions
        where referrer_id = p_profile and date_part('year', created_at)::int = p_year)
  )::int;
$$;
