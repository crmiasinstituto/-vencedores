/**
 * AITemplateGenerator
 *
 * Modal/Sheet que aparece sobre o editor de template e permite ao usuário gerar
 * um email completo via IA, descrevendo por texto OU gravando áudio direto no browser.
 *
 * Backend: edge function `marketing-ai-template` (Gemini multimodal).
 * Audio: MediaRecorder API → base64 → envia pra edge → Gemini transcreve e gera HTML.
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, Mic, Square, Send, Loader2, Wand2, Type, AudioLines, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (data: { subject: string; preheader?: string; html_content: string; brief?: string }) => void;
  // Pré-preenche o textarea de brief (ex: contexto de evento coletivo). Lead pode editar antes de gerar.
  seedPrompt?: string;
  // Texto adicional injetado como pré-contexto no envio pro Gemini (não aparece no campo, mas vai no payload).
  extraContext?: string;
}

const EXEMPLOS = [
  'Email de boas-vindas pra novo aluno do curso, com tom amigável e link pra começar a primeira aula',
  'Reativação pra leads que não respondem há 30 dias, com tom direto e CTA pra agendar conversa',
  'Convite pra webinar gratuito de IA pra vendas, fundo preto, sensação de exclusividade',
  'Anúncio de lançamento do novo módulo de prospecção do CRM, com 3 benefícios em bullets',
];

export default function AITemplateGenerator({ open, onOpenChange, onResult, seedPrompt, extraContext }: Props) {
  const [mode, setMode] = useState<'text' | 'audio'>('text');
  const [prompt, setPrompt] = useState(seedPrompt ?? '');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSecs, setAudioSecs] = useState(0);
  const [transcript, setTranscript] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      stopRecording();
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setTranscript('');
      setPrompt(seedPrompt ?? '');
      setAudioSecs(0);
      setLoading(false);
    } else if (seedPrompt && !prompt) {
      setPrompt(seedPrompt);
    }
  }, [open, seedPrompt]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      rec.start();
      setRecording(true);
      setAudioSecs(0);
      timerRef.current = window.setInterval(() => setAudioSecs((s) => s + 1), 1000);
    } catch (err: any) {
      toast.error(`Microfone bloqueado: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let body: any;
      const composedPrompt = [extraContext?.trim(), prompt.trim()].filter(Boolean).join('\n\n');
      if (mode === 'audio') {
        if (!audioBlob) throw new Error('Grave um áudio primeiro');
        const base64 = await blobToBase64(audioBlob);
        body = {
          mode: 'audio',
          audio_base64: base64,
          audio_mime: audioBlob.type || 'audio/webm',
          extra_context: extraContext?.trim() || undefined,
        };
      } else {
        if (!prompt.trim()) throw new Error('Descreva o que você quer no email');
        body = { mode: 'text', prompt: composedPrompt };
      }

      const { data, error } = await supabase.functions.invoke('marketing-ai-template', { body });
      if (error) throw new Error(error.message || 'Falha na IA');
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as { success: boolean; subject: string; preheader?: string; html_content: string; transcript?: string };

      if (result.transcript) setTranscript(result.transcript);

      // Brief = transcrição (áudio) ou prompt manual (texto). Usado pra regenerar.
      const briefUsed = mode === 'audio'
        ? (result.transcript || '').trim()
        : prompt.trim();

      onResult({
        subject: result.subject,
        preheader: result.preheader,
        html_content: result.html_content,
        brief: briefUsed,
      });

      toast.success('Template gerado pela IA, edite à vontade');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const fmtSecs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#BAA05E]" />
            Gerar template com IA
          </DialogTitle>
          <DialogDescription>
            Conta o que você quer comunicar. A IA gera o email completo com identidade + que Vencedores, depois você edita à vontade no Maily.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'text' | 'audio')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="text" className="gap-1.5">
              <Type className="h-3.5 w-3.5" /> Escrever
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5">
              <AudioLines className="h-3.5 w-3.5" /> Falar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-3 mt-4">
            <Textarea
              placeholder="Ex: Email de reativação pra leads de 30+ dias sem resposta, com tom direto e CTA pra agendar conversa de 15min com nosso closer..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="text-sm resize-none"
              disabled={loading}
            />
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Exemplos pra começar
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {EXEMPLOS.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={loading}
                    onClick={() => setPrompt(ex)}
                    className="text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 p-2 rounded-md transition-colors leading-relaxed"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audio" className="space-y-4 mt-4">
            <div className={cn(
              'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              recording ? 'border-red-300 bg-red-50/50' : 'border-border bg-muted/20',
            )}>
              {!audioBlob && !recording && (
                <>
                  <Mic className="h-10 w-10 mx-auto mb-3 text-[#BAA05E]" />
                  <p className="text-sm font-medium mb-1">Clica e fala o que você quer</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Descreva em voz alta o objetivo do email, o público e o tom. A IA escuta e transcreve.
                  </p>
                  <Button
                    onClick={startRecording}
                    className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5"
                    disabled={loading}
                  >
                    <Mic className="h-4 w-4" /> Começar a gravar
                  </Button>
                </>
              )}

              {recording && (
                <>
                  <div className="relative inline-flex">
                    <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                    <Mic className="h-10 w-10 mx-auto mb-3 text-red-500 relative" />
                  </div>
                  <p className="text-2xl font-mono font-semibold mt-3">{fmtSecs(audioSecs)}</p>
                  <p className="text-xs text-muted-foreground my-3">Gravando, fala normalmente.</p>
                  <Button onClick={stopRecording} variant="destructive" className="gap-1.5">
                    <Square className="h-4 w-4" /> Parar
                  </Button>
                </>
              )}

              {audioBlob && !recording && (
                <>
                  <AudioLines className="h-10 w-10 mx-auto mb-3 text-green-600" />
                  <p className="text-sm font-medium mb-1">Gravação pronta ({fmtSecs(audioSecs)})</p>
                  <p className="text-xs text-muted-foreground mb-3">Ouve antes de mandar se quiser conferir.</p>
                  {audioUrl && (
                    <audio src={audioUrl} controls className="w-full max-w-xs mx-auto mb-3" />
                  )}
                  <Button
                    onClick={() => {
                      setAudioBlob(null);
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioUrl(null);
                      setAudioSecs(0);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    Regravar
                  </Button>
                </>
              )}
            </div>

            {transcript && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 border">
                <p className="font-medium text-foreground mb-1">Transcrição:</p>
                <p className="italic">"{transcript}"</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-md p-2.5 border">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            A IA gera o template inicial com sua identidade + que Vencedores. Você pode editar tudo no Maily depois, ou pedir uma nova geração.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || (mode === 'text' ? !prompt.trim() : !audioBlob)}
            className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
              : <><Wand2 className="h-4 w-4" /> Gerar template</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
