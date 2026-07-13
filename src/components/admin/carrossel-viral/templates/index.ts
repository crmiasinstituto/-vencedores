// Registry central de todos os templates de carrossel
import type { TemplateId, TemplateMeta, SlideTemplateProps } from './types';
import { TemplateNoir } from './TemplateNoir';
import { TemplateTwitter } from './TemplateTwitter';
import { TemplateSquaad } from './TemplateSquaad';
import { TemplateGradient } from './TemplateGradient';
import { TemplateManchete } from './TemplateManchete';
import { TemplateHighlight } from './TemplateHighlight';

export type { TemplateId, TemplateMeta, SlideTemplateProps, CarouselConfig, TemplateTheme } from './types';

type TemplateComponent = (props: SlideTemplateProps) => JSX.Element;

interface TemplateEntry extends TemplateMeta {
  component: TemplateComponent;
}

export const templates: Record<TemplateId, TemplateEntry> = {
  noir: {
    id: 'noir',
    name: 'Noir',
    description: 'Preto puro, tipografia forte, número gigante. Estilo Frank Costa.',
    background: '#000000',
    component: TemplateNoir,
  },
  twitter: {
    id: 'twitter',
    name: 'Tweet (X)',
    description: 'Cada slide vira um tweet com avatar, likes e retweets. Parece print viral.',
    background: '#000000',
    component: TemplateTwitter,
  },
  squaad: {
    id: 'squaad',
    name: '+ que Vencedores',
    description: 'Branding amarelo + que Vencedores. Capa amarela + slides pretos com accent.',
    background: 'linear-gradient(135deg, #facc15 0%, #0a0a0a 100%)',
    component: TemplateSquaad,
  },
  gradient: {
    id: 'gradient',
    name: 'Gradient',
    description: 'Glassmorphism com gradiente vibrante. Cada slide com cor diferente.',
    background: 'linear-gradient(135deg, #667eea 0%, #f5576c 100%)',
    component: TemplateGradient,
  },
  manchete: {
    id: 'manchete',
    name: 'Manchete',
    description: 'Estilo jornal. Vermelho urgente, serif, fundo claro. Vibe noticia.',
    background: 'linear-gradient(180deg, #fafaf9 0%, #fafaf9 60%, #dc2626 100%)',
    component: TemplateManchete,
  },
  highlight: {
    id: 'highlight',
    name: 'Highlight',
    description: 'Texto enorme com palavras-chave em destaque. Glow purple/amber.',
    background: 'radial-gradient(ellipse at top left, #1e1b4b 0%, #0a0a0a 70%)',
    component: TemplateHighlight,
  },
};

export const templateOrder: TemplateId[] = ['noir', 'twitter', 'squaad', 'gradient', 'manchete', 'highlight'];

export function getTemplate(id: TemplateId): TemplateEntry {
  return templates[id] ?? templates.noir;
}
