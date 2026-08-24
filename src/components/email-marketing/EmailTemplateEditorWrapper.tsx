import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Save, Send, Eye, AlertTriangle, Loader2, Mail, Sparkles, Slash, AtSign, Wand2, X, MousePointerClick } from 'lucide-react';
import AITemplateGenerator from './AITemplateGenerator';
import EditableTemplateIframe, { type EditableTemplateIframeHandle } from './EditableTemplateIframe';
import { render } from '@maily-to/render';
import { MailyEditor } from '@/components/marketing-mod/MailyEditor';
import { useCreateEmailTemplate, useUpdateEmailTemplate, useEmailTemplate, useSendTestEmail } from '@/hooks/useEmailMarketing';
import { useToast } from '@/hooks/use-toast';
import EmailPreviewModal from './EmailPreviewModal';
import EmailAttachmentUploader from './EmailAttachmentUploader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  templateId?: string;
  onBack: () => void;
}

const DEFAULT_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { textAlign: 'left' },
      content: [
        { type: 'text', text: 'Olá, ' },
        { type: 'text', text: '@nome' },
        { type: 'text', text: '!' },
      ],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left' },
      content: [
        { type: 'text', text: 'Comece a editar este template. Use ' },
        { type: 'text', marks: [{ type: 'code' }], text: '/' },
        { type: 'text', text: ' para inserir blocos e ' },
        { type: 'text', marks: [{ type: 'code' }], text: '@' },
        { type: 'text', text: ' para variáveis (nome, primeiro_nome, empresa, etc).' },
      ],
    },
  ],
};

function isMailyJson(json: any): boolean {
  return !!json && typeof json === 'object' && json.type === 'doc' && Array.isArray(json.content);
}

export default function EmailTemplateEditorWrapper({ templateId, onBack }: Props) {
  const { data: existingTemplate, isLoading } = useEmailTemplate(templateId);
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const sendTest = useSendTestEmail();
  const { toast } = useToast();
  const editorRef = useRef<any>(null);
  const editableIframeRef = useRef<EditableTemplateIframeHandle | null>(null);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [initialJson, setInitialJson] = useState<any>(null);
  const [legacyHtml, setLegacyHtml] = useState<string | null>(null);
  const [showAIGen, setShowAIGen] = useState(false);
  // Upload de imagem direto no editor (antes o botao inseria um placeholder do
  // via.placeholder.com, que saiu do ar — dava "Error loading image" e obrigava
  // a ir na aba Anexos copiar URL na mao).
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aiGeneratedHtml, setAiGeneratedHtml] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (templateId && !existingTemplate) return;
    hydratedRef.current = true;

    if (!existingTemplate) {
      setInitialJson(DEFAULT_CONTENT);
      return;
    }

    setName(existingTemplate.name || '');
    setSubject(existingTemplate.subject || '');

    // Detecta template "oficial" + que Vencedores: tem HTML com header customizado (logo + que Vencedores ou tables com background)
    const html = existingTemplate.html_content || '';
    const isOfficial = !!html && (
      html.includes('email-assets/brand/squaad-logo') ||
      html.includes('+ que Vencedores Business Solutions') ||
      /<td[^>]+style="[^"]*background\s*:\s*(#000000|#3B82F6|#e8e8e8)/i.test(html)
    );

    if (isOfficial) {
      // Template oficial + que Vencedores: abre direto no AIQuickEditPanel (HTML cru não-editável pelo Maily)
      setAiGeneratedHtml(html);
      setPreviewHtml(html);
      setInitialJson(DEFAULT_CONTENT);
      toast({
        title: 'Modo de edição rápida',
        description: 'Template oficial + que Vencedores. Edite os campos no painel à esquerda, preview ao vivo no centro.',
      });
    } else if (isMailyJson(existingTemplate.content_json)) {
      // Template Maily editável normal
      setInitialJson(existingTemplate.content_json);
      setLegacyHtml(null);
    } else if (html) {
      // HTML legado sem identidade + que Vencedores: ainda assim abre no quick edit
      setAiGeneratedHtml(html);
      setPreviewHtml(html);
      setInitialJson(DEFAULT_CONTENT);
    } else {
      setInitialJson(DEFAULT_CONTENT);
    }
  }, [templateId, existingTemplate, toast]);

  useEffect(() => {
    const id = 'maily-editor-css';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = '/maily-editor.css';
    document.head.appendChild(link);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  const getCurrentJson = () => editorRef.current?.getJSON?.() || initialJson || DEFAULT_CONTENT;

  // Sobe a imagem pro bucket email-assets (mesmo do EmailAttachmentUploader) e
  // insere ja com a URL publica final. E a URL que o Resend vai servir no email,
  // entao precisa ser publica e absoluta — data URL nao serve (cliente de email
  // bloqueia e o tamanho estoura).
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const handleImageFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Isso não é uma imagem', description: 'Escolha um arquivo JPG, PNG, GIF ou WEBP.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: 'Imagem muito pesada', description: 'Máximo 5MB — acima disso o email cai em spam ou nem carrega.', variant: 'destructive' });
      return;
    }
    const editor = editorRef.current;
    if (!editor) {
      toast({ title: 'Editor não está pronto', variant: 'destructive' });
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
      editor.chain().focus().insertContent({
        type: 'image',
        attrs: { src: data.publicUrl, alt: file.name, width: '100%' },
      }).run();
      toast({ title: 'Imagem inserida', description: 'Já está hospedada — o lead vai ver ela no email.' });
    } catch (err: any) {
      toast({ title: 'Não consegui subir a imagem', description: err?.message || 'Erro no storage', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Informe o nome do template', variant: 'destructive' });
      return;
    }

    try {
      const json = getCurrentJson();
      // Se template foi gerado por IA ou é oficial (HTML customizado), pega o HTML EDITADO direto do iframe
      const html = aiGeneratedHtml
        ? (editableIframeRef.current?.getHtml() || aiGeneratedHtml)
        : (await render(json));

      if (templateId && existingTemplate) {
        await updateTemplate.mutateAsync({
          id: templateId,
          name,
          subject,
          html_content: html,
          content_json: aiGeneratedHtml ? null : json,
        });
        toast({ title: 'Template atualizado' });
      } else {
        await createTemplate.mutateAsync({
          name,
          subject,
          html_content: html,
          content_json: aiGeneratedHtml ? null : json,
        });
        toast({ title: aiGeneratedHtml ? 'Template IA salvo' : 'Template criado' });
      }
      onBack();
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar template', variant: 'destructive' });
    }
  };

  const handleAIResult = (data: { subject: string; preheader?: string; html_content: string }) => {
    setSubject(data.subject);
    setAiGeneratedHtml(data.html_content);
    setPreviewHtml(data.html_content);
    setShowPreview(true);
    if (!name.trim()) setName('Template IA');
  };

  const handlePreview = async () => {
    try {
      const json = getCurrentJson();
      const html = await render(json);
      setPreviewHtml(html);
      setShowPreview(true);
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao renderizar preview', variant: 'destructive' });
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim() || !testEmail.includes('@')) {
      toast({ title: 'Informe um email válido', variant: 'destructive' });
      return;
    }
    try {
      const json = getCurrentJson();
      const html = await render(json);
      await sendTest.mutateAsync({
        to: testEmail.trim(),
        subject: subject || 'Teste de Template',
        html_content: html,
      });
      toast({ title: `Teste enviado para ${testEmail.trim()}` });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao enviar teste', variant: 'destructive' });
    }
  };

  if ((isLoading && templateId) || initialJson === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[#BAA05E]" />
      </div>
    );
  }

  const isEditing = !!templateId;
  const saving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-muted/10">
      {/* Topbar — editorial slim */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 shrink-0">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
            </Button>
            <div className="h-5 w-px bg-border shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                Template Email
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#BAA05E]/10 text-[#BAA05E] font-medium uppercase tracking-wider">
                {isEditing ? 'Editando' : 'Novo'}
              </span>
            </div>
            <div className="h-5 w-px bg-border shrink-0" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sem título"
              className="h-9 text-sm font-semibold border-none shadow-none px-2 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-[#BAA05E]/30 max-w-md"
            />
            {legacyHtml && (
              <span className="text-xs text-amber-600 flex items-center gap-1 shrink-0">
                <AlertTriangle className="h-3 w-3" /> Template antigo recriado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-[#BAA05E]/40 text-[#917D3D] hover:bg-[#BAA05E]/10 hover:text-[#917D3D]"
              onClick={() => setShowAIGen(true)}
              disabled={saving}
            >
              <Wand2 className="h-3.5 w-3.5" /> Gerar com IA
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreview}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={onBack}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Salvando…' : (aiGeneratedHtml ? 'Salvar template IA' : 'Salvar')}
            </Button>
          </div>
        </div>
        {aiGeneratedHtml && (
          <div className="px-6 py-2 bg-[#BAA05E]/10 border-t border-[#BAA05E]/20 flex items-center gap-2 text-xs">
            <Sparkles className="h-3 w-3 text-[#BAA05E]" />
            <span className="text-[#917D3D] font-medium">Template gerado por IA.</span>
            <span className="text-muted-foreground">Será salvo com o HTML original da IA (não editável pelo Maily). Clica em Preview pra ver.</span>
            <button
              onClick={() => { setAiGeneratedHtml(null); toast({ title: 'IA descartada, voltou pro editor manual' }); }}
              className="ml-auto text-muted-foreground hover:text-foreground underline"
            >
              Descartar IA
            </button>
          </div>
        )}
      </header>

      {/* Body: 2 colunas */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] overflow-hidden">
        {/* Sidebar config */}
        <aside className="email-editor-sidebar border-r overflow-y-auto p-5 space-y-5">
          {/* Detalhes */}
          <section className="space-y-3">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
              Detalhes
            </Label>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assunto do email</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Bem-vindo à nossa marca"
                  className="text-sm h-9"
                />
              </div>
            </div>
          </section>

          {/* Variáveis dinâmicas — visíveis no modo edição WYSIWYG */}
          {aiGeneratedHtml && (
            <section className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
                <AtSign className="h-3 w-3" /> Inserir variável no cursor
              </Label>
              <Card className="border-[#BAA05E]/15 bg-[#BAA05E]/[0.04]">
                <CardContent className="p-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Clica numa variável pra inserir na posição do cursor. Ela vira o valor real do lead quando o email for enviado.
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { v: 'primeiro_nome', ex: 'Carlos' },
                      { v: 'nome', ex: 'Carlos Eduardo' },
                      { v: 'email', ex: 'carlos@email.com' },
                      { v: 'empresa', ex: '+ que Vencedores' },
                      { v: 'whatsapp', ex: '5571999999999' },
                      { v: 'vendedor', ex: 'João' },
                    ].map(({ v, ex }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => editableIframeRef.current?.insertText(`{{${v}}}`)}
                        className="text-left text-[11px] px-2 py-1.5 rounded bg-background hover:bg-[#BAA05E]/10 border border-transparent hover:border-[#BAA05E]/30 transition-colors group"
                        title={`Insere {{${v}}} no cursor. Vira "${ex}" no email enviado.`}
                      >
                        <code className="text-[#917D3D] font-mono font-medium">{`{{${v}}}`}</code>
                        <div className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                          vira "{ex}"
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug pt-1.5 border-t border-border/40">
                    💡 Tudo entre <code className="bg-muted px-1 rounded">{'{{...}}'}</code> é substituído pelos dados reais do lead no momento do envio.
                  </p>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Aviso no modo HTML editável */}
          {aiGeneratedHtml && (
            <section className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Modo edição WYSIWYG
              </Label>
              <Card className="border-[#BAA05E]/15 bg-[#BAA05E]/[0.04]">
                <CardContent className="p-3 text-xs space-y-2 text-muted-foreground">
                  <p>Clica direto no texto pra editar. Click em <strong>link/botão</strong> abre dialog pra mudar URL e cores.</p>
                  <button
                    onClick={() => { setAiGeneratedHtml(null); toast({ title: 'Voltou pro editor Maily' }); }}
                    className="text-muted-foreground hover:text-destructive underline text-[11px]"
                  >
                    Descartar HTML e voltar pro editor Maily
                  </button>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Atalhos — só faz sentido no modo Maily, não no AI quick edit */}
          {!aiGeneratedHtml && (
            <section className="space-y-3">
              <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Inserir bloco rápido
              </Label>
              <Card className="border-[#BAA05E]/15 bg-[#BAA05E]/[0.03]">
                <CardContent className="p-3 space-y-2 text-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 h-9 border-[#BAA05E]/30 hover:bg-[#BAA05E]/10"
                    onClick={() => {
                      const editor = editorRef.current;
                      if (!editor) return;
                      // Insere bloco "button" do Maily com texto e URL placeholders
                      try {
                        editor.chain().focus().insertContent({
                          type: 'button',
                          attrs: {
                            url: 'https://squaadcrm.com',
                            text: 'CLIQUE AQUI',
                            backgroundColor: '#3B82F6',
                            textColor: '#000000',
                            borderRadius: 8,
                            buttonColor: '#3B82F6',
                          },
                        }).run();
                        toast({ title: 'Botão inserido', description: 'Clica no botão pra editar texto, URL e cores no painel direito.' });
                      } catch (e: any) {
                        toast({ title: 'Use o atalho /', description: 'Digite / no editor e escolha "Button" do menu.', variant: 'destructive' });
                      }
                    }}
                  >
                    <MousePointerClick className="h-3.5 w-3.5 text-[#BAA05E]" />
                    <span className="font-medium">Inserir Botão CTA</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 h-9 border-[#BAA05E]/30 hover:bg-[#BAA05E]/10"
                    disabled={uploadingImage}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {uploadingImage
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#BAA05E]" />
                      : <span className="text-[#BAA05E]">🖼</span>}
                    <span className="font-medium">{uploadingImage ? 'Enviando imagem…' : 'Inserir Imagem'}</span>
                  </Button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 h-9 border-[#BAA05E]/30 hover:bg-[#BAA05E]/10"
                    onClick={() => {
                      const editor = editorRef.current;
                      if (!editor) return;
                      try {
                        editor.chain().focus().insertContent({ type: 'horizontalRule' }).run();
                      } catch {}
                    }}
                  >
                    <span className="text-[#BAA05E]">—</span>
                    <span className="font-medium">Inserir Divisor</span>
                  </Button>
                  <div className="pt-1.5 mt-1.5 border-t border-[#BAA05E]/15 space-y-1.5">
                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <kbd className="mt-0.5 inline-flex items-center justify-center h-4 w-4 rounded bg-background border text-[9px] font-mono shrink-0">/</kbd>
                      Mostra menu de blocos
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <kbd className="mt-0.5 inline-flex items-center justify-center h-4 w-4 rounded bg-background border text-[9px] font-mono shrink-0">@</kbd>
                      Insere variável ({'{{nome}}'} etc)
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Enviar teste */}
          <section className="space-y-3">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Enviar teste
            </Label>
            <Card className="border-dashed">
              <CardContent className="p-3 space-y-2.5">
                <p className="text-xs text-muted-foreground leading-snug">
                  Envie pra você mesmo antes de criar a campanha. Variáveis viram valores fictícios.
                </p>
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="text-sm h-9 pl-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendTest();
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 h-9 border-[#BAA05E]/30 text-[#917D3D] hover:bg-[#BAA05E]/10 hover:text-[#917D3D]"
                    onClick={handleSendTest}
                    disabled={sendTest.isPending}
                  >
                    {sendTest.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {sendTest.isPending ? 'Enviando…' : 'Enviar email de teste'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Anexos */}
          <EmailAttachmentUploader />

          {/* Variáveis disponíveis */}
          <section className="space-y-3">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium flex items-center gap-1.5">
              <AtSign className="h-3 w-3" /> Variáveis disponíveis
            </Label>
            <div className="flex flex-wrap gap-1">
              {[
                'nome',
                'primeiro_nome',
                'empresa',
                'email',
                'telefone',
                'cidade',
                'estado',
                'vendedor',
                'onboarding_url',
                'link_plataforma',
                'acessar_plataforma',
                'unsubscribe_url',
              ].map((v) => (
                <span
                  key={v}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border"
                >
                  @{v}
                </span>
              ))}
            </div>
          </section>
        </aside>

        {/* Editor — Maily quando manual, ou iframe live preview quando IA gerou */}
        <main className="overflow-y-auto bg-zinc-100 dark:bg-zinc-900/40">
          <div className="max-w-3xl mx-auto p-6">
            {aiGeneratedHtml ? (
              <>
                <EditableTemplateIframe
                  ref={editableIframeRef}
                  initialHtml={aiGeneratedHtml}
                  onChange={(newHtml) => { setPreviewHtml(newHtml); }}
                  height={720}
                />
                <p className="text-[11px] text-center text-muted-foreground italic mt-4">
                  Edita direto no template. Enter quebra linha. Selecione o texto e use a toolbar pra formatar.
                </p>
              </>
            ) : (
              <>
                <div
                  className="maily-paper bg-white text-zinc-900 rounded-2xl border border-zinc-200 shadow-xl overflow-hidden"
                  style={{ colorScheme: 'light' }}
                >
                  <MailyEditor
                    key={templateId || 'new'}
                    contentJson={initialJson}
                    onCreate={(editor) => {
                      editorRef.current = editor;
                    }}
                    onUpdate={(editor) => {
                      editorRef.current = editor;
                    }}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] text-center text-muted-foreground italic">
                    Editor isolado em modo claro · use <kbd className="text-[10px] px-1 py-0.5 rounded bg-muted border">/</kbd> pra blocos · <kbd className="text-[10px] px-1 py-0.5 rounded bg-muted border">@</kbd> pra variáveis
                  </p>
                  <div className="rounded-lg border border-[#BAA05E]/20 bg-[#BAA05E]/[0.04] p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1 flex items-center gap-1.5">
                      <MousePointerClick className="h-3 w-3 text-[#BAA05E]" />
                      Como inserir um botão com link clicável:
                    </p>
                    <ol className="list-decimal pl-5 space-y-0.5 leading-relaxed">
                      <li>Posicione o cursor onde quer o botão</li>
                      <li>Digite <kbd className="text-[10px] px-1 py-0.5 rounded bg-muted border">/</kbd> e procure <strong>"Botão"</strong> (ou <em>Button</em>)</li>
                      <li>Edite o texto do botão direto nele</li>
                      <li>Clica no botão criado para abrir as opções e cola a URL no campo <strong>"Link"</strong> do painel direito</li>
                    </ol>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <AITemplateGenerator
        open={showAIGen}
        onOpenChange={setShowAIGen}
        onResult={handleAIResult}
      />

      <EmailPreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        html={previewHtml || legacyHtml || ''}
        subject={subject}
      />
    </div>
  );
}
