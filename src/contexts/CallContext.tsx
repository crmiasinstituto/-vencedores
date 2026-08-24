import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchWavoipDeviceFor, type WavoipDevice } from '@/hooks/useWavoip';
import { useCallTranscription, type TranscriptionSegment } from '@/hooks/useCallTranscription';
import { wavoipRemoteCapture } from '@/lib/wavoip-init';

// Patch da SDK do WaVoIP agora vive em src/lib/wavoip-init.ts (chamado em
// src/main.tsx antes do createRoot). Cobre BUG 1 (libsamplerate UMD), BUG 2
// (data URLs do Vite optimizer) e BUG 3 (captura de audio remoto). NAO duplicar
// patch aqui senao sobrescreve o novo (CallContext e importado depois do main).

// ===================== TYPES =====================
interface ActiveCall {
  id: string;
  wavoipCallId: string;
  direction: 'INCOMING' | 'OUTGOING';
  // 'PENDING' = aguardando user escolher playbook antes de iniciar wavoip
  // 'CALLING' = wavoip startCall ja foi disparado, esperando peer aceitar
  // 'ACTIVE'  = peer aceitou, audio rolando
  status: string;
  peerPhone: string;
  peerName?: string;
  profilePicture?: string | null;
  startedAt: Date;
  duration: number;
  isMuted: boolean;
  isPeerMuted: boolean;
  leadId?: string;
  // Setado quando user clicou "Sem coach" — modal nao monta useSalesCoach
  coachDisabled?: boolean;
}

interface CallEndedResult {
  callId: string;
  duration: number;
  direction: 'INCOMING' | 'OUTGOING';
  peerPhone: string;
  peerName?: string;
  leadId?: string;
}

/**
 * Medicao ao vivo dos DOIS sentidos do audio, tirada do getStats() da SDK.
 * `micLevel` = quanto do SEU microfone esta saindo pro lead.
 * `peerLevel` = quanto esta chegando do lead no seu alto-falante.
 * Sem isso, "nao escutei nada" e' impossivel de diagnosticar depois.
 */
export interface AudioDiag {
  micLevel: number;
  peerLevel: number;
  txBytes: number;
  rxBytes: number;
  txFlowing: boolean;
  rxFlowing: boolean;
  rttMs: number;
  lossTx: number;
  lossRx: number;
  /** segundos seguidos com o microfone em silencio (nivel ~0) */
  micSilentSec: number;
  /** segundos seguidos sem voz do lead */
  peerSilentSec: number;
  transport: 'ok' | 'sem-fluxo';
}

interface IncomingOffer {
  // Note: o CallOffer real fica em currentOfferRef (fora do React). Aqui so
  // metadados serializaveis. React poderia perder os methods/proxies internos
  // do CallOffer ao re-renderizar, causando accept() a falhar silencioso.
  peerPhone: string;
  peerName?: string;
  leadId?: string;
  profilePicture?: string | null;
}

interface CallContextType {
  device: WavoipDevice | null;
  deviceLoading: boolean;
  isConnected: boolean;
  activeCall: ActiveCall | null;
  callEndedResult: CallEndedResult | null;
  incomingOffer: IncomingOffer | null;
  // requestCall: abre o modal em PENDING sem disparar wavoip. O usuario
  // confirma escolhendo um playbook (ou "sem coach"), o que chama
  // confirmPendingCall. Evita ringtone antes do user decidir o coach.
  requestCall: (phoneNumber: string, leadId?: string) => Promise<void>;
  confirmPendingCall: (opts?: { disableCoach?: boolean }) => Promise<void>;
  initiateCall: (phoneNumber: string, leadId?: string) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  showIncomingModal: boolean;
  showActiveCallModal: boolean;
  showCallEndedModal: boolean;
  setShowIncomingModal: (v: boolean) => void;
  setShowActiveCallModal: (v: boolean) => void;
  setShowCallEndedModal: (v: boolean) => void;
  refreshDevice: () => Promise<void>;
  // Status cru do device WaVoIP (open / connecting / close / hibernating /
  // restarting / error) e o QR que o proprio socket manda quando o device
  // esta sem numero vinculado ("connecting").
  deviceStatus: string;
  deviceQrCode: string | null;
  /** acorda o device (hibernating) e faz ele gerar QR de novo */
  restartDevice: () => Promise<void>;
  /** desvincula o numero atual — o device volta pra "connecting" e emite QR */
  logoutDevice: () => Promise<void>;
  isTranscribing: boolean;
  transcriptions: TranscriptionSegment[];
  transcriptionError: string | null;
  /** medicao ao vivo dos dois sentidos do audio (null fora de chamada ativa) */
  audioDiag: AudioDiag | null;
}

const CallContext = createContext<CallContextType | null>(null);

// A linha compartilhada tem num_channels = 1 no WaVoIP: uma ligacao por vez.
// Sem checar antes de discar, o segundo a tentar fica preso em "Chamando" ate
// estourar o timeout do socket, sem nenhuma pista do motivo.
const WAVOIP_BASE = 'https://devices.wavoip.com';
async function isWavoipLineBusy(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${WAVOIP_BASE}/${token}/whatsapp/all_info`);
    // 503 = device hibernando. Nao e' "ocupado" — deixa o fluxo normal cuidar.
    if (!res.ok) return false;
    const body = await res.json();
    const calls = body?.result?.calls;
    return Array.isArray(calls) && calls.length > 0;
  } catch {
    return false;
  }
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within CallProvider');
  return ctx;
}

// Ringtone (incoming call) — toca .mp3 em loop
let ringtoneAudio: HTMLAudioElement | null = null;
function playRingtone() {
  if (!ringtoneAudio) {
    ringtoneAudio = new Audio('/sounds/ringtone.mp3');
    ringtoneAudio.loop = true;
  }
  ringtoneAudio.play().catch(() => {});
}
function stopRingtone() {
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
  }
}

// Ringback tone (outgoing call "chamando") + hangup tone — gerados via Web
// Audio API. Padrao internacional: 440Hz+480Hz, 2s on / 4s off.
let ringbackCtx: AudioContext | null = null;
let ringbackTimer: ReturnType<typeof setTimeout> | null = null;
let ringbackStopped = true;

function playRingback() {
  try {
    if (!ringbackCtx) {
      ringbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ringbackCtx.state === 'suspended') ringbackCtx.resume().catch(() => {});
    ringbackStopped = false;

    const cycle = () => {
      if (ringbackStopped || !ringbackCtx) return;
      const ctx = ringbackCtx;
      // Gera 2s de tone (440+480Hz) suave
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      osc1.type = 'sine';
      osc2.type = 'sine';
      gain.gain.value = 0;
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      // Fade in/out pra evitar clicks
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 1.95);
      gain.gain.linearRampToValueAtTime(0, now + 2.0);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);
      // Repete a cada 6s (2s on + 4s off — padrao internacional)
      ringbackTimer = setTimeout(cycle, 6000);
    };
    cycle();
  } catch (e) {
    console.warn('[Ringback] failed:', e);
  }
}

function stopRingback() {
  ringbackStopped = true;
  if (ringbackTimer) {
    clearTimeout(ringbackTimer);
    ringbackTimer = null;
  }
}

// Hangup tone — beep duplo curto (480Hz, 250ms x2) indicando linha caiu
function playHangupTone() {
  try {
    if (!ringbackCtx) {
      ringbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ringbackCtx.state === 'suspended') ringbackCtx.resume().catch(() => {});
    const ctx = ringbackCtx;
    const now = ctx.currentTime;
    [0, 0.35].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 480;
      osc.type = 'sine';
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.02);
      gain.gain.setValueAtTime(0.2, now + offset + 0.22);
      gain.gain.linearRampToValueAtTime(0, now + offset + 0.25);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    });
  } catch (e) {
    console.warn('[HangupTone] failed:', e);
  }
}

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [device, setDevice] = useState<WavoipDevice | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<string>('disconnected');
  const [deviceQrCode, setDeviceQrCode] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callEndedResult, setCallEndedResult] = useState<CallEndedResult | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<IncomingOffer | null>(null);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showActiveCallModal, setShowActiveCallModal] = useState(false);
  const [showCallEndedModal, setShowCallEndedModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Espelha o estado de "chamada recebida" pra janela pai. A apresentacao (deck)
  // embute o CRM num iframe e usa isso pra abrir o overlay de atendimento sozinho
  // quando entra ligacao, sem o apresentador sair dos slides. So emite dentro de iframe.
  useEffect(() => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: showIncomingModal ? 'wavoip:incoming' : 'wavoip:ended' }, '*');
      }
    } catch (e) { /* fora de iframe ou cross-origin: ignora */ }
  }, [showIncomingModal]);

  const wavoipRef = useRef<any>(null);
  // Espelho do `device` pro listener de realtime (que e' montado uma vez e
  // ficaria com a closure velha).
  const deviceRef = useRef<WavoipDevice | null>(null);
  const activeCallObjRef = useRef<any>(null);
  const callStartTimeRef = useRef<Date | null>(null);
  const callHistoryIdRef = useRef<string | null>(null);
  const peerNameRef = useRef<string | undefined>(undefined);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Trava onOffer falso disparado pela propria SDK do WaVoIP durante outgoing
  // (a SDK emite offer pro proprio numero que voce esta ligando, gera modal
  // duplicado e race condition).
  const outgoingInProgressRef = useRef<boolean>(false);
  // CallOffer REAL do WaVoIP fica aqui (fora do React state). Salvar dentro
  // do state quebra os methods (accept/reject) pq React perde proxies internos.
  const currentOfferRef = useRef<any>(null);
  // INSERT do call_history roda em paralelo ao startCall pra nao atrasar o toque.
  // Guardamos a promessa: se a chamada falhar ANTES do insert voltar, o update de
  // status precisa esperar por ela — senao a linha fica presa em CALLING pra
  // sempre (foi o que aconteceu com todas as ligacoes de 24/08).
  const callHistoryInsertRef = useRef<Promise<string | null> | null>(null);
  // Diagnostico de audio bidirecional (getStats da SDK a cada 1s)
  const [audioDiag, setAudioDiag] = useState<AudioDiag | null>(null);
  const audioDiagRef = useRef<AudioDiag | null>(null);
  const audioStatsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioWarnedRef = useRef<{ mic: boolean; peer: boolean; link: boolean }>({ mic: false, peer: false, link: false });

  const {
    isTranscribing,
    transcriptions,
    error: transcriptionError,
    startTranscription,
    stopTranscription,
    saveTranscriptions,
    getFinalTranscriptions,
  } = useCallTranscription();

  // Get user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load device
  // Linha propria do usuario; se nao tiver, a linha compartilhada da equipe.
  // Antes o filtro era so `user_id`, entao o numero comercial ficava preso na
  // conta de quem cadastrou o token e o resto da equipe via o botao de ligar
  // cinza ("Configure o WaVoIP") mesmo com o numero pareado e online.
  const loadDevice = useCallback(async () => {
    if (!userId) { setDeviceLoading(false); return; }
    setDeviceLoading(true);
    try {
      setDevice(await fetchWavoipDeviceFor(userId));
    } catch (e) {
      console.error('[WaVoIP] falha ao carregar device:', e);
      setDevice(null);
    }
    setDeviceLoading(false);
  }, [userId]);

  useEffect(() => { loadDevice(); }, [loadDevice]);
  useEffect(() => { deviceRef.current = device; }, [device]);

  // Realtime: refaz loadDevice quando alguem adiciona/remove/atualiza device
  // do user. Sem isso, ao re-cadastrar dispositivo WaVoIP em AdminWhatsApp, o
  // CallProvider ficava preso no token velho (socket conectando a um token que
  // ja nao existe mais), mostrando "disconnected" enquanto o WaVoIP servidor
  // ja' tinha o novo device Conectado.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`wavoip-devices-${userId}`)
      .on(
        'postgres_changes',
        // Sem filtro por user_id: a linha compartilhada pertence a OUTRO dono,
        // e com filtro o cliente nunca sabia que ela mudou (token novo, linha
        // desativada, deixou de ser compartilhada).
        { event: '*', schema: 'public', table: 'wavoip_devices' },
        (payload) => {
          const row: any = payload.new || payload.old || {};
          // So interessa o que pode virar (ou deixar de ser) a MINHA linha.
          const relevant =
            row.id === deviceRef.current?.id ||
            row.user_id === userId ||
            row.is_shared === true;
          if (!relevant) return;
          // Ignora o update disparado pelo proprio onStatus (senao entra em
          // loop: onStatus -> update DB -> realtime -> loadDevice -> ...).
          // Comparar com payload.old nao funciona: a tabela esta em REPLICA
          // IDENTITY default, entao `old` so traz a PK. Comparamos com o
          // device que ja esta carregado.
          if (payload.eventType === 'UPDATE' && row.id === deviceRef.current?.id) {
            const cur = deviceRef.current!;
            if (
              row.token === cur.token &&
              row.is_active === cur.is_active &&
              row.is_shared === cur.is_shared
            ) return;
          }
          console.log('[WaVoIP] Device change detected, reloading:', payload.eventType);
          loadDevice();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadDevice]);

  // Duration timer
  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const dur = Math.floor((Date.now() - callStartTimeRef.current.getTime()) / 1000);
        setActiveCall(prev => prev ? { ...prev, duration: dur } : null);
      }
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Atualiza a linha do call_history de forma confiavel.
   *
   * Dois cuidados que faltavam e deixavam ligacao presa em "CALLING":
   *  1. supabase-js so dispara a requisicao quando alguem da `await`/`.then()`
   *     no builder. Varias chamadas aqui eram `supabase.from(...).update(...)`
   *     soltas — nunca saiam do navegador.
   *  2. Se a chamada falha antes do INSERT paralelo voltar, `callHistoryIdRef`
   *     ainda esta vazio; esperamos o insert em vez de desistir do update.
   */
  const updateCallHistory = useCallback(async (patch: Record<string, any>) => {
    let id = callHistoryIdRef.current;
    if (!id && callHistoryInsertRef.current) {
      try { id = await callHistoryInsertRef.current; } catch { id = null; }
    }
    if (!id) {
      console.warn('[WaVoIP] sem id de call_history pra atualizar:', patch);
      return;
    }
    const { error } = await supabase.from('call_history').update(patch as any).eq('id', id);
    if (error) console.error('[WaVoIP] update do call_history falhou:', error);
  }, []);

  // ===================== DIAGNOSTICO DE AUDIO (2 SENTIDOS) =====================
  // A SDK expoe getStats() com tx/rx (bytes, perda, audio_level). E a unica
  // forma objetiva de responder "o lead esta me ouvindo?" / "estou ouvindo o
  // lead?" sem depender de alguem relatar. Roda 1x por segundo enquanto ACTIVE.
  const stopAudioDiag = useCallback(() => {
    if (audioStatsIntervalRef.current) {
      clearInterval(audioStatsIntervalRef.current);
      audioStatsIntervalRef.current = null;
    }
    setAudioDiag(null);
    audioDiagRef.current = null;
    audioWarnedRef.current = { mic: false, peer: false, link: false };
  }, []);

  const startAudioDiag = useCallback((callObj: any) => {
    if (audioStatsIntervalRef.current) clearInterval(audioStatsIntervalRef.current);
    audioWarnedRef.current = { mic: false, peer: false, link: false };

    // De onde saem os niveis, por versao de SDK:
    //   2.6.3  -> audioAnalyserIn (lead) + audioAnalyserOut (seu mic) + getStats()
    //   2.3.6  -> so audio_analyser (lead). Nao tem analyser de saida nem
    //             getStats(); o mic sai de um analyser nosso montado em cima do
    //             stream que a SDK ja abriu, e as metricas vem do evento 'stats'.
    // Producao roda a 2.3.6 (package-lock), o dev local esta com a 2.6.3 — por
    // isso os dois caminhos precisam existir.
    let anIn: AnalyserNode | null = null;
    let anOut: AnalyserNode | null = null;
    let micIndisponivel = false;
    Promise.resolve(callObj?.audioAnalyserIn || callObj?.audio_analyser)
      .then((a: AnalyserNode) => { anIn = a || null; })
      .catch(() => {});
    Promise.resolve(callObj?.audioAnalyserOut)
      .then(async (a: AnalyserNode) => {
        if (a) { anOut = a; return; }
        // SDK antiga: monta o analyser do mic a partir do stream da propria SDK.
        const mm = (wavoipRef.current as any)?.mediaManager;
        const micStream: MediaStream | undefined = mm?.stream;
        const ctx: AudioContext | undefined = mm?.audioContext;
        if (micStream && ctx) {
          const src = ctx.createMediaStreamSource(micStream);
          const an = ctx.createAnalyser();
          an.fftSize = 256;
          src.connect(an);
          anOut = an;
          console.log('[WaVoIP][audio] analyser do mic montado na mao (SDK sem audioAnalyserOut)');
        } else {
          micIndisponivel = true;
          console.warn('[WaVoIP][audio] sem como medir o mic nesta SDK — medidor de saida fica indisponivel');
        }
      })
      .catch(() => { micIndisponivel = true; });

    // SDK 2.3.6 nao tem getStats(): as metricas chegam pelo evento 'stats'.
    let pushedStats: any = null;
    if (typeof callObj?.on === 'function') {
      try { callObj.on('stats', (st: any) => { pushedStats = st; }); } catch { /* evento inexistente */ }
    } else if (typeof callObj?.onStats === 'function') {
      try { callObj.onStats((st: any) => { pushedStats = st; }); } catch { /* idem */ }
    }

    const rms = (an: AnalyserNode | null): number => {
      if (!an) return 0;
      const buf = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      return Math.sqrt(sum / buf.length);
    };

    // Voz humana normal fica bem acima disso; ruido de fundo/silencio digital fica abaixo.
    const SILENCE = 0.01;
    const hasGetStats = typeof callObj?.getStats === 'function';
    let prevTx = -1, prevRx = -1;
    let micSilent = 0, peerSilent = 0, ticks = 0;
    let micPeak = 0, peerPeak = 0;
    let micShown = 0, peerShown = 0;
    let lastStats: any = null;
    let slot = 0;

    // 100ms pro medidor acompanhar a fala; getStats so 1x por segundo.
    audioStatsIntervalRef.current = setInterval(async () => {
      const micNow = rms(anOut);
      const peerNow = rms(anIn);
      micPeak = Math.max(micPeak, micNow);
      peerPeak = Math.max(peerPeak, peerNow);
      micShown = Math.max(micNow, micShown * 0.75);
      peerShown = Math.max(peerNow, peerShown * 0.75);
      slot += 1;

      const fecharJanela = slot >= 10;
      if (fecharJanela) {
        if (hasGetStats) {
          try { lastStats = await callObj.getStats(); } catch (e) { console.warn('[WaVoIP][audio] getStats falhou:', e); }
        } else if (pushedStats) {
          lastStats = pushedStats;
        }
      }

      const txBytes = lastStats?.tx?.total_bytes ?? 0;
      const rxBytes = lastStats?.rx?.total_bytes ?? 0;
      let txFlowing = true, rxFlowing = true;
      if (fecharJanela && lastStats) {
        txFlowing = prevTx < 0 ? true : txBytes > prevTx;
        rxFlowing = prevRx < 0 ? true : rxBytes > prevRx;
        prevTx = txBytes; prevRx = rxBytes;
      }

      if (fecharJanela) {
        ticks += 1;
        micSilent = micPeak > SILENCE ? 0 : micSilent + 1;
        peerSilent = peerPeak > SILENCE ? 0 : peerSilent + 1;
        micPeak = 0; peerPeak = 0;
        slot = 0;
      }

      const diag: AudioDiag = {
        micLevel: micIndisponivel ? -1 : micShown,
        peerLevel: peerShown,
        txBytes, rxBytes, txFlowing, rxFlowing,
        rttMs: Math.round(lastStats?.rtt?.avg ?? 0),
        lossTx: lastStats?.tx?.loss ?? 0,
        lossRx: lastStats?.rx?.loss ?? 0,
        micSilentSec: micSilent,
        peerSilentSec: peerSilent,
        transport: (!lastStats || txFlowing || rxFlowing) ? 'ok' : 'sem-fluxo',
      };
      audioDiagRef.current = diag;
      setAudioDiag(diag);

      if (!fecharJanela) return;

      // Avisos, uma vez por chamada. 10s e' muito mais que pausa de conversa —
      // aqui ja e' problema tecnico de verdade.
      if (ticks > 10 && lastStats && !txFlowing && !rxFlowing && !audioWarnedRef.current.link) {
        audioWarnedRef.current.link = true;
        toast.error('A conexão de áudio caiu — ninguém está ouvindo ninguém. Desligue e ligue de novo.', { duration: 9000 });
        return;
      }
      if (micSilent === 10 && !micIndisponivel && !audioWarnedRef.current.mic) {
        audioWarnedRef.current.mic = true;
        toast.warning('Nenhum som saindo do seu microfone há 10s — o lead não está te ouvindo. Confira o microfone e o mudo.', { duration: 9000 });
      }
      if (peerSilent === 12 && !audioWarnedRef.current.peer) {
        audioWarnedRef.current.peer = true;
        toast.warning('Não está chegando áudio do lead há 12s. Confira o volume e a saída de som.', { duration: 9000 });
      }
    }, 100);
  }, []);

  // Handle call failed/ended before active
  // `reason` fica gravado na linha: sem isso, "a ligacao caiu" nunca vira
  // diagnostico — a falha some junto com o toast.
  const handleCallFailed = useCallback((status: string, reason?: string) => {
    stopDurationTimer();
    stopAudioDiag();
    stopTranscription();
    updateCallHistory({
      status,
      ended_at: new Date().toISOString(),
      ...(reason ? { metadata: { fail_reason: reason } } : {}),
    });
    toast.info(status === 'NOT_ANSWERED' ? 'Chamada não atendida' : status === 'REJECTED' ? 'Chamada rejeitada' : 'Chamada encerrada');
    setActiveCall(null);
    activeCallObjRef.current = null;
    callStartTimeRef.current = null;
    setShowActiveCallModal(false);
    callHistoryIdRef.current = null;
    // Libera o guard de outgoing pro proximo onOffer real funcionar
    outgoingInProgressRef.current = false;
  }, [stopDurationTimer, stopAudioDiag, stopTranscription, updateCallHistory]);

  // Setup active call listeners + start transcription
  const setupActiveCall = useCallback((callObj: any, direction: 'INCOMING' | 'OUTGOING', peerPhone: string, peerName?: string, leadId?: string, profilePicture?: string | null) => {
    callStartTimeRef.current = new Date();
    peerNameRef.current = peerName;
    activeCallObjRef.current = callObj;

    // ---- AUDIO DO LEAD (quem reproduz e a SDK, nao nos) ----
    // A SDK 2.6.3 ja toca o audio remoto sozinha nos dois transportes:
    //   WebRTC  -> handleRemoteTrack: MediaStreamSource -> analyser -> ctx.destination
    //   socket  -> playbackNode      -> analyser -> ctx.destination
    // `CallActive` NAO expoe mais `.pc` (conferido no index.d.ts de 2.6.3), entao
    // o caminho antigo caia sempre no fallback do Proxy e criava um <audio> com o
    // MESMO stream que a SDK ja estava tocando: a voz do lead saia DUAS vezes,
    // fora de sincronia (eco / voz metalica). Medido em simulacao: 2 saidas.
    // Agora o <audio> nasce MUDO (so keep-alive do stream, igual a SDK faz) e so
    // e desmutado se o AudioContext da SDK nao subir — ai sim ninguem tocaria nada.
    try {
      const fallbackStream = wavoipRemoteCapture.incomingStream;
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.muted = true;
      if (fallbackStream) {
        audioEl.srcObject = fallbackStream;
        audioEl.play().catch(() => {});
      }
      (activeCallObjRef.current as any).__remoteAudioEl = audioEl;

      const analyserPromise: Promise<AnalyserNode> | undefined =
        callObj?.audioAnalyserIn || callObj?.audio_analyser;
      if (analyserPromise && typeof (analyserPromise as any).then === 'function') {
        analyserPromise
          .then(async (analyser) => {
            const ctx = analyser.context as AudioContext;
            // Chrome suspende AudioContext criado sem gesto do usuario.
            try { if (ctx.state === 'suspended') await ctx.resume(); } catch (e) {
              console.warn('[WaVoIP] resume do AudioContext da SDK falhou:', e);
            }
            console.log('[WaVoIP] AudioContext da SDK:', ctx.state);
            if (ctx.state !== 'running' && fallbackStream) {
              audioEl.muted = false;
              audioEl.play().catch((e) => console.warn('[WaVoIP] fallback play falhou:', e));
              console.warn('[WaVoIP] SDK nao vai tocar (ctx ' + ctx.state + ') — usando <audio> de fallback');
            }
          })
          .catch((e) => {
            console.warn('[WaVoIP] audioAnalyserIn falhou, desmutando fallback:', e);
            if (fallbackStream) { audioEl.muted = false; audioEl.play().catch(() => {}); }
          });
      } else if (fallbackStream) {
        // SDK antiga sem analyser exposto: volta ao comportamento anterior.
        audioEl.muted = false;
        audioEl.play().catch((e) => console.warn('[WaVoIP] audio.play() failed:', e));
      } else {
        console.warn('[WaVoIP] Nenhum remote audio stream disponivel pra tocar');
      }
    } catch (e) {
      console.warn('[WaVoIP] Remote audio setup failed:', e);
    }

    setActiveCall({
      id: callHistoryIdRef.current || '',
      wavoipCallId: callObj.id || '',
      direction,
      status: 'ACTIVE',
      peerPhone,
      peerName,
      profilePicture,
      startedAt: new Date(),
      duration: 0,
      isMuted: false,
      isPeerMuted: false,
      leadId,
    });

    updateCallHistory({ status: 'ACTIVE', wavoip_call_id: callObj.id || null });

    startDurationTimer();
    startAudioDiag(callObj);

    // Start transcription
    // Reusa o MESMO MediaStream que a SDK ja abriu pro mic. Abrir um segundo
    // getUserMedia no mesmo device deixa um dos dois streams mudo no macOS —
    // e quando o mudo e' o da SDK, o lead para de te ouvir. Mesmo problema que
    // o MeetRoom ja tinha resolvido reusando a track do LiveKit.
    const sdkMicStream: MediaStream | undefined = (wavoipRef.current as any)?.mediaManager?.stream;
    if (sdkMicStream) console.log('[Transcription] reusando mic da SDK (sem 2o getUserMedia)');
    startTranscription(callObj, peerName, sdkMicStream).catch(err => {
      console.error('[Transcription] Failed to start:', err);
    });

    // CallActive event listeners (methods, not property assignments)
    if (typeof callObj.onPeerMute === 'function') {
      callObj.onPeerMute(() => setActiveCall(prev => prev ? { ...prev, isPeerMuted: true } : null));
    }
    if (typeof callObj.onPeerUnmute === 'function') {
      callObj.onPeerUnmute(() => setActiveCall(prev => prev ? { ...prev, isPeerMuted: false } : null));
    }

    // onEnd for CallActive
    if (typeof callObj.onEnd === 'function') {
      callObj.onEnd(async () => {
        console.log('[WaVoIP] Call ended');
        // Beep curto avisando que a chamada terminou
        playHangupTone();
        // Cleanup do audio element criado em setupActiveCall (incoming fallback).
        // Sem isso o <audio> orfao continua referenciando o stream stale e atrapalha
        // a proxima chamada usar o fallback novo.
        try {
          const audioEl = (activeCallObjRef.current as any)?.__remoteAudioEl as HTMLAudioElement | undefined;
          if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
            audioEl.remove();
          }
        } catch {}
        wavoipRemoteCapture.reset();
        const durationSeconds = callStartTimeRef.current
          ? Math.floor((Date.now() - callStartTimeRef.current.getTime()) / 1000)
          : 0;

        // Capture callHistoryId before any state changes
        const savedCallHistoryId = callHistoryIdRef.current;

        const lastAudioDiag = audioDiagRef.current;
        stopDurationTimer();
        stopAudioDiag();
        stopTranscription();

        if (savedCallHistoryId) {
          await saveTranscriptions(savedCallHistoryId);

          await supabase.from('call_history').update({
            status: 'ENDED',
            duration_seconds: durationSeconds,
            ended_at: new Date().toISOString(),
            // Fica gravado se o audio correu nos dois sentidos. Sem isso,
            // "a ligacao nao teve som" so existe como relato.
            metadata: {
              audio_diag: lastAudioDiag
                ? {
                    mic_level: lastAudioDiag.micLevel,
                    peer_level: lastAudioDiag.peerLevel,
                    tx_bytes: lastAudioDiag.txBytes,
                    rx_bytes: lastAudioDiag.rxBytes,
                    mic_silent_sec: lastAudioDiag.micSilentSec,
                    peer_silent_sec: lastAudioDiag.peerSilentSec,
                    rtt_ms: lastAudioDiag.rttMs,
                    loss_tx: lastAudioDiag.lossTx,
                    loss_rx: lastAudioDiag.lossRx,
                    transport: lastAudioDiag.transport,
                  }
                : null,
            },
          }).eq('id', savedCallHistoryId);

          const finals = getFinalTranscriptions();
          if (finals.length > 0) {
            console.log('[AI Analysis] Invoking with callId:', savedCallHistoryId);
            supabase.functions.invoke('analyze-sales-call', {
              body: {
                callId: savedCallHistoryId,
                transcription: finals.map(t => `${t.speaker}: ${t.text}`).join('\n'),
                leadContext: peerName ? `Lead: ${peerName}` : undefined,
              },
            }).then(({ error }) => {
              if (error) console.error('[AI Analysis] Error:', error);
              else console.log('[AI Analysis] Invoked successfully');
            });
          }
        }

        setCallEndedResult({
          callId: savedCallHistoryId || '',
          duration: durationSeconds,
          direction,
          peerPhone,
          peerName: peerNameRef.current,
          leadId,
        });

        setActiveCall(null);
        activeCallObjRef.current = null;
        callStartTimeRef.current = null;
        setShowActiveCallModal(false);
        setShowCallEndedModal(true);
        callHistoryIdRef.current = null;
      });
    }
  }, [startDurationTimer, stopDurationTimer, startAudioDiag, stopAudioDiag, startTranscription, stopTranscription, saveTranscriptions, getFinalTranscriptions, updateCallHistory]);

  // ===================== INIT WAVOIP =====================
  useEffect(() => {
    if (!device?.token) {
      setIsConnected(false);
      setDeviceStatus('disconnected');
      setDeviceQrCode(null);
      return;
    }

    console.log('[WaVoIP] useEffect INIT, token:', device.token.slice(0, 12), 'existing:', !!wavoipRef.current);

    // Idempotencia: se ja existe instancia ATIVA pro mesmo token, nao
    // recria. Evita sockets duplicados quando o useEffect dispara 2x (HMR,
    // re-render por mudanca de userId/device.id que nao afeta token).
    if (wavoipRef.current) {
      const existingDevs = (wavoipRef.current as any)._devices || [];
      const existingToken = existingDevs[0]?.token;
      if (existingToken === device.token) {
        console.log('[WaVoIP] Instancia ja existe pro mesmo token, pulando recriacao');
        return; // sem cleanup pra nao destruir a boa
      }
    }

    let destroyed = false;

    const initWavoip = async () => {
      try {
    // Remote audio capture now handled via SDK AnalyserNode in startTranscription

        const WavoipModule = await import('@wavoip/wavoip-api');
        const WavoipClass = WavoipModule.Wavoip || (WavoipModule as any).default;

        if (!WavoipClass) {
          console.error('[WaVoIP] Could not find Wavoip class in module:', Object.keys(WavoipModule));
          toast.error('Erro: classe WaVoIP não encontrada');
          return;
        }

        // SDK 2.3.6 exige `platform` no constructor. Sem isso, o socket
        // conecta no servidor mas o handshake fica incompleto e o servidor
        // nao responde a `call:start` (ack nunca chega). SDK 2.1.x era
        // backward-compat por algum tempo, mas servidor deprecou esse modo.
        // 'squaad-crm' identifica nossa integracao nos logs deles.
        const wavoip = new WavoipClass({
          tokens: [device.token],
          platform: 'squaad-crm',
        } as any);
        wavoipRef.current = wavoip;

        console.log('[WaVoIP] Instance created, devices:', wavoip.devices?.length);

        // Device events - use the first device
        const dev = wavoip.devices?.[0];

        // Wiretap no socket pra logar TODO trafego (emit + recv) durante chamada.
        // Quando TIMEOUT_30S aparece, conseguimos provar se o servidor mandou
        // qualquer resposta ao call:start ou se engoliu completamente. Socket
        // da SDK as vezes nao existe na hora do constructor, retry ate 5x com
        // backoff. Loga TUDO pra ter visibilidade.
        const installWiretap = (attempt = 1) => {
          if (destroyed) return;
          const inst: any = wavoipRef.current;
          const devs = inst?._devices || inst?.devices || [];
          const d0 = devs[0];
          const sock = d0?.socket;
          console.log(`[WaVoIP][socket] Tentativa ${attempt}: devs=${devs.length}, sock=${!!sock}, sockKeys=${sock ? Object.keys(sock).slice(0, 8).join(',') : 'n/a'}`);

          if (!sock) {
            if (attempt < 5) {
              setTimeout(() => installWiretap(attempt + 1), 1000 * attempt);
            } else {
              console.warn('[WaVoIP][socket] DESISTI de instalar wiretap apos 5 tentativas. SDK nao expoe socket no _devices[0].socket');
            }
            return;
          }

          if (sock.__wavoipWiretap) {
            console.log('[WaVoIP][socket] Wiretap ja' + ' instalado anteriormente');
            return;
          }
          sock.__wavoipWiretap = true;

          const origEmit = sock.emit?.bind(sock);
          if (origEmit) {
            sock.emit = function (event: string, ...args: any[]) {
              try { console.log('[WaVoIP][socket] EMIT', event, ...args.slice(0, 2)); } catch {}
              return origEmit(event, ...args);
            };
          }
          if (typeof sock.onAny === 'function') {
            sock.onAny((event: string, ...args: any[]) => {
              try { console.log('[WaVoIP][socket] RECV', event, ...args.slice(0, 2)); } catch {}
            });
          } else {
            console.warn('[WaVoIP][socket] sock.onAny nao existe, RECV nao sera logado');
          }
          sock.on?.('connect', () => console.log('[WaVoIP][socket] connect, id:', sock.id));
          sock.on?.('disconnect', (reason: string) => console.log('[WaVoIP][socket] disconnect:', reason));
          sock.on?.('connect_error', (err: any) => console.log('[WaVoIP][socket] connect_error:', err?.message || err));
          console.log('[WaVoIP][socket] Wiretap instalado, socketId:', sock.id, 'connected:', sock.connected);
        };
        installWiretap(1);

        if (dev) {
          // Estado inicial que o SDK ja' tem em maos (antes de qualquer evento)
          if (dev.status) setDeviceStatus(dev.status);
          if (dev.qrCode) setDeviceQrCode(dev.qrCode);

          if (typeof dev.onStatus === 'function') {
            dev.onStatus((status: string) => {
              if (destroyed) return;
              console.log('[WaVoIP] Device status:', status);
              const connected = status === 'open' || status === 'UP' || status === 'connected';
              setIsConnected(connected);
              setDeviceStatus(status);
              // "open" = numero vinculado, o QR antigo nao serve mais
              if (connected) setDeviceQrCode(null);
              supabase.from('wavoip_devices').update({ status }).eq('id', device.id).then(() => {});
            });
          }

          // QR do WaVoIP. O device entra em "connecting" quando nao tem numero
          // vinculado e o PROPRIO socket manda o QR — nao existe endpoint REST
          // pra isso. Sem escutar esse evento, a tela de admin nunca tinha o
          // que mostrar e parecia que o WaVoIP nao suportava QR.
          if (typeof dev.onQRCode === 'function') {
            dev.onQRCode((qr: string | undefined) => {
              if (destroyed) return;
              console.log('[WaVoIP] QR code recebido:', qr ? `${qr.slice(0, 12)}... (${qr.length} chars)` : 'vazio');
              setDeviceQrCode(qr || null);
            });
          }

          if (typeof dev.onContact === 'function') {
            dev.onContact((_type: string, contact: any) => {
              if (destroyed) return;
              console.log('[WaVoIP] Contact:', contact);
              const phoneNumber = contact?.phone_number || contact?.phone;
              if (phoneNumber && device.id) {
                supabase.from('wavoip_devices').update({ phone_number: phoneNumber }).eq('id', device.id);
              }
            });
          }
        }

        // Incoming call offers (method call, not property assignment)
        if (typeof wavoip.onOffer === 'function') {
          wavoip.onOffer(async (callOffer: any) => {
            if (destroyed) return;
            // SDK do WaVoIP emite onOffer pro proprio numero do outgoing call
            // (bug deles). Ignora se temos outgoing em progresso, senao abre
            // modal de "Chamada recebida" duplicado e quebra a UI.
            if (outgoingInProgressRef.current) {
              console.log('[WaVoIP] onOffer ignorado, outgoing em progresso');
              return;
            }
            console.log('[WaVoIP] Incoming call offer:', callOffer);

            const peerPhone = callOffer?.peer?.phone || callOffer?.peer || callOffer?.from || '';

            let leadId: string | undefined;
            let peerName: string | undefined;
            let profilePicture: string | null = null;
            try {
              const { data } = await supabase.rpc('find_lead_by_phone_crm', { p_phone: peerPhone });
              if (data) {
                leadId = data;
                const { data: lead } = await supabase.from('crm_leads').select('name, instagram_profile_pic_url, whatsapp_profile_pic_url').eq('id', data).single();
                if (lead) {
                  peerName = lead.name;
                  profilePicture = lead.instagram_profile_pic_url || (lead as any).whatsapp_profile_pic_url || null;
                }
              }
            } catch (e) { console.error(e); }

            const { data: callRecord } = await supabase.from('call_history').insert({
              wavoip_device_id: device.id,
              user_id: userId!,
              lead_id: leadId || null,
              direction: 'INCOMING',
              status: 'RINGING',
              peer_phone: peerPhone,
              peer_name: peerName || null,
            }).select('id').single();

            if (callRecord) callHistoryIdRef.current = callRecord.id;

            // CRITICO: subscreve eventos do offer ANTES de mostrar o modal.
            // SDK do WaVoIP precisa de listeners ativos no offer pra considerar
            // o cliente "handler ativo" — sem isso accept() fica pendurado pq
            // o servidor nao vê ninguem inscrito no ciclo de vida do offer.
            try {
              if (typeof callOffer.onStatus === 'function') {
                callOffer.onStatus((status: string) => {
                  console.log('[WaVoIP] offer.onStatus:', status);
                  if (callHistoryIdRef.current) {
                    supabase.from('call_history').update({ status }).eq('id', callHistoryIdRef.current).then(() => {});
                  }
                });
              }
              if (typeof callOffer.onAcceptedElsewhere === 'function') {
                callOffer.onAcceptedElsewhere(() => {
                  console.log('[WaVoIP] offer accepted elsewhere');
                  stopRingtone();
                  setShowIncomingModal(false);
                  setIncomingOffer(null);
                  currentOfferRef.current = null;
                  toast.info('Chamada atendida em outro dispositivo');
                });
              }
              if (typeof callOffer.onRejectedElsewhere === 'function') {
                callOffer.onRejectedElsewhere(() => {
                  console.log('[WaVoIP] offer rejected elsewhere');
                  stopRingtone();
                  setShowIncomingModal(false);
                  setIncomingOffer(null);
                  currentOfferRef.current = null;
                });
              }
              if (typeof callOffer.onUnanswered === 'function') {
                callOffer.onUnanswered(() => {
                  console.log('[WaVoIP] offer unanswered');
                  stopRingtone();
                  setShowIncomingModal(false);
                  setIncomingOffer(null);
                  currentOfferRef.current = null;
                  if (callHistoryIdRef.current) {
                    supabase.from('call_history').update({ status: 'NOT_ANSWERED', ended_at: new Date().toISOString() }).eq('id', callHistoryIdRef.current).then(() => {});
                    callHistoryIdRef.current = null;
                  }
                });
              }
              if (typeof callOffer.onEnd === 'function') {
                callOffer.onEnd(() => {
                  console.log('[WaVoIP] offer ended');
                  stopRingtone();
                  setShowIncomingModal(false);
                  setIncomingOffer((prev) => {
                    // Offer terminou antes de ser aceito (caller desligou ringando)
                    if (prev) currentOfferRef.current = null;
                    return null;
                  });
                });
              }
            } catch (e) { console.warn('[WaVoIP] Erro ao subscrever eventos do offer:', e); }

            // Salva offer REAL em ref (fora do React) e metadados em state
            currentOfferRef.current = callOffer;
            setIncomingOffer({ peerPhone, peerName, leadId, profilePicture });
            setShowIncomingModal(true);
            playRingtone();
          });
        }

        // NOTE: No .connect() call — connection happens automatically in constructor

      } catch (e) {
        console.error('[WaVoIP] Init error:', e);
        toast.error('Erro ao inicializar WaVoIP');
      }
    };

    initWavoip();

    return () => {
      destroyed = true;
      if (wavoipRef.current) {
        try {
          // SDK do WaVoIP NAO tem .disconnect()/.destroy() no Wavoip instance.
          // Tem .removeDevices(tokens) que fecha socket de cada token. Sem
          // isso, o socket velho fica orfao na conexao com o servidor.
          // Sintoma: useEffect roda 2x (HMR ou re-render), 2 instancias
          // ativas pro mesmo token, servidor manda ack pro socket errado,
          // startCall fica pendurado pra sempre (TIMEOUT).
          if (device?.token && typeof wavoipRef.current.removeDevices === 'function') {
            console.log('[WaVoIP] Cleanup: removeDevices', device.token.slice(0, 12));
            wavoipRef.current.removeDevices([device.token]);
          }
          // Fallback paranoico: fecha sockets internos direto
          const devs = (wavoipRef.current as any)._devices || [];
          for (const d of devs) {
            try {
              if (d.socket?.connected) d.socket.disconnect();
              d.socket?.removeAllListeners?.();
            } catch {}
          }
        } catch (e) { console.warn('[WaVoIP] cleanup error:', e); }
        wavoipRef.current = null;
      }
      setIsConnected(false);
    };
  }, [device?.token, device?.id, userId]);

  // ===================== REQUEST CALL (PENDING) =====================
  // Abre o modal em status PENDING — busca dados do lead, mas NAO toca o
  // wavoip ainda. So aciona startCall via confirmPendingCall, quando o user
  // confirmar o playbook (ou clicar "Sem coach"). Sem ringtone, sem registro
  // em call_history ainda.
  const requestCall = useCallback(async (phoneNumber: string, leadId?: string) => {
    if (!wavoipRef.current || !isConnected) {
      toast.error('WaVoIP não está conectado');
      return;
    }
    if (activeCall) {
      toast.error('Já existe uma chamada ativa');
      return;
    }
    // Linha compartilhada: alguem da equipe pode estar falando agora. O device
    // aceita uma chamada por vez.
    if (device?.is_shared && device.token && await isWavoipLineBusy(device.token)) {
      toast.error(`A linha ${device.phone_number || device.name || 'compartilhada'} está em uso por outra pessoa. Tente em instantes.`);
      return;
    }

    let peerName: string | undefined;
    let profilePicture: string | null = null;
    if (leadId) {
      const { data: lead } = await supabase.from('crm_leads').select('name, instagram_profile_pic_url, whatsapp_profile_pic_url').eq('id', leadId).single();
      if (lead) {
        peerName = lead.name;
        profilePicture = lead.instagram_profile_pic_url || (lead as any).whatsapp_profile_pic_url || null;
      }
    }
    peerNameRef.current = peerName;

    setActiveCall({
      id: '',
      wavoipCallId: '',
      direction: 'OUTGOING',
      status: 'PENDING',
      peerPhone: phoneNumber,
      peerName,
      profilePicture,
      startedAt: new Date(),
      duration: 0,
      isMuted: false,
      isPeerMuted: false,
      leadId,
    });
    setShowActiveCallModal(true);
  }, [isConnected, activeCall, device]);

  // ===================== CONFIRM PENDING CALL =====================
  // Pega o activeCall em PENDING e dispara o wavoip startCall de verdade.
  // E aqui que o lead recebe a ligacao. Tambem cria o registro em
  // call_history (so quando o user confirma — antes era no requestCall, mas
  // isso poluia historico se o user desistisse no modal).
  const confirmPendingCall = useCallback(async (opts?: { disableCoach?: boolean }) => {
    const pending = activeCall;
    if (!pending || pending.status !== 'PENDING') return;
    if (!wavoipRef.current || !isConnected) {
      toast.error('WaVoIP não está conectado');
      return;
    }

    const phoneNumber = pending.peerPhone;
    const leadId = pending.leadId;
    const peerName = pending.peerName;
    const profilePicture = pending.profilePicture;

    // Pula o warm-up de mic se permissao ja foi concedida (poupa 300-1500ms).
    // Why: getUserMedia abre/fecha um stream so pra validar permissao, e isso
    // atrasa o startCall — lead so toca depois desse warm-up. How to apply: usa
    // Permissions API quando disponivel; se 'granted', confia e pula direto pro
    // startCall (a SDK do WaVoIP captura mic internamente). Safari/Firefox sem
    // suporte caem no warm-up tradicional.
    let micPermissionGranted = false;
    try {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      micPermissionGranted = perm.state === 'granted';
    } catch {
      // Permissions API nao suporta 'microphone' (Safari/Firefox antigo)
    }
    if (!micPermissionGranted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch {
        toast.error('Permissão de microfone negada');
        return;
      }
    }

    // INSERT do call_history dispara em paralelo com startCall (poupa 200-600ms
    // de roundtrip pro Supabase). Why: o ID do call_history so e necessario pra
    // UPDATE depois (status ACTIVE, wavoip_call_id, end_at), nao bloqueia o
    // call:start. How to apply: nao da await aqui; quando o INSERT voltar,
    // popula callHistoryIdRef e atualiza id no activeCall.
    const insertPromise = supabase.from('call_history').insert({
      wavoip_device_id: device?.id || null,
      user_id: userId!,
      lead_id: leadId || null,
      direction: 'OUTGOING',
      status: 'CALLING',
      peer_phone: phoneNumber,
      peer_name: peerName || null,
    }).select('id').single();

    // Fica acessivel pro updateCallHistory: se a ligacao falhar antes do insert
    // voltar, ele espera aqui em vez de largar a linha presa em CALLING.
    callHistoryInsertRef.current = Promise.resolve(insertPromise).then(({ data: callRecord }) => {
      if (callRecord?.id) {
        callHistoryIdRef.current = callRecord.id;
        setActiveCall(prev => prev && !prev.id ? { ...prev, id: callRecord.id } : prev);
        return callRecord.id as string;
      }
      return null;
    });
    callHistoryInsertRef.current.catch(() => {});

    setActiveCall({
      id: '',
      wavoipCallId: '',
      direction: 'OUTGOING',
      status: 'CALLING',
      peerPhone: phoneNumber,
      peerName,
      profilePicture,
      startedAt: new Date(),
      duration: 0,
      isMuted: false,
      isPeerMuted: false,
      leadId,
      coachDisabled: opts?.disableCoach || false,
    });
    // Toca o som de "chamando" enquanto espera o lead atender. Para nos
    // callbacks abaixo (peerAccept, peerReject, unanswered, end, error).
    playRingback();
    // Marca que tem outgoing em progresso pro onOffer ignorar bug da SDK
    outgoingInProgressRef.current = true;

    try {
      console.log('[WaVoIP] startCall calling, to:', phoneNumber);
      // Dump do estado interno da SDK pra diagnostico — quando call:start nao
      // chega no servidor WaVoIP, precisamos ver se o socket esta open de
      // verdade ou se a SDK pegou outro device.
      try {
        const inst: any = wavoipRef.current;
        const devs = inst._devices || [];
        console.log('[WaVoIP][diag] devices:', devs.map((d: any) => ({
          token: d.token?.slice(0, 12) + '...',
          status: d.status,
          socketConnected: d.socket?.connected,
          socketId: d.socket?.id,
          contact: d.contact,
        })));
      } catch (e) { console.warn('[WaVoIP][diag] dump failed:', e); }

      // Race com timeout — se o socket nao retornar ack em 30s, o startCall
      // fica pendurado pra sempre (SDK nao tem timeout interno). Trata como
      // falha pra UI nao ficar presa em "Chamando". 30s e o que o template
      // referencia usa, 15s era curto demais pra rede 3G/instavel.
      // fromTokens informa ao servidor WaVoIP qual device usar pra discar.
      // Sem isso, o `call:start` chega no servidor mas ele nao sabe pra quem
      // rotear, engole sem ack → TIMEOUT_30S silencioso.
      const startCallPromise = wavoipRef.current.startCall({
        to: phoneNumber,
        fromTokens: device?.token ? [device.token] : undefined,
      });
      const timeoutPromise = new Promise<{ call: null; err: string }>(resolve =>
        setTimeout(() => resolve({ call: null, err: 'TIMEOUT_30S' }), 30000)
      );
      // startCall returns { call: CallOutgoing | null, err: string | null }
      const result: any = await Promise.race([startCallPromise, timeoutPromise]);
      console.log('[WaVoIP] startCall returned:', JSON.stringify(result, (_k, v) => typeof v === 'function' ? '[fn]' : v, 2));

      // Check for actual error - result.err can be an empty object {} which is truthy
      const hasError = result?.err && (typeof result.err === 'string' ? result.err.length > 0 : Object.keys(result.err).length > 0);
      if (hasError) {
        const errStr = typeof result.err === 'string' ? result.err : JSON.stringify(result.err);
        console.error('[WaVoIP] startCall error:', errStr);
        stopRingback();

        // Extrai motivo estruturado quando err e' objeto (ex: PHONE_DONT_EXIST).
        // Servidor WaVoIP retorna { message, devices: [{ reason }] } em rejeicoes
        // por validacao (numero sem WA ativo, blocked, etc).
        const errObj: any = typeof result.err === 'object' ? result.err : null;
        const reason: string | undefined = errObj?.devices?.[0]?.reason;

        // TIMEOUT_30S = backend WaVoIP recebeu o emit mas nao deu ack. Costuma
        // ser device travado no servidor deles. Destroi a instancia inteira pro
        // useEffect recriar o socket do zero (a SDK expoe um .restart() mas o
        // metodo perde o this quando chamado de fora — fica buggado).
        if (errStr === 'TIMEOUT_30S' || errStr === 'TIMEOUT_15S') {
          toast.error('WaVoIP travou. Tentei reconectar, se nao funcionar em 1min faca logout/login do dispositivo no painel WaVoIP.', { duration: 8000 });
          try {
            if (wavoipRef.current) {
              console.log('[WaVoIP] Tearing down instance to force socket reconnect');
              const inst = wavoipRef.current;
              wavoipRef.current = null;
              setIsConnected(false);
              try {
                if (typeof inst.disconnect === 'function') inst.disconnect();
                else if (typeof inst.destroy === 'function') inst.destroy();
                else {
                  // fallback: fecha sockets internos diretamente
                  const devs = (inst as any)._devices || [];
                  for (const d of devs) {
                    try { d.socket?.close?.(); } catch {}
                  }
                }
              } catch {}
              // Forca o useEffect a reinicializar: zera device, recarrega no
              // tick seguinte. O cleanup do useEffect derruba qualquer ref que
              // sobrou e o reload monta um socket WaVoIP novo do zero.
              setDevice(null);
              setTimeout(() => loadDevice(), 500);
            }
          } catch (e) { console.warn('[WaVoIP] teardown failed:', e); }
        } else if (reason === 'PHONE_DONT_EXIST') {
          // Numero do lead nao tem WA ativo OU formato invalido OU bloqueado.
          // Nada que possamos resolver no front — mensagem clara pro vendedor.
          toast.error(`${phoneNumber} nao tem WhatsApp ativo, ou esta bloqueado. Confere o numero no card do lead.`, { duration: 8000 });
        } else if (reason === 'DEVICE_OFFLINE' || reason === 'DEVICE_DISCONNECTED') {
          toast.error('Seu dispositivo WaVoIP esta offline. Reconecta no painel WaVoIP.', { duration: 8000 });
        } else if (reason) {
          toast.error(`Falha no WaVoIP (${reason}): ${errObj?.message || 'tente novamente'}`, { duration: 6000 });
        } else if (errObj?.message) {
          toast.error(errObj.message, { duration: 6000 });
        } else {
          toast.error('Erro ao iniciar chamada: ' + errStr);
        }

        outgoingInProgressRef.current = false;
        handleCallFailed('FAILED', reason || errStr);
        return;
      }

      const outgoing = result?.call || result;

      if (!outgoing) {
        console.error('[WaVoIP] No call object returned');
        stopRingback();
        handleCallFailed('FAILED');
        return;
      }

      // CallOutgoing events are methods, not property assignments
      if (typeof outgoing.onPeerAccept === 'function') {
        outgoing.onPeerAccept(async (activeCallObj: any) => {
          // Lead atendeu — para o ringback, o audio real do WaVoIP toma o lugar
          stopRingback();
          // Outgoing transitou pra ACTIVE, libera o guard pra onOffer real
          // (incoming) voltar a funcionar
          outgoingInProgressRef.current = false;
          // activeCallObj is the CallActive instance
          const callActive = activeCallObj || outgoing;

          // Force resume AudioContext (browser may have suspended it)
          try {
            const audioCtx = callActive?.audioContext || callActive?.pc?.getReceivers?.()?.find((r: any) => r.track?.kind === 'audio')?.track;
            if (callActive?.audioContext?.state === 'suspended') {
              await callActive.audioContext.resume();
              console.log('[WaVoIP] AudioContext resumed on peer accept');
            }
            // Also try to resume any global AudioContext
            const contexts = (window as any).__audioContexts || [];
            for (const ctx of contexts) {
              if (ctx.state === 'suspended') await ctx.resume();
            }
          } catch (e) {
            console.warn('[WaVoIP] AudioContext resume failed:', e);
          }

          setupActiveCall(callActive, 'OUTGOING', phoneNumber, peerNameRef.current, leadId, profilePicture);
        });
      }

      if (typeof outgoing.onPeerReject === 'function') {
        outgoing.onPeerReject(() => {
          stopRingback();
          playHangupTone();
          handleCallFailed('REJECTED');
        });
      }

      if (typeof outgoing.onUnanswered === 'function') {
        outgoing.onUnanswered(() => {
          stopRingback();
          playHangupTone();
          handleCallFailed('NOT_ANSWERED');
        });
      }

      if (typeof outgoing.onEnd === 'function') {
        outgoing.onEnd(() => {
          stopRingback();
          // Only handle if call wasn't already promoted to active
          if (!activeCallObjRef.current) {
            playHangupTone();
            handleCallFailed('ENDED');
          }
        });
      }

      if (typeof outgoing.onError === 'function') {
        outgoing.onError((err: any) => {
          console.error('[WaVoIP] Call error:', err);
          stopRingback();
          playHangupTone();
          handleCallFailed('FAILED');
        });
      }

    } catch (e: any) {
      console.error('[WaVoIP] startCall exception:', e);
      toast.error('Erro ao iniciar chamada');
      stopRingback();
      handleCallFailed('FAILED');
    }
  }, [isConnected, activeCall, device, userId, setupActiveCall, handleCallFailed]);

  // ===================== ANSWER INCOMING CALL =====================
  const answerCall = useCallback(async () => {
    // Offer real vem do ref (fora do React) pra preservar methods/proxies internos
    const offer = currentOfferRef.current;
    const meta = incomingOffer;
    if (!offer || !meta) {
      console.warn('[WaVoIP] answerCall: sem offer ativo');
      return;
    }
    stopRingtone();

    // Pre-flight: garante mic permitido. Sem isso o accept() da SDK falha
    // silencioso porque o WebRTC nao anexa track de audio local.
    console.log('[WaVoIP] answerCall: requesting mic permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      console.log('[WaVoIP] answerCall: mic OK');
    } catch (e) {
      console.error('[WaVoIP] answerCall: mic denied', e);
      toast.error('Permita o microfone do navegador pra atender chamadas');
      setShowIncomingModal(false);
      setIncomingOffer(null);
      currentOfferRef.current = null;
      handleCallFailed('FAILED');
      return;
    }

    try {
      console.log('[WaVoIP] answerCall: calling offer.accept()');
      // callOffer.accept() returns { call: CallActive, err: string | null }
      const acceptPromise = offer.accept();
      const timeoutPromise = new Promise<{ call: null; err: string }>(resolve =>
        setTimeout(() => resolve({ call: null, err: 'ACCEPT_TIMEOUT_10S' }), 10000)
      );
      const result: any = await Promise.race([acceptPromise, timeoutPromise]);
      console.log('[WaVoIP] answerCall: accept returned', JSON.stringify(result, (_k, v) => typeof v === 'function' ? '[fn]' : v, 2));

      const call = result?.call || (result && !result.err ? result : null);
      const errRaw = result?.err;
      const hasError = errRaw && (typeof errRaw === 'string' ? errRaw.length > 0 : Object.keys(errRaw).length > 0);

      if (hasError || !call) {
        const errStr = typeof errRaw === 'string' ? errRaw : JSON.stringify(errRaw || 'no call object');
        console.error('[WaVoIP] Accept error:', errStr);
        toast.error('Erro ao atender chamada: ' + errStr);
        setShowIncomingModal(false);
        setIncomingOffer(null);
        currentOfferRef.current = null;
        handleCallFailed('FAILED');
        return;
      }

      setShowIncomingModal(false);
      setIncomingOffer(null);
      currentOfferRef.current = null;
      setupActiveCall(call, 'INCOMING', meta.peerPhone, meta.peerName, meta.leadId, meta.profilePicture);
      setShowActiveCallModal(true);
    } catch (e: any) {
      console.error('[WaVoIP] Answer exception:', e);
      toast.error('Erro ao atender: ' + (e?.message || 'desconhecido'));
      setShowIncomingModal(false);
      setIncomingOffer(null);
      currentOfferRef.current = null;
      handleCallFailed('FAILED');
    }
  }, [incomingOffer, setupActiveCall, handleCallFailed]);

  // ===================== REJECT INCOMING CALL =====================
  const rejectCall = useCallback(async () => {
    const offer = currentOfferRef.current;
    if (!offer) return;
    stopRingtone();
    setShowIncomingModal(false);
    try {
      // callOffer.reject() returns { err: string | null }
      await offer.reject();
    } catch (e) { console.warn('[WaVoIP] reject error:', e); }
    await updateCallHistory({ status: 'REJECTED', ended_at: new Date().toISOString() });
    callHistoryIdRef.current = null;
    setIncomingOffer(null);
    currentOfferRef.current = null;
  }, [updateCallHistory]);

  // ===================== END ACTIVE CALL =====================
  const endCall = useCallback(async () => {
    // PENDING = user cancelou antes de iniciar wavoip; so fecha o modal sem
    // toast/insert. (handleCallFailed escreveria "Chamada encerrada" e
    // poluiria a UX.)
    if (activeCall?.status === 'PENDING') {
      setActiveCall(null);
      setShowActiveCallModal(false);
      return;
    }
    // Para o ringback caso o user desligue antes do peer atender
    stopRingback();
    if (activeCallObjRef.current) {
      try {
        // end() returns Promise<{ err: string | null }>
        const result = await activeCallObjRef.current.end();
        if (result?.err) {
          console.error('[WaVoIP] End call error:', result.err);
        }
      } catch (e) {
        console.error('[WaVoIP] End call exception:', e);
      }
    } else {
      // Sem call object ainda — ainda no estado "Chamando" antes de
      // peerAccept/peerReject. Forca limpeza do estado.
      handleCallFailed('CANCELED');
    }
  }, [activeCall?.status, handleCallFailed]);

  // ===================== TOGGLE MUTE =====================
  const toggleMute = useCallback(async () => {
    if (!activeCallObjRef.current) return;
    try {
      const isMuted = activeCall?.isMuted || false;
      // mute()/unmute() return Promise<{ err: string | null }>
      const result = isMuted
        ? await activeCallObjRef.current.unmute()
        : await activeCallObjRef.current.mute();

      if (result?.err) {
        console.error('[WaVoIP] Mute/unmute error:', result.err);
        return;
      }
      setActiveCall(prev => prev ? { ...prev, isMuted: !isMuted } : null);
    } catch (e) {
      console.error('[WaVoIP] Mute error:', e);
    }
  }, [activeCall?.isMuted]);

  // Legacy alias — codigo antigo que chamava initiateCall agora abre o modal
  // em PENDING (mesmo fluxo do botao novo).
  const initiateCall = requestCall;

  // Pega o device vivo da instancia do SDK (o SDK expoe em .devices ou ._devices
  // dependendo da versao).
  const getLiveDevice = useCallback((): any | null => {
    const inst: any = wavoipRef.current;
    return inst?.devices?.[0] || inst?._devices?.[0] || null;
  }, []);

  // Reinicia o device no servidor do WaVoIP e RELIGA o socket.
  //
  // Dois detalhes que quebravam isso antes:
  //  - o device hiberna sozinho (a API responde 503 device_not_running) e nesse
  //    estado o socket nem conecta, entao nao basta mandar reiniciar: tem que
  //    esperar ele subir;
  //  - o socket do SDK desiste depois de 3 tentativas (reconnect(u === 3) para).
  //    Como o device cai a cada ~75s enquanto ninguem escaneia o QR, essas 3
  //    tentativas acabam rapido e o socket fica morto ate recarregar a pagina.
  //
  // Por isso aqui vai por REST direto (o WaVoIP libera CORS pra nossa origem),
  // sem depender do SDK estar vivo. Ver [[wavoip-qr-pelo-socket]].
  const restartDevice = useCallback(async () => {
    const token = device?.token;
    if (!token) return;
    const base = `https://devices.wavoip.com/${token}`;
    setDeviceStatus('restarting');
    setDeviceQrCode(null);
    try {
      await fetch(`${base}/device/restart`);
      toast.info('Reiniciando dispositivo WaVoIP...');
    } catch (e) {
      console.error('[WaVoIP] restart falhou:', e);
      toast.error('Não foi possível reiniciar o dispositivo');
      return;
    }

    // Espera o device voltar a responder (all_info deixa de dar 503)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`${base}/whatsapp/all_info`);
        if (res.ok) break;
      } catch { /* segue tentando */ }
    }

    // Religa o socket do SDK na mao, ja' que ele pode ter desistido
    for (let i = 0; i < 5; i++) {
      const sock: any = getLiveDevice()?.socket;
      if (sock?.connected) break;
      try { sock?.connect(); } catch { /* noop */ }
      await new Promise(r => setTimeout(r, 2000));
    }
  }, [device?.token, getLiveDevice]);

  // Desvincula o numero do device. Volta pra "connecting" e o socket manda um
  // QR novo — e assim que se troca o numero que faz as ligacoes.
  const logoutDevice = useCallback(async () => {
    const token = device?.token;
    if (!token) return;
    try {
      await fetch(`https://devices.wavoip.com/${token}/whatsapp/logout`);
      setDeviceQrCode(null);
      setDeviceStatus('connecting');
      toast.info('Número desvinculado. Aguarde o QR Code...');
    } catch (e) {
      console.error('[WaVoIP] logout falhou:', e);
      toast.error('Não foi possível desvincular o número');
    }
  }, [device?.token]);

  return (
    <CallContext.Provider value={{
      device,
      deviceLoading,
      isConnected,
      activeCall,
      callEndedResult,
      incomingOffer,
      requestCall,
      confirmPendingCall,
      initiateCall,
      answerCall,
      rejectCall,
      endCall,
      toggleMute,
      showIncomingModal,
      showActiveCallModal,
      showCallEndedModal,
      setShowIncomingModal,
      setShowActiveCallModal,
      setShowCallEndedModal,
      refreshDevice: loadDevice,
      deviceStatus,
      deviceQrCode,
      restartDevice,
      logoutDevice,
      isTranscribing,
      transcriptions,
      transcriptionError,
      audioDiag,
    }}>
      {children}
    </CallContext.Provider>
  );
};
