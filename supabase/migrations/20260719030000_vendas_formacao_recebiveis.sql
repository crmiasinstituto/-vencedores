-- Controle de recebíveis das vendas de formação: cada venda gera suas parcelas/cheques/boletos,
-- o time marca cada uma como recebida, e a venda ganha status (em aberto / quitada / atrasada).
-- Pedido do Carlos (19/07/2026), pra fechar o "processo de venda real".

create table if not exists public.vendas_formacao_parcelas (
  id         uuid primary key default gen_random_uuid(),
  venda_id   uuid not null references public.vendas_formacao(id) on delete cascade,
  numero     int  not null,
  tipo       text not null,            -- 'entrada' | 'avista' | 'cheque' | 'boleto' | 'parcela'
  valor      numeric(10,2) not null,
  vencimento date,
  pago       boolean not null default false,
  pago_em    date,
  created_at timestamptz default now()
);
alter table public.vendas_formacao_parcelas enable row level security;
drop policy if exists vfp_admin on public.vendas_formacao_parcelas;
create policy vfp_admin on public.vendas_formacao_parcelas for all using (public.is_admin()) with check (public.is_admin());
create index if not exists idx_vfp_venda on public.vendas_formacao_parcelas(venda_id);

-- (Re)gera as parcelas de uma venda a partir da forma de pagamento.
create or replace function public.gerar_parcelas_venda(p_venda uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v record; v_venc date; v_tipo text; i int; n int := 0; v_arr jsonb;
begin
  select * into v from public.vendas_formacao where id = p_venda;
  if not found then return; end if;
  delete from public.vendas_formacao_parcelas where venda_id = p_venda;
  v_arr := case when jsonb_typeof(v.vencimentos)='array' then v.vencimentos else '[]'::jsonb end;

  if coalesce(v.valor_entrada,0) > 0 then
    n := n + 1;
    insert into public.vendas_formacao_parcelas (venda_id, numero, tipo, valor, vencimento)
    values (p_venda, n, 'entrada', v.valor_entrada, v.created_at::date);
  end if;

  if v.forma_pagamento = 'avista' then
    insert into public.vendas_formacao_parcelas (venda_id, numero, tipo, valor, vencimento)
    values (p_venda, n+1, 'avista', v.valor_total, v.created_at::date);
  elsif v.forma_pagamento = 'cheque_predatado' then
    insert into public.vendas_formacao_parcelas (venda_id, numero, tipo, valor, vencimento)
    values (p_venda, n+1, 'cheque', v.valor_total, v.data_pagamento);
  else
    v_tipo := case when v.forma_pagamento='sinal_cheque' then 'cheque'
                   when v.forma_pagamento='sinal_boleto' then 'boleto'
                   else 'parcela' end;
    for i in 1..coalesce(v.parcelas,1) loop
      v_venc := case when jsonb_array_length(v_arr) >= i then (v_arr->>(i-1))::date else null end;
      insert into public.vendas_formacao_parcelas (venda_id, numero, tipo, valor, vencimento)
      values (p_venda, n+i, v_tipo, coalesce(v.valor_parcela, v.valor_total), v_venc);
    end loop;
  end if;
end $$;

-- Gera as parcelas quando a venda é criada. (No edit, as parcelas ficam — pra não apagar
-- os "pago" já marcados; se a condição de pagamento mudar, dá pra recriar pela função acima.)
create or replace function public.trg_gerar_parcelas() returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.gerar_parcelas_venda(NEW.id); return NEW; end $$;

drop trigger if exists trg_vendas_formacao_parcelas on public.vendas_formacao;
create trigger trg_vendas_formacao_parcelas after insert on public.vendas_formacao
  for each row execute function public.trg_gerar_parcelas();
