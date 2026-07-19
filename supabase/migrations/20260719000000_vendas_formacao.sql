-- Vendas das formações do Instituto (FPI, FPO, FPI+FPO) — ferramenta interna: o time registra
-- a venda (produto, forma de pagamento, valor, nome/telefone do cliente). Só registro + lista.
-- Pedido do Carlos em 19/07/2026.

create table if not exists public.vendas_formacao (
  id                 uuid primary key default gen_random_uuid(),
  produto            text not null,            -- 'fpi_fpo' | 'fpi_fpo_casal' | 'fpi' | 'fpo'
  produto_nome       text not null,            -- rótulo legível, snapshot no momento da venda
  forma_pagamento    text not null,            -- 'avista' | '12x'
  parcelas           int  not null default 1,
  valor_parcela      numeric(10,2),
  valor_total        numeric(10,2) not null,
  cliente_nome       text not null,
  cliente_telefone   text,
  cliente_nome_2     text,                      -- 2ª pessoa (produto casal)
  cliente_telefone_2 text,
  observacao         text,
  vendedor_id        uuid default auth.uid(),   -- quem registrou
  created_at         timestamptz default now()
);

alter table public.vendas_formacao enable row level security;

-- Ferramenta interna: só admin do ecossistema vê e registra.
drop policy if exists vendas_formacao_admin on public.vendas_formacao;
create policy vendas_formacao_admin on public.vendas_formacao
  for all using (public.is_admin()) with check (public.is_admin());
