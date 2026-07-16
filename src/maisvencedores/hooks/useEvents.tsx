import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Faixa } from '@/maisvencedores/types/member';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  time: string | null;
  type: 'presencial' | 'online';
  location: string | null;
  meetingUrl: string | null;
  totalSpots: number | null;
  spotsRemaining: number | null;
  /** Quem está convidado. Várias faixas por evento — não é faixa mínima. */
  faixasPermitidas: Faixa[];
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
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true });

      if (error) throw error;

      const mapped: Event[] = (data || []).map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: new Date(e.event_date),
        time: e.event_time,
        type: e.event_type,
        location: e.location,
        meetingUrl: e.meeting_url,
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
