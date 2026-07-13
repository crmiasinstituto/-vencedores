

# Plano: Canal Unificado Multi-Instancia com Identificacao de Atendente

## Problema Atual

1. O `InlineChat.tsx` pega a PRIMEIRA instancia conectada (`limit(1)`) para enviar mensagens -- nao permite escolher qual canal usar
2. Mensagens enviadas nao identificam QUAL canal/instancia enviou
3. Nao existe forma de saber se quem respondeu foi o Suporte, Comercial, CS ou Interno
4. Todas as mensagens aparecem iguais, sem contexto de quem atendeu

## Arquitetura Proposta: Chat Unificado com Seletor de Canal

### 1. Seletor de Canal no Chat (InlineChat.tsx)

Adicionar um seletor no header ou na barra de envio do chat que mostra as instancias conectadas como botoes de canal:

```text
┌─────────────────────────────────────────────┐
│  👤 Kleison Melo                            │
│  📱 +55 75 98351-3826                       │
├─────────────────────────────────────────────┤
│                                             │
│  [mensagens do historico]                   │
│  Cada msg outbound mostra badge do canal    │
│                                             │
├─────────────────────────────────────────────┤
│  Enviando como: [Comercial] [Suporte] [CS]  │
│  ┌──────────────────────┐ [📎] [🎤] [➤]    │
│  │ Digite sua mensagem  │                   │
│  └──────────────────────┘                   │
└─────────────────────────────────────────────┘
```

- Cada instancia conectada aparece como botao com cor do canal
- O usuario clica para selecionar de qual canal quer enviar
- O canal selecionado persiste durante a conversa (localStorage)
- Se so tem 1 instancia, seleciona automaticamente sem mostrar seletor

### 2. Identificacao do Canal nas Mensagens

Quando uma mensagem e enviada (outbound), salvar o `instance_id` ja acontece. A melhoria e:

- No webhook receiver (`uazapi-webhook-receiver`): ja salva `instance_id` -- OK
- Na UI de mensagens: exibir um badge colorido ao lado de mensagens outbound mostrando qual canal enviou
- Buscar o `channel` da instancia pelo `instance_id` da mensagem

### 3. Badge de Canal no Bubble de Mensagem

Para cada mensagem outbound no chat, mostrar um mini-badge com o canal:

```text
                        ┌──────────────────────┐
                        │ 🟢 Suporte           │
                        │ Ola Kleison, tudo bem?│
                        │              14:32 ✓✓ │
                        └──────────────────────┘
```

O badge mostra: cor do canal + nome (Comercial/Suporte/CS/Interno).
Isso permite que qualquer pessoa olhando a conversa saiba quem respondeu.

### 4. Envio Multi-Instancia no InlineChat

Mudar a logica de envio:
- Carregar TODAS as instancias conectadas (nao apenas `limit(1)`)
- O `instanceId` usado para enviar e o da instancia selecionada no seletor de canal
- Se nenhuma instancia esta conectada, desabilitar envio
- Ao selecionar canal diferente, as mensagens continuam no mesmo historico (unificado por `remote_phone`/`lead_id`)

### 5. Dados Necessarios

A tabela `whatsapp_messages` ja tem `instance_id`. A tabela `whatsapp_instances` ja tem `channel`. Nao precisa de migration.

Para exibir o badge na UI, carregar um mapa `instanceId -> channel` uma vez e usar nos bubbles.

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/whatsapp/InlineChat.tsx` | Carregar todas instancias conectadas, seletor de canal na barra de envio, badge de canal nos bubbles outbound |
| `src/components/whatsapp/ChatContactList.tsx` | Nenhuma mudanca necessaria (ja agrupa por phone) |
| `src/components/whatsapp/ChatLeadPanel.tsx` | Nenhuma mudanca necessaria |

## Ordem de Execucao

1. Carregar todas instancias conectadas no InlineChat (em vez de `limit(1)`)
2. Criar mapa `instanceId -> { channel, color, label }` 
3. Adicionar seletor de canal na barra de envio (badges clicaveis)
4. Exibir badge do canal em cada mensagem outbound
5. Usar a instancia selecionada para enviar mensagens, audios e arquivos

