/**
 * AIQuickEditPanel
 *
 * Quando o template é gerado pela IA, o HTML é cru (tabelas customizadas) e o Maily
 * não consegue editar sem destruir o layout. Este painel parseia o HTML, extrai os
 * pontos editáveis (headline, parágrafos, CTA, cor do header) e expõe um form simples
 * com live preview. Cada mudança regenera o HTML.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, RotateCcw, Plus, Trash2, Palette, Type, MousePointerClick, Heading1, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtractedFields {
  headerColor: 'black' | 'gray' | 'yellow' | 'custom';
  headerBgRaw: string;
  headline: string;
  paragraphs: string[];
  ctaText: string;
  ctaUrl: string;
  ctaBgColor: string;
  ctaTextColor: string;
  signatureText: string;
}

const HEADER_PRESETS: Record<'black' | 'gray' | 'yellow', { bg: string; logoUrl: string; label: string }> = {
  black: {
    bg: '#000000',
    logoUrl: 'https://iymlwsawrmghhbawiavz.supabase.co/storage/v1/object/public/email-assets/brand/squaad-logo-001.jpg',
    label: 'Preto',
  },
  gray: {
    bg: '#e8e8e8',
    logoUrl: 'https://iymlwsawrmghhbawiavz.supabase.co/storage/v1/object/public/email-assets/brand/squaad-logo-002.jpg',
    label: 'Cinza',
  },
  yellow: {
    bg: '#3B82F6',
    logoUrl: 'https://iymlwsawrmghhbawiavz.supabase.co/storage/v1/object/public/email-assets/brand/squaad-logo-003.jpg',
    label: 'Amarelo',
  },
};

function detectHeaderColor(bg: string): ExtractedFields['headerColor'] {
  const lower = bg.toLowerCase().replace(/\s+/g, '');
  if (lower === '#000' || lower === '#000000' || lower === 'black' || lower === 'rgb(0,0,0)') return 'black';
  if (lower === '#3B82F6' || lower === '#fbc800' || lower === 'rgb(250,200,0)') return 'yellow';
  if (lower === '#e8e8e8' || lower === '#eee' || lower === '#f5f5f5' || lower === '#e0e0e0') return 'gray';
  return 'custom';
}

function extractFields(html: string): ExtractedFields {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Header bg color: primeira <td> com background ou background-color no style do header
  let headerBg = '#000000';
  const firstTd = doc.querySelector('table tr:first-child td');
  if (firstTd) {
    const style = firstTd.getAttribute('style') || '';
    const m = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
    if (m) headerBg = m[1].trim();
  }

  // Headline: primeiro h1
  const h1 = doc.querySelector('h1');
  const headline = h1?.textContent?.trim() || '';

  // Parágrafos: todos os <p> que não estão dentro de assinatura visível
  const allParagraphs = Array.from(doc.querySelectorAll('p'))
    .map((p) => p.textContent?.trim() || '')
    .filter((t) => t.length > 0);
  // Remove parágrafos muito curtos (footer/assinatura) ou que parecem assinatura
  const paragraphs = allParagraphs.filter((t) => t.length > 20 && !/^[\w\s]{0,40}\.$/i.test(t.slice(-3)));
  const signatureLines = allParagraphs.filter((t) => t.length <= 60);
  const signatureText = signatureLines[signatureLines.length - 1] || '';

  // CTA: primeiro <a> dentro de <table> com bg colorida (não link inline em texto)
  let ctaText = '';
  let ctaUrl = '';
  let ctaBgColor = '#3B82F6';
  let ctaTextColor = '#000000';
  const ctaCandidates = doc.querySelectorAll('table a[href]');
  for (const a of Array.from(ctaCandidates)) {
    const parent = a.closest('td');
    const style = parent?.getAttribute('style') || '';
    if (/border-radius/.test(style) || /background/.test(style)) {
      ctaText = a.textContent?.trim() || '';
      ctaUrl = a.getAttribute('href') || '';
      const bgM = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
      if (bgM) ctaBgColor = bgM[1].trim();
      const aStyle = a.getAttribute('style') || '';
      const colorM = aStyle.match(/color\s*:\s*([^;]+)/i);
      if (colorM) ctaTextColor = colorM[1].trim();
      break;
    }
  }

  return {
    headerColor: detectHeaderColor(headerBg),
    headerBgRaw: headerBg,
    headline,
    paragraphs: paragraphs.length > 0 ? paragraphs : allParagraphs.slice(0, 4),
    ctaText,
    ctaUrl,
    ctaBgColor,
    ctaTextColor,
    signatureText,
  };
}

function applyFields(originalHtml: string, fields: ExtractedFields): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalHtml, 'text/html');

  // 1) Header color + logo
  const firstTd = doc.querySelector('table tr:first-child td');
  if (firstTd) {
    const preset = fields.headerColor !== 'custom' ? HEADER_PRESETS[fields.headerColor] : null;
    const targetBg = preset ? preset.bg : fields.headerBgRaw;
    const targetLogo = preset ? preset.logoUrl : null;

    const oldStyle = firstTd.getAttribute('style') || '';
    const newStyle = oldStyle.match(/background(?:-color)?:/i)
      ? oldStyle.replace(/background(?:-color)?\s*:\s*[^;]+/i, `background:${targetBg}`)
      : `${oldStyle};background:${targetBg};`.replace(/^;/, '');
    firstTd.setAttribute('style', newStyle);

    if (targetLogo) {
      const img = firstTd.querySelector('img');
      if (img) img.setAttribute('src', targetLogo);
    }
  }

  // 2) Headline
  const h1 = doc.querySelector('h1');
  if (h1) h1.textContent = fields.headline;

  // 3) Parágrafos: re-popula <p> editáveis identificados (mesmos índices)
  const allParagraphs = Array.from(doc.querySelectorAll('p'));
  // Re-aplica nos mesmos elementos que tinham texto > 20 chars
  const editableP = allParagraphs.filter((p) => (p.textContent?.trim() || '').length > 20);
  fields.paragraphs.forEach((newText, i) => {
    if (editableP[i]) editableP[i].textContent = newText;
  });
  // Adicionar parágrafos novos (se user adicionou mais que o original)
  if (fields.paragraphs.length > editableP.length && editableP.length > 0) {
    const lastP = editableP[editableP.length - 1];
    for (let i = editableP.length; i < fields.paragraphs.length; i++) {
      const newP = lastP.cloneNode(true) as HTMLElement;
      newP.textContent = fields.paragraphs[i];
      lastP.parentNode?.insertBefore(newP, lastP.nextSibling);
    }
  }
  // Remover parágrafos extras (se user reduziu)
  for (let i = fields.paragraphs.length; i < editableP.length; i++) {
    editableP[i].remove();
  }

  // 4) CTA
  const ctaCandidates = doc.querySelectorAll('table a[href]');
  for (const a of Array.from(ctaCandidates)) {
    const parent = a.closest('td');
    const style = parent?.getAttribute('style') || '';
    if (/border-radius/.test(style) || /background/.test(style)) {
      a.textContent = fields.ctaText;
      a.setAttribute('href', fields.ctaUrl);
      if (parent) {
        const newParentStyle = style.replace(/background(?:-color)?\s*:\s*[^;]+/i, `background:${fields.ctaBgColor}`);
        parent.setAttribute('style', newParentStyle);
      }
      const aStyle = a.getAttribute('style') || '';
      const newAStyle = aStyle.match(/color\s*:/i)
        ? aStyle.replace(/color\s*:\s*[^;]+/i, `color:${fields.ctaTextColor}`)
        : `color:${fields.ctaTextColor};${aStyle}`;
      a.setAttribute('style', newAStyle);
      break;
    }
  }

  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

interface Props {
  initialHtml: string;
  onHtmlChange: (newHtml: string) => void;
  onDiscard: () => void;
}

export default function AIQuickEditPanel({ initialHtml, onHtmlChange, onDiscard }: Props) {
  // Ref imutável ao HTML original — extractFields e applyFields sempre operam sobre ele
  // (não sobre o HTML que mudou via onHtmlChange, que causaria loop de duplicação).
  const originalHtmlRef = useRef<string>(initialHtml);
  const initialFields = useMemo(() => extractFields(originalHtmlRef.current), []);
  const [fields, setFields] = useState<ExtractedFields>(initialFields);
  const debounceRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  // Live preview: a cada mudança nos fields, regenera HTML sobre o original e notifica parent
  useEffect(() => {
    // Pula primeira renderização (initialHtml já está no preview do parent)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const newHtml = applyFields(originalHtmlRef.current, fields);
      onHtmlChange(newHtml);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fields]);

  const update = <K extends keyof ExtractedFields>(key: K, value: ExtractedFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const updateParagraph = (i: number, text: string) => {
    const newP = [...fields.paragraphs];
    newP[i] = text;
    update('paragraphs', newP);
  };

  const addParagraph = () => {
    update('paragraphs', [...fields.paragraphs, 'Novo parágrafo. Escreva aqui o conteúdo.']);
  };

  const removeParagraph = (i: number) => {
    update('paragraphs', fields.paragraphs.filter((_, idx) => idx !== i));
  };

  const resetToOriginal = () => {
    setFields(initialFields);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#BAA05E]/30 bg-gradient-to-br from-[#BAA05E]/[0.06] to-transparent p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-[#BAA05E] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground mb-0.5">Edição rápida do template IA</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Ajuste os campos abaixo. O preview à direita atualiza em tempo real.
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-2.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={resetToOriginal}>
            <RotateCcw className="h-3 w-3" /> Resetar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive" onClick={onDiscard}>
            <X className="h-3 w-3" /> Descartar IA
          </Button>
        </div>
      </div>

      {/* HEADER COLOR */}
      <section className="space-y-2">
        <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
          <Palette className="h-3 w-3" /> Cor do header
        </Label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['black', 'gray', 'yellow'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update('headerColor', c)}
              className={cn(
                'rounded-md border-2 p-2 text-xs font-medium transition-all',
                fields.headerColor === c
                  ? 'border-[#BAA05E] ring-2 ring-[#BAA05E]/30'
                  : 'border-border hover:border-foreground/30',
              )}
            >
              <div
                className="h-6 rounded mb-1.5 border border-black/10"
                style={{ background: HEADER_PRESETS[c].bg }}
              />
              {HEADER_PRESETS[c].label}
            </button>
          ))}
        </div>
      </section>

      {/* HEADLINE */}
      <section className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
          <Heading1 className="h-3 w-3" /> Título principal
        </Label>
        <Input
          value={fields.headline}
          onChange={(e) => update('headline', e.target.value)}
          className="text-sm h-9"
          placeholder="Ex: Olá, {{primeiro_nome}}"
        />
      </section>

      {/* PARÁGRAFOS */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
            <Type className="h-3 w-3" /> Texto ({fields.paragraphs.length})
          </Label>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={addParagraph}>
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {fields.paragraphs.map((p, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-2 space-y-1.5">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    §{i + 1}
                  </span>
                  {fields.paragraphs.length > 1 && (
                    <button
                      onClick={() => removeParagraph(i)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <Textarea
                  value={p}
                  onChange={(e) => updateParagraph(i, e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="space-y-2">
        <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
          <MousePointerClick className="h-3 w-3" /> Botão (CTA)
        </Label>
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Texto do botão</Label>
            <Input
              value={fields.ctaText}
              onChange={(e) => update('ctaText', e.target.value.toUpperCase())}
              className="text-sm h-9"
              placeholder="ACESSAR PLATAFORMA"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">URL do botão</Label>
            <Input
              value={fields.ctaUrl}
              onChange={(e) => update('ctaUrl', e.target.value)}
              className="text-sm h-9 font-mono text-xs"
              placeholder="https://..."
              type="url"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Fundo</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="color"
                  value={fields.ctaBgColor.startsWith('#') ? fields.ctaBgColor : '#3B82F6'}
                  onChange={(e) => update('ctaBgColor', e.target.value)}
                  className="h-9 w-12 p-1 cursor-pointer"
                />
                <Input
                  value={fields.ctaBgColor}
                  onChange={(e) => update('ctaBgColor', e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Texto</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="color"
                  value={fields.ctaTextColor.startsWith('#') ? fields.ctaTextColor : '#000000'}
                  onChange={(e) => update('ctaTextColor', e.target.value)}
                  className="h-9 w-12 p-1 cursor-pointer"
                />
                <Input
                  value={fields.ctaTextColor}
                  onChange={(e) => update('ctaTextColor', e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
