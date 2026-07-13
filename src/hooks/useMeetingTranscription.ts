import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TranscriptionSegment } from './useCallTranscription';

const SAMPLE_RATE = 16000;
const WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const MAX_RECONNECT_ATTEMPTS = 10;

interface AudioChannelRefs {
  ws: WebSocket | null;
  stream: MediaStream | null;
  audioContext: AudioContext | null;
  processor: ScriptProcessorNode | null;
  reconnectAttempts: number;
  speakerLabel: string;
  speakerType: 'local' | 'remote';
}

function float32ToInt16(audioData: Float32Array): ArrayBuffer {
  const pcmData = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcmData.buffer;
}

export function useMeetingTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isTranscribingRef = useRef(false);
  const transcriptionsRef = useRef<TranscriptionSegment[]>([]);
  const micRef = useRef<AudioChannelRefs>({ ws: null, stream: null, audioContext: null, processor: null, reconnectAttempts: 0, speakerLabel: 'Você', speakerType: 'local' });
  const screenRef = useRef<AudioChannelRefs>({ ws: null, stream: null, audioContext: null, processor: null, reconnectAttempts: 0, speakerLabel: 'Participantes', speakerType: 'remote' });
  const screenVideoStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const apiKeyRef = useRef<string | null>(null);

  const getApiKey = useCallback(async (): Promise<string> => {
    if (apiKeyRef.current) return apiKeyRef.current;
    const { data, error } = await supabase.functions.invoke('get-soniox-token');
    if (error || !data?.api_key) throw new Error('Falha ao obter chave Soniox');
    apiKeyRef.current = data.api_key;
    return data.api_key;
  }, []);

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

  const connectWebSocket = useCallback((
    stream: MediaStream,
    refs: React.MutableRefObject<AudioChannelRefs>,
    apiKey: string,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      let tokenBuffer: string[] = [];
      const { speakerLabel, speakerType } = refs.current;
      const ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';
      refs.current.ws = ws;

      ws.onopen = () => {
        console.log(`[Meeting-Soniox] ${speakerType} WS connected`);
        refs.current.reconnectAttempts = 0;
        setIsReconnecting(false);

        ws.send(JSON.stringify({
          api_key: apiKey,
          model: 'stt-rt-preview',
          language_code: 'pt',
          sample_rate: SAMPLE_RATE,
          audio_format: 'pcm_s16le',
          num_channels: 1,
          include_nonfinal: true,
        }));

        // Reuse existing AudioContext if still open, otherwise create new
        try {
          if (!refs.current.audioContext || refs.current.audioContext.state === 'closed') {
            const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
              if (refs.current.ws?.readyState === WebSocket.OPEN) {
                refs.current.ws.send(float32ToInt16(e.inputBuffer.getChannelData(0)));
              }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            refs.current.audioContext = audioContext;
            refs.current.processor = processor;
          } else {
            // AudioContext still alive, just wire onaudioprocess to new WS
            if (refs.current.processor) {
              refs.current.processor.onaudioprocess = (e) => {
                if (refs.current.ws?.readyState === WebSocket.OPEN) {
                  refs.current.ws.send(float32ToInt16(e.inputBuffer.getChannelData(0)));
                }
              };
            }
          }
          refs.current.stream = stream;
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.error_code) {
            console.error('[Meeting-Soniox] Error:', data.error_message);
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
          // config confirmation
        }
      };

      ws.onerror = () => {
        if (!isTranscribingRef.current) {
          reject(new Error(`WebSocket ${speakerType} error`));
        }
      };

      ws.onclose = (e) => {
        console.log(`[Meeting-Soniox] ${speakerType} WS closed: code=${e.code}`);
        
        // Auto-reconnect if still transcribing
        if (isTranscribingRef.current && refs.current.stream) {
          const attempts = refs.current.reconnectAttempts;
          if (attempts < MAX_RECONNECT_ATTEMPTS) {
            refs.current.reconnectAttempts = attempts + 1;
            const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000);
            console.log(`[Meeting-Soniox] Reconnecting ${speakerType} (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);
            setIsReconnecting(true);

            setTimeout(async () => {
              if (!isTranscribingRef.current) return;
              try {
                const key = await getApiKey();
                await connectWebSocket(refs.current.stream!, refs, key);
                console.log(`[Meeting-Soniox] ${speakerType} reconnected ✅`);
              } catch (err) {
                console.error(`[Meeting-Soniox] ${speakerType} reconnect failed:`, err);
              }
            }, delay);
          } else {
            console.error(`[Meeting-Soniox] ${speakerType} max reconnect attempts reached`);
            setIsReconnecting(false);
            setError(`Conexão perdida (${speakerType}). Máximo de tentativas atingido.`);
          }
        }
      };
    });
  }, [addTranscription, getApiKey]);

  const cleanupChannel = useCallback((refs: React.MutableRefObject<AudioChannelRefs>, stopStream = true) => {
    refs.current.ws?.close();
    refs.current.ws = null;
    refs.current.processor?.disconnect();
    refs.current.processor = null;
    refs.current.audioContext?.close().catch(() => {});
    refs.current.audioContext = null;
    if (stopStream) {
      refs.current.stream?.getTracks().forEach(t => t.stop());
    }
    refs.current.stream = null;
    refs.current.reconnectAttempts = 0;
  }, []);

  const startMeetingTranscription = useCallback(async () => {
    setError(null);
    setTranscriptions([]);
    transcriptionsRef.current = [];

    try {
      const apiKey = await getApiKey();

      // 1. Screen share with audio (remote participants)
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenVideoStreamRef.current = screenStream;

      // Check if audio track exists
      const audioTracks = screenStream.getAudioTracks();
      if (audioTracks.length === 0) {
        screenStream.getTracks().forEach(t => t.stop());
        throw new Error('Nenhum áudio capturado. Marque "Compartilhar áudio" ao selecionar a aba.');
      }

      // Create audio-only stream for Soniox
      const screenAudioStream = new MediaStream(audioTracks);
      screenRef.current.speakerLabel = 'Participantes';
      screenRef.current.speakerType = 'remote';
      await connectWebSocket(screenAudioStream, screenRef, apiKey);
      console.log('[Meeting-Soniox] Screen audio channel started ✅');

      // 2. Microphone (local)
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micRef.current.speakerLabel = 'Você';
      micRef.current.speakerType = 'local';
      await connectWebSocket(micStream, micRef, apiKey);
      console.log('[Meeting-Soniox] Mic channel started ✅');

      startTimeRef.current = Date.now();
      isTranscribingRef.current = true;
      setIsTranscribing(true);
    } catch (err: any) {
      console.error('[Meeting-Soniox] Start error:', err);
      setError(err.message || 'Erro ao iniciar transcrição');
      stopMeetingTranscription();
    }
  }, [getApiKey, connectWebSocket, cleanupChannel]);

  const stopMeetingTranscription = useCallback(() => {
    // Set ref BEFORE closing to prevent reconnect attempts
    isTranscribingRef.current = false;
    setIsReconnecting(false);
    cleanupChannel(micRef, true);
    cleanupChannel(screenRef, true);
    screenVideoStreamRef.current?.getTracks().forEach(t => t.stop());
    screenVideoStreamRef.current = null;
    setIsTranscribing(false);
  }, [cleanupChannel]);

  const getDurationSeconds = useCallback(() => {
    if (!startTimeRef.current) return 0;
    return Math.round((Date.now() - startTimeRef.current) / 1000);
  }, []);

  const getFinalTranscriptions = useCallback((): TranscriptionSegment[] => {
    return transcriptionsRef.current.filter(t => t.is_final);
  }, []);

  const saveMeetingTranscriptions = useCallback(async (meetingId: string) => {
    const finals = getFinalTranscriptions();
    const duration = getDurationSeconds();

    await supabase
      .from('meetings' as any)
      .update({
        transcriptions: finals as any,
        transcription: finals.map(t => `${t.speaker}: ${t.text}`).join('\n'),
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
      })
      .eq('id', meetingId);

    console.log(`[Meeting-Soniox] Saved ${finals.length} segments to meeting ${meetingId}`);
    return { finals, duration };
  }, [getFinalTranscriptions, getDurationSeconds]);

  useEffect(() => {
    return () => {
      isTranscribingRef.current = false;
      cleanupChannel(micRef, true);
      cleanupChannel(screenRef, true);
      screenVideoStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [cleanupChannel]);

  return {
    isTranscribing,
    isReconnecting,
    transcriptions,
    transcriptionsRef,
    error,
    startMeetingTranscription,
    stopMeetingTranscription,
    getFinalTranscriptions,
    saveMeetingTranscriptions,
    getDurationSeconds,
  };
}
