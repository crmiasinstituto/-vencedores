# Templates Cloud API — disc-morning-blast

Quando o número Cloud API estiver conectado e a instância cadastrada no admin
(via `Marketing > Campanhas > Instâncias > Nova Instância > Meta Cloud API`),
crie esses 2 templates. Aprovação Meta leva minutos a 24h.

## Opção 1 — Pela UI do SQUAAD

Vá em `Marketing > WhatsApp > Templates > Novo template` e cole os dados abaixo.

## Opção 2 — Direto via curl (quando tiver instância cadastrada)

```bash
# A wa-create-template lê WABA_ID + token da instância cloud_api ativa no banco
curl -X POST "https://iymlwsawrmghhbawiavz.supabase.co/functions/v1/wa-create-template" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d @template_lead.json
```

---

## Template 1: `disc_blast_lead` (não-compradores)

```json
{
  "name": "disc_blast_lead",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "BODY",
      "text": "Olá, {{1}}! Tudo bem?\n\nFoi muito bom ter você no Reprograme-se 10x ontem. Pelo seu perfil DISC, separei um material que vai te ajudar a aplicar IA no seu negócio de forma mais estratégica.\n\nA Masterclass IA para Negócios acontece em 09 de junho, presencial em Salvador. Posso te enviar o link com mais detalhes?",
      "example": {
        "body_text": [["Carlos"]]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Quero saber mais" },
        { "type": "QUICK_REPLY", "text": "Agora não" }
      ]
    }
  ]
}
```

**Por que esse texto:**
- Sem palavra "grátis", "promoção", "imperdível" (gatilhos de rejeição Meta)
- Pergunta direta, formato conversacional
- Botões `QUICK_REPLY` ajudam a abrir janela de 24h (resposta livre permitida depois)
- Aproveitamento da assinatura DISC pra contextualizar (não jura ter algo "personalizado")

## Template 2: `disc_blast_buyer` (compradores - pedido de indicação)

```json
{
  "name": "disc_blast_buyer",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "BODY",
      "text": "Olá, {{1}}!\n\nObrigado por confirmar sua presença na Masterclass IA para Negócios. Estou animado pra te receber.\n\nUma pergunta rápida: você conhece alguém que também deveria estar lá com você? Se sim, posso te enviar um link pra compartilhar.",
      "example": {
        "body_text": [["Carlos"]]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Sim, conheço" },
        { "type": "QUICK_REPLY", "text": "No momento, não" }
      ]
    }
  ]
}
```

---

## Setar envs pro disc-morning-blast usar Cloud API

Depois de criar os 2 templates e ambos estarem `APPROVED` (sync via botão na UI):

No Supabase dashboard > Project Settings > Edge Functions > Secrets, setar:

```
DISC_BLAST_PROVIDER=cloud_api
DISC_BLAST_TEMPLATE_LEAD=disc_blast_lead
DISC_BLAST_TEMPLATE_BUYER=disc_blast_buyer
DISC_BLAST_TEMPLATE_LANGUAGE=pt_BR
```

E pro webhook (segurança):

```
WHATSAPP_CLOUD_VERIFY_TOKEN=<gera string aleatória, ex: openssl rand -hex 24>
WHATSAPP_CLOUD_APP_SECRET=<App Secret do app Meta em developers.facebook.com>
```

Sem `WHATSAPP_CLOUD_APP_SECRET`, o webhook recusa POSTs em produção (fail-closed).
Pra dev local com ngrok, pode setar `WHATSAPP_CLOUD_WEBHOOK_INSECURE=true` temporariamente.

---

## Webhook URL pra colocar no painel da Meta

```
https://iymlwsawrmghhbawiavz.supabase.co/functions/v1/wa-cloud-webhook
```

Verify token: o mesmo que setou em `WHATSAPP_CLOUD_VERIFY_TOKEN`.

Campos a marcar: **messages**.

⚠️ **Não esquecer o passo 6.4 do guia Meta**: depois de configurar o webhook, fazer
`POST /{WABA_ID}/subscribed_apps` pra inscrever o app na WABA. Sem isso a Meta não envia eventos.
