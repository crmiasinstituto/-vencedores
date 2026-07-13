/**
 * AdminCredenciamento
 *
 * /admin/credenciamento
 *
 * Controle proprio de inscritos e credenciamento, fora da campanha de Eventos
 * Coletivos. Escolhe o evento no topo e gerencia a lista (compradores, cortesias,
 * auto-cadastro via QR, check-in). Reaproveita EventAttendeesPanel.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import EventAttendeesPanel from '@/components/marketing/EventAttendeesPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Loader2, UserCheck, Calendar, ScanLine } from 'lucide-react';

interface EventOpt {
  id: string;
  title: string;
  scheduled_at: string;
  event_format: string;
  status: string;
  public_signup_token: string | null;
}

export default function AdminCredenciamento() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('collective_events')
        .select('id, title, scheduled_at, event_format, status, public_signup_token')
        .order('scheduled_at', { ascending: false });
      const rows = (data as EventOpt[]) ?? [];
      setEvents(rows);
      if (rows.length) setSelectedId(rows[0].id);
      setLoading(false);
    })();
  }, []);

  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-amber-500" /> Credenciamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle de inscritos por evento: compradores, cortesias, auto-cadastro via QR e check-in na portaria.
        </p>
      </div>

      {selectedId && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5"><ScanLine className="w-4 h-4 text-amber-500" /> Modo Portaria</p>
              <p className="text-xs text-muted-foreground">Tela de celular pro time credenciar na porta, com leitor de QR. Abra no telefone (já logado).</p>
            </div>
            <Button onClick={() => navigate(`/admin/credenciar/${selectedId}`)} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
              <ScanLine className="w-4 h-4 mr-1.5" /> Abrir Modo Portaria
            </Button>
          </CardContent>
        </Card>
      )}

      {events.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Nenhum evento cadastrado ainda. Crie um evento em Eventos Coletivos primeiro.
        </CardContent></Card>
      ) : (
        <>
          {/* Seletor de evento */}
          <Card>
            <CardContent className="p-4">
              <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Evento
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {new Date(e.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {selected && (
            <EventAttendeesPanel key={selected.id} eventId={selected.id} signupToken={selected.public_signup_token} />
          )}
        </>
      )}
    </div>
  );
}
