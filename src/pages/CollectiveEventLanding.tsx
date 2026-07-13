import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type AttendanceMode = 'pending' | 'online' | 'presencial' | 'waitlist';

interface InviteData {
  invite: {
    id: string;
    token: string;
    attendance_mode: AttendanceMode;
    rsvp_at: string | null;
    joined_at: string | null;
    checkin_qr_payload: string | null;
  };
  event: {
    id: string;
    title: string;
    description: string | null;
    event_format: 'online' | 'presencial' | 'hybrid';
    scheduled_at: string;
    duration_minutes: number;
    venue_name: string | null;
    venue_address: string | null;
    venue_complement: string | null;
    venue_map_url: string | null;
    venue_lat: number | null;
    venue_lng: number | null;
    whatsapp_group_url: string | null;
    whatsapp_group_label: string | null;
    status: string;
  };
  lead: {
    id: string;
    name: string | null;
    first_name: string | null;
  };
  room: {
    id: string;
    room_name: string;
    attendance_mode: string;
    shard_index: number;
  } | null;
}

function useCountdown(targetIso: string | undefined) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!targetIso) return { ms: 0, days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  const ms = Math.max(0, new Date(targetIso).getTime() - now);
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000) % 24;
  const days = Math.floor(ms / 86400000);
  return { ms, days, hours, minutes, seconds, past: ms <= 0 };
}

function formatScheduledLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildIcsDownloadUrl(data: InviteData): string {
  const evt = data.event;
  const start = new Date(evt.scheduled_at);
  const end = new Date(start.getTime() + evt.duration_minutes * 60_000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const location =
    evt.event_format === 'online'
      ? `Sala + que Vencedores: ${window.location.origin}/r/${data.invite.token}`
      : [evt.venue_name, evt.venue_address, evt.venue_complement].filter(Boolean).join(', ');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//+ que Vencedores//Evento//PT',
    'BEGIN:VEVENT',
    `UID:${data.invite.id}@squaad.com.br`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${evt.title}`,
    `DESCRIPTION:${(evt.description ?? '').replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
}

export default function CollectiveEventLanding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpFlash, setRsvpFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      const { data: rpc, error: err } = await (supabase.rpc as any)('resolve_collective_invite', {
        p_token: token,
      });
      if (!alive) return;
      if (err) {
        setError(err.message);
      } else if ((rpc as any)?.error) {
        setError((rpc as any).error);
      } else {
        setData(rpc as unknown as InviteData);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const countdown = useCountdown(data?.event.scheduled_at);
  const canEnterRoom = useMemo(() => {
    if (!data) return false;
    return countdown.ms <= 15 * 60_000;
  }, [countdown, data]);

  async function handleRsvp(mode: 'online' | 'presencial') {
    if (!token) return;
    setRsvpLoading(true);
    setRsvpFlash(null);
    const { data: rpc, error: err } = await (supabase.rpc as any)('confirm_collective_rsvp', {
      p_token: token,
      p_attendance_mode: mode,
    });
    setRsvpLoading(false);
    if (err) {
      setRsvpFlash(err.message);
      return;
    }
    const r = rpc as any;
    if (r?.error) {
      setRsvpFlash(r.error);
      return;
    }
    if (r?.status === 'overflow_to_online') {
      setRsvpFlash('Capacidade presencial cheia, sua vaga foi reservada no online.');
    } else if (r?.status === 'waitlist') {
      setRsvpFlash('Você está na lista de espera.');
    } else if (r?.status === 'confirmed') {
      setRsvpFlash(`Presença confirmada como ${r.mode}.`);
    }
    // Reload
    const { data: refreshed } = await (supabase.rpc as any)('resolve_collective_invite', {
      p_token: token,
    });
    setData(refreshed as unknown as InviteData);
  }

  async function handleEnterRoom() {
    if (!data?.room) return;
    navigate(`/meet/${data.room.room_name}?lead=${data.lead.id}&token=${data.invite.token}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <p>Carregando seu convite...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-2">Convite inválido</h1>
          <p className="text-zinc-400">
            {error === 'invite_not_found'
              ? 'Esse link não está mais ativo. Confira com quem te convidou.'
              : 'Não conseguimos carregar esse convite agora. Tente em alguns minutos.'}
          </p>
        </div>
      </div>
    );
  }

  const evt = data.event;
  const isHybridUnchosen = evt.event_format === 'hybrid' && data.invite.attendance_mode === 'pending';
  const isOnline =
    evt.event_format === 'online' ||
    (evt.event_format === 'hybrid' && data.invite.attendance_mode === 'online');
  const isPresencial =
    evt.event_format === 'presencial' ||
    (evt.event_format === 'hybrid' && data.invite.attendance_mode === 'presencial');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-2xl mx-auto pt-12">
        <p className="text-sm uppercase tracking-widest text-amber-400 mb-2">
          + que Vencedores, você no controle
        </p>
        <h1 className="text-4xl font-bold mb-3">{evt.title}</h1>
        {evt.description && (
          <p className="text-zinc-300 leading-relaxed mb-6 whitespace-pre-line">{evt.description}</p>
        )}

        <div className="rounded-2xl bg-zinc-900 p-6 mb-6 border border-zinc-800">
          <p className="text-zinc-400 text-sm mb-1">Quando</p>
          <p className="text-xl font-semibold capitalize mb-4">{formatScheduledLong(evt.scheduled_at)}</p>

          <p className="text-zinc-400 text-sm mb-1">Local</p>
          <p className="text-xl font-semibold mb-2">
            {evt.event_format === 'online' && 'Online via sala + que Vencedores'}
            {evt.event_format === 'presencial' && (evt.venue_name ?? evt.venue_address)}
            {evt.event_format === 'hybrid' && 'Presencial ou online (sua escolha)'}
          </p>
          {evt.venue_address && (
            <p className="text-zinc-300">
              {evt.venue_address}
              {evt.venue_complement ? `, ${evt.venue_complement}` : ''}
            </p>
          )}
        </div>

        {!countdown.past && (
          <div className="flex gap-2 text-center mb-6">
            <CountdownBox label="Dias" value={countdown.days} />
            <CountdownBox label="Horas" value={countdown.hours} />
            <CountdownBox label="Min" value={countdown.minutes} />
            <CountdownBox label="Seg" value={countdown.seconds} />
          </div>
        )}

        {rsvpFlash && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-3 mb-4">
            {rsvpFlash}
          </div>
        )}

        {isHybridUnchosen && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => handleRsvp('presencial')}
              disabled={rsvpLoading}
              className="rounded-xl bg-amber-500 text-zinc-950 font-semibold py-4 hover:bg-amber-400 disabled:opacity-50"
            >
              Vou presencial
            </button>
            <button
              onClick={() => handleRsvp('online')}
              disabled={rsvpLoading}
              className="rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-semibold py-4 hover:bg-zinc-700 disabled:opacity-50"
            >
              Vou pelo online
            </button>
          </div>
        )}

        {!isHybridUnchosen && data.invite.attendance_mode === 'pending' && (
          <button
            onClick={() => handleRsvp(evt.event_format === 'presencial' ? 'presencial' : 'online')}
            disabled={rsvpLoading}
            className="w-full rounded-xl bg-amber-500 text-zinc-950 font-semibold py-4 mb-6 hover:bg-amber-400 disabled:opacity-50"
          >
            Confirmar presença
          </button>
        )}

        {isOnline && data.invite.attendance_mode !== 'pending' && (
          <button
            onClick={handleEnterRoom}
            disabled={!canEnterRoom}
            className="w-full rounded-xl bg-amber-500 text-zinc-950 font-semibold py-4 mb-4 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {canEnterRoom ? 'Entrar na sala' : `Sala abre 15 min antes`}
          </button>
        )}

        {isPresencial && data.invite.attendance_mode !== 'pending' && (
          <div className="space-y-3 mb-4">
            {evt.venue_map_url && (
              <a
                href={evt.venue_map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center rounded-xl bg-amber-500 text-zinc-950 font-semibold py-4 hover:bg-amber-400"
              >
                Como chegar
              </a>
            )}
            {data.invite.checkin_qr_payload && (
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6 text-center">
                <p className="text-zinc-400 text-sm mb-3">Seu QR pessoal pra check-in</p>
                <img
                  alt="QR check-in"
                  className="mx-auto rounded"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    data.invite.checkin_qr_payload,
                  )}`}
                />
                <p className="text-xs text-zinc-500 mt-3 font-mono">
                  {data.invite.checkin_qr_payload.slice(0, 24)}…
                </p>
              </div>
            )}
          </div>
        )}

        {data.invite.attendance_mode !== 'pending' && evt.whatsapp_group_url && (
          <a
            href={evt.whatsapp_group_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center rounded-xl bg-emerald-500 text-zinc-950 font-semibold py-4 mb-3 hover:bg-emerald-400"
          >
            {evt.whatsapp_group_label || 'Entrar no Grupo Exclusivo'}
          </a>
        )}

        {data.invite.attendance_mode !== 'pending' && (
          <a
            href={buildIcsDownloadUrl(data)}
            download={`${evt.title}.ics`}
            className="block w-full text-center rounded-xl border border-zinc-700 text-zinc-200 py-3 hover:bg-zinc-900"
          >
            Adicionar à minha agenda
          </a>
        )}

        <p className="text-center text-xs text-zinc-500 mt-8">
          + que Vencedores, você no controle da sua jornada.
        </p>
      </div>
    </div>
  );
}

function CountdownBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 py-4">
      <p className="text-3xl font-bold text-amber-400 tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
