// Tipos compartilhados pelos templates de carrossel
// Cada template recebe um SlideTemplateProps e renderiza um <div> 1080x1350

export interface CarouselConfig {
  authorName?: string;
  handle?: string;
  avatarUrl?: string;
  logoUrl?: string;
  topic?: string;
}

/**
 * Customizacao visual aplicada por cima do template.
 * Cada campo eh opcional: o template usa o default dele se ausente.
 */
export interface TemplateTheme {
  accentColor?: string;     // cor de destaque (default por template)
  textColor?: string;        // cor do texto principal
  bgColor?: string;          // cor de fundo (sobrescreve quando nao ha imageUrl)
  textScale?: number;        // multiplicador de fontSize (0.85, 1, 1.15, 1.3)
  fontWeight?: 'normal' | 'bold' | 'black'; // peso do titulo principal
  fontFamily?: 'sans' | 'serif' | 'mono';   // famalia de fonte
}

export const fontFamilies: Record<NonNullable<TemplateTheme['fontFamily']>, string> = {
  sans: '"Inter", system-ui, -apple-system, sans-serif',
  serif: '"Georgia", "Times New Roman", serif',
  mono: '"JetBrains Mono", "SF Mono", monospace',
};

export interface SlideTemplateProps {
  titulo: string;
  texto: string;
  slideIndex: number; // 0-based
  totalSlides: number;
  config: CarouselConfig;
  imageUrl?: string; // imagem de fundo gerada por IA (opcional)
  theme?: TemplateTheme;
}

export type TemplateId = 'noir' | 'twitter' | 'squaad' | 'gradient' | 'manchete' | 'highlight';

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  background: string; // gradient pra preview
}
