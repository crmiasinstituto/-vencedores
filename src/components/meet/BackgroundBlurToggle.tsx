import React, { useState, useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track, LocalVideoTrack } from 'livekit-client';
import { BackgroundBlur } from '@livekit/track-processors';
import { Sparkles, SparklesIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'squaad.meet.blurOn';
// Detecta se navegador tem o necessario pro track-processor funcionar.
// Sem WebGL2 + WebAssembly o BackgroundBlur retorna frames pretos silenciosamente.
function blurSupported(): boolean {
  try {
    if (typeof WebAssembly !== 'object') return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || (c.getContext('webgl') as any));
  } catch { return false; }
}

export default function BackgroundBlurToggle() {
  const { localParticipant } = useLocalParticipant();
  const [blurOn, setBlurOn] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const failedOnceRef = useRef(false);

  // Re-aplica blur se a camera mudou (ex: trocou de device) e blur estava on.
  // Se a aplicacao falhar, REVERTE pra off (frames pretos sao pior que sem blur).
  useEffect(() => {
    if (!blurOn) return;
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as LocalVideoTrack | undefined;
    if (!track || !(track instanceof LocalVideoTrack)) return;
    if (track.getProcessor()?.name === 'background-blur') return;
    track.setProcessor(BackgroundBlur(15)).catch((e) => {
      console.warn('[blur] re-apply failed, reverting', e);
      try { track.stopProcessor().catch(() => {}); } catch {}
      setBlurOn(false);
      try { localStorage.setItem(STORAGE_KEY, '0'); } catch {}
      if (!failedOnceRef.current) {
        failedOnceRef.current = true;
        toast.error('Blur nao suportado neste dispositivo — desligado pra evitar tela preta');
      }
    });
  }, [localParticipant, blurOn]);

  const toggle = async () => {
    if (busy) return;
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    if (!track || !(track instanceof LocalVideoTrack)) {
      toast.error('Camera precisa estar ligada pra desfocar');
      return;
    }
    if (!blurOn && !blurSupported()) {
      toast.error('Seu navegador/dispositivo nao suporta o blur (precisa WebGL2)');
      return;
    }
    setBusy(true);
    try {
      if (blurOn) {
        await track.stopProcessor();
        setBlurOn(false);
        try { localStorage.setItem(STORAGE_KEY, '0'); } catch {}
      } else {
        // Timeout defensivo: se o processor demorar >8s pra inicializar,
        // assume que travou (CPU/WebGL fraca) e reverte. Sem isso o usuario
        // fica olhando tela preta sem feedback.
        await Promise.race([
          track.setProcessor(BackgroundBlur(15)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
        setBlurOn(true);
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      }
    } catch (e: any) {
      console.error('[blur] toggle failed', e);
      // Se ligamos e falhou, garante que o processor foi removido pra nao
      // ficar com tela preta.
      try { await track.stopProcessor(); } catch {}
      setBlurOn(false);
      try { localStorage.setItem(STORAGE_KEY, '0'); } catch {}
      toast.error('Blur falhou: ' + (e.message === 'timeout' ? 'travou na inicializacao' : (e.message || 'erro')));
    } finally {
      setBusy(false);
    }
  };

  // Posicionado no canto SUPERIOR-CENTRO pra nao colidir com Coach IA (right)
  // nem com a logo + que Vencedores (left).
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border transition-all ${
        blurOn
          ? 'bg-primary/20 border-primary/40 text-primary'
          : 'bg-black/50 border-white/10 text-white/80 hover:bg-black/70'
      }`}
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : blurOn ? (
        <SparklesIcon className="w-3.5 h-3.5" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
      {blurOn ? 'Fundo desfocado' : 'Desfocar fundo'}
    </button>
  );
}
