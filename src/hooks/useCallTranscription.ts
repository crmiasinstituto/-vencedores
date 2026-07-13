import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ===================== TYPES =====================
export interface TranscriptionSegment {
  id: number;
  text: string;
  speaker: string;
  speakerType?: 'local' | 'remote';
  confidence: number;
  timestamp: number;
  is_final: boolean;
}

interface AudioChannelRefs {
  ws: WebSocket | null;
  stream: MediaStream | null;
  audioContext: AudioContext | null;
  processor: ScriptProcessorNode | null;
  // Quando true, o stream foi fornecido externamente (LiveKit) e nao deve
  // ser parado em cleanup — quem o criou cuida do ciclo de vida.
  externallyOwned?: boolean;
  // Estado de reconexao em caso de close inesperado
  reconnectAttempts?: number;
  reconnectTimer?: ReturnType<typeof setTimeout> | null;
  intentionalClose?: boolean;
}

const SAMPLE_RATE = 16000;
const WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';

// ===================== HELPERS =====================
function float32ToInt16(audioData: Float32Array): ArrayBuffer {
  const pcmData = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcmData.buffer;
}

// ===================== HOOK =====================
export function useCallTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const transcriptionsRef = useRef<TranscriptionSegment[]>([]);
  const micRef = useRef<AudioChannelRefs>({ ws: null, stream: null, audioContext: null, processor: null, reconnectAttempts: 0, reconnectTimer: null, intentionalClose: false });
  const remoteRef = useRef<AudioChannelRefs>({ ws: null, stream: null, audioContext: null, processor: null, reconnectAttempts: 0, reconnectTimer: null, intentionalClose: false });
  const remoteAnalyserCtxRef = useRef<AudioContext | null>(null);
  const apiKeyRef = useRef<string | null>(null);

  // Fetch Soniox API key from edge function
  const getApiKey = useCallback(async (): Promise<string> => {
    if (apiKeyRef.current) return apiKeyRef.current;
    const { data, error } = await supabase.functions.invoke('get-soniox-token');
    if (error || !data?.api_key) throw new Error('Falha ao obter chave Soniox');
    apiKeyRef.current = data.api_key;
    return data.api_key;
  }, []);

  // Add transcription with partial management
  const addTranscription = useCallback((segment: TranscriptionSegment) => {
    setTranscriptions(prev => {
      const withoutPartials = prev.filter(
        t => t.is_final || t.speaker !== segment.speaker
      );
      const updated = [...withoutPartials, segment];
      transcriptionsRef.current = updated;
      return updated;
    });
  }, []);

  // Setup a single audio channel (mic or remote)
  // - Aceita externallyOwned: stream nao sera parado no cleanup (LiveKit cuida).
  // - Reconecta WS automaticamente em close inesperado (Soniox costuma fechar
  //   por idle/timeout em sessoes longas — sem reconnect, transcricao para).
  const setupAudioChannel = useCallback((
    stream: MediaStream,
    refs: React.MutableRefObject<AudioChannelRefs>,
    speakerLabel: string,
    speakerType: 'local' | 'remote',
    apiKey: string,
    externallyOwned = false,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      let tokenBuffer: string[] = [];
      let resolved = false;
      refs.current.externallyOwned = externallyOwned;
      refs.current.intentionalClose = false;

      const openSocket = () => {
        const ws = new WebSocket(WS_URL);
        ws.binaryType = 'arraybuffer';
        refs.current.ws = ws;

        ws.onopen = () => {
          console.log(`[Soniox] ${speakerType} WS connected (attempt ${refs.current.reconnectAttempts || 0})`);
          ws.send(JSON.stringify({
            api_key: apiKey,
            model: 'stt-rt-preview',
            language_code: 'pt-BR',
            sample_rate: SAMPLE_RATE,
            audio_format: 'pcm_s16le',
            num_channels: 1,
            include_nonfinal: true,
            context: 'Conversa de vendas em portugues brasileiro sobre inteligencia artificial, CRM, automacao, mentoria e negocios. Termos em ingles podem aparecer como lead, CRM, follow-up, onboarding, pipeline, score, dashboard.',
          }));
          // Sucesso de conexao: zera o contador de reconexao
          refs.current.reconnectAttempts = 0;

          // Audio pipeline: cria apenas na primeira conexao. Em reconexoes
          // a pipeline existente continua mandando bytes pro socket novo via
          // o ws ref atualizado (processor.onaudioprocess olha refs.current.ws).
          if (!refs.current.audioContext) {
            try {
              const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
              const source = audioContext.createMediaStreamSource(stream);
              const processor = audioContext.createScriptProcessor(4096, 1, 1);

              processor.onaudioprocess = (e) => {
                const sock = refs.current.ws;
                if (sock && sock.readyState === WebSocket.OPEN) {
                  sock.send(float32ToInt16(e.inputBuffer.getChannelData(0)));
                }
              };

              source.connect(processor);
              processor.connect(audioContext.destination);

              refs.current.audioContext = audioContext;
              refs.current.processor = processor;
              refs.current.stream = stream;
            } catch (err) {
              if (!resolved) { resolved = true; reject(err); return; }
              console.error(`[Soniox] ${speakerType} audio pipeline error after reconnect:`, err);
              return;
            }
          }

          if (!resolved) { resolved = true; resolve(); }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string);
            if (data.error_code) {
              console.error(`[Soniox] ${speakerType} error:`, data.error_message);
              return;
            }
            if (!data.tokens?.length) return;

            const finalTokens: string[] = [];
            const nonFinalTokens: string[] = [];

            for (const token of data.tokens) {
              (token.is_final ? finalTokens : nonFinalTokens).push(token.text);
            }

            if (finalTokens.length > 0) {
              tokenBuffer.push(...finalTokens);
              const text = tokenBuffer.join('').trim();
              if (text) {
                addTranscription({
                  id: Date.now() + Math.random(),
                  text,
                  speaker: speakerLabel,
                  speakerType,
                  confidence: data.tokens[0]?.confidence || 0.9,
                  timestamp: Date.now(),
                  is_final: true,
                });
                tokenBuffer = [];
              }
            }

            if (nonFinalTokens.length > 0) {
              const preview = [...tokenBuffer, ...nonFinalTokens].join('').trim();
              if (preview) {
                addTranscription({
                  id: -1,
                  text: preview,
                  speaker: speakerLabel,
                  speakerType,
                  confidence: 0.9,
                  timestamp: Date.now(),
                  is_final: false,
                });
              }
            }
          } catch {
            // Non-JSON message (config confirmation)
          }
        };

        ws.onerror = () => {
          if (!resolved) { resolved = true; reject(new Error(`WebSocket ${speakerType} error`)); }
        };

        ws.onclose = (e) => {
          console.log(`[Soniox] ${speakerType} WS closed (code=${e.code}, intentional=${refs.current.intentionalClose})`);
          if (refs.current.intentionalClose) return;

          // Reconexao com backoff: 1s, 2s, 4s, 8s, 16s. Cap em 5 tentativas.
          const attempt = (refs.current.reconnectAttempts || 0) + 1;
          if (attempt > 5) {
            console.error(`[Soniox] ${speakerType} max reconnect attempts reached`);
            return;
          }
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
          console.log(`[Soniox] ${speakerType} reconnecting in ${delay}ms (attempt ${attempt}/5)`);
          refs.current.reconnectAttempts = attempt;
          refs.current.reconnectTimer = setTimeout(() => {
            if (!refs.current.intentionalClose) openSocket();
          }, delay);
        };
      };

      openSocket();
    });
  }, [addTranscription]);

  // Cleanup a channel
  const cleanupChannel = useCallback((refs: React.MutableRefObject<AudioChannelRefs>, stopStream = false) => {
    refs.current.intentionalClose = true;
    if (refs.current.reconnectTimer) {
      clearTimeout(refs.current.reconnectTimer);
      refs.current.reconnectTimer = null;
    }
    refs.current.ws?.close();
    refs.current.ws = null;
    refs.current.processor?.disconnect();
    refs.current.processor = null;
    refs.current.audioContext?.close().catch(() => {});
    refs.current.audioContext = null;
    // Nunca para o stream se ele veio de fora (LiveKit publica e cuida).
    if (stopStream && !refs.current.externallyOwned) {
      refs.current.stream?.getTracks().forEach(t => t.stop());
    }
    refs.current.stream = null;
    refs.current.reconnectAttempts = 0;
  }, []);

  // Start transcription for a call
  // - Se existingMicStream for passado (ex: track ja publicada pelo LiveKit),
  //   reutilizamos ele ao inves de abrir um SEGUNDO getUserMedia. Evita race
  //   no macOS onde dois getUserMedia no mesmo device fazem um deles ficar mudo.
  const startTranscription = useCallback(async (
    callObj: any,
    peerName?: string,
    existingMicStream?: MediaStream,
  ) => {
    setError(null);
    setTranscriptions([]);
    transcriptionsRef.current = [];

    try {
      const apiKey = await getApiKey();

      // 1. Mic stream (local audio) — preferir stream ja existente (LiveKit)
      toast.info('Iniciando transcrição em tempo real...');
      let micStream: MediaStream;
      let micExternal = false;
      if (existingMicStream && existingMicStream.getAudioTracks().length > 0) {
        micStream = existingMicStream;
        micExternal = true;
        console.log('[Soniox] Reusing existing mic stream (LiveKit-published)');
      } else {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: SAMPLE_RATE,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (micErr: any) {
          console.error('[Soniox] Mic permission denied:', micErr);
          toast.error('Permissão de microfone negada. Ative o microfone para transcrição.');
          throw micErr;
        }
      }

      await setupAudioChannel(micStream, micRef, 'Você', 'local', apiKey, micExternal);
      console.log('[Soniox] Mic channel started ✅');
      toast.success('Transcrição ativa — microfone capturando');

      // 2. Remote stream via SDK AnalyserNode
      if (callObj?.audio_analyser) {
        console.log('[Soniox] Awaiting callObj.audio_analyser...');
        try {
          const analyser: AnalyserNode = await callObj.audio_analyser;
          console.log('[Soniox] AnalyserNode obtained:', analyser);

          // Use the AnalyserNode's existing context if possible, otherwise create one
          const ctx = analyser.context as AudioContext;
          
          const destination = ctx.createMediaStreamDestination();
          analyser.connect(destination);
          
          const remoteStream = destination.stream;
          const tracks = remoteStream.getAudioTracks();
          console.log('[Soniox] Remote stream from AnalyserNode, tracks:', tracks.length);

          if (tracks.length > 0) {
            await setupAudioChannel(remoteStream, remoteRef, peerName || 'Cliente', 'remote', apiKey);
            console.log('[Soniox] Remote channel started via AnalyserNode ✅');
          } else {
            console.warn('[Soniox] AnalyserNode destination has no audio tracks');
          }
        } catch (analyserErr) {
          console.error('[Soniox] Failed to setup remote via AnalyserNode:', analyserErr);
        }
      } else {
        console.warn('[Soniox] callObj has no audio_analyser — mic-only transcription');
      }

      setIsTranscribing(true);
      console.log('[Soniox] Transcription started');
    } catch (err: any) {
      console.error('[Soniox] Start error:', err);
      const msg = err.message || 'Erro ao iniciar transcrição';
      setError(msg);
      toast.error('Transcrição falhou: ' + msg);
      stopTranscription();
    }
  }, [getApiKey, setupAudioChannel, cleanupChannel]);

  // Stop transcription
  const stopTranscription = useCallback(() => {
    cleanupChannel(micRef, true);
    cleanupChannel(remoteRef, false);
    remoteAnalyserCtxRef.current?.close().catch(() => {});
    remoteAnalyserCtxRef.current = null;
    setIsTranscribing(false);
  }, [cleanupChannel]);

  // No-ops kept for interface compatibility
  const prepareRemoteCapture = useCallback(() => {}, []);
  const resetRemoteCapture = useCallback(() => {}, []);

  // Anexa (ou re-anexa) um stream remoto pra transcricao em tempo real.
  // Caso de uso: lead conecta DEPOIS que a transcricao ja arrancou em
  // mic-only — sem isso, o Coach IA nunca ouve o lead.
  const attachRemoteStream = useCallback(async (stream: MediaStream, label: string) => {
    if (!apiKeyRef.current) {
      console.warn('[Soniox] attachRemoteStream called before transcription started');
      return;
    }
    if (!stream.getAudioTracks().length) {
      console.warn('[Soniox] attachRemoteStream: empty audio tracks');
      return;
    }
    // Se ja temos um remoto ativo com o MESMO stream, nao recria
    if (remoteRef.current.stream === stream && remoteRef.current.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    // Limpa qualquer remoto anterior
    cleanupChannel(remoteRef, false);
    try {
      await setupAudioChannel(stream, remoteRef, label, 'remote', apiKeyRef.current, true);
      console.log('[Soniox] Remote channel attached for', label);
    } catch (e) {
      console.error('[Soniox] attachRemoteStream failed', e);
    }
  }, [cleanupChannel, setupAudioChannel]);

  // Get final transcriptions for saving
  const getFinalTranscriptions = useCallback((): TranscriptionSegment[] => {
    return transcriptionsRef.current.filter(t => t.is_final);
  }, []);

  // Save transcriptions to call_history
  const saveTranscriptions = useCallback(async (callHistoryId: string) => {
    const finals = getFinalTranscriptions();
    if (finals.length === 0) return;

    await supabase
      .from('call_history')
      .update({
        transcriptions: finals as any,
        transcription: finals.map(t => `${t.speaker}: ${t.text}`).join('\n'),
      })
      .eq('id', callHistoryId);

    console.log(`[Soniox] Saved ${finals.length} segments to call ${callHistoryId}`);
  }, [getFinalTranscriptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChannel(micRef, true);
      cleanupChannel(remoteRef, false);
      remoteAnalyserCtxRef.current?.close().catch(() => {});
      remoteAnalyserCtxRef.current = null;
    };
  }, [cleanupChannel]);

  return {
    isTranscribing,
    transcriptions,
    transcriptionsRef,
    error,
    startTranscription,
    stopTranscription,
    prepareRemoteCapture,
    resetRemoteCapture,
    attachRemoteStream,
    getFinalTranscriptions,
    saveTranscriptions,
  };
}
