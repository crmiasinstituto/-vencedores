# Teste de áudio da ligação (WaVoIP)

Responde, sem depender de alguém relatar "não escutei": **a ligação completa?**,
**o áudio do CRM chega no telefone?**, **o áudio do telefone chega no CRM?**

```bash
node scripts/wavoip-audio-test/run.mjs --probe            # só confere se o device está "open"
node scripts/wavoip-audio-test/run.mjs 5575983080330 25   # liga de verdade e mede 25s
```

O "microfone" do navegador é o `tom-teste.wav` (3 bipes agudos em loop): quem
atende sabe na hora se o áudio do CRM está chegando. O que vem do telefone é
gravado em `recebido-do-telefone.webm` — dá pra ouvir depois.

Saída (`resultado.json`): nível por segundo dos dois sentidos, bytes tx/rx, rtt,
perda, e um veredito com `seuAudioSaiu` / `chegouAudioDoTelefone`.

**Atenção: isso toca o telefone de verdade.** Use um número seu ou combinado.

Token: sai de `wavoip_devices` usando `SUPABASE_ACCESS_TOKEN` do `.env.local`,
ou passe `WAVOIP_TOKEN=...` no ambiente.
