import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { Camera, X } from 'lucide-react';

/**
 * Aviso pros membros ANTIGOS que entraram antes da foto virar obrigatória no onboarding.
 * Aparece em todas as telas de membro enquanto não houver foto. Some sozinho quando a
 * pessoa adiciona a foto (o useProfile revalida). Dá pra fechar por sessão, mas volta no
 * próximo acesso até a foto existir — a ideia é deixar o portfólio bonito, não perseguir.
 */
export function PhotoReminderBanner() {
  const { profile, loading } = useProfile();
  const [dispensado, setDispensado] = useState(
    () => sessionStorage.getItem('mv-aviso-foto') === '1',
  );

  if (loading || dispensado) return null;
  if (!profile || profile.photo_url) return null;

  return (
    <div className="border-b border-primary/20 bg-primary/10">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Camera className="h-4 w-4" />
        </div>
        <p className="flex-1 text-sm text-foreground">
          <span className="font-semibold">Adicione sua foto de perfil.</span>{' '}
          <span className="text-muted-foreground">
            É o rosto que a comunidade vai reconhecer — e deixa seu portfólio muito mais bonito.
          </span>
        </p>
        <Link
          to="/maisvencedores/membros/perfil"
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Adicionar foto
        </Link>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('mv-aviso-foto', '1');
            setDispensado(true);
          }}
          aria-label="Fechar aviso"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
