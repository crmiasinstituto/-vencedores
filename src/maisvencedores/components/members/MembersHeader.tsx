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

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: Title */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
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
