import { Outlet, Navigate } from 'react-router-dom';
import { MembersSidebar } from './MembersSidebar';
import { MembershipProvider } from '@/maisvencedores/contexts/MembershipContext';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function MembersLayout() {
  const { user, loading } = useAuth();

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
      <div className="flex min-h-screen w-full bg-background">
        <MembersSidebar />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </MembershipProvider>
  );
}
