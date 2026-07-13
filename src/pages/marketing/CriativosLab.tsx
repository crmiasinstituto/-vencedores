import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, Loader2, Image as ImageIcon, Upload, RefreshCcw,
  CheckCircle2, ExternalLink, Trash2, Download, Layers, UserCircle2,
  RotateCcw, UserCheck, Plus, Save, Pencil, Wand2, BookOpen, Copy, Lightbulb,
} from 'lucide-react';
import CriativoCanvasEditor from '@/components/admin/criativo-editor/CriativoCanvasEditor';
import type { CopyData } from '@/components/admin/criativo-editor/CriativoCanvasEditor';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import carlosDefault from '@/assets/carlos-masterclass.jpg';

type AspectRatio = '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
type Template =
  | '01_expert_cinematico' | '02_editorial_antagonizacao' | '03_metafora_dor'
  | '04_mascote_ilustracao' | '05_expert_em_cena' | '06_stack_beneficios'
  | '07_painel_autoridade' | '08_dado_expert' | '09_nativo_organico'
  | '10_manifesto_textual' | '11_prova_social_visual' | '12_manchete_portal'
  | '13_comparacao';

type FormState = {
  objetivo: string;
  publico_temperatura: 'frio' | 'morno' | 'quente';
  formato: 'feed_1080x1080' | 'stories_1080x1920' | 'reels_1080x1920';
  aspect_ratio: AspectRatio;
  angulo: string;
  promessa_principal: string;
  publico_dor: string;
  mecanismo: string;
  gancho: string;
  expert_no_criativo: boolean;
  expert_descricao: string;
  elementos_obrigatorios: string;
  template_sugerido: Template;
  background_descricao: string;
};

// Configuracao aprovada por Carlos em 21/05/2026 (output b51be1a7 ficou fiel).
// Mantem expert_descricao CIRURGICA pra combater vies racial do Gemini 3 Image
// (modelo tende a clarear pele negra + adicionar barba cheia).
const defaultForm: FormState = {
  objetivo: 'Captacao pra evento presencial em Salvador sobre como ganhar R$5k-15k/mes com IA',
  publico_temperatura: 'quente',
  formato: 'stories_1080x1920',
  aspect_ratio: '9:16',
  angulo: 'Renda real com IA',
  promessa_principal: 'Aprender no evento presencial em Salvador como gerar R$5k a R$15k/mes com IA, mesmo sem programar, em 90 dias',
  publico_dor: 'Vendo gente ganhar dinheiro com IA mas voce ainda nao virou faturamento real. Ja testou ChatGPT mas nao gerou venda',
  mecanismo: 'Encontro presencial em Salvador, hands-on, caminho claro de implementacao',
  gancho: 'Nao e curso de prompt. E como transformar IA em receita real no seu bolso',
  expert_no_criativo: true,
  expert_descricao: 'Carlos Eduardo, homem brasileiro NEGRO (pele marrom escuro, NUNCA clareie a pele, JAMAIS mestico), ~32 anos. Cabelo preto curto bem penteado pra tras. Barba CURTA bem aparada (NAO densa, NAO longa, NAO cheia, quase rapada nas laterais), bigode fino integrado. Sorriso amplo e simpatico. Veste blazer azul marinho elegante, camisa branca, gravata bege/champagne. Bracos cruzados, relogio dourado/marrom no pulso esquerdo. POSE E ROSTO EXATAMENTE como na foto de referencia anexada. NAO invente. REPRODUZA FIELMENTE: tom de pele negro, barba curta aparada, tracos faciais especificos da foto. Olhe atentamente a foto antes de gerar.',
  elementos_obrigatorios: "Badge 'EVENTO PRESENCIAL · SALVADOR' no topo em dourado #3B82F6. Botao CTA 'SAIBA MAIS'. Sem datas no criativo. Estilo executivo premium.",
  template_sugerido: '06_stack_beneficios',
  background_descricao: 'Fundo neutro premium, escuro #050505 com gradiente sutil. Sem cenario especifico.',
};

type Preset = {
  id: string;
  name: string;
  is_default: boolean;
  briefing: FormState;
};

type RefImage = { base64: string; mime: string; preview: string };

type GenerationResult = {
  output_id: string;
  image_base64: string;
  copy: any;
  template: string;
  emocao: string;
  pattern_interruption: string;
  direcao_visual: string;
  briefing: any;
  created_at: string;
};

async function resizeImage(file: File | Blob, maxDim = 1024): Promise<RefImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro lendo arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro carregando imagem'));
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: dataUrl, mime: 'image/jpeg', preview: dataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function urlToBase64(url: string): Promise<RefImage> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return resizeImage(blob);
}

function stripPrefix(b64: string) {
  return b64.includes(',') ? b64.split(',')[1] : b64;
}

function rowToResult(row: any): GenerationResult {
  const r = row.resultado ?? {};
  return {
    output_id: row.id,
    image_base64: r.image_base64 ?? '',
    copy: r.copy_criativo ?? {},
    template: r.template ?? '?',
    emocao: r.emocao ?? '?',
    pattern_interruption: r.pattern_interruption ?? '',
    direcao_visual: r.direcao_visual ?? '',
    briefing: row.briefing ?? {},
    created_at: row.created_at ?? '',
  };
}

function ReferenceCard({
  label,
  hint,
  icon: Icon,
  image,
  onUpload,
  onRemove,
  acceptDefault,
  extraSlot,
}: {
  label: string;
  hint: string;
  icon: any;
  image: RefImage | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  acceptDefault?: () => void;
  extraSlot?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) onUpload(file);
    else if (file) toast.error('Arquivo precisa ser imagem');
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) {
        onUpload(file);
        e.preventDefault();
      }
    }
  };

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      className={cn(
        'transition-all',
        dragOver && 'ring-2 ring-primary bg-primary/5',
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </span>
          {image && (
            <Button size="sm" variant="ghost" onClick={onRemove} className="h-6 w-6 p-0">
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {image?.preview ? (
          <div className="rounded-md border overflow-hidden bg-muted">
            <img src={image.preview} alt={label} className="w-full max-h-48 object-contain" />
          </div>
        ) : (
          <div className={cn(
            'rounded-md border border-dashed h-32 flex flex-col items-center justify-center text-xs gap-2 p-3 text-center transition-colors',
            dragOver ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
          )}>
            <ImageIcon className="h-5 w-5" />
            <span>{dragOver ? 'Solta aqui' : hint}</span>
            <span className="opacity-60">arrasta, cola (Ctrl+V), ou clica abaixo</span>
            {acceptDefault && (
              <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={acceptDefault}>
                Usar foto padrao
              </Button>
            )}
          </div>
        )}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
            <Upload className="h-3 w-3 mr-1.5" /> {image ? 'Trocar' : 'Subir'} imagem
          </Button>
        </div>
        {extraSlot}
      </CardContent>
    </Card>
  );
}

export default function CriativosLab() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [expertPhoto, setExpertPhoto] = useState<RefImage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [selected, setSelected] = useState<GenerationResult | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [analyzingExpert, setAnalyzingExpert] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [externalEditorOpen, setExternalEditorOpen] = useState(false);
  const [externalImage, setExternalImage] = useState<{ base64: string; ratio: string } | null>(null);
  const [refining, setRefining] = useState(false);

  // Variacoes em lote de card estatico (reusa o briefing atual)
  const [batchGenerating, setBatchGenerating] = useState(false);
  // Playbook de criativo (IA Estrategista, Claude Sonnet via marketing-midia)
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [playbookBrief, setPlaybookBrief] = useState({ produto: '', cidade: '', publico: '', verba_dia: '', ticket: '', contexto: '' });
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false);
  const [playbook, setPlaybook] = useState<any>(null);

  // Carrega foto padrao + historico + presets do banco
  useEffect(() => {
    (async () => {
      try {
        const photo = await urlToBase64(carlosDefault);
        setExpertPhoto(photo);
      } catch (e) {
        console.warn('Falha carregando foto default', e);
      }
    })();
    loadHistory();
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const { data, error } = await supabase
      .from('marketing_briefing_presets' as any)
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro carregando presets', error);
      return;
    }

    if (!data || data.length === 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('marketing_briefing_presets' as any)
        .insert({ name: 'Evento Salvador', is_default: true, briefing: defaultForm })
        .select()
        .single();

      if (insertErr) {
        console.error('Erro criando preset padrao', insertErr);
        return;
      }
      const p: Preset = { id: inserted.id, name: inserted.name, is_default: true, briefing: inserted.briefing as FormState };
      setPresets([p]);
      setActivePresetId(p.id);
      return;
    }

    const mapped: Preset[] = (data as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      is_default: row.is_default,
      briefing: row.briefing as FormState,
    }));
    setPresets(mapped);
    setActivePresetId((prev) => {
      if (prev && mapped.find((p) => p.id === prev)) return prev;
      const first = mapped[0];
      setForm(first.briefing);
      return first.id;
    });
  };

  const switchPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    setForm(preset.briefing);
  };

  const savePreset = async () => {
    if (!activePresetId) return;
    setSavingPreset(true);
    try {
      const { error } = await supabase
        .from('marketing_briefing_presets' as any)
        .update({ briefing: form as any, updated_at: new Date().toISOString() })
        .eq('id', activePresetId);

      if (error) { toast.error('Erro salvando: ' + error.message); return; }
      setPresets((prev) => prev.map((p) =>
        p.id === activePresetId ? { ...p, briefing: { ...form } } : p
      ));
      toast.success('Preset salvo');
    } finally {
      setSavingPreset(false);
    }
  };

  const createPreset = async () => {
    const name = newPresetName.trim();
    if (!name) { toast.error('Da um nome pro preset'); return; }

    const emptyBriefing: FormState = {
      ...defaultForm,
      objetivo: '',
      angulo: '',
      promessa_principal: '',
      publico_dor: '',
      mecanismo: '',
      gancho: '',
      elementos_obrigatorios: '',
      background_descricao: '',
    };

    const { data, error } = await supabase
      .from('marketing_briefing_presets' as any)
      .insert({ name, is_default: false, briefing: emptyBriefing })
      .select()
      .single();

    if (error) { toast.error('Erro criando preset: ' + error.message); return; }

    const preset: Preset = {
      id: data.id, name: data.name, is_default: false,
      briefing: data.briefing as FormState,
    };
    setPresets((prev) => [...prev, preset]);
    setActivePresetId(preset.id);
    setForm(preset.briefing);
    setNewPresetName('');
    setShowNewPreset(false);
    toast.success(`Preset "${name}" criado. Preencha os campos e clique em Salvar.`);
  };

  const deletePreset = async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset || preset.is_default) return;
    if (!confirm(`Apagar preset "${preset.name}"? Acao nao reversivel.`)) return;

    const { error } = await supabase
      .from('marketing_briefing_presets' as any)
      .delete()
      .eq('id', presetId);

    if (error) { toast.error('Erro apagando: ' + error.message); return; }
    const remaining = presets.filter((p) => p.id !== presetId);
    setPresets(remaining);
    if (activePresetId === presetId && remaining.length > 0) {
      switchPreset(remaining[0].id);
    }
    toast.success('Preset apagado');
  };

  const PAGE_SIZE = 8;

  const loadHistory = async (append = false) => {
    setLoadingHistory(true);
    try {
      const offset = append ? history.length : 0;
      const { data, error } = await supabase
        .from('marketing_ai_outputs')
        .select('id, briefing, resultado, created_at')
        .eq('agent', 'criativo')
        .eq('tipo', 'brief_imagem')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        toast.error('Erro lendo historico: ' + error.message);
        return;
      }
      const results = (data ?? [])
        .map(rowToResult)
        .filter((r) => r.image_base64);
      setHistory((prev) => append ? [...prev, ...results] : results);
      setHasMore((data ?? []).length >= PAGE_SIZE);
    } finally {
      setLoadingHistory(false);
    }
  };

  const updateFormato = (formato: FormState['formato']) => {
    const aspect: AspectRatio =
      formato === 'feed_1080x1080' ? '1:1' :
      formato === 'stories_1080x1920' || formato === 'reels_1080x1920' ? '9:16' : '1:1';
    setForm((f) => ({ ...f, formato, aspect_ratio: aspect }));
  };

  const handleUploadExpert = async (file: File) => {
    try {
      const r = await resizeImage(file);
      setExpertPhoto(r);
      setForm((f) => ({ ...f, expert_descricao: '' }));
      toast.success('Foto carregada, analisando expert...');
      await analyzeExpertAuto(r);
    } catch (e: any) { toast.error(e.message); }
  };

  const analyzeExpertAuto = async (photo: RefImage) => {
    setAnalyzingExpert(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-criativo', {
        body: {
          action: 'analyze_expert',
          image_base64: stripPrefix(photo.base64),
          image_mime: photo.mime,
        },
      });
      if (error || !data?.success) {
        toast.error('Falha analisando expert. Preencha a descricao manualmente.');
        return;
      }
      const desc = data.description;
      if (desc) {
        setForm((f) => ({ ...f, expert_descricao: desc }));
        toast.success('Expert descrito automaticamente');
      }
    } catch {
      toast.error('Falha analisando expert. Preencha a descricao manualmente.');
    } finally {
      setAnalyzingExpert(false);
    }
  };

  const useDefaultExpert = async () => {
    try {
      const photo = await urlToBase64(carlosDefault);
      setExpertPhoto(photo);
      setForm((f) => ({ ...f, expert_descricao: '' }));
      await analyzeExpertAuto(photo);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // ATENCAO: o backend espera o campo `data` (nao `base64`). Type ReferenceImage
      // em marketing-criativo/index.ts: { mimeType: string; data: string; label?: string }
      const reference_images: Array<{ data: string; mimeType: string; label: string }> = [];
      if (expertPhoto) {
        reference_images.push({
          data: stripPrefix(expertPhoto.base64),
          mimeType: expertPhoto.mime,
          label: 'Foto do expert. USE EXATAMENTE este rosto, fisionomia, cabelo e barba. Nao invente outra pessoa.',
        });
      }
      const payload: any = {
        action: 'generate',
        tipo: 'brief_imagem',
        auto_generate_image: true,
        aspect_ratio: form.aspect_ratio,
        briefing: { ...form },
        reference_images,
        // Modo simples: manda apenas o prompt cru + foto inline (igual versao inicial).
        // Sem mood_visual, sem preserve_identity, sem style_analysis no prompt final.
        simple_mode: true,
      };

      const { data, error } = await supabase.functions.invoke('marketing-criativo', { body: payload });
      if (error) { toast.error('Erro: ' + error.message); return; }
      if (!data?.success) { toast.error(data?.error ?? 'Falha'); return; }

      const r = data.resultado ?? {};
      if (!r.image_base64) {
        toast.error('Brief gerado mas imagem falhou (cheque a chave Gemini)');
        return;
      }
      const result: GenerationResult = {
        output_id: data.output_id,
        image_base64: r.image_base64,
        copy: r.copy_criativo ?? {},
        template: r.template ?? '?',
        emocao: r.emocao ?? '?',
        pattern_interruption: r.pattern_interruption ?? '',
        direcao_visual: r.direcao_visual ?? '',
        briefing: { ...form },
        created_at: new Date().toISOString(),
      };
      setHistory((h) => [result, ...h].slice(0, 50));
      setSelected(result);
      toast.success('Criativo gerado');
    } finally {
      setGenerating(false);
    }
  };

  // Gera N variacoes de card estatico de uma vez, reusando o briefing atual.
  // Cada chamada salva no banco e entra no historico (a IA varia template/mood/copy).
  const handleGenerateVariations = async (n = 3) => {
    setBatchGenerating(true);
    try {
      const reference_images: Array<{ data: string; mimeType: string; label: string }> = [];
      if (expertPhoto) {
        reference_images.push({
          data: stripPrefix(expertPhoto.base64),
          mimeType: expertPhoto.mime,
          label: 'Foto do expert. USE EXATAMENTE este rosto, fisionomia, cabelo e barba. Nao invente outra pessoa.',
        });
      }
      const payload: any = {
        action: 'generate',
        tipo: 'brief_imagem',
        auto_generate_image: true,
        aspect_ratio: form.aspect_ratio,
        briefing: { ...form },
        reference_images,
        simple_mode: true,
      };
      let ok = 0;
      for (let i = 0; i < n; i++) {
        const { data, error } = await supabase.functions.invoke('marketing-criativo', { body: payload });
        if (error || !data?.success) {
          toast.error(`Variacao ${i + 1} falhou: ${error?.message ?? data?.error ?? 'erro'}`);
          continue;
        }
        const r = data.resultado ?? {};
        if (!r.image_base64) { toast.error(`Variacao ${i + 1}: imagem falhou`); continue; }
        const result: GenerationResult = {
          output_id: data.output_id,
          image_base64: r.image_base64,
          copy: r.copy_criativo ?? {},
          template: r.template ?? '?',
          emocao: r.emocao ?? '?',
          pattern_interruption: r.pattern_interruption ?? '',
          direcao_visual: r.direcao_visual ?? '',
          briefing: { ...form },
          created_at: new Date().toISOString(),
        };
        setHistory((h) => [result, ...h].slice(0, 50));
        if (i === 0) setSelected(result);
        ok++;
        toast.success(`Variacao ${ok}/${n} gerada`);
      }
    } finally {
      setBatchGenerating(false);
    }
  };

  // Gera o Playbook de criativo (posicionamento, conceitos, copy, headlines, roteiros, checklist)
  const handleGeneratePlaybook = async () => {
    setGeneratingPlaybook(true);
    setPlaybook(null);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-midia', {
        body: { action: 'estrategista', brief: playbookBrief },
      });
      if (error || !data?.success) {
        toast.error('Erro ao gerar playbook: ' + (error?.message ?? data?.error ?? 'desconhecido'));
        return;
      }
      setPlaybook(data.plano);
      toast.success('Playbook gerado. Use como guia pra produzir os criativos.');
    } finally {
      setGeneratingPlaybook(false);
    }
  };

  const copyText = (t: string) => {
    navigator.clipboard?.writeText(t).then(
      () => toast.success('Copiado'),
      () => toast.error('Nao consegui copiar'),
    );
  };

  const handleRefine = async () => {
    if (!selected) return;
    setRefining(true);
    try {
      const payload: any = {
        action: 'refine',
        output_id: selected.output_id,
        aspect_ratio: selected.briefing?.aspect_ratio || form.aspect_ratio,
        copy_criativo: selected.copy,
      };

      const { data, error } = await supabase.functions.invoke('marketing-criativo', { body: payload });
      if (error) { toast.error('Erro: ' + error.message); return; }
      if (!data?.success) { toast.error(data?.error ?? 'Falha no refinamento'); return; }

      if (!data.image_base64) {
        toast.error('Refinamento falhou (sem imagem retornada)');
        return;
      }

      const updated: GenerationResult = {
        ...selected,
        image_base64: data.image_base64,
      };
      setSelected(updated);
      setHistory((h) => h.map((r) => (r.output_id === selected.output_id ? updated : r)));
      toast.success('Criativo refinado com sucesso');
    } finally {
      setRefining(false);
    }
  };

  const handleDelete = async (output_id: string) => {
    if (!confirm('Apagar esse criativo do historico? Acao nao reversivel.')) return;
    setDeletingId(output_id);
    try {
      const { error } = await supabase
        .from('marketing_ai_outputs')
        .delete()
        .eq('id', output_id);
      if (error) {
        toast.error('Erro apagando: ' + error.message);
        return;
      }
      setHistory((h) => h.filter((r) => r.output_id !== output_id));
      if (selected?.output_id === output_id) setSelected(null);
      toast.success('Apagado');
    } finally {
      setDeletingId(null);
    }
  };

  // Reusa briefing OU foto OU ambos (pra repetir geracao com o mesmo padrao)
  const applyForm = (r: GenerationResult) => {
    if (!r.briefing) return;
    setForm((f) => {
      const next = { ...f };
      const allowed: (keyof FormState)[] = [
        'objetivo', 'publico_temperatura', 'formato', 'aspect_ratio', 'angulo',
        'promessa_principal', 'publico_dor', 'mecanismo', 'gancho',
        'expert_no_criativo', 'expert_descricao', 'elementos_obrigatorios',
        'template_sugerido', 'background_descricao',
      ];
      for (const k of allowed) {
        if (r.briefing[k] !== undefined) (next as any)[k] = r.briefing[k];
      }
      return next;
    });
  };

  const applyExpertRef = async (r: GenerationResult) => {
    if (!r.image_base64) return;
    const resp = await fetch(r.image_base64);
    const blob = await resp.blob();
    const resized = await resizeImage(blob);
    setExpertPhoto(resized);
    analyzeExpertAuto(resized).catch(() => {});
  };

  // Acao combinada (recomendada): carrega briefing + define imagem como ref do expert
  const reuseAll = async (r: GenerationResult) => {
    if (!r.briefing && !r.image_base64) {
      toast.error('Sem dados pra reusar');
      return;
    }
    try {
      applyForm(r);
      if (r.image_base64) await applyExpertRef(r);
      toast.success('Briefing + foto carregados. Agora clica em "Gerar variacao" la embaixo.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  // Acoes granulares (caso queira so uma)
  const reuseBriefing = (r: GenerationResult) => {
    applyForm(r);
    toast.success('Briefing carregado.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const useAsExpertRef = async (r: GenerationResult) => {
    if (!r.image_base64) return;
    try {
      await applyExpertRef(r);
      toast.success('Imagem definida como referencia do expert.');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleUploadExternal = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          let aspect = '9:16';
          if (ratio > 1.2) aspect = '16:9';
          else if (ratio > 0.85) aspect = '1:1';
          else aspect = '9:16';
          setExternalImage({ base64: reader.result as string, ratio: aspect });
          setExternalEditorOpen(true);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleExternalSave = (newBase64: string) => {
    const a = document.createElement('a');
    a.href = newBase64;
    a.download = `criativo-editado-${Date.now()}.png`;
    a.click();
    toast.success('Criativo editado exportado');
  };

  const handleEditorSave = (newBase64: string) => {
    if (!selected) return;
    const updated = { ...selected, image_base64: newBase64 };
    setSelected(updated);
    setHistory((h) => h.map((r) => (r.output_id === selected.output_id ? updated : r)));
  };

  const downloadImage = (r: GenerationResult) => {
    const a = document.createElement('a');
    a.href = r.image_base64;
    const safeTemplate = r.template.replace(/[^a-z0-9_]/gi, '');
    a.download = `criativo-${safeTemplate}-${r.created_at.slice(0, 19).replace(/[:-]/g, '')}.png`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Laboratorio de Criativos</h1>
            <p className="text-sm text-muted-foreground">
              Ajuste briefing, suba foto e card de inspiracao, gera quantas vezes precisar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleUploadExternal}>
            <Pencil className="mr-2 h-3 w-3" /> Editar imagem externa
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/marketing/midia/nova-campanha">
              Nova campanha com criativo <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* PLAYBOOK DE CRIATIVO (IA Estrategista, Claude Sonnet) */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Playbook de Criativo (IA Estrategista)
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowPlaybook((v) => !v)}>
            {showPlaybook ? 'Fechar' : 'Abrir playbook'}
          </Button>
        </CardHeader>
        {showPlaybook && (
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              A IA monta a grande ideia, os 5 conceitos de criativo (do frio ao quente), copy pronta, headlines, roteiros cena a cena e checklist de producao. Use como guia enquanto produz os cards e videos.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label>Produto / evento</Label><Input value={playbookBrief.produto} onChange={(e) => setPlaybookBrief((b) => ({ ...b, produto: e.target.value }))} placeholder="Masterclass IA para Negocios" /></div>
              <div><Label>Cidade / regiao</Label><Input value={playbookBrief.cidade} onChange={(e) => setPlaybookBrief((b) => ({ ...b, cidade: e.target.value }))} placeholder="Feira de Santana" /></div>
              <div><Label>Publico</Label><Input value={playbookBrief.publico} onChange={(e) => setPlaybookBrief((b) => ({ ...b, publico: e.target.value }))} placeholder="empresarios 28+, acima de 30k/mes" /></div>
              <div><Label>Verba/dia (R$)</Label><Input value={playbookBrief.verba_dia} onChange={(e) => setPlaybookBrief((b) => ({ ...b, verba_dia: e.target.value }))} placeholder="30" /></div>
              <div><Label>Ticket (R$)</Label><Input value={playbookBrief.ticket} onChange={(e) => setPlaybookBrief((b) => ({ ...b, ticket: e.target.value }))} placeholder="47" /></div>
              <div className="md:col-span-3"><Label>Contexto extra</Label><Textarea rows={2} value={playbookBrief.contexto} onChange={(e) => setPlaybookBrief((b) => ({ ...b, contexto: e.target.value }))} placeholder="material de podcast com autoridades, prova social, urgencia de vagas..." /></div>
            </div>
            <Button onClick={handleGeneratePlaybook} disabled={generatingPlaybook || !playbookBrief.produto}>
              {generatingPlaybook ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando playbook...</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-2" />Gerar playbook com IA</>
              )}
            </Button>

            {playbook && (
              <div className="space-y-4 rounded-md border bg-background p-4 text-sm">
                {playbook.posicionamento && (
                  <div>
                    <p className="font-semibold text-primary flex items-center gap-1"><Lightbulb className="h-4 w-4" /> A grande ideia</p>
                    <p className="text-muted-foreground mt-1">{playbook.posicionamento}</p>
                  </div>
                )}
                {playbook.aviso_compliance && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs">
                    <strong>Aviso de compliance:</strong> {playbook.aviso_compliance}
                  </div>
                )}
                {Array.isArray(playbook.conceitos) && playbook.conceitos.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold">Conceitos de criativo</p>
                    {playbook.conceitos.map((c: any, i: number) => (
                      <div key={i} className="rounded border p-3">
                        <p className="font-medium text-xs flex items-center gap-2">
                          {c.nome}
                          {c.campanha && <Badge variant="outline" className="text-[10px]">{c.campanha}</Badge>}
                          {c.formato && <span className="text-muted-foreground">{c.formato}</span>}
                        </p>
                        {c.gancho && <p className="text-xs mt-1"><span className="text-muted-foreground">Gancho:</span> {c.gancho}</p>}
                        {Array.isArray(c.estrutura) && (
                          <ul className="text-xs text-muted-foreground list-disc ml-4 mt-1">
                            {c.estrutura.map((b: string, bi: number) => <li key={bi}>{b}</li>)}
                          </ul>
                        )}
                        {c.objetivo && <p className="text-[11px] text-muted-foreground mt-1 italic">{c.objetivo}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(playbook.creatives) && playbook.creatives.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold">Copy pronta</p>
                    {playbook.creatives.map((cr: any, i: number) => (
                      <div key={i} className="rounded border p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs">{cr.primary_text}</p>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copyText(cr.primary_text)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {cr.headline && <p className="text-xs"><span className="text-muted-foreground">Headline:</span> <strong>{cr.headline}</strong></p>}
                        {cr.cta_button && <Badge variant="secondary" className="text-[10px]">{cr.cta_button}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(playbook.headlines) && playbook.headlines.length > 0 && (
                  <div>
                    <p className="font-semibold">Headlines alternativas</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {playbook.headlines.map((h: string, i: number) => (
                        <button key={i} onClick={() => copyText(h)} className="text-xs rounded-full border px-3 py-1 hover:bg-muted" title="Copiar">
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(playbook.roteiros) && playbook.roteiros.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold">Roteiros cena a cena</p>
                    {playbook.roteiros.map((r: any, ri: number) => (
                      <div key={ri} className="rounded border p-3">
                        <p className="font-medium text-xs">{r.titulo} {r.campanha ? `· ${r.campanha}` : ''} {r.duracao_seg ? `· ${r.duracao_seg}s` : ''}</p>
                        <div className="mt-2 space-y-1">
                          {(r.cenas ?? []).map((c: any, ci: number) => (
                            <div key={ci} className="grid grid-cols-[60px_1fr] gap-2 text-xs border-t pt-1">
                              <span className="text-muted-foreground">{c.tempo}</span>
                              <span><span className="font-medium">{c.texto_tela}</span>{c.fala ? <span className="text-muted-foreground">: {c.fala}</span> : null}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(playbook.checklist_producao) && playbook.checklist_producao.length > 0 && (
                  <div>
                    <p className="font-semibold">Checklist de producao</p>
                    <ul className="text-xs text-muted-foreground list-disc ml-4 mt-1">
                      {playbook.checklist_producao.map((c: string, i: number) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {playbook.observacoes && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs">
                    <strong>Observacoes:</strong> {playbook.observacoes}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUNA ESQUERDA: form + referencias */}
        <div className="space-y-6">
          {/* PRESET SELECTOR */}
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center">
                <Button
                  size="sm"
                  variant={activePresetId === preset.id ? 'default' : 'outline'}
                  onClick={() => switchPreset(preset.id)}
                  className={cn('h-8', !preset.is_default && 'rounded-r-none')}
                >
                  {preset.name}
                  {preset.is_default && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">Fixo</Badge>
                  )}
                </Button>
                {!preset.is_default && (
                  <Button
                    size="sm"
                    variant={activePresetId === preset.id ? 'default' : 'outline'}
                    onClick={() => deletePreset(preset.id)}
                    className="h-8 px-1.5 rounded-l-none border-l-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {showNewPreset ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Nome da ideia..."
                  className="h-8 w-44 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && createPreset()}
                  autoFocus
                />
                <Button size="sm" onClick={createPreset} className="h-8 px-3">OK</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNewPreset(false); setNewPresetName(''); }} className="h-8 px-2">
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewPreset(true)}
                className="h-8 border-dashed"
              >
                <Plus className="h-3 w-3 mr-1" /> Nova ideia
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Briefing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Temperatura</Label>
                  <Select value={form.publico_temperatura} onValueChange={(v) => setForm((f) => ({ ...f, publico_temperatura: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frio">Frio (60-70% budget)</SelectItem>
                      <SelectItem value="morno">Morno (20-25%)</SelectItem>
                      <SelectItem value="quente">Quente (10-15%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formato</Label>
                  <Select value={form.formato} onValueChange={(v) => updateFormato(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed_1080x1080">Feed 1:1 (1080x1080)</SelectItem>
                      <SelectItem value="stories_1080x1920">Stories 9:16 (1080x1920)</SelectItem>
                      <SelectItem value="reels_1080x1920">Reels 9:16</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Template visual</Label>
                <Select value={form.template_sugerido} onValueChange={(v) => setForm((f) => ({ ...f, template_sugerido: v as Template }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01_expert_cinematico">01 Expert Cinematico (morno/quente)</SelectItem>
                    <SelectItem value="02_editorial_antagonizacao">02 Editorial Antagonizacao (frio)</SelectItem>
                    <SelectItem value="03_metafora_dor">03 Metafora de Dor (frio/morno)</SelectItem>
                    <SelectItem value="04_mascote_ilustracao">04 Mascote / Ilustracao (frio)</SelectItem>
                    <SelectItem value="05_expert_em_cena">05 Expert em Cena (morno)</SelectItem>
                    <SelectItem value="06_stack_beneficios">06 Stack de Beneficios (morno/quente)</SelectItem>
                    <SelectItem value="07_painel_autoridade">07 Painel de Autoridade (morno)</SelectItem>
                    <SelectItem value="08_dado_expert">08 Dado + Expert (morno/quente)</SelectItem>
                    <SelectItem value="09_nativo_organico">09 Nativo Organico (frio)</SelectItem>
                    <SelectItem value="10_manifesto_textual">10 Manifesto Textual (frio/morno)</SelectItem>
                    <SelectItem value="11_prova_social_visual">11 Prova Social Visual (morno/quente)</SelectItem>
                    <SelectItem value="12_manchete_portal">12 Manchete Portal (frio)</SelectItem>
                    <SelectItem value="13_comparacao">13 Comparacao (frio/morno)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Angulo</Label>
                <Input value={form.angulo} onChange={(e) => setForm((f) => ({ ...f, angulo: e.target.value }))} />
              </div>
              <div>
                <Label>Promessa principal</Label>
                <Textarea rows={2} value={form.promessa_principal} onChange={(e) => setForm((f) => ({ ...f, promessa_principal: e.target.value }))} />
              </div>
              <div>
                <Label>Dor do publico</Label>
                <Textarea rows={2} value={form.publico_dor} onChange={(e) => setForm((f) => ({ ...f, publico_dor: e.target.value }))} />
              </div>
              <div>
                <Label>Mecanismo / diferencial</Label>
                <Textarea rows={2} value={form.mecanismo} onChange={(e) => setForm((f) => ({ ...f, mecanismo: e.target.value }))} />
              </div>
              <div>
                <Label>Gancho de copy</Label>
                <Input value={form.gancho} onChange={(e) => setForm((f) => ({ ...f, gancho: e.target.value }))} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar expert no criativo?</Label>
                  <p className="text-xs text-muted-foreground">Frio: false. Morno/quente: true</p>
                </div>
                <Switch checked={form.expert_no_criativo} onCheckedChange={(v) => setForm((f) => ({ ...f, expert_no_criativo: v }))} />
              </div>
              {form.expert_no_criativo && (
                <div>
                  <Label className="flex items-center gap-2">
                    Descricao do expert (pro Gemini)
                    {analyzingExpert && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  </Label>
                  <Textarea rows={3} value={form.expert_descricao} onChange={(e) => setForm((f) => ({ ...f, expert_descricao: e.target.value }))} placeholder={analyzingExpert ? 'Analisando foto do expert...' : ''} />
                </div>
              )}
              <div>
                <Label>Elementos obrigatorios no design</Label>
                <Textarea rows={3} value={form.elementos_obrigatorios} onChange={(e) => setForm((f) => ({ ...f, elementos_obrigatorios: e.target.value }))} />
              </div>

              <div>
                <Label>Cenario / fundo desejado</Label>
                <Textarea
                  rows={3}
                  value={form.background_descricao}
                  onChange={(e) => setForm((f) => ({ ...f, background_descricao: e.target.value }))}
                  placeholder="Ex: escritorio moderno com janelas grandes, ambiente corporativo iluminacao natural, mesa de reuniao ao fundo desfocada"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Onde o expert vai aparecer. Coloque algo coerente com a proposta (escritorio, palco, estudio, sala de reuniao, etc).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FOTO DO EXPERT (unica referencia) */}
          <ReferenceCard
            label="Foto do expert"
            hint="Foto sua que vai parar no criativo (rosto, postura, blazer)"
            icon={UserCircle2}
            image={expertPhoto}
            onUpload={handleUploadExpert}
            onRemove={() => setExpertPhoto(null)}
            acceptDefault={useDefaultExpert}
          />

          <div className="space-y-2">
            <Button
              onClick={savePreset}
              disabled={savingPreset || !activePresetId}
              variant="outline"
              className="w-full"
            >
              {savingPreset ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Salvar preset</>
              )}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || analyzingExpert}
              size="lg"
              className="w-full"
            >
              {analyzingExpert ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando expert...</>
              ) : generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando ~60-120s...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Gerar criativo</>
              )}
            </Button>
            <Button
              onClick={() => handleGenerateVariations(3)}
              disabled={batchGenerating || generating || analyzingExpert}
              variant="outline"
              className="w-full"
            >
              {batchGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando variacoes...</>
              ) : (
                <><Layers className="h-4 w-4 mr-2" />Gerar 3 variacoes deste briefing</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Variacoes reusam o briefing atual. A IA varia template, clima e copy. Cada uma entra no historico.
            </p>

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-2">
                Ver briefing que sera enviado (debug)
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto text-[10px] leading-relaxed border">
                {JSON.stringify(form, null, 2)}
              </pre>
              <p className="text-muted-foreground mt-1">
                Esse JSON e enviado ao backend a cada clique em Gerar. Se algum valor ainda aparecer no criativo errado, edite o campo correspondente acima.
              </p>
            </details>
          </div>
        </div>

        {/* COLUNA DIREITA: resultado + historico */}
        <div className="space-y-4">
          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Resultado
                  </span>
                  <div className="flex gap-1.5">
                    <Badge variant="outline">{selected.template}</Badge>
                    {selected.briefing?.aspect_ratio && (
                      <Badge variant="outline">{selected.briefing.aspect_ratio}</Badge>
                    )}
                    {selected.emocao !== '?' && <Badge variant="outline">{selected.emocao}</Badge>}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border overflow-hidden bg-black">
                  <img src={selected.image_base64} alt="criativo" className="w-full" />
                </div>
                <div className="space-y-2 text-sm">
                  {selected.copy?.badge && <div><strong>Badge:</strong> {selected.copy.badge}</div>}
                  {selected.copy?.headline && (
                    <div>
                      <strong>Headline:</strong> {selected.copy.headline}{' '}
                      <span className="text-primary">{selected.copy.headline_destaque}</span>
                    </div>
                  )}
                  {selected.copy?.suporte && <div><strong>Suporte:</strong> {selected.copy.suporte}</div>}
                  {selected.copy?.cta && <div><strong>CTA:</strong> <code className="text-xs">{selected.copy.cta}</code></div>}
                </div>
                {selected.pattern_interruption && (
                  <div className="text-xs text-muted-foreground border-l-2 border-primary/50 pl-3">
                    <strong>Pattern interruption:</strong> {selected.pattern_interruption}
                  </div>
                )}
                <div className="space-y-2">
                  <Button size="sm" onClick={() => setEditorOpen(true)} variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10">
                    <Pencil className="h-3 w-3 mr-1.5" /> Editar no Canvas
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRefine}
                    disabled={refining || generating}
                    variant="outline"
                    className="w-full border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                  >
                    {refining ? (
                      <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Refinando ~60-120s...</>
                    ) : (
                      <><Wand2 className="h-3 w-3 mr-1.5" /> Refinar (diretor de arte)</>
                    )}
                  </Button>
                  <Button size="sm" onClick={() => reuseAll(selected)} className="w-full">
                    <RotateCcw className="h-3 w-3 mr-1.5" /> Reusar este criativo (briefing + foto do expert)
                  </Button>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => reuseBriefing(selected)}>
                      Só briefing
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => useAsExpertRef(selected)}>
                      <UserCheck className="h-3 w-3 mr-1.5" /> Só foto
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadImage(selected)}>
                      <Download className="h-3 w-3 mr-1.5" /> Download
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating || analyzingExpert}>
                      <RefreshCcw className="h-3 w-3 mr-1.5" /> Gerar variacao
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(selected.output_id)} disabled={deletingId === selected.output_id}>
                      {deletingId === selected.output_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <><Trash2 className="h-3 w-3 mr-1.5 text-red-500" /> Apagar</>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  <code>{selected.output_id}</code>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center text-muted-foreground space-y-2">
                <Sparkles className="h-12 w-12 mx-auto opacity-30" />
                <p>Selecione um do historico ou gera um novo.</p>
                <p className="text-xs">Cada geracao leva ~60-120s no Gemini Image Preview.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Historico {loadingHistory ? '...' : `(${history.length})`}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={loadHistory} disabled={loadingHistory}>
                <RefreshCcw className={cn('h-3 w-3', loadingHistory && 'animate-spin')} />
              </Button>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Nada gerado ainda nesse projeto.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {history.map((r) => (
                      <div key={r.output_id} className="relative group">
                        <button
                          onClick={() => setSelected(r)}
                          className={cn(
                            'block w-full rounded-md border overflow-hidden hover:ring-2 hover:ring-primary transition-all',
                            selected?.output_id === r.output_id && 'ring-2 ring-primary',
                          )}
                        >
                          <img src={r.image_base64} alt={r.template} className="w-full aspect-square object-cover" loading="lazy" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(r.output_id); }}
                          disabled={deletingId === r.output_id}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Apagar"
                        >
                          {deletingId === r.output_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <button
                      onClick={() => loadHistory(true)}
                      disabled={loadingHistory}
                      className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-lg hover:border-primary/40 transition-colors"
                    >
                      {loadingHistory ? 'Carregando...' : 'Carregar mais criativos'}
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selected && (
        <CriativoCanvasEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          imageBase64={selected.image_base64}
          aspectRatio={selected.briefing?.aspect_ratio || '9:16'}
          copyData={selected.copy as CopyData}
          onSave={handleEditorSave}
        />
      )}

      {externalImage && (
        <CriativoCanvasEditor
          open={externalEditorOpen}
          onClose={() => { setExternalEditorOpen(false); setExternalImage(null); }}
          imageBase64={externalImage.base64}
          aspectRatio={externalImage.ratio}
          onSave={handleExternalSave}
        />
      )}
    </div>
  );
}
