-- "Não contatar" também cala a IA: ninguém (nem o agente) responde esse lead sozinho.
-- Pausa por 10 anos via chatbot_paused_until (o que o agente e o receptor do WhatsApp
-- conferem) e nas conversas do agente v2. Ao liberar, só desfaz a pausa que veio daqui.
create or replace function public.crm_leads_sync_nao_contatar()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not new.nao_contatar then return new; end if;
  elsif new.nao_contatar is not distinct from old.nao_contatar then
    return new;
  end if;

  if new.nao_contatar then
    new.nao_contatar_em := coalesce(new.nao_contatar_em, now());
    new.email_opted_out := true;
    new.email_opted_out_at := coalesce(new.email_opted_out_at, now());
    if not ('whatsapp_optout' = any(coalesce(new.tags, '{}'))) then
      new.tags := array_append(coalesce(new.tags, '{}'), 'whatsapp_optout');
    end if;
    if new.chatbot_paused_until is null or new.chatbot_paused_until < now() + interval '9 years' then
      new.chatbot_paused_until := now() + interval '10 years';
    end if;
    if tg_op = 'UPDATE' then
      update ai_agent_conversations
         set status = 'paused', paused_by = 'nao_contatar', paused_at = now(),
             pause_reason = 'Lead marcado como Não contatar', pause_until = now() + interval '10 years',
             updated_at = now()
       where lead_id = new.id;
    end if;
  else
    new.nao_contatar_em := null;
    new.nao_contatar_motivo := null;
    new.nao_contatar_origem := null;
    new.email_opted_out := false;
    new.email_opted_out_at := null;
    new.tags := array_remove(coalesce(new.tags, '{}'), 'whatsapp_optout');
    if new.chatbot_paused_until > now() + interval '9 years' then
      new.chatbot_paused_until := null;
    end if;
    update ai_agent_conversations
       set status = 'active', paused_by = null, paused_at = null, pause_reason = null, pause_until = null, updated_at = now()
     where lead_id = new.id and paused_by = 'nao_contatar';
  end if;
  return new;
end $$;

-- Quem já está bloqueado.
update crm_leads set chatbot_paused_until = now() + interval '10 years'
 where nao_contatar and (chatbot_paused_until is null or chatbot_paused_until < now() + interval '9 years');
