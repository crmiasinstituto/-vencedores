import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, LogIn, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import squaadLogo from '@/assets/squaad-logo.jpeg';

export default function MembrosLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const urlMessage = searchParams.get('msg');

  useEffect(() => {
    if (urlMessage) toast.warning(urlMessage, { duration: 6000 });
  }, [urlMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !phone) {
      toast.error('Preencha email e telefone');
      return;
    }

    // Rate limiting: 5 attempts, then lock for 5 minutes
    if (lockedUntil && Date.now() < lockedUntil) {
      const secsLeft = Math.ceil((lockedUntil - Date.now()) / 1000);
      toast.error(`Muitas tentativas. Tente novamente em ${secsLeft}s`);
      return;
    }

    if (attempts >= 5) {
      setLockedUntil(Date.now() + 5 * 60 * 1000);
      setAttempts(0);
      toast.error('Muitas tentativas. Aguarde 5 minutos.');
      return;
    }

    setLoading(true);
    setAttempts(prev => prev + 1);

    try {
      // Login server-side via edge function. O anon NÃO lê mais members
      // direto (RLS fechada em Part B.next). A edge function bypassa via
      // service_role, verifica PBKDF2/phone, gera token, e devolve só os
      // campos seguros (sem password_hash).
      const { data, error } = await supabase.functions.invoke('member-login', {
        body: { email: email.trim(), credential: phone.trim() },
      });

      if (error || !data?.session_token) {
        const msg = (data && (data as any).error) || error?.message || 'Acesso nao encontrado. Entre em contato.';
        toast.error(msg);
        setLoading(false);
        return;
      }

      localStorage.setItem(
        'squaad_member_session',
        JSON.stringify({
          session_token: data.session_token,
          member_id: data.member.id,
          name: data.member.name,
          email: data.member.email,
        }),
      );

      toast.success(`Bem-vindo(a), ${data.member.name}!`);
      navigate('/membros');
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Erro ao processar login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
      }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Glassmorphism card */}
        <div
          className="rounded-2xl border shadow-2xl p-8"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'rgba(250, 200, 0, 0.15)',
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="flex justify-center mb-4"
            >
              <img
                src={squaadLogo}
                alt="+ que Vencedores"
                className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                style={{ boxShadow: '0 0 30px rgba(250, 200, 0, 0.3)' }}
              />
            </motion.div>
            <h1 className="text-2xl font-bold text-white">
              Area de Membros
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#3B82F6' }}>
              Metodo + que Vencedores
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300 text-sm">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#3B82F6]/50 focus:ring-[#3B82F6]/20"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-300 text-sm">
                Telefone ou senha
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="phone"
                  type="password"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefone cadastrado ou sua senha"
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[#3B82F6]/50 focus:ring-[#3B82F6]/20"
                  autoComplete="current-password"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Primeiro acesso? Use o telefone cadastrado. Depois voce pode definir uma senha em "Meu Perfil".
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold rounded-xl transition-all duration-300"
              style={{
                background: loading ? '#b8960a' : '#3B82F6',
                color: '#000',
              }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Acesso exclusivo para alunos do Metodo + que Vencedores
          </p>
        </div>
      </motion.div>
    </div>
  );
}
