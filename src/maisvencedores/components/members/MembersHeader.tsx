import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';

interface MembersHeaderProps {
  title: string;
  subtitle?: string;
}

export function MembersHeader({ title, subtitle }: MembersHeaderProps) {
  const { isOnboardingComplete } = useMembership();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  const buscar = () => {
    const termo = busca.trim();
    navigate(`/maisvencedores/membros/portfolio${termo ? `?q=${encodeURIComponent(termo)}` : ''}`);
  };

  // Sticky só no desktop: no mobile quem fica fixo no topo é a barra do hambúrguer
  // (MembersLayout), e dois sticky no top-0 se sobrepõem.
  return (
    <header className="lg:sticky lg:top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6 lg:py-4">
        {/* Left: Title */}
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-display font-bold text-foreground truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 line-clamp-2 lg:line-clamp-1">{subtitle}</p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          {/* Search — Enter (ou a lupa) leva ao Portfólio já filtrado */}
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={buscar}
              aria-label="Buscar"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Search className="w-4 h-4" />
            </button>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
              placeholder="Buscar membros..."
              className="w-64 pl-9 bg-muted/50 border-border/50"
            />
          </div>

          {/* Notifications — popover honesto (sem inventar notificação) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0" aria-label="Notificações">
                <Bell className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-4">
              <p className="text-sm font-semibold text-foreground">Notificações</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Você está em dia. Novidades da comunidade, indicações e eventos vão aparecer aqui.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => navigate('/maisvencedores/membros/indicacoes')}
              >
                Ver minhas indicações
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            aria-label="Configurações"
            onClick={() => navigate('/maisvencedores/membros/configuracoes')}
          >
            <Settings className="w-5 h-5" />
          </Button>

          {/* Onboarding CTA */}
          {!isOnboardingComplete && (
            <Button variant="gold" size="sm" asChild>
              <a href="/maisvencedores/membros/onboarding">
                Completar Perfil
              </a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
