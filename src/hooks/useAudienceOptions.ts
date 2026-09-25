// Hook que carrega opções pra filtrar audiência: boards, columns, sources, tags distintas
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Board { id: string; name: string; }
export interface Column { id: string; name: string; board_id: string; sort_order: number | null; }
export interface TagOption { tag: string; leads: number; com_email: number; }
export interface AudienceOptions {
  boards: Board[];
  columnsByBoard: Map<string, Column[]>;
  allColumns: Column[];
  sources: string[];
  tags: string[];
  tagInfo: Map<string, TagOption>;
  assignedTo: string[];
}

export function useAudienceOptions() {
  return useQuery({
    queryKey: ['audience-options'],
    queryFn: async (): Promise<AudienceOptions> => {
      // As tags/origens/responsáveis vêm de uma RPC porque não dá pra deduzir a lista lendo
      // leads pelo REST: o PostgREST corta em 1000 linhas e são 18 mil leads com e-mail, então
      // toda tag de cauda longa (as de produto da Eduzz, por exemplo) ficava invisível.
      const [boardsRes, columnsRes, opcoesRes] = await Promise.all([
        supabase.from('crm_boards').select('id, name').order('name'),
        supabase.from('crm_columns').select('id, name, board_id, sort_order').order('sort_order'),
        supabase.rpc('opcoes_de_audiencia' as any),
      ]);

      const boards = (boardsRes.data || []) as Board[];
      const allColumns = (columnsRes.data || []) as Column[];
      const columnsByBoard = new Map<string, Column[]>();
      for (const c of allColumns) {
        if (!c.board_id) continue;
        const arr = columnsByBoard.get(c.board_id) || [];
        arr.push(c);
        columnsByBoard.set(c.board_id, arr);
      }

      const opcoes = (opcoesRes.data || {}) as {
        tags?: TagOption[];
        sources?: string[];
        assigned_to?: string[];
      };

      // A RPC já devolve por volume decrescente — a ordem útil pra quem está escolhendo.
      const tagList = (opcoes.tags || []).filter(t => t?.tag);
      const tagInfo = new Map<string, TagOption>(tagList.map(t => [t.tag, t]));

      return {
        boards,
        columnsByBoard,
        allColumns,
        sources: opcoes.sources || [],
        tags: tagList.map(t => t.tag),
        tagInfo,
        assignedTo: opcoes.assigned_to || [],
      };
    },
    staleTime: 60_000, // 1 min
  });
}
