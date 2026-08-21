import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X } from 'lucide-react';

const MAX = 5 * 1024 * 1024;

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Pasta dentro do bucket, pra não misturar foto de evento com banner de aviso. */
  pasta: string;
  ajuda?: string;
}

/**
 * Sobe a imagem pro bucket público `uploads` e devolve a URL.
 *
 * Aceita também colar uma URL direto: nem toda imagem precisa morar aqui (banner que já está
 * no site, por exemplo), e obrigar upload só criaria cópia desnecessária.
 */
export default function UploadImagem({ label, value, onChange, pasta, ajuda }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem');
      return;
    }
    if (file.size > MAX) {
      toast.error('Imagem muito grande (máx 5 MB)');
      return;
    }
    setEnviando(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
      const path = `${pasta}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage
        .from('uploads')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success('Imagem enviada');
    } catch (e: any) {
      toast.error(`Falha no upload: ${e.message}`);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative w-full max-w-sm">
          <img src={value} alt="" className="w-full h-36 object-cover rounded-lg border" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={() => onChange('')}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={enviando} className="gap-2">
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {enviando ? 'Enviando…' : 'Enviar imagem'}
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => enviar(e.target.files)} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole a URL da imagem"
        className="text-xs"
      />
      {ajuda && <p className="text-[11px] text-muted-foreground">{ajuda}</p>}
    </div>
  );
}
