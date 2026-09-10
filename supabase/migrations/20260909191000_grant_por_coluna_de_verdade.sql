-- O REVOKE de coluna anterior não teve efeito: no Postgres, um GRANT na tabela inteira
-- cobre todas as colunas, e não dá para "descontar" uma delas. O certo é revogar o SELECT
-- da tabela e conceder coluna a coluna, deixando a credencial de fora.
--
-- Feito em DO block para não precisar listar as colunas à mão — a lista muda com o tempo
-- e uma coluna nova entraria liberada sem ninguém perceber.

do $$
declare
  cols text;
begin
  -- ── email_config: tudo menos resend_api_key ──────────────────────────────────
  revoke select on public.email_config from authenticated, anon;
  -- anon não tem o que fazer nessa tabela, de leitura a escrita.
  revoke insert, update, delete on public.email_config from anon;

  select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'email_config'
     and column_name <> 'resend_api_key';

  execute format('grant select (%s) on public.email_config to authenticated', cols);

  -- ── whatsapp_instances: tudo menos os tokens ─────────────────────────────────
  revoke select on public.whatsapp_instances from authenticated, anon;

  select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'whatsapp_instances'
     and column_name not in ('instance_token', 'admin_token', 'api_key', 'verification_pin');

  execute format('grant select (%s) on public.whatsapp_instances to authenticated', cols);
end $$;
