import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  PlayCircle,
  User,
  LogOut,
  Menu,
  Trophy,
  ChevronRight,
  } from 'lucide-react';

const db = supabase as any;

interface MemberSession {
  member_id: string;
  session_token: string;
  member_name: string;
  member_email: string;
}

interface MemberData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak_current: number;
  session_token: string | null;
}

// AI FIRST, Dicionário e Prospecção saíram: eram o conteúdo da SQUAAD dentro do
// LMS — a biblioteca de aceleradores de IA, o glossário do curso e a ferramenta
// de caça a leads pra revender automações. O chassi de trilhas/aulas fica.
const NAV_ITEMS = [
  { label: 'Dashboard', path: '/membros', icon: LayoutDashboard },
  { label: 'Trilhas', path: '/membros/trilhas', icon: PlayCircle },
  { label: 'Perfil', path: '/membros/perfil', icon: User },
];

function xpForLevel(level: number) {
  return level * 200;
}

export function MembrosLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [member, setMember] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sessionStartRef = useRef(Date.now());

  useEffect(() => {
    validateSession();
    return () => {
      const seconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (seconds > 5) {
        const raw = localStorage.getItem('squaad_member_session');
        if (raw) {
          const session: MemberSession = JSON.parse(raw);
          // Coluna e' duration_minutes (minutos), nao segundos; e nao existe coluna
          // "page" (o insert antigo falhava por isso). Usa pages_visited.
          db.from('member_sessions').insert({
            member_id: session.member_id,
            duration_minutes: Math.max(1, Math.round(seconds / 60)),
            pages_visited: [location.pathname],
          });
        }
      }
    };
  }, []);

  // Presenca em tempo real + heartbeat de tempo de estudo.
  // - track() no canal 'members-online' => o admin ve quem esta online agora.
  // - member_tick a cada 60s (so' com a aba visivel) => acumula total_time_minutes
  //   e atualiza last_active_at, resolvendo o "0 min" da area admin.
  useEffect(() => {
    if (!member?.id) return;
    const channel = supabase.channel('members-online', {
      config: { presence: { key: member.id } },
    });
    const trackNow = () => channel.track({
      member_id: member.id,
      name: member.name,
      avatar_url: member.avatar_url,
      page: window.location.pathname,
      online_at: new Date().toISOString(),
    });
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') trackNow();
    });
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      db.rpc('member_tick', { p_minutes: 1 });
      trackNow();
    };
    const iv = setInterval(tick, 60000);
    return () => { clearInterval(iv); supabase.removeChannel(channel); };
  }, [member?.id]);

  const validateSession = async () => {
    const raw = localStorage.getItem('squaad_member_session');
    if (!raw) {
      navigate('/membros/login');
      return;
    }

    try {
      const session: MemberSession = JSON.parse(raw);
      const { data, error } = await db
        .from('members')
        .select('*')
        .eq('id', session.member_id)
        .maybeSingle();

      if (error) {
        await new Promise(r => setTimeout(r, 800));
        const retry = await db.from('members').select('*').eq('id', session.member_id).maybeSingle();
        if (retry.data && retry.data.status === 'active') {
          setMember(retry.data as MemberData);
          return;
        }
        localStorage.removeItem('squaad_member_session');
        navigate('/membros/login?msg=Erro de rede - tente novamente');
        return;
      }

      if (!data) {
        localStorage.removeItem('squaad_member_session');
        navigate('/membros/login?msg=Conta nao encontrada');
        return;
      }

      if (data.status !== 'active') {
        localStorage.removeItem('squaad_member_session');
        navigate(`/membros/login?msg=Acesso ${data.status === 'blocked' ? 'bloqueado por pendencia financeira' : 'aguardando aprovacao'}`);
        return;
      }

      // Gate de contrato: as aulas so liberam apos a assinatura eletronica.
      if (!location.pathname.startsWith('/membros/contrato')) {
        const { data: pend } = await db.from('member_contracts')
          .select('id')
          .eq('member_id', session.member_id)
          .eq('signature_required', true)
          .neq('signature_status', 'signed')
          .limit(1);
        if (pend && pend.length > 0) {
          navigate('/membros/contrato');
          return;
        }
      }

      db.from('members').update({ last_active_at: new Date().toISOString() }).eq('id', session.member_id);
      setMember(data as MemberData);
    } catch (e) {
      localStorage.removeItem('squaad_member_session');
      navigate('/membros/login?msg=Erro inesperado, tente novamente');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('squaad_member_session');
    navigate('/membros/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Trophy className="w-10 h-10 text-[#3B82F6]" />
        </motion.div>
      </div>
    );
  }

  if (!member) return null;

  const xpNext = xpForLevel(member.level + 1);
  const xpCurrent = member.xp;
  const xpPrev = xpForLevel(member.level);
  const xpProgress = Math.min(100, ((xpCurrent - xpPrev) / (xpNext - xpPrev)) * 100);

  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/5">
        <Link to="/membros" onClick={onNavClick} className="block group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/20 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <img
              src="/mais-que-vencedores-logo.svg"
              alt="+ que Vencedores"
              className="relative h-10 w-auto object-contain drop-shadow-[0_2px_12px_rgba(250,200,0,0.25)]"
            />
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-3">
          Navegação
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/membros'
              ? location.pathname === '/membros'
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavClick}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-[#3B82F6]/15 via-[#3B82F6]/5 to-transparent text-[#3B82F6]'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-[#3B82F6] to-[#FFE066] rounded-r-full shadow-[0_0_12px_rgba(250,200,0,0.6)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={`w-[18px] h-[18px] transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* XP Card */}
      <div className="mx-4 mb-4 rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 font-bold text-[10px] px-2 py-0.5">
            Lv.{member.level}
          </Badge>
          <span className="text-[10px] text-white/40 font-mono">{xpCurrent}/{xpNext} XP</span>
        </div>
        <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#3B82F6] to-[#FFE066] rounded-full shadow-[0_0_10px_rgba(250,200,0,0.5)]"
          />
        </div>
        <p className="mt-2 text-[10px] text-white/30 leading-tight">
          Faltam <span className="text-white/60 font-semibold">{Math.max(0, xpNext - xpCurrent)} XP</span> para o próximo nível
        </p>
      </div>

      {/* User Card */}
      <div className="mx-4 mb-4 rounded-2xl border border-white/5 bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/40 to-transparent rounded-full blur-md" />
            <Avatar className="relative w-10 h-10 border-2 border-[#3B82F6]/30">
              <AvatarImage src={member.avatar_url || undefined} />
              <AvatarFallback className="bg-[#1a1a1a] text-[#3B82F6] text-sm font-bold">
                {member.name?.charAt(0)?.toUpperCase() || 'M'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{member.name}</p>
            <p className="text-[10px] text-white/40 truncate">{member.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-red-500/10 shrink-0"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Ambient gradient — premium tech feel */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#3B82F6]/[0.03] rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-[#3B82F6]/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-white/5 bg-[#070707]/80 backdrop-blur-xl flex-col sticky top-0 h-screen z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-[#070707]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/membros" className="flex items-center">
            <img src="/mais-que-vencedores-logo.svg" alt="+ que Vencedores" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 font-bold text-[10px]">
              Lv.{member.level}
            </Badge>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-[#070707] border-white/5 w-[260px] p-0">
                <SidebarContent onNavClick={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 relative z-10">
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 pt-20 lg:pt-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
