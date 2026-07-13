// Stub mínimo para o módulo Marketing. Lista team_members ativos.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMemberLite {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, role')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as TeamMemberLite[];
    },
  });
}

// Alias: alguns componentes do pacote chamam useAllTeamMembers
export const useAllTeamMembers = useTeamMembers;

export default useTeamMembers;
