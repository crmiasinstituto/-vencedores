import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Clock, Video, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const db = supabase as any;

interface LiveMeeting {
  id: string;
  title: string;
  livekit_room_name: string;
  members_scheduled_at: string;
  members_duration_minutes: number;
  host_name: string | null;
  status: string;
  allowed_programs: string[] | null;
  gated_programs: string[] | null;
}

// Regra de acesso do membro a uma reuniao, dado o programa dele:
//   'open'     -> entra direto (allowed_programs null ou inclui o programa)
//   'approved' -> era gated mas o host ja aprovou
//   'pending'  -> pediu acesso, aguardando o host
//   'request'  -> gated pro programa dele, ainda nao pediu
//   'blocked'  -> nao e' pra esse programa (nem mostra)
type Access = 'open' | 'approved' | 'pending' | 'request' | 'blocked';

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!target) return null;
  const diff = target.getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

export default function LiveMeetingBanner() {
  const [meeting, setMeeting] = useState<LiveMeeting | null>(null);
  const [access, setAccess] = useState<Access>('open');
  const [requesting, setRequesting] = useState(false);
  const navigate = useNavigate();

  const memberId = (() => {
    try { return JSON.parse(localStorage.getItem('squaad_member_session') || '{}').member_id || null; } catch { return null; }
  })();

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60_000);
      // programa do membro (pra gate por programa)
      let program: string | null = null;
      if (memberId) {
        const { data: m } = await db.from('members').select('program').eq('id', memberId).maybeSingle();
        program = m?.program || null;
      }
      const { data } = await db
        .from('meetings')
        .select('id, title, livekit_room_name, members_scheduled_at, members_duration_minutes, host_name, status, allowed_programs, gated_programs')
        .eq('members_visible', true)
        .neq('status', 'completed')
        .gte('members_scheduled_at', new Date(now.getTime() - 6 * 60 * 60_000).toISOString())
        .lte('members_scheduled_at', horizon.toISOString())
        .order('members_scheduled_at', { ascending: true })
        .limit(8);

      // pega a proxima reuniao que FAZ SENTIDO pro programa do membro
      const list = (data || []) as LiveMeeting[];
      for (const mt of list) {
        const allowed = mt.allowed_programs;
        const gated = mt.gated_programs || [];
        const isOpen = !allowed || (program != null && allowed.includes(program));
        const isGated = program != null && gated.includes(program);
        if (!isOpen && !isGated) continue; // nao e' pra esse programa

        let acc: Access = 'open';
        if (!isOpen && isGated) {
          acc = 'request';
          if (memberId) {
            const { data: req } = await db
              .from('meeting_access_requests')
              .select('status')
              .eq('meeting_id', mt.id)
              .eq('member_id', memberId)
              .maybeSingle();
            if (req?.status === 'approved') acc = 'approved';
            else if (req?.status === 'pending') acc = 'pending';
          }
        }
        setMeeting(mt);
        setAccess(acc);
        return;
      }
      setMeeting(null);
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [memberId]);

  const start = meeting ? new Date(meeting.members_scheduled_at) : null;
  const end = meeting && start ? new Date(start.getTime() + (meeting.members_duration_minutes || 60) * 60_000) : null;
  const nowMs = Date.now();
  const live = start && end && nowMs >= start.getTime() - 5 * 60_000 && nowMs <= end.getTime();
  const countdown = useCountdown(live ? null : start);
  const ended = end && nowMs > end.getTime();

  const requestAccess = async () => {
    if (!meeting || !memberId) return;
    setRequesting(true);
    const { error } = await db
      .from('meeting_access_requests')
      .upsert({ meeting_id: meeting.id, member_id: memberId, status: 'pending' }, { onConflict: 'meeting_id,member_id' });
    setRequesting(false);
    if (error) { toast.error('Nao foi possivel pedir acesso: ' + error.message); return; }
    setAccess('pending');
    toast.success('Pedido enviado. O host vai liberar seu acesso.');
  };

  if (!meeting || ended) return null;

  const canEnter = live && (access === 'open' || access === 'approved');

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <div className={`relative overflow-hidden rounded-2xl border ${live ? 'border-red-500/40 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent' : 'border-[#3B82F6]/40 bg-gradient-to-r from-[#3B82F6]/10 via-[#3B82F6]/5 to-transparent'} p-5 md:p-6`}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-30" style={{ background: live ? '#ef4444' : '#3B82F6' }} />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${live ? 'bg-red-500/20 animate-pulse' : 'bg-[#3B82F6]/20'}`}>
              {live ? <Radio className="w-6 h-6 text-red-400" /> : <Video className="w-6 h-6 text-[#3B82F6]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {live ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> AO VIVO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] text-[10px] font-bold rounded uppercase">
                    <Clock className="w-3 h-3" /> Em breve
                  </span>
                )}
                <h3 className="text-white font-semibold text-base md:text-lg truncate">{meeting.title}</h3>
              </div>
              <p className="text-sm text-white/60">
                {access === 'request' || access === 'pending'
                  ? (access === 'pending' ? 'Voce pediu acesso, aguardando o host liberar.' : 'Esta reuniao e do Metodo + que Vencedores. Peca acesso pra participar.')
                  : live
                    ? `Com ${meeting.host_name || '+ que Vencedores'} - a sala esta aberta agora`
                    : `Com ${meeting.host_name || '+ que Vencedores'} - comeca em ${countdown || 'breve'} (${start?.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})`}
              </p>
            </div>
            {access === 'request' ? (
              <Button onClick={requestAccess} disabled={requesting} className="bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-black font-bold px-6">
                <Lock className="w-4 h-4 mr-1.5" /> {requesting ? 'Enviando...' : 'Pedir acesso'}
              </Button>
            ) : access === 'pending' ? (
              <Button disabled className="bg-white/10 text-white/60 font-bold px-6">Aguardando liberacao</Button>
            ) : (
              <Button
                onClick={() => navigate(`/membros/meet/${meeting.livekit_room_name}`)}
                disabled={!canEnter}
                className={live ? 'bg-red-500 hover:bg-red-600 text-white font-bold px-6 disabled:opacity-50' : 'bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-black font-bold px-6 disabled:opacity-50'}
              >
                {canEnter ? 'Entrar ao vivo' : 'Aguardando horario'}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
