-- O ranking contava pontos por uma fórmula própria: count(TODAS as indicações) * 10.
-- Resultado: quem tinha 3 indicações (2 aprovadas + 1 pendente) aparecia com 30 pontos no
-- ranking e 2 pontos no dashboard — dois números para a mesma coisa, na mesma tela.
--
-- A regra oficial é a de nw_season_points, que é a que a comunidade enxerga e a que o texto
-- da tela promete ("cada indicação vale +1 ponto, e +10 quando ela compra"):
--   indicação APROVADA = 1 ponto  ·  compra do indicado = pontos de referral_conversions
-- Pendente não pontua: senão bastaria cadastrar e-mails para subir no ranking.
CREATE OR REPLACE FUNCTION public.nw_annual_ranking(
  p_limit integer DEFAULT 100,
  p_year integer DEFAULT (date_part('year'::text, now()))::integer
)
RETURNS TABLE(profile_id uuid, owner_name text, company_name text, photo_url text, points integer, rank_position integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH pontos AS (
    SELECT p.id,
           p.owner_name,
           p.company_name,
           p.photo_url,
           (
             (SELECT count(*) FROM public.referrals r
               WHERE r.referrer_id = p.id
                 AND r.status = 'approved'
                 AND date_part('year', r.created_at)::int = p_year)
             +
             COALESCE((SELECT sum(c.pontos) FROM public.referral_conversions c
                        WHERE c.referrer_id = p.id
                          AND date_part('year', c.created_at)::int = p_year), 0)
           )::int AS pts
      FROM public.profiles p
  )
  SELECT id, owner_name, company_name, photo_url, pts,
         rank() OVER (ORDER BY pts DESC)::int
    FROM pontos
   WHERE pts > 0
   ORDER BY pts DESC
   LIMIT p_limit;
$function$;
