import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mail, Send, Eye, MousePointerClick, AlertTriangle, ChevronLeft, ChevronRight,
  Loader2, ExternalLink, Activity, PlayCircle, CheckCircle2, XCircle, MessageCircle, Users,
} from 'lucide-react';
import { useAutomationStats, useAutomationWhatsappLog } from '@/hooks/useAutomationStats';
import { useAutomationSends, useAutomationRuns, type EmailSendLogRow } from '@/hooks/useEmailMarketing';
import EmailTimelineModal from '@/components/client360/EmailTimelineModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const SEND_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'text-gray-700 bg-gray-100' },
  sent: { label: 'Enviado', color: 'text-sky-700 bg-sky-50' },
  delivered: { label: 'Entregue', color: 'text-teal-700 bg-teal-50' },
  opened: { label: 'Aberto', color: 'text-indigo-700 bg-indigo-50' },
  clicked: { label: 'Clicado', color: 'text-purple-700 bg-purple-50' },
  bounced: { label: 'Bounce', color: 'text-red-700 bg-red-50' },
  failed: { label: 'Falhou', color: 'text-red-700 bg-red-50' },
};

const WA_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Na fila', color: 'text-gray-700 bg-gray-100' },
  sent: { label: 'Enviado', color: 'text-sky-700 bg-sky-50' },
  delivered: { label: 'Entregue', color: 'text-teal-700 bg-teal-50' },
  read: { label: 'Lido', color: 'text-indigo-700 bg-indigo-50' },
  failed: { label: 'Não enviado', color: 'text-red-700 bg-red-50' },
};

const RUN_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Em execução', color: 'text-amber-700 bg-amber-50', icon: PlayCircle },
  completed: { label: 'Concluído', color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'text-red-700 bg-red-50', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'text-gray-700 bg-gray-100', icon: XCircle },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  automationName: string;
}

export default function AutomationReportSheet({ open, onOpenChange, automationId, automationName }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'sends' | 'whatsapp' | 'runs'>('sends');
  const [sendsPage, setSendsPage] = useState(0);
  const [runsPage, setRunsPage] = useState(0);
  const [selectedSend, setSelectedSend] = useState<EmailSendLogRow | null>(null);

  const { data: sends, isLoading: sendsLoading } = useAutomationSends(automationId, sendsPage, 25);
  const { data: runs, isLoading: runsLoading } = useAutomationRuns(automationId, runsPage, 25);
  const { data: statsMap } = useAutomationStats();
  const stats = statsMap?.[automationId];
  const { data: waRows = [], isLoading: waLoading } = useAutomationWhatsappLog(automationId, open);

  const sendRows = sends?.rows || [];
  const sendTotal = sends?.total || 0;
  const sendTotalPages = Math.max(1, Math.ceil(sendTotal / 25));

  const runRows = runs?.rows || [];
  const runTotal = runs?.total || 0;
  const runTotalPages = Math.max(1, Math.ceil(runTotal / 25));

  const modalMetadata = useMemo(() => {
    if (!selectedSend) return null;
    return {
      send_id: selectedSend.id,
      campaign_id: selectedSend.campaign_id,
      campaign_name: selectedSend.campaign?.name,
      subject: selectedSend.campaign?.subject || '',
      to_email: selectedSend.email,
      status: selectedSend.status,
      html: selectedSend.html,
      sent_at: selectedSend.sent_at,
      delivered_at: selectedSend.delivered_at,
      opened_at: selectedSend.opened_at,
      clicked_at: selectedSend.clicked_at,
      bounced_at: selectedSend.bounced_at,
      bounce_reason: selectedSend.bounce_reason,
      open_count: selectedSend.open_count || 0,
      click_count: selectedSend.click_count || 0,
      clicked_url: selectedSend.clicked_url,
    };
  }, [selectedSend]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col gap-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                Relatório · Automação
              </span>
            </div>
            <SheetTitle className="text-lg leading-tight tracking-tight">
              {automationName}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Envios disparados por essa automação e quem está executando.
            </SheetDescription>

            {/* KPIs — totais reais da automação (não só da página carregada) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
              {[
                { label: 'Pessoas que entraram', value: stats?.entraram ?? 0, icon: Users, color: 'text-[#BAA05E]',
                  sub: stats ? `${stats.em_andamento} em andamento · ${stats.concluidos} concluídas` : '' },
                { label: 'E-mails enviados', value: stats?.emails_enviados ?? 0, icon: Send, color: 'text-sky-600',
                  sub: stats ? `${stats.emails_entregues} entregues${stats.emails_falhas ? ` · ${stats.emails_falhas} falharam` : ''}` : '' },
                { label: 'E-mails abertos', value: stats?.emails_abertos ?? 0, icon: Eye, color: 'text-indigo-600',
                  sub: stats ? `${stats.emails_clicados} clicaram` : '' },
                { label: 'WhatsApp enviados', value: stats?.whatsapp_enviados ?? 0, icon: MessageCircle, color: 'text-emerald-600',
                  sub: stats ? `${stats.whatsapp_lidos} lidos${stats.whatsapp_falhas ? ` · ${stats.whatsapp_falhas} não enviados` : ''}` : '' },
              ].map((k) => (
                <div key={k.label} className="rounded-md border p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className="text-lg font-semibold flex items-center gap-1.5">
                    <k.icon className={cn('h-3.5 w-3.5', k.color)} />
                    {k.value}
                  </p>
                  {k.sub && <p className="text-[10px] text-muted-foreground">{k.sub}</p>}
                </div>
              ))}
            </div>
          </SheetHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-3 self-start">
              <TabsTrigger value="sends" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> E-mails <Badge variant="outline" className="ml-1 text-[10px]">{sendTotal}</Badge>
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp <Badge variant="outline" className="ml-1 text-[10px]">{waRows.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="runs" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Execuções <Badge variant="outline" className="ml-1 text-[10px]">{runTotal}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Envios */}
            <TabsContent value="sends" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              {sendsLoading ? (
                <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : sendRows.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum email enviado por essa automação ainda</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sendRows.map((r) => {
                    const status = SEND_STATUS[r.status] || { label: r.status, color: 'text-gray-700 bg-gray-100' };
                    return (
                      <div
                        key={r.id}
                        className="group flex items-center gap-3 p-2.5 rounded-md border hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedSend(r)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{r.lead?.name || '—'}</p>
                            <Badge className={cn('text-[10px] border-0', status.color)}>{status.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                          {(r.open_count || 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-indigo-600">
                              <Eye className="h-3 w-3" /> {r.open_count}
                            </span>
                          )}
                          {(r.click_count || 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-purple-600">
                              <MousePointerClick className="h-3 w-3" /> {r.click_count}
                            </span>
                          )}
                          <span className="whitespace-nowrap">
                            {r.sent_at ? format(new Date(r.sent_at), "dd/MM HH:mm", { locale: ptBR }) : '—'}
                          </span>
                          {r.lead?.id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/crm?lead=${r.lead!.id}`); }}
                              className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Abrir lead"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {sendTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t text-xs text-muted-foreground">
                  <span>Página {sendsPage + 1} de {sendTotalPages}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={sendsPage === 0} onClick={() => setSendsPage(p => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={sendsPage >= sendTotalPages - 1} onClick={() => setSendsPage(p => p + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* WhatsApp */}
            <TabsContent value="whatsapp" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              {waLoading ? (
                <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : waRows.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum WhatsApp enviado por essa automação ainda</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {waRows.map((r, i) => {
                    const st = WA_STATUS[r.status] || { label: r.status, color: 'text-gray-700 bg-gray-100' };
                    return (
                      <div key={`${r.quando}-${i}`} className="group flex items-center gap-3 p-2.5 rounded-md border hover:bg-accent/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{r.lead_nome || '—'}</p>
                            <Badge className={cn('text-[10px] border-0', st.color)}>{st.label}</Badge>
                          </div>
                          <p className={cn('text-xs truncate', r.status === 'failed' ? 'text-red-600' : 'text-muted-foreground')}>
                            {r.status === 'failed' ? (r.erro || 'Falhou') : (r.telefone || '')}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(r.quando), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                        {r.lead_id && (
                          <button
                            onClick={() => navigate(`/admin/crm?lead=${r.lead_id}`)}
                            className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Abrir lead"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Runs */}
            <TabsContent value="runs" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              {runsLoading ? (
                <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : runRows.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma execução dessa automação ainda</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {runRows.map((r: any) => {
                    const cfg = RUN_STATUS[r.status] || { label: r.status, color: 'text-gray-700 bg-gray-100', icon: Activity };
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={r.id}
                        className="group flex items-center gap-3 p-2.5 rounded-md border hover:bg-accent/30 transition-colors"
                      >
                        <StatusIcon className={cn('h-4 w-4 shrink-0', cfg.color.split(' ')[0])} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{r.lead?.name || '—'}</p>
                            <Badge className={cn('text-[10px] border-0', cfg.color)}>{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Iniciado {format(new Date(r.started_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            {r.completed_at && ` · Finalizado ${format(new Date(r.completed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                          </p>
                        </div>
                        {r.lead?.id && (
                          <button
                            onClick={() => navigate(`/admin/crm?lead=${r.lead!.id}`)}
                            className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Abrir lead"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {runTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t text-xs text-muted-foreground">
                  <span>Página {runsPage + 1} de {runTotalPages}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={runsPage === 0} onClick={() => setRunsPage(p => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={runsPage >= runTotalPages - 1} onClick={() => setRunsPage(p => p + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <EmailTimelineModal
        open={!!selectedSend}
        onOpenChange={(open) => { if (!open) setSelectedSend(null); }}
        metadata={modalMetadata}
      />
    </>
  );
}
