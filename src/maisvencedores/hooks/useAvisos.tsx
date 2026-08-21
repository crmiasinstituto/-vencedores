import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Aviso {
  id: string;
  title: string;
  content: string;
  announcement_type: string;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  is_popup: boolean;
  priority: number;
  ends_at: string | null;
}

/**
 * Avisos que ESTE membro deve ver agora.
 *
 * A regra (janela de datas, faixa alvo, quantas vezes já viu) mora na RPC `avisos_para_mim`,
 * não aqui: se ficasse na tela, cada lugar que lista aviso teria que repetir a mesma lógica —
 * e o dia em que uma delas divergisse, um aviso vencido voltaria a aparecer.
 */
export function useAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    try {
      const { data, error } = await supabase.rpc('avisos_para_mim');
      if (error) throw error;
      setAvisos((data as Aviso[]) || []);
    } catch {
      setAvisos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  /** Registra que o membro viu — é o que impede o popup de voltar a cada F5. */
  const marcarVisto = async (id: string) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
    try {
      await supabase.rpc('marcar_aviso_visto', { p_announcement: id });
    } catch { /* se falhar, o popup só reaparece na próxima sessão */ }
  };

  return { avisos, popups: avisos.filter((a) => a.is_popup), loading, marcarVisto, recarregar: carregar };
}
