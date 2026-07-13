// Stub: pacote Marketing usa "pipeline_stages" (modelo antigo). + que Vencedores usa kanban
// (crm_boards + crm_columns). Esta versão lista boards e columns como "stages" simulados.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PipelineStage {
  id: string;
  name: string;
  pipeline_id: string | null;
  position: number;
}

export function usePipelineConfig() {
  return useQuery({
    queryKey: ['pipeline-config-boards'],
    queryFn: async () => {
      const { data: boards } = await supabase
        .from('crm_boards')
        .select('id, name')
        .order('name');
      const { data: columns } = await supabase
        .from('crm_columns')
        .select('id, name, board_id, sort_order')
        .order('sort_order');
      const stages: PipelineStage[] = (columns || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        pipeline_id: c.board_id,
        position: c.sort_order || 0,
      }));
      return { boards: boards || [], stages };
    },
  });
}

export default usePipelineConfig;
