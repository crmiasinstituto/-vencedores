import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Faixa } from '@/maisvencedores/types/member';
import { useToast } from '@/hooks/use-toast';

/** O que o cadastro coleta. A faixa é o que a PESSOA declara — quem confirma é o time. */
export interface DadosCadastro {
  email: string;
  password: string;
  nomeCompleto: string;
  instagram?: string;
  whatsapp?: string;
  cpf?: string;
  dataNascimento?: string; // ISO yyyy-mm-dd
  profissao?: string;
  /** Faixa declarada pela pessoa. Não dá acesso: entra como palpite pro time conferir. */
  faixaDeclarada?: Faixa;
  referralCode?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (dados: DadosCadastro) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Dispara o email de recuperação. O link do email cai em /maisvencedores/nova-senha. */
  recuperarSenha: (email: string) => Promise<{ error: Error | null }>;
  /** Define a nova senha DEPOIS que o usuário chegou pela sessão de recovery do email. */
  definirNovaSenha: (novaSenha: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // O callback NÃO pode ser async.
    //
    // O supabase-js segura um lock interno enquanto o callback do onAuthStateChange roda. Um
    // callback `async` só devolve o controle quando a Promise resolve, e nesse intervalo
    // QUALQUER outra chamada ao cliente (rpc, from, auth) fica esperando o lock — para sempre.
    // O sintoma é cruel: nenhum erro, nenhuma requisição na aba Network, a chamada só nunca
    // volta.
    //
    // Como este provider envolve /maisvencedores/*, o deadlock derrubava o Supabase da landing
    // e da área de membros inteira. Provado: `fetch` puro pra mesma RPC devolvia 200, e o
    // supabase.rpc na mesma página travava; a rota /i/, que fica FORA deste provider,
    // funcionava normalmente.
    //
    // O próprio CRM já sabia disso — ver o comentário em hooks/useAdminAuth.tsx, que resolve
    // jogando o trabalho pra fora da pilha com setTimeout. Aqui nem precisa: só setState.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (dados: DadosCadastro) => {
    try {
      // Tudo vai em options.data (raw_user_meta_data). O PERFIL É CRIADO POR TRIGGER no
      // servidor (public.handle_new_user), não aqui.
      //
      // Aqui havia um `supabase.from('profiles').insert(...)` logo depois do signUp, e ele
      // NUNCA funcionou: o projeto exige confirmação de email (mailer_autoconfirm=false),
      // então signUp não devolve sessão e o insert saía como anon contra uma policy
      // `to authenticated`. O banco recusava, o código fazia só console.error, e a tela dizia
      // "Cadastro enviado!". Dois cadastros reais se perderam assim antes de alguém notar.
      const { error } = await supabase.auth.signUp({
        email: dados.email,
        password: dados.password,
        options: {
          emailRedirectTo: `${window.location.origin}/maisvencedores/login`,
          data: {
            nome_completo: dados.nomeCompleto,
            instagram: dados.instagram || null,
            whatsapp: dados.whatsapp || null,
            telefone: dados.whatsapp || null,
            cpf: dados.cpf || null,
            data_nascimento: dados.dataNascimento || null,
            profissao: dados.profissao || null,
            faixa_declarada: dados.faixaDeclarada || null,
            referral_code: dados.referralCode || null,
          },
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // O redirectTo tem que bater com o uri_allow_list do projeto (config do Auth no Supabase),
  // senão o Supabase recusa o link. Em produção é iasinstituto.com.br; em dev, o origin local.
  const recuperarSenha = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/maisvencedores/nova-senha`,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const definirNovaSenha = async (novaSenha: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, recuperarSenha, definirNovaSenha }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
