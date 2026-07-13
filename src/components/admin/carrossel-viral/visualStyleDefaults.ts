// Configuracao de estilo visual aplicada a TODAS as imagens IA do carrossel
export interface VisualStyle {
  useAI: boolean;            // gerar com IA vs usar imagem placeholder/Google Images
  prompt: string;             // prompt do "diretor de arte" - estilo aplicado em todo slide
  referenceUrl?: string;      // foto de referencia (multimodal Gemini)
  accentColor?: string;       // cor de destaque a ser inserida nas imagens
}

export const DEFAULT_VISUAL_PROMPT = `Analise o texto e identifique o elemento visual mais impactante para chamar atenção.

Gere uma foto realista desse elemento. Impactante, provocativa, estilo clickbait visual.

Lembre-se de não cortar cabeça, mantenha sempre visível dentro do contexto.

Iluminação natural, como se fosse tirada de um iPhone sem edição (não precisa mostrar mockup).

Sem texto na imagem.

Se houver pessoa de referência, ela aparece sutilmente na cena como coadjuvante. A cena é o protagonista.

Insira pequenos e poucos detalhes na imagem na cor de destaque informada.`;

export const DEFAULT_VISUAL_STYLE: VisualStyle = {
  useAI: true,
  prompt: DEFAULT_VISUAL_PROMPT,
  accentColor: '#3B82F6',
};
