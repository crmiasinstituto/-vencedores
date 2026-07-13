import React, { useEffect, useRef, useState } from 'react';
import { Video, X, Send, Square, Circle, RefreshCw, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface VideoPTVRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  // Recebe o blob gravado + extensao. Quem chamar e' responsavel por
  // subir pro storage e mandar via uazapi como type='ptv'.
  onRecorded: (blob: Blob, mime: string, ext: string, durationSec: number) => void;
}

const MAX_DURATION_SEC = 60;

// Escolhe o melhor codec de video que o browser suporta pro PTV (instant
// video do WhatsApp — "lembretezinho" que toca redondo). WhatsApp prefere
// mp4 quando possivel. Chrome/Edge fazem webm/vp9 e vp8; Safari faz mp4/h264.
const pickVideoMime = (): { mime: string; ext: string } => {
  if (typeof MediaRecorder === 'undefined') return { mime: '', ext: 'webm' };
  const candidates = [
    { mime: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' };
};

export const VideoPTVRecorder: React.FC<VideoPTVRecorderProps> = ({ isOpen, onClose, onRecorded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedMimeRef = useRef<string>('');
  const recordedExtRef = useRef<string>('webm');
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [phase, setPhase] = useState<'initializing' | 'preview' | 'recording' | 'review' | 'sending'>('initializing');
  // streamReady em state (nao ref) pra forcar re-render quando a camera
  // ficar pronta — antes o botao gravar ficava disabled pra sempre porque
  // o React nunca re-renderizava ao mudar streamRef.current.
  const [streamReady, setStreamReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Liga a camera quando o dialog abre
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPhase('initializing');
    setStreamReady(false);
    setError(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // 480x480 quadrado e' o ideal pro PTV redondo do WhatsApp
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setStreamReady(true);
        setPhase('preview');
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Câmera/microfone bloqueados');
        }
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const cleanup = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    setStreamReady(false);
    setPhase('initializing');
    chunksRef.current = [];
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const startRecording = () => {
    if (!streamRef.current) {
      setError('Câmera não está pronta');
      return;
    }
    chunksRef.current = [];
    const { mime, ext } = pickVideoMime();
    recordedMimeRef.current = mime || 'video/webm';
    recordedExtRef.current = ext;
    try {
      const recorder = mime
        ? new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 1_200_000 })
        : new MediaRecorder(streamRef.current);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const actualMime = recorder.mimeType || recordedMimeRef.current || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setPhase('review');
      };
      recorder.start();
      recorderRef.current = recorder;
      setPhase('recording');
      setElapsed(0);
      recordingTimerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= MAX_DURATION_SEC) stopRecording();
          return next;
        });
      }, 1000);
    } catch (e: any) {
      setError('Falha ao iniciar gravação: ' + (e?.message || 'erro'));
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const discardAndRetry = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
    setPhase('preview');
    chunksRef.current = [];
  };

  const sendIt = () => {
    if (!recordedBlob) return;
    setPhase('sending');
    onRecorded(recordedBlob, recordedMimeRef.current, recordedExtRef.current, elapsed);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Progresso do anel amarelo (0 a 1) — alimenta o conic-gradient do anel
  // pulsante durante a gravacao. Borda amarela do estilo PTV original.
  const progress = phase === 'recording' ? Math.min(elapsed / MAX_DURATION_SEC, 1) : 0;
  const progressDeg = Math.round(progress * 360);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="bg-[#0b141a] border-green-500/20 text-white max-w-sm p-0 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center">
          {/* Header */}
          <div className="w-full flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold">Vídeo instantâneo</span>
            </div>
            <button onClick={handleClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="w-full px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Video circle area */}
          <div className="relative py-6 px-4 flex flex-col items-center justify-center">
            {/* Anel externo amarelo — gira durante gravacao (igual WhatsApp).
                conic-gradient muda dinamicamente com o progresso da timer. */}
            <div
              className="relative"
              style={{
                width: 260,
                height: 260,
              }}
            >
              {/* Anel decorativo. Em preview/review fica estatico amarelo;
                  em recording vira um gauge amarelo que se enche. */}
              <div
                className={`absolute inset-0 rounded-full p-[3px] transition-all ${
                  phase === 'recording' ? 'shadow-[0_0_25px_rgba(250,204,21,0.5)]' : ''
                }`}
                style={
                  phase === 'recording'
                    ? {
                        background: `conic-gradient(rgba(250,204,21,1) ${progressDeg}deg, rgba(250,204,21,0.2) ${progressDeg}deg)`,
                      }
                    : { background: 'rgba(250,204,21,0.7)' }
                }
              >
                <div className="w-full h-full rounded-full bg-black overflow-hidden relative">
                  {phase !== 'review' ? (
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      autoPlay
                      // scale-x-[-1] = espelha a propria imagem (selfie cam)
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <video
                      src={recordedUrl || undefined}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Loader enquanto a camera abre */}
                  {phase === 'initializing' && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                      <Loader2 className="w-7 h-7 text-yellow-400 animate-spin mb-2" />
                      <span className="text-xs text-white/70">Ligando câmera...</span>
                    </div>
                  )}

                  {/* Timer no canto durante gravacao */}
                  {phase === 'recording' && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 rounded-full px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[11px] font-mono font-semibold text-white">
                        {formatTime(elapsed)} / {formatTime(MAX_DURATION_SEC)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="w-full pb-5 px-4 flex items-center justify-center gap-5">
            {(phase === 'initializing' || phase === 'preview') && (
              <button
                onClick={startRecording}
                disabled={!streamReady || !!error}
                className="relative w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all shadow-xl shadow-red-600/40 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                title="Gravar"
              >
                <span className="absolute inset-1 rounded-full ring-2 ring-white/40" />
                <Circle className="w-6 h-6 text-white fill-white" />
              </button>
            )}

            {phase === 'recording' && (
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-all shadow-xl flex items-center justify-center"
                title="Parar gravação"
              >
                <Square className="w-7 h-7 text-red-600 fill-current" />
              </button>
            )}

            {phase === 'review' && (
              <>
                <button
                  onClick={discardAndRetry}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center"
                  title="Refazer"
                >
                  <RefreshCw className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={sendIt}
                  className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 active:scale-95 transition-all shadow-xl shadow-green-600/40 flex items-center justify-center"
                  title="Enviar"
                >
                  <Send className="w-6 h-6 text-white" />
                </button>
              </>
            )}

            {phase === 'sending' && (
              <div className="flex items-center gap-2 text-xs text-white/60 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </div>
            )}
          </div>

          {phase === 'preview' && streamReady && !error && (
            <p className="text-[11px] text-white/40 text-center pb-4 px-6">
              Clique no botão vermelho. Vídeo curto enviado como mensagem instantânea (toca redondo, igual áudio).
            </p>
          )}
          {phase === 'recording' && (
            <p className="text-[11px] text-yellow-300/80 text-center pb-4 px-6">
              Gravando... clique no quadrado pra parar (ou esperar {MAX_DURATION_SEC}s)
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
