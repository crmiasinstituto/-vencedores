// useMeetChatLog — persiste o chat da sala (reuniao/aula/masterclass) em
// meet_chat_messages. Roda SO no host (1 gravador, sessao autenticada), e
// captura TUDO que aparece no chat: leads, host e a Carol CS (is_agent=true).
// Assim as interacoes da Carol nao se perdem mais (o chat do LiveKit e efemero).
import { useEffect, useRef } from 'react';
import { useChat } from '@livekit/components-react';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const MEDIA_MARKER = '__SQUAAD_MEDIA__:';
const CAROL_MARKER = '__CAROL_CS__:';

export function useMeetChatLog({
  enabled,
  roomName,
  meetingId,
}: {
  enabled: boolean;
  roomName: string;
  meetingId: string | null;
}) {
  const { chatMessages } = useChat();
  const savedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !roomName) return;
    for (const m of chatMessages as any[]) {
      const lkId = m.id || `${m.timestamp}-${m.from?.identity || ''}`;
      if (savedRef.current.has(lkId)) continue;
      savedRef.current.add(lkId);

      const raw = (m.message || '').toString();
      if (!raw) continue;
      const isAgent = raw.startsWith(CAROL_MARKER);
      const content = isAgent
        ? raw.slice(CAROL_MARKER.length)
        : raw.startsWith(MEDIA_MARKER)
          ? '[mídia]'
          : raw;
      const senderName = isAgent ? 'Carol CS - + que Vencedores' : (m.from?.name || m.from?.identity || 'Participante');

      // upsert por lk_id pra nao duplicar (ex: host recarrega a sala)
      db.from('meet_chat_messages')
        .upsert(
          {
            room_name: roomName,
            meeting_id: meetingId || null,
            lk_id: lkId,
            sender_identity: m.from?.identity || null,
            sender_name: senderName,
            is_agent: isAgent,
            content,
          },
          { onConflict: 'lk_id', ignoreDuplicates: true },
        )
        .then(() => {}, () => {});
    }
  }, [chatMessages, enabled, roomName, meetingId]);
}
