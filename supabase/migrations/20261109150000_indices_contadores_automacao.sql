-- Os contadores do editor de automação (automation_node_stats) e da lista (automation_stats)
-- procuram mensagens e erros pela automação dentro do campo metadata. Sem índice isso lia a
-- tabela inteira a cada 20s e estourava o tempo limite durante disparos grandes.
create index concurrently if not exists idx_wa_messages_automation_id
  on public.whatsapp_messages ((metadata->>'automation_id'))
  where (metadata->>'automation_id') is not null;
