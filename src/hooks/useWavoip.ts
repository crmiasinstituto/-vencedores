import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WavoipDevice {
  id: string;
  user_id: string;
  token: string;
  name: string;
  phone_number: string | null;
  status: string;
  is_active: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface CallRecord {
  id: string;
  wavoip_device_id: string | null;
  wavoip_call_id: string | null;
  user_id: string;
  lead_id: string | null;
  direction: string;
  status: string;
  peer_phone: string;
  peer_name: string | null;
  duration_seconds: number;
  transcription: string | null;
  transcriptions: any[];
  ai_summary: string | null;
  ai_sentiment: string | null;
  ai_key_points: any[];
  ai_suggested_tasks: any[];
  started_at: string;
  ended_at: string | null;
  metadata: any;
  created_at: string;
  lead?: { name: string; whatsapp: string; instagram_profile_pic_url: string | null } | null;
}

export function useWavoipDevice(userId: string | undefined) {
  return useQuery({
    queryKey: ['wavoip-device', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('wavoip_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as WavoipDevice | null;
    },
    enabled: !!userId,
  });
}

export function useCreateWavoipDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (device: { user_id: string; token: string; name?: string }) => {
      const { data, error } = await supabase
        .from('wavoip_devices')
        .insert(device)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wavoip-device'] }),
  });
}

export function useUpdateWavoipDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('wavoip_devices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wavoip-device'] }),
  });
}

export function useDeleteWavoipDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wavoip_devices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wavoip-device'] }),
  });
}

export function useCallHistory(filters?: { userId?: string; leadId?: string; limit?: number }) {
  return useQuery({
    queryKey: ['call-history', filters],
    queryFn: async () => {
      let query = supabase
        .from('call_history')
        .select('*, crm_leads(name, whatsapp, instagram_profile_pic_url)')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50);
      if (filters?.userId) query = query.eq('user_id', filters.userId);
      if (filters?.leadId) query = query.eq('lead_id', filters.leadId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, lead: r.crm_leads })) as CallRecord[];
    },
  });
}

// Helpers
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getCallStatusLabel(status: string): string {
  const map: Record<string, string> = {
    CALLING: 'Chamando',
    RINGING: 'Tocando',
    ACTIVE: 'Em chamada',
    ENDED: 'Encerrada',
    REJECTED: 'Rejeitada',
    NOT_ANSWERED: 'Não atendida',
    FAILED: 'Falhou',
  };
  return map[status] || status;
}

export function getSentimentColor(sentiment: string | null): string {
  if (sentiment === 'positive') return 'text-green-400';
  if (sentiment === 'negative') return 'text-red-400';
  return 'text-yellow-400';
}

export function getSentimentLabel(sentiment: string | null): string {
  if (sentiment === 'positive') return 'Positivo';
  if (sentiment === 'negative') return 'Negativo';
  return 'Neutro';
}
