import { useEffect, useMemo, useRef } from 'react';
import { Editor, type EditorProps } from '@maily-to/core';
import {
  MailyKit,
  VariableExtension,
  getVariableSuggestions,
  type Variable,
} from '@maily-to/core/extensions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { blocksPtBR } from './maily-blocks-pt';

interface Props extends Omit<EditorProps, 'extensions'> {
  /** Hook adicional pra forçar override da config padrão */
}

// Strings que aparecem hardcoded no Maily (sidebar tabs, labels, placeholders)
const UI_TRANSLATIONS: Record<string, string> = {
  // Tabs sidebar
  'Content': 'Conteúdo',
  'Blocks': 'Blocos',
  'Body': 'Corpo',
  'Dev': 'Código',
  // Labels comuns
  'Variables': 'Variáveis',
  'Show if': 'Mostrar se',
  'Show block conditionally': 'Mostrar bloco condicionalmente',
  'Alignment': 'Alinhamento',
  'Padding': 'Espaçamento interno',
  'Margin': 'Margem',
  'Size': 'Tamanho',
  'Link': 'Link',
  'Add title': 'Adicionar título',
  'Add description here': 'Descrição aqui',
  'Add link here': 'Cole o link aqui',
  'Add link title here': 'Título do link',
  'Add badge text here': 'Texto do badge',
  'Add sub title here': 'Subtítulo',
  'Add new node': 'Adicionar novo bloco',
  'Add your brand logo': 'Adicione o logo da marca',
  // Toolbar buttons (aria-label e title)
  'Bold': 'Negrito',
  'Italic': 'Itálico',
  'Underline': 'Sublinhado',
  'Strikethrough': 'Riscado',
  'Strike': 'Riscado',
  'Code': 'Código inline',
  'Clear formatting': 'Limpar formatação',
  'Remove formatting': 'Limpar formatação',
  'Superscript': 'Sobrescrito',
  'Subscript': 'Subscrito',
  'Add link': 'Adicionar link',
  'Edit link': 'Editar link',
  'Remove link': 'Remover link',
  'Align left': 'Alinhar à esquerda',
  'Align center': 'Centralizar',
  'Align right': 'Alinhar à direita',
  'Align justify': 'Justificar',
  'Bullet list': 'Lista com marcadores',
  'Ordered list': 'Lista numerada',
  'Heading 1': 'Título 1',
  'Heading 2': 'Título 2',
  'Heading 3': 'Título 3',
  'Paragraph': 'Parágrafo',
  'Text color': 'Cor do texto',
  'Background color': 'Cor de fundo',
  'Drag to move': 'Arraste para mover',
  'Click to drag': 'Clique para arrastar',
};

// Aria-labels específicos do Maily que não estão acima — adiciona `title` baseado em `aria-label`
function ensureToolbarTooltips(root: HTMLElement) {
  root.querySelectorAll('button, [role="button"]').forEach((el) => {
    const btn = el as HTMLElement;
    if (btn.getAttribute('title')) return; // já tem
    const aria = btn.getAttribute('aria-label')?.trim();
    if (aria) {
      btn.setAttribute('title', UI_TRANSLATIONS[aria] || aria);
    }
  });
}

// O Maily renderiza Radix Tooltip em portal com texto "Bold", "Italic", etc.
// Traduz esse conteúdo pra PT sempre que portal aparecer no body.
function translateTooltipPortals() {
  const tooltips = document.querySelectorAll<HTMLElement>('[role="tooltip"], [data-radix-tooltip-content]');
  tooltips.forEach((tip) => {
    const txt = tip.textContent?.trim();
    if (!txt) return;
    if (UI_TRANSLATIONS[txt]) {
      tip.textContent = UI_TRANSLATIONS[txt];
    }
  });
}

const VARIABLES: Variable[] = [
  { name: 'nome', label: 'Nome do contato' },
  { name: 'primeiro_nome', label: 'Primeiro nome' },
  { name: 'empresa', label: 'Empresa' },
  { name: 'email', label: 'Email' },
  { name: 'telefone', label: 'Telefone' },
  { name: 'cidade', label: 'Cidade' },
  { name: 'estado', label: 'Estado' },
  { name: 'vendedor', label: 'Vendedor responsável' },
  { name: 'produto', label: 'Produto' },
  { name: 'link_descadastro', label: 'Link descadastro' },
  { name: 'unsubscribe_url', label: 'URL descadastro' },
];

async function uploadImage(file: Blob): Promise<string> {
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const filename = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('email-assets')
    .upload(filename, file, { contentType: file.type, upsert: false });
  if (error) {
    toast.error(`Erro ao fazer upload: ${error.message}`);
    throw error;
  }
  const { data } = supabase.storage.from('email-assets').getPublicUrl(filename);
  return data.publicUrl;
}

const customMailyKit = MailyKit.configure({
  imageUpload: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    onImageUpload: uploadImage,
  } as any,
});

function useTranslateMailyDom() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    const translateNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent?.trim();
        if (txt && UI_TRANSLATIONS[txt]) {
          node.textContent = node.textContent!.replace(txt, UI_TRANSLATIONS[txt]);
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      // Atributos comuns com texto
      ['placeholder', 'aria-label', 'title'].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v && UI_TRANSLATIONS[v.trim()]) {
          el.setAttribute(attr, UI_TRANSLATIONS[v.trim()]);
        }
      });
      el.childNodes.forEach(translateNode);
    };

    const run = () => {
      translateNode(root);
      ensureToolbarTooltips(root);
    };

    run();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(translateNode);
        if (m.type === 'characterData' && m.target) {
          translateNode(m.target);
        }
      }
      // Re-aplica tooltips em novos botões (toolbars bubble menu aparecem dinamicamente)
      ensureToolbarTooltips(root);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    // Observer GLOBAL no body pra pegar tooltips Radix que renderizam em portal
    const bodyObserver = new MutationObserver(() => {
      translateTooltipPortals();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      bodyObserver.disconnect();
    };
  }, []);

  return wrapperRef;
}

export function MailyEditor(props: Props) {
  const wrapperRef = useTranslateMailyDom();

  const variableExt = useMemo(
    () =>
      VariableExtension.configure({
        suggestion: getVariableSuggestions(),
        variables: VARIABLES,
      }),
    [],
  );

  return (
    <div ref={wrapperRef} className="contents">
      <Editor
        blocks={blocksPtBR}
        {...props}
        extensions={[customMailyKit, variableExt]}
      />
    </div>
  );
}
