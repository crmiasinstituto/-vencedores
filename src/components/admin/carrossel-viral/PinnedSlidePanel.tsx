// Painel: slide fixo final que aparece em TODOS os carrosseis (CTA padrao tipo "Me segue!")
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Pin, ChevronDown, Save, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export interface PinnedSlide {
  enabled: boolean;
  titulo: string;
  texto: string;
}

export const DEFAULT_PINNED_SLIDE: PinnedSlide = {
  enabled: false,
  titulo: 'Se gostou, me segue!',
  texto: 'Aqui rola conteúdo direto e sem enrolação toda semana.\n\nMe segue pra não perder.\n\nLink na bio.',
};

interface PinnedSlidePanelProps {
  pinnedSlide: PinnedSlide;
  onChange: (ps: PinnedSlide) => void;
  defaultOpen?: boolean;
}

export function PinnedSlidePanel({ pinnedSlide, onChange, defaultOpen }: PinnedSlidePanelProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState<PinnedSlide>(pinnedSlide);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(pinnedSlide);

  function handleSave() {
    setSaving(true);
    onChange(draft);
    setTimeout(() => {
      setSaving(false);
      toast.success(draft.enabled ? 'Slide fixo ativado' : 'Slide fixo salvo');
    }, 250);
  }

  function reset() {
    setDraft(DEFAULT_PINNED_SLIDE);
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Pin className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  Slide fixo final
                  {pinnedSlide.enabled ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400"
                    >
                      ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-zinc-500/30">
                      desativado
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  CTA fixo que aparece após o slide 6 em todos os carrosséis
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border bg-background/40 p-5 space-y-4">
            {/* Toggle */}
            <div className="flex items-start justify-between gap-4 p-3 bg-card border border-border rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium">Adicionar slide fixo no final</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aparece como último slide nos carrosséis novos. Pode ser editado por carrossel se quiser.
                </p>
              </div>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
              />
            </div>

            {/* Titulo */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Título</Label>
              <Input
                value={draft.titulo}
                onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
                placeholder="Ex: Se gostou, me segue!"
              />
            </div>

            {/* Texto */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Texto</Label>
                <Button variant="ghost" size="sm" onClick={reset} className="h-6 px-2 gap-1">
                  <RotateCcw className="w-3 h-3" />
                  <span className="text-[10px]">Padrão</span>
                </Button>
              </div>
              <Textarea
                value={draft.texto}
                onChange={(e) => setDraft({ ...draft, texto: e.target.value })}
                rows={5}
                className="resize-y whitespace-pre-line"
                placeholder="Texto do slide. Use linhas em branco entre parágrafos."
              />
            </div>

            {/* Footer Salvar */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                {dirty ? 'Alterações pendentes' : 'Tudo salvo'}
              </span>
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
