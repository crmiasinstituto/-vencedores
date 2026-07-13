// Shim de AuthContext para o módulo Marketing (que importa useAuth + teamMember).
// O CRM + que Vencedores usa useAdminAuth direto; este wrapper expõe a forma esperada pelo pacote.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export function useAuth() {
  const { user, session, loading, signOut } = useAdminAuth();
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    if (!user?.email) {
      setTeamMember(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name, email, role')
        .eq('email', user.email!)
        .eq('is_active', true)
        .maybeSingle();
      if (!cancelled) setTeamMember((data as TeamMember) || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  return { user, session, loading, signOut, teamMember };
}
