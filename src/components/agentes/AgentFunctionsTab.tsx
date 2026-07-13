import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Code2, Variable, AlertTriangle, Calendar, Mic, MessageSquare, Zap, Package, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AgentFunction, FunctionParameter } from '@/hooks/useUazapiAgents';

const CALCOM_PACKAGE = [
  {
    name: 'calcom_list_event_types',
    active: true,
    description: '1/4 Cal.com — Listar tipos de evento disponíveis',
    method: 'GET',
    endpoint: 'https://api.cal.com/v2/event-types',
    headers: { 'Authorization': 'Bearer cal_live_YOUR_API_KEY', 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' },
    body: {},
    parameters: [
      { name: 'eventSlug', type: 'string', description: 'Slug do tipo de evento (opcional)', required: false },
      { name: 'sortCreatedAt', type: 'string', description: 'Ordenação: asc ou desc (opcional)', required: false },
    ],
  },
  {
    name: 'calcom_get_slots',
    active: true,
    description: '2/4 Cal.com — Ver horários disponíveis para um tipo de evento',
    method: 'GET',
    endpoint: 'https://api.cal.com/v2/slots',
    headers: { 'Authorization': 'Bearer cal_live_YOUR_API_KEY', 'cal-api-version': '2024-09-04', 'Content-Type': 'application/json' },
    body: {},
    parameters: [
      { name: 'eventTypeId', type: 'number', description: 'ID do tipo de evento', required: true },
      { name: 'start', type: 'string', description: 'Data início (ISO 8601, ex: 2026-03-01)', required: true },
      { name: 'end', type: 'string', description: 'Data fim (ISO 8601, ex: 2026-03-02)', required: true },
      { name: 'timeZone', type: 'string', description: 'Timezone (ex: America/Sao_Paulo)', required: false },
      { name: 'duration', type: 'number', description: 'Duração em minutos (para eventos multi-duração)', required: false },
    ],
  },
  {
    name: 'calcom_reserve_slot',
    active: true,
    description: '3/4 Cal.com — Reservar horário temporariamente (5min padrão)',
    method: 'POST',
    endpoint: 'https://api.cal.com/v2/slots/reservations',
    headers: { 'Authorization': 'Bearer cal_live_YOUR_API_KEY', 'cal-api-version': '2024-09-04', 'Content-Type': 'application/json' },
    body: {},
    parameters: [
      { name: 'eventTypeId', type: 'number', description: 'ID do tipo de evento', required: true },
      { name: 'slotStart', type: 'string', description: 'Início do slot (ISO 8601 UTC)', required: true },
      { name: 'slotDuration', type: 'number', description: 'Duração do slot em minutos (opcional)', required: false },
      { name: 'reservationDuration', type: 'number', description: 'Minutos de reserva temporária (padrão: 5)', required: false },
    ],
  },
  {
    name: 'calcom_create_booking',
    active: true,
    description: '4/4 Cal.com — Criar o agendamento final',
    method: 'POST',
    endpoint: 'https://api.cal.com/v2/bookings',
    headers: { 'Authorization': 'Bearer cal_live_YOUR_API_KEY', 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' },
    body: {},
    parameters: [
      { name: 'eventTypeId', type: 'number', description: 'ID do tipo de evento', required: true },
      { name: 'start', type: 'string', description: 'Data/hora início (ISO 8601)', required: true },
      { name: 'attendee_name', type: 'string', description: 'Nome do participante', required: true },
      { name: 'attendee_email', type: 'string', description: 'Email do participante', required: true },
      { name: 'attendee_timeZone', type: 'string', description: 'Timezone (ex: America/Sao_Paulo)', required: true },
    ],
  },
];

const CALCOM_NAMES = CALCOM_PACKAGE.map(f => f.name);

const QUICK_INTEGRATIONS = [
  {
    name: 'Cal.com - Agendamento Completo',
    icon: Package,
    isPackage: true,
    preset: CALCOM_PACKAGE[0],
  },
  {
    name: 'Calendly - Agendar',
    icon: Calendar,
    isPackage: false,
    preset: {
      name: 'calendly_booking',
      active: true,
      description: 'Criar agendamento via Calendly API',
      method: 'POST',
      endpoint: 'https://api.calendly.com/scheduled_events',
      headers: { 'Authorization': 'Bearer YOUR_CALENDLY_TOKEN', 'Content-Type': 'application/json' },
      body: {},
      parameters: [
        { name: 'event_type', type: 'string', description: 'URI do tipo de evento Calendly', required: true },
        { name: 'invitee_email', type: 'string', description: 'Email do convidado', required: true },
        { name: 'start_time', type: 'string', description: 'Data/hora início (ISO 8601)', required: true },
      ],
    },
  },
  {
    name: 'ElevenLabs - TTS',
    icon: Mic,
    isPackage: false,
    preset: {
      name: 'elevenlabs_tts',
      active: true,
      description: 'Gerar áudio de voz via ElevenLabs Text-to-Speech',
      method: 'POST',
      endpoint: 'https://api.elevenlabs.io/v1/text-to-speech/YOUR_VOICE_ID',
      headers: { 'xi-api-key': 'YOUR_ELEVENLABS_KEY', 'Content-Type': 'application/json' },
      body: { model_id: 'eleven_multilingual_v2' },
      parameters: [
        { name: 'text', type: 'string', description: 'Texto para converter em áudio', required: true },
        { name: 'voice_id', type: 'string', description: 'ID da voz ElevenLabs', required: false },
      ],
    },
  },
  {
    name: 'Twilio - SMS',
    icon: MessageSquare,
    isPackage: false,
    preset: {
      name: 'twilio_sms',
      active: true,
      description: 'Enviar SMS via Twilio',
      method: 'POST',
      endpoint: 'https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json',
      headers: { 'Authorization': 'Basic YOUR_BASE64_AUTH', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: {},
      parameters: [
        { name: 'To', type: 'string', description: 'Número destino (+5511...)', required: true },
        { name: 'From', type: 'string', description: 'Número Twilio remetente', required: true },
        { name: 'Body', type: 'string', description: 'Conteúdo da mensagem SMS', required: true },
      ],
    },
  },
];

interface Props {
  items: AgentFunction[];
  loading: boolean;
  onSave: (item: Partial<AgentFunction>, id?: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onRefresh: () => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PARAM_TYPES = ['string', 'number', 'integer', 'boolean'];

const emptyFn: Partial<AgentFunction> = {
  name: '', active: false, description: '', method: 'POST',
  endpoint: '', headers: {}, body: {}, parameters: [],
};

const emptyParam: FunctionParameter = { name: '', type: 'string', description: '', required: false };

function isValidJson(str: string) {
  try { JSON.parse(str); return true; } catch { return false; }
}

export function AgentFunctionsTab({ items, loading, onSave, onDelete, onRefresh }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<AgentFunction> | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [headersStr, setHeadersStr] = useState('{}');
  const [bodyStr, setBodyStr] = useState('{}');
  const [calcomLoading, setCalcomLoading] = useState(false);

  const startEdit = (item?: AgentFunction) => {
    const fn = item || { ...emptyFn };
    setEditing(fn);
    setEditId(item?.id || null);
    setHeadersStr(JSON.stringify(fn.headers || {}, null, 2));
    setBodyStr(JSON.stringify(fn.body || {}, null, 2));
  };

  const loadPreset = (preset: Partial<AgentFunction>) => {
    setEditing({ ...preset });
    setEditId(null);
    setHeadersStr(JSON.stringify(preset.headers || {}, null, 2));
    setBodyStr(JSON.stringify(preset.body || {}, null, 2));
  };

  const handleCalcomPackage = async () => {
    // Check for duplicates
    const existingNames = items.map(i => i.name);
    const alreadyExists = CALCOM_NAMES.filter(n => existingNames.includes(n));
    
    if (alreadyExists.length > 0) {
      toast({
        title: 'Funções Cal.com já existem',
        description: `As funções ${alreadyExists.join(', ')} já foram criadas. Remova-as primeiro se quiser recriar.`,
        variant: 'destructive',
      });
      return;
    }

    setCalcomLoading(true);
    try {
      let successCount = 0;
      for (const fn of CALCOM_PACKAGE) {
        try {
          await onSave(fn);
          successCount++;
        } catch (err) {
          console.error(`Error saving Cal.com function ${fn.name}:`, err);
        }
      }
      toast({
        title: successCount === CALCOM_PACKAGE.length ? 'Cal.com configurado!' : 'Parcialmente configurado',
        description: `${successCount}/${CALCOM_PACKAGE.length} funções criadas com sucesso.`,
        variant: successCount === CALCOM_PACKAGE.length ? 'default' : 'destructive',
      });
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao criar funções Cal.com', variant: 'destructive' });
    } finally {
      setCalcomLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const headers = isValidJson(headersStr) ? JSON.parse(headersStr) : {};
    const body = isValidJson(bodyStr) ? JSON.parse(bodyStr) : {};
    await onSave({ ...editing, headers, body }, editId || undefined);
    setEditing(null);
    setEditId(null);
    onRefresh();
  };

  const updateParam = (idx: number, patch: Partial<FunctionParameter>) => {
    const params = [...(editing?.parameters || [])];
    params[idx] = { ...params[idx], ...patch };
    setEditing({ ...editing, parameters: params });
  };

  const addParam = () => {
    setEditing({ ...editing, parameters: [...(editing?.parameters || []), { ...emptyParam }] });
  };

  const removeParam = (idx: number) => {
    const params = [...(editing?.parameters || [])];
    params.splice(idx, 1);
    setEditing({ ...editing, parameters: params });
  };

  return (
    <div className="space-y-4">
      {/* Quick Integrations */}
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2 mb-2"><Zap className="w-4 h-4" /> Integrações Rápidas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_INTEGRATIONS.map(qi => (
            <button
              key={qi.name}
              disabled={qi.isPackage && calcomLoading}
              onClick={() => {
                if (qi.isPackage) {
                  handleCalcomPackage();
                } else {
                  loadPreset(qi.preset);
                }
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/40 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {qi.isPackage && calcomLoading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
              ) : (
                <qi.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div>
                <span className="text-xs font-medium block">{qi.name}</span>
                {qi.isPackage && <span className="text-[10px] text-muted-foreground">{calcomLoading ? 'Criando...' : '4 funções'}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium flex items-center gap-2"><Code2 className="w-4 h-4" /> Funções (APIs)</h3>
        <Button size="sm" variant="outline" onClick={() => startEdit()}>
          <Plus className="w-4 h-4 mr-1" /> Nova Função
        </Button>
      </div>

      {editing && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Nome</Label>
                <Input className="mt-1" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="createProduct" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
                <Label className="text-sm">Ativa</Label>
              </div>
            </div>
            <div>
              <Label className="text-sm">Descrição</Label>
              <Input className="mt-1" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="O que essa função faz..." />
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div>
                <Label className="text-sm">Método</Label>
                <Select value={editing.method || 'POST'} onValueChange={v => setEditing({ ...editing, method: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Endpoint</Label>
                <Input className="mt-1" value={editing.endpoint || ''} onChange={e => setEditing({ ...editing, endpoint: e.target.value })} placeholder="https://api.exemplo.com/resource" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Headers (JSON)</Label>
                {!isValidJson(headersStr) && <AlertTriangle className="w-3 h-3 text-destructive" />}
              </div>
              <Textarea className="mt-1 font-mono text-xs" rows={3} value={headersStr} onChange={e => setHeadersStr(e.target.value)} />
            </div>
            {editing.method !== 'GET' && (
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Body (JSON)</Label>
                  {!isValidJson(bodyStr) && <AlertTriangle className="w-3 h-3 text-destructive" />}
                </div>
                <Textarea className="mt-1 font-mono text-xs" rows={4} value={bodyStr} onChange={e => setBodyStr(e.target.value)} />
              </div>
            )}

            {/* Parameters */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm flex items-center gap-1"><Variable className="w-3.5 h-3.5" /> Parâmetros</Label>
                <Button size="sm" variant="ghost" onClick={addParam}><Plus className="w-3 h-3 mr-1" /> Param</Button>
              </div>
              <div className="space-y-2">
                {(editing.parameters || []).map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_1fr_80px_32px] gap-2 items-end">
                    <div>
                      {i === 0 && <Label className="text-[10px]">Nome</Label>}
                      <Input className="h-8 text-xs" value={p.name} onChange={e => updateParam(i, { name: e.target.value })} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-[10px]">Tipo</Label>}
                      <Select value={p.type} onValueChange={v => updateParam(i, { type: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PARAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      {i === 0 && <Label className="text-[10px]">Descrição</Label>}
                      <Input className="h-8 text-xs" value={p.description} onChange={e => updateParam(i, { description: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={p.required} onCheckedChange={v => updateParam(i, { required: v })} />
                      <span className="text-[10px]">Req</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeParam(i)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={loading}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setEditId(null); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.id} className="group cursor-pointer" onClick={() => startEdit(item)}>
            <CardContent className="py-3 flex items-center gap-3">
              <Code2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <Badge variant="outline" className="text-[10px]">{item.method}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.description || item.endpoint}</p>
              </div>
              <Badge variant={item.active ? 'default' : 'secondary'} className="text-[10px]">
                {item.active ? 'Ativa' : 'Inativa'}
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDelete(item.id).then(onRefresh); }}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && !editing && (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma função configurada. Use as integrações rápidas acima ou crie uma nova.</p>
        )}
      </div>
    </div>
  );
}
