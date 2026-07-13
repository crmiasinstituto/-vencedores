// Hook compartilhado: template + identidade + tema + estilo visual das imagens.
// Tudo persistido no localStorage.
import { useEffect, useState } from 'react';
import type { CarouselConfig, TemplateId, TemplateTheme } from './templates';
import { DEFAULT_VISUAL_STYLE, type VisualStyle } from './visualStyleDefaults';
import { DEFAULT_PINNED_SLIDE, type PinnedSlide } from './PinnedSlidePanel';
import { DEFAULT_AI_PROMPTS, type AIPrompts } from './aiPromptsDefaults';

const TEMPLATE_KEY = 'viral_carousel_template_v1';
const CONFIG_KEY = 'viral_carousel_config_v1';
const THEME_KEY = 'viral_carousel_theme_v1';
const VISUAL_STYLE_KEY = 'viral_carousel_visual_style_v1';
const PINNED_KEY = 'viral_carousel_pinned_v1';
const AI_PROMPTS_KEY = 'viral_carousel_ai_prompts_v1';

function readTemplate(): TemplateId {
  if (typeof window === 'undefined') return 'noir';
  try {
    const v = window.localStorage.getItem(TEMPLATE_KEY);
    return (v as TemplateId) || 'noir';
  } catch {
    return 'noir';
  }
}

function readConfig(): CarouselConfig {
  if (typeof window === 'undefined') return {};
  try {
    const v = window.localStorage.getItem(CONFIG_KEY);
    return v ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

function readTheme(): TemplateTheme {
  if (typeof window === 'undefined') return {};
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

function readVisualStyle(): VisualStyle {
  if (typeof window === 'undefined') return DEFAULT_VISUAL_STYLE;
  try {
    const v = window.localStorage.getItem(VISUAL_STYLE_KEY);
    return v ? { ...DEFAULT_VISUAL_STYLE, ...JSON.parse(v) } : DEFAULT_VISUAL_STYLE;
  } catch {
    return DEFAULT_VISUAL_STYLE;
  }
}

function readPinnedSlide(): PinnedSlide {
  if (typeof window === 'undefined') return DEFAULT_PINNED_SLIDE;
  try {
    const v = window.localStorage.getItem(PINNED_KEY);
    return v ? { ...DEFAULT_PINNED_SLIDE, ...JSON.parse(v) } : DEFAULT_PINNED_SLIDE;
  } catch {
    return DEFAULT_PINNED_SLIDE;
  }
}

function readAIPrompts(): AIPrompts {
  if (typeof window === 'undefined') return DEFAULT_AI_PROMPTS;
  try {
    const v = window.localStorage.getItem(AI_PROMPTS_KEY);
    return v ? { ...DEFAULT_AI_PROMPTS, ...JSON.parse(v) } : DEFAULT_AI_PROMPTS;
  } catch {
    return DEFAULT_AI_PROMPTS;
  }
}

export function useCarouselSettings() {
  const [templateId, setTemplateId] = useState<TemplateId>(readTemplate);
  const [config, setConfig] = useState<CarouselConfig>(readConfig);
  const [theme, setTheme] = useState<TemplateTheme>(readTheme);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(readVisualStyle);
  const [pinnedSlide, setPinnedSlide] = useState<PinnedSlide>(readPinnedSlide);
  const [aiPrompts, setAIPrompts] = useState<AIPrompts>(readAIPrompts);

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATE_KEY, templateId);
    } catch { /* ignore */ }
  }, [templateId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch { /* ignore */ }
  }, [config]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VISUAL_STYLE_KEY, JSON.stringify(visualStyle));
    } catch { /* ignore */ }
  }, [visualStyle]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedSlide));
    } catch { /* ignore */ }
  }, [pinnedSlide]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_PROMPTS_KEY, JSON.stringify(aiPrompts));
    } catch { /* ignore */ }
  }, [aiPrompts]);

  return {
    templateId, setTemplateId,
    config, setConfig,
    theme, setTheme,
    visualStyle, setVisualStyle,
    pinnedSlide, setPinnedSlide,
    aiPrompts, setAIPrompts,
  };
}

export type { VisualStyle } from './visualStyleDefaults';
export { DEFAULT_VISUAL_PROMPT } from './visualStyleDefaults';
export type { PinnedSlide } from './PinnedSlidePanel';
export type { AIPrompts } from './aiPromptsDefaults';
