import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// As tabelas de cadencia de grupo sao novas e ainda nao estao no types.ts gerado.
const db = supabase as any;

export type CadenceStatus = 'draft' | 'running' | 'paused' | 'completed';
export type DelayUnit = 'minutos' | 'horas' | 'dias';

export interface GroupCadence {
  id: string;
  name: string;
  description: string | null;
  instance_id: string | null;
  group_jids: string[];
  status: CadenceStatus;
  start_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  window_start: string;
  window_end: string;
  max_per_run: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface GroupCadenceStep {
  id: string;
  cadence_id: string;
  step_order: number;
  delay_value: number;
  delay_unit: DelayUnit;
  send_at_time: string | null;
  message: string;
  media_url: string | null;
  media_type: string | null;
}

export interface WaGroup {
  id: string;
  group_jid: string;
  name: string | null;
  participants_count: number | null;
}

export const useGroupCadences = () =>
  useQuery({
    queryKey: ['group-cadences'],
    queryFn: async () => {
      const { data, error } = await db
        .from('wa_group_cadences')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GroupCadence[];
    },
  });

export const useGroupCadence = (id: string | undefined) =>
  useQuery({
    queryKey: ['group-cadence', id],
    queryFn: async () => {
      const { data, error } = await db.from('wa_group_cadences').select('*').eq('id', id).single();
      if (error) throw error;
      return data as GroupCadence;
    },
    enabled: !!id && id !== 'nova',
  });

export const useGroupCadenceSteps = (cadenceId: string | undefined) =>
  useQuery({
    queryKey: ['group-cadence-steps', cadenceId],
    queryFn: async () => {
      const { data, error } = await db
        .from('wa_group_cadence_steps')
        .select('*')
        .eq('cadence_id', cadenceId)
        .order('step_order');
      if (error) throw error;
      return (data || []) as GroupCadenceStep[];
    },
    enabled: !!cadenceId && cadenceId !== 'nova',
  });

/** Log de envio: o que já foi postado em cada grupo, por passo. */
export const useGroupCadenceSends = (cadenceId: string | undefined) =>
  useQuery({
    queryKey: ['group-cadence-sends', cadenceId],
    queryFn: async () => {
      const { data, error } = await db
        .from('wa_group_cadence_sends')
        .select('*')
        .eq('cadence_id', cadenceId)
        .order('sent_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!cadenceId && cadenceId !== 'nova',
    refetchInterval: 30_000,
  });

export const useWaGroups = () =>
  useQuery({
    queryKey: ['wa-groups-para-cadencia'],
    queryFn: async () => {
      const { data, error } = await db
        .from('whatsapp_groups')
        .select('id, group_jid, name, participants_count')
        .order('participants_count', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as WaGroup[];
    },
  });

export const useSaveGroupCadence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<GroupCadence> & { id?: string }) => {
      const { id, ...payload } = input;
      if (id) {
        const { data, error } = await db
          .from('wa_group_cadences')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as GroupCadence;
      }
      const { data, error } = await db.from('wa_group_cadences').insert(payload).select().single();
      if (error) throw error;
      return data as GroupCadence;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['group-cadences'] });
      qc.invalidateQueries({ queryKey: ['group-cadence', c.id] });
    },
    onError: (e: any) => toast.error(e.message || 'Não consegui salvar a cadência'),
  });
};

/** Salva a sequência inteira de uma vez: apaga o que saiu e regrava a ordem. */
export const useSaveCadenceSteps = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cadenceId, steps }: { cadenceId: string; steps: Partial<GroupCadenceStep>[] }) => {
      const manter = steps.filter((s) => s.id).map((s) => s.id);
      let del = db.from('wa_group_cadence_steps').delete().eq('cadence_id', cadenceId);
      if (manter.length) del = del.not('id', 'in', `(${manter.join(',')})`);
      const { error: delErr } = await del;
      if (delErr) throw delErr;

      const payload = steps.map((s, i) => ({
        id: s.id,
        cadence_id: cadenceId,
        step_order: i + 1,
        delay_value: s.delay_value ?? 0,
        delay_unit: s.delay_unit || 'dias',
        send_at_time: s.send_at_time || null,
        message: s.message || '',
        media_url: s.media_url || null,
        media_type: s.media_type || null,
      }));
      if (!payload.length) return [];

      const { data, error } = await db
        .from('wa_group_cadence_steps')
        .upsert(payload, { onConflict: 'id' })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['group-cadence-steps', v.cadenceId] });
    },
    onError: (e: any) => toast.error(e.message || 'Não consegui salvar os passos'),
  });
};

export const useDeleteGroupCadence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('wa_group_cadences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-cadences'] });
      toast.success('Cadência removida');
    },
  });
};

/** Liga a cadência e já roda o motor uma vez, sem esperar o cron de 5 min. */
export const useStartGroupCadence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.rpc('wa_group_cadence_start', { p_cadence_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['group-cadences'] });
      qc.invalidateQueries({ queryKey: ['group-cadence-sends'] });
      toast.success(
        data?.enviados ? `Cadência iniciada — ${data.enviados} mensagem(ns) na fila` : 'Cadência iniciada',
      );
    },
    onError: (e: any) => toast.error(e.message || 'Não consegui iniciar'),
  });
};

export const useSetCadenceStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CadenceStatus }) => {
      const { error } = await db.from('wa_group_cadences').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-cadences'] }),
  });
};
