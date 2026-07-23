import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { MembersSidebar } from './MembersSidebar';
import { Logo } from '@/maisvencedores/components/shared/Logo';
import { PhotoReminderBanner } from './PhotoReminderBanner';
import { MembershipProvider } from '@/maisvencedores/contexts/MembershipContext';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { useNotificacaoIndicacao } from '@/maisvencedores/hooks/useNotificacaoIndicacao';
import { Loader2, Menu } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Só existe pra ligar o realtime de indicações enquanto o membro está na área. Renderiza nada:
 * é um ponto de montagem estável, aqui no topo, pra assinatura viver por toda a sessão em vez
 * de subir e descer a cada troca de tela.
 */
function RealtimeIndicacoes() {
  useNotificacaoIndicacao();
  return null;
}

export function MembersLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Trocar de tela fecha a gaveta (rede de segurança além do onClose de cada item).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/maisvencedores/login" replace />;
  }

  return (
    <MembershipProvider>
      <RealtimeIndicacoes />
      <div className="flex min-h-screen w-full bg-background">
        <MembersSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* Fundo escuro atrás da gaveta no mobile; tocar fecha. */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden">
          {/* Barra de topo só no mobile: hambúrguer + marca. No desktop a sidebar já basta. */}
          <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 border-b border-border/50 bg-background/95 backdrop-blur">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-white/[0.06]"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Logo className="h-7" />
          </header>

          <PhotoReminderBanner />
          <Outlet />
        </main>
      </div>
    </MembershipProvider>
  );
}
