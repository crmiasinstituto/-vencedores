import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Sparkles, Wand2, Copy, RefreshCw, Plus, Loader2, ChevronRight,
  FileText, History, Trash2, Check, ArrowLeft, ImageIcon, Type,
} from 'lucide-react';
import { CarouselVisualEditor } from '@/components/admin/carrossel-viral/CarouselVisualEditor';
import { TemplateGallery } from '@/components/admin/carrossel-viral/TemplateGallery';
import { IdentityConfigCard } from '@/components/admin/carrossel-viral/IdentityConfigCard';
import { TemplateCustomizer } from '@/components/admin/carrossel-viral/TemplateCustomizer';
import { VisualStylePanel } from '@/components/admin/carrossel-viral/VisualStylePanel';
import { AIPromptsPanel } from '@/components/admin/carrossel-viral/AIPromptsPanel';
import { SlideEditDrawer } from '@/components/admin/carrossel-viral/SlideEditDrawer';
import { useCarouselSettings } from '@/components/admin/carrossel-viral/useCarouselSettings';

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

interface Hook {
  id: number;
  text: string;
  style: string;
  angle: string;
}

interface SlideContent {
  titulo: string;
  texto: string;
  imageUrl?: string;
}

interface ViralCarousel {
  id: string;
  briefing: string;
  topic: string | null;
  hooks: Hook[];
  selected_hook_index: number | null;
  slides: Record<string, SlideContent>;
  caption: string | null;
  total_slides: number;
  status: 'draft' | 'hooks_generated' | 'content_generated' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

const db = supabase as any;

const styleLabels: Record<string, { label: string; color: string }> = {
  case_contraintuitivo: { label: 'Case contraintuitivo', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  dado_chocante: { label: 'Dado chocante', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  polemico: { label: 'Polemico', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
};

// ──────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────

export default function AdminCarrosselViral() {
  const [briefing, setBriefing] = useState('');
  const [history, setHistory] = useState<ViralCarousel[]>([]);
  const [current, setCurrent] = useState<ViralCarousel | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [regeneratingSlide, setRegeneratingSlide] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [regenSlideKey, setRegenSlideKey] = useState<string | null>(null);
  const [generatingImageKey, setGeneratingImageKey] = useState<string | null>(null);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);

  // Configurações compartilhadas (persistem no localStorage)
  const {
    templateId, setTemplateId,
    config, setConfig,
    theme, setTheme,
    visualStyle, setVisualStyle,
    pinnedSlide, setPinnedSlide,
    aiPrompts, setAIPrompts,
  } = useCarouselSettings();

  // Estado do drawer de edicao
  const [editingSlideKey, setEditingSlideKey] = useState<string | null>(null);

  // Combina slides do carrossel + slide fixo (se ativado).
  // O pinned recebe um key especial que NAO existe no banco — distinguivel no save.
  const PINNED_KEY = '__pinned__';
  const slidesWithPinned = useMemo(() => {
    if (!current?.slides) return {};
    const base = { ...current.slides };
    if (pinnedSlide.enabled) {
      base[PINNED_KEY] = { titulo: pinnedSlide.titulo, texto: pinnedSlide.texto };
    }
    return base;
  }, [current?.slides, pinnedSlide]);

  function isPinnedKey(key: string): boolean {
    return key === PINNED_KEY;
  }

  // Salva alteracoes vindas do drawer de edicao
  async function handleSaveEditedSlide(
    slideKey: string,
    updated: { titulo: string; texto: string; imageUrl?: string },
  ) {
    if (!current) return;

    if (isPinnedKey(slideKey)) {
      // Editou o slide fixo — atualiza global
      setPinnedSlide({
        ...pinnedSlide,
        titulo: updated.titulo,
        texto: updated.texto,
      });
      toast.success('Slide fixo atualizado (vale pra todos os carrosséis)');
      return;
    }

    // Slide normal — salva no banco e local
    const newSlides = {
      ...current.slides,
      [slideKey]: { ...current.slides[slideKey], ...updated },
    };
    setCurrent({ ...current, slides: newSlides });
    const { error } = await db
      .from('viral_carousels')
      .update({ slides: newSlides })
      .eq('id', current.id);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    toast.success(`Slide ${slideKey} atualizado`);
  }

  // ── Fetching ──

  async function fetchHistory() {
    const { data, error } = await db
      .from('viral_carousels')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      console.error(error);
      return;
    }
    setHistory(data || []);
  }

  useEffect(() => {
    fetchHistory().finally(() => setLoading(false));
  }, []);

  // ── Actions ──

  async function generateHooks() {
    if (briefing.trim().length < 6) {
      toast.error('Descreva o tema com mais detalhes (min 6 caracteres)');
      return;
    }
    setGeneratingHooks(true);
    try {
      const { data, error } = await supabase.functions.invoke('carrossel-viral', {
        body: {
          action: 'generate_hooks',
          briefing,
          persona_override: aiPrompts.persona,
          structure_override: aiPrompts.contentStructure,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar ganchos');

      const newCarousel: ViralCarousel = {
        id: data.carousel_id,
        briefing,
        topic: data.topic,
        hooks: data.hooks,
        selected_hook_index: null,
        slides: {},
        caption: null,
        total_slides: 0,
        status: 'hooks_generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCurrent(newCarousel);
      toast.success('3 ganchos gerados! Escolha o melhor');
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao gerar ganchos');
    } finally {
      setGeneratingHooks(false);
    }
  }

  async function pickHook(hookIndex: number) {
    if (!current) return;
    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('carrossel-viral', {
        body: {
          action: 'generate_content',
          carousel_id: current.id,
          hook_index: hookIndex,
          persona_override: aiPrompts.persona,
          structure_override: aiPrompts.contentStructure,
          caption_override: aiPrompts.caption,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar carrossel');

      setCurrent({
        ...current,
        selected_hook_index: hookIndex,
        slides: data.slides,
        caption: data.caption,
        total_slides: Object.keys(data.slides).length,
        status: 'ready',
      });
      toast.success('Carrossel pronto!');
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao gerar carrossel');
    } finally {
      setGeneratingContent(false);
    }
  }

  async function regenerateSlide(slideKey: string, instruction?: string) {
    if (!current) return;
    setRegeneratingSlide(slideKey);
    try {
      const { data, error } = await supabase.functions.invoke('carrossel-viral', {
        body: {
          action: 'regenerate_slide',
          carousel_id: current.id,
          slide_key: slideKey,
          instruction: instruction?.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao regerar');

      setCurrent({
        ...current,
        slides: { ...current.slides, [slideKey]: data.slide },
      });
      toast.success(`${slideKey} reescrito`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao regerar slide');
    } finally {
      setRegeneratingSlide(null);
      setRegenSlideKey(null);
      setRegenInstruction('');
    }
  }

  async function generateImage(slideKey: string) {
    if (!current) return;
    if (!visualStyle.useAI) {
      toast.info('Geração com IA está desativada. Ative no painel "Estilo visual" pra usar.');
      return;
    }
    setGeneratingImageKey(slideKey);
    try {
      const { data, error } = await supabase.functions.invoke('carrossel-viral', {
        body: {
          action: 'generate_image',
          carousel_id: current.id,
          slide_key: slideKey,
          style_prompt: visualStyle.prompt,
          accent_color: visualStyle.accentColor,
          reference_url: visualStyle.referenceUrl,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar imagem');

      const slide = current.slides[slideKey];
      setCurrent({
        ...current,
        slides: {
          ...current.slides,
          [slideKey]: { ...slide, imageUrl: data.image_url },
        },
      });
      toast.success(`Imagem do ${slideKey} gerada`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao gerar imagem IA');
    } finally {
      setGeneratingImageKey(null);
    }
  }

  async function generateAllImages() {
    if (!current) return;
    if (!visualStyle.useAI) {
      toast.info('Geração com IA está desativada. Ative no painel "Estilo visual" pra usar.');
      return;
    }

    const keys = Object.keys(current.slides).sort();
    const slidesWithImage = keys.filter((k) => !!current.slides[k]?.imageUrl).length;
    const slidesWithoutImage = keys.length - slidesWithImage;

    // Decide modo: completar faltantes vs regerar todas
    let mode: 'fill' | 'regen-all' = 'fill';
    if (slidesWithImage === keys.length) {
      // Todas ja tem imagem — perguntar se quer regerar com o estilo atual
      if (
        !confirm(
          `Todos os ${keys.length} slides já têm imagem IA.\n\nRegerar todos com o estilo visual atual? (consome ${keys.length} chamadas de IA)`,
        )
      ) {
        return;
      }
      mode = 'regen-all';
    } else if (slidesWithImage > 0) {
      // Mistura — perguntar
      const choice = confirm(
        `${slidesWithImage} slide(s) já têm imagem IA, ${slidesWithoutImage} faltam.\n\n` +
          `OK = gerar SÓ os ${slidesWithoutImage} faltantes.\n` +
          `Cancelar = abrir opção de regerar TODOS.`,
      );
      if (!choice) {
        // Confirma regerar todos
        if (
          !confirm(
            `Confirma regerar todos os ${keys.length} slides? (consome ${keys.length} chamadas de IA)`,
          )
        ) {
          return;
        }
        mode = 'regen-all';
      }
      // Se confirmou primeiro, mantém mode='fill'
    }

    setGeneratingAllImages(true);
    let updated = { ...current };
    try {
      for (const key of keys) {
        // Skip se já tem imagem E modo é 'fill'
        if (mode === 'fill' && updated.slides[key]?.imageUrl) continue;
        setGeneratingImageKey(key);
        const { data, error } = await supabase.functions.invoke('carrossel-viral', {
          body: {
            action: 'generate_image',
            carousel_id: current.id,
            slide_key: key,
            style_prompt: visualStyle.prompt,
            accent_color: visualStyle.accentColor,
            reference_url: visualStyle.referenceUrl,
          },
        });
        if (error) {
          toast.error(`Erro no ${key}: ${error.message || error}`);
          continue;
        }
        if (!data?.success) {
          toast.error(`Erro no ${key}: ${data?.error || 'falha'}`);
          continue;
        }
        const slide = updated.slides[key];
        updated = {
          ...updated,
          slides: { ...updated.slides, [key]: { ...slide, imageUrl: data.image_url } },
        };
        setCurrent(updated);
      }
      toast.success('Imagens geradas');
    } finally {
      setGeneratingImageKey(null);
      setGeneratingAllImages(false);
    }
  }

  async function deleteCarousel(id: string) {
    if (!confirm('Excluir este carrossel?')) return;
    const { error } = await db.from('viral_carousels').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
      return;
    }
    toast.success('Carrossel excluido');
    if (current?.id === id) setCurrent(null);
    fetchHistory();
  }

  function loadFromHistory(c: ViralCarousel) {
    setCurrent(c);
    setBriefing(c.briefing);
  }

  function newCarousel() {
    setCurrent(null);
    setBriefing('');
  }

  function copyText(text: string, label = 'Texto') {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  }

  function copyAllSlides() {
    if (!current?.slides) return;
    const slideKeys = Object.keys(current.slides).sort();
    const allText = slideKeys
      .map((k, i) => {
        const s = current.slides[k];
        return `=== SLIDE ${i + 1}: ${s.titulo} ===\n${s.texto}`;
      })
      .join('\n\n');
    const full = `${allText}\n\n=== LEGENDA ===\n${current.caption ?? ''}`;
    navigator.clipboard.writeText(full);
    toast.success('Carrossel completo copiado!');
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Carrossel Viral
          </h1>
          <p className="text-sm text-muted-foreground">
            Gere roteiros de carrossel Instagram com IA: briefing → 3 ganchos → 6 slides + legenda
          </p>
        </div>
        {current && (
          <Button variant="outline" onClick={newCarousel} className="gap-2">
            <Plus className="w-4 h-4" /> Novo carrossel
          </Button>
        )}
      </div>

      {/* Seletor de template + identidade + customizacao — sempre visiveis no topo */}
      <TemplateGallery
        templateId={templateId}
        onSelect={setTemplateId}
        config={config}
        theme={theme}
        sampleSlide={
          current?.slides
            ? current.slides[Object.keys(current.slides).sort()[0]]
            : undefined
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IdentityConfigCard config={config} onChange={setConfig} />
        <TemplateCustomizer theme={theme} onChange={setTheme} />
      </div>
      <AIPromptsPanel prompts={aiPrompts} onChange={setAIPrompts} />
      <VisualStylePanel visualStyle={visualStyle} onChange={setVisualStyle} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ════════════════════════ COLUNA ESQUERDA ════════════════════════ */}
        <div className="lg:col-span-4 space-y-4">
          {/* Briefing Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                Novo Briefing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder={`Ex: 5 erros que toda dentista comete ao precificar consulta\n\nOu cole um trecho de noticia, transcricao de video, ou ideia bruta. Quanto mais contexto, melhor o carrossel.`}
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                rows={6}
                className="bg-background resize-none"
              />
              <Button
                onClick={generateHooks}
                disabled={generatingHooks || briefing.trim().length < 6}
                className="w-full gap-2"
              >
                {generatingHooks ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando ganchos...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar 3 ganchos com IA
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Histórico */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Histórico
                <Badge variant="secondary" className="ml-auto">{history.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                <div className="px-3 pb-3 space-y-2">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Nenhum carrossel gerado ainda
                    </p>
                  ) : (
                    history.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => loadFromHistory(c)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors group ${
                          current?.id === c.id
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-background border-border hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {c.topic || c.briefing.slice(0, 60)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 px-1.5 ${
                                  c.status === 'ready'
                                    ? 'border-green-500/30 text-green-400'
                                    : 'border-amber-500/30 text-amber-400'
                                }`}
                              >
                                {c.status === 'ready' ? 'pronto' : 'rascunho'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCarousel(c.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-400" />
                          </button>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════ COLUNA DIREITA ════════════════════════ */}
        <div className="lg:col-span-8">
          {!current ? (
            // ── Estado vazio ──
            <Card className="bg-card border-border h-full min-h-[500px] flex items-center justify-center">
              <CardContent className="text-center max-w-md py-12">
                <Sparkles className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Pronto pra criar carrosséis virais</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cole um tema, ideia bruta ou trecho de notícia ao lado e clique em "Gerar 3 ganchos com IA".
                  Em segundos você tem 3 opções de gancho pra escolher e o roteiro completo do carrossel.
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-background border border-border rounded-lg p-3">
                    <div className="font-semibold mb-1">1. Briefing</div>
                    <div className="text-muted-foreground">Tema ou ideia</div>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <div className="font-semibold mb-1">2. Gancho</div>
                    <div className="text-muted-foreground">3 opções IA</div>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <div className="font-semibold mb-1">3. Roteiro</div>
                    <div className="text-muted-foreground">6 slides + legenda</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : current.status === 'hooks_generated' && current.selected_hook_index === null ? (
            // ── Estado: escolhendo gancho ──
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary" />
                  Escolha o gancho do Slide 1
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Clique no que mais combina com seu estilo. A IA vai gerar os outros 5 slides em volta dele.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {generatingContent && (
                  <div className="flex items-center justify-center gap-2 py-8 bg-primary/5 border border-primary/20 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm">Gerando os 6 slides + legenda...</span>
                  </div>
                )}

                {!generatingContent &&
                  current.hooks.map((hook) => {
                    const styleInfo = styleLabels[hook.style] || {
                      label: hook.style,
                      color: 'bg-zinc-500/20 text-zinc-300',
                    };
                    return (
                      <button
                        key={hook.id}
                        onClick={() => pickHook(hook.id)}
                        disabled={generatingContent}
                        className="w-full text-left p-4 rounded-lg border border-border bg-background hover:bg-accent/50 hover:border-primary/50 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <Badge variant="outline" className={`text-[10px] ${styleInfo.color}`}>
                            {styleInfo.label}
                          </Badge>
                          <Check className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-sm whitespace-pre-line mb-2">{hook.text}</p>
                        <p className="text-xs text-muted-foreground italic">{hook.angle}</p>
                      </button>
                    );
                  })}
              </CardContent>
            </Card>
          ) : current.status === 'ready' || Object.keys(current.slides).length > 0 ? (
            // ── Estado: carrossel pronto ──
            <div className="space-y-4">
              {/* Toolbar */}
              <Card className="bg-card border-border">
                <CardContent className="py-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-green-500/30 text-green-400">
                    <Check className="w-3 h-3 mr-1" /> Pronto
                  </Badge>
                  <span className="text-sm text-muted-foreground truncate max-w-md">
                    {current.topic || current.briefing.slice(0, 80)}
                  </span>
                  <div className="ml-auto flex gap-2">
                    {current.status !== 'ready' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrent({ ...current, slides: {}, selected_hook_index: null })}
                        className="gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" /> Trocar gancho
                      </Button>
                    )}
                    <Button onClick={copyAllSlides} className="gap-2">
                      <Copy className="w-4 h-4" /> Copiar tudo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="roteiro" className="w-full">
                <TabsList className="bg-card border border-border">
                  <TabsTrigger value="roteiro" className="gap-2">
                    <Type className="w-4 h-4" /> Roteiro
                  </TabsTrigger>
                  <TabsTrigger value="visual" className="gap-2">
                    <ImageIcon className="w-4 h-4" /> Visual
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="roteiro" className="space-y-4 mt-4">
              {/* Slides */}
              {Object.keys(current.slides)
                .sort()
                .map((key, idx) => {
                  const slide = current.slides[key];
                  const isRegen = regeneratingSlide === key;
                  const isGenImg = generatingImageKey === key;
                  return (
                    <Card key={key} className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs flex items-center justify-center font-semibold">
                              {idx + 1}
                            </span>
                            {slide.titulo}
                            {slide.imageUrl && (
                              <Badge
                                variant="outline"
                                className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-400 ml-1"
                              >
                                <ImageIcon className="w-2.5 h-2.5 mr-0.5" /> IA
                              </Badge>
                            )}
                          </CardTitle>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyText(`${slide.titulo}\n\n${slide.texto}`, `Slide ${idx + 1}`)}
                              disabled={isRegen}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {visualStyle.useAI && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => generateImage(key)}
                                disabled={isGenImg || generatingAllImages}
                                title={slide.imageUrl ? 'Regerar imagem IA' : 'Gerar imagem IA'}
                              >
                                {isGenImg ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                ) : (
                                  <Wand2 className={`w-3.5 h-3.5 ${slide.imageUrl ? 'text-emerald-400' : ''}`} />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRegenSlideKey(key)}
                              disabled={isRegen}
                              title="Regerar texto com IA"
                            >
                              {isRegen ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={slide.texto}
                          onChange={(e) => {
                            setCurrent({
                              ...current,
                              slides: {
                                ...current.slides,
                                [key]: { ...slide, texto: e.target.value },
                              },
                            });
                          }}
                          onBlur={async () => {
                            await db
                              .from('viral_carousels')
                              .update({ slides: current.slides })
                              .eq('id', current.id);
                          }}
                          rows={Math.min(8, Math.max(3, slide.texto.split('\n').length))}
                          className="bg-background text-sm whitespace-pre-line resize-none"
                        />
                      </CardContent>
                    </Card>
                  );
                })}

              {/* Legenda */}
              {current.caption && (
                <Card className="bg-card border-border border-primary/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Legenda do post
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(current.caption || '', 'Legenda')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={current.caption}
                      onChange={(e) => setCurrent({ ...current, caption: e.target.value })}
                      onBlur={async () => {
                        await db
                          .from('viral_carousels')
                          .update({ caption: current.caption })
                          .eq('id', current.id);
                      }}
                      rows={6}
                      className="bg-background text-sm resize-none"
                    />
                  </CardContent>
                </Card>
              )}
                </TabsContent>

                <TabsContent value="visual" className="mt-4">
                  <CarouselVisualEditor
                    topic={current.topic || current.briefing.slice(0, 60)}
                    slides={slidesWithPinned}
                    templateId={templateId}
                    config={config}
                    theme={theme}
                    aiEnabled={visualStyle.useAI}
                    generatingImageKey={generatingImageKey}
                    generatingAllImages={generatingAllImages}
                    onGenerateImage={generateImage}
                    onGenerateAllImages={generateAllImages}
                    onEditSlide={(key) => setEditingSlideKey(key)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Dialog: regenerar slide com instrução ── */}
      <Dialog
        open={regenSlideKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRegenSlideKey(null);
            setRegenInstruction('');
          }
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Regerar {regenSlideKey}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Diga em 1 frase o que quer mudar (opcional). Deixe em branco pra IA reescrever do zero.
            </p>
            <Input
              placeholder="Ex: usa um dado mais forte, fica menos coach, cita um caso real"
              value={regenInstruction}
              onChange={(e) => setRegenInstruction(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRegenSlideKey(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => regenerateSlide(regenSlideKey!, regenInstruction)}
                disabled={!!regeneratingSlide}
                className="gap-2"
              >
                {regeneratingSlide ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Regerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Regerar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drawer de edição inline (clique num slide do preview) */}
      <SlideEditDrawer
        open={editingSlideKey !== null}
        onOpenChange={(o) => !o && setEditingSlideKey(null)}
        slideKey={editingSlideKey}
        slideIndex={
          editingSlideKey
            ? Object.keys(slidesWithPinned).sort().indexOf(editingSlideKey)
            : 0
        }
        totalSlides={Object.keys(slidesWithPinned).length}
        initialSlide={editingSlideKey ? slidesWithPinned[editingSlideKey] : undefined}
        onSave={async (key, updated) => {
          await handleSaveEditedSlide(key, updated);
        }}
        onRegenerateImage={
          editingSlideKey && !isPinnedKey(editingSlideKey)
            ? async (key) => {
                await generateImage(key);
              }
            : undefined
        }
        onRegenerateText={
          editingSlideKey && !isPinnedKey(editingSlideKey)
            ? () => {
                if (editingSlideKey) {
                  setRegenSlideKey(editingSlideKey);
                  setEditingSlideKey(null);
                }
              }
            : undefined
        }
        generatingImage={generatingImageKey === editingSlideKey}
        aiEnabled={visualStyle.useAI}
        onPinAsFinal={
          editingSlideKey && !isPinnedKey(editingSlideKey)
            ? (slide) => {
                setPinnedSlide({
                  enabled: true,
                  titulo: slide.titulo,
                  texto: slide.texto,
                });
                toast.success(
                  'Slide fixado! Vai aparecer no final de todos os carrosséis novos.',
                );
                setEditingSlideKey(null);
              }
            : editingSlideKey && isPinnedKey(editingSlideKey)
              ? () => {
                  setPinnedSlide({ ...pinnedSlide, enabled: false });
                  toast.success('Slide fixo desativado');
                  setEditingSlideKey(null);
                }
              : undefined
        }
        isCurrentlyPinned={
          editingSlideKey === '__pinned__' ||
          (!!editingSlideKey &&
            !isPinnedKey(editingSlideKey) &&
            pinnedSlide.enabled &&
            slidesWithPinned[editingSlideKey]?.titulo === pinnedSlide.titulo &&
            slidesWithPinned[editingSlideKey]?.texto === pinnedSlide.texto)
        }
      />
    </div>
  );
}
