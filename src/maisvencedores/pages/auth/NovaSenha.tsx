import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const schema = z
  .object({
    senha: z.string().min(6, { message: 'Mínimo 6 caracteres' }),
    confirma: z.string(),
  })
  .refine((d) => d.senha === d.confirma, { message: 'As senhas não conferem', path: ['confirma'] });

/**
 * Onde o link do email de recuperação aterrissa. A pessoa chega aqui já com uma sessão de
 * "recovery" que o Supabase abre a partir do token do link — por isso updateUser({password})
 * funciona sem pedir a senha antiga.
 *
 * Detecção da sessão: o supabase-js troca o token da URL por sessão sozinho e dispara o evento
 * PASSWORD_RECOVERY. Escutamos esse evento (e também checamos a sessão atual) pra saber se a
 * pessoa entrou por um link válido. Sem link válido, não dá pra trocar a senha aqui.
 */
export default function NovaSenha() {
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [errors, setErrors] = useState<{ senha?: string; confirma?: string }>({});
  const [loading, setLoading] = useState(false);
  const [prontoParaTrocar, setProntoParaTrocar] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const { definirNovaSenha } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // O callback do onAuthStateChange NÃO pode ser async (trava o lock interno do supabase-js —
    // ver a nota longa no AuthContext). Só marcamos o estado aqui.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setProntoParaTrocar(true);
        setVerificando(false);
      }
    });

    // Fallback: se a sessão já existe quando a página monta (o evento pode ter passado antes
    // de assinarmos), liberamos a troca do mesmo jeito.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setProntoParaTrocar(true);
      setVerificando(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ senha, confirma });
    if (!result.success) {
      const fe: typeof errors = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fe[err.path[0] as keyof typeof errors] = err.message;
      });
      setErrors(fe);
      return;
    }

    setLoading(true);
    const { error } = await definirNovaSenha(senha);
    setLoading(false);

    if (error) {
      toast({
        title: 'Não foi possível trocar a senha',
        description: 'O link pode ter expirado. Peça um novo em "Esqueci minha senha".',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Senha atualizada!', description: 'Já pode entrar com a nova senha.' });
    navigate('/maisvencedores/membros/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center lg:text-left">
          <span className="font-display text-xl font-bold text-gold">+ que Vencedores</span>
          <h2 className="text-2xl font-display font-bold mt-6">Criar nova senha</h2>
          <p className="text-muted-foreground mt-2">Escolha uma senha nova para a sua conta.</p>
        </div>

        {verificando ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando o link…
          </p>
        ) : !prontoParaTrocar ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <p className="font-medium">Link inválido ou expirado.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Peça um novo link em "Esqueci minha senha". Cada link vale por 1 hora.
              </p>
            </div>
            <Link to="/maisvencedores/recuperar-senha" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
              <ArrowLeft className="w-4 h-4" /> Pedir novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.senha && <p className="text-sm text-destructive">{errors.senha}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirma">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirma"
                  type="password"
                  placeholder="••••••••"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.confirma && <p className="text-sm text-destructive">{errors.confirma}</p>}
            </div>

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
