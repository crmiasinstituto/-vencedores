import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, FileText, Image as ImageIcon, Video, Music, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type MediaTipo = 'image' | 'video' | 'document' | 'audio';

/** O que a uazapi espera em `type` para cada arquivo. */
export function tipoDoArquivo(nomeOuMime: string): MediaTipo {
  const s = nomeOuMime.toLowerCase();
  if (/^image\/|\.(png|jpe?g|gif|webp|bmp|svg)$/.test(s)) return 'image';
  if (/^video\/|\.(mp4|mov|avi|mkv|webm|3gp)$/.test(s)) return 'video';
  if (/^audio\/|\.(mp3|ogg|wav|m4a|aac|opus)$/.test(s)) return 'audio';
  return 'document';
}

const ICONE: Record<MediaTipo, any> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
};

/** 90 MB — acima disso o WhatsApp recusa e não adianta subir. */
const LIMITE_BYTES = 90 * 1024 * 1024;

interface Props {
  value: string;
  onChange: (url: string, tipo: MediaTipo | null) => void;
  tipo?: MediaTipo | null;
  /** Pasta dentro do bucket, para não misturar com upload de outras telas. */
  folder?: string;
  className?: string;
}

/**
 * Arrastar o arquivo pra cá, ou colar a URL. Aceita imagem, vídeo, áudio e documento
 * (PDF, planilha, slide...) — o tipo é deduzido do arquivo e vai junto pro envio.
 */
export function MediaDropzone({ value, onChange, tipo, folder = 'cadencias', className }: Props) {
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const subir = useCallback(
    async (file: File) => {
      if (file.size > LIMITE_BYTES) {
        toast.error(
          `"${file.name}" tem ${(file.size / 1024 / 1024).toFixed(0)} MB. O limite é 90 MB.`,
        );
        return;
      }
      setEnviando(true);
      setProgresso(file.name);
      try {
        const ext = file.name.split('.').pop() || 'bin';
        const nome = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await supabase.storage
          .from('uploads')
          .upload(nome, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (error) throw error;

        const { data } = supabase.storage.from('uploads').getPublicUrl(nome);
        onChange(data.publicUrl, tipoDoArquivo(file.type || file.name));
        toast.success(`"${file.name}" anexado`);
      } catch (e: any) {
        console.error('Erro no upload:', e);
        toast.error(e?.message || 'Não consegui subir o arquivo');
      } finally {
        setEnviando(false);
        setProgresso('');
      }
    },
    [folder, onChange],
  );

  const aoSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) subir(file);
  };

  const Icone = tipo ? ICONE[tipo] : Upload;
  const nomeDoArquivo = value ? decodeURIComponent(value.split('/').pop() || '') : '';
  const ehUploadNosso = value.includes('/storage/v1/object/public/uploads/');

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        onClick={() => !enviando && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        className={cn(
          'rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors',
          arrastando
            ? 'border-[#25d366] bg-[#25d366]/10'
            : 'border-border/60 hover:border-[#25d366]/50 hover:bg-muted/30',
          enviando && 'pointer-events-none opacity-70',
        )}
      >
        {enviando ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Subindo {progresso}…
          </div>
        ) : value ? (
          <div className="flex items-center gap-3 text-left">
            {tipo === 'image' ? (
              <img src={value} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded bg-muted/50 flex items-center justify-center shrink-0">
                <Icone className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {ehUploadNosso ? nomeDoArquivo : value}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {tipo === 'image' ? 'Imagem' :
                 tipo === 'video' ? 'Vídeo' :
                 tipo === 'audio' ? 'Áudio' : 'Documento'}
                {' · clique ou arraste pra trocar'}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onChange('', null);
              }}
              aria-label="Remover anexo"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-xs font-medium">Arraste um arquivo aqui</p>
            <p className="text-[11px] text-muted-foreground">
              Imagem, vídeo, áudio, PDF ou documento · até 90 MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) subir(file);
          e.target.value = '';
        }}
      />

      {/* Colar link continua valendo: nem tudo precisa passar pelo nosso storage. */}
      <div className="relative">
        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            const url = e.target.value;
            onChange(url, url ? tipoDoArquivo(url) : null);
          }}
          placeholder="ou cole uma URL"
          className="pl-8 h-8 text-xs"
        />
      </div>
    </div>
  );
}
