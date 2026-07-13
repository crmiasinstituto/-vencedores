import { ReactNode } from 'react';
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

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading, signOut } = useAdminAuth();

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
              {children}
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
