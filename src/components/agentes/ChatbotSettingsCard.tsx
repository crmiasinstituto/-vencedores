import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings2, Info, Save, Eye, EyeOff, Loader2 } from 'lucide-react';

interface ChatbotSettings {
  openai_apikey: string;
  chatbot_enabled: boolean;
  chatbot_ignoreGroups: boolean;
  chatbot_stopConversation: string;
  chatbot_stopMinutes: number;
  chatbot_stopWhenYouSendMsg: number;
}

interface Props {
  onSave: (settings: ChatbotSettings) => Promise<unknown>;
  loading: boolean;
  instanceId?: string | null;
}

function TipLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm">{label}</Label>
      <Tooltip>
        <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
        <TooltipContent className="max-w-[250px] text-xs">{tip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ChatbotSettingsCard({ onSave, loading, instanceId }: Props) {
  const [settings, setSettings] = useState<ChatbotSettings>({
    openai_apikey: '',
    chatbot_enabled: true,
    chatbot_ignoreGroups: true,
    chatbot_stopConversation: 'stop',
    chatbot_stopMinutes: 30,
    chatbot_stopWhenYouSendMsg: 5,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Load current settings from UAZAPI when instanceId is available
  useEffect(() => {
    if (!instanceId) return;
    setLoadingSettings(true);
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'get_chatbot_settings', instance_id: instanceId },
      }).then(({ data }) => {
        if (data?.success && data?.data) {
          const d = data.data;
          setSettings(prev => ({
            ...prev,
            openai_apikey: d.openai_apikey || prev.openai_apikey,
            chatbot_enabled: d.chatbot_enabled ?? prev.chatbot_enabled,
            chatbot_ignoreGroups: d.chatbot_ignoreGroups ?? prev.chatbot_ignoreGroups,
            chatbot_stopConversation: d.chatbot_stopConversation || prev.chatbot_stopConversation,
            chatbot_stopMinutes: d.chatbot_stopMinutes ?? prev.chatbot_stopMinutes,
            chatbot_stopWhenYouSendMsg: d.chatbot_stopWhenYouSendMsg ?? prev.chatbot_stopWhenYouSendMsg,
          }));
        }
      }).catch(console.error).finally(() => setLoadingSettings(false));
    });
  }, [instanceId]);

  const update = (patch: Partial<ChatbotSettings>) => setSettings({ ...settings, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="w-4 h-4" /> Configurações Globais do Chatbot
          {loadingSettings && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OpenAI API Key */}
        <div>
          <TipLabel label="OpenAI API Key" tip="Chave da API OpenAI usada pelo chatbot (começa com sk-). Obrigatória para funcionamento." />
          <div className="flex gap-2 mt-1">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={settings.openai_apikey}
              onChange={e => update({ openai_apikey: e.target.value })}
              placeholder="sk-..."
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <TipLabel label="Chatbot Ativo" tip="Liga/desliga todos os agentes de IA da instância." />
          <Switch checked={settings.chatbot_enabled} onCheckedChange={v => update({ chatbot_enabled: v })} />
        </div>
        <div className="flex items-center justify-between">
          <TipLabel label="Ignorar Grupos" tip="Se ativado, o chatbot não responde em grupos." />
          <Switch checked={settings.chatbot_ignoreGroups} onCheckedChange={v => update({ chatbot_ignoreGroups: v })} />
        </div>
        <div>
          <TipLabel label="Palavra de Pausa" tip="O lead pode digitar esta palavra para pausar o chatbot temporariamente." />
          <Input className="mt-1" value={settings.chatbot_stopConversation} onChange={e => update({ chatbot_stopConversation: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <TipLabel label="Pausa (minutos)" tip="Quanto tempo o chatbot fica pausado após a palavra de pausa." />
            <Input type="number" className="mt-1" value={settings.chatbot_stopMinutes} onChange={e => update({ chatbot_stopMinutes: Number(e.target.value) })} />
          </div>
          <div>
            <TipLabel label="Pausa ao Enviar Msg (min)" tip="Quanto tempo o chatbot fica pausado após você enviar msg manual. 0 = desligado." />
            <Input type="number" className="mt-1" value={settings.chatbot_stopWhenYouSendMsg} onChange={e => update({ chatbot_stopWhenYouSendMsg: Number(e.target.value) })} />
          </div>
        </div>
        <Button onClick={() => onSave(settings)} disabled={loading} className="w-full gap-2">
          <Save className="w-4 h-4" /> Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
