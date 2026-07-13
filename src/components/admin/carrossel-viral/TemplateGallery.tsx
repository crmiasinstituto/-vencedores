// Galeria de templates com mini preview real (renderiza primeiro slide escalado)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { templates, templateOrder, getTemplate } from './templates';
import type { CarouselConfig, TemplateId, TemplateTheme } from './templates';
import { ScaledSlide } from './ScaledSlide';
import { Check } from 'lucide-react';

interface TemplateGalleryProps {
  templateId: TemplateId;
  onSelect: (id: TemplateId) => void;
  config: CarouselConfig;
  theme?: TemplateTheme;
  /** Slide de exemplo pra usar no preview. Se nao passar, usa um placeholder. */
  sampleSlide?: { titulo: string; texto: string };
  compact?: boolean;
}

const placeholderSlide = {
  titulo: 'Seu titulo aqui',
  texto: 'O texto do seu slide aparece aqui.\n\nCom paragrafos curtos e ideias completas.',
};

export function TemplateGallery({
  templateId,
  onSelect,
  config,
  theme,
  sampleSlide,
  compact,
}: TemplateGalleryProps) {
  const sample = sampleSlide || placeholderSlide;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Template do carrossel</span>
          <span className="text-xs font-normal text-muted-foreground">
            Atual: <strong className="text-foreground">{getTemplate(templateId).name}</strong>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
          {templateOrder.map((id) => {
            const tpl = templates[id];
            const Comp = tpl.component;
            const active = id === templateId;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={`group rounded-lg border-2 transition-all overflow-hidden bg-background ${
                  active
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <ScaledSlide className="border-0 rounded-none">
                  <Comp
                    titulo={sample.titulo}
                    texto={sample.texto}
                    slideIndex={0}
                    totalSlides={6}
                    config={config}
                    theme={theme}
                  />
                  {active && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </ScaledSlide>
                <div className="p-2 text-left bg-background">
                  <div className="text-xs font-semibold truncate">{tpl.name}</div>
                  {!compact && (
                    <div className="text-[10px] text-muted-foreground line-clamp-2">
                      {tpl.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
