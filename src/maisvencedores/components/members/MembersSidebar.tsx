import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Calendar, 
  Megaphone,
  User,
  LogOut,
  ChevronLeft,
  Menu,
  Sprout,
  Settings,
  Shield,
  TrendingUp,
  X
} from 'lucide-react';
import { useAdmin } from '@/maisvencedores/hooks/useAdmin';
import { Logo } from '@/maisvencedores/components/shared/Logo';
import { FaixaBadge } from './FaixaBadge';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Faixa } from '@/maisvencedores/types/member';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

// "Generosidade" no lugar de "Indicações": indicar é transação, e o que acontece aqui é
// alguém trazer outro pra mudar de vida. O nome da tela conta o que o ecossistema é.
const menuItems: { icon: typeof LayoutDashboard; label: string; path: string; faixaMinima?: Faixa }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/maisvencedores/membros/dashboard' },
  { icon: Users, label: 'Portfólios', path: '/maisvencedores/membros/portfolio' },
  { icon: Sprout, label: 'Generosidade', path: '/maisvencedores/membros/indicacoes' },
  { icon: GraduationCap, label: 'Treinamentos', path: '/maisvencedores/membros/treinamentos' },
  { icon: Calendar, label: 'Eventos', path: '/maisvencedores/membros/eventos' },
  { icon: Megaphone, label: 'Publicidade', path: '/maisvencedores/membros/publicidade', faixaMinima: 'verde' },
  { icon: User, label: 'Meu Perfil', path: '/maisvencedores/membros/perfil' },
  { icon: Settings, label: 'Configurações', path: '/maisvencedores/membros/configuracoes' },
];

/**
 * Sidebar do membro. No desktop (lg+) é fixa e pode encolher (isCollapsed). No mobile vira uma
 * GAVETA: fica escondida fora da tela e desliza por cima quando o hambúrguer do topo abre —
 * quem controla o abre/fecha é o MembersLayout (mobileOpen/onClose), porque o botão vive lá.
 */
export function MembersSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const { faixa, currentMember, alcanca } = useMembership();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-50 h-screen w-72 flex flex-col bg-card/95 lg:bg-card/50 backdrop-blur-xl border-r border-border/50 transition-transform duration-300',
      'lg:sticky lg:top-0 lg:z-auto lg:translate-x-0',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      isCollapsed ? 'lg:w-16' : 'lg:w-64',
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          {!isCollapsed && <Logo className="h-9" />}
          {/* Desktop: botão de encolher. Mobile: botão de fechar a gaveta. */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:flex h-8 w-8 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden h-8 w-8 p-0"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* User Info */}
      {!isCollapsed && currentMember && (
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-foreground font-bold">
              {(currentMember.nome_completo || currentMember.owner_name || 'U')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {currentMember.nome_completo || currentMember.owner_name || 'Usuário'}
              </p>
              {/* A profissão, não a empresa: o ecossistema é sobre a pessoa. */}
              <p className="text-xs text-muted-foreground truncate">
                {currentMember.profissao || 'Complete seu perfil'}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <FaixaBadge faixa={faixa} size="sm" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const temAcesso = !item.faixaMinima || alcanca(item.faixaMinima);

          return (
            <NavLink
              key={item.path}
              to={temAcesso ? item.path : '#'}
              className={cn(
                // O item ativo era azul-sobre-azul (bg-gold/20 + text-gold + borda azul), e o
                // azul da marca sobre o fundo navy não separa — virava borrão. Agora quem marca
                // o ativo é o CONTRASTE (texto branco, fundo mais claro) e uma barra azul na
                // borda esquerda. A cor vira acento, não o fundo inteiro.
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200',
                isActive
                  ? 'bg-white/[0.07] text-foreground font-medium'
                  : temAcesso
                    ? 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                    : 'text-muted-foreground/40 cursor-not-allowed',
                isCollapsed && 'justify-center px-2',
              )}
              onClick={(e) => {
                if (!temAcesso) {
                  e.preventDefault();
                  return;
                }
                onClose?.();
              }}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
              )}
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} />
              {!isCollapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {!temAcesso && item.faixaMinima && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {item.faixaMinima}+
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Admin Link */}
      {isAdmin && (
        <div className="p-2 border-t border-border/50">
          <NavLink
            to="/admin/maisvencedores"
            onClick={() => onClose?.()}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-gold hover:bg-gold/10 transition-all duration-200 w-full',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <Shield className="w-5 h-5" />
            {!isCollapsed && <span>Painel Admin</span>}
          </NavLink>
        </div>
      )}

      {/* Footer */}
      <div className="p-2 border-t border-border/50">
        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 w-full',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
