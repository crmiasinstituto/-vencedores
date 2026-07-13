import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import squaadLogo from '@/assets/squaad-business-solutions.jpg';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Radio, Clock, Video, CheckCircle2 } from 'lucide-react';

const db = supabase as any;

interface LiveMeeting {
  id: string;
  title: string;
  livekit_room_name: string;
  host_name: string | null;
  members_scheduled_at: string;
  members_duration_minutes: number;
  status: string;
  members_visible: boolean;
  target_lesson_id: string | null;
}

export default function MembrosMeet() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<LiveMeeting | null>(null);
  // Sessao que esta AO VIVO agora (pode ser outra que nao a do link, ex: link antigo).
  const [liveNow, setLiveNow] = useState<LiveMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberName, setMemberName] = useState('');
  const [now, setNow] = useState(Date.now());
  const [accessBlocked, setAccessBlocked] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) {
      navigate('/membros/login');
      return;
    }
    try {
      const session = JSON.parse(raw);
      setMemberName(session.member_name || 'Membro');
    } catch {
      navigate('/membros/login');
      return;
    }

    const cols = 'id, title, livekit_room_name, host_name, members_scheduled_at, members_duration_minutes, status, members_visible, target_lesson_id, allowed_programs, gated_programs';
    const load = async () => {
      if (!roomId) return;
      const { data } = await db
        .from('meetings')
        .select(cols)
        .eq('livekit_room_name', roomId)
        .maybeSingle();
      setMeeting(data as LiveMeeting);

      // Gate por programa: se a reuniao e' gated pro programa do membro e ele
      // nao foi aprovado, bloqueia a entrada (a liberacao vem pelo painel do host).
      if (data && (data.allowed_programs || data.gated_programs)) {
        try {
          const session = JSON.parse(localStorage.getItem('squaad_member_session') || '{}');
          const mid = session.member_id;
          const { data: mem } = await db.from('members').select('program').eq('id', mid).maybeSingle();
          const program = mem?.program || null;
          const allowed = data.allowed_programs as string[] | null;
          const gated = (data.gated_programs as string[] | null) || [];
          const isOpen = !allowed || (program != null && allowed.includes(program));
          if (!isOpen) {
            const isGated = program != null && gated.includes(program);
            let ok = false;
            if (isGated && mid) {
              const { data: req } = await db.from('meeting_access_requests').select('status')
                .eq('meeting_id', data.id).eq('member_id', mid).maybeSingle();
              ok = req?.status === 'approved';
            }
            setAccessBlocked(!ok);
          } else {
            setAccessBlocked(false);
          }
        } catch { /* em duvida, nao bloqueia */ }
      }

      // Procura QUALQUER aula ao vivo agora (status != completed, visivel, dentro
      // da janela com folga). Resgata membro que abriu link antigo/errado.
      const nowMs = Date.now();
      const { data: candidates } = await db
        .from('meetings')
        .select(cols)
        .neq('status', 'completed')
        .eq('members_visible', true)
        .order('members_scheduled_at', { ascending: false })
        .limit(20);
      const liveOne = (candidates || []).find((m: any) => {
        if (!m.members_scheduled_at) return false;
        const s = new Date(m.members_scheduled_at).getTime();
        const e = s + ((m.members_duration_minutes || 60) * 60_000) + 3 * 3_600_000; // +3h de folga
        return nowMs >= s - 5 * 60_000 && nowMs <= e;
      });
      setLiveNow((liveOne as LiveMeeting) || null);
      setLoading(false);
    };
    load();

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [roomId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  if (meeting && accessBlocked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/5 border-white/10">
          <CardContent className="p-8 text-center space-y-4">
            <img src={squaadLogo} alt="+ que Vencedores" className="w-48 mx-auto" />
            <h2 className="text-xl font-bold text-white">Acesso sob autorizacao</h2>
            <p className="text-sm text-white/60">Esta reuniao e do Metodo + que Vencedores. Peca acesso no seu painel de membros que o host libera sua entrada.</p>
            <Button onClick={() => navigate('/membros')} className="w-full py-5 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-black font-bold">Voltar pro painel</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!meeting || !meeting.members_visible) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/5 border-white/10">
          <CardContent className="p-8 text-center space-y-4">
            <img src={squaadLogo} alt="+ que Vencedores" className="w-48 mx-auto" />
            <h2 className="text-xl font-bold text-white">Reuniao nao encontrada</h2>
            <p className="text-sm text-white/60">Este link pode ter expirado ou nao e mais valido.</p>
            {liveNow && (
              <Button
                onClick={() => navigate(`/membros/meet/${liveNow.livekit_room_name}`)}
                className="w-full py-5 bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                <Radio className="w-4 h-4 mr-2" />
                Tem aula AO VIVO agora, entrar
              </Button>
            )}
            <Button onClick={() => navigate('/membros')} className="bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-black">Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const start = new Date(meeting.members_scheduled_at);
  // "Encerrada" e dirigida pelo STATUS REAL (host encerrou), nao pelo relogio.
  // Assim uma aula que passa do horario agendado NAO barra os membros enquanto
  // ela ainda esta ao vivo.
  const ended = meeting.status === 'completed';
  const early = !ended && now < start.getTime() - 5 * 60_000; // abre 5 min antes
  const live = !ended && !early;

  // Botao de resgate: se ha uma aula ao vivo agora (e nao e a deste link), oferece.
  const rescueLive = liveNow && liveNow.livekit_room_name !== meeting.livekit_room_name ? liveNow : null;

  if (ended) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/5 border-white/10">
          <CardContent className="p-8 text-center space-y-4">
            <img src={squaadLogo} alt="+ que Vencedores" className="w-48 mx-auto" />
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Reuniao encerrada</h2>
            <p className="text-sm text-white/60">
              A gravacao esta sendo processada. Quando estiver pronta, ela aparece
              no modulo da area de membros.
            </p>
            {rescueLive && (
              <Button
                onClick={() => navigate(`/membros/meet/${rescueLive.livekit_room_name}`)}
                className="w-full py-5 bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                <Radio className="w-4 h-4 mr-2" />
                Tem aula AO VIVO agora, entrar
              </Button>
            )}
            {meeting.target_lesson_id && (
              <Button
                onClick={() => navigate(`/membros/aula/${meeting.target_lesson_id}`)}
                className="bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-black"
              >
                Ver gravacao
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/membros/trilhas')} className="w-full">
              Voltar as trilhas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (early) {
    const diff = start.getTime() - now;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1000);
    const countdown = h > 0 ? `${h}h ${m}min` : m > 0 ? `${m}min ${s}s` : `${s}s`;

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(250,200,0,0.08)_0%,_transparent_70%)]" />
        <Card className="max-w-md w-full bg-white/5 border-white/10 relative z-10">
          <CardContent className="p-8 text-center space-y-5">
            <img src={squaadLogo} alt="+ que Vencedores" className="w-48 mx-auto" />
            <div className="w-20 h-20 bg-[#3B82F6]/10 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-[#3B82F6]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{meeting.title}</h2>
              <p className="text-sm text-white/60 mt-1">com {meeting.host_name || '+ que Vencedores'}</p>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Comeca em</p>
              <p className="text-3xl font-bold text-[#3B82F6]">{countdown}</p>
              <p className="text-xs text-white/40 mt-1">
                {start.toLocaleString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <p className="text-xs text-white/40">
              A sala abre 5 minutos antes do horario marcado. Volte aqui no horario.
            </p>
            <Button variant="outline" onClick={() => navigate('/membros')} className="w-full">
              Voltar ao painel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Live: redirect to MeetRoom with pre-filled member name
  const meetUrl = `/meet/${meeting.livekit_room_name}?mode=live-session&role=guest&name=${encodeURIComponent(memberName)}`;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(239,68,68,0.12)_0%,_transparent_70%)]" />
      <Card className="max-w-md w-full bg-white/5 border-red-500/30 relative z-10">
        <CardContent className="p-8 text-center space-y-5">
          <img src={squaadLogo} alt="+ que Vencedores" className="w-48 mx-auto" />
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Ao vivo agora</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{meeting.title}</h2>
            <p className="text-sm text-white/60 mt-1">com {meeting.host_name || '+ que Vencedores'}</p>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Video className="w-4 h-4 text-[#3B82F6]" />
              Entrando como <strong className="text-white">{memberName}</strong>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Radio className="w-4 h-4 text-red-400" />
              Esta sala sera gravada e publicada como aula
            </div>
          </div>
          <Button
            onClick={() => navigate(meetUrl)}
            className="w-full py-6 bg-red-500 hover:bg-red-600 text-white font-bold text-base"
          >
            <Video className="w-5 h-5 mr-2" />
            Entrar na sala ao vivo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
