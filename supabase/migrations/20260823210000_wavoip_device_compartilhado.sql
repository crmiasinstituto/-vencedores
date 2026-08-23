-- WaVoIP: linha compartilhada com a equipe.
--
-- Ate aqui `wavoip_devices` era 1:1 com `user_id` e o CRM so habilitava o botao
-- de ligar pro DONO da linha (CallContext.loadDevice filtrava por user_id). Como
-- o token e cadastrado por quem estiver logado na hora, o numero comercial
-- ficava preso na conta de uma pessoa so — todo mundo mais via o botao cinza
-- "Configure o WaVoIP nas configuracoes" mesmo com o numero pareado e online.
--
-- Com `is_shared`, quem nao tem linha propria cai automaticamente na linha da
-- equipe. Atencao: o device WaVoIP tem num_channels = 1, entao e' uma ligacao
-- por vez — o CRM checa /whatsapp/all_info antes de discar e avisa "linha
-- ocupada" em vez de deixar a chamada travar em "Chamando".
alter table public.wavoip_devices
  add column if not exists is_shared boolean not null default false;

comment on column public.wavoip_devices.is_shared is
  'Linha compartilhada: qualquer colaborador sem device proprio usa esta pra ligar.';

-- Indice parcial: o lookup de fallback do CallContext e' sempre
-- (is_shared and is_active).
create index if not exists wavoip_devices_shared_idx
  on public.wavoip_devices (updated_at desc)
  where is_shared and is_active;
