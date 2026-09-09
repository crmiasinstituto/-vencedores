import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;

export type TipoResposta = 'audio' | 'text' | 'image' | 'video' | 'document';

export interface RespostaAutomatica {
  id: string;
  nome: string;
  gatilho: string;
  instance_id: string | null;
  tipo: TipoResposta;
  media_url: string | null;
  mensagem: string | null;
  delay_segundos: number;
  is_active: boolean;
  total_enviados: number;
  created_at: string;
  updated_at: string;
}

export const useRespostasAutomaticas = () =>
  useQuery({
    queryKey: ['respostas-automaticas'],
    queryFn: async () => {
      const { data, error } = await db
        .from('wa_respostas_automaticas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RespostaAutomatica[];
    },
  });

/**
 * Os botões que existem nos templates aprovados — viram sugestão de gatilho.
 * Digitar o texto do botão à mão é a forma mais fácil de a regra nunca disparar.
 */
export const useBotoesDosTemplates = () =>
  useQuery({
    queryKey: ['botoes-dos-templates'],
    queryFn: async () => {
      const { data, error } = await db
        .from('whatsapp_cloud_templates')
        .select('name, status, components')
        .eq('status', 'APPROVED');
      if (error) throw error;

      const mapa = new Map<string, string[]>();
      for (const t of (data || []) as any[]) {
        const grupo = (t.components || []).find((c: any) => c.type === 'BUTTONS');
        for (const b of grupo?.buttons || []) {
          if (b.type !== 'QUICK_REPLY' || !b.text) continue;
          const usos = mapa.get(b.text) || [];
          usos.push(t.name);
          mapa.set(b.text, usos);
        }
      }
      return Array.from(mapa, ([texto, templates]) => ({ texto, templates }))
        .sort((a, b) => b.templates.length - a.templates.length);
    },
  });

export const useRespostasLog = (regraId?: string) =>
  useQuery({
    queryKey: ['respostas-automaticas-log', regraId],
    queryFn: async () => {
      let q = db
        .from('wa_respostas_automaticas_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (regraId) q = q.eq('regra_id', regraId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

export const useSalvarRespostaAutomatica = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RespostaAutomatica> & { id?: string }) => {
      const { id, ...payload } = input;
      const q = id
        ? db.from('wa_respostas_automaticas').update(payload).eq('id', id)
        : db.from('wa_respostas_automaticas').insert(payload);
      const { data, error } = await q.select().single();
      if (error) throw error;
      return data as RespostaAutomatica;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['respostas-automaticas'] });
      toast.success('Resposta automática salva');
    },
    onError: (e: any) => toast.error(e.message || 'Não consegui salvar'),
  });
};

export const useRemoverRespostaAutomatica = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('wa_respostas_automaticas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['respostas-automaticas'] });
      toast.success('Removida');
    },
  });
};
