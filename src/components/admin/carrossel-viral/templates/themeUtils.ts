// Resolve overrides do tema com defaults por template
import { fontFamilies } from './types';
import type { TemplateTheme } from './types';

export interface ResolvedTheme {
  accent: string;
  textColor: string;
  bg: string;
  scale: number;
  weight: number;
  family: string;
}

interface TemplateDefaults {
  accent: string;
  textColor: string;
  bg: string;
  scale?: number;
  weight?: number;
  family?: keyof typeof fontFamilies;
}

const weightMap: Record<NonNullable<TemplateTheme['fontWeight']>, number> = {
  normal: 400,
  bold: 700,
  black: 900,
};

export function resolveTheme(theme: TemplateTheme | undefined, defaults: TemplateDefaults): ResolvedTheme {
  return {
    accent: theme?.accentColor ?? defaults.accent,
    textColor: theme?.textColor ?? defaults.textColor,
    bg: theme?.bgColor ?? defaults.bg,
    scale: theme?.textScale ?? defaults.scale ?? 1,
    weight: theme?.fontWeight ? weightMap[theme.fontWeight] : (defaults.weight ?? 900),
    family: fontFamilies[theme?.fontFamily ?? defaults.family ?? 'sans'],
  };
}
