// useMeetSignals — sinais leves entre participantes da sala:
//   - raise_hand: alguem levantou a mao (toggle)
//   - reaction: emoji burst flutuando na tela
//   - screen_share_request/response: pedido de tela com aprovacao do host
//   - force_mute: host silencia todos
//   - session_start: host parou a musica de espera e iniciou a sessao
//
// Transporte DUPLO pra garantir entrega:
//   1) LiveKit DataChannel (RoomEvent.DataReceived / publishData) — mesma
//      conexao WebRTC que ja entrega audio/video, entao se a sala conectou
//      o sinal chega. PRIMARIO.
//   2) Supabase Realtime broadcast — fallback/redundancia.
// Dedup por chave (type+identity+ts) pra nao processar 2x quando chega pelos
// dois caminhos. Antes era so Realtime, e o lead anon no mobile nao recebia.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type MeetSignal =
  | { type: 'raise_hand'; raised: boolean; identity: string; name: string; ts: number }
  | { type: 'reaction'; emoji: string; identity: string; name: string; ts: number }
  | { type: 'screen_share_request'; requestId: string; identity: string; name: string; ts: number }
  | { type: 'screen_share_response'; requestId: string; targetIdentity: string; approved: boolean; ts: number }
  // force_mute sem target = silencia todos; com target = so aquele participante.
  | { type: 'force_mute'; target?: string; ts: number }
  // request_unmute sem target = convite geral (opt-in via toast); com target =
  // host convidou aquele participante (liga o mic automatico).
  | { type: 'request_unmute'; target?: string; ts: number }
  | { type: 'session_start'; ts: number };

export interface ScreenShareRequest {
  requestId: string;
  identity: string;
  name: string;
  ts: number;
}

export interface ReactionBurst {
  id: string;
  emoji: string;
  fromName: string;
  ts: number;
}

export interface RaisedHand {
  identity: string;
  name: string;
  ts: number;
}

const LK_TOPIC = 'meet-signal';

function signalKey(sig: MeetSignal): string {
  const s = sig as any;
  return `${sig.type}:${s.identity || s.targetIdentity || s.target || ''}:${sig.ts}:${s.requestId || ''}:${s.emoji || ''}`;
}

export function useMeetSignals(opts?: { onSessionStart?: () => void }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const onSessionStartRef = useRef(opts?.onSessionStart);
  onSessionStartRef.current = opts?.onSessionStart;

  const [raisedHands, setRaisedHands] = useState<Record<string, RaisedHand>>({});
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [pendingScreenRequests, setPendingScreenRequests] = useState<ScreenShareRequest[]>([]);
  const screenResponseCallbacks = useRef<Map<string, (approved: boolean) => void>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Dedup entre os dois transportes.
  const seenRef = useRef<Set<string>>(new Set());

  const roomName = room?.name;

  // Processa um sinal venha de onde vier (LiveKit ou Realtime), com dedup.
  const processSignal = useCallback((sig: MeetSignal | null) => {
    if (!sig || !sig.type) return;
    const validTypes = ['raise_hand', 'reaction', 'screen_share_request', 'screen_share_response', 'force_mute', 'request_unmute', 'session_start'];
    if (!validTypes.includes(sig.type)) return;

    const key = signalKey(sig);
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    if (seenRef.current.size > 400) {
      // Housekeeping: nao deixa o Set crescer infinito numa sessao longa.
      seenRef.current = new Set(Array.from(seenRef.current).slice(-200));
    }

    if (sig.type === 'session_start') {
      onSessionStartRef.current?.();
      return;
    }
    if (sig.type === 'force_mute') {
      // Com target, so o participante alvo se silencia. Sem target, todos.
      const target = (sig as any).target as string | undefined;
      if (target && target !== localParticipant?.identity) return;
      try { room?.localParticipant?.setMicrophoneEnabled(false); } catch {}
      toast(target ? '🔇 O host silenciou seu microfone' : '🔇 O host silenciou os microfones', {
        duration: 6000,
        description: 'Reative o seu quando for falar.',
      });
      return;
    }
    if (sig.type === 'request_unmute') {
      const target = (sig as any).target as string | undefined;
      // Convite geral (sem target): opt-in via toast com botao, pra evitar eco/caos
      // de varios mics abrindo de uma vez. Convite especifico (com target): liga
      // o mic automatico, porque o host escolheu aquela pessoa pra falar.
      if (target && target !== localParticipant?.identity) return;
      if (target) {
        room?.localParticipant?.setMicrophoneEnabled(true)
          .then(() => toast('🎤 O host te convidou a falar', { duration: 6000, description: 'Seu microfone foi ligado.' }))
          .catch(() => toast('🎤 O host quer te ouvir', {
            duration: 10000,
            description: 'Toque para ligar seu microfone.',
            action: { label: 'Ligar microfone', onClick: () => { room?.localParticipant?.setMicrophoneEnabled(true).catch(() => {}); } },
          }));
      } else {
        toast('🎤 O host liberou os microfones', {
          duration: 10000,
          description: 'Quer falar? Ligue seu microfone.',
          action: { label: 'Ligar microfone', onClick: () => { room?.localParticipant?.setMicrophoneEnabled(true).catch(() => {}); } },
        });
      }
      return;
    }
    if (sig.type === 'screen_share_request') {
      setPendingScreenRequests((prev) =>
        prev.some((r) => r.requestId === sig.requestId)
          ? prev
          : [...prev, { requestId: sig.requestId, identity: sig.identity, name: sig.name, ts: sig.ts }]
      );
      toast(`🖥️ ${sig.name} quer compartilhar a tela`, {
        duration: 15000,
        description: 'Veja no canto superior direito pra aprovar ou recusar.',
      });
      return;
    }
    if (sig.type === 'screen_share_response') {
      if (sig.targetIdentity !== localParticipant?.identity) return;
      const cb = screenResponseCallbacks.current.get(sig.requestId);
      if (cb) {
        cb(sig.approved);
        screenResponseCallbacks.current.delete(sig.requestId);
      }
      return;
    }
    if (sig.type === 'raise_hand') {
      setRaisedHands((prev) => {
        const next = { ...prev };
        if (sig.raised) next[sig.identity] = { identity: sig.identity, name: sig.name, ts: sig.ts };
        else delete next[sig.identity];
        return next;
      });
      if (sig.raised) {
        toast(`✋ ${sig.name} levantou a mão`, { duration: 8000 });
      }
      return;
    }
    if (sig.type === 'reaction') {
      const id = `${sig.identity}-${sig.ts}-${Math.random().toString(36).slice(2, 6)}`;
      setBursts((prev) => [...prev, { id, emoji: sig.emoji, fromName: sig.name, ts: sig.ts }]);
      setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 3800);
    }
  }, [room, localParticipant]);

  // ── Transporte 1: LiveKit DataChannel (primario) ──
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, _p?: any, _k?: any, topic?: string) => {
      if (topic && topic !== LK_TOPIC) return;
      try {
        const sig = JSON.parse(new TextDecoder().decode(payload)) as MeetSignal;
        processSignal(sig);
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, processSignal]);

  // ── Transporte 2: Supabase Realtime broadcast (fallback) ──
  useEffect(() => {
    if (!roomName) return;
    const channel = supabase.channel(`meet:signals:${roomName}`, {
      config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'signal' }, (msg) => {
      processSignal(msg.payload as MeetSignal);
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      try { supabase.removeChannel(channel); } catch {}
      channelRef.current = null;
    };
  }, [roomName, processSignal]);

  // Auto-abaixa a mao quando quem levantou comeca a falar.
  useEffect(() => {
    if (!room) return;
    const onActiveSpeakers = (speakers: any[]) => {
      const speakingNow = new Set(speakers.map((s) => s.identity));
      setRaisedHands((prev) => {
        let changed = false;
        const next: Record<string, RaisedHand> = {};
        for (const [identity, info] of Object.entries(prev)) {
          if (speakingNow.has(identity) && Date.now() - info.ts > 1000) {
            changed = true;
            if (identity === localParticipant?.identity) {
              setMyHandRaised(false);
              publishRef.current?.({ type: 'raise_hand', raised: false, identity, name: info.name, ts: Date.now() });
            }
          } else {
            next[identity] = info;
          }
        }
        return changed ? next : prev;
      });
    };
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
    return () => { room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers); };
  }, [room, localParticipant]);

  // Publica nos DOIS transportes.
  const publish = useCallback(async (sig: MeetSignal) => {
    // LiveKit (primario)
    try {
      const lp = room?.localParticipant;
      if (lp) {
        await lp.publishData(new TextEncoder().encode(JSON.stringify(sig)), {
          reliable: true,
          topic: LK_TOPIC,
        } as any);
      }
    } catch (e) {
      console.warn('[meet-signals] livekit publish failed', e);
    }
    // Realtime (fallback)
    try {
      await channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: sig });
    } catch (e) {
      console.warn('[meet-signals] realtime publish failed', e);
    }
  }, [room]);

  // Ref pro publish ser acessivel no listener de ActiveSpeakers sem recriar effect.
  const publishRef = useRef(publish);
  publishRef.current = publish;

  const toggleHand = useCallback(() => {
    if (!localParticipant) return;
    const next = !myHandRaised;
    setMyHandRaised(next);
    const sig: MeetSignal = {
      type: 'raise_hand',
      raised: next,
      identity: localParticipant.identity,
      name: localParticipant.name || localParticipant.identity || 'Participante',
      ts: Date.now(),
    };
    setRaisedHands((prev) => {
      const n = { ...prev };
      if (next) n[sig.identity] = { identity: sig.identity, name: (sig as any).name, ts: sig.ts };
      else delete n[sig.identity];
      return n;
    });
    publish(sig);
  }, [localParticipant, myHandRaised, publish]);

  const requestScreenShare = useCallback((): Promise<boolean> => {
    if (!localParticipant) return Promise.resolve(false);
    const requestId = `${localParticipant.identity}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sig: MeetSignal = {
      type: 'screen_share_request',
      requestId,
      identity: localParticipant.identity,
      name: localParticipant.name || localParticipant.identity || 'Participante',
      ts: Date.now(),
    };
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        screenResponseCallbacks.current.delete(requestId);
        resolve(false);
      }, 30000);
      screenResponseCallbacks.current.set(requestId, (approved) => {
        clearTimeout(timeout);
        resolve(approved);
      });
      publish(sig);
    });
  }, [localParticipant, publish]);

  const respondScreenShare = useCallback((requestId: string, approved: boolean) => {
    const req = pendingScreenRequests.find((r) => r.requestId === requestId);
    if (!req) return;
    publish({ type: 'screen_share_response', requestId, targetIdentity: req.identity, approved, ts: Date.now() });
    setPendingScreenRequests((prev) => prev.filter((r) => r.requestId !== requestId));
  }, [pendingScreenRequests, publish]);

  const sendReaction = useCallback((emoji: string) => {
    if (!localParticipant) return;
    const sig: MeetSignal = {
      type: 'reaction',
      emoji,
      identity: localParticipant.identity,
      name: localParticipant.name || localParticipant.identity || 'Participante',
      ts: Date.now(),
    };
    // Mostra local imediatamente (LiveKit/Realtime nao ecoam pro proprio sender).
    const id = `${sig.identity}-${sig.ts}-self`;
    setBursts((prev) => [...prev, { id, emoji, fromName: (sig as any).name, ts: sig.ts }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 3800);
    publish(sig);
  }, [localParticipant, publish]);

  const muteAll = useCallback(() => {
    publish({ type: 'force_mute', ts: Date.now() });
  }, [publish]);

  // Silencia um participante especifico (o cliente alvo honra o sinal).
  const muteParticipant = useCallback((identity: string) => {
    publish({ type: 'force_mute', target: identity, ts: Date.now() });
  }, [publish]);

  // Convite geral pra ligar o mic (opt-in no lado de quem recebe).
  const unmuteAll = useCallback(() => {
    publish({ type: 'request_unmute', ts: Date.now() });
  }, [publish]);

  // Convida um participante especifico a falar (liga o mic dele automatico).
  const requestUnmute = useCallback((identity: string) => {
    publish({ type: 'request_unmute', target: identity, ts: Date.now() });
  }, [publish]);

  const startSession = useCallback(() => {
    publish({ type: 'session_start', ts: Date.now() });
  }, [publish]);

  const raisedHandsQueue = Object.values(raisedHands).sort((a, b) => a.ts - b.ts);
  const raisedHandPosition: Record<string, number> = {};
  raisedHandsQueue.forEach((h, i) => { raisedHandPosition[h.identity] = i + 1; });

  return {
    raisedHands,
    raisedHandsQueue,
    raisedHandPosition,
    raisedCount: raisedHandsQueue.length,
    myHandRaised,
    toggleHand,
    bursts,
    sendReaction,
    muteAll,
    muteParticipant,
    unmuteAll,
    requestUnmute,
    startSession,
    pendingScreenRequests,
    requestScreenShare,
    respondScreenShare,
  };
}
