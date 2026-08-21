import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Announcement {
  id: string;
  title: string;
  content: string | null;
  type: 'info' | 'warning' | 'success' | 'new_member';
  createdAt: Date;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      // Usa a mesma RPC do popup: ela aplica janela de datas, faixa-alvo e limite de
      // exibições. Lendo a tabela direto (o que era feito aqui) um aviso vencido continuava
      // listado, porque só `is_active` era conferido.
      const { data, error } = await supabase.rpc('avisos_para_mim');

      if (error) throw error;

      const mapped: Announcement[] = (data || []).map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        type: a.announcement_type as Announcement['type'],
        createdAt: new Date(a.created_at || ''),
      }));

      setAnnouncements(mapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  return { announcements, loading, error, refetch: fetchAnnouncements };
}
