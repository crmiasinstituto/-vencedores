import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Bot, Pause, Play, Loader2, Clock } from 'lucide-react';

const db = supabase as any;

interface Props { leadId: string }

type ConvState = {
  id?: string;
  status: 'active' | 'paused' | 'closed' | 'none';
  pause_until?: string | null;
  pause_reason?: string | null;
  paused_by?: string | null;
};

const DURATIONS = [
  { value: '1', label: '1 hora' },
  { value: '6', label: '6 horas' },
  { value: '24', label: '24 horas (1 dia)' },
  { value: '168', label: '7 dias' },
  { value: 'forever', label: 'Ate eu retomar' },
];

export default function AgentPauseControl({ leadId }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ConvState>({ status: 'none' });
  const [duration, setDuration] = useState('24');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await db.from('ai_agent_conversations')
      .select('id, status, pause_until, pause_reason, paused_by')
      .eq('lead_id', leadId).maybeSingle();
    if (data) {
      // Auto-heal: if pause_until already passed, the conv is actually active again
      const expiredPause = data.pause_until && new Date(data.pause_until).getTime() < Date.now();
      setState({
        id: data.id,
        status: expiredPause ? 'active' : (data.status as any),
        pause_until: data.pause_until,
        pause_reason: data.pause_reason,
        paused_by: data.paused_by,
      });
    } else {
      setState({ status: 'none' });
    }
    setLoading(false);
  };

  useEffect(() => { if (leadId) load(); }, [leadId]);

  const pauseAgent = async () => {
    setBusy(true);
    try {
      const hours = duration === 'forever' ? 24 * 365 * 10 : parseInt(duration, 10);
      const pauseUntil = new Date(Date.now() + hours * 3600_000).toISOString();
      const payload: any = {
        status: 'paused',
        paused_by: 'admin_manual',
        paused_at: new Date().toISOString(),
        pause_reason: reason.trim() || 'Pausa manual pelo admin',
        pause_until: duration === 'forever' ? null : pauseUntil,
        updated_at: new Date().toISOString(),
      };
      if (state.id) {
        await db.from('ai_agent_conversations').update(payload).eq('id', state.id);
      } else {
        // Create a placeholder conversation so future messages skip the agent
        await db.from('ai_agent_conversations').insert({
          lead_id: leadId,
          messages_history: [],
          ...payload,
        });
      }
      // Also set legacy v1 pause
      await db.from('crm_leads').update({
        chatbot_paused_until: duration === 'forever' ? new Date(Date.now() + 365 * 24 * 3600_000).toISOString() : pauseUntil,
      }).eq('id', leadId);

      toast.success(duration === 'forever' ? 'Agente pausado indefinidamente' : `Agente pausado por ${DURATIONS.find(d => d.value === duration)?.label}`);
      setOpen(false);
      setReason('');
      load();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const resumeAgent = async () => {
    setBusy(true);
    try {
      if (state.id) {
        await db.from('ai_agent_conversations').update({
          status: 'active',
          pause_until: null,
          pause_reason: null,
          paused_by: null,
          paused_at: null,
          updated_at: new Date().toISOString(),
        }).eq('id', state.id);
      }
      await db.from('crm_leads').update({ chatbot_paused_until: null }).eq('id', leadId);
      toast.success('Agente retomado — voltara a responder novas mensagens');
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;

  const isPaused = state.status === 'paused';
  const reasonLabel = state.paused_by === 'human_takeover' ? 'Você respondeu no celular'
    : state.paused_by === 'admin_manual' ? 'Pausa manual'
    : state.paused_by === 'bot_detection' ? 'Bot detectado'
    : state.paused_by === 'agent:transfer_to_human' ? 'Agente transferiu'
    : state.pause_reason || 'Pausado';

  let untilLabel = '';
  if (isPaused && state.pause_until) {
    const diff = new Date(state.pause_until).getTime() - Date.now();
    if (diff > 0) {
      const h = Math.floor(diff / 3600_000);
      untilLabel = h >= 24 ? `${Math.floor(h / 24)}d` : h >= 1 ? `${h}h` : `${Math.floor(diff / 60_000)}min`;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm" variant="ghost"
          className={`h-7 px-2 text-xs gap-1.5 ${isPaused ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-green-500 hover:bg-green-500/10'}`}
        >
          {isPaused ? <Pause className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
          <span className="font-medium">{isPaused ? 'Agente pausado' : 'Agente ativo'}</span>
          {untilLabel && <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1">{untilLabel}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px]" align="end">
        {isPaused ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Agente pausado</p>
              <p className="text-xs text-muted-foreground mt-0.5">{reasonLabel}</p>
              {untilLabel && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" /> retoma em {untilLabel}
                </p>
              )}
            </div>
            <Button onClick={resumeAgent} disabled={busy} size="sm" className="w-full bg-green-500 hover:bg-green-600 text-white">
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-2" />}
              Retomar agente agora
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Pausar agente neste lead</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O agente para de responder mensagens novas desse lead pelo periodo escolhido.
                Tambem pausa automaticamente quando voce responde no celular.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duracao</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Input
                value={reason} onChange={(e) => setReason(e.target.value)}
                className="h-8 text-xs"
                placeholder="Ex: Vou assumir essa negociacao"
              />
            </div>
            <Button onClick={pauseAgent} disabled={busy} size="sm" className="w-full">
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Pause className="w-3.5 h-3.5 mr-2" />}
              Pausar agente
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
