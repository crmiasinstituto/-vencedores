import { lerAtribuicao } from '@/maisvencedores/pages/LinkIndicacao';
import { FAIXAS, FAIXA_INFO, type Faixa } from '@/maisvencedores/types/member';
import {
  apenasDigitos,
  cpfValido,
  instagramValido,
  mascaraCpf,
  mascaraTelefone,
  nascimentoValido,
  normalizaInstagram,
  telefoneValido,
} from '@/maisvencedores/lib/validacoes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, Sparkles, UserPlus, Gift } from 'lucide-react';
import { z } from 'zod';
import { Logo } from '@/maisvencedores/components/shared/Logo';
import { trackEvent, trackCustom } from '@/components/tracking/MetaPixel';

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
  
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  // 'nao_sei' é o padrão de propósito: exigir a faixa na porta trava justamente quem é
  // novo e nunca ouviu falar de FPO ou Practitioner.
  const [faixaDeclarada, setFaixaDeclarada] = useState<Faixa | 'nao_sei'>('nao_sei');
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

    if (nomeCompleto.trim().length < 3) {
      setErrors({ nomeCompleto: 'Diga seu nome completo' });
      return;
    }
    if (!instagramValido(instagram)) {
      setErrors({ instagram: 'Informe seu @ do Instagram' });
      return;
    }
    if (!telefoneValido(whatsapp)) {
      setErrors({ whatsapp: 'WhatsApp com DDD, ex: (71) 99999-9999' });
      return;
    }
    if (!cpfValido(cpf)) {
      setErrors({ cpf: 'CPF inválido' });
      return;
    }
    if (!nascimentoValido(dataNascimento)) {
      setErrors({ dataNascimento: 'Data de nascimento inválida' });
      return;
    }
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
    const { error } = await signUp({
      email,
      password,
      nomeCompleto: nomeCompleto.trim(),
      instagram: normalizaInstagram(instagram),
      whatsapp: apenasDigitos(whatsapp),
      cpf: apenasDigitos(cpf),
      dataNascimento,
      // 'nao_sei' e 'branco' não viram pedido: branca é onde todo mundo começa, não um
      // privilégio a conceder. Só faixa acima disso vira solicitação pro time.
      faixaDeclarada:
        faixaDeclarada === 'nao_sei' || faixaDeclarada === 'branco'
          ? undefined
          : (faixaDeclarada as Faixa),
      referralCode: referralCode || undefined,
    });

    if (error) {
      toast({
        title: 'Erro ao cadastrar',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Meta Pixel: conversão de cadastro.
    trackEvent('CompleteRegistration');
    trackCustom('cadastrorpg10x');

    // Dizia "Bem-vindo ao + que Vencedores!" e mandava direto pro onboarding — mentira dupla:
    // o projeto exige confirmar email (não há sessão ainda) e ninguém entra aprovado. A pessoa
    // caía numa tela de membro sem ser membro.
    toast({
      title: 'Cadastro recebido',
      description:
        faixaDeclarada === 'nao_sei'
          ? 'Confirme seu email para entrar. Você começa na Faixa Branca.'
          : 'Confirme seu email. Nosso time vai conferir sua graduação e liberar sua faixa.',
    });
    navigate('/maisvencedores/login');
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
          <div className="flex items-center gap-2 mb-12">
            <Logo tone="branca" className="h-9" />
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
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <Logo className="h-7" />
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
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                placeholder="Como você se chama"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
              />
              {errors.nomeCompleto && <p className="text-sm text-destructive">{errors.nomeCompleto}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  placeholder="@seuperfil"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
                {errors.instagram && <p className="text-sm text-destructive">{errors.instagram}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  inputMode="tel"
                  placeholder="(71) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(mascaraTelefone(e.target.value))}
                />
                {errors.whatsapp && <p className="text-sm text-destructive">{errors.whatsapp}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                />
                {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nascimento">Data de nascimento</Label>
                <Input
                  id="nascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                />
                {errors.dataNascimento && <p className="text-sm text-destructive">{errors.dataNascimento}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="faixa">
                Você já fez alguma formação?{' '}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              {/* Opcional de propósito. Quem não sabe entra na Branca e pronto — é onde todo
                  mundo começa. Declarar faixa acima disso não dá acesso: abre um pedido que o
                  time aprova (profiles.faixa_declarada, nunca profiles.faixa). */}
              <Select
                value={faixaDeclarada}
                onValueChange={(v) => setFaixaDeclarada(v as Faixa | 'nao_sei')}
              >
                <SelectTrigger id="faixa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_sei">Ainda não sei / Estou começando agora</SelectItem>
                  {FAIXAS.filter((f) => f !== 'branco').map((f) => (
                    <SelectItem key={f} value={f}>
                      Faixa {FAIXA_INFO[f].nome} — {FAIXA_INFO[f].descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {faixaDeclarada === 'nao_sei'
                  ? 'Sem problema: você começa na Faixa Branca e avança conforme fizer as formações.'
                  : `Você entra na Faixa Branca e nosso time confere sua graduação para liberar a Faixa ${FAIXA_INFO[faixaDeclarada as Faixa].nome}.`}
              </p>
            </div>

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
