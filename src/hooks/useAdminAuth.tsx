import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Porta de entrada do /admin.
 *
 * Ter sessão não é ser admin. Este hook checava só a sessão, e isso bastava
 * enquanto o banco tinha um único usuário e não havia cadastro aberto. Com o
 * /membros aceitando cadastro público, qualquer membro logado passaria a
 * alcançar a casca do admin — as tabelas viriam vazias, porque o RLS segura os
 * dados, mas a navegação inteira ficaria exposta. O is_admin() abaixo é a mesma
 * função que o RLS usa, então tela e banco concordam sobre quem é admin.
 */
export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    // Resolve is_admin() no servidor. Em erro devolve false: um admin que caia
    // aqui por rede instável perde o acesso e recarrega; o contrário deixaria
    // entrar quem não devia.
    const resolveAdmin = async (session: Session | null) => {
      if (!session) {
        if (active) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase.rpc('is_admin');
      if (!active) return;
      if (error) {
        console.error('Falha ao verificar is_admin():', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data === true);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        // onAuthStateChange não aceita callback async: chamar o supabase aqui
        // dentro trava o cliente. Por isso o resolveAdmin sai da pilha.
        setTimeout(() => resolveAdmin(session), 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      resolveAdmin(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/admin/auth');
      return;
    }
    // Logado mas sem ser admin: é membro que digitou /admin. Vai pra área dele,
    // não pra tela de login — mandar pro login sugeriria "logue com outra conta".
    if (isAdmin === false) {
      navigate('/membros');
    }
  }, [loading, user, isAdmin, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/auth');
  };

  return { user, session, loading, isAdmin: isAdmin === true, signOut };
}
