import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AutomationStats {
  automation_id: string;
  entraram: number;
  em_andamento: number;
  concluidos: number;
  falharam: number;
  emails_enviados: number;
  emails_entregues: number;
  emails_abertos: number;
  emails_clicados: number;
  emails_falhas: number;
  whatsapp_enviados: number;
  whatsapp_entregues: number;
  whatsapp_lidos: number;
  whatsapp_falhas: number;
  ultimo_envio: string | null;
}

/** Números de todos os fluxos, indexados pelo id da automação. */
export function useAutomationStats() {
  return useQuery({
    queryKey: ['automation-stats'],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Record<string, AutomationStats>> => {
      const { data, error } = await supabase.rpc('automation_stats' as any);
      if (error) throw error;
      const mapa: Record<string, AutomationStats> = {};
      for (const r of (data as any[]) || []) {
        const n = (v: any) => Number(v || 0);
        mapa[r.automation_id] = {
          ...r,
          entraram: n(r.entraram), em_andamento: n(r.em_andamento), concluidos: n(r.concluidos), falharam: n(r.falharam),
          emails_enviados: n(r.emails_enviados), emails_entregues: n(r.emails_entregues),
          emails_abertos: n(r.emails_abertos), emails_clicados: n(r.emails_clicados), emails_falhas: n(r.emails_falhas),
          whatsapp_enviados: n(r.whatsapp_enviados), whatsapp_entregues: n(r.whatsapp_entregues),
          whatsapp_lidos: n(r.whatsapp_lidos), whatsapp_falhas: n(r.whatsapp_falhas),
        };
      }
      return mapa;
    },
  });
}

export interface AutomationWhatsappRow {
  quando: string;
  lead_id: string | null;
  lead_nome: string | null;
  telefone: string | null;
  status: string;
  conteudo: string | null;
  erro: string | null;
}

export function useAutomationWhatsappLog(automationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['automation-whatsapp-log', automationId],
    enabled: !!automationId && enabled,
    refetchInterval: 30_000,
    queryFn: async (): Promise<AutomationWhatsappRow[]> => {
      const { data, error } = await supabase.rpc('automation_whatsapp_log' as any, {
        p_automation_id: automationId,
        p_limit: 300,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}
