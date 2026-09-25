/**
 * EditableTemplateIframe
 *
 * Renderiza o HTML do template dentro de iframe com designMode='on' (todo o
 * documento vira editável). Toolbar flutuante no topo aplica formatação via
 * execCommand no contentDocument do iframe.
 *
 * Vantagens vs editor lateral:
 *  - WYSIWYG real: você edita direto onde vê
 *  - Enter quebra linha naturalmente
 *  - Toolbar familiar (Word/Gmail)
 *  - Preserva tabelas/headers customizados (Maily destruía)
 *  - Estilos isolados do tema dark do CRM (iframe sandboxed)
 */

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
  Link2, Image as ImageIcon, Palette, Eraser,
  Type, Heading1, Heading2, Heading3,
  Undo2, Redo2,
  ExternalLink, Trash2, AtSign, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface EditableTemplateIframeHandle {
  /** Retorna o HTML atual editado, preservando o doctype e estrutura completa */
  getHtml: () => string;
  /** Insere texto na posição atual do cursor (ex: variável {{primeiro_nome}}) */
  insertText: (text: string) => void;
}

interface Props {
  initialHtml: string;
  onChange?: (html: string) => void;
  height?: number | string;
}

interface SelectedLink {
  el: HTMLAnchorElement;
  text: string;
  href: string;
  bgColor: string;
  textColor: string;
  isButton: boolean;
}

const FONT_SIZES = [
  { label: 'Pequeno', value: '13px' },
  { label: 'Normal', value: '15px' },
  { label: 'Médio', value: '18px' },
  { label: 'Grande', value: '22px' },
  { label: 'Enorme', value: '28px' },
];

const COLORS = ['#0a0a0a', '#333333', '#666666', '#999999', '#3B82F6', '#917D3D', '#0066cc', '#cc0000', '#009933'];

export const EditableTemplateIframe = forwardRef<EditableTemplateIframeHandle, Props>(
  ({ initialHtml, onChange, height = 720 }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [selectedLink, setSelectedLink] = useState<SelectedLink | null>(null);
    const [linkEditOpen, setLinkEditOpen] = useState(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    // Onde o cursor estava quando o seletor de arquivo abriu: escolher o arquivo tira o
    // foco do iframe e a seleção se perde, então guardamos pra restaurar depois.
    const savedRangeRef = useRef<Range | null>(null);

    const insertTextAtCursor = (text: string) => {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow;
      if (!doc || !win) return;
      win.focus();
      try {
        doc.execCommand('insertText', false, text);
      } catch {
        // Fallback: cria text node manualmente
        const sel = doc.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(doc.createTextNode(text));
          range.collapse(false);
        }
      }
      if (onChangeRef.current) {
        const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        onChangeRef.current(html);
      }
    };

    useImperativeHandle(ref, () => ({
      getHtml: () => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return initialHtml;
        return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
      },
      insertText: insertTextAtCursor,
    }), [initialHtml]);

    // Monta o iframe (uma vez): escreve HTML + ativa designMode + listeners
    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const init = () => {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.open();
        doc.write(initialHtml);
        doc.close();
        doc.designMode = 'on';

        // Injeta CSS pra normalizar espaçamento de Enter (parágrafos compactos como em email)
        const styleEl = doc.createElement('style');
        styleEl.textContent = `
          p { margin: 0 0 8px !important; line-height: 1.5 !important; }
          h1 { margin: 16px 0 12px !important; line-height: 1.25 !important; }
          h2 { margin: 14px 0 10px !important; line-height: 1.3 !important; }
          h3 { margin: 12px 0 8px !important; line-height: 1.35 !important; }
          div { margin: 0; }
          /* Visual feedback no foco */
          [contenteditable="true"]:focus, body:focus { outline: none; }
          /* Caret cor preta sempre, sem importar tema */
          * { caret-color: #0a0a0a; }
        `;
        doc.head?.appendChild(styleEl);

        // Enter sempre cria <p> (não <div>) — mais previsível em emails
        try { doc.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}

        // Captura mudanças (input) e notifica parent
        const notify = () => {
          if (!onChangeRef.current) return;
          const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
          onChangeRef.current(html);
        };
        doc.addEventListener('input', notify);
        doc.addEventListener('keyup', notify);

        // Detecta clique em <a> (link ou botão) → abre dialog de edição
        doc.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          const anchor = target.closest('a') as HTMLAnchorElement | null;
          if (!anchor) return;
          // Detecta se é botão estilizado: <a> dentro de <td> com background/border-radius
          const parentTd = anchor.closest('td');
          const parentStyle = parentTd?.getAttribute('style') || '';
          const isButton = /border-radius/.test(parentStyle) && /background/.test(parentStyle);
          const aStyle = anchor.getAttribute('style') || '';

          let bgColor = '#3B82F6';
          const bgM = parentStyle.match(/background(?:-color)?\s*:\s*([^;]+)/i);
          if (bgM) bgColor = bgM[1].trim();
          let textColor = '#0a0a0a';
          const colorM = aStyle.match(/color\s*:\s*([^;]+)/i);
          if (colorM) textColor = colorM[1].trim();

          setSelectedLink({
            el: anchor,
            text: anchor.textContent || '',
            href: anchor.getAttribute('href') || '',
            bgColor,
            textColor,
            isButton,
          });
          setLinkEditOpen(true);
        });

        setIsReady(true);
      };

      // Espera load
      if (iframe.contentDocument?.readyState === 'complete') {
        init();
      } else {
        iframe.addEventListener('load', init, { once: true });
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /** Executa comando no iframe (mantém foco onde o cursor está) */
    const exec = (cmd: string, value?: string) => {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow;
      if (!doc || !win) return;
      win.focus();
      try {
        doc.execCommand(cmd, false, value);
      } catch (e) {
        console.warn(`execCommand ${cmd} falhou:`, e);
      }
      // Trigger notify manual
      if (onChangeRef.current) {
        const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        onChangeRef.current(html);
      }
    };

    const applyHeading = (level: '1' | '2' | '3' | 'p') => {
      const tag = level === 'p' ? 'p' : `h${level}`;
      exec('formatBlock', `<${tag}>`);
    };

    const applyFontSize = (size: string) => {
      // execCommand fontSize aceita 1-7. Vamos usar wrapper span pra preservar tamanho exato.
      const doc = iframeRef.current?.contentDocument;
      const sel = doc?.getSelection();
      if (!sel || sel.rangeCount === 0) {
        toast.error('Selecione um texto primeiro');
        return;
      }
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        toast.error('Selecione o texto que quer redimensionar');
        return;
      }
      const span = doc!.createElement('span');
      span.style.fontSize = size;
      try {
        range.surroundContents(span);
      } catch {
        // Se a seleção atravessa tags (parágrafos misturados), extract + wrap
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
      if (onChangeRef.current) {
        const html = '<!DOCTYPE html>' + doc!.documentElement.outerHTML;
        onChangeRef.current(html);
      }
    };

    const applyColor = (color: string, type: 'fore' | 'back') => {
      exec(type === 'fore' ? 'foreColor' : 'hiliteColor', color);
    };

    const insertLink = () => {
      const url = window.prompt('Cole a URL do link (ex: https://...):');
      if (!url) return;
      exec('createLink', url);
    };

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

    /** Abre o seletor de arquivo, guardando antes onde o cursor está. */
    const insertImage = () => {
      const doc = iframeRef.current?.contentDocument;
      const sel = doc?.getSelection();
      savedRangeRef.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      imageInputRef.current?.click();
    };

    /** Alternativa pra quem já tem a imagem hospedada em outro lugar. */
    const insertImageFromUrl = () => {
      const url = window.prompt('Cole a URL da imagem:');
      if (!url) return;
      exec('insertImage', url);
    };

    // Sobe pro bucket público email-assets e insere já com a URL final. Tem que ser URL
    // pública e absoluta: cliente de e-mail bloqueia data URL e o tamanho estoura.
    const handleImageFile = async (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('Isso não é uma imagem', { description: 'Escolha um arquivo JPG, PNG, GIF ou WEBP.' });
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error('Imagem muito pesada', { description: 'Máximo 5MB — acima disso o e-mail cai em spam ou nem carrega.' });
        return;
      }
      setUploadingImage(true);
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
        const path = `inline/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage
          .from('email-assets')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from('email-assets').getPublicUrl(path);
        if (!data?.publicUrl) throw new Error('storage não devolveu URL pública');

        // Devolve o cursor pro ponto onde estava antes de abrir o seletor de arquivo.
        const doc = iframeRef.current?.contentDocument;
        const win = iframeRef.current?.contentWindow;
        if (doc && win && savedRangeRef.current) {
          win.focus();
          const sel = doc.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(savedRangeRef.current);
        }
        exec('insertImage', data.publicUrl);

        // execCommand insere <img> sem limite de largura: num e-mail isso estoura o layout.
        const img = doc?.querySelector(`img[src="${data.publicUrl}"]`) as HTMLImageElement | null;
        if (img) {
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.setAttribute('alt', file.name);
          if (onChangeRef.current) {
            onChangeRef.current('<!DOCTYPE html>' + doc!.documentElement.outerHTML);
          }
        }
        toast.success('Imagem inserida', { description: 'Já está hospedada — o lead vai ver ela no e-mail.' });
      } catch (err: any) {
        toast.error('Não consegui subir a imagem', { description: err?.message || 'Erro no storage' });
      } finally {
        setUploadingImage(false);
        savedRangeRef.current = null;
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    };

    const removeFormatting = () => exec('removeFormat');

    const saveLink = (data: { text: string; href: string; bgColor: string; textColor: string }) => {
      if (!selectedLink) return;
      const { el, isButton } = selectedLink;
      el.textContent = data.text;
      el.setAttribute('href', data.href);
      // Atualiza style do <a> (cor do texto)
      const aStyle = el.getAttribute('style') || '';
      const newAStyle = aStyle.match(/color\s*:/i)
        ? aStyle.replace(/color\s*:\s*[^;]+/i, `color:${data.textColor}`)
        : `color:${data.textColor};${aStyle}`;
      el.setAttribute('style', newAStyle);

      // Se é botão, atualiza bg do <td> pai
      if (isButton) {
        const parentTd = el.closest('td');
        if (parentTd) {
          const tdStyle = parentTd.getAttribute('style') || '';
          const newTdStyle = tdStyle.match(/background(?:-color)?\s*:/i)
            ? tdStyle.replace(/background(?:-color)?\s*:\s*[^;]+/i, `background:${data.bgColor}`)
            : `background:${data.bgColor};${tdStyle}`;
          parentTd.setAttribute('style', newTdStyle);
        }
      }

      const doc = iframeRef.current?.contentDocument;
      if (doc && onChangeRef.current) {
        const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        onChangeRef.current(html);
      }
      setLinkEditOpen(false);
      setSelectedLink(null);
      toast.success('Link atualizado');
    };

    const removeLink = () => {
      if (!selectedLink) return;
      const { el, isButton } = selectedLink;
      const parentTd = el.closest('td');
      if (isButton && parentTd) {
        // Remove o botão inteiro (table+tr+td+a)
        const parentTable = parentTd.closest('table');
        parentTable?.remove();
      } else {
        // Substitui <a> por texto puro
        const text = el.textContent || '';
        el.replaceWith(text);
      }
      const doc = iframeRef.current?.contentDocument;
      if (doc && onChangeRef.current) {
        const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        onChangeRef.current(html);
      }
      setLinkEditOpen(false);
      setSelectedLink(null);
      toast.success(isButton ? 'Botão removido' : 'Link removido');
    };

    return (
      <div className="flex flex-col rounded-2xl border border-zinc-200 shadow-xl overflow-hidden bg-white" style={{ colorScheme: 'light' }}>
        {/* TOOLBAR */}
        <div className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 flex flex-wrap items-center gap-1 text-zinc-700">
          {/* Undo/Redo */}
          <ToolbarBtn onClick={() => exec('undo')} title="Desfazer (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('redo')} title="Refazer (Ctrl+Y / Ctrl+Shift+Z)"><Redo2 className="h-3.5 w-3.5" /></ToolbarBtn>

          <div className="w-px h-5 bg-zinc-300 mx-1" />

          {/* Bloco / Heading */}
          <Select onValueChange={(v) => applyHeading(v as any)}>
            <SelectTrigger className="h-8 w-28 text-xs bg-white">
              <SelectValue placeholder="Parágrafo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="p"><span className="flex items-center gap-1.5"><Type className="h-3 w-3" /> Parágrafo</span></SelectItem>
              <SelectItem value="1"><span className="flex items-center gap-1.5"><Heading1 className="h-3 w-3" /> Título 1</span></SelectItem>
              <SelectItem value="2"><span className="flex items-center gap-1.5"><Heading2 className="h-3 w-3" /> Título 2</span></SelectItem>
              <SelectItem value="3"><span className="flex items-center gap-1.5"><Heading3 className="h-3 w-3" /> Título 3</span></SelectItem>
            </SelectContent>
          </Select>

          {/* Font size */}
          <Select onValueChange={applyFontSize}>
            <SelectTrigger className="h-8 w-24 text-xs bg-white">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span style={{ fontSize: s.value }}>{s.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-zinc-300 mx-1" />

          {/* Bold/Italic/Underline/Strike */}
          <ToolbarBtn onClick={() => exec('bold')} title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('italic')} title="Itálico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('underline')} title="Sublinhado (Ctrl+U)"><Underline className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('strikeThrough')} title="Riscado"><Strikethrough className="h-3.5 w-3.5" /></ToolbarBtn>

          <div className="w-px h-5 bg-zinc-300 mx-1" />

          {/* Cores */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-zinc-200 transition-colors" title="Cor do texto">
                <Palette className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Cor do texto</p>
              <div className="grid grid-cols-9 gap-1 mb-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => applyColor(c, 'fore')}
                    className="w-6 h-6 rounded border border-zinc-300 hover:scale-110 transition-transform"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <Input
                type="color"
                onChange={(e) => applyColor(e.target.value, 'fore')}
                className="h-8 w-full p-1 cursor-pointer"
              />
              <div className="border-t border-border my-2" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Cor de fundo</p>
              <div className="grid grid-cols-9 gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => applyColor(c, 'back')}
                    className="w-6 h-6 rounded border border-zinc-300 hover:scale-110 transition-transform"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-zinc-300 mx-1" />

          {/* Alinhamento */}
          <ToolbarBtn onClick={() => exec('justifyLeft')} title="Alinhar à esquerda"><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('justifyCenter')} title="Centralizar"><AlignCenter className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('justifyRight')} title="Alinhar à direita"><AlignRight className="h-3.5 w-3.5" /></ToolbarBtn>

          <div className="w-px h-5 bg-zinc-300 mx-1" />

          {/* Listas */}
          <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Lista com marcadores"><List className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>

          <div className="w-px h-5 bg-zinc-300 mx-1" />

          {/* Link / Imagem */}
          <ToolbarBtn onClick={insertLink} title="Inserir link"><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={insertImage} title="Inserir imagem (sobe do seu computador)">
            {uploadingImage
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <ImageIcon className="h-3.5 w-3.5" />}
          </ToolbarBtn>
          <ToolbarBtn onClick={insertImageFromUrl} title="Inserir imagem por URL">
            <span className="text-[10px] font-semibold">URL</span>
          </ToolbarBtn>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => handleImageFile(e.target.files)}
          />

          <div className="w-px h-5 bg-zinc-300 mx-1" />

          {/* Limpar formatação */}
          <ToolbarBtn onClick={removeFormatting} title="Limpar formatação"><Eraser className="h-3.5 w-3.5" /></ToolbarBtn>

          <div className="ml-auto text-[10px] text-muted-foreground italic px-2">
            {isReady ? 'Clique no texto pra editar · click em link/botão pra ajustar URL' : 'Carregando…'}
          </div>
        </div>

        {/* IFRAME EDITÁVEL */}
        <iframe
          ref={iframeRef}
          title="Editor de template"
          className="w-full block"
          style={{ height, border: 0, colorScheme: 'light', background: 'white' }}
        />

        {/* DIALOG: editar link/botão clicado */}
        <LinkEditDialog
          open={linkEditOpen}
          onOpenChange={setLinkEditOpen}
          selectedLink={selectedLink}
          onSave={saveLink}
          onRemove={removeLink}
        />
      </div>
    );
  }
);

interface LinkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLink: SelectedLink | null;
  onSave: (data: { text: string; href: string; bgColor: string; textColor: string }) => void;
  onRemove: () => void;
}

function LinkEditDialog({ open, onOpenChange, selectedLink, onSave, onRemove }: LinkEditDialogProps) {
  const [text, setText] = useState('');
  const [href, setHref] = useState('');
  const [bgColor, setBgColor] = useState('#3B82F6');
  const [textColor, setTextColor] = useState('#000000');

  useEffect(() => {
    if (selectedLink) {
      setText(selectedLink.text);
      setHref(selectedLink.href);
      setBgColor(selectedLink.bgColor);
      setTextColor(selectedLink.textColor);
    }
  }, [selectedLink]);

  if (!selectedLink) return null;
  const isButton = selectedLink.isButton;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isButton ? <ExternalLink className="h-4 w-4 text-[#BAA05E]" /> : <Link2 className="h-4 w-4 text-[#BAA05E]" />}
            {isButton ? 'Editar botão' : 'Editar link'}
          </DialogTitle>
          <DialogDescription>
            {isButton
              ? 'Ajuste o texto do botão, URL de destino e cores.'
              : 'Ajuste o texto exibido e a URL de destino.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Texto exibido</Label>
            <Input
              value={text}
              onChange={(e) => setText(isButton ? e.target.value.toUpperCase() : e.target.value)}
              placeholder={isButton ? 'ACESSAR PLATAFORMA' : 'Clique aqui'}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">URL de destino</Label>
            <Input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://..."
              className="h-9 font-mono text-xs"
              type="url"
            />
            <p className="text-[10px] text-muted-foreground">
              Pode usar variáveis: <code>https://meusite.com/lead/{'{{primeiro_nome}}'}</code>
            </p>
          </div>

          {isButton && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor do fundo</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="color"
                    value={bgColor.startsWith('#') ? bgColor : '#3B82F6'}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-9 w-12 p-1 cursor-pointer"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor do texto</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="color"
                    value={textColor.startsWith('#') ? textColor : '#000000'}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-9 w-12 p-1 cursor-pointer"
                  />
                  <Input
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {isButton && (
            <div className="rounded-md border bg-muted/20 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Pré-visualização</p>
              <div style={{ background: bgColor, padding: '14px 32px', borderRadius: '8px', display: 'inline-block' }}>
                <span style={{ color: textColor, fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em' }}>
                  {text || 'TEXTO DO BOTÃO'}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isButton ? 'Remover botão' : 'Remover link'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              className="bg-[#BAA05E] hover:bg-[#917D3D] text-white"
              onClick={() => onSave({ text, href, bgColor, textColor })}
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

EditableTemplateIframe.displayName = 'EditableTemplateIframe';

function ToolbarBtn({ onClick, title, children, className }: { onClick: () => void; title: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn('h-8 w-8 inline-flex items-center justify-center rounded hover:bg-zinc-200 active:bg-zinc-300 transition-colors text-zinc-700', className)}
    >
      {children}
    </button>
  );
}

export default EditableTemplateIframe;
