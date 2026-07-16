/**
 * O conteúdo da landing, separado da marcação.
 *
 * Está aqui porque é o que muda: nome de treinador, número de vidas impactadas, uma área nova.
 * Mexer nisso não deveria exigir abrir JSX.
 */

export const AREAS = [
  {
    id: "espiritualidade",
    titulo: "Espiritualidade",
    itens: [
      "Aproximar-se mais de Deus e viver uma vida com propósito.",
      "Aprender princípios que ajudam a construir uma vida equilibrada.",
    ],
  },
  {
    id: "comunicacao",
    titulo: "Comunicação",
    itens: [
      "Vencer o medo de falar em público.",
      "Gravar vídeos e fazer lives com segurança.",
      "Comunicar-se com confiança.",
    ],
  },
  {
    id: "emocional",
    titulo: "Inteligência Emocional",
    itens: [
      "Superar o perfeccionismo.",
      "Vencer o medo de errar.",
      "Desenvolver coragem para agir.",
      "Diminuir a procrastinação.",
      "Desenvolver mais clareza mental.",
    ],
  },
  {
    id: "relacionamentos",
    titulo: "Relacionamentos",
    itens: [
      "Construir um casamento saudável.",
      "Curar feridas emocionais.",
      "Melhorar a comunicação dentro da família.",
      "Atrair um parceiro que compartilhe dos mesmos valores.",
    ],
  },
  {
    id: "financeira",
    titulo: "Vida Financeira",
    itens: [
      "Administrar melhor seu dinheiro.",
      "Organizar sua vida financeira.",
      "Aumentar sua renda.",
      "Empreender com mais estratégia.",
      "Descobrir novas rendas com internet, redes sociais e Inteligência Artificial.",
    ],
  },
  {
    id: "produtividade",
    titulo: "Produtividade",
    itens: [
      "Criar disciplina.",
      "Desenvolver constância.",
      "Produzir mais em menos tempo.",
      "Equilibrar Deus, família, saúde e trabalho.",
    ],
  },
  {
    id: "pessoal",
    titulo: "Desenvolvimento Pessoal",
    itens: [
      "Desenvolver uma mentalidade vencedora.",
      "Conhecer princípios utilizados por pessoas de alta performance.",
      "Construir uma vida mais leve, equilibrada e com significado.",
    ],
  },
];

export const NUMEROS = [
  { valor: "2019", texto: "o ano em que o IAS Instituto começou a formar gente que assumiu o protagonismo da própria história" },
  { valor: "5", texto: "frentes: cursos, treinamentos, mentorias, formações e eventos presenciais" },
  { valor: "100s", texto: "de horas de conteúdo produzido" },
  { valor: "1", texto: "comunidade comprometida com crescimento e transformação" },
];

export const PERKS = [
  {
    titulo: "Campanhas de indicação",
    texto: "Indique pessoas e concorra a prêmios e a acesso gratuito aos eventos presenciais do IAS Instituto.",
    nota: "Consulte o regulamento.",
  },
  {
    titulo: "Treinadores e especialistas",
    texto: "Gente disponível para orientar seu crescimento — não só conteúdo gravado.",
  },
  {
    titulo: "Uma comunidade de verdade",
    texto: "Pessoas que desejam evoluir juntas, e não uma plateia assistindo.",
  },
  {
    titulo: "Conteúdo novo, sempre",
    texto: "Novos materiais sendo disponibilizados continuamente.",
  },
];

export const NAO_E_PARA_QUEM = [
  "Procura fórmulas mágicas.",
  "Não quer assumir responsabilidade pelos próprios resultados.",
  "Acredita que conhecimento, sozinho, resolve tudo sem colocar nada em prática.",
  "Não deseja crescer.",
  "É mal-intencionado ou desrespeita outras pessoas.",
];

/**
 * Treinadores do IAS Instituto, nível abaixo do Isaac.
 *
 * Grafia conferida com o Carlos em 15/07/2026: é Alexandre Solto Maior (não "Alexandra"), e a
 * Soraya entra na lista. São pessoas reais — não invente nome nem foto aqui.
 */
export const TREINADORES = [
  "Ludmila Badaró",
  "Soraya Storino",
  "Alexandre Solto Maior",
  "Claudia Uchoa",
];
