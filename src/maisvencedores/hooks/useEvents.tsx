import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Faixa } from '@/maisvencedores/types/member';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  /** Último dia, quando o evento dura mais de um. Null = evento de um dia. */
  endDate: Date | null;
  time: string | null;
  type: 'presencial' | 'online';
  location: string | null;
  meetingUrl: string | null;
  /** Destino do botão "Garantir Vaga". */
  paymentUrl: string | null;
  /** Banner do card. */
  imageUrl: string | null;
  totalSpots: number | null;
  spotsRemaining: number | null;
  /** Quem está convidado. Várias faixas por evento — não é faixa mínima. */
  faixasPermitidas: Faixa[];
}

/**
 * Converte 'YYYY-MM-DD' do Postgres num Date à meia-noite LOCAL.
 *
 * `new Date('2026-09-26')` não serve: o JS trata data-só como UTC, então em Brasília (UTC-3)
 * o objeto nasce em 25/09 21:00 e todo format() exibe o dia anterior. Era exatamente esse o
 * bug de um evento marcado pro dia 26 aparecer como "25 SET" no card.
 */
function dataLocal(iso: string | null): Date | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        // event_date é `date`: compara com 'YYYY-MM-DD', senão o toISOString() manda um
        // timestamp e o evento de hoje some da lista no meio do dia.
        .gte('event_date', new Date().toLocaleDateString('en-CA'))
        .order('event_date', { ascending: true });

      if (error) throw error;

      const mapped: Event[] = (data || []).map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: dataLocal(e.event_date as string)!,
        endDate: dataLocal((e as any).event_end_date),
        time: e.event_time,
        type: e.event_type,
        location: e.location,
        meetingUrl: e.meeting_url,
        paymentUrl: (e as any).payment_url ?? null,
        imageUrl: (e as any).image_url ?? null,
        totalSpots: e.total_spots,
        spotsRemaining: e.spots_remaining,
        faixasPermitidas: e.faixas_permitidas || [],
      }));

      setEvents(mapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return { events, loading, error, refetch: fetchEvents };
}
