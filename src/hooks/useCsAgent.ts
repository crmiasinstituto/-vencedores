// useCsAgent — o "Carlos CS" que responde no chat ao vivo se passando por ele.
// Roda SO no host. Observa mensagens novas dos participantes, chama a edge
// meet-cs-agent (Claude), e posta a resposta no chat como o host, com ritmo
// natural e limites pra ser cirurgico (nao spammar).
import { useEffect, useRef } from 'react';
import { useChat, useLocalParticipant } from '@livekit/components-react';
import { supabase } from '@/integrations/supabase/client';

const MEDIA_MARKER = '__SQUAAD_MEDIA__:';
const CAROL_MARKER = '__CAROL_CS__:'; // posta como "Carol CS - + que Vencedores" no chat
const PER_SENDER_COOLDOWN_MS = 18_000; // 1 resposta por pessoa a cada 18s (mais presente)
const GLOBAL_GAP_MS = 4_000; // intervalo minimo entre falas do agente

export function useCsAgent({
  enabled,
  roomName,
  meetingId,
  intent,
}: {
  enabled: boolean;
  roomName: string;
  meetingId: string | null;
  intent?: string;
}) {
  const { chatMessages, send } = useChat();
  const { localParticipant } = useLocalParticipant();

  const processedRef = useRef<Set<string>>(new Set());
  const lastBySenderRef = useRef<Record<string, number>>({});
  const lastGlobalRef = useRef<number>(0);
  const busyRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const intentRef = useRef(intent);
  intentRef.current = intent;

  // Ao LIGAR, marca tudo que ja existe como processado: o agente so responde
  // mensagens NOVAS dali pra frente, nunca o historico.
  useEffect(() => {
    if (!enabled) return;
    for (const m of chatMessages) {
      processedRef.current.add((m as any).id || `${(m as any).timestamp}-${(m as any).from?.identity}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || busyRef.current) return;
    const myId = localParticipant?.identity;

    // Pega a mensagem mais recente ainda nao processada (varre so as ultimas).
    let target: any = null;
    for (let i = chatMessages.length - 1; i >= 0 && i >= chatMessages.length - 6; i--) {
      const m: any = chatMessages[i];
      const id = m.id || `${m.timestamp}-${m.from?.identity}`;
      if (processedRef.current.has(id)) continue;
      processedRef.current.add(id);
      const fromId = m.from?.identity;
      const text = (m.message || '').trim();
      // Ignora: minhas proprias mensagens (host/agente), midia e vazias.
      if (!fromId || fromId === myId) continue;
      if (!text || text.startsWith(MEDIA_MARKER)) continue;
      target = { fromId, name: m.from?.name || fromId, text };
      break;
    }
    if (!target) return;

    const now = Date.now();
    if (now - (lastBySenderRef.current[target.fromId] || 0) < PER_SENDER_COOLDOWN_MS) return;
    if (now - lastGlobalRef.current < GLOBAL_GAP_MS) return;

    busyRef.current = true;
    (async () => {
      try {
        const recent = chatMessages.slice(-8).map((x: any) => {
          const m = x.message || '';
          if (m.startsWith(CAROL_MARKER)) return { name: 'Carol', text: m.slice(CAROL_MARKER.length) };
          if (m.startsWith(MEDIA_MARKER)) return { name: x.from?.name || 'Participante', text: '[midia]' };
          return { name: x.from?.name || 'Participante', text: m };
        });
        const { data, error } = await supabase.functions.invoke('meet-cs-agent', {
          body: {
            message: target.text,
            senderName: target.name,
            recentMessages: recent,
            intent: intentRef.current || undefined,
            roomName,
            meetingId,
          },
        });
        if (!error && data?.reply && enabledRef.current) {
          // Ritmo humano: espera alguns segundos antes de "digitar".
          const delay = 2500 + Math.random() * 3500;
          await new Promise((r) => setTimeout(r, delay));
          if (enabledRef.current) {
            await send(CAROL_MARKER + data.reply);
            lastBySenderRef.current[target.fromId] = Date.now();
            lastGlobalRef.current = Date.now();
          }
        }
      } catch {
        /* silencioso: nunca quebra a reuniao */
      } finally {
        busyRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, enabled]);
}
