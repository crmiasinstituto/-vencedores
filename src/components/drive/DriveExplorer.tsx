// Acervo de arquivos do time (pastas + arquivos no Backblaze B2).
// Reusado pela pagina externa do time (/time) e pelo admin (/admin/acervo).
// Toda a leitura/escrita passa por RLS: time via x-team-token, admin via JWT.
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadToB2, fileTypeFromName, humanFileSize } from '@/lib/b2Upload';
import { generateThumbnail, generateThumbnailFromUrl } from '@/lib/thumbnail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Folder, FileText, FileVideo, FileImage, FileAudio, FileArchive, File as FileIcon,
  Upload, FolderPlus, Download, Trash2, ChevronRight, Loader2, Search, ArrowLeft, Play,
} from 'lucide-react';

const db = supabase as any;

interface DriveFolder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
}
interface DriveFile {
  id: string;
  folder_id: string | null;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  uploaded_by: string | null;
  created_at: string;
}

function FileTypeIcon({ type, className }: { type: string | null; className?: string }) {
  const t = type || 'file';
  if (t === 'video') return <FileVideo className={className} />;
  if (t === 'image') return <FileImage className={className} />;
  if (t === 'audio') return <FileAudio className={className} />;
  if (t === 'zip') return <FileArchive className={className} />;
  if (['pdf', 'doc', 'xlsx', 'slide'].includes(t)) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

interface Props {
  actorName: string; // nome denormalizado de quem sobe/cria (time ou "Admin")
}

export default function DriveExplorer({ actorName }: Props) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<DriveFolder[]>([]); // breadcrumb (raiz = [])
  const [search, setSearch] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploads, setUploads] = useState<Record<string, number>>({}); // nome -> pct
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attemptedThumbs = useRef<Set<string>>(new Set()); // backfill: ids ja tentados

  const currentFolder = path.length ? path[path.length - 1] : null;
  const currentFolderId = currentFolder?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    const fol = currentFolderId
      ? db.from('drive_folders').select('*').eq('parent_id', currentFolderId)
      : db.from('drive_folders').select('*').is('parent_id', null);
    const fil = currentFolderId
      ? db.from('drive_files').select('*').eq('folder_id', currentFolderId)
      : db.from('drive_files').select('*').is('folder_id', null);

    const [{ data: fd, error: fe }, { data: fid, error: fie }] = await Promise.all([
      fol.order('name'),
      fil.order('created_at', { ascending: false }),
    ]);
    if (fe || fie) {
      toast.error('Falha ao carregar o acervo. Recarregue a pagina.');
    }
    setFolders((fd as DriveFolder[]) || []);
    setFiles((fid as DriveFile[]) || []);
    setLoading(false);
  }, [currentFolderId]);

  useEffect(() => { load(); }, [load]);

  // Backfill: arquivos antigos (foto/video) que ainda nao tem miniatura ganham
  // uma agora, gerada a partir da URL no B2. Best-effort, em segundo plano, sem
  // travar a UI; marca o id como tentado pra nao reprocessar a cada render.
  useEffect(() => {
    const pending = files.filter(
      (f) => !f.thumbnail_url
        && (f.file_type === 'image' || f.file_type === 'video')
        && !attemptedThumbs.current.has(f.id)
    );
    if (!pending.length) return;
    pending.forEach((f) => attemptedThumbs.current.add(f.id));
    let cancelled = false;
    (async () => {
      for (const f of pending) {
        if (cancelled) break;
        try {
          const blob = await generateThumbnailFromUrl(f.file_url, f.file_type);
          if (!blob) continue;
          const tf = new File([blob], `${f.name}.thumb.jpg`, { type: 'image/jpeg' });
          const tRes = await uploadToB2(tf, 'drive/thumbnails');
          if (!tRes) continue;
          await db.from('drive_files').update({ thumbnail_url: tRes.public_url }).eq('id', f.id);
          if (!cancelled) {
            setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, thumbnail_url: tRes.public_url } : x)));
          }
        } catch { /* mantem o icone */ }
      }
    })();
    return () => { cancelled = true; };
  }, [files]);

  // ─── Criar pasta ──────────────────────────────────────────
  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await db.from('drive_folders').insert({
      name, parent_id: currentFolderId, created_by: actorName,
    });
    setBusy(false);
    if (error) { toast.error('Nao consegui criar a pasta.'); return; }
    setNewFolderName('');
    setNewFolderOpen(false);
    toast.success('Pasta criada');
    load();
  };

  // ─── Upload (multiplo) ────────────────────────────────────
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const arr = Array.from(fileList);
    for (const file of arr) {
      const label = file.name;
      setUploads((u) => ({ ...u, [label]: 0 }));
      try {
        const res = await uploadToB2(
          file,
          `drive/${currentFolderId || 'root'}`,
          (pct) => setUploads((u) => ({ ...u, [label]: pct }))
        );
        if (!res) throw new Error('upload vazio');

        // Miniatura (foto reduzida / frame do video) pra identificacao visual.
        // Best-effort: se falhar, segue sem thumb (cai no icone do tipo).
        let thumbnailUrl: string | null = null;
        try {
          const thumb = await generateThumbnail(file);
          if (thumb) {
            const thumbFile = new File([thumb], `${file.name}.thumb.jpg`, { type: 'image/jpeg' });
            const tRes = await uploadToB2(thumbFile, 'drive/thumbnails');
            thumbnailUrl = tRes?.public_url ?? null;
          }
        } catch { /* sem miniatura */ }

        const { error } = await db.from('drive_files').insert({
          folder_id: currentFolderId,
          name: file.name,
          file_url: res.public_url,
          file_key: res.key,
          file_type: fileTypeFromName(file.name),
          file_size: file.size,
          mime: file.type || null,
          thumbnail_url: thumbnailUrl,
          uploaded_by: actorName,
        });
        if (error) throw error;
      } catch (e: any) {
        toast.error(`Erro ao enviar ${file.name}: ${e.message || e}`);
      } finally {
        setUploads((u) => { const n = { ...u }; delete n[label]; return n; });
      }
    }
    toast.success('Upload concluido');
    if (fileInputRef.current) fileInputRef.current.value = '';
    load();
  };

  // ─── Excluir ──────────────────────────────────────────────
  const deleteFile = async (f: DriveFile) => {
    if (!confirm(`Excluir "${f.name}"? Esta acao nao pode ser desfeita.`)) return;
    const { error } = await db.from('drive_files').delete().eq('id', f.id);
    if (error) { toast.error('Nao consegui excluir.'); return; }
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    toast.success('Arquivo excluido');
  };
  const deleteFolder = async (folder: DriveFolder) => {
    if (!confirm(`Excluir a pasta "${folder.name}" e TODO o conteudo dentro dela?`)) return;
    const { error } = await db.from('drive_folders').delete().eq('id', folder.id);
    if (error) { toast.error('Nao consegui excluir a pasta.'); return; }
    setFolders((prev) => prev.filter((x) => x.id !== folder.id));
    toast.success('Pasta excluida');
  };

  const openFolder = (folder: DriveFolder) => { setSearch(''); setPath((p) => [...p, folder]); };
  const goToCrumb = (idx: number) => { setSearch(''); setPath((p) => p.slice(0, idx)); };

  const q = search.trim().toLowerCase();
  const visFolders = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
  const visFiles = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
  const empty = !loading && !visFolders.length && !visFiles.length;
  const uploadList = Object.entries(uploads);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 text-sm flex-wrap min-w-0">
          {path.length > 0 && (
            <button onClick={() => goToCrumb(path.length - 1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => goToCrumb(0)} className="font-medium hover:text-[#3B82F6] shrink-0">
            Acervo
          </button>
          {path.map((f, i) => (
            <span key={f.id} className="flex items-center gap-2 min-w-0">
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <button onClick={() => goToCrumb(i + 1)} className="hover:text-[#3B82F6] truncate max-w-[140px]">
                {f.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 h-9 w-36 sm:w-48"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="w-4 h-4 mr-1" /> Pasta
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">
            <Upload className="w-4 h-4 mr-1" /> Enviar
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      {/* Uploads em andamento */}
      {uploadList.length > 0 && (
        <div className="space-y-2 rounded-lg border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-3">
          {uploadList.map(([name, pct]) => (
            <div key={name} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="truncate max-w-[70%]">{name}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : empty ? (
        <div className="text-center py-16 text-muted-foreground">
          <Folder className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{q ? 'Nada encontrado.' : 'Pasta vazia. Envie arquivos ou crie uma pasta.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Pastas */}
          {visFolders.map((folder) => (
            <div
              key={folder.id}
              className="group relative rounded-xl border border-border bg-card hover:border-[#3B82F6]/50 transition-colors p-4 cursor-pointer"
              onClick={() => openFolder(folder)}
            >
              <Folder className="w-8 h-8 mb-2" style={{ color: folder.color || '#3B82F6' }} fill="currentColor" fillOpacity={0.15} />
              <p className="text-sm font-medium truncate">{folder.name}</p>
              <p className="text-xs text-muted-foreground">Pasta</p>
              <button
                onClick={(e) => { e.stopPropagation(); deleteFolder(folder); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition"
                title="Excluir pasta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {/* Arquivos */}
          {visFiles.map((file) => (
            <div
              key={file.id}
              className="group relative rounded-xl border border-border bg-card hover:border-[#3B82F6]/50 transition-colors overflow-hidden"
            >
              {file.thumbnail_url ? (
                <a
                  href={file.file_url} target="_blank" rel="noopener noreferrer"
                  className="block relative aspect-video bg-black/40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img src={file.thumbnail_url} alt={file.name} loading="lazy" className="w-full h-full object-contain" />
                  {file.file_type === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white translate-x-0.5" fill="currentColor" />
                      </span>
                    </span>
                  )}
                </a>
              ) : (
                <div className="aspect-video bg-muted/30 flex items-center justify-center">
                  <FileTypeIcon type={file.file_type} className="w-9 h-9 text-[#3B82F6]" />
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {humanFileSize(file.file_size)}{file.uploaded_by ? ` · ${file.uploaded_by}` : ''}
                </p>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <a
                  href={file.file_url} target="_blank" rel="noopener noreferrer" download
                  className="w-7 h-7 rounded-md bg-black/55 text-white/90 hover:text-[#3B82F6] flex items-center justify-center" title="Baixar / abrir"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={() => deleteFile(file)} className="w-7 h-7 rounded-md bg-black/55 text-white/90 hover:text-red-500 flex items-center justify-center" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova pasta */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>
              {currentFolder ? `Dentro de "${currentFolder.name}"` : 'Na raiz do acervo'}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); }}
            placeholder="Ex: Takes brutos, Videos prontos, PDFs..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
            <Button onClick={createFolder} disabled={busy || !newFolderName.trim()} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
