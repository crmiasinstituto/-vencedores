import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;

export interface SystemCron {
  key: string;
  source: 'cron';
  /** 'sql' roda direto no banco; 'http' chama uma edge function */
  kind: 'sql' | 'http';
  label: string;
  description: string | null;
  category: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  cron_status: string | null;
  cron_message: string | null;
  /** status HTTP real da última chamada — só existe em job 'http' já instrumentado */
  http_status: number | null;
  http_at: string | null;
  http_body: string | null;
  instrumented: boolean;
  /** a chamada estourou o tempo limite antes de responder */
  timed_out: boolean | null;
  /** respondeu 200 mas com {"ok":false} — falha que o HTTP não denuncia */
  soft_error: boolean;
}

export interface SystemTrigger {
  key: string;
  source: 'trigger';
  label: string;
  description: string | null;
  category: string;
  target_table: string | null;
  active: boolean;
  exists: boolean;
}

export interface SystemAutomations {
  crons: SystemCron[];
  triggers: SystemTrigger[];
  http_errors_24h: number;
}

export const useSystemAutomations = () =>
  useQuery({
    queryKey: ['system-automations'],
    queryFn: async () => {
      const { data, error } = await db.rpc('list_system_automations');
      if (error) throw error;
      return data as SystemAutomations;
    },
    refetchInterval: 60_000,
  });

export const useToggleSystemAutomation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobname, active }: { jobname: string; active: boolean }) => {
      const { data, error } = await db.rpc('toggle_system_automation', {
        p_jobname: jobname,
        p_active: active,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['system-automations'] });
      toast.success(v.active ? 'Automação ligada' : 'Automação pausada');
    },
    onError: (e: any) => toast.error(e.message || 'Não consegui alterar'),
  });
};

// Traduz o cron para português ("a cada 5 minutos").
// Cai no cron cru quando não reconhece o formato.
export function descreverAgenda(cron: string): string {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return cron;
  const [min, hora, diaMes, mes, diaSem] = p;

  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const hhmm = (h: string, m: string) => `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;

  if (min === '*' && hora === '*') return 'a cada minuto';
  if (min.startsWith('*/') && hora === '*') return `a cada ${min.slice(2)} minutos`;
  if (min.startsWith('*/') && hora !== '*') return `a cada ${min.slice(2)} min, das ${hora}h`;
  if (min !== '*' && hora === '*') return `de hora em hora, aos ${min} min`;
  if (min !== '*' && hora.startsWith('*/')) return `a cada ${hora.slice(2)} horas`;
  if (min !== '*' && hora !== '*' && diaSem !== '*' && !diaSem.includes(','))
    return `toda ${DIAS[Number(diaSem)] ?? diaSem}, ${hhmm(hora, min)}`;
  if (min !== '*' && hora !== '*' && diaMes === '*' && mes === '*') return `todo dia às ${hhmm(hora, min)}`;
  return cron;
}

/** Horário do cron é UTC; o time todo lê em Brasília. */
export function agendaEmBrasilia(cron: string): string {
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return descreverAgenda(cron);
  const [min, hora] = p;
  if (hora === '*' || hora.startsWith('*/') || hora.includes(',')) return descreverAgenda(cron);
  const h = Number(hora);
  if (Number.isNaN(h)) return descreverAgenda(cron);
  const local = (h - 3 + 24) % 24;
  return descreverAgenda([min, String(local), p[2], p[3], p[4]].join(' '));
}
