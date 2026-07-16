import { lerAtribuicao } from '@/maisvencedores/pages/LinkIndicacao';
import { useState } from 'react';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, Sparkles, UserPlus, Gift } from 'lucide-react';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export default function Signup() {
  const [searchParams] = useSearchParams();
  // A rota e /maisvencedores/convite/:code, entao o codigo chega como PARAMETRO DE CAMINHO.
  // Isto lia so searchParams.get('ref') — query string — entao o codigo nunca era lido e a
  // indicacao nunca funcionou, mesmo antes do merge. Aceita os dois: o /i/ manda por path e
  // links antigos podem vir com ?ref=.
  const { code } = useParams();
  // Ordem: path (/maisvencedores/convite/:code) > query (?ref=, links antigos) > localStorage
  // (a pessoa clicou no /i/, olhou a landing e só depois foi se cadastrar — o código continua
  // valendo por 90 dias).
  const referralCode = code || searchParams.get('ref') || lerAtribuicao() || '';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = signupSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, referralCode || undefined);

    if (error) {
      toast({
        title: 'Erro ao cadastrar',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    toast({ 
      title: referralCode ? 'Cadastro enviado!' : 'Bem-vindo ao + que Vencedores!',
      description: referralCode 
        ? 'Aguarde a aprovação do seu padrinho (até 7 dias).' 
        : 'Complete seu perfil para começar.',
    });
    navigate('/maisvencedores/membros/onboarding');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-premium p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-electric/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">            <span className="font-display text-2xl font-bold text-gold">+ que Vencedores</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground mb-4">
            Junte-se à rede<br/>
            <span className="text-gradient-gold">exclusiva de negócios</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Faça parte de uma comunidade de empresários que crescem juntos através de conexões estratégicas.
          </p>
        </div>

        {referralCode && (
          <div className="relative z-10 glass-gold rounded-2xl p-6">
            <div className="flex items-center gap-2 text-gold mb-2">
              <Gift className="w-5 h-5" />
              <span className="font-medium">Convite Especial</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Você foi convidado para fazer parte do + que Vencedores! Após o cadastro, seu padrinho receberá a notificação.
            </p>
          </div>
        )}

        <div className="relative z-10 grid grid-cols-3 gap-4 text-center">
          <div className="glass rounded-xl p-4">
            <p className="text-2xl font-bold text-gold">500+</p>
            <p className="text-xs text-muted-foreground">Membros ativos</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-2xl font-bold text-gold">R$2M+</p>
            <p className="text-xs text-muted-foreground">Em negócios</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-2xl font-bold text-gold">50+</p>
            <p className="text-xs text-muted-foreground">Eventos/ano</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">              <span className="font-display text-xl font-bold text-gold">+ que Vencedores</span>
            </div>
            <h2 className="text-2xl font-display font-bold">Criar sua conta</h2>
            <p className="text-muted-foreground mt-2">
              Já tem uma conta?{' '}
              <Link to="/maisvencedores/login" className="text-gold hover:underline">
                Entrar
              </Link>
            </p>
          </div>

          {referralCode && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 flex items-center gap-3">
              <Gift className="w-5 h-5 text-gold flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gold">Código de convite aplicado</p>
                <p className="text-xs text-muted-foreground">{referralCode}</p>
              </div>
            </div>
          )}

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
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar Conta
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao criar uma conta, você concorda com nossos Termos de Uso e Política de Privacidade.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
