import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';

interface MembersHeaderProps {
  title: string;
  subtitle?: string;
}

export function MembersHeader({ title, subtitle }: MembersHeaderProps) {
  const { currentMember, isOnboardingComplete } = useMembership();

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
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar membros, treinamentos..."
              className="w-64 pl-9 bg-muted/50 border-border/50"
            />
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-electric rounded-full" />
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
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
