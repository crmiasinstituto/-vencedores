import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Lock } from 'lucide-react';

const db = supabase as any;

interface Req {
  id: string;
  meeting_id: string;
  member_id: string;
  status: string;
  created_at: string;
  members?: { name: string; program: string } | null;
  meetings?: { title: string; members_scheduled_at: string } | null;
}

// Pedidos de acesso pendentes a reunioes com gate por programa (ex: MentorIA na
// reuniao de quarta que e' do Metodo + que Vencedores). O host aprova/nega aqui e o banner
// do membro libera a entrada no proximo poll.
export default function MeetingAccessRequests() {
  const [reqs, setReqs] = useState<Req[]>([]);

  const load = useCallback(async () => {
    const { data } = await db
      .from('meeting_access_requests')
      .select('id, meeting_id, member_id, status, created_at, members(name, program), meetings(title, members_scheduled_at)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setReqs((data || []) as Req[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('meeting-access-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_access_requests' }, load)
      .subscribe();
    const iv = setInterval(load, 45_000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [load]);

  const decide = async (r: Req, status: 'approved' | 'denied') => {
    const { error } = await db
      .from('meeting_access_requests')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(status === 'approved' ? `${r.members?.name || 'Membro'} liberado` : 'Pedido negado');
    setReqs((prev) => prev.filter((x) => x.id !== r.id));
  };

  if (reqs.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#3B82F6]/40 bg-[#3B82F6]/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-4 h-4 text-[#3B82F6]" />
        <h3 className="text-sm font-bold text-foreground">Pedidos de acesso a reuniao ({reqs.length})</h3>
      </div>
      <div className="space-y-2">
        {reqs.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg bg-card border border-border px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {r.members?.name || 'Membro'} <span className="text-xs text-muted-foreground">({r.members?.program || '?'})</span>
              </p>
              <p className="text-xs text-muted-foreground truncate">{r.meetings?.title || 'Reuniao'}</p>
            </div>
            <button onClick={() => decide(r, 'approved')} className="flex items-center gap-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 px-2.5 py-1.5 text-xs font-semibold hover:bg-green-500/25">
              <Check className="w-3.5 h-3.5" /> Liberar
            </button>
            <button onClick={() => decide(r, 'denied')} className="flex items-center gap-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-1.5 text-xs font-semibold hover:bg-red-500/20">
              <X className="w-3.5 h-3.5" /> Negar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
