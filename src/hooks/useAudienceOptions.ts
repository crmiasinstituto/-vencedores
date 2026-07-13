// Hook que carrega opções pra filtrar audiência: boards, columns, sources, tags distintas
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Board { id: string; name: string; }
export interface Column { id: string; name: string; board_id: string; sort_order: number | null; }
export interface AudienceOptions {
  boards: Board[];
  columnsByBoard: Map<string, Column[]>;
  allColumns: Column[];
  sources: string[];
  tags: string[];
  assignedTo: string[];
}

export function useAudienceOptions() {
  return useQuery({
    queryKey: ['audience-options'],
    queryFn: async (): Promise<AudienceOptions> => {
      const [boardsRes, columnsRes, leadsRes] = await Promise.all([
        supabase.from('crm_boards').select('id, name').order('name'),
        supabase.from('crm_columns').select('id, name, board_id, sort_order').order('sort_order'),
        supabase
          .from('crm_leads')
          .select('source, tags, assigned_to')
          .not('email', 'is', null)
          .neq('email', '')
          .limit(5000),
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

      const sourcesSet = new Set<string>();
      const tagsSet = new Set<string>();
      const assignedSet = new Set<string>();
      for (const l of (leadsRes.data || []) as any[]) {
        if (l.source) sourcesSet.add(l.source);
        if (Array.isArray(l.tags)) l.tags.forEach((t: string) => t && tagsSet.add(t));
        if (l.assigned_to) assignedSet.add(l.assigned_to);
      }

      return {
        boards,
        columnsByBoard,
        allColumns,
        sources: Array.from(sourcesSet).sort(),
        tags: Array.from(tagsSet).sort(),
        assignedTo: Array.from(assignedSet).sort(),
      };
    },
    staleTime: 60_000, // 1 min
  });
}
