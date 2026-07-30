import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ACESSO_TOTAL } from '@/lib/permissoes';

/**
 * Permissões de área do admin logado, resolvidas no servidor.
 *
 * Em erro devolve lista vazia (nada liberado) em vez de acesso total — o contrário deixaria
 * uma falha de rede virar escalada de privilégio. Mesma escolha do is_admin() em useAdminAuth.
 */
export function usePermissoesAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['minhas-permissoes-admin'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('minhas_permissoes_admin');
      if (error) {
        console.error('Falha ao carregar permissões:', error);
        return [];
      }
      return (data as string[]) || [];
    },
  });

  return {
    permissoes: data ?? [],
    carregando: isLoading,
    acessoTotal: !!data?.includes(ACESSO_TOTAL),
  };
}
