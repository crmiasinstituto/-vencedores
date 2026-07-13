// useMeetCaptions — legenda ao vivo transmitida pra TODOS na sala.
// A transcricao roda no cliente do HOST (Soniox); cada linha e' transmitida por
// um canal Supabase broadcast dedicado (`captions:<sala>`), entao alunos/leads
// tambem veem a legenda. Canal separado dos meet-signals de proposito: legenda e'
// alta-frequencia e nao pode interferir no dedup dos sinais (mao/reacao/etc).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CaptionLine {
  id: string;
  text: string;
  speaker: string;
  is_final: boolean;
  ts: number;
}

export function useMeetCaptions(roomName: string | undefined) {
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const chanRef = useRef<any>(null);

  useEffect(() => {
    if (!roomName) return;
    const ch = supabase.channel(`captions:${roomName}`, {
      config: { broadcast: { self: true } }, // host tambem renderiza a propria legenda
    });
    ch.on('broadcast', { event: 'caption' }, ({ payload }: any) => {
      if (!payload?.text) return;
      setCaptions((prev) => {
        // remove a parcial anterior do mesmo speaker (substitui pela nova)
        let next = prev.filter((c) => !(c.speaker === payload.speaker && !c.is_final));
        if (payload.is_final && next.some((c) => c.id === payload.id)) return next;
        next = [...next, payload as CaptionLine];
        return next.slice(-40);
      });
    });
    ch.on('broadcast', { event: 'caption_clear' }, () => setCaptions([]));
    ch.subscribe();
    chanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [roomName]);

  const broadcastCaption = useCallback((line: Omit<CaptionLine, 'ts'>) => {
    chanRef.current?.send({ type: 'broadcast', event: 'caption', payload: { ...line, ts: Date.now() } });
  }, []);

  const clearCaptions = useCallback(() => {
    setCaptions([]);
    chanRef.current?.send({ type: 'broadcast', event: 'caption_clear', payload: {} });
  }, []);

  return { captions, broadcastCaption, clearCaptions };
}
