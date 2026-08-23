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

  // Handle call failed/ended before active
  const handleCallFailed = useCallback((status: string) => {
    stopDurationTimer();
    stopTranscription();
    if (callHistoryIdRef.current) {
      supabase.from('call_history').update({ status, ended_at: new Date().toISOString() }).eq('id', callHistoryIdRef.current);
    }
    toast.info(status === 'NOT_ANSWERED' ? 'Chamada não atendida' : status === 'REJECTED' ? 'Chamada rejeitada' : 'Chamada encerrada');
    setActiveCall(null);
    activeCallObjRef.current = null;
    callStartTimeRef.current = null;
    setShowActiveCallModal(false);
    callHistoryIdRef.current = null;
    // Libera o guard de outgoing pro proximo onOffer real funcionar
    outgoingInProgressRef.current = false;
  }, [stopDurationTimer, stopTranscription]);

  // Setup active call listeners + start transcription
  const setupActiveCall = useCallback((callObj: any, direction: 'INCOMING' | 'OUTGOING', peerPhone: string, peerName?: string, leadId?: string, profilePicture?: string | null) => {
    callStartTimeRef.current = new Date();
    peerNameRef.current = peerName;
    activeCallObjRef.current = callObj;

    // Ensure remote audio plays through speakers. Em OUTGOING o SDK as vezes
    // expoe callObj.pc, mas em INCOMING quase nunca expoe — sem isso o user
    // atende mas nao ouve nada ("atendi e nao funcionou"). Fallback: usa o
    // stream que o wavoip-init capturou via Proxy no RTCPeerConnection.
    try {
      let remoteStream: MediaStream | null = null;
      if (callObj?.pc) {
        const pc = callObj.pc as RTCPeerConnection;
        const audioTrack = pc.getReceivers().find((r: RTCRtpReceiver) => r.track?.kind === 'audio')?.track;
        if (audioTrack) {
          remoteStream = new MediaStream([audioTrack]);
          console.log('[WaVoIP] Remote audio via callObj.pc');
        }
      }
      if (!remoteStream && wavoipRemoteCapture.incomingStream) {
        remoteStream = wavoipRemoteCapture.incomingStream;
        console.log('[WaVoIP] Remote audio via wavoipRemoteCapture.incomingStream (fallback INCOMING)');
      }
      if (remoteStream) {
        const audioEl = document.createElement('audio');
        audioEl.srcObject = remoteStream;
        audioEl.autoplay = true;
        audioEl.play().catch((e) => console.warn('[WaVoIP] audio.play() failed:', e));
        // Guarda referencia no callObjRef pra remover quando a chamada terminar
        (activeCallObjRef.current as any).__remoteAudioEl = audioEl;
      } else {
        console.warn('[WaVoIP] Nenhum remote audio stream disponivel pra tocar');
      }
    } catch (e) {
      console.warn('[WaVoIP] Remote audio fallback failed:', e);
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

    if (callHistoryIdRef.current) {
      supabase.from('call_history').update({ status: 'ACTIVE', wavoip_call_id: callObj.id || null }).eq('id', callHistoryIdRef.current);
    }

    startDurationTimer();

    // Start transcription
    startTranscription(callObj, peerName).catch(err => {
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

        stopDurationTimer();
        stopTranscription();

        if (savedCallHistoryId) {
          await saveTranscriptions(savedCallHistoryId);

          await supabase.from('call_history').update({
            status: 'ENDED',
            duration_seconds: durationSeconds,
            ended_at: new Date().toISOString(),
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
  }, [startDurationTimer, stopDurationTimer, startTranscription, stopTranscription, saveTranscriptions, getFinalTranscriptions]);

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

    insertPromise.then(({ data: callRecord }) => {
      if (callRecord?.id) {
        callHistoryIdRef.current = callRecord.id;
        setActiveCall(prev => prev && !prev.id ? { ...prev, id: callRecord.id } : prev);
      }
    });

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
        handleCallFailed('FAILED');
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
    if (callHistoryIdRef.current) {
      supabase.from('call_history').update({ status: 'REJECTED', ended_at: new Date().toISOString() }).eq('id', callHistoryIdRef.current);
      callHistoryIdRef.current = null;
    }
    setIncomingOffer(null);
    currentOfferRef.current = null;
  }, []);

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
    }}>
      {children}
    </CallContext.Provider>
  );
};
