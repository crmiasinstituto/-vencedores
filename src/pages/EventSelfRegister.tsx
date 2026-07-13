/**
 * EventSelfRegister
 *
 * /inscricao/:token
 *
 * Pagina publica de auto-cadastro. O walk-in escaneia o QR do evento, cai aqui,
 * preenche os dados e entra na lista interna de inscritos (origem 'auto').
 * Apos cadastrar, recebe um QR pessoal pra agilizar o credenciamento.
 *
 * Tudo via RPC anon (register_event_attendee + resolve_event_signup). O scrap de
 * Instagram roda em background chamando analyze-instagram-profile.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  event_format: 'online' | 'presencial' | 'hybrid';
  scheduled_at: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_complement: string | null;
  venue_map_url: string | null;
}

function formatScheduledLong(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

// dispara o scrap de Instagram e grava no inscrito (best-effort, nao bloqueia)
async function scrapInstagram(attendeeId: string, handle: string, name: string) {
  try {
    const username = handle.replace(/^@/, '').trim();
    if (!username) return;
    const { data } = await supabase.functions.invoke('analyze-instagram-profile', {
      body: { username, leadName: name, context: 'event_self_register' },
    });
    if (!data) return;
    const pic =
      (data as any).profilePicUrl || (data as any).profile_pic_url ||
      (data as any).profilePictureUrl || null;
    await (supabase.rpc as any)('save_attendee_instagram', {
      p_attendee_id: attendeeId, p_pic: pic, p_data: data,
    });
  } catch {
    /* silencioso: scrap nunca quebra o cadastro */
  }
}

export default function EventSelfRegister() {
  const { token } = useParams<{ token: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', whatsapp: '', email: '', cpf: '', instagram: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ checkin_code: string; updated: boolean } | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      const { data: rpc, error: err } = await (supabase.rpc as any)('resolve_event_signup', { p_token: token });
      if (!alive) return;
      if (err) setError('Nao consegui carregar o evento');
      else if (!(rpc as any)?.found) setError('Link de inscricao invalido');
      else {
        setEvent((rpc as any).event as EventInfo);
        setEnabled((rpc as any).signup_enabled !== false);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [token]);

  const isPresencial = event?.event_format !== 'online';
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!form.name.trim()) { setError('Informe seu nome'); return; }
    if (!form.whatsapp.trim()) { setError('Informe seu WhatsApp'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const { data: rpc, error: err } = await (supabase.rpc as any)('register_event_attendee', {
        p_token: token,
        p_name: form.name,
        p_whatsapp: form.whatsapp,
        p_email: form.email || null,
        p_cpf: form.cpf || null,
        p_instagram: form.instagram || null,
      });
      if (err) throw new Error(err.message);
      const res = rpc as { ok: boolean; error?: string; attendee_id?: string; checkin_code?: string; updated?: boolean };
      if (!res?.ok) { setError(res?.error ?? 'Nao consegui salvar, tente de novo'); return; }

      // scrap Instagram em background (nao trava a tela de sucesso)
      if (form.instagram.trim() && res.attendee_id) {
        void scrapInstagram(res.attendee_id, form.instagram, form.name);
      }
      setDone({ checkin_code: res.checkin_code ?? '', updated: res.updated ?? false });
    } catch (err: any) {
      setError(err.message ?? 'Erro ao cadastrar');
    } finally {
      setSubmitting(false);
    }
  }

  const qrUrl = useMemo(() => {
    if (!done?.checkin_code) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('CK:' + done.checkin_code)}`;
  }, [done]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">Carregando...</div>;
  }

  if (error && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6 text-center">
        <p className="text-zinc-300">{error}</p>
      </div>
    );
  }

  // tela de sucesso com QR pessoal
  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {done.updated ? 'Tudo certo, dados atualizados!' : 'Inscricao confirmada!'}
          </h1>
          <p className="text-zinc-400 text-sm mb-6">
            {form.name.split(' ')[0]}, voce esta na lista de <strong>{event?.title}</strong>.
          </p>
          {qrUrl && (
            <div className="bg-white rounded-2xl p-4 inline-block mb-4">
              <img src={qrUrl} alt="QR de credenciamento" width={220} height={220} />
            </div>
          )}
          <p className="text-sm text-amber-300 font-medium mb-1">Mostre este QR no credenciamento</p>
          <p className="text-xs text-zinc-500">
            Tire um print desta tela. No dia, e so apresentar pra entrar rapido.
          </p>
        </div>
      </div>
    );
  }

  // formulario
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-md mx-auto pt-6">
        <p className="text-xs uppercase tracking-widest text-amber-400 mb-2">Inscricao</p>
        <h1 className="text-2xl font-bold leading-tight mb-1">{event?.title}</h1>
        {event && (
          <p className="text-sm text-zinc-400 mb-1 capitalize">{formatScheduledLong(event.scheduled_at)}</p>
        )}
        {isPresencial && event?.venue_name && (
          <p className="text-sm text-zinc-400 mb-5">
            {[event.venue_name, event.venue_address].filter(Boolean).join(', ')}
          </p>
        )}

        {!enabled ? (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 mt-6 text-center text-zinc-400">
            As inscricoes para este evento estao encerradas.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <p className="text-sm text-zinc-400 -mt-2 mb-2">
              Preencha seus dados pra garantir seu credenciamento:
            </p>

            <Field label="Nome completo *" value={form.name} onChange={set('name')} placeholder="Seu nome" autoFocus />
            <Field label="WhatsApp *" value={form.whatsapp} onChange={set('whatsapp')} placeholder="(11) 99999-9999" inputMode="tel" />
            <Field label="E-mail" value={form.email} onChange={set('email')} placeholder="voce@email.com" type="email" inputMode="email" />
            <Field label="CPF" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" inputMode="numeric" />
            <Field label="Instagram" value={form.instagram} onChange={set('instagram')} placeholder="@seu_usuario" />

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-amber-500 text-zinc-950 font-semibold py-4 hover:bg-amber-400 disabled:opacity-50 transition"
            >
              {submitting ? 'Enviando...' : 'Confirmar inscricao'}
            </button>
            <p className="text-[11px] text-zinc-600 text-center">
              Seus dados sao usados apenas para o credenciamento e contato da + que Vencedores.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label, ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400 mb-1 block">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
      />
    </label>
  );
}
