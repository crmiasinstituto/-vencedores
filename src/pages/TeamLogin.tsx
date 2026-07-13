// Login do TIME (acesso externo independente ao acervo /time).
// So da acesso ao acervo/quadro; nao ao CRM. Erro mostrado inline e
// persistente (nao some sozinho), conforme padrao de UX do projeto.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeamAuth } from '@/hooks/useTeamAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FolderLock, AlertCircle } from 'lucide-react';

export default function TeamLogin() {
  const { user, loading, login } = useTeamAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/time', { replace: true });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Preencha email e senha.');
      return;
    }
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (res.ok) navigate('/time', { replace: true });
    else setError(res.error || 'Nao foi possivel entrar.');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <Helmet><title>Acervo do Time · + que Vencedores</title></Helmet>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#3B82F6]/10 mb-4">
            <FolderLock className="w-7 h-7 text-[#3B82F6]" />
          </div>
          <h1 className="text-xl font-bold">Acervo do Time</h1>
          <p className="text-sm text-white/50 mt-1">Entre com seu acesso para enviar e organizar materiais.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="text-xs text-white/60">Email</label>
            <Input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Senha</label>
            <Input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-[#3B82F6] text-black hover:bg-[#e0b400] font-semibold">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </Button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">
          Sem acesso? Fale com o administrador.
        </p>
      </div>
    </div>
  );
}
