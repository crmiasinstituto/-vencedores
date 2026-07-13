// Drawer pra editar 1 slide: titulo, texto, imagem (regerar/remover/upload manual)
import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Save, Wand2, Loader2, Trash2, Upload, ImageIcon, RefreshCw, Pin, PinOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadCarouselAsset } from './uploadAvatar';

interface SlideContent {
  titulo: string;
  texto: string;
  imageUrl?: string;
}

interface SlideEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slideKey: string | null;
  slideIndex: number;
  totalSlides: number;
  initialSlide: SlideContent | undefined;
  onSave: (slideKey: string, updated: SlideContent) => Promise<void> | void;
  onRegenerateImage?: (slideKey: string) => Promise<void> | void;
  onRegenerateText?: (slideKey: string) => Promise<void> | void;
  generatingImage?: boolean;
  aiEnabled?: boolean;
  /** Marca este slide como o "fixo final" pra todos os carrosseis */
  onPinAsFinal?: (slide: SlideContent) => void;
  /** True se este slide ja eh o fixo (mostra botao Desafixar) */
  isCurrentlyPinned?: boolean;
}

export function SlideEditDrawer({
  open,
  onOpenChange,
  slideKey,
  slideIndex,
  totalSlides,
  initialSlide,
  onSave,
  onRegenerateImage,
  onRegenerateText,
  generatingImage,
  aiEnabled = true,
  onPinAsFinal,
  isCurrentlyPinned,
}: SlideEditDrawerProps) {
  const [draft, setDraft] = useState<SlideContent>({ titulo: '', texto: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sincroniza draft quando abrir / trocar slide
  useEffect(() => {
    if (initialSlide) {
      setDraft({
        titulo: initialSlide.titulo,
        texto: initialSlide.texto,
        imageUrl: initialSlide.imageUrl,
      });
    }
  }, [initialSlide, slideKey]);

  const dirty =
    !!initialSlide &&
    (draft.titulo !== initialSlide.titulo ||
      draft.texto !== initialSlide.texto ||
      draft.imageUrl !== initialSlide.imageUrl);

  async function handleSave() {
    if (!slideKey) return;
    setSaving(true);
    try {
      await onSave(slideKey, draft);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCarouselAsset(file, 'avatars');
      setDraft({ ...draft, imageUrl: url });
      toast.success('Imagem enviada');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs flex items-center justify-center font-bold">
              {slideIndex + 1}
            </span>
            Editar slide {slideIndex + 1} / {totalSlides}
            {draft.imageUrl && (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                <ImageIcon className="w-2.5 h-2.5 mr-0.5" /> com imagem
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Titulo */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Título</Label>
            <Input
              value={draft.titulo}
              onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
              placeholder="Título do slide"
            />
            <p className="text-[10px] text-muted-foreground">
              Aparece em destaque no template
            </p>
          </div>

          {/* Texto */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Texto</Label>
              {onRegenerateText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => slideKey && onRegenerateText(slideKey)}
                  className="h-6 px-2 gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="text-[10px]">Regerar com IA</span>
                </Button>
              )}
            </div>
            <Textarea
              value={draft.texto}
              onChange={(e) => setDraft({ ...draft, texto: e.target.value })}
              rows={8}
              className="resize-y whitespace-pre-line"
              placeholder="Conteúdo do slide. Use linhas em branco entre parágrafos."
            />
            <p className="text-[10px] text-muted-foreground">
              {draft.texto.length} caracteres · linha em branco = parágrafo separado
            </p>
          </div>

          {/* Imagem */}
          <div className="space-y-2 border border-border rounded-lg p-3 bg-background/40">
            <Label className="text-xs font-medium flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5" />
              Imagem do slide
            </Label>

            <div className="flex items-start gap-3">
              <div className="w-20 h-24 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                {draft.imageUrl ? (
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                {aiEnabled && onRegenerateImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => slideKey && onRegenerateImage(slideKey)}
                    disabled={generatingImage}
                    className="gap-2 justify-start"
                  >
                    {generatingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    {draft.imageUrl ? 'Regerar com IA' : 'Gerar com IA'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="gap-2 justify-start"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Subir manualmente
                </Button>
                {draft.imageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft({ ...draft, imageUrl: undefined })}
                    className="gap-2 justify-start text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover imagem
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0])}
                />
              </div>
            </div>
          </div>
          {/* Fixar este slide como CTA padrao */}
          {onPinAsFinal && (
            <div className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Pin className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">
                    {isCurrentlyPinned ? 'Este slide é o slide fixo padrão' : 'Marcar como slide fixo padrão'}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isCurrentlyPinned
                      ? 'Aparece como último slide em TODOS os carrosséis novos. Clique em "Desafixar" pra remover.'
                      : 'Marca este slide como CTA padrão pra aparecer no final de todos os seus carrosséis.'}
                  </p>
                </div>
                <Button
                  variant={isCurrentlyPinned ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => {
                    if (!slideKey) return;
                    onPinAsFinal(draft);
                  }}
                  className="gap-2 flex-shrink-0"
                >
                  {isCurrentlyPinned ? (
                    <>
                      <PinOff className="w-3.5 h-3.5" />
                      Desafixar
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5" />
                      Fixar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
