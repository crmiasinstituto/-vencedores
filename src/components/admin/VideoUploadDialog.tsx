import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Loader2, Check, Video as VideoIcon } from 'lucide-react';
import { transcribeWithSoniox } from '@/lib/sonioxTranscribe';

interface Props {
  moduleId: string | null;
  onClose: () => void;
  onPublished: () => void;
}

type Stage = 'idle' | 'signing' | 'uploading' | 'processing' | 'done';

export default function VideoUploadDialog({ moduleId, onClose, onPublished }: Props) {
  const [title, setTitle] = useState('');
  const [transcription, setTranscription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState('');
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBusy = stage === 'signing' || stage === 'uploading' || stage === 'processing';

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast.error('Selecione um arquivo de video');
      return;
    }
    setFile(f);
    if (!title.trim()) {
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(name);
    }
  };

  const uploadViaXhr = (url: string, body: Blob, contentType: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload falhou (${xhr.status}): ${xhr.responseText}`));
      };
      xhr.onerror = () => reject(new Error('Erro de rede no upload'));
      xhr.send(body);
    });
  };

  const start = async () => {
    console.log('[upload] start called', { moduleId, title, fileSize: file?.size });
    if (!file || !moduleId || !title.trim()) {
      const msg = `Faltando: ${!moduleId ? 'modulo ' : ''}${!title.trim() ? 'titulo ' : ''}${!file ? 'arquivo' : ''}`;
      console.error('[upload] validation failed:', msg);
      toast.error(msg);
      return;
    }
    try {
      setStage('signing');
      setMessage('Gerando URL de upload...');
      setProgress(0);

      const ext = file.name.split('.').pop() || 'mp4';
      const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
      const key = `uploads/${moduleId}/${Date.now()}-${safeName}.${ext}`;
      console.log('[upload] signing', { key, contentType: file.type });

      const { data: signResp, error: signErr } = await supabase.functions.invoke('create-b2-upload-url', {
        body: { key, contentType: file.type || 'video/mp4' },
      });
      console.log('[upload] sign response', { signResp, signErr });
      if (signErr || !signResp?.upload_url) {
        throw new Error(signResp?.error || signErr?.message || 'Falha ao assinar upload (sem URL na resposta)');
      }

      setStage('uploading');
      setMessage(`Enviando ${(file.size / 1024 / 1024).toFixed(1)} MB para o Backblaze B2...`);
      console.log('[upload] PUT to B2', signResp.upload_url.slice(0, 80) + '...');
      await uploadViaXhr(signResp.upload_url, file, file.type || 'video/mp4');
      console.log('[upload] PUT complete, public_url:', signResp.public_url);
      setPublicUrl(signResp.public_url);

      setStage('processing');
      setMessage('Criando registro da aula...');

      const { data: meeting, error: mErr } = await (supabase as any).from('meetings').insert({
        title,
        status: 'completed',
        kind: 'lesson',
        lesson_mode: true,
        target_module_id: moduleId,
        target_lesson_title: title,
        recording_url: signResp.public_url,
        recording_status: 'completed',
        transcription: transcription.trim() || null,
        ended_at: new Date().toISOString(),
      }).select('id').single();
      console.log('[upload] meeting insert', { meeting, mErr });
      if (mErr) throw new Error('Falha ao registrar aula: ' + mErr.message);

      // Se nao colou transcricao manualmente, usa Soniox automaticamente
      let finalTranscription = transcription.trim();
      if (finalTranscription.length < 80 && signResp.public_url) {
        try {
          setMessage('Transcrevendo audio via Soniox...');
          finalTranscription = await transcribeWithSoniox(
            signResp.public_url,
            (p) => setMessage(p.message),
          );
          // Atualiza meeting com transcricao
          await (supabase as any).from('meetings').update({ transcription: finalTranscription }).eq('id', meeting.id);
        } catch (transErr: any) {
          console.warn('[upload] soniox failed, prosseguindo sem transcricao:', transErr);
          toast.info('Soniox falhou: ' + transErr.message + '. Aula publicada sem PDF.', { duration: 8000 });
        }
      }

      if (finalTranscription.length > 80) {
        setMessage('Gerando PDF resumo via IA...');
        const { data: proc, error: pErr } = await supabase.functions.invoke('process-lesson-recording', {
          body: { meeting_id: meeting.id, force: true },
        });
        console.log('[upload] process-lesson-recording', { proc, pErr });
        if (pErr) throw new Error('Pipeline falhou: ' + pErr.message);
        if (proc?.status === 'waiting') {
          setMessage('Pipeline em espera. Verifique os dados da aula no modulo.');
        }
      } else {
        setMessage('Publicando aula no modulo...');
        const { data: maxRow } = await (supabase as any)
          .from('member_lessons')
          .select('sort_order')
          .eq('module_id', moduleId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error: lErr } = await (supabase as any).from('member_lessons').insert({
          module_id: moduleId,
          title,
          type: 'video',
          content_url: signResp.public_url,
          is_published: true,
          processing_status: 'ready',
          source: 'direct_upload',
          meeting_id: meeting.id,
          sort_order: (maxRow?.sort_order || 0) + 1,
        });
        console.log('[upload] member_lessons insert', { lErr });
        if (lErr) throw new Error('Falha ao publicar aula: ' + lErr.message);
      }

      setStage('done');
      setMessage('Aula publicada com sucesso!');
      toast.success('Video enviado e aula publicada');
      setTimeout(() => onPublished(), 1000);
    } catch (e: any) {
      console.error('[upload] FAILED:', e);
      toast.error(e.message || 'Erro no upload', { duration: 10000 });
      setStage('idle');
      setMessage('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-muted-foreground">
        Envie um video pronto para o B2. Se colar a transcricao, o sistema
        gera o PDF resumo automaticamente e publica a aula completa.
      </div>

      <div className="space-y-2">
        <Label>Titulo da aula</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Masterclass: Negociacao Avancada"
          disabled={isBusy}
        />
      </div>

      <div className="space-y-2">
        <Label>Arquivo de video</Label>
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-xl hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clique para selecionar (MP4, MOV, WebM)</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <VideoIcon className="w-5 h-5 text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            {!isBusy && (
              <Button size="sm" variant="ghost" onClick={() => setFile(null)}>Trocar</Button>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />
      </div>

      <div className="space-y-2">
        <Label>Transcricao (opcional, cole aqui se ja tiver)</Label>
        <Textarea
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Se colar a transcricao, o PDF resumo sera gerado automaticamente"
          className="min-h-[100px]"
          disabled={isBusy}
        />
      </div>

      {stage !== 'idle' && (
        <div className="space-y-2 bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            {stage === 'done' ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
            <span className="text-sm">{message}</span>
          </div>
          {stage === 'uploading' && <Progress value={progress} className="h-1.5" />}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={isBusy}>Cancelar</Button>
        <Button
          onClick={start}
          disabled={isBusy || !file || !title.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          Enviar e publicar
        </Button>
      </div>
    </div>
  );
}
