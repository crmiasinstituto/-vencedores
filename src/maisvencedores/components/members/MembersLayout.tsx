import { Outlet, Navigate } from 'react-router-dom';
import { MembersSidebar } from './MembersSidebar';
import { MembershipProvider } from '@/maisvencedores/contexts/MembershipContext';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { useNotificacaoIndicacao } from '@/maisvencedores/hooks/useNotificacaoIndicacao';
import { Loader2 } from 'lucide-react';

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
        <MembersSidebar />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </MembershipProvider>
  );
}
