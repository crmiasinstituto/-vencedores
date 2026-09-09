-- Contador de uso da regra, sem race entre dois cliques simultâneos.
create or replace function public.wa_incrementa_resposta_automatica(p_regra_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.wa_respostas_automaticas
     set total_enviados = total_enviados + 1
   where id = p_regra_id;
$$;

grant execute on function public.wa_incrementa_resposta_automatica(uuid) to service_role;
