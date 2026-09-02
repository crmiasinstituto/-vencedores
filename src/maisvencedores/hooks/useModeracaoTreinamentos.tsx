import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Faixa } from '@/maisvencedores/types/member';

const db = supabase as any;

export interface TreinamentoPendente {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration: string | null;
  faixa_minima: Faixa;
  category_id: string | null;
  categoria: string | null;
  created_at: string;
  created_by: string | null;
  autor_nome: string | null;
  autor_faixa: Faixa | null;
}

/** A fila de aprovação. Só admin recebe linhas — a RPC filtra no servidor. */
export function useTreinamentosPendentes() {
  const [pendentes, setPendentes] = useState<TreinamentoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [moderando, setModerando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.rpc('trainings_pendentes');
    if (error) {
      console.error('Erro ao carregar fila de moderação:', error);
      setPendentes([]);
    } else {
      setPendentes((data || []) as TreinamentoPendente[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const moderar = useCallback(
    async (id: string, aprovar: boolean, motivo?: string) => {
      setModerando(id);
      const { error } = await db.rpc('moderar_treinamento', {
        p_id: id,
        p_aprovar: aprovar,
        p_motivo: motivo || null,
      });
      setModerando(null);
      if (error) {
        toast.error(error.message || 'Não consegui concluir');
        return false;
      }
      toast.success(aprovar ? 'Treinamento publicado' : 'Treinamento recusado');
      await carregar();
      return true;
    },
    [carregar],
  );

  return { pendentes, loading, moderando, moderar, refetch: carregar };
}

/** Só o número, para o badge do menu. */
export function usePendentesCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await db.rpc('trainings_pendentes_count');
      if (vivo) setCount(Number(data) || 0);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return count;
}
