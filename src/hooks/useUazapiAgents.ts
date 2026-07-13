import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgentSkill {
  title: string;
  content: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  persona: string;
  skills: AgentSkill[];
  productInfo: string;
  restrictions: string;
  provider: string;
  model: string;
  apikey?: string;
  basePrompt: string;
  temperature: number;
  maxTokens: number;
  diversityLevel: number;
  frequencyPenalty: number;
  presencePenalty: number;
  signMessages: boolean;
  readMessages: boolean;
  maxMessageLength: number;
  typingDelay_seconds: number;
  contextTimeWindow_hours: number;
  contextMaxMessages: number;
  contextMinMessages: number;
  active?: boolean;
  igFollowupEnabled?: boolean;
  igFollowupDelayMin?: number;
  igFollowupContext?: string;
}

export interface Trigger {
  id: string;
  active: boolean;
  type: string;
  agent_id: string;
  ignoreGroups: boolean;
  lead_field?: string;
  lead_operator?: string;
  lead_value?: string;
  priority: number;
  wordsToStart: string;
  responseDelay_seconds: number;
}

export interface Knowledge {
  id: string;
  active: boolean;
  tittle: string;
  content: string;
  fileType?: string;
}

export interface AgentFunction {
  id: string;
  name: string;
  active: boolean;
  description: string;
  method: string;
  endpoint: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  parameters: FunctionParameter[];
}

export interface FunctionParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  enum?: string;
  minimum?: number;
  maximum?: number;
}

async function callProxy(action: string, instanceId: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
    body: { action, instance_id: instanceId, ...params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Proxy error');
  return data.data;
}

export function useUazapiAgents(instanceId: string | null) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const withLoading = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    if (!instanceId) {
      toast({ title: 'Erro', description: 'Nenhuma instância WhatsApp conectada', variant: 'destructive' });
      return null;
    }
    setLoading(true);
    try {
      return await fn();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [instanceId, toast]);

  const listAgents = useCallback(() => withLoading(() => callProxy('agent_list', instanceId!)), [withLoading, instanceId]);

  const saveAgent = useCallback((agent: Partial<Agent>, agentId?: string) =>
    withLoading(() => callProxy('agent_edit', instanceId!, { agent_id: agentId || '', agent })), [withLoading, instanceId]);

  const deleteAgent = useCallback((agentId: string) =>
    withLoading(() => callProxy('agent_edit', instanceId!, { agent_id: agentId, delete: true })), [withLoading, instanceId]);

  const listTriggers = useCallback(() => withLoading(() => callProxy('trigger_list', instanceId!)), [withLoading, instanceId]);

  const saveTrigger = useCallback((trigger: Partial<Trigger>, triggerId?: string) =>
    withLoading(() => callProxy('trigger_edit', instanceId!, { trigger_id: triggerId || '', trigger })), [withLoading, instanceId]);

  const deleteTrigger = useCallback((triggerId: string) =>
    withLoading(() => callProxy('trigger_edit', instanceId!, { trigger_id: triggerId, delete: true })), [withLoading, instanceId]);

  const listKnowledge = useCallback(() => withLoading(() => callProxy('knowledge_list', instanceId!)), [withLoading, instanceId]);

  const saveKnowledge = useCallback((knowledge: Partial<Knowledge>, knowledgeId?: string) =>
    withLoading(() => callProxy('knowledge_edit', instanceId!, { knowledge_id: knowledgeId || '', knowledge })), [withLoading, instanceId]);

  const deleteKnowledge = useCallback((knowledgeId: string) =>
    withLoading(() => callProxy('knowledge_edit', instanceId!, { knowledge_id: knowledgeId, delete: true })), [withLoading, instanceId]);

  const listFunctions = useCallback(() => withLoading(() => callProxy('function_list', instanceId!)), [withLoading, instanceId]);

  const saveFunction = useCallback((fn: Partial<AgentFunction>, fnId?: string) =>
    withLoading(() => callProxy('function_edit', instanceId!, { function_id: fnId || '', function_data: fn })), [withLoading, instanceId]);

  const deleteFunction = useCallback((fnId: string) =>
    withLoading(() => callProxy('function_edit', instanceId!, { function_id: fnId, delete: true })), [withLoading, instanceId]);

  const updateChatbotSettings = useCallback((settings: Record<string, unknown>) =>
    withLoading(() => callProxy('update_chatbot_settings', instanceId!, { settings })), [withLoading, instanceId]);

  return {
    loading,
    listAgents, saveAgent, deleteAgent,
    listTriggers, saveTrigger, deleteTrigger,
    listKnowledge, saveKnowledge, deleteKnowledge,
    listFunctions, saveFunction, deleteFunction,
    updateChatbotSettings,
  };
}
