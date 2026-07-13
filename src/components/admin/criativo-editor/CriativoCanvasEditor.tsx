import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Canvas as FabricCanvas, Textbox, Rect, Circle, FabricImage,
} from 'fabric';
import type { FabricObject } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Type, Square, Circle as CircleIcon, Upload, Download, Trash2, Copy,
  ChevronUp, ChevronDown, Bold, Italic, Underline, AlignLeft, AlignCenter,
  AlignRight, X, Paintbrush, Save, Loader2, Crop, Eraser,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const FONTS = [
  'Inter', 'Montserrat', 'Poppins', 'Bebas Neue', 'Oswald',
  'Playfair Display', 'Roboto Condensed', 'Raleway', 'Open Sans',
  'Lato', 'Nunito', 'Anton', 'Archivo Black', 'Arial', 'Georgia',
];

const SIZES: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '4:3': { w: 1080, h: 810 },
  '3:4': { w: 810, h: 1080 },
};

export type CopyData = {
  badge?: string;
  headline?: string;
  headline_destaque?: string;
  suporte?: string;
  cta?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  imageBase64: string;
  aspectRatio: string;
  copyData?: CopyData;
  onSave?: (newBase64: string) => void;
};

export default function CriativoCanvasEditor({
  open, onClose, imageBase64, aspectRatio, copyData, onSave,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<FabricCanvas | null>(null);

  const [selProps, setSelProps] = useState<Record<string, any>>({});
  const [hasSelection, setHasSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState('');
  const [removingBg, setRemovingBg] = useState(false);

  const size = SIZES[aspectRatio] || SIZES['9:16'];

  // Google Fonts
  useEffect(() => {
    if (document.getElementById('editor-gfonts')) return;
    const link = document.createElement('link');
    link.id = 'editor-gfonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${FONTS.filter(f => !['Arial', 'Georgia'].includes(f)).map(f => `family=${f.replace(/ /g, '+')}:wght@400;700;900`).join('&')}&display=swap`;
    document.head.appendChild(link);
  }, []);

  // Init canvas
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => initCanvas(), 350);
    return () => {
      clearTimeout(timer);
      if (fcRef.current) { try { fcRef.current.dispose(); } catch {} fcRef.current = null; }
      setHasSelection(false);
      setSelProps({});
      setInitError('');
      setLoading(true);
    };
  }, [open, imageBase64, aspectRatio]);

  const initCanvas = async () => {
    const el = canvasElRef.current;
    const container = containerRef.current;
    if (!el || !container) { setInitError('DOM nao pronto'); setLoading(false); return; }

    try {
      const maxW = container.clientWidth - 48;
      const maxH = container.clientHeight - 48;
      if (maxW < 100 || maxH < 100) { setInitError('Container pequeno'); setLoading(false); return; }

      const scale = Math.min(maxW / size.w, maxH / size.h);
      const fc = new FabricCanvas(el, {
        width: Math.round(size.w * scale),
        height: Math.round(size.h * scale),
        backgroundColor: '#111111',
        selection: true,
        preserveObjectStacking: true,
      });
      fc.setZoom(scale);
      fcRef.current = fc;

      // Background image
      if (imageBase64) {
        try {
          const img = await FabricImage.fromURL(imageBase64, { crossOrigin: 'anonymous' });
          if (img.width && img.height) {
            img.set({ scaleX: size.w / img.width, scaleY: size.h / img.height, left: 0, top: 0, originX: 'left', originY: 'top' });
          }
          fc.backgroundImage = img;
          fc.renderAll();
        } catch (err) { console.warn('Erro bg:', err); }
      }

      // Pre-populate copy layers
      if (copyData) populateCopyLayers(fc, copyData);

      // Events
      const onSelect = (opt: any) => { const o = opt?.selected?.[0]; if (o) { setHasSelection(true); readProps(o); } };
      fc.on('selection:created', onSelect);
      fc.on('selection:updated', onSelect);
      fc.on('selection:cleared', () => { setHasSelection(false); setSelProps({}); });
      fc.on('object:modified', () => { const a = fc.getActiveObject(); if (a) readProps(a); });

      setLoading(false);
    } catch (err: any) {
      console.error('Init error:', err);
      setInitError(err?.message || 'Erro');
      setLoading(false);
    }
  };

  const populateCopyLayers = (fc: FabricCanvas, copy: CopyData) => {
    const v = size.h > size.w; // vertical (9:16)

    if (copy.badge) {
      fc.add(new Textbox(copy.badge, {
        left: size.w * 0.2, top: v ? size.h * 0.06 : size.h * 0.06,
        width: size.w * 0.6,
        fontSize: 22, fontWeight: 'bold', fontFamily: 'Montserrat',
        fill: '#000000', backgroundColor: '#3B82F6',
        textAlign: 'center', padding: 14,
        editable: true, cursorColor: '#fff', splitByGrapheme: true,
      }));
    }

    const headlineParts = [copy.headline, copy.headline_destaque].filter(Boolean);
    if (headlineParts.length) {
      fc.add(new Textbox(headlineParts.join('\n'), {
        left: size.w * 0.06, top: v ? size.h * 0.14 : size.h * 0.18,
        width: size.w * 0.88,
        fontSize: v ? 58 : 48, fontWeight: 'bold', fontFamily: 'Montserrat',
        fill: '#ffffff', textAlign: 'right',
        editable: true, cursorColor: '#fff', splitByGrapheme: true,
      }));
    }

    if (copy.suporte) {
      fc.add(new Textbox(copy.suporte, {
        left: size.w * 0.1, top: v ? size.h * 0.4 : size.h * 0.55,
        width: size.w * 0.8,
        fontSize: v ? 26 : 22, fontFamily: 'Inter',
        fill: '#cccccc', textAlign: 'center',
        editable: true, cursorColor: '#fff', splitByGrapheme: true,
      }));
    }

    if (copy.cta) {
      fc.add(new Textbox(copy.cta, {
        left: size.w * 0.2, top: v ? size.h * 0.83 : size.h * 0.78,
        width: size.w * 0.6,
        fontSize: 28, fontWeight: 'bold', fontFamily: 'Montserrat',
        fill: '#000000', backgroundColor: '#3B82F6',
        textAlign: 'center', padding: 16,
        editable: true, cursorColor: '#fff', splitByGrapheme: true,
      }));
    }

    fc.renderAll();
  };

  // --- Property reading ---
  const readProps = (obj: FabricObject) => {
    const isText = obj instanceof Textbox;
    const isImg = obj instanceof FabricImage;
    const tb = obj as Textbox;
    setSelProps({
      isText, isImg,
      fontFamily: isText ? tb.fontFamily : '',
      fontSize: isText ? tb.fontSize : 0,
      fontWeight: isText ? tb.fontWeight : 'normal',
      fontStyle: isText ? tb.fontStyle : 'normal',
      underline: isText ? tb.underline : false,
      textAlign: isText ? tb.textAlign : 'left',
      fill: typeof obj.fill === 'string' ? obj.fill : '#ffffff',
      backgroundColor: isText ? (tb.backgroundColor || '') : '',
      opacity: obj.opacity ?? 1,
      stroke: obj.stroke || '',
      strokeWidth: obj.strokeWidth || 0,
    });
  };

  const updateProp = (prop: string, value: any) => {
    const fc = fcRef.current;
    const obj = fc?.getActiveObject();
    if (!fc || !obj) return;
    (obj as any).set(prop, value);
    fc.renderAll();
    readProps(obj);
  };

  // --- Element actions ---
  const addText = (preset?: 'headline' | 'subtitle' | 'badge' | 'cta') => {
    const fc = fcRef.current;
    if (!fc) return;
    const styles: Record<string, any> = {
      headline: { text: 'SEU TITULO AQUI', fontSize: 72, fontWeight: 'bold', fontFamily: 'Montserrat', fill: '#ffffff', textAlign: 'center', width: 800 },
      subtitle: { text: 'Subtitulo de suporte', fontSize: 36, fontWeight: 'normal', fontFamily: 'Inter', fill: '#cccccc', textAlign: 'center', width: 700 },
      badge: { text: 'BADGE TEXTO', fontSize: 24, fontWeight: 'bold', fontFamily: 'Montserrat', fill: '#000000', backgroundColor: '#3B82F6', textAlign: 'center', width: 400 },
      cta: { text: 'SAIBA MAIS', fontSize: 32, fontWeight: 'bold', fontFamily: 'Montserrat', fill: '#000000', backgroundColor: '#3B82F6', textAlign: 'center', width: 350 },
    };
    const d = preset ? styles[preset] : { text: 'Novo texto', fontSize: 48, fontWeight: 'normal', fontFamily: 'Inter', fill: '#ffffff', textAlign: 'left', width: 500 };
    const tb = new Textbox(d.text, {
      left: size.w / 2 - (d.width || 500) / 2, top: size.h / 2 - 50,
      width: d.width || 500, fontSize: d.fontSize, fontFamily: d.fontFamily,
      fontWeight: d.fontWeight, fill: d.fill, textAlign: d.textAlign,
      backgroundColor: d.backgroundColor || '', editable: true,
      cursorColor: '#ffffff', padding: d.backgroundColor ? 12 : 0, splitByGrapheme: true,
    });
    fc.add(tb); fc.setActiveObject(tb); fc.renderAll();
  };

  const addShape = (type: 'rect' | 'circle') => {
    const fc = fcRef.current;
    if (!fc) return;
    const base = { left: size.w / 2 - 100, top: size.h / 2 - 100, fill: '#3B82F6', opacity: 0.8 };
    const shape = type === 'rect'
      ? new Rect({ ...base, width: 200, height: 200, rx: 8, ry: 8 })
      : new Circle({ ...base, radius: 100 });
    fc.add(shape); fc.setActiveObject(shape); fc.renderAll();
  };

  const uploadImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const fc = fcRef.current;
        if (!fc) return;
        try {
          const img = await FabricImage.fromURL(reader.result as string);
          const maxDim = Math.min(size.w * 0.5, size.h * 0.5);
          const s = Math.min(maxDim / (img.width ?? 1), maxDim / (img.height ?? 1));
          img.set({ scaleX: s, scaleY: s, left: size.w / 2 - ((img.width ?? 0) * s) / 2, top: size.h / 2 - ((img.height ?? 0) * s) / 2 });
          fc.add(img); fc.setActiveObject(img); fc.renderAll();
          toast.success('Imagem adicionada');
        } catch { toast.error('Erro carregando imagem'); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const deleteSelected = () => {
    const fc = fcRef.current; const obj = fc?.getActiveObject();
    if (!fc || !obj) return;
    fc.remove(obj); fc.discardActiveObject(); fc.renderAll();
  };

  const cloneSelected = async () => {
    const fc = fcRef.current; const obj = fc?.getActiveObject();
    if (!fc || !obj) return;
    const clone = await obj.clone();
    clone.set({ left: (obj.left ?? 0) + 30, top: (obj.top ?? 0) + 30 });
    fc.add(clone); fc.setActiveObject(clone); fc.renderAll();
  };

  const bringForward = () => { const fc = fcRef.current; const o = fc?.getActiveObject(); if (fc && o) { fc.bringObjectForward(o); fc.renderAll(); } };
  const sendBackward = () => { const fc = fcRef.current; const o = fc?.getActiveObject(); if (fc && o) { fc.sendObjectBackwards(o); fc.renderAll(); } };

  // Crop: applies rectangular clip to selected image
  const cropSelected = () => {
    const fc = fcRef.current;
    const obj = fc?.getActiveObject();
    if (!fc || !obj || !(obj instanceof FabricImage)) {
      toast.error('Selecione uma imagem pra recortar');
      return;
    }
    const w = obj.width ?? 100;
    const h = obj.height ?? 100;
    const clipRect = new Rect({
      width: w * 0.8,
      height: h * 0.8,
      left: -(w * 0.4),
      top: -(h * 0.4),
      absolutePositioned: false,
    });
    obj.clipPath = clipRect;
    fc.renderAll();
    toast.success('Recorte aplicado (80%). Redimensione a imagem pra ajustar.');
  };

  // Remove background via edge function
  const removeBackground = async () => {
    const fc = fcRef.current;
    const obj = fc?.getActiveObject();
    if (!fc || !obj || !(obj instanceof FabricImage)) {
      toast.error('Selecione uma imagem pra remover fundo');
      return;
    }

    setRemovingBg(true);
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = obj.width ?? 100;
      tempCanvas.height = obj.height ?? 100;
      const ctx = tempCanvas.getContext('2d')!;
      const src = (obj as any)._element || (obj as any).getElement?.();
      if (!src) { toast.error('Nao consegui acessar a imagem'); return; }
      ctx.drawImage(src, 0, 0, tempCanvas.width, tempCanvas.height);
      const b64 = tempCanvas.toDataURL('image/png').split(',')[1];

      const { data, error } = await supabase.functions.invoke('marketing-criativo', {
        body: { action: 'remove_background', image_base64: b64, image_mime: 'image/png' },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Falha removendo fundo. Tente novamente.');
        return;
      }

      const resultUrl = data.image_url || data.image_base64;
      if (!resultUrl) { toast.error('Sem resultado do servidor'); return; }

      const newImg = await FabricImage.fromURL(
        resultUrl.startsWith('data:') ? resultUrl : `data:image/png;base64,${resultUrl}`,
      );
      newImg.set({
        left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY,
        angle: obj.angle, opacity: obj.opacity,
      });
      fc.remove(obj);
      fc.add(newImg);
      fc.setActiveObject(newImg);
      fc.renderAll();
      toast.success('Fundo removido');
    } catch (err: any) {
      console.error('Erro removendo fundo:', err);
      toast.error('Erro: ' + (err?.message || 'falha'));
    } finally {
      setRemovingBg(false);
    }
  };

  // Export
  const getExportDataUrl = () => {
    const fc = fcRef.current;
    if (!fc) return null;
    fc.discardActiveObject();
    fc.renderAll();
    return fc.toDataURL({ format: 'png', multiplier: 1 / fc.getZoom() });
  };

  const exportPNG = () => {
    const url = getExportDataUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `criativo-editado-${Date.now()}.png`; a.click();
    toast.success('PNG exportado');
  };

  const saveAndClose = () => {
    const url = getExportDataUrl();
    if (!url) return;
    onSave?.(url); onClose();
    toast.success('Criativo salvo');
  };

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const fc = fcRef.current; if (!fc) return;
      if (e.key === 'Escape') {
        const o = fc.getActiveObject();
        if (o) { if (o instanceof Textbox && (o as any).isEditing) return; fc.discardActiveObject(); fc.renderAll(); return; }
        onClose(); return;
      }
      if (e.key === 'Delete' || (e.key === 'Backspace' && !e.metaKey)) {
        const o = fc.getActiveObject();
        if (o && !(o instanceof Textbox && (o as any).isEditing)) { e.preventDefault(); deleteSelected(); }
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        if (fc.getActiveObject()) { e.preventDefault(); cloneSelected(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 99999, backgroundColor: '#0a0a0a', pointerEvents: 'auto', isolation: 'isolate' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: '1px solid #262626', backgroundColor: '#171717' }}>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white"><X className="h-4 w-4" /></Button>
          <h2 className="text-sm font-semibold text-white">Editor de Criativo</h2>
          <span className="text-[10px] text-zinc-500">{size.w}x{size.h}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportPNG} className="border-zinc-700 text-zinc-300 hover:text-white">
            <Download className="h-3 w-3 mr-1.5" /> Download PNG
          </Button>
          {onSave && (
            <Button size="sm" onClick={saveAndClose}><Save className="h-3 w-3 mr-1.5" /> Salvar</Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-4 py-1.5 shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #262626', backgroundColor: '#171717ee' }}>
        {/* Add tools */}
        <div className="flex items-center gap-0.5 pr-2 mr-1" style={{ borderRight: '1px solid #3f3f46' }}>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-300" onClick={() => addText()} title="Adicionar texto">
            <Type className="h-3.5 w-3.5 mr-1" /><span className="text-xs">Texto</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400" onClick={() => addShape('rect')} title="Retangulo">
            <Square className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400" onClick={() => addShape('circle')} title="Circulo">
            <CircleIcon className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-300" onClick={uploadImage} title="Upload imagem">
            <Upload className="h-3.5 w-3.5 mr-1" /><span className="text-xs">Imagem</span>
          </Button>
        </div>

        {/* Quick templates */}
        <div className="flex items-center gap-0.5 pr-2 mr-1" style={{ borderRight: '1px solid #3f3f46' }}>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-zinc-400" onClick={() => addText('headline')}>Titulo</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-zinc-400" onClick={() => addText('subtitle')}>Subtitulo</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-400/80" onClick={() => addText('badge')}>Badge</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-400/80" onClick={() => addText('cta')}>CTA</Button>
        </div>

        {/* Image tools (crop, remove bg) */}
        {selProps.isImg && (
          <div className="flex items-center gap-0.5 pr-2 mr-1" style={{ borderRight: '1px solid #3f3f46' }}>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-zinc-300" onClick={cropSelected} title="Recortar imagem">
              <Crop className="h-3.5 w-3.5 mr-1" />Recortar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-zinc-300" onClick={removeBackground} disabled={removingBg} title="Remover fundo da imagem">
              {removingBg ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Eraser className="h-3.5 w-3.5 mr-1" />}
              {removingBg ? 'Removendo...' : 'Remover fundo'}
            </Button>
          </div>
        )}

        {/* Text formatting */}
        {selProps.isText && (
          <div className="flex items-center gap-1 pr-2 mr-1" style={{ borderRight: '1px solid #3f3f46' }}>
            <Select value={selProps.fontFamily || 'Inter'} onValueChange={(v) => updateProp('fontFamily', v)}>
              <SelectTrigger className="h-7 w-[130px] text-xs bg-zinc-800 border-zinc-700 text-zinc-200"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[999999]">
                {FONTS.map(f => <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: f }}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" value={selProps.fontSize || 48} onChange={(e) => updateProp('fontSize', parseInt(e.target.value) || 48)} className="h-7 w-14 text-xs bg-zinc-800 border-zinc-700 text-zinc-200" min={8} max={200} />
            <Button size="sm" variant={selProps.fontWeight === 'bold' ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" onClick={() => updateProp('fontWeight', selProps.fontWeight === 'bold' ? 'normal' : 'bold')}><Bold className="h-3 w-3" /></Button>
            <Button size="sm" variant={selProps.fontStyle === 'italic' ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" onClick={() => updateProp('fontStyle', selProps.fontStyle === 'italic' ? 'normal' : 'italic')}><Italic className="h-3 w-3" /></Button>
            <Button size="sm" variant={selProps.underline ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" onClick={() => updateProp('underline', !selProps.underline)}><Underline className="h-3 w-3" /></Button>
            <div className="flex items-center pl-1 ml-0.5" style={{ borderLeft: '1px solid #3f3f46' }}>
              <Button size="sm" variant={selProps.textAlign === 'left' ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" onClick={() => updateProp('textAlign', 'left')}><AlignLeft className="h-3 w-3" /></Button>
              <Button size="sm" variant={selProps.textAlign === 'center' ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" onClick={() => updateProp('textAlign', 'center')}><AlignCenter className="h-3 w-3" /></Button>
              <Button size="sm" variant={selProps.textAlign === 'right' ? 'secondary' : 'ghost'} className="h-7 w-7 p-0" onClick={() => updateProp('textAlign', 'right')}><AlignRight className="h-3 w-3" /></Button>
            </div>
          </div>
        )}

        {/* Color + actions */}
        {hasSelection && (
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer" title="Cor">
              <Paintbrush className="h-3 w-3" />
              <input type="color" value={selProps.fill || '#ffffff'} onChange={(e) => updateProp('fill', e.target.value)} className="h-6 w-6 rounded cursor-pointer bg-transparent border border-zinc-700 p-0" />
            </label>
            {selProps.isText && (
              <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer" title="Fundo do texto">
                BG
                <input type="color" value={selProps.backgroundColor || '#000000'} onChange={(e) => updateProp('backgroundColor', e.target.value)} className="h-6 w-6 rounded cursor-pointer bg-transparent border border-zinc-700 p-0" />
                {selProps.backgroundColor && (
                  <button className="text-zinc-600 hover:text-zinc-300" onClick={() => { updateProp('backgroundColor', ''); updateProp('padding', 0); }}><X className="h-3 w-3" /></button>
                )}
              </label>
            )}
            <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer" title="Contorno">
              Contorno
              <input type="color" value={selProps.stroke || '#000000'} onChange={(e) => { updateProp('stroke', e.target.value); if (!selProps.strokeWidth) updateProp('strokeWidth', 2); }} className="h-6 w-6 rounded cursor-pointer bg-transparent border border-zinc-700 p-0" />
              <Input type="number" value={selProps.strokeWidth || 0} onChange={(e) => updateProp('strokeWidth', parseInt(e.target.value) || 0)} className="h-6 w-10 text-[10px] bg-zinc-800 border-zinc-700 text-zinc-300 px-1" min={0} max={20} />
              {selProps.stroke && (
                <button className="text-zinc-600 hover:text-zinc-300" onClick={() => { updateProp('stroke', ''); updateProp('strokeWidth', 0); }}><X className="h-3 w-3" /></button>
              )}
            </label>

            <div className="flex items-center gap-0.5 pl-1.5 ml-0.5" style={{ borderLeft: '1px solid #3f3f46' }}>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400" onClick={cloneSelected} title="Duplicar (Ctrl+D)"><Copy className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400" onClick={bringForward} title="Trazer pra frente"><ChevronUp className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400" onClick={sendBackward} title="Mandar pra tras"><ChevronDown className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={deleteSelected} title="Apagar (Delete)"><Trash2 className="h-3 w-3" /></Button>
            </div>

            <div className="flex items-center gap-1 pl-1.5 ml-0.5" style={{ borderLeft: '1px solid #3f3f46' }}>
              <span className="text-[10px] text-zinc-600">Opac.</span>
              <input type="range" min={0} max={1} step={0.05} value={selProps.opacity ?? 1} onChange={(e) => updateProp('opacity', parseFloat(e.target.value))} className="w-16 h-1 accent-primary cursor-pointer" />
              <span className="text-[10px] text-zinc-500 w-7">{Math.round((selProps.opacity ?? 1) * 100)}%</span>
            </div>
          </div>
        )}

        {!hasSelection && (
          <span className="text-[10px] text-zinc-600 ml-2">Clique num elemento pra editar. Duplo-clique no texto pra digitar.</span>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden relative" style={{ minHeight: 0, backgroundColor: '#0a0a0a' }}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ zIndex: 10 }}>
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            <span className="text-sm text-zinc-500">Carregando editor...</span>
          </div>
        )}
        {initError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ zIndex: 10 }}>
            <p className="text-red-400 text-sm">Erro: {initError}</p>
            <Button size="sm" variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        )}
        <canvas ref={canvasElRef} style={{ display: loading ? 'none' : 'block', boxShadow: '0 0 60px rgba(0,0,0,0.5)' }} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 text-[10px] text-zinc-600 shrink-0" style={{ borderTop: '1px solid #262626', backgroundColor: '#171717' }}>
        <span>Duplo-clique no texto pra editar. Arraste pra mover. Cantos pra redimensionar.</span>
        <span>Delete = apagar | Ctrl+D = duplicar | Esc = desselecionar</span>
      </div>
    </div>,
    document.body,
  );
}
