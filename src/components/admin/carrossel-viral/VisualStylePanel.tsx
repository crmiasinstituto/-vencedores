// Painel premium de "Estilo Visual" — diretor de arte das imagens IA
// Toggle gerar com IA, prompt customizavel, foto de referencia, cor accent.
import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ImageIcon, ChevronDown, Save, Upload, Camera, Loader2, Trash2, RotateCcw, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadCarouselAsset } from './uploadAvatar';
import { DEFAULT_VISUAL_PROMPT, type VisualStyle } from './visualStyleDefaults';

interface VisualStylePanelProps {
  visualStyle: VisualStyle;
  onChange: (vs: VisualStyle) => void;
  defaultOpen?: boolean;
}

const accentSwatches = [
  '#3B82F6', '#fbbf24', '#dc2626', '#1d9bf0', '#10b981', '#a855f7', '#f97316', '#ec4899',
];

export function VisualStylePanel({ visualStyle, onChange, defaultOpen }: VisualStylePanelProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState<VisualStyle>(visualStyle);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(visualStyle);
  const promptCharCount = draft.prompt?.length || 0;

  async function handleUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCarouselAsset(file, 'avatars'); // reusa pasta de assets
      setDraft({ ...draft, referenceUrl: url });
      toast.success('Foto de referência enviada');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleSave() {
    setSaving(true);
    onChange(draft);
    setTimeout(() => {
      setSaving(false);
      toast.success('Estilo visual salvo');
    }, 300);
  }

  function handleReset() {
    setDraft(visualStyle);
  }

  function resetPrompt() {
    setDraft({ ...draft, prompt: DEFAULT_VISUAL_PROMPT });
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  Estilo visual (Diretor de Arte)
                  {visualStyle.useAI ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400 gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> IA ativa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-zinc-500/30">
                      sem IA
                    </Badge>
                  )}
                  {visualStyle.referenceUrl && (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 border-blue-500/30 text-blue-400 gap-1"
                    >
                      <Camera className="w-2.5 h-2.5" /> com referência
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Define como a IA gera as imagens dos slides
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-md border border-border"
                style={{ background: visualStyle.accentColor || '#3B82F6' }}
                title={`Cor accent: ${visualStyle.accentColor || '#3B82F6'}`}
              />
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border bg-background/40 p-5 space-y-5">
            {/* ════════════ Toggle IA ════════════ */}
            <div className="flex items-start justify-between gap-4 p-3 bg-card border border-border rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  Gerar imagens com IA
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/30 text-amber-400">
                    Nano Banana Pro
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando ativo, usa Gemini 2.5 Flash Image (com OpenAI gpt-image-1 como fallback). Quando
                  desativado, o botão "Gerar imagem IA" fica oculto e você pode subir imagens manualmente.
                </p>
              </div>
              <Switch
                checked={draft.useAI}
                onCheckedChange={(v) => setDraft({ ...draft, useAI: v })}
              />
            </div>

            {/* ════════════ Prompt do Diretor de Arte ════════════ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Prompt do Diretor de Arte</Label>
                <Button variant="ghost" size="sm" onClick={resetPrompt} className="h-6 px-2 gap-1">
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-[10px]">Restaurar padrão</span>
                </Button>
              </div>
              <Textarea
                value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                rows={10}
                className="bg-background font-mono text-xs leading-relaxed resize-y"
                placeholder="Descreva o estilo visual que a IA deve aplicar em todas as imagens..."
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Esse prompt é aplicado em TODA imagem. O conteúdo de cada slide entra por cima.</span>
                <span className="tabular-nums">{promptCharCount} caracteres</span>
              </div>
            </div>

            {/* ════════════ Cor Accent ════════════ */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: draft.accentColor || '#3B82F6' }}
                />
                Cor de destaque (inserida nos detalhes da imagem)
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {accentSwatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, accentColor: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      draft.accentColor === c
                        ? 'border-primary scale-110 ring-2 ring-primary/30'
                        : 'border-border hover:scale-105'
                    }`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
                <Input
                  type="color"
                  value={draft.accentColor || '#3B82F6'}
                  onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
                  className="w-10 h-8 p-0.5 cursor-pointer border-border"
                />
                <Input
                  type="text"
                  value={draft.accentColor || ''}
                  onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
                  placeholder="#3B82F6"
                  className="w-28 font-mono text-xs"
                />
              </div>
            </div>

            {/* ════════════ Foto de Referência ════════════ */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-2">
                <Camera className="w-3 h-3" />
                Foto de referência (opcional)
              </Label>
              <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                <div className="w-16 h-16 rounded-lg bg-background flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {draft.referenceUrl ? (
                    <img src={draft.referenceUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {draft.referenceUrl
                      ? 'A IA vai te incluir sutilmente como coadjuvante nas cenas geradas. A cena continua sendo o protagonista.'
                      : 'Adicione uma foto sua pra IA te incluir nas imagens. Foto clara do rosto funciona melhor.'}
                  </p>
                  {draft.referenceUrl && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                      {draft.referenceUrl.split('/').pop()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {draft.referenceUrl ? 'Trocar' : 'Enviar'}
                  </Button>
                  {draft.referenceUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraft({ ...draft, referenceUrl: undefined })}
                      className="text-rose-400 hover:text-rose-300 gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-xs">Remover</span>
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0])}
                />
              </div>
            </div>

            {/* ════════════ Footer Salvar ════════════ */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                {dirty ? 'Alterações pendentes' : 'Tudo salvo'}
              </span>
              <div className="flex gap-2">
                {dirty && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Descartar
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
