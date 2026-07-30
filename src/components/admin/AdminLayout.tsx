import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { GlobalSearch } from './GlobalSearch';
import NotificationBell from './NotificationBell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { RefreshCw } from 'lucide-react';
import { MeetingReminderAlert } from '@/components/crm/MeetingReminderAlert';
import { CallProvider } from '@/contexts/CallContext';
import { CallModals } from '@/components/calls/CallModals';
import { RateLimitBanner } from './RateLimitBanner';
import { ActiveInitiativeWidget } from './ActiveInitiativeWidget';
import { GlobalSalesPopup } from './GlobalSalesPopup';
import { Lock } from 'lucide-react';
import { usePermissoesAdmin } from '@/hooks/usePermissoesAdmin';
import { podeAcessarRota } from '@/lib/permissoes';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading, signOut } = useAdminAuth();
  const { permissoes, carregando: carregandoPermissoes } = usePermissoesAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <CallProvider>
      <CallModals />
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar onSignOut={signOut} />
          <main className="flex-1 flex flex-col min-w-0">
            <RateLimitBanner />
            {/* Top bar */}
            <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center gap-3 px-4">
              <SidebarTrigger />
              <GlobalSearch />
              <div className="ml-auto">
                <NotificationBell />
              </div>
            </header>
            <div className="flex-1 overflow-auto p-4 md:p-6">
              {/* Esconder o item no menu não basta: sem esta guarda, digitar a URL na barra de
                  endereços entrava na tela do mesmo jeito. */}
              {carregandoPermissoes ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : podeAcessarRota(permissoes, location.pathname) ? (
                children
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                  <Lock className="w-10 h-10 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Você não tem acesso a esta área</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Fale com um administrador se precisar entrar aqui. O acesso é liberado em
                    Configurações → Colaboradores.
                  </p>
                </div>
              )}
            </div>
            <MeetingReminderAlert />
            <ActiveInitiativeWidget />
            <GlobalSalesPopup />
          </main>
        </div>
      </SidebarProvider>
    </CallProvider>
  );
}
