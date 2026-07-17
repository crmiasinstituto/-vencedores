import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

const schema = z.object({ email: z.string().trim().email({ message: 'Email inválido' }) });

/**
 * "Esqueci minha senha" do +vencedores. Não existia — por isso ninguém conseguia redefinir.
 *
 * Dispara o email de recuperação (recuperarSenha no AuthContext). O link do email leva a
 * /maisvencedores/nova-senha, onde a pessoa escolhe a senha nova.
 *
 * Por segurança, a tela NÃO revela se o email existe: manda ou não manda, a resposta é a mesma
 * ("se houver conta, o link chegou"). Assim ninguém usa a página pra descobrir quem é membro.
 */
export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const { recuperarSenha } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(undefined);

    const result = schema.safeParse({ email });
    if (!result.success) {
      setErro(result.error.errors[0]?.message);
      return;
    }

    setLoading(true);
    const { error } = await recuperarSenha(email);
    setLoading(false);

    // Mesmo em erro real (ex.: rate limit), mostramos a tela de sucesso pra não vazar nada.
    // O erro fica no console pra depuração.
    if (error) console.error('recuperarSenha:', error.message);
    setEnviado(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center lg:text-left">
          <span className="font-display text-xl font-bold text-gold">+ que Vencedores</span>
          <h2 className="text-2xl font-display font-bold mt-6">Recuperar acesso</h2>
          <p className="text-muted-foreground mt-2">
            Informe o email do seu cadastro e enviaremos um link para você criar uma nova senha.
          </p>
        </div>

        {enviado ? (
          <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4">
              <CheckCircle2 className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Se houver uma conta com esse email, o link chegou.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifique a caixa de entrada e o spam. O link vale por 1 hora.
                </p>
              </div>
            </div>
            <Link to="/maisvencedores/login" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
              <ArrowLeft className="w-4 h-4" /> Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
            </div>

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…
                </>
              ) : (
                'Enviar link de recuperação'
              )}
            </Button>

            <Link to="/maisvencedores/login" className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
              <ArrowLeft className="w-4 h-4" /> Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
