import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, Handle, Position,
  type Node, type Edge, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Save, Loader2, Mail, Clock, Zap, Plus, Trash2, Settings, Users, Target,
  GitBranch, Edit3, Tag, ListTodo, Square, MessageSquare, BarChart3,
  Move, UserCircle, TrendingUp, Bell, Webhook, Briefcase, Cake, CalendarOff,
  Columns, Eye, MousePointerClick,
} from 'lucide-react';
import AutomationReportSheet from '@/components/marketing-mod/AutomationReportSheet';
import { useAutomationNodeStats, type NodeCounters } from '@/hooks/useAutomationStats';
import {
  useEmailAutomation,
  useSaveEmailAutomation,
  type TriggerEvent,
} from '@/hooks/useEmailAutomations';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useAudienceOptions } from '@/hooks/useAudienceOptions';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useWhatsAppTemplates } from '@/hooks/useWhatsAppTemplates';
import { cn } from '@/lib/utils';

const TRIGGER_OPTIONS: { value: TriggerEvent | string; label: string; icon: any; group?: string }[] = [
  // CRM / Kanban
  { value: 'lead_created', label: 'Lead criado', icon: Users, group: 'CRM / Kanban' },
  { value: 'lead_column_changed', label: 'Lead mudou de coluna do funil', icon: Columns, group: 'CRM / Kanban' },
  { value: 'lead_board_changed', label: 'Lead mudou de board', icon: Briefcase, group: 'CRM / Kanban' },
  { value: 'lead_tag_added', label: 'Tag adicionada ao lead', icon: Tag, group: 'CRM / Kanban' },
  { value: 'lead_score_changed', label: 'Score atingiu threshold', icon: TrendingUp, group: 'CRM / Kanban' },
  // Engajamento
  { value: 'email_opened', label: 'Email aberto pelo lead', icon: Eye, group: 'Engajamento' },
  { value: 'email_clicked', label: 'Email clicado pelo lead', icon: MousePointerClick, group: 'Engajamento' },
  // Tempo / Data
  { value: 'lead_birthday', label: 'Aniversário do lead (hoje)', icon: Cake, group: 'Tempo / Data' },
  { value: 'lead_inactive', label: 'Lead inativo há N dias', icon: CalendarOff, group: 'Tempo / Data' },
  // Outros
  { value: 'custom', label: 'Customizado (manual / API)', icon: Zap, group: 'Outros' },
];

// ===== Contadores ao vivo nas etapas =====
// _publico: quantos leads batem com o gatilho (ex.: têm a tag); _stats: envios desta etapa;
// _aqui: quantos estão nesta etapa agora (na fila / esperando).
function PublicoBadge({ data }: { data: any }) {
  if (data._publico == null && data._entraram == null) return null;
  return (
    <div className="mt-2 rounded-lg bg-background/80 border px-2 py-1.5 text-xs space-y-0.5">
      {data._publico != null && (
        <p className="flex items-center gap-1.5 font-semibold">
          <Users className="h-3 w-3 text-blue-600" />
          {Number(data._publico).toLocaleString('pt-BR')} leads {data._filtroTag ? 'com a tag' : 'no público'}
        </p>
      )}
      {data._entraram != null && (
        <p className="text-muted-foreground">{Number(data._entraram).toLocaleString('pt-BR')} já entraram no fluxo</p>
      )}
    </div>
  );
}

function EnvioCounter({ data, color, aberturaLabel }: { data: any; color: string; aberturaLabel: string }) {
  const st: NodeCounters | undefined = data._stats;
  const total: number | null = data._total ?? null;
  const enviados = st?.enviados ?? 0;
  const aqui: number = data._aqui ?? 0;
  if (total == null && !st && !aqui) return null;
  const pct = total && total > 0 ? Math.min(100, Math.round((enviados / total) * 100)) : 0;
  return (
    <div className="mt-2 rounded-lg bg-background/80 border px-2 py-1.5 text-xs space-y-1 min-w-[190px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-sm" style={{ color }}>
          {enviados.toLocaleString('pt-BR')}
          {total != null && <span className="text-muted-foreground font-medium">/{total.toLocaleString('pt-BR')}</span>}
        </span>
        <span className="text-muted-foreground">receberam</span>
      </div>
      {total != null && total > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
      {st && (
        <p className="text-muted-foreground">
          {st.entregues} entregues · {st.abertos} {aberturaLabel}
          {st.falhas > 0 && <span className="text-red-600"> · {st.falhas} falha{st.falhas === 1 ? '' : 's'}</span>}
        </p>
      )}
      {aqui > 0 && <p className="text-amber-600">{aqui} na fila desta etapa</p>}
    </div>
  );
}

// ===== Custom Nodes =====
function TriggerNode({ data }: { data: any }) {
  return (
    <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-2xl p-4 min-w-[220px] shadow-md">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">Gatilho</p>
          <p className="text-sm font-semibold">{data.label || 'Quando algo acontecer'}</p>
        </div>
      </div>
      {data.description && <p className="text-xs text-muted-foreground">{data.description}</p>}
      <PublicoBadge data={data} />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </div>
  );
}

function SendEmailNode({ data }: { data: any }) {
  return (
    <div className="bg-[#BAA05E]/10 border-2 border-[#BAA05E]/40 rounded-2xl p-4 min-w-[220px] shadow-md">
      <Handle type="target" position={Position.Top} className="!bg-[#BAA05E]" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-[#BAA05E] flex items-center justify-center">
          <Mail className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#BAA05E] font-bold">Enviar Email</p>
          <p className="text-sm font-semibold truncate max-w-[160px]">{data.template_name || 'Sem template'}</p>
        </div>
      </div>
      {data.subject && <p className="text-xs text-muted-foreground truncate">📧 {data.subject}</p>}
      <EnvioCounter data={data} color="#BAA05E" aberturaLabel="abertos" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#BAA05E]" />
    </div>
  );
}

function WaitNode({ data }: { data: any }) {
  return (
    <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 min-w-[180px] shadow-md">
      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
          <Clock className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-amber-600 font-bold">Esperar</p>
          <p className="text-sm font-semibold">
            {data.duration || 1} {data.unit || 'dias'}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </div>
  );
}

function GenericNode({ data, color, label, icon: Icon, summary, counter }: any) {
  return (
    <div
      className="group border-2 rounded-2xl p-4 min-w-[200px] shadow-md relative"
      style={{ backgroundColor: `${color}15`, borderColor: `${color}66` }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      {data._onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); data._onDelete(); }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110"
          title="Excluir passo"
        >
          ✕
        </button>
      )}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color }}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color }}>{label}</p>
          <p className="text-sm font-semibold truncate max-w-[160px]">{summary}</p>
        </div>
      </div>
      {counter && <EnvioCounter data={data} color={color} aberturaLabel="lidos" />}
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  );
}

function UpdateFieldNode({ data }: { data: any }) {
  const summary = data.field ? `${data.field} = ${data.value || '?'}` : 'Configurar';
  return <GenericNode data={data} color="#6366f1" label="Atualizar Campo" icon={Edit3} summary={summary} />;
}

function AddTagNode({ data }: { data: any }) {
  return <GenericNode data={data} color="#10b981" label="Adicionar Tag" icon={Tag} summary={data.tag || 'Configurar'} />;
}

function CreateTaskNode({ data }: { data: any }) {
  return <GenericNode data={data} color="#f59e0b" label="Criar Tarefa" icon={ListTodo} summary={data.title || 'Configurar'} />;
}

function BranchNode({ data }: { data: any }) {
  const summary = data.condition_field ? `Se ${data.condition_field} ${data.condition_op || '='} ${data.condition_value || '?'}` : 'Configurar';
  return (
    <div className="bg-purple-500/10 border-2 border-purple-500/40 rounded-2xl p-4 min-w-[220px] shadow-md">
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
          <GitBranch className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-purple-600 font-bold">Condição</p>
          <p className="text-sm font-semibold truncate max-w-[160px]">{summary}</p>
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="text-emerald-600">↙ Sim</span>
        <span className="text-red-500">Não ↘</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '25%', background: '#10b981' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '75%', background: '#ef4444' }} />
    </div>
  );
}

function EndNode({ data }: { data: any }) {
  return (
    <div className="bg-gray-500/10 border-2 border-gray-500/40 rounded-2xl p-4 min-w-[160px] shadow-md">
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gray-500 flex items-center justify-center">
          <Square className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">Fim</p>
          <p className="text-sm font-semibold">{data.reason || 'Encerrar'}</p>
        </div>
      </div>
    </div>
  );
}

function SendWhatsAppNode({ data }: { data: any }) {
  return <GenericNode data={data} color="#22c55e" label="Enviar WhatsApp" icon={MessageSquare} summary={data.message ? data.message.slice(0, 30) + '...' : 'Configurar mensagem'} counter />;
}

function SendWhatsAppCloudNode({ data }: { data: any }) {
  return <GenericNode data={data} color="#25d366" label="WA Cloud API" icon={MessageSquare} summary={data.template_name || 'Configurar template'} counter />;
}

function MoveLeadNode({ data }: { data: any }) {
  const summary = data.column_id ? `→ ${(data._columnName as string) || 'coluna'}` : 'Configurar destino';
  return <GenericNode data={data} color="#3b82f6" label="Mover Lead" icon={Move} summary={summary} />;
}

function AssignToNode({ data }: { data: any }) {
  const summary = data.assigned_to && data.assigned_to !== '__unassigned__'
    ? `→ ${(data._memberName as string) || 'vendedor'}`
    : (data.assigned_to === '__unassigned__' ? 'Sem responsável' : 'Configurar');
  return <GenericNode data={data} color="#3b82f6" label="Atribuir" icon={UserCircle} summary={summary} />;
}

function UpdateScoreNode({ data }: { data: any }) {
  const delta = data.delta;
  const summary = typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta} pontos` : 'Configurar delta';
  return <GenericNode data={data} color="#6366f1" label="Atualizar Score" icon={TrendingUp} summary={summary} />;
}

function NotifyTeamNode({ data }: { data: any }) {
  const summary = data.title || 'Configurar notificação';
  return <GenericNode data={data} color="#f59e0b" label="Notificar Time" icon={Bell} summary={summary} />;
}

function WebhookNode({ data }: { data: any }) {
  let summary = 'Configurar URL';
  if (data.url) {
    try { summary = new URL(data.url).hostname; } catch { summary = data.url.slice(0, 28) + '...'; }
  }
  return <GenericNode data={data} color="#a855f7" label="Webhook" icon={Webhook} summary={summary} />;
}

function WaitBusinessHoursNode({ data }: { data: any }) {
  return <GenericNode data={data} color="#f59e0b" label="Horário Comercial" icon={Briefcase} summary="Pula fim de semana e madrugada" />;
}

function InviteGroupNode({ data }: { data: any }) {
  return <GenericNode data={data} color="#25d366" label="Grupo WhatsApp" icon={Users} summary={data.group_link ? 'Link configurado' : 'Configurar link'} />;
}

function WaitUntilDateNode({ data }: { data: any }) {
  const summary = data.event_date
    ? `${data.offset || '?'} ${data.offset_unit || 'dias'} antes de ${data.event_date}`
    : 'Configurar data';
  return <GenericNode data={data} color="#e11d48" label="Lembrete" icon={CalendarOff} summary={summary} />;
}

const nodeTypes = {
  trigger: TriggerNode,
  sendEmail: SendEmailNode,
  sendWhatsapp: SendWhatsAppNode,
  sendWhatsappCloud: SendWhatsAppCloudNode,
  wait: WaitNode,
  waitBusinessHours: WaitBusinessHoursNode,
  waitUntilDate: WaitUntilDateNode,
  inviteGroup: InviteGroupNode,
  branch: BranchNode,
  moveLead: MoveLeadNode,
  assignTo: AssignToNode,
  updateField: UpdateFieldNode,
  updateScore: UpdateScoreNode,
  addTag: AddTagNode,
  createTask: CreateTaskNode,
  notifyTeam: NotifyTeamNode,
  webhook: WebhookNode,
  end: EndNode,
};

const initialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { label: 'Lead criado', description: 'Quando um lead novo entrar' },
  },
];

export default function MarketingAutomationEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nova';
  const navigate = useNavigate();
  // Fluxo novo pode chegar pré-preenchido (ex: Captura de Páginas manda ?gatilho=lead_tag_added&tag=...&nome=...)
  const [searchParams] = useSearchParams();

  const { data: existing, isLoading } = useEmailAutomation(isNew ? undefined : id);
  const saveAutomation = useSaveEmailAutomation();
  const { data: templates = [] } = useEmailTemplates();
  const { data: waTemplates = [] } = useWhatsAppTemplates();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [name, setName] = useState(() => (isNew && searchParams.get('nome')) || 'Nova automação');
  const [description, setDescription] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>(() =>
    (isNew && TRIGGER_OPTIONS.some((t) => t.value === searchParams.get('gatilho'))
      ? searchParams.get('gatilho')
      : 'lead_created') as TriggerEvent,
  );
  const [triggerFilter, setTriggerFilter] = useState<Record<string, any>>(() =>
    isNew && searchParams.get('tag') ? { tag: searchParams.get('tag') } : {},
  );
  const [reportOpen, setReportOpen] = useState(false);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || '');
      setTriggerEvent(existing.trigger_event);
      setTriggerFilter(existing.trigger_filter || {});
      if (existing.flow_json?.nodes) setNodes(existing.flow_json.nodes);
      if (existing.flow_json?.edges) setEdges(existing.flow_json.edges);
    }
  }, [existing]);

  useEffect(() => {
    const opt = TRIGGER_OPTIONS.find((t) => t.value === triggerEvent);
    if (opt) {
      setNodes((nds) =>
        nds.map((n) =>
          n.type === 'trigger'
            ? { ...n, data: { ...n.data, label: opt.label, description: `Quando: ${opt.label}` } }
            : n,
        ),
      );
    }
  }, [triggerEvent, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const defaultDataFor = (type: string): any => {
    switch (type) {
      case 'sendEmail': return { template_id: null, template_name: null, subject: '' };
      case 'wait': return { duration: 1, unit: 'dias' };
      case 'updateField': return { field: 'lead_score', value: '' };
      case 'addTag': return { tag: '' };
      case 'createTask': return { title: '', team: 'comercial' };
      case 'branch': return { condition_field: 'has_tag', condition_op: '=', condition_value: '' };
      case 'waitUntilDate': return { event_date: '', offset: 1, offset_unit: 'dias' };
      case 'end': return { reason: 'completed' };
      case 'sendWhatsapp': return { message: '', use_lead_phone: true };
      case 'inviteGroup': return { group_link: '', message: 'Ola {{primeiro_nome}}! Entra no nosso grupo exclusivo pra receber os conteudos antes de todo mundo 👇' };
      case 'sendWhatsappCloud': return { template_name: '', language: 'pt_BR', components: [] };
      default: return {};
    }
  };

  const addNode = (type: string) => {
    const maxY = nodes.reduce((m, n) => Math.max(m, n.position.y), 0);
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 450, y: maxY + 80 },
      data: defaultDataFor(type),
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)),
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ...data } });
    }
  };

  const deleteNode = (nodeId: string) => {
    if (nodeId.startsWith('trigger-')) return;
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  const handleSave = async () => {
    const flow = { nodes, edges };
    const saved = await saveAutomation.mutateAsync({
      id: isNew ? undefined : id,
      name,
      description: description || null,
      trigger_event: triggerEvent,
      trigger_filter: Object.keys(triggerFilter).length > 0 ? triggerFilter : null,
      flow_json: flow,
    });
    if (isNew) navigate(`/admin/marketing/automacoes/${saved.id}`, { replace: true });
  };

  const { data: nodeStats } = useAutomationNodeStats(isNew ? undefined : id, triggerFilter);
  const ENVIO_TYPES = ['sendEmail', 'sendWhatsapp', 'sendWhatsappCloud'];

  const enrichedNodes = useMemo(
    () => nodes.map((n) => {
      // Total de referência do X/total: leads do gatilho (ex.: com a tag); sem filtro, quem entrou.
      const total = nodeStats ? (nodeStats.publico ?? nodeStats.entraram) : null;
      if (n.type === 'trigger') {
        return {
          ...n,
          data: {
            ...n.data,
            _publico: nodeStats?.publico ?? null,
            _entraram: nodeStats ? nodeStats.entraram : null,
            _filtroTag: !!triggerFilter?.tag,
          },
        };
      }
      const extra = ENVIO_TYPES.includes(n.type || '')
        ? { _stats: nodeStats?.nodes?.[n.id], _total: total, _aqui: nodeStats?.aqui?.[n.id] ?? 0 }
        : {};
      return { ...n, data: { ...n.data, ...extra, _onDelete: () => deleteNode(n.id) } };
    }),
    [nodes, nodeStats, triggerFilter],
  );

  const deletableEdges = useMemo(
    () => edges.map((e) => ({ ...e, style: { stroke: '#888', strokeWidth: 2 }, interactionWidth: 20 })),
    [edges],
  );

  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#BAA05E]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Topbar */}
        <div className="border-b bg-background/80 backdrop-blur-sm">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/marketing/automacoes')}
                className="-ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
              </Button>
              <div className="h-5 w-px bg-border" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da automação"
                className="h-9 text-sm font-semibold border-none shadow-none px-2 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-1 max-w-md"
              />
            </div>
            <div className="flex items-center gap-2">
              {id && id !== 'nova' && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReportOpen(true)}>
                  <BarChart3 className="h-3.5 w-3.5" /> Relatório
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={saveAutomation.isPending || !name.trim()}
                size="sm"
                className="bg-[#BAA05E] hover:bg-[#917D3D] gap-1.5"
              >
                {saveAutomation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>

        {/* Body: 3 colunas */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr] overflow-hidden">
          {/* Sidebar config + add nodes */}
          <aside className="border-r overflow-y-auto p-4 space-y-5 bg-muted/10">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gatilho</Label>
              <Select value={triggerEvent} onValueChange={(v) => { setTriggerEvent(v as TriggerEvent); setTriggerFilter({}); }}>
                <SelectTrigger className="mt-1.5 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(triggerEvent === 'lead_column_changed' || triggerEvent === 'lead_board_changed') && (
                <div className="mt-2 p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-2">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Filtro: qual board/coluna?</p>
                  <BoardColumnPicker
                    boardId={triggerFilter.board_id || ''}
                    columnId={triggerFilter.column_id || ''}
                    onChange={(boardId, columnId) => setTriggerFilter((f: Record<string, any>) => ({ ...f, board_id: boardId || undefined, column_id: columnId || undefined }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Deixe vazio pra disparar em qualquer movimentacao</p>
                </div>
              )}

              {triggerEvent === 'lead_created' && (
                <div className="mt-2 p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-2">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Filtro: em qual board/coluna?</p>
                  <BoardColumnPicker
                    boardId={triggerFilter.board_id || ''}
                    columnId={triggerFilter.column_id || ''}
                    onChange={(boardId, columnId) => setTriggerFilter((f: Record<string, any>) => ({ ...f, board_id: boardId || undefined, column_id: columnId || undefined }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Deixe vazio pra qualquer lead novo. Escolha o board (ex: RPG10X) pra rodar só nele.</p>
                </div>
              )}

              {triggerEvent === 'lead_tag_added' && (
                <div className="mt-2 p-2.5 rounded-lg border border-green-500/20 bg-green-500/5 space-y-2">
                  <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Filtro: qual tag?</p>
                  <Input
                    value={triggerFilter.tag || ''}
                    onChange={(e) => setTriggerFilter((f: Record<string, any>) => ({ ...f, tag: e.target.value || undefined }))}
                    placeholder="ex: vip, hot-lead, comprou"
                    className="text-xs h-8"
                  />
                  <p className="text-[10px] text-muted-foreground">Deixe vazio pra disparar com qualquer tag</p>
                </div>
              )}

              {triggerEvent === 'lead_score_changed' && (
                <div className="mt-2 p-2.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-2">
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Filtro: score minimo</p>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={triggerFilter.score_threshold || ''}
                    onChange={(e) => setTriggerFilter((f: Record<string, any>) => ({ ...f, score_threshold: Number(e.target.value) || undefined }))}
                    placeholder="ex: 70"
                    className="text-xs h-8"
                  />
                  <p className="text-[10px] text-muted-foreground">Dispara quando score cruza esse valor (de baixo pra cima)</p>
                </div>
              )}

              {triggerEvent === 'lead_inactive' && (
                <div className="mt-2 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Filtro: dias sem interacao</p>
                  <Input
                    type="number"
                    min="1"
                    value={triggerFilter.days || ''}
                    onChange={(e) => setTriggerFilter((f: Record<string, any>) => ({ ...f, days: Number(e.target.value) || undefined }))}
                    placeholder="ex: 7"
                    className="text-xs h-8"
                  />
                  <p className="text-[10px] text-muted-foreground">Dispara diariamente pra leads inativos ha N+ dias</p>
                </div>
              )}

              <Label className="text-xs mt-3 block">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="O que essa automação faz?"
                className="text-xs resize-none mt-1.5"
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                Adicionar passo
              </Label>
              <div className="space-y-1.5">
                {[
                  // Comunicação
                  { type: 'sendEmail',         label: 'Enviar Email',         desc: 'Disparar template',         icon: Mail,           color: '#BAA05E' },
                  { type: 'sendWhatsapp',      label: 'Enviar WhatsApp',      desc: 'Mensagem via UAZAPI',       icon: MessageSquare,  color: '#22c55e' },
                  { type: 'sendWhatsappCloud', label: 'WhatsApp Cloud API',   desc: 'Template oficial Meta',     icon: MessageSquare,  color: '#25d366' },
                  { type: 'inviteGroup',       label: 'Convidar pro Grupo WA', desc: 'Envia link do grupo',       icon: Users,          color: '#25d366' },
                  // Tempo
                  { type: 'wait',              label: 'Esperar',              desc: 'Atrasar execução',          icon: Clock,          color: '#f59e0b' },
                  { type: 'waitBusinessHours', label: 'Esperar horário comercial', desc: 'Pula final de semana', icon: Briefcase,      color: '#f59e0b' },
                  { type: 'waitUntilDate',    label: 'Lembrete antes do evento', desc: 'X dias antes de uma data', icon: CalendarOff,  color: '#e11d48' },
                  // Lógica
                  { type: 'branch',            label: 'Condição (Se/Então)',  desc: 'Bifurcar fluxo',            icon: GitBranch,      color: '#a855f7' },
                  // CRM
                  { type: 'moveLead',          label: 'Mover lead no Kanban', desc: 'Coluna/board diferente',    icon: Move,           color: '#3b82f6' },
                  { type: 'assignTo',          label: 'Atribuir responsável', desc: 'Define vendedor',           icon: UserCircle,     color: '#3b82f6' },
                  { type: 'updateScore',       label: 'Atualizar Score',      desc: 'Soma/subtrai do lead_score',icon: TrendingUp,     color: '#6366f1' },
                  { type: 'addTag',            label: 'Adicionar Tag',        desc: 'Marcar lead',               icon: Tag,            color: '#10b981' },
                  { type: 'updateField',       label: 'Atualizar Campo',      desc: 'Editar qualquer campo',     icon: Edit3,          color: '#6366f1' },
                  // Notificação
                  { type: 'createTask',        label: 'Criar Tarefa',         desc: 'Pra vendedor',              icon: ListTodo,       color: '#f59e0b' },
                  { type: 'notifyTeam',        label: 'Notificar Vendedor',   desc: 'Badge interno (sino)',      icon: Bell,           color: '#f59e0b' },
                  // Integração
                  { type: 'webhook',           label: 'Webhook Externo',      desc: 'POST URL custom',           icon: Webhook,        color: '#a855f7' },
                  // Fluxo
                  { type: 'end',               label: 'Fim',                  desc: 'Encerrar fluxo',            icon: Square,         color: '#6b7280' },
                ].map((it) => (
                  <button
                    key={it.type}
                    onClick={() => addNode(it.type)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border hover:border-[#BAA05E]/50 hover:bg-[#BAA05E]/5 transition-all text-left"
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${it.color}20` }}
                    >
                      <it.icon className="h-3.5 w-3.5" style={{ color: it.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{it.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{it.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-3 text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Settings className="h-3 w-3" /> Como usar
                </p>
                <ul className="text-muted-foreground space-y-1 mt-1.5 list-disc list-inside">
                  <li>Adicione passos pela barra esquerda (aparece solto)</li>
                  <li>Conecte arrastando do circulo de baixo pro proximo passo</li>
                  <li>Clique num passo pra configurar</li>
                  <li>Passe o mouse sobre um passo pra ver o X de excluir</li>
                  <li>Duplo clique na linha pra desconectar</li>
                  <li>Delete/Backspace remove no selecionado</li>
                </ul>
              </CardContent>
            </Card>
          </aside>

          {/* Canvas */}
          <main className="relative bg-muted/5">
            <ReactFlow
              nodes={enrichedNodes}
              edges={deletableEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelectedNode(n)}
              onEdgeDoubleClick={(_, e) => setEdges((eds) => eds.filter((ed) => ed.id !== e.id))}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} color="#BAA05E33" />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => {
                  if (n.type === 'trigger') return '#3b82f6';
                  if (n.type === 'sendEmail') return '#BAA05E';
                  if (n.type === 'wait') return '#f59e0b';
                  return '#888';
                }}
              />
            </ReactFlow>
          </main>
        </div>
      </div>

      {/* Modal pra editar node selecionado */}
      <Dialog open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedNode?.type === 'trigger' && '⚡ Configurar gatilho'}
              {selectedNode?.type === 'sendEmail' && '📧 Configurar envio de email'}
              {selectedNode?.type === 'sendWhatsapp' && '💬 Configurar WhatsApp'}
              {selectedNode?.type === 'sendWhatsappCloud' && '💬 WhatsApp Cloud API (Oficial)'}
              {selectedNode?.type === 'inviteGroup' && '👥 Convidar pro Grupo WhatsApp'}
              {selectedNode?.type === 'wait' && '⏰ Configurar espera'}
              {selectedNode?.type === 'waitBusinessHours' && '🏢 Esperar horário comercial'}
              {selectedNode?.type === 'waitUntilDate' && '📅 Lembrete antes do evento'}
              {selectedNode?.type === 'updateField' && '✏️ Atualizar campo do lead'}
              {selectedNode?.type === 'addTag' && '🏷️ Adicionar tag'}
              {selectedNode?.type === 'createTask' && '✅ Criar tarefa'}
              {selectedNode?.type === 'branch' && '🔀 Configurar condição'}
              {selectedNode?.type === 'moveLead' && '↔️ Mover lead no Kanban'}
              {selectedNode?.type === 'assignTo' && '👤 Atribuir responsável'}
              {selectedNode?.type === 'updateScore' && '📈 Atualizar score'}
              {selectedNode?.type === 'notifyTeam' && '🔔 Notificar vendedor'}
              {selectedNode?.type === 'webhook' && '🪝 Webhook externo'}
              {selectedNode?.type === 'end' && '⏹️ Encerrar fluxo'}
            </DialogTitle>
            <DialogDescription>
              {selectedNode?.type === 'trigger' && 'Esse gatilho dispara o fluxo. Configure o tipo de evento na barra lateral esquerda.'}
              {selectedNode?.type === 'sendEmail' && 'Escolha o template e personalize o assunto.'}
              {selectedNode?.type === 'sendWhatsapp' && 'Mensagem enviada via instância WhatsApp ativa.'}
              {selectedNode?.type === 'sendWhatsappCloud' && 'Envia template aprovado via API oficial Meta. Sem risco de ban.'}
              {selectedNode?.type === 'inviteGroup' && 'Envia o link de convite do grupo WhatsApp pro lead com uma mensagem personalizada.'}
              {selectedNode?.type === 'wait' && 'Pausa o fluxo antes de executar o próximo passo.'}
              {selectedNode?.type === 'waitBusinessHours' && 'Pula fim de semana e madrugada. Volta segunda 9h Brasil.'}
              {selectedNode?.type === 'waitUntilDate' && 'Pausa o fluxo e executa o proximo passo X dias/horas antes da data do evento.'}
              {selectedNode?.type === 'updateField' && 'Modifica um campo do lead atual.'}
              {selectedNode?.type === 'addTag' && 'Marca o lead com uma tag pra segmentação.'}
              {selectedNode?.type === 'createTask' && 'Cria uma tarefa pro time selecionado.'}
              {selectedNode?.type === 'branch' && 'Avalia condição e bifurca fluxo em sim/não.'}
              {selectedNode?.type === 'moveLead' && 'Move o lead pra outra coluna ou board do Kanban.'}
              {selectedNode?.type === 'assignTo' && 'Define o vendedor responsável pelo lead.'}
              {selectedNode?.type === 'updateScore' && 'Soma ou subtrai do lead_score (range 0-100).'}
              {selectedNode?.type === 'notifyTeam' && 'Cria notificação interna (badge sino) pro vendedor.'}
              {selectedNode?.type === 'webhook' && 'POST pra URL externa (Zapier, Make, n8n, etc).'}
              {selectedNode?.type === 'end' && 'Encerra o fluxo pra esse lead.'}
            </DialogDescription>
          </DialogHeader>
          {selectedNode && (
            <div className="space-y-4 py-2">
              {selectedNode.type === 'sendEmail' && (
                <>
                  <div>
                    <Label className="text-xs">Template</Label>
                    <Select
                      value={(selectedNode.data.template_id as string) || ''}
                      onValueChange={(v) => {
                        const tpl = templates.find((t) => t.id === v);
                        updateNodeData(selectedNode.id, {
                          template_id: v,
                          template_name: tpl?.name,
                          subject: tpl?.subject,
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Assunto (sobrescreve do template)</Label>
                    <Input
                      value={(selectedNode.data.subject as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { subject: e.target.value })}
                      placeholder="Use {{nome}} pra personalizar"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'wait' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Duração</Label>
                    <Input
                      type="number"
                      min="1"
                      value={(selectedNode.data.duration as number) || 1}
                      onChange={(e) => updateNodeData(selectedNode.id, { duration: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Select
                      value={(selectedNode.data.unit as string) || 'dias'}
                      onValueChange={(v) => updateNodeData(selectedNode.id, { unit: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutos">Minutos</SelectItem>
                        <SelectItem value="horas">Horas</SelectItem>
                        <SelectItem value="dias">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'waitUntilDate' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Data do evento</Label>
                    <Input
                      type="date"
                      value={(selectedNode.data.event_date as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { event_date: e.target.value })}
                      className="text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ex: 2026-06-09 pra Masterclass dia 09/06
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Executar quantos antes?</Label>
                      <Input
                        type="number"
                        min="0"
                        value={(selectedNode.data.offset as number) ?? 1}
                        onChange={(e) => updateNodeData(selectedNode.id, { offset: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Unidade</Label>
                      <Select
                        value={(selectedNode.data.offset_unit as string) || 'dias'}
                        onValueChange={(v) => updateNodeData(selectedNode.id, { offset_unit: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="horas">Horas antes</SelectItem>
                          <SelectItem value="dias">Dias antes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedNode.data.event_date && (selectedNode.data.offset as number) > 0 && (() => {
                    const evDate = new Date(selectedNode.data.event_date + 'T09:00:00-03:00');
                    const offsetMs = (selectedNode.data.offset_unit === 'horas' ? 3600000 : 86400000) * (selectedNode.data.offset as number);
                    const fireDate = new Date(evDate.getTime() - offsetMs);
                    return (
                      <div className="rounded-md border bg-emerald-500/10 border-emerald-500/30 p-2.5 text-xs">
                        <p className="font-semibold text-emerald-600">Vai executar em:</p>
                        <p className="text-foreground">{fireDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} as {fireDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedNode.type === 'updateField' && (
                <>
                  <div>
                    <Label className="text-xs">Campo</Label>
                    <Select
                      value={({ sales_score: 'lead_score' } as Record<string, string>)[selectedNode.data.field as string] || (selectedNode.data.field as string) || 'lead_score'}
                      onValueChange={(v) => updateNodeData(selectedNode.id, { field: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Escolha o campo" /></SelectTrigger>
                      <SelectContent>
                        {/* Pra mudar a coluna do funil use o passo "Mover lead no Kanban" */}
                        <SelectItem value="lead_score">Score (0 a 100)</SelectItem>
                        <SelectItem value="source">Origem</SelectItem>
                        <SelectItem value="priority">Prioridade (low, medium, high)</SelectItem>
                        <SelectItem value="evento">Evento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Novo valor</Label>
                    <Input
                      value={(selectedNode.data.value as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { value: e.target.value })}
                      placeholder="qualificacao, 75, etc"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'addTag' && (
                <div>
                  <Label className="text-xs">Tag</Label>
                  <Input
                    value={(selectedNode.data.tag as string) || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { tag: e.target.value })}
                    placeholder="ex: hot-lead, vip, follow-up"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Tags permitem segmentar leads</p>
                </div>
              )}

              {selectedNode.type === 'createTask' && (
                <>
                  <div>
                    <Label className="text-xs">Título da tarefa</Label>
                    <Input
                      value={(selectedNode.data.title as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { title: e.target.value })}
                      placeholder="Ligar pro lead"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Time</Label>
                    <Select
                      value={(selectedNode.data.team as string) || 'comercial'}
                      onValueChange={(v) => updateNodeData(selectedNode.id, { team: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="cs">CS</SelectItem>
                        <SelectItem value="suporte">Suporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {selectedNode.type === 'branch' && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Avalia uma condição. Conecta nó "sim" no handle esquerdo (verde), "não" no direito (vermelho).
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Campo</Label>
                      <Select
                        value={({ sales_stage: 'column_name', sales_score: 'lead_score' } as Record<string, string>)[selectedNode.data.condition_field as string] || (selectedNode.data.condition_field as string) || 'has_tag'}
                        onValueChange={(v) => updateNodeData(selectedNode.id, { condition_field: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="column_name">Coluna do funil</SelectItem>
                          <SelectItem value="lead_score">Score</SelectItem>
                          <SelectItem value="source">Origem</SelectItem>
                          <SelectItem value="email_opened">Abriu email</SelectItem>
                          <SelectItem value="email_clicked">Clicou email</SelectItem>
                          <SelectItem value="has_tag">Tem tag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Operador</Label>
                      <Select
                        value={(selectedNode.data.condition_op as string) || '='}
                        onValueChange={(v) => updateNodeData(selectedNode.id, { condition_op: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="=">igual</SelectItem>
                          <SelectItem value="!=">diferente</SelectItem>
                          <SelectItem value=">">maior</SelectItem>
                          <SelectItem value="<">menor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Valor</Label>
                      <Input
                        value={(selectedNode.data.condition_value as string) || ''}
                        onChange={(e) => updateNodeData(selectedNode.id, { condition_value: e.target.value })}
                        placeholder={({ column_name: 'Qualificado', lead_score: '50', source: 'pagina:...', has_tag: 'vip', email_opened: 'sim', email_clicked: 'sim' } as Record<string, string>)[(selectedNode.data.condition_field as string) || 'has_tag'] || ''}
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedNode.type === 'sendWhatsapp' && (
                <>
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      value={(selectedNode.data.message as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                      placeholder="Olá {{nome}}, tudo bem?"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use {'{{nome}}'}, {'{{empresa}}'} pra personalizar
                    </p>
                  </div>
                </>
              )}

              {selectedNode.type === 'sendWhatsappCloud' && (() => {
                const approvedTemplates = waTemplates.filter((t) => t.status === 'APPROVED');
                const selectedTpl = approvedTemplates.find((t) => t.name === selectedNode.data.template_name);
                const bodyComp = selectedTpl?.components?.find((c: any) => c.type === 'BODY');
                const bodyText = (bodyComp?.text as string) || '';
                const varCount = selectedTpl?.variables_count || (bodyText.match(/\{\{\d+\}\}/g) || []).length;
                const currentParams: string[] = selectedNode.data.template_params || [];

                return (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Template aprovado</Label>
                      <Select
                        value={(selectedNode.data.template_name as string) || ''}
                        onValueChange={(v) => {
                          const tpl = approvedTemplates.find((t) => t.name === v);
                          updateNodeData(selectedNode.id, {
                            template_name: v,
                            language: tpl?.language || 'pt_BR',
                            template_params: [],
                            components: [],
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o template..." /></SelectTrigger>
                        <SelectContent>
                          {approvedTemplates.length === 0 && (
                            <SelectItem value="_empty" disabled>Nenhum template aprovado</SelectItem>
                          )}
                          {approvedTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.name}>
                              {t.name} ({t.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedTpl && bodyText && (
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Preview do template</p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{bodyText}</p>
                      </div>
                    )}

                    {selectedTpl && varCount > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Variaveis ({varCount})
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Preencha os valores que substituem {'{{1}}'}, {'{{2}}'}, etc. Use <code className="bg-muted px-1 rounded">{'{{nome}}'}</code> ou <code className="bg-muted px-1 rounded">{'{{primeiro_nome}}'}</code> pra dados do lead.
                        </p>
                        {Array.from({ length: varCount }, (_, i) => (
                          <div key={i}>
                            <Label className="text-[10px] text-muted-foreground">{`{{${i + 1}}}`}</Label>
                            <Input
                              value={currentParams[i] || ''}
                              onChange={(e) => {
                                const newParams = [...currentParams];
                                while (newParams.length <= i) newParams.push('');
                                newParams[i] = e.target.value;
                                updateNodeData(selectedNode.id, { template_params: newParams });
                              }}
                              placeholder={i === 0 ? '{{nome}}' : `Valor da variavel ${i + 1}`}
                              className="text-xs h-8"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {!selectedTpl && selectedNode.data.template_name && (
                      <p className="text-xs text-amber-500">Template "{selectedNode.data.template_name}" nao encontrado no banco. Sincronize os templates na pagina de WhatsApp Cloud.</p>
                    )}
                  </div>
                );
              })()}

              {selectedNode.type === 'inviteGroup' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Link do grupo WhatsApp</Label>
                    <Input
                      value={(selectedNode.data.group_link as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { group_link: e.target.value })}
                      placeholder="https://chat.whatsapp.com/ABC123..."
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Copie o link de convite do grupo no WhatsApp (Configs do grupo → Link de convite)
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Mensagem de convite</Label>
                    <Textarea
                      value={(selectedNode.data.message as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                      rows={3}
                      placeholder="Ola {{primeiro_nome}}! Entra no nosso grupo exclusivo..."
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Use {'{{nome}}'}, {'{{primeiro_nome}}'} pra personalizar. O link do grupo e adicionado automaticamente no final.
                    </p>
                  </div>
                  {selectedNode.data.group_link && (
                    <div className="rounded-md border bg-green-500/10 border-green-500/30 p-3 text-xs space-y-1">
                      <p className="font-semibold text-green-600">Preview da mensagem:</p>
                      <p className="text-foreground/80 whitespace-pre-wrap">
                        {(selectedNode.data.message || '').replace(/\{\{primeiro_nome\}\}/g, 'Carlos').replace(/\{\{nome\}\}/g, 'Carlos Eduardo')}
                      </p>
                      <p className="text-green-600 font-mono text-[11px] mt-1">{selectedNode.data.group_link}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'moveLead' && (
                <BoardColumnPicker
                  boardId={(selectedNode.data.board_id as string) || ''}
                  columnId={(selectedNode.data.column_id as string) || ''}
                  onChange={(boardId, columnId) => updateNodeData(selectedNode.id, { board_id: boardId, column_id: columnId })}
                />
              )}

              {selectedNode.type === 'assignTo' && (
                <AssigneePicker
                  value={(selectedNode.data.assigned_to as string) || ''}
                  onChange={(v) => updateNodeData(selectedNode.id, { assigned_to: v })}
                />
              )}

              {selectedNode.type === 'updateScore' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Delta (positivo soma, negativo subtrai)</Label>
                    <Input
                      type="number"
                      value={(selectedNode.data.delta as number) ?? 10}
                      onChange={(e) => updateNodeData(selectedNode.id, { delta: Number(e.target.value) })}
                      placeholder="+10"
                    />
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                    Score fica entre 0 e 100. Use <code>+10</code> pra premiar engajamento, <code>-20</code> pra penalizar inatividade.
                  </div>
                </div>
              )}

              {selectedNode.type === 'notifyTeam' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Título da notificação</Label>
                    <Input
                      value={(selectedNode.data.title as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { title: e.target.value })}
                      placeholder="Lead quente {{nome}}"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mensagem</Label>
                    <Textarea
                      value={(selectedNode.data.message as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                      placeholder="{{nome}} engajou. Liga agora."
                      rows={3}
                    />
                  </div>
                  <AssigneePicker
                    label="Notificar membro específico (opcional)"
                    value={(selectedNode.data.member_id as string) || ''}
                    onChange={(v) => updateNodeData(selectedNode.id, { member_id: v })}
                  />
                </div>
              )}

              {selectedNode.type === 'webhook' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">URL externa (POST)</Label>
                    <Input
                      type="url"
                      value={(selectedNode.data.url as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })}
                      placeholder="https://hooks.zapier.com/..."
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-medium text-foreground">Payload enviado:</p>
                    <pre className="text-[10px] leading-snug font-mono">
{`{
  event: "automation_step",
  automation_id, run_id,
  lead: { id, name, email, ... },
  extra: {} // custom field abaixo
}`}
                    </pre>
                  </div>
                  <div>
                    <Label className="text-xs">Extra (JSON opcional)</Label>
                    <Textarea
                      value={JSON.stringify(selectedNode.data.payload || {}, null, 2)}
                      onChange={(e) => {
                        try { updateNodeData(selectedNode.id, { payload: JSON.parse(e.target.value) }); }
                        catch { /* deixa o user terminar de digitar */ }
                      }}
                      rows={3}
                      className="font-mono text-[11px]"
                      placeholder='{"source": "automation"}'
                    />
                  </div>
                </div>
              )}

              {selectedNode.type === 'waitBusinessHours' && (
                <div className="rounded-md border bg-amber-500/10 border-amber-500/30 p-3 text-xs space-y-1.5">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    ⏰ Esse passo NÃO tem configuração.
                  </p>
                  <p className="text-muted-foreground">
                    Se a automação chegar aqui durante <strong>fim de semana</strong> ou <strong>fora do horário 9h-18h Brasil</strong>, o fluxo espera até a próxima segunda 9h (ou próximo dia útil 9h).
                  </p>
                  <p className="text-muted-foreground">
                    Útil pra evitar email/WhatsApp às 3h da manhã ou domingo de tarde.
                  </p>
                </div>
              )}

              {selectedNode.type === 'end' && (
                <div>
                  <Label className="text-xs">Motivo do fim</Label>
                  <Select
                    value={(selectedNode.data.reason as string) || 'completed'}
                    onValueChange={(v) => updateNodeData(selectedNode.id, { reason: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Concluído (objetivo atingido)</SelectItem>
                      <SelectItem value="goal">Goal alcançado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="no_match">Não se aplica mais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

            </div>
          )}
          <DialogFooter className="flex sm:justify-between gap-2">
            {selectedNode && selectedNode.type !== 'trigger' ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive gap-2"
                onClick={() => deleteNode(selectedNode.id)}
              >
                <Trash2 className="h-4 w-4" /> Remover passo
              </Button>
            ) : <div />}
            <Button
              onClick={() => setSelectedNode(null)}
              className="bg-[#BAA05E] hover:bg-[#917D3D]"
            >
              Pronto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {id && id !== 'nova' && (
        <AutomationReportSheet
          open={reportOpen}
          onOpenChange={setReportOpen}
          automationId={id}
          automationName={name}
        />
      )}
    </AppLayout>
  );
}

// ============================================================
// Helpers — pickers usados pelos novos passos
// ============================================================

function BoardColumnPicker({ boardId, columnId, onChange }: {
  boardId: string;
  columnId: string;
  onChange: (boardId: string, columnId: string) => void;
}) {
  const { data: opts, isLoading } = useAudienceOptions();
  const visibleColumns = (opts?.allColumns || []).filter((c) => !boardId || c.board_id === boardId);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Board destino</Label>
        <Select value={boardId} onValueChange={(v) => onChange(v, '')}>
          <SelectTrigger><SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione um board'} /></SelectTrigger>
          <SelectContent>
            {(opts?.boards || []).map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Coluna destino</Label>
        <Select value={columnId} onValueChange={(v) => onChange(boardId, v)} disabled={!boardId}>
          <SelectTrigger>
            <SelectValue placeholder={boardId ? 'Selecione a coluna' : 'Escolha o board primeiro'} />
          </SelectTrigger>
          <SelectContent>
            {visibleColumns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Lead é movido pra essa coluna quando a automação rodar esse passo.
      </p>
    </div>
  );
}

function AssigneePicker({ value, onChange, label = 'Vendedor responsável' }: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const { data: members = [], isLoading } = useTeamMembers();

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione um membro'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassigned__">Sem responsável</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isLoading && members.length === 0 && (
        <p className="text-[11px] text-amber-600 mt-1.5">
          Nenhum vendedor cadastrado ainda. Cadastre a equipe em{' '}
          <a href="/admin/equipe" target="_blank" rel="noreferrer" className="underline font-medium">Equipe</a>{' '}
          para escolher aqui.
        </p>
      )}
    </div>
  );
}
