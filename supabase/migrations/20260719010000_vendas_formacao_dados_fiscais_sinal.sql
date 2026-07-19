-- Vendas das formações: dados fiscais (email, CPF, endereço) e o cenário de SINAL + BOLETO
-- (cliente deu uma entrada e parcelou o restante em boletos). Pedido do Carlos, 19/07/2026.

alter table public.vendas_formacao
  add column if not exists email          text,
  add column if not exists cpf            text,
  add column if not exists endereco       text,
  add column if not exists valor_entrada  numeric(10,2),  -- sinal
  add column if not exists cpf_2          text,           -- 2ª pessoa (casal)
  add column if not exists email_2        text;

-- forma_pagamento agora aceita também 'sinal_boleto' além de 'avista' e '12x'.
-- Nesse caso: valor_total = valor cheio negociado, valor_entrada = sinal,
-- parcelas = nº de boletos do restante, valor_parcela = valor de cada boleto.
