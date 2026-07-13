import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Loader2, FileCheck, Link as LinkIcon, Video, RefreshCw } from 'lucide-react';

const db = supabase as any;

const IMPORT_METHODS = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'lovable', label: 'Lovable' },
  { id: 'gpt-agent', label: 'GPT / Agente' },
];

interface ModuleOption {
  id: string;
  title: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any | null; // linha de member_files sendo editada, ou null pra novo
  modules: ModuleOption[];
  onSaved: () => void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function fileTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xlsx';
  if (ext === 'zip') return 'zip';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
  return ext || 'file';
}

// ISO (UTC) -> valor pro <input type="datetime-local"> (horario local do admin)
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
// valor do datetime-local -> ISO (UTC) pra salvar
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v); // interpretado como horario local
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const EMPTY = {
  title: '',
  slug: '',
  description: '',
  long_description: '',
  file_url: '',
  file_type: 'pdf',
  file_size: null as number | null,
  category: 'template',
  difficulty: '',
  setup_time: '',
  thumbnail: '',
  video_url: '',
  video_title: '',
  publish_at: '', // datetime-local; vazio = publica imediatamente
  stack: '', // csv
  features: '', // uma por linha
  prerequisites: '', // "Label | url" por linha
  installation_guide: '',
  documentation: '',
  troubleshooting: '',
  env_example: '',
  sql_migrations: '',
  lovable_remix_url: '',
  import_methods: ['claude-code'] as string[],
  related_module_id: '',
  tags: '', // csv
  is_published: true,
  is_featured: false,
  order_index: 0,
};

export default function AcceleratorEditor({
  open,
  onOpenChange,
  editing,
  modules,
  onSaved,
}: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...EMPTY,
        ...editing,
        slug: editing.slug || '',
        description: editing.description || '',
        long_description: editing.long_description || '',
        difficulty: editing.difficulty || '',
        setup_time: editing.setup_time || '',
        thumbnail: editing.thumbnail || '',
        video_url: editing.video_url || '',
        video_title: editing.video_title || '',
        publish_at: isoToLocalInput(editing.publish_at),
        installation_guide: editing.installation_guide || '',
        documentation: editing.documentation || '',
        troubleshooting: editing.troubleshooting || '',
        env_example: editing.env_example || '',
        sql_migrations: editing.sql_migrations || '',
        lovable_remix_url: editing.lovable_remix_url || '',
        related_module_id: editing.related_module_id || '',
        stack: Array.isArray(editing.stack) ? editing.stack.join(', ') : '',
        tags: Array.isArray(editing.tags) ? editing.tags.join(', ') : '',
        features: Array.isArray(editing.features) ? editing.features.join('\n') : '',
        prerequisites: Array.isArray(editing.prerequisites)
          ? editing.prerequisites
              .map((p: any) => (p.url ? `${p.label} | ${p.url}` : p.label))
              .join('\n')
          : '',
        import_methods:
          Array.isArray(editing.import_methods) && editing.import_methods.length
            ? editing.import_methods
            : ['claude-code'],
        is_published: editing.is_published ?? true,
        is_featured: editing.is_featured ?? false,
        order_index: editing.order_index ?? 0,
      });
      setSlugTouched(true);
    } else {
      setForm({ ...EMPTY });
      setSlugTouched(false);
    }
  }, [open, editing]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const onTitleChange = (title: string) => {
    set({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });
  };

  // Upload pro Backblaze B2 (mesmo storage das aulas) via presigned URL.
  // Aguenta arquivos grandes (ZIP de projeto) sem o limite/egress do Supabase.
  const uploadFile = async (
    file: File,
    prefix: string,
    onProgress?: (pct: number) => void
  ): Promise<string | null> => {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `accelerators/${prefix}/${Date.now()}-${safe}`;
    const contentType = file.type || 'application/octet-stream';

    const { data: sign, error: signErr } = await supabase.functions.invoke(
      'create-b2-upload-url',
      { body: { key, contentType, expiresIn: '7200' } }
    );
    if (signErr || !sign?.upload_url) {
      toast.error(`Falha ao assinar upload: ${sign?.error || signErr?.message || 'sem URL'}`);
      return null;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sign.upload_url, true);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable && onProgress) {
            onProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error('erro de rede'));
        xhr.send(file);
      });
    } catch (e: any) {
      toast.error(`Erro no upload pro Backblaze: ${e.message}`);
      return null;
    }

    return sign.public_url as string;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    const url = await uploadFile(file, 'files', setProgress);
    setUploading(false);
    if (url) {
      set({
        file_url: url,
        file_type: fileTypeFromName(file.name),
        file_size: file.size,
        title: form.title || file.name.replace(/\.[^.]+$/, ''),
        slug: slugTouched || form.slug ? form.slug : slugify(file.name.replace(/\.[^.]+$/, '')),
      });
      toast.success('Arquivo enviado');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    const url = await uploadFile(file, 'thumbnails');
    setUploadingThumb(false);
    if (url) {
      set({ thumbnail: url });
      toast.success('Capa enviada');
    }
    if (thumbRef.current) thumbRef.current.value = '';
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    setProgress(0);
    const url = await uploadFile(file, 'videos', setProgress);
    setUploadingVideo(false);
    if (url) {
      set({
        video_url: url,
        video_title: form.video_title || 'Aula de instrução',
      });
      toast.success('Vídeo enviado');
    }
    if (videoRef.current) videoRef.current.value = '';
  };

  // Gravar a aula pela estrutura + que Vencedores (mesma sala /meet das aulas).
  // Cria a meeting com target_accelerator_id e abre a sala. Depois o admin
  // clica "Puxar gravacao" pra vincular o recording_url ao acelerador.
  const startRecording = async () => {
    if (!editing?.id) {
      toast.error('Salve o acelerador primeiro pra liberar a gravação');
      return;
    }
    const room = `acel-${editing.id.slice(0, 8)}-${Date.now()}`;
    const host = '+ que Vencedores';
    const { error } = await db.from('meetings').insert({
      title: form.video_title || `Aula: ${form.title}`,
      livekit_room_name: room,
      status: 'scheduled',
      kind: 'lesson',
      lesson_mode: true,
      target_accelerator_id: editing.id,
      target_lesson_title: form.video_title || form.title,
      host_name: host,
      scheduled_at: new Date().toISOString(),
    });
    if (error) {
      toast.error('Erro ao criar sala: ' + error.message);
      return;
    }
    window.open(
      `/meet/${room}?mode=lesson&role=host&name=${encodeURIComponent(host)}`,
      '_blank'
    );
    toast.success('Sala aberta em nova aba. Grave, encerre e clique em "Puxar gravação".');
  };

  const pullRecording = async () => {
    if (!editing?.id) return;
    const { data } = await db
      .from('meetings')
      .select('recording_url, target_lesson_title, title')
      .eq('target_accelerator_id', editing.id)
      .not('recording_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const m = data?.[0];
    if (!m?.recording_url) {
      toast.message('Nenhuma gravação pronta ainda. Encerre a gravação e aguarde ~1 min.');
      return;
    }
    set({
      video_url: m.recording_url,
      video_title: form.video_title || m.target_lesson_title || m.title || 'Aula de instrução',
    });
    toast.success('Gravação vinculada. Clique em Salvar pra publicar.');
  };

  const toggleMethod = (id: string) => {
    set({
      import_methods: form.import_methods.includes(id)
        ? form.import_methods.filter((m) => m !== id)
        : [...form.import_methods, id],
    });
  };

  const parseList = (s: string) =>
    s
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const parsePrereqs = (s: string) =>
    s
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, url] = line.split('|').map((x) => x.trim());
        return url ? { label, url } : { label };
      });

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('Título obrigatório');
      return;
    }
    if (!form.file_url.trim()) {
      toast.error('Envie um arquivo ou cole a URL');
      return;
    }
    setSaving(true);

    const payload: Record<string, any> = {
      title: form.title.trim(),
      slug: (form.slug || slugify(form.title)).trim() || null,
      description: form.description.trim() || null,
      long_description: form.long_description.trim() || null,
      file_url: form.file_url.trim(),
      file_type: form.file_type,
      file_size: form.file_size,
      category: form.category,
      difficulty: form.difficulty || null,
      setup_time: form.setup_time.trim() || null,
      thumbnail: form.thumbnail.trim() || null,
      video_url: form.video_url.trim() || null,
      video_title: form.video_title.trim() || null,
      publish_at: localInputToIso(form.publish_at),
      stack: form.stack.trim() ? parseList(form.stack) : null,
      features: form.features.trim() ? parseList(form.features) : null,
      prerequisites: form.prerequisites.trim() ? parsePrereqs(form.prerequisites) : null,
      installation_guide: form.installation_guide.trim() || null,
      documentation: form.documentation.trim() || null,
      troubleshooting: form.troubleshooting.trim() || null,
      env_example: form.env_example.trim() || null,
      sql_migrations: form.sql_migrations.trim() || null,
      lovable_remix_url: form.lovable_remix_url.trim() || null,
      import_methods: form.import_methods.length ? form.import_methods : null,
      related_module_id: form.related_module_id || null,
      tags: form.tags.trim() ? parseList(form.tags) : null,
      is_published: form.is_published,
      is_featured: form.is_featured,
      order_index: Number(form.order_index) || 0,
    };

    let error;
    if (editing?.id) {
      ({ error } = await db.from('member_files').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await db
        .from('member_files')
        .insert({ ...payload, uploaded_by: 'admin' }));
    }

    setSaving(false);
    if (error) {
      toast.error(
        error.code === '23505'
          ? 'Já existe um acelerador com esse slug'
          : `Erro ao salvar: ${error.message}`
      );
      return;
    }
    toast.success(editing ? 'Acelerador atualizado' : 'Acelerador criado');
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar acelerador' : 'Novo acelerador'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Arquivo ── */}
          <section className="space-y-2">
            <Label className="text-sm font-semibold">Arquivo do acelerador *</Label>
            <p className="text-xs text-muted-foreground">
              Suba o arquivo (ZIP, PDF, planilha...) que o aluno vai baixar. Vai pro Backblaze, aguenta arquivos grandes.
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".zip,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.mp4,.mov,.mp3"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1.5" />
                )}
                {uploading ? `Enviando... ${progress}%` : 'Subir arquivo'}
              </Button>
              {form.file_url && !uploading && (
                <Badge className="bg-green-500/15 text-green-500 border-green-500/30">
                  <FileCheck className="w-3 h-3 mr-1" />
                  {form.file_type?.toUpperCase()}
                  {form.file_size ? ` · ${(form.file_size / 1024 / 1024).toFixed(1)}MB` : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={form.file_url}
                onChange={(e) => set({ file_url: e.target.value })}
                placeholder="...ou cole uma URL externa"
                className="text-xs"
              />
            </div>
          </section>

          {/* ── Básico ── */}
          <section className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => onTitleChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: slugify(e.target.value) });
                }}
                placeholder="meu-acelerador"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição curta</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => set({ category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Template (Acelerador)</SelectItem>
                    <SelectItem value="ferramenta">Ferramenta</SelectItem>
                    <SelectItem value="guia">Guia</SelectItem>
                    <SelectItem value="geral">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dificuldade</Label>
                <Select
                  value={form.difficulty || 'none'}
                  onValueChange={(v) => set({ difficulty: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="Iniciante">Iniciante</SelectItem>
                    <SelectItem value="Intermediário">Intermediário</SelectItem>
                    <SelectItem value="Avançado">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tempo de setup</Label>
                <Input
                  value={form.setup_time}
                  onChange={(e) => set({ setup_time: e.target.value })}
                  placeholder="ex: 10 min"
                />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.order_index}
                  onChange={(e) => set({ order_index: Number(e.target.value) })}
                />
              </div>
            </div>
          </section>

          {/* ── Capa / vídeo ── */}
          <section className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label>Capa (thumbnail)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={thumbRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleThumbUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => thumbRef.current?.click()}
                  disabled={uploadingThumb}
                >
                  {uploadingThumb ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-1.5" />
                  )}
                  Subir capa
                </Button>
                {form.thumbnail && (
                  <img
                    src={form.thumbnail}
                    alt="capa"
                    className="h-10 w-16 object-cover rounded border"
                  />
                )}
              </div>
            </div>
          </section>

          {/* ── Aula de instrução ── */}
          <section className="space-y-3 border-t pt-4">
            <div>
              <Label className="text-sm font-semibold">Aula de instrução (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Explique o template e as configurações iniciais. Grave pela sala + que Vencedores (igual às aulas), suba um arquivo, ou cole um embed do YouTube. Dá pra adicionar a qualquer momento.
              </p>
            </div>

            {/* Gravar pela estrutura + que Vencedores */}
            {editing?.id ? (
              <div className="rounded-lg border border-dashed border-border p-3 space-y-2 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Grave pela nossa estrutura: abre a sala em nova aba, você grava e encerra, depois clica em "Puxar gravação" pra vincular aqui.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={startRecording}>
                    <Video className="w-4 h-4 mr-1.5" />
                    Gravar aula (sala + que Vencedores)
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={pullRecording}>
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Puxar gravação
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-600">
                Salve o acelerador primeiro pra liberar a gravação pela sala + que Vencedores.
              </p>
            )}
            <div className="space-y-2">
              <Label>Título da aula</Label>
              <Input
                value={form.video_title}
                onChange={(e) => set({ video_title: e.target.value })}
                placeholder="Ex: Como montar seu CRM com esse template"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={videoRef}
                type="file"
                className="hidden"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                onChange={handleVideoUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => videoRef.current?.click()}
                disabled={uploadingVideo}
              >
                {uploadingVideo ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1.5" />
                )}
                {uploadingVideo ? `Enviando vídeo... ${progress}%` : 'Subir vídeo'}
              </Button>
              {form.video_url && !uploadingVideo && (
                <Badge className="bg-green-500/15 text-green-500 border-green-500/30">
                  <FileCheck className="w-3 h-3 mr-1" />
                  vídeo ok
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">...ou cole um embed (YouTube/Vimeo)</Label>
              <Input
                value={form.video_url}
                onChange={(e) => set({ video_url: e.target.value })}
                placeholder="https://youtube.com/embed/..."
                className="text-xs"
              />
            </div>
          </section>

          {/* ── Conteúdo rico ── */}
          <section className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label>Descrição longa</Label>
              <Textarea
                value={form.long_description}
                onChange={(e) => set({ long_description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Stack (separado por vírgula)</Label>
              <Input
                value={form.stack}
                onChange={(e) => set({ stack: e.target.value })}
                placeholder="React, Supabase, Tailwind"
              />
            </div>
            <div className="space-y-2">
              <Label>Features (uma por linha)</Label>
              <Textarea
                value={form.features}
                onChange={(e) => set({ features: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Pré-requisitos (uma por linha: Texto | URL)</Label>
              <Textarea
                value={form.prerequisites}
                onChange={(e) => set({ prerequisites: e.target.value })}
                rows={2}
                placeholder="Conta no Supabase | https://supabase.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Variáveis de ambiente</Label>
              <Textarea
                value={form.env_example}
                onChange={(e) => set({ env_example: e.target.value })}
                rows={2}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>SQL / Migrations</Label>
              <Textarea
                value={form.sql_migrations}
                onChange={(e) => set({ sql_migrations: e.target.value })}
                rows={2}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Documentação</Label>
              <Textarea
                value={form.documentation}
                onChange={(e) => set({ documentation: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Troubleshooting (use ### Pergunta para virar FAQ)</Label>
              <Textarea
                value={form.troubleshooting}
                onChange={(e) => set({ troubleshooting: e.target.value })}
                rows={3}
                placeholder={'### O modal está vazio\nSeu CRM usa tabelas com outro nome...'}
              />
            </div>
          </section>

          {/* ── Distribuição ── */}
          <section className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label>Métodos de import</Label>
              <div className="flex gap-2 flex-wrap">
                {IMPORT_METHODS.map((m) => {
                  const active = form.import_methods.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMethod(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary/15 text-primary border-primary/40'
                          : 'bg-muted/40 text-muted-foreground border-border'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL de remix no Lovable</Label>
              <Input
                value={form.lovable_remix_url}
                onChange={(e) => set({ lovable_remix_url: e.target.value })}
                placeholder="https://lovable.dev/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Trilha vinculada</Label>
              <Select
                value={form.related_module_id || 'none'}
                onValueChange={(v) => set({ related_module_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags (separado por vírgula)</Label>
              <Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
            </div>
          </section>

          {/* ── Status ── */}
          <section className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Publicado (visível pros alunos)</Label>
              <Switch
                checked={form.is_published}
                onCheckedChange={(v) => set({ is_published: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Destaque</Label>
              <Switch
                checked={form.is_featured}
                onCheckedChange={(v) => set({ is_featured: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Liberar pros alunos em (agendamento)</Label>
              <p className="text-xs text-muted-foreground">
                Deixe vazio pra liberar na hora. Se preencher uma data futura, o acelerador fica oculto pros alunos até esse momento (no seu horário).
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={form.publish_at}
                  onChange={(e) => set({ publish_at: e.target.value })}
                />
                {form.publish_at && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set({ publish_at: '' })}
                  >
                    Limpar
                  </Button>
                )}
              </div>
              {form.publish_at && localInputToIso(form.publish_at) && new Date(form.publish_at) > new Date() && (
                <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">
                  Oculto até {new Date(form.publish_at).toLocaleString('pt-BR')}
                </Badge>
              )}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
