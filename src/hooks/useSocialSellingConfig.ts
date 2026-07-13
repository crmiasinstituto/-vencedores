import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EDGE = 'social-selling-config-api';

async function callEdge(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke(EDGE, {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || `Falha ao chamar ${action}`);
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface SocialSellingLimits {
  score_min: number;
  chunk_size: number;
  total_actions_per_day: number;
  dms_per_day: number;
  comments_per_day: number;
  likes_per_day: number;
  working_hours_start: string;
  working_hours_end: string;
  pause_weekends: boolean;
  delay_min_seconds: number;
  delay_max_seconds: number;
  min_minutes_between_actions_same_lead: number;
  random_skip_pct: number;
}

export interface SocialSellingTone {
  description: string;
  sample_messages: string;
  forbidden_words: string;
}

export type PromptKey =
  | 'qualificacao'
  | 'comentar_post'
  | 'responder_story'
  | 'enviar_dm'
  | 'followup_story';

const PROMPT_KEYS: PromptKey[] = [
  'qualificacao',
  'comentar_post',
  'responder_story',
  'enviar_dm',
  'followup_story',
];

export interface Automation {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  cadence_config: { days?: Array<{ day: number; label?: string; actions: Array<{ type: string; count?: number }> }> };
  created_at: string;
}

export interface BoardOption {
  id: string;
  name: string;
  slug?: string;
  stages: { id: string; name: string; position?: number; color?: string }[];
}

export function useSocialSellingConfig() {
  const [limits, setLimits] = useState<SocialSellingLimits | null>(null);
  const [tone, setTone] = useState<SocialSellingTone | null>(null);
  const [prompts, setPrompts] = useState<Record<PromptKey, string>>({
    qualificacao: '',
    comentar_post: '',
    responder_story: '',
    enviar_dm: '',
    followup_story: '',
  });
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [limRes, toneRes, autoRes, boardsRes, ...promptRes] = await Promise.all([
        callEdge('get_config', { key: 'social_selling_limits' }),
        callEdge('get_config', { key: 'social_selling_tone' }),
        callEdge('list_automations'),
        callEdge('list_pipelines'),
        ...PROMPT_KEYS.map((k) => callEdge('get_config', { key: `social_selling_prompt_${k}` })),
      ]);
      setLimits(limRes?.value || null);
      setTone(toneRes?.value || null);
      const next: Record<PromptKey, string> = {
        qualificacao: '',
        comentar_post: '',
        responder_story: '',
        enviar_dm: '',
        followup_story: '',
      };
      promptRes.forEach((r, i) => {
        next[PROMPT_KEYS[i]] = typeof r?.value === 'string' ? r.value : '';
      });
      setPrompts(next);
      setAutomations(autoRes?.automations || []);
      setBoards(boardsRes?.boards || boardsRes?.pipelines || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar';
      setError(msg);
      toast.error(`Falha ao carregar configurações: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveLimits = useCallback(async (next: SocialSellingLimits) => {
    setSaving(true);
    try {
      await callEdge('set_config', { key: 'social_selling_limits', value: next });
      setLimits(next);
      toast.success('Limites salvos');
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveTone = useCallback(async (next: SocialSellingTone) => {
    setSaving(true);
    try {
      await callEdge('set_config', { key: 'social_selling_tone', value: next });
      setTone(next);
      toast.success('Tom de voz salvo');
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const savePrompt = useCallback(async (key: PromptKey, value: string) => {
    setSaving(true);
    try {
      await callEdge('set_config', { key: `social_selling_prompt_${key}`, value });
      setPrompts((prev) => ({ ...prev, [key]: value }));
      toast.success('Prompt salvo');
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleAutomation = useCallback(async (id: string, is_active: boolean) => {
    setSaving(true);
    try {
      await callEdge('update_automation', { id, patch: { is_active } });
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, is_active } : a)));
      toast.success(is_active ? 'Cadência ativada' : 'Cadência pausada');
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setSaving(false);
    }
  }, []);

  const updateAutomation = useCallback(async (id: string, patch: Partial<Automation>) => {
    setSaving(true);
    try {
      await callEdge('update_automation', { id, patch });
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      toast.success('Cadência atualizada');
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const createAutomation = useCallback(async (automation: Partial<Automation>) => {
    setSaving(true);
    try {
      const res = await callEdge('create_automation', { automation });
      toast.success('Cadência criada');
      await reload();
      return res?.id as string | undefined;
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [reload]);

  return {
    limits,
    tone,
    prompts,
    automations,
    boards,
    loading,
    saving,
    error,
    reload,
    saveLimits,
    saveTone,
    savePrompt,
    toggleAutomation,
    updateAutomation,
    createAutomation,
  };
}
