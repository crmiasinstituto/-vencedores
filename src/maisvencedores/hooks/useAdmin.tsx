import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';

/**
 * Diz se o usuário logado é admin.
 *
 * Antes do merge isto chamava has_role(_user_id, _role) contra a tabela user_roles — e nenhum
 * dos dois jamais existiu no banco do + que Vencedores. A chamada só podia dar erro, o catch
 * fazia setIsAdmin(false), e o /admin do portal não abria pra ninguém.
 *
 * Agora usa is_admin(), a MESMA função que o RLS usa nas policies, então tela e banco
 * concordam sobre quem é admin. Ela resolve pelo email do auth.uid() contra public.app_admins
 * e não recebe parâmetro: quem responde é o servidor, não o cliente.
 */
export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    checkAdminRole();
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('is_admin');

      if (error) throw error;
      setIsAdmin(data === true);
    } catch (err) {
      // Em erro, nega. Um admin que caia aqui por rede instável recarrega; o
      // contrário deixaria entrar quem não devia.
      console.error('Falha ao verificar is_admin():', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading, refetch: checkAdminRole };
}
