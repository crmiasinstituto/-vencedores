import { useState, useEffect, useCallback } from 'react';
import { Bot } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUazapiAgents, Agent, AgentSkill, Trigger, Knowledge, AgentFunction } from '@/hooks/useUazapiAgents';
import { AgentList } from '@/components/agentes/AgentList';
import { AgentGeneralTab } from '@/components/agentes/AgentGeneralTab';
import { AgentPromptTab } from '@/components/agentes/AgentPromptTab';
import AgentV2Tab from '@/components/agentes/AgentV2Tab';
import { AgentKnowledgeTab } from '@/components/agentes/AgentKnowledgeTab';
import { AgentFunctionsTab } from '@/components/agentes/AgentFunctionsTab';
import { AgentTriggersTab } from '@/components/agentes/AgentTriggersTab';
import { AgentCadenceTab } from '@/components/agentes/AgentCadenceTab';
import { ChatbotSettingsCard } from '@/components/agentes/ChatbotSettingsCard';
import { AgentOnboardingTour } from '@/components/agentes/AgentOnboardingTour';
import { composePrompt } from '@/utils/composeAgentPrompt';

// OpenAI API key vem de:
//   1) integration_keys (via RPC admin-only get_integration_key_full)
//   2) UAZAPI chatbot_settings (override por instância — uazapi-proxy)
// Sem fallback hardcoded. Se nenhum estiver configurado, AgentGeneralTab
// recebe string vazia e admin precisa colar a chave em /admin/configuracoes.

const DEFAULT_AGENT: Agent = {
  id: '', name: '', description: '', persona: '', skills: [], productInfo: '', restrictions: '',
  provider: 'openai', model: 'gpt-4o-mini', apikey: '',
  basePrompt: '', temperature: 70, maxTokens: 2000, diversityLevel: 50,
  frequencyPenalty: 30, presencePenalty: 30, signMessages: true, readMessages: true,
  maxMessageLength: 500, typingDelay_seconds: 3, contextTimeWindow_hours: 24,
  contextMaxMessages: 50, contextMinMessages: 3, active: true,
};

const DEFAULT_CADENCE = {
  maxAttempts: 3, intervalHours: 24,
  messages: [
    'Oi {nome}! Vi que não conseguimos terminar nossa conversa. Posso te ajudar com algo?',
    '{nome}, ainda está interessado? Estou aqui para qualquer dúvida!',
    'Última tentativa, {nome}. Quando tiver um tempinho, estou à disposição! 😊',
  ],
  followUpEnabled: true,
  confirmImmediate: '✅ Reunião agendada para {data} às {hora}. Te espero lá!',
  confirm3Days: 'Oi {nome}! Lembrando da nossa reunião em 3 dias ({data}). Tudo certo?',
  confirm1Day: '{nome}, amanhã temos nossa reunião às {hora}. Posso confirmar?',
  confirm30Min: 'Começamos em 30 min! Está tudo pronto? 🚀',
};

// Save structured fields to Supabase
async function saveAgentConfig(agentId: string, instanceId: string, agent: Agent) {
  const { error } = await supabase
    .from('agent_configs' as any)
    .upsert({
      uazapi_agent_id: agentId,
      instance_id: instanceId,
      description: agent.description || '',
      persona: agent.persona || '',
      skills: agent.skills || [],
      product_info: agent.productInfo || '',
      restrictions: agent.restrictions || '',
      ig_followup_enabled: (agent as any).igFollowupEnabled || false,
      ig_followup_delay_min: (agent as any).igFollowupDelayMin || 60,
      ig_followup_context: (agent as any).igFollowupContext || '',
    }, { onConflict: 'uazapi_agent_id' });
  if (error) console.error('Error saving agent config:', error);
}

// Load structured fields from Supabase
async function loadAgentConfig(agentId: string): Promise<Partial<Agent> | null> {
  const { data, error } = await supabase
    .from('agent_configs' as any)
    .select('*')
    .eq('uazapi_agent_id', agentId)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as any;
  return {
    description: d.description || '',
    persona: d.persona || '',
    skills: (d.skills as AgentSkill[]) || [],
    productInfo: d.product_info || '',
    restrictions: d.restrictions || '',
    igFollowupEnabled: d.ig_followup_enabled || false,
    igFollowupDelayMin: d.ig_followup_delay_min || 60,
    igFollowupContext: d.ig_followup_context || 'Metodo + que Vencedores - Mentoria onde o empresario aprende a construir suas proprias solucoes com IA.',
  };
}

export default function AdminAgentes() {
  const { toast } = useToast();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editAgent, setEditAgent] = useState<Agent>(DEFAULT_AGENT);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [functions, setFunctions] = useState<AgentFunction[]>([]);
  const [cadence, setCadence] = useState(DEFAULT_CADENCE);

  const [globalApiKey, setGlobalApiKey] = useState<string>('');
  const api = useUazapiAgents(instanceId);

  // Load instance
  useEffect(() => {
    // Config do agente: instancia UAZAPI normal (agentes rodam em conversas 1-to-1,
    // nao em canal Cloud API/blast).
    supabase.from('whatsapp_instances').select('id')
      .eq('status', 'connected')
      .eq('provider', 'uazapi')
      .not('is_dedicated_blast', 'is', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setInstanceId(data.id); });
  }, []);

  // Fonte primária: integration_keys (admin allowlist via RPC).
  // RPC SECURITY DEFINER filtra por is_admin(); pra não-admin retorna vazio.
  useEffect(() => {
    (supabase as any).rpc('get_integration_key_full', { p_service: 'openai' }).then(({ data, error }: any) => {
      if (error) {
        console.error('[AdminAgentes] get_integration_key_full openai:', error);
        return;
      }
      const row = Array.isArray(data) ? data[0] : null;
      if (row?.api_key) setGlobalApiKey(row.api_key);
    });
  }, []);

  // Override por instância: UAZAPI pode ter sua própria chave em chatbot_settings.
  useEffect(() => {
    if (!instanceId) return;
    supabase.functions.invoke('uazapi-proxy', {
      body: { action: 'get_chatbot_settings', instance_id: instanceId },
    }).then(({ data }) => {
      if (data?.success && data?.data?.openai_apikey) {
        setGlobalApiKey(data.data.openai_apikey);
      }
    }).catch(console.error);
  }, [instanceId]);

  const loadAgents = useCallback(async () => {
    const data = await api.listAgents();
    if (data) {
      const list = Array.isArray(data) ? data : data.agents || [];
      setAgents(list);
    }
  }, [api.listAgents]);

  const loadTriggers = useCallback(async () => {
    const data = await api.listTriggers();
    if (data) setTriggers(Array.isArray(data) ? data : data.triggers || []);
  }, [api.listTriggers]);

  const loadKnowledge = useCallback(async () => {
    const data = await api.listKnowledge();
    if (data) setKnowledge(Array.isArray(data) ? data : data.knowledge || []);
  }, [api.listKnowledge]);

  const loadFunctions = useCallback(async () => {
    const data = await api.listFunctions();
    if (data) setFunctions(Array.isArray(data) ? data : data.functions || []);
  }, [api.listFunctions]);

  useEffect(() => {
    if (instanceId) { loadAgents(); loadTriggers(); loadKnowledge(); loadFunctions(); }
  }, [instanceId]);

  // When selecting an agent, merge UAZAPI data with Supabase config
  useEffect(() => {
    if (selectedId) {
      const found = agents.find(a => a.id === selectedId);
      if (found) {
        // Load extra config from Supabase and merge
        loadAgentConfig(selectedId).then(config => {
          if (config) {
            setEditAgent({ ...found, ...config });
          } else {
            setEditAgent(found);
          }
        });
      }
    }
  }, [selectedId, agents]);

  const handleSaveAgent = async () => {
    if (!instanceId) return;

    // 1. Compose the final basePrompt from structured fields
    const composedPrompt = composePrompt(editAgent);

    // 2. Send to UAZAPI with composed prompt (only UAZAPI-known fields)
    const { id, description, persona, skills, productInfo, restrictions, ...uazapiFields } = editAgent;
    const agentDataForUazapi = {
      ...uazapiFields,
      basePrompt: composedPrompt,
    };

    const result = await api.saveAgent(agentDataForUazapi, selectedId || undefined);
    if (result) {
      // 3. Determine the agent ID (new or existing)
      const agentId = selectedId || (result as any)?.id || (result as any)?.agent_id || '';
      
      // 4. Save structured fields to Supabase
      if (agentId) {
        await saveAgentConfig(agentId, instanceId, editAgent);
      }

      toast({ title: 'Salvo!', description: 'Agente salvo com sucesso. O basePrompt foi composto automaticamente.' });
      loadAgents();
    }
  };

  const handleDeleteAgent = async (id: string) => {
    await api.deleteAgent(id);
    // Also delete from Supabase
    await supabase.from('agent_configs' as any).delete().eq('uazapi_agent_id', id);
    if (selectedId === id) { setSelectedId(null); setEditAgent(DEFAULT_AGENT); }
    loadAgents();
  };

  const handleAddAgent = () => {
    setSelectedId(null);
    setEditAgent({ ...DEFAULT_AGENT, apikey: globalApiKey });
  };

  const handleToggleAgent = async (agentId: string, currentActive: boolean) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    const result = await api.saveAgent({ active: !currentActive }, agentId);
    if (result) {
      toast({ title: currentActive ? 'Agente desativado' : 'Agente ativado' });
      loadAgents();
    }
  };

  const agentTriggers = triggers.filter(t => t.agent_id === (selectedId || editAgent.id));

  return (
    <div className="h-[calc(100vh-4rem)]">
      <AgentOnboardingTour />
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Bot className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold">Agentes IA</h1>
          <p className="text-xs text-muted-foreground">Gerencie seus agentes de atendimento inteligente via WhatsApp</p>
        </div>
      </div>

      <div className="flex h-[calc(100%-4rem)]">
        {/* Sidebar */}
        <div className="w-64 border-r border-border shrink-0" data-tour="agent-list">
          <AgentList agents={agents} selectedId={selectedId} onSelect={setSelectedId} onAdd={handleAddAgent} onDelete={handleDeleteAgent} onToggleActive={handleToggleAgent} />
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-3xl mx-auto">
              <Tabs defaultValue="geral" className="space-y-4">
                <TabsList className="grid grid-cols-7 w-full">
                  <TabsTrigger value="geral" className="text-xs" data-tour="tab-geral">Geral</TabsTrigger>
                  <TabsTrigger value="prompt" className="text-xs" data-tour="tab-prompt">Prompt</TabsTrigger>
                  <TabsTrigger value="knowledge" className="text-xs" data-tour="tab-knowledge">Knowledge</TabsTrigger>
                  <TabsTrigger value="funcoes" className="text-xs">Funções</TabsTrigger>
                  <TabsTrigger value="triggers" className="text-xs" data-tour="tab-triggers">Triggers</TabsTrigger>
                  <TabsTrigger value="cadencia" className="text-xs" data-tour="tab-cadencia">Cadência</TabsTrigger>
                  <TabsTrigger value="v2" className="text-xs">+ que Vencedores AI v2</TabsTrigger>
                </TabsList>

                <TabsContent value="geral">
                  <AgentGeneralTab agent={editAgent} onChange={setEditAgent} onSave={handleSaveAgent} saving={api.loading} globalApiKey={globalApiKey} />
                </TabsContent>

                <TabsContent value="prompt">
                  <AgentPromptTab agent={editAgent} onChange={setEditAgent} onSave={handleSaveAgent} saving={api.loading} />
                </TabsContent>

                <TabsContent value="knowledge">
                  <AgentKnowledgeTab items={knowledge} loading={api.loading} onSave={api.saveKnowledge} onDelete={api.deleteKnowledge} onRefresh={loadKnowledge} />
                </TabsContent>

                <TabsContent value="funcoes">
                  <AgentFunctionsTab items={functions} loading={api.loading} onSave={api.saveFunction} onDelete={api.deleteFunction} onRefresh={loadFunctions} />
                </TabsContent>

                <TabsContent value="triggers">
                  <AgentTriggersTab items={agentTriggers} agentId={selectedId || ''} loading={api.loading} onSave={api.saveTrigger} onDelete={api.deleteTrigger} onRefresh={loadTriggers} />
                </TabsContent>

                <TabsContent value="cadencia">
                  <AgentCadenceTab config={cadence} onChange={setCadence} onSave={handleSaveAgent} saving={api.loading} />
                </TabsContent>

                <TabsContent value="v2">
                  <AgentV2Tab />
                </TabsContent>
              </Tabs>

              <div className="mt-8">
                <ChatbotSettingsCard instanceId={instanceId} onSave={(settings) => api.updateChatbotSettings(settings as unknown as Record<string, unknown>)} loading={api.loading} />
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
