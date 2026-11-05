import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Search, Workflow, MoreVertical, Pencil, Trash2, Zap, Users, Target,
  MessageSquare, Clock, CheckCircle2, AlertCircle, Server, Database, Play,
  Pause, Radio, Send, Eye, MessageCircle, BarChart3,
} from 'lucide-react';
import { useAutomationStats } from '@/hooks/useAutomationStats';
import AutomationReportSheet from '@/components/marketing-mod/AutomationReportSheet';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useEmailAutomations, useDeleteEmailAutomation, useToggleEmailAutomation,
} from '@/hooks/useEmailAutomations';
import {
  useGroupCadences, useDeleteGroupCadence, useStartGroupCadence, useSetCadenceStatus,
} from '@/hooks/useGroupCadences';
import {
  useSystemAutomations, useToggleSystemAutomation, agendaEmBrasilia,
} from '@/hooks/useSystemAutomations';
import { cn } from '@/lib/utils';
import MarketingPageHeader from '@/components/marketing-mod/MarketingPageHeader';

const TRIGGER_META: Record<string, { label: string; icon: any; color: string }> = {
  lead_created:         { label: 'Lead criado',           icon: Users,    color: 'text-blue-500 bg-blue-500/10' },
  lead_column_changed:  { label: 'Lead mudou de coluna',  icon: Target,   color: 'text-cyan-500 bg-cyan-500/10' },
  lead_board_changed:   { label: 'Lead mudou de board',   icon: Target,   color: 'text-cyan-500 bg-cyan-500/10' },
  lead_tag_added:       { label: 'Tag adicionada',        icon: Target,   color: 'text-emerald-500 bg-emerald-500/10' },
  lead_score_changed:   { label: 'Score atingiu limite',  icon: Target,   color: 'text-indigo-500 bg-indigo-500/10' },
  email_opened:         { label: 'E-mail aberto',         icon: Target,   color: 'text-amber-500 bg-amber-500/10' },
  email_clicked:        { label: 'E-mail clicado',        icon: Target,   color: 'text-amber-500 bg-amber-500/10' },
  lead_birthday:        { label: 'Aniversário do lead',   icon: Target,   color: 'text-pink-500 bg-pink-500/10' },
  lead_inactive:        { label: 'Lead inativo',          icon: Target,   color: 'text-red-500 bg-red-500/10' },
  lead_stage_changed:   { label: 'Lead mudou de etapa',   icon: Target,   color: 'text-cyan-500 bg-cyan-500/10' },
  deal_created:         { label: 'Deal criado',           icon: Target,   color: 'text-blue-500 bg-blue-500/10' },
  deal_won:             { label: 'Deal fechado (ganho)',  icon: Target,   color: 'text-emerald-500 bg-emerald-500/10' },
  deal_lost:            { label: 'Deal perdido',          icon: Target,   color: 'text-red-500 bg-red-500/10' },
  organization_created: { label: 'Cliente novo',          icon: Users,    color: 'text-amber-500 bg-amber-500/10' },
  custom:               { label: 'Customizado',           icon: Zap,      color: 'text-purple-500 bg-purple-500/10' },
};
const FALLBACK_META = { label: 'Desconhecido', icon: Zap, color: 'text-gray-500 bg-gray-500/10' };

const STATUS_CADENCIA: Record<string, { label: string; classe: string }> = {
  draft:     { label: 'Rascunho', classe: 'bg-muted text-muted-foreground' },
  running:   { label: 'Rodando',  classe: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  paused:    { label: 'Pausada',  classe: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Concluída',classe: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
};

export default function MarketingAutomations() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: automations = [], isLoading } = useEmailAutomations();
  const { data: statsMap = {} } = useAutomationStats();
  const [relatorio, setRelatorio] = useState<{ id: string; name: string } | null>(null);
  const deleteAutomation = useDeleteEmailAutomation();
  const toggleAutomation = useToggleEmailAutomation();

  const { data: cadencias = [], isLoading: carregandoCadencias } = useGroupCadences();
  const deleteCadencia = useDeleteGroupCadence();
  const iniciarCadencia = useStartGroupCadence();
  const statusCadencia = useSetCadenceStatus();

  const { data: sistema, isLoading: carregandoSistema } = useSystemAutomations();
  const toggleSistema = useToggleSystemAutomation();

  const q = search.trim().toLowerCase();
  const filtered = automations.filter((a) => !q || a.name.toLowerCase().includes(q));
  const cadenciasFiltradas = cadencias.filter((c) => !q || c.name.toLowerCase().includes(q));

  const sistemaPorCategoria = useMemo(() => {
    if (!sistema) return [] as [string, any[]][];
    const todas = [...(sistema.crons || []), ...(sistema.triggers || [])].filter(
      (a: any) => !q || a.label.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q),
    );
    const mapa = new Map<string, any[]>();
    for (const a of todas) {
      if (!mapa.has(a.category)) mapa.set(a.category, []);
      mapa.get(a.category)!.push(a);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sistema, q]);

  const sistemaAtivas = (sistema?.crons || []).filter((c) => c.active).length
    + (sistema?.triggers || []).filter((t) => t.active).length;

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
        <MarketingPageHeader
          eyebrow="Marketing · Automações"
          title="Automações"
          description={
            <>Tudo que roda sozinho: fluxos por lead, cadência dentro dos grupos de WhatsApp e as rotinas do sistema.</>
          }
        />

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar automação..."
            className="pl-9"
          />
        </div>

        <Tabs defaultValue="fluxos">
          <TabsList>
            <TabsTrigger value="fluxos" className="gap-1.5">
              <Workflow className="h-3.5 w-3.5" /> Fluxos por lead
              <Badge variant="secondary" className="ml-1 text-[10px]">{automations.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="grupos" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Cadência em grupos
              <Badge variant="secondary" className="ml-1 text-[10px]">{cadencias.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="sistema" className="gap-1.5">
              <Server className="h-3.5 w-3.5" /> Do sistema
              <Badge variant="secondary" className="ml-1 text-[10px]">{sistemaAtivas}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ---------------------------------------------- fluxos por lead */}
          <TabsContent value="fluxos" className="space-y-3 mt-5">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5"
                onClick={() => navigate('/admin/marketing/automacoes/nova')}
              >
                <Plus className="h-3.5 w-3.5" /> Novo fluxo
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#BAA05E]/10 flex items-center justify-center mx-auto">
                    <Workflow className="h-7 w-7 text-[#BAA05E]" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {search ? 'Nenhum fluxo encontrado' : 'Nenhum fluxo ainda'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                      Fluxos disparados por um gatilho do lead: entrou no funil → e-mail → espera 2 dias → WhatsApp.
                    </p>
                  </div>
                  {!search && (
                    <Button
                      onClick={() => navigate('/admin/marketing/automacoes/nova')}
                      className="bg-[#BAA05E] hover:bg-[#917D3D] gap-2"
                    >
                      <Plus className="h-4 w-4" /> Criar primeiro fluxo
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filtered.map((a) => {
                const meta = TRIGGER_META[a.trigger_event] || FALLBACK_META;
                const Icon = meta.icon;
                const stepsCount = a.flow_json?.nodes?.length || 0;
                return (
                  <Card
                    key={a.id}
                    className="group hover:border-[#BAA05E]/50 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/admin/marketing/automacoes/${a.id}`)}
                  >
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', meta.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            Quando: {meta.label}
                          </Badge>
                          {a.is_active ? (
                            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Pausada</Badge>
                          )}
                        </div>
                        <h3 className="font-semibold truncate">{a.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stepsCount} {stepsCount === 1 ? 'passo' : 'passos'} ·{' '}
                          Atualizado {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true, locale: ptBR })}
                        </p>
                        {(() => {
                          const st = statsMap[a.id];
                          if (!st) return null;
                          return (
                            <div className="flex items-center gap-3 flex-wrap mt-2 text-xs">
                              <span className="flex items-center gap-1" title="Pessoas que entraram no fluxo">
                                <Users className="h-3 w-3 text-[#BAA05E]" /> <strong>{st.entraram}</strong> entraram
                              </span>
                              {(st.emails_enviados > 0 || st.emails_falhas > 0) && (
                                <span className="flex items-center gap-1" title="E-mails enviados · entregues · abertos">
                                  <Send className="h-3 w-3 text-sky-600" /> <strong>{st.emails_enviados}</strong> e-mails
                                  <span className="text-muted-foreground">({st.emails_entregues} entregues · {st.emails_abertos} abertos)</span>
                                </span>
                              )}
                              {(st.whatsapp_enviados > 0 || st.whatsapp_falhas > 0) && (
                                <span className="flex items-center gap-1" title="WhatsApp enviados · lidos">
                                  <MessageCircle className="h-3 w-3 text-emerald-600" /> <strong>{st.whatsapp_enviados}</strong> WhatsApp
                                  <span className="text-muted-foreground">({st.whatsapp_lidos} lidos)</span>
                                </span>
                              )}
                              {(st.emails_falhas + st.whatsapp_falhas + st.falharam) > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <AlertCircle className="h-3 w-3" /> {st.emails_falhas + st.whatsapp_falhas + st.falharam} falha(s)
                                </span>
                              )}
                              {st.ultimo_envio && (
                                <span className="text-muted-foreground">
                                  último envio {formatDistanceToNow(new Date(st.ultimo_envio), { addSuffix: true, locale: ptBR })}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <Button
                        variant="outline" size="sm" className="gap-1.5 shrink-0"
                        onClick={(e) => { e.stopPropagation(); setRelatorio({ id: a.id, name: a.name }); }}
                      >
                        <BarChart3 className="h-3.5 w-3.5" /> Ver envios
                      </Button>
                      <Switch
                        checked={a.is_active}
                        onCheckedChange={(v) => toggleAutomation.mutate({ id: a.id, isActive: v })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/marketing/automacoes/${a.id}`); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remover "${a.name}"?`)) deleteAutomation.mutate(a.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ---------------------------------------------- cadência em grupos */}
          <TabsContent value="grupos" className="space-y-3 mt-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground max-w-2xl">
                Sequência de mensagens postadas <strong>dentro dos grupos</strong> de WhatsApp, com intervalo entre
                cada passo. Roda pela linha não-oficial (UAZAPI) — a API oficial da Meta não envia para grupos.
              </p>
              <Button
                size="sm"
                className="bg-[#25d366] hover:bg-[#128C7E] text-white gap-1.5"
                onClick={() => navigate('/admin/marketing/cadencias-grupo/nova')}
              >
                <Plus className="h-3.5 w-3.5" /> Nova cadência
              </Button>
            </div>

            {carregandoCadencias ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : cadenciasFiltradas.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#25d366]/10 flex items-center justify-center mx-auto">
                    <MessageSquare className="h-7 w-7 text-[#25d366]" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {search ? 'Nenhuma cadência encontrada' : 'Nenhuma cadência de grupo ainda'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                      Ex.: aquecimento de lançamento — dia 0 o convite, dia 2 a prova social, dia 4 a chamada final,
                      tudo postado nos grupos escolhidos.
                    </p>
                  </div>
                  {!search && (
                    <Button
                      onClick={() => navigate('/admin/marketing/cadencias-grupo/nova')}
                      className="bg-[#25d366] hover:bg-[#128C7E] gap-2 text-white"
                    >
                      <Plus className="h-4 w-4" /> Criar primeira cadência
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              cadenciasFiltradas.map((c) => {
                const st = STATUS_CADENCIA[c.status] || STATUS_CADENCIA.draft;
                const grupos = (c.group_jids || []).length;
                return (
                  <Card
                    key={c.id}
                    className="group hover:border-[#25d366]/50 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/admin/marketing/cadencias-grupo/${c.id}`)}
                  >
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#25d366]/10 text-[#128C7E] flex items-center justify-center">
                        <Radio className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={cn('text-[10px]', st.classe)}>{st.label}</Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {grupos} grupo{grupos === 1 ? '' : 's'}
                          </Badge>
                        </div>
                        <h3 className="font-semibold truncate">{c.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.sent_count} enviada{c.sent_count === 1 ? '' : 's'}
                          {c.failed_count > 0 && ` · ${c.failed_count} falha(s)`}
                          {' · '}janela {String(c.window_start).slice(0, 5)}–{String(c.window_end).slice(0, 5)}
                          {c.started_at &&
                            ` · começou ${formatDistanceToNow(new Date(c.started_at), { addSuffix: true, locale: ptBR })}`}
                        </p>
                      </div>

                      {c.status === 'running' ? (
                        <Button
                          variant="outline" size="sm" className="gap-1.5"
                          onClick={(e) => { e.stopPropagation(); statusCadencia.mutate({ id: c.id, status: 'paused' }); }}
                        >
                          <Pause className="h-3.5 w-3.5" /> Pausar
                        </Button>
                      ) : c.status !== 'completed' ? (
                        <Button
                          variant="outline" size="sm" className="gap-1.5"
                          onClick={(e) => { e.stopPropagation(); iniciarCadencia.mutate(c.id); }}
                        >
                          <Play className="h-3.5 w-3.5" /> Iniciar
                        </Button>
                      ) : null}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/marketing/cadencias-grupo/${c.id}`); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remover "${c.name}"?`)) deleteCadencia.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ---------------------------------------------- automações do sistema */}
          <TabsContent value="sistema" className="space-y-5 mt-5">
            <p className="text-xs text-muted-foreground max-w-3xl">
              Estas rotinas já rodavam no banco sem aparecer em lugar nenhum. Os agendamentos podem ser
              pausados aqui; os gatilhos de tabela são só leitura (mexer neles é mudança de código).
              O status mostrado é a <strong>resposta real</strong> da última execução — o agendador marca
              “sucesso” só por ter disparado, mesmo quando a função responde erro.
            </p>

            {carregandoSistema ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />)}
              </div>
            ) : !sistema ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Não consegui ler as automações do sistema (precisa ser admin).
                </CardContent>
              </Card>
            ) : (
              <TooltipProvider>
                {sistemaPorCategoria.map(([categoria, itens]) => (
                  <div key={categoria} className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {categoria}
                    </h3>
                    <div className="space-y-2">
                      {itens.map((a: any) => {
                        const ehCron = a.source === 'cron';
                        const erroHttp = ehCron && a.http_status != null && a.http_status >= 400;
                        // 200 com {"ok":false} é falha que o status HTTP não denuncia
                        const erroSilencioso = ehCron && a.soft_error;
                        const problema = erroHttp || erroSilencioso;
                        return (
                          <Card key={a.key} className={cn(problema && 'border-destructive/40')}>
                            <CardContent className="p-4 flex items-center gap-3">
                              <div
                                className={cn(
                                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                                  ehCron ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-500/10 text-slate-500',
                                )}
                              >
                                {ehCron ? <Clock className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{a.label}</span>
                                  {ehCron ? (
                                    <Badge variant="outline" className="text-[10px]">
                                      {agendaEmBrasilia(a.schedule)}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                      {a.target_table}
                                    </Badge>
                                  )}
                                  {erroHttp && (
                                    <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                                      <AlertCircle className="h-3 w-3 mr-1" /> HTTP {a.http_status}
                                    </Badge>
                                  )}
                                  {erroSilencioso && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 cursor-help">
                                          <AlertCircle className="h-3 w-3 mr-1" /> não está funcionando
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm text-xs">
                                        A chamada foi entregue (HTTP 200), mas a função respondeu que não
                                        conseguiu executar. Veja o motivo na linha abaixo.
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {ehCron && !problema && a.http_status === 200 && (
                                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                      <CheckCircle2 className="h-3 w-3 mr-1" /> ok
                                    </Badge>
                                  )}
                                  {ehCron && a.kind === 'http' && !a.instrumented && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="secondary" className="text-[10px] cursor-help">
                                          aguardando 1ª execução
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-xs">
                                        Ainda não rodou desde que a telemetria foi ligada. Na próxima execução
                                        o resultado real aparece aqui.
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {ehCron && a.kind === 'sql' && (
                                    <Badge variant="outline" className="text-[10px]">
                                      roda no banco
                                    </Badge>
                                  )}
                                </div>
                                {a.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                                )}
                                {ehCron && a.last_run_at && (
                                  <p
                                    className={cn(
                                      'text-[11px] mt-1',
                                      problema ? 'text-destructive' : 'text-muted-foreground',
                                    )}
                                  >
                                    Rodou {formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true, locale: ptBR })}
                                    {a.kind === 'http' && a.http_body
                                      ? ` · ${a.http_body.slice(0, 110)}`
                                      : a.kind === 'sql' && a.cron_message
                                        ? ` · ${a.cron_message.slice(0, 110)}`
                                        : ''}
                                  </p>
                                )}
                                {!ehCron && !a.exists && (
                                  <p className="text-[11px] text-destructive mt-1">
                                    Esse gatilho está no catálogo mas não existe mais no banco.
                                  </p>
                                )}
                              </div>

                              {ehCron ? (
                                <Switch
                                  checked={a.active}
                                  onCheckedChange={(v) =>
                                    toggleSistema.mutate({ jobname: a.key, active: v })
                                  }
                                />
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px]',
                                    a.active
                                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {a.active ? 'ativo' : 'desligado'}
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TooltipProvider>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {relatorio && (
        <AutomationReportSheet
          open={!!relatorio}
          onOpenChange={(v) => { if (!v) setRelatorio(null); }}
          automationId={relatorio.id}
          automationName={relatorio.name}
        />
      )}
    </AppLayout>
  );
}
