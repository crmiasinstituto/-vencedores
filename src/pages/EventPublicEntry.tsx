/**
 * EventPublicEntry
 *
 * /evento/:token  (token = collective_events.public_signup_token)
 *
 * Pagina publica do link postado nos grupos do WhatsApp. Identifica quem clicou:
 * pede telefone + nome completo; se ja for lead do CRM, registra presenca e manda
 * pra sala (/r/<invite_token>); se nao for, captura email + instagram e cria o lead.
 * Tudo via RPC anon event_public_identify.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function EventPublicEntry() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [eventTitle, setEventTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data } = await (supabase.rpc as any)('resolve_event_signup', { p_token: token });
        const ev = (data as any)?.event || data;
        if (ev?.title) setEventTitle(ev.title);
      } catch { /* mostra form generico */ }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!phone.replace(/\D/g, '') || phone.replace(/\D/g, '').length < 10) {
      toast.error('Informe seu WhatsApp com DDD'); return;
    }
    if (!name.trim()) { toast.error('Informe seu nome completo'); return; }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('event_public_identify', {
        p_event_token: token,
        p_phone: phone,
        p_name: name.trim(),
        p_email: email.trim() || null,
        p_instagram: instagram.trim() || null,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) throw new Error(res.error);
      if (res?.redirect) {
        navigate(res.redirect);
      } else {
        toast.success('Presenca confirmada!');
      }
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'tente novamente'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#15151c] border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="text-center mb-5">
          <div className="text-xs tracking-widest text-amber-400 font-semibold">+ que Vencedores</div>
          <h1 className="text-xl font-bold mt-1">{eventTitle || 'Confirme sua presenca'}</h1>
          <p className="text-sm text-white/50 mt-1">Identifique-se para entrar e garantir sua vaga.</p>
        </div>

        {loading ? (
          <div className="text-center text-white/40 py-8">Carregando...</div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60">WhatsApp (com DDD) *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                placeholder="(75) 99999-9999"
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400/50" />
            </div>
            <div>
              <label className="text-xs text-white/60">Nome completo *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400/50" />
            </div>
            <div>
              <label className="text-xs text-white/60">E-mail</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email"
                placeholder="seu@email.com"
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400/50" />
            </div>
            <div>
              <label className="text-xs text-white/60">Instagram</label>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)}
                placeholder="@seuusuario"
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400/50" />
            </div>
            <button onClick={submit} disabled={submitting}
              className="w-full mt-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black font-semibold rounded-lg py-3 text-sm transition-colors">
              {submitting ? 'Confirmando...' : 'Entrar no evento'}
            </button>
            <p className="text-[11px] text-white/30 text-center">Seus dados ficam seguros e sao usados so pra confirmar sua presenca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
