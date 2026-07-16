-- CORREÇÃO de uma falha da 20260715150000_faixas_categorias_treinadores.sql.
--
-- Aquela migration dropou profiles.plan, e o Postgres deixou: o corpo de uma função plpgsql é
-- só TEXTO, não entra no grafo de dependências. Então três funções continuaram referenciando
-- uma coluna que não existe mais, e uma delas estava presa num trigger de profiles —
-- QUEBRANDO TODO INSERT/UPDATE de perfil, ou seja, o cadastro inteiro:
--
--   ERROR 42703: record "new" has no field "plan"
--   CONTEXT: PL/pgSQL function set_investment_on_plan_change() line 3
--
-- Só apareceu ao inserir um perfil de verdade. Build e typecheck não veem isto.
-- Lição: ao dropar coluna, procurar em pg_proc.prosrc, não confiar no erro de dependência.

-- ---------------------------------------------------------------------------
-- 1. set_investment_on_plan_change — investimento deduzido do plano
--
-- Chutava investment_amount a partir do tier (bronze=500, prata=1500, ouro=3000). Faixa não é
-- preço: é onde a pessoa chegou. O mesmo chute foi removido do front (INVESTMENT_BY_PLAN em
-- useSalesRanking). O valor real vem de profiles.investment_amount, preenchido pela venda.
-- ---------------------------------------------------------------------------
drop trigger if exists set_investment_on_profile_update on public.profiles;
drop function if exists public.set_investment_on_plan_change();

-- ---------------------------------------------------------------------------
-- 2. check_auto_upgrade — subir de plano indicando
--
-- "15 indicações bronze → vira prata; 10 prata → vira ouro". É a mecânica que o modelo de
-- faixa contradiz: faixa vem de FAZER as formações (Reprograme-se, FPO/FPI, Master, Trainer),
-- nunca de indicar gente. Estava dormente (nenhum trigger a chamava), mas dormente e errada
-- é pior que ausente — alguém religa achando que é regra.
-- ---------------------------------------------------------------------------
drop function if exists public.check_auto_upgrade() cascade;

-- ---------------------------------------------------------------------------
-- 3. referral_stats: os contadores por tier não fazem mais sentido
--
-- bronze_referrals/prata_referrals/ouro_referrals contavam indicado por plano comprado. Sem
-- planos, não há o que contar por tier — e a faixa do indicado não diz nada sobre o mérito de
-- quem indicou. Fica o que importa: quantos e quantos pendentes.
-- ---------------------------------------------------------------------------
alter table public.referral_stats drop column if exists bronze_referrals;
alter table public.referral_stats drop column if exists prata_referrals;
alter table public.referral_stats drop column if exists ouro_referrals;

create or replace function public.update_referral_stats_on_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'approved' and old.status = 'pending' then
    -- upsert: o indicador pode não ter linha em referral_stats ainda. Antes era UPDATE puro,
    -- que sumia em silêncio pra quem nunca tinha indicado — justamente a primeira indicação.
    insert into public.referral_stats (profile_id, total_referrals, pending_referrals, updated_at)
    values (new.referrer_id, 1, 0, now())
    on conflict (profile_id) do update
      set total_referrals   = public.referral_stats.total_referrals + 1,
          pending_referrals = greatest(public.referral_stats.pending_referrals - 1, 0),
          updated_at        = now();
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Garante que nenhuma outra função ficou apontando pra coluna morta
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  achou boolean := false;
begin
  for r in
    select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosrc ~ '\mplan\M'
  loop
    raise warning 'FUNÇÃO AINDA CITA "plan": %', r.proname;
    achou := true;
  end loop;
  if not achou then
    raise notice 'Nenhuma função referencia mais a coluna plan.';
  end if;
end $$;
