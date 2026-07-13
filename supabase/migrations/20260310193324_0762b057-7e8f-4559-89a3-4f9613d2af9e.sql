INSERT INTO public.sales_playbooks (name, description, is_default, phases) VALUES (
  'Primeira Reunião — Descoberta',
  'Playbook focado em escuta ativa para primeira reunião com lead. Objetivo: entender a dor, coletar dados para proposta e agendar segunda reunião de fechamento.',
  false,
  '[
    {
      "id": "abertura",
      "name": "Abertura & Rapport",
      "order": 1,
      "checklist": [
        "Apresentou-se brevemente",
        "Perguntou como o lead conheceu a SQUAAD",
        "Definiu agenda e expectativa da reunião",
        "Deixou claro que o foco é entender a necessidade"
      ],
      "rules": [
        "Se lead mencionar preço → Responda: Vamos primeiro entender sua operação para propor a melhor solução",
        "Máximo 3 minutos nesta fase"
      ]
    },
    {
      "id": "descoberta",
      "name": "Descoberta da Dor",
      "order": 2,
      "checklist": [
        "Perguntou sobre os maiores desafios atuais",
        "Identificou processos manuais e gargalos",
        "Entendeu o volume de atendimento mensal",
        "Perguntou sobre ferramentas e sistemas atuais",
        "Lead falou mais que você (escuta ativa)"
      ],
      "rules": [
        "Se lead falar mais que você → Ótimo, continue ouvindo e aprofundando",
        "Se resposta superficial → Aprofunde: Me conta mais sobre isso, como funciona hoje?",
        "NUNCA interrompa o lead quando estiver descrevendo um problema"
      ]
    },
    {
      "id": "aprofundamento",
      "name": "Aprofundamento & Impacto",
      "order": 3,
      "checklist": [
        "Quantificou o impacto financeiro da dor",
        "Perguntou sobre a equipe atual",
        "Entendeu a complexidade da operação",
        "Identificou urgência do lead"
      ],
      "rules": [
        "Lead score > 60 → Sugira setup premium e soluções mais completas",
        "Lead score > 80 → Este é um lead de alto valor, conduza para proposta robusta R$50k+",
        "Pergunte: Se pudesse resolver isso amanhã, quanto isso representaria em economia?"
      ]
    },
    {
      "id": "coleta",
      "name": "Coleta de Dados para Proposta",
      "order": 4,
      "checklist": [
        "Coletou número de atendentes",
        "Volume mensal de leads",
        "CRM atual utilizado",
        "Canais utilizados (WhatsApp, Instagram, telefone, etc.)",
        "Integrações necessárias"
      ],
      "rules": [
        "Score 0-30 → Setup sugerido: R$18.000",
        "Score 31-60 → Setup sugerido: R$25.000",
        "Score 61-80 → Setup sugerido: R$35.000",
        "Score 81-100 → Setup sugerido: R$50.000+",
        "Valor sujeito a alteração conforme complexidade de implantação"
      ]
    },
    {
      "id": "proximo_passo",
      "name": "Próximo Passo",
      "order": 5,
      "checklist": [
        "Resumiu as dores identificadas",
        "Confirmou interesse do lead",
        "Agendou segunda reunião de fechamento",
        "Definiu data e horário da próxima reunião"
      ],
      "rules": [
        "Sempre termine com: Na próxima reunião vou trazer uma proposta personalizada com base em tudo que conversamos",
        "Agende a segunda reunião ANTES de encerrar"
      ]
    }
  ]'::jsonb
);