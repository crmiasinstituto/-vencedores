// Editor visual: preview ao vivo dos slides com template escolhido + export ZIP/PNG
// O seletor de template e config ficam no AdminCarrosselViral (sempre visivel no topo).
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, ImageIcon, Package, Wand2, AlertCircle, Edit2 } from 'lucide-react';
import { getTemplate } from './templates';
import type { CarouselConfig, TemplateId, TemplateTheme } from './templates';
import { useCarouselExport } from './useCarouselExport';
import { ScaledSlide } from './ScaledSlide';
import { toast } from 'sonner';

interface SlideContent {
  titulo: string;
  texto: string;
  imageUrl?: string;
}

interface CarouselVisualEditorProps {
  topic: string;
  slides: Record<string, SlideContent>;
  templateId: TemplateId;
  config: CarouselConfig;
  theme?: TemplateTheme;
  aiEnabled?: boolean;        // false = esconde botoes "Gerar imagem IA"
  generatingImageKey: string | null;
  generatingAllImages: boolean;
  onGenerateImage: (slideKey: string) => void;
  onGenerateAllImages: () => void;
  /** Click no slide do preview pra abrir editor inline */
  onEditSlide?: (slideKey: string) => void;
}

export function CarouselVisualEditor({
  topic,
  slides,
  templateId,
  config,
  theme,
  aiEnabled = true,
  generatingImageKey,
  generatingAllImages,
  onGenerateImage,
  onGenerateAllImages,
  onEditSlide,
}: CarouselVisualEditorProps) {
  const slideKeys = Object.keys(slides).sort();
  const totalSlides = slideKeys.length;
  const Tpl = getTemplate(templateId).component;
  const fullConfig: CarouselConfig = { ...config, topic };

  const { exportSlide, exportAll, exporting, exportingIndex } = useCarouselExport();

  async function handleExportAll() {
    try {
      await exportAll(totalSlides, topic);
      toast.success('ZIP baixado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao exportar');
    }
  }

  async function handleExportSlide(idx: number) {
    try {
      await exportSlide(idx, topic);
      toast.success(`Slide ${idx + 1} baixado`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao exportar slide');
    }
  }

  const slidesArr = slideKeys.map((key) => ({ key, ...slides[key] }));
  const slidesWithImage = slidesArr.filter((s) => !!s.imageUrl).length;
  const allHaveImage = slidesWithImage === totalSlides && totalSlides > 0;

  return (
    <div className="space-y-4">
      {/* ════════════════════════ TOOLBAR ════════════════════════ */}
      <Card className="bg-card border-border">
        <CardContent className="py-4 flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-primary/30 text-primary gap-1">
            <ImageIcon className="w-3 h-3" /> Visual · {getTemplate(templateId).name}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {slidesWithImage}/{totalSlides} com imagem IA
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {aiEnabled && (
              <Button
                variant="outline"
                onClick={onGenerateAllImages}
                disabled={generatingAllImages || generatingImageKey !== null}
                className="gap-2"
              >
                {generatingAllImages ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando imagens...
                  </>
                ) : allHaveImage ? (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Regerar todas com estilo atual
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Gerar imagens IA ({totalSlides - slidesWithImage} pendentes)
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleExportAll} disabled={exporting} className="gap-2">
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ZIP {exportingIndex !== null ? `(${exportingIndex + 1}/${totalSlides})` : ''}...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" /> Baixar ZIP
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════ PREVIEWS ════════════════════════ */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Preview ao vivo</span>
            <span className="text-xs text-muted-foreground font-normal">
              1080×1350 · {totalSlides} slides
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slidesArr.map((slide, idx) => {
              const isExporting = exportingIndex === idx;
              const isGeneratingImg = generatingImageKey === slide.key;
              return (
                <div key={slide.key} className="space-y-2">
                  <ScaledSlide
                    interactive={!!onEditSlide}
                    onClick={onEditSlide ? () => onEditSlide(slide.key) : undefined}
                  >
                    <Tpl
                      titulo={slide.titulo}
                      texto={slide.texto}
                      slideIndex={idx}
                      totalSlides={totalSlides}
                      config={fullConfig}
                      imageUrl={slide.imageUrl}
                      theme={theme}
                    />

                    {(isGeneratingImg || (generatingAllImages && !slide.imageUrl)) && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-xs gap-2 z-10">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Gerando imagem IA...
                      </div>
                    )}

                    {onEditSlide && (
                      <div className="absolute top-2 right-2 z-10 opacity-0 hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 pointer-events-none">
                        <Edit2 className="w-3 h-3" />
                        editar
                      </div>
                    )}
                  </ScaledSlide>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      Slide {idx + 1}
                      {slide.imageUrl && (
                        <Badge
                          variant="outline"
                          className="ml-1 text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-400"
                        >
                          IA
                        </Badge>
                      )}
                    </span>
                    <div className="flex gap-1">
                      {aiEnabled && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onGenerateImage(slide.key)}
                          disabled={isGeneratingImg || generatingAllImages}
                          className="gap-1 h-7 px-2"
                          title={slide.imageUrl ? 'Regerar imagem IA' : 'Gerar imagem IA'}
                        >
                          {isGeneratingImg ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wand2 className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleExportSlide(idx)}
                        disabled={exporting || isExporting}
                        className="gap-1 h-7 px-2"
                        title="Baixar PNG"
                      >
                        {isExporting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Aviso CORS pra avatar */}
      {config.avatarUrl && !config.avatarUrl.includes('supabase.co') && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Avatar de URL externa pode aparecer em branco no PNG por causa de CORS. Recomendado:
            subir no Supabase Storage ou usar Cloudinary.
          </span>
        </div>
      )}

      {/* ════════════════════════ STAGE OFF-SCREEN ════════════════════════ */}
      <div
        style={{
          position: 'fixed',
          left: -20000,
          top: 0,
          width: 1080,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {slidesArr.map((slide, idx) => (
          <div key={slide.key} data-export-slide={idx}>
            <Tpl
              titulo={slide.titulo}
              texto={slide.texto}
              slideIndex={idx}
              totalSlides={totalSlides}
              config={fullConfig}
              imageUrl={slide.imageUrl}
              theme={theme}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
