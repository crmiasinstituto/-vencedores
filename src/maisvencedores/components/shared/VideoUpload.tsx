import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Video, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VideoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
}

export function VideoUpload({
  value,
  onChange,
  folder = 'trainings',
  className = '',
}: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use MP4, WebM ou MOV');
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Vídeo muito grande. Máximo: 500MB');
      return;
    }

    try {
      setUploading(true);
      setProgress(0);

      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Simulate progress for UX (Supabase doesn't have native progress)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.storage
        .from('videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (error) throw error;

      setProgress(100);

      const { data: publicUrl } = supabase.storage
        .from('videos')
        .getPublicUrl(data.path);

      onChange(publicUrl.publicUrl);
      toast.success('Vídeo enviado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao enviar vídeo: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <input
        type="file"
        ref={inputRef}
        onChange={handleUpload}
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        disabled={uploading}
      />

      {value ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-muted">
            <video
              src={value}
              controls
              className="w-full max-h-[300px] object-contain"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground truncate">{value}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-32 border-dashed"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Enviando... {progress}%
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Video className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para enviar vídeo
                </span>
                <span className="text-xs text-muted-foreground">
                  MP4, WebM ou MOV (máx. 500MB)
                </span>
              </div>
            )}
          </Button>

          {uploading && <Progress value={progress} className="h-2" />}
        </div>
      )}
    </div>
  );
}
