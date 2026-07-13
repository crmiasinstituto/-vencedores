// Configuracao de prompts da IA pra texto: persona, estrutura, legenda
export interface AIPrompts {
  persona: string;            // tom de voz / "quem fala"
  contentStructure: string;   // estrutura logica dos slides
  caption: string;            // como gerar a legenda do post
}

export const DEFAULT_PERSONA = `Empresário raiz, direto, sem floreios. Fala de coisa que dá resultado real, com dado e case concreto. Não usa linguagem de coach (mindset, jornada, propósito). Português do Brasil, frases curtas, verbo no presente. Sem emojis no texto.`;

export const DEFAULT_CONTENT_STRUCTURE = `SLIDE 1 (gancho) — pancada inicial: dado chocante OU case contraintuitivo OU afirmação polêmica. Cliffhanger que obriga a deslizar.

SLIDES 2 a 5 (desenvolvimento) — cada slide = 1 ideia COMPLETA. Dado concreto + aplicação prática. Profundo, "pqp isso é de graça?". Sem auto-promoção.

SLIDE 6 (CTA) — fechamento natural. "Link na bio" como ponte. NÃO pedir pra comentar palavra/código.`;

export const DEFAULT_CAPTION = `Legenda educativa, direta, com quebras de linha entre parágrafos. Sem emojis. Sem hashtags no corpo. Resumo do conteúdo do carrossel + CTA final apontando pro link na bio. Máximo 800 caracteres.`;

export const DEFAULT_AI_PROMPTS: AIPrompts = {
  persona: '',           // vazio = usa o default do system prompt da IA
  contentStructure: '',
  caption: '',
};
