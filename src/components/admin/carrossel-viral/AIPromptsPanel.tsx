// Painel premium: Persona, Estrutura e Legenda
// 3 prompts customizaveis que modificam como a IA gera textos do carrossel
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  MessageSquare, ChevronDown, Save, Loader2, RotateCcw, FileText, Instagram,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_PERSONA,
  DEFAULT_CONTENT_STRUCTURE,
  DEFAULT_CAPTION,
  type AIPrompts,
} from './aiPromptsDefaults';

interface AIPromptsPanelProps {
  prompts: AIPrompts;
  onChange: (p: AIPrompts) => void;
  defaultOpen?: boolean;
}

export function AIPromptsPanel({ prompts, onChange, defaultOpen }: AIPromptsPanelProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState<AIPrompts>(prompts);
  const [tab, setTab] = useState<'persona' | 'structure' | 'caption'>('persona');
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(prompts);
  const customCount =
    (prompts.persona ? 1 : 0) +
    (prompts.contentStructure ? 1 : 0) +
    (prompts.caption ? 1 : 0);

  function update<K extends keyof AIPrompts>(k: K, v: AIPrompts[K]) {
    setDraft({ ...draft, [k]: v });
  }

  function handleSave() {
    setSaving(true);
    onChange(draft);
    setTimeout(() => {
      setSaving(false);
      toast.success('Tom de voz e estrutura salvos');
    }, 250);
  }

  function handleReset() {
    setDraft(prompts);
  }

  function fillDefault(field: keyof AIPrompts) {
    const defaults: AIPrompts = {
      persona: DEFAULT_PERSONA,
      contentStructure: DEFAULT_CONTENT_STRUCTURE,
      caption: DEFAULT_CAPTION,
    };
    update(field, defaults[field]);
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  Persona, Estrutura e Legenda
                  {customCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400"
                    >
                      {customCount}/3 customizado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-zinc-500/30">
                      padrão
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Como a IA escreve: tom de voz, estrutura dos slides, legenda
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
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="bg-card border border-border w-full justify-start">
                <TabsTrigger value="persona" className="gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Persona & Estilo
                </TabsTrigger>
                <TabsTrigger value="structure" className="gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Estrutura
                </TabsTrigger>
                <TabsTrigger value="caption" className="gap-2">
                  <Instagram className="w-3.5 h-3.5" />
                  Legenda
                </TabsTrigger>
              </TabsList>

              {/* ════════════ PERSONA ════════════ */}
              <TabsContent value="persona" className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold">Persona & Estilo (Quem fala?)</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Define personalidade, tom de voz e "jeito de falar". Influencia ganchos e textos.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fillDefault('persona')}
                    className="h-7 px-2 gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="text-[10px]">Usar template</span>
                  </Button>
                </div>
                <Textarea
                  value={draft.persona}
                  onChange={(e) => update('persona', e.target.value)}
                  rows={8}
                  placeholder={`Deixe vazio pra usar o padrão + que Vencedores.\n\nOu escreva como você quer que a IA fale. Exemplo:\n\n"Empresário raiz, direto, sem floreios. Fala em primeira pessoa, com casos reais. Não usa linguagem de coach. Frases curtas..."`}
                  className="resize-y bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  {draft.persona.length} caracteres · vazio = usa o padrão
                </p>
              </TabsContent>

              {/* ════════════ ESTRUTURA ════════════ */}
              <TabsContent value="structure" className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold">Estrutura de Conteúdo (Como fala?)</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Define a estrutura lógica dos slides (Gancho, Desenvolvimento, CTA).
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fillDefault('contentStructure')}
                    className="h-7 px-2 gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="text-[10px]">Usar template</span>
                  </Button>
                </div>
                <Textarea
                  value={draft.contentStructure}
                  onChange={(e) => update('contentStructure', e.target.value)}
                  rows={10}
                  placeholder={`Deixe vazio pra usar o padrão (gancho → 4 slides de desenvolvimento → CTA).\n\nOu escreva sua estrutura ideal. Exemplo:\n\n"SLIDE 1 — gancho com dado chocante\nSLIDES 2-5 — caso real + aplicação\nSLIDE 6 — CTA"`}
                  className="resize-y bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  {draft.contentStructure.length} caracteres · vazio = usa o padrão
                </p>
              </TabsContent>

              {/* ════════════ LEGENDA ════════════ */}
              <TabsContent value="caption" className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold">Legenda do Carrossel</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Define como a IA gera a legenda que acompanha o carrossel no Instagram.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fillDefault('caption')}
                    className="h-7 px-2 gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="text-[10px]">Usar template</span>
                  </Button>
                </div>
                <Textarea
                  value={draft.caption}
                  onChange={(e) => update('caption', e.target.value)}
                  rows={8}
                  placeholder={`Deixe vazio pra usar o padrão.\n\nOu defina como quer a legenda. Exemplo:\n\n"Legenda em até 800 caracteres, sem emojis. Resumo do carrossel + CTA com link na bio. Quebras de linha entre parágrafos."`}
                  className="resize-y bg-background"
                />
                <p className="text-[10px] text-muted-foreground">
                  {draft.caption.length} caracteres · vazio = usa o padrão
                </p>
              </TabsContent>
            </Tabs>

            {/* Footer Salvar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border pt-4">
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
