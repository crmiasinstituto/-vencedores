// Painel premium de customizacao do template: cor accent, fundo, escala, peso, fonte.
// Aplicado por cima do template selecionado, persistido no localStorage.
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Palette, ChevronDown, RotateCcw, Bold, Type as TypeIcon,
} from 'lucide-react';
import type { TemplateTheme } from './templates';

interface TemplateCustomizerProps {
  theme: TemplateTheme;
  onChange: (theme: TemplateTheme) => void;
  defaultOpen?: boolean;
}

const accentSwatches = [
  { color: '#facc15', name: 'Amarelo' },
  { color: '#fbbf24', name: 'Âmbar' },
  { color: '#dc2626', name: 'Vermelho' },
  { color: '#1d9bf0', name: 'Azul X' },
  { color: '#10b981', name: 'Verde' },
  { color: '#a855f7', name: 'Roxo' },
  { color: '#f97316', name: 'Laranja' },
  { color: '#ec4899', name: 'Rosa' },
  { color: '#ffffff', name: 'Branco' },
];

const bgSwatches = [
  { color: '', name: 'Padrão' },
  { color: '#000000', name: 'Preto' },
  { color: '#0a0a0a', name: 'Quase preto' },
  { color: '#ffffff', name: 'Branco' },
  { color: '#fafaf9', name: 'Off-white' },
  { color: '#1e1b4b', name: 'Roxo escuro' },
  { color: '#0c4a6e', name: 'Azul escuro' },
  { color: '#7c2d12', name: 'Marrom' },
];

const scaleOptions: Array<{ value: number; label: string }> = [
  { value: 0.85, label: 'Compacto' },
  { value: 1.0, label: 'Normal' },
  { value: 1.15, label: 'Grande' },
  { value: 1.3, label: 'Enorme' },
];

const weightOptions: Array<{ value: TemplateTheme['fontWeight']; label: string }> = [
  { value: 'normal', label: 'Regular' },
  { value: 'bold', label: 'Bold' },
  { value: 'black', label: 'Black' },
];

const familyOptions: Array<{ value: TemplateTheme['fontFamily']; label: string }> = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];

export function TemplateCustomizer({ theme, onChange, defaultOpen }: TemplateCustomizerProps) {
  const [open, setOpen] = useState(!!defaultOpen);

  const isCustomized = !!(
    theme.accentColor ||
    theme.bgColor ||
    theme.textScale ||
    theme.fontWeight ||
    theme.fontFamily ||
    theme.textColor
  );

  function update<K extends keyof TemplateTheme>(key: K, value: TemplateTheme[K]) {
    onChange({ ...theme, [key]: value });
  }

  function reset() {
    onChange({});
  }

  const currentScale = theme.textScale ?? 1;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Palette className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  Personalizar template
                  {isCustomized && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                      customizado
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Cor, fundo, tamanho da fonte, peso e família
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Preview rapido das cores */}
              <div className="flex gap-1">
                <span
                  className="w-6 h-6 rounded-md border border-border"
                  style={{ background: theme.accentColor ?? '#facc15' }}
                />
                <span
                  className="w-6 h-6 rounded-md border border-border"
                  style={{ background: theme.bgColor || '#000000' }}
                />
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border bg-background/40 p-5 space-y-5">
            {/* ════════════ COR ACCENT ════════════ */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: theme.accentColor ?? '#facc15' }}
                />
                Cor de destaque
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {accentSwatches.map((s) => (
                  <button
                    key={s.color}
                    onClick={() => update('accentColor', s.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      theme.accentColor === s.color
                        ? 'border-primary scale-110 ring-2 ring-primary/30'
                        : 'border-border hover:scale-105'
                    }`}
                    style={{ background: s.color }}
                    title={s.name}
                  />
                ))}
                <Input
                  type="color"
                  value={theme.accentColor ?? '#facc15'}
                  onChange={(e) => update('accentColor', e.target.value)}
                  className="w-10 h-8 p-0.5 cursor-pointer border-border"
                  title="Cor customizada"
                />
              </div>
            </div>

            {/* ════════════ COR DE FUNDO ════════════ */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded border border-border"
                  style={{ background: theme.bgColor || '#000000' }}
                />
                Cor de fundo
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {bgSwatches.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => update('bgColor', s.color || undefined)}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      (theme.bgColor || '') === s.color
                        ? 'border-primary scale-110 ring-2 ring-primary/30'
                        : 'border-border hover:scale-105'
                    } ${!s.color ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500' : ''}`}
                    style={s.color ? { background: s.color } : undefined}
                    title={s.name}
                  />
                ))}
                <Input
                  type="color"
                  value={theme.bgColor ?? '#000000'}
                  onChange={(e) => update('bgColor', e.target.value)}
                  className="w-10 h-8 p-0.5 cursor-pointer border-border"
                  title="Cor customizada"
                />
              </div>
            </div>

            {/* ════════════ ESCALA DA FONTE ════════════ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-2">
                  <TypeIcon className="w-3 h-3" />
                  Tamanho da fonte
                </Label>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {Math.round(currentScale * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {scaleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update('textScale', opt.value === 1 ? undefined : opt.value)}
                    className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                      currentScale === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border border-border hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Slider
                min={0.7}
                max={1.5}
                step={0.05}
                value={[currentScale]}
                onValueChange={(v) => update('textScale', v[0] === 1 ? undefined : v[0])}
              />
            </div>

            {/* ════════════ PESO + FAMILIA ════════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-2">
                  <Bold className="w-3 h-3" />
                  Peso da fonte
                </Label>
                <div className="grid grid-cols-3 gap-1">
                  {weightOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('fontWeight', opt.value)}
                      className={`px-2 py-1.5 rounded-md text-xs transition-all ${
                        theme.fontWeight === opt.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border border-border hover:bg-accent'
                      }`}
                      style={{
                        fontWeight:
                          opt.value === 'black' ? 900 : opt.value === 'bold' ? 700 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Família</Label>
                <div className="grid grid-cols-3 gap-1">
                  {familyOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update('fontFamily', opt.value)}
                      className={`px-2 py-1.5 rounded-md text-xs transition-all ${
                        theme.fontFamily === opt.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border border-border hover:bg-accent'
                      }`}
                      style={{
                        fontFamily:
                          opt.value === 'serif'
                            ? 'Georgia, serif'
                            : opt.value === 'mono'
                              ? 'monospace'
                              : 'inherit',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ════════════ Reset ════════════ */}
            {isCustomized && (
              <div className="flex justify-end pt-1">
                <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar padrão
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
