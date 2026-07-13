import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Circle } from 'lucide-react';

// Painel em tempo real de quem esta ONLINE agora na area de membros.
// Escuta o canal de presenca 'members-online' (o MembrosLayout faz .track()).
// O admin so' ASSINA (nao da track), entao nao aparece na propria lista.
// Dispara um toast quando um membro novo entra (pula a 1a sincronizacao pra
// nao estourar um monte de toasts ao abrir a tela).

interface OnlineMember {
  member_id: string;
  name?: string;
  avatar_url?: string | null;
  page?: string;
  online_at?: string;
}

export default function MembersOnlineWidget() {
  const [online, setOnline] = useState<OnlineMember[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const firstSyncRef = useRef(true);

  useEffect(() => {
    const channel = supabase.channel('members-online', {
      config: { presence: { key: 'admin-observer' } },
    });

    const readState = () => {
      const state = channel.presenceState() as Record<string, OnlineMember[]>;
      const list: OnlineMember[] = [];
      const ids = new Set<string>();
      Object.values(state).forEach((arr) =>
        (arr || []).forEach((p) => {
          if (p?.member_id && !ids.has(p.member_id)) {
            ids.add(p.member_id);
            list.push(p);
          }
        }),
      );
      if (!firstSyncRef.current) {
        ids.forEach((id) => {
          if (!seenRef.current.has(id)) {
            const m = list.find((x) => x.member_id === id);
            toast.success(`${m?.name || 'Membro'} está online`, { description: 'acessou a área de membros agora' });
          }
        });
      }
      seenRef.current = ids;
      firstSyncRef.current = false;
      setOnline(list);
    };

    channel
      .on('presence', { event: 'sync' }, readState)
      .on('presence', { event: 'join' }, readState)
      .on('presence', { event: 'leave' }, readState)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <Circle className={`w-2.5 h-2.5 ${online.length > 0 ? 'fill-green-500 text-green-500 animate-pulse' : 'fill-muted-foreground/40 text-muted-foreground/40'}`} />
        <span className="text-sm font-semibold text-foreground tabular-nums">{online.length}</span>
        <span className="text-xs text-muted-foreground">online agora</span>
      </div>
      {online.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
          {online.slice(0, 12).map((m) => (
            <span
              key={m.member_id}
              title={`${m.name || 'Membro'}${m.page ? ' - ' + m.page : ''}`}
              className="shrink-0 flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/30 pl-1 pr-2 py-0.5"
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-green-500/30 flex items-center justify-center text-[10px] font-bold text-green-300">
                  {(m.name || '?').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-[11px] text-foreground max-w-[90px] truncate">{(m.name || 'Membro').split(' ')[0]}</span>
            </span>
          ))}
          {online.length > 12 && <span className="text-xs text-muted-foreground shrink-0">+{online.length - 12}</span>}
        </div>
      )}
    </div>
  );
}
