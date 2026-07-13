import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  isOutbound?: boolean;
  // Tipo da msg ('ptt' = voice note do WhatsApp, 'audio' = arquivo de
  // audio anexado). UI muda sutilmente entre os dois (ptt mostra
  // bolinha do mic verde, audio mostra controles padrao).
  variant?: 'ptt' | 'audio';
}

// Velocidades disponiveis — ciclo no click. Padrao do WhatsApp e' 1x,
// 1.5x, 2x. Adicionei 0.5x por pedido do user.
const SPEEDS = [1, 1.5, 2, 0.5] as const;

const formatTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isOutbound = false, variant = 'audio' }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const speed = SPEEDS[speedIdx];

  // Sincroniza speed real do audio com o estado
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
    } else {
      a.play().catch(() => {});
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
    setCurrentTime(a.currentTime);
  }, [duration]);

  const cycleSpeed = useCallback(() => {
    setSpeedIdx(prev => (prev + 1) % SPEEDS.length);
  }, []);

  // Cor adaptada ao tipo de bolha (verde escuro outbound vs cinza
  // inbound) pra contrastar.
  const accent = isOutbound ? 'text-emerald-200' : 'text-emerald-400';
  const trackBg = isOutbound ? 'bg-white/20' : 'bg-white/15';
  const trackFill = isOutbound ? 'bg-white' : 'bg-emerald-400';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[230px]">
      {variant === 'ptt' && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isOutbound ? 'bg-emerald-400/20' : 'bg-emerald-500/15'}`}>
          <Mic className={`w-3.5 h-3.5 ${accent}`} />
        </div>
      )}

      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 ${
          isOutbound ? 'bg-white text-emerald-700 hover:bg-white/90' : 'bg-emerald-500 text-white hover:bg-emerald-600'
        }`}
        title={isPlaying ? 'Pausar' : 'Tocar'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <div
          className={`relative h-1 rounded-full cursor-pointer ${trackBg}`}
          onClick={handleSeek}
        >
          <div
            className={`absolute top-0 left-0 h-full rounded-full ${trackFill}`}
            style={{ width: `${progress}%` }}
          />
          {/* Dot — indicador do ponto atual, segue o progress */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full -translate-x-1/2 ${trackFill}`}
            style={{ left: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-70 leading-none">
          <span className="font-mono">{formatTime(currentTime)}</span>
          <span className="font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Botao de velocidade — only visivel quando ja comecou a tocar
          (UX WhatsApp: 1x oculto ate o primeiro play). */}
      {(isPlaying || currentTime > 0) && (
        <button
          onClick={cycleSpeed}
          className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 transition-all flex-shrink-0 ${
            isOutbound
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white/80'
          }`}
          title="Velocidade"
        >
          {speed}×
        </button>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          // Alguns OGG/Opus vem com duration=Infinity ate seek. Workaround
          // forca o audio a "saber" a duracao real fazendo seek pra 1e9.
          const a = e.currentTarget;
          if (!isFinite(a.duration) || a.duration === 0) {
            a.currentTime = 1e9;
            const onSeek = () => {
              setDuration(a.duration);
              a.currentTime = 0;
              a.removeEventListener('timeupdate', onSeek);
            };
            a.addEventListener('timeupdate', onSeek);
          } else {
            setDuration(a.duration);
          }
        }}
      />
    </div>
  );
};
