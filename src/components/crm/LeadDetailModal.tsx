import React, { useState, useEffect, useMemo } from 'react';
import {
  User, Phone, Instagram, MessageSquare, Video, Clock, Brain, FileText,
  CheckSquare, Globe, Rocket, ListOrdered, Calendar, Star, Mail, Copy,
  Trophy, ChevronLeft, Pencil, Building2, Workflow, TrendingUp, Loader2,
  ChevronDown, Check, Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LeadTimeline } from './LeadTimeline';
import { LeadProfileTab } from './LeadProfileTab';
import { CallButton } from '@/components/calls/CallButton';
import { WhatsAppChat } from './WhatsAppChat';
import { MeetingsTab } from './MeetingsTab';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { LeadOnboardingTab } from './LeadOnboardingTab';
import { LeadInsightsTab } from './LeadInsightsTab';
import { LeadDataTab } from './lead-view/LeadDataTab';
import { LeadDossierTab } from './lead-view/LeadDossierTab';
import AgentPauseControl from './AgentPauseControl';
import ActivateAsMemberButton from './ActivateAsMemberButton';
import { WhatsAppLeadTab } from './lead-view/WhatsAppLeadTab';
import { InstagramEvolutionTab } from './lead-view/InstagramEvolutionTab';
import { LeadTasksTab } from './lead-view/LeadTasksTab';
import { LeadSidebar } from './lead-view/LeadSidebar';
import { LeadForm } from './LeadForm';
import { PostSaleTracker } from './PostSaleTracker';
import { LeadCadenceEnrollment } from './LeadCadenceEnrollment';
import { LeadSocialSellingTab } from './lead-view/LeadSocialSellingTab';
import { DiscPdfPanel } from './DiscPdfPanel';
import { OnboardingPanel } from './OnboardingPanel';
import { FinalStageDialog } from './FinalStageDialog';
import { normalizePhoneBR } from '@/lib/phone';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CRMLead {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  whatsapp_profile_pic_url?: string;
  company_name?: string;
  notes?: string;
  tags?: string[];
  lead_score: number;
  potential_value?: number;
  scheduled_call_at?: string;
  priority: string;
  column_id: string;
  source?: string;
  created_at?: string;
  first_contact_at?: string;
  assigned_to?: string | null;
  source_lead_id?: string | null;
}

interface CRMColumn {
  id: string;
  name: string;
}

interface CRMBoard {
  id: string;
  name: string;
  slug: string;
}

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: CRMLead | null;
  columns: CRMColumn[];
  onSave: (lead: Partial<CRMLead>) => Promise<void>;
  mode: 'edit' | 'add';
  defaultColumnId?: string;
  boards?: CRMBoard[];
  activeBoardId?: string;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen, onClose, lead, columns, onSave, mode, defaultColumnId, boards, activeBoardId
}) => {
  const [formData, setFormData] = useState<Partial<CRMLead & { board_id?: string }>>({
    name: '', whatsapp: '', email: '', instagram: '', company_name: '',
    notes: '', tags: [], lead_score: 0, potential_value: undefined,
    scheduled_call_at: '', priority: 'medium', column_id: defaultColumnId || '',
    board_id: activeBoardId || ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState<string>(mode === 'edit' ? 'timeline' : 'edit');
  const [showChat, setShowChat] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [dynamicColumns, setDynamicColumns] = useState<CRMColumn[]>(columns);
  const [movingTo, setMovingTo] = useState<string | null>(null);
  // Cache de columns por board pra renderizar dropdown "Kanban → estagios".
  // Antes o modal recebia `columns` misturado (todos os boards), o que mostrava
  // 50+ chips sem agrupamento. Carregamos uma vez quando o modal abre.
  const [boardColumns, setBoardColumns] = useState<Record<string, { id: string; name: string; is_final_stage?: boolean }[]>>({});
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);
  // Dialog de "Fechado" — abre quando o destino tem is_final_stage. Pergunta
  // ganho/perda + valor do deal antes de fazer o move completo (member,
  // onboarding, financeira). Sem isso o move pra Fechado pula tudo.
  const [finalStageDialogOpen, setFinalStageDialogOpen] = useState(false);
  const [pendingFinalMove, setPendingFinalMove] = useState<{ boardId: string; columnId: string; boardName: string; columnName: string } | null>(null);
  // Fallback: KanbanBoard.tsx nao passa `boards` por prop. Carregamos internamente
  // pra garantir que o cabecalho de Kanbans sempre apareca.
  const [internalBoards, setInternalBoards] = useState<CRMBoard[]>([]);
  const effectiveBoards = (boards && boards.length > 0) ? boards : internalBoards;
  const effectiveActiveBoardId = activeBoardId || (lead as any)?.board_id || '';

  useEffect(() => { setDynamicColumns(columns); }, [columns]);

  // Carrega boards + columns quando o modal abre. Se boards veio por prop usa
  // ele; se nao (caminho do KanbanBoard.tsx), busca do banco como fallback.
  // Columns vem agrupadas por board_id, ordem original do Kanban (sort_order).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      // Boards fallback
      if (!boards || boards.length === 0) {
        const { data: b } = await supabase
          .from('crm_boards')
          .select('id, name, slug')
          .order('sort_order', { ascending: true });
        if (!cancelled && b) setInternalBoards(b as any);
      }
      // Columns por board, incluindo is_final_stage pra detectar coluna "Fechado"
      const { data } = await supabase
        .from('crm_columns')
        .select('id, name, board_id, sort_order, is_final_stage')
        .order('sort_order', { ascending: true });
      if (cancelled || !data) return;
      const grouped: Record<string, { id: string; name: string; is_final_stage?: boolean }[]> = {};
      for (const col of data as any[]) {
        if (!grouped[col.board_id]) grouped[col.board_id] = [];
        grouped[col.board_id].push({ id: col.id, name: col.name, is_final_stage: !!col.is_final_stage });
      }
      setBoardColumns(grouped);
    })();
    return () => { cancelled = true; };
  }, [isOpen, boards]);

  // Executa o move + atividade. extraUpdate carrega closed_at/deal_value/etc
  // quando vem do FinalStageDialog (ganho/perda). UPDATE direto no Supabase pq
  // o `onSave` prop é vazio em varios call sites (AdminCRM auto-open, InlineChat,
  // GlobalSearch).
  const executeMove = async (boardId: string, columnId: string, extraUpdate: Record<string, any> = {}) => {
    if (!lead) return;
    setMovingTo(columnId);
    try {
      const oldBoardName = effectiveBoards.find(b => b.id === effectiveActiveBoardId)?.name || '';
      const newBoardName = effectiveBoards.find(b => b.id === boardId)?.name || '';
      const oldCol = (boardColumns[effectiveActiveBoardId] || columns).find(c => c.id === lead.column_id);
      const newCol = (boardColumns[boardId] || []).find(c => c.id === columnId);
      const boardChanged = boardId !== effectiveActiveBoardId;

      const updatePayload: any = { column_id: columnId, ...extraUpdate };
      if (boardChanged) updatePayload.board_id = boardId;

      const { error: updErr } = await supabase.from('crm_leads').update(updatePayload).eq('id', lead.id);
      if (updErr) throw updErr;

      await supabase.from('crm_activities').insert({
        lead_id: lead.id,
        board_id: boardId,
        activity_type: 'column_change',
        description: boardChanged
          ? `${lead.name} movido de ${oldBoardName} / ${oldCol?.name || '?'} para ${newBoardName} / ${newCol?.name || '?'}`
          : `${lead.name} movido de ${oldCol?.name || '?'} para ${newCol?.name || '?'}`,
        from_column_name: oldCol?.name,
        to_column_name: newCol?.name,
        board_name: newBoardName,
      } as any);

      try { await onSave(updatePayload); } catch {}
      return { newBoardName, newCol };
    } finally {
      setMovingTo(null);
    }
  };

  // Detecta se o destino e' coluna final (Fechado) e abre dialog ganho/perda.
  // Senao, faz o move simples.
  const handleMoveToBoardColumn = async (boardId: string, columnId: string) => {
    if (!lead) return;
    if (columnId === lead.column_id) { setOpenBoardId(null); return; }
    setOpenBoardId(null);

    const targetCol = (boardColumns[boardId] || []).find(c => c.id === columnId);
    const targetBoard = effectiveBoards.find(b => b.id === boardId);
    if (targetCol?.is_final_stage) {
      setPendingFinalMove({
        boardId,
        columnId,
        boardName: targetBoard?.name || '',
        columnName: targetCol.name,
      });
      setFinalStageDialogOpen(true);
      return;
    }

    try {
      const r = await executeMove(boardId, columnId);
      if (r) toast.success(`Movido para ${r.newBoardName ? r.newBoardName + ' / ' : ''}${r.newCol?.name}`);
    } catch (e: any) {
      console.error('[LeadDetailModal] move error:', e);
      toast.error('Erro ao mover: ' + (e?.message || 'desconhecido'));
    }
  };

  // Ganho: marca closed_at + post_sale_stage, cria member, dispara onboarding.
  // Mesma logica do KanbanBoard.handleFinalStageWon (executeColumnMove + side
  // effects). Sem isso o lead Fechado nao aparece em Recebimentos/Clientes 360.
  const handleFinalStageWon = async (dealValue: number | null, _saleData?: any) => {
    if (!pendingFinalMove || !lead) return;
    const { boardId, columnId, boardName, columnName } = pendingFinalMove;
    setFinalStageDialogOpen(false);
    setPendingFinalMove(null);

    const extra: Record<string, any> = {
      closed_at: new Date().toISOString(),
      post_sale_stage: 'awaiting_onboarding',
    };
    if (dealValue !== null) extra.deal_value = dealValue;

    try {
      await executeMove(boardId, columnId, extra);

      // Auto-trigger onboarding pra Fechado (igual KanbanBoard)
      try {
        const { data: onboardingResult } = await supabase.functions.invoke('create-vhs-participant', {
          body: { name: lead.name, whatsapp: lead.whatsapp },
        });
        if (onboardingResult?.onboarding_url) {
          await supabase.from('crm_activities').insert({
            lead_id: lead.id,
            board_id: boardId,
            activity_type: 'onboarding_sent',
            description: `Onboarding enviado automaticamente para ${lead.name}`,
            metadata: { onboarding_url: onboardingResult.onboarding_url, token: onboardingResult.onboarding_token },
          } as any);
          toast.success(`Negocio fechado! Onboarding enviado para ${lead.name}`, {
            description: `Movido para ${boardName} / ${columnName}`,
            action: {
              label: 'Copiar link',
              onClick: () => {
                navigator.clipboard.writeText(onboardingResult.onboarding_url);
                toast.info('Link copiado');
              },
            },
          });
        } else {
          toast.success(`Negocio fechado! Movido para ${boardName} / ${columnName}`);
        }
      } catch (onbErr) {
        console.warn('Erro ao criar onboarding:', onbErr);
        toast.success(`Negocio fechado! Movido para ${boardName} / ${columnName}`);
      }
    } catch (e: any) {
      console.error('[LeadDetailModal] won error:', e);
      toast.error('Erro ao fechar: ' + (e?.message || 'desconhecido'));
    }
  };

  // Perda: registra lost_reason e move normalmente (sem onboarding).
  const handleFinalStageLost = async (reason: string) => {
    if (!pendingFinalMove || !lead) return;
    const { boardId, columnId, boardName, columnName } = pendingFinalMove;
    setFinalStageDialogOpen(false);
    setPendingFinalMove(null);
    try {
      await executeMove(boardId, columnId, {
        lost_reason: reason,
        closed_at: new Date().toISOString(),
      });
      toast.info(`Marcado como perdido: ${reason}`, {
        description: `${boardName} / ${columnName}`,
      });
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || 'desconhecido'));
    }
  };

  // Reset form + activeTab apenas quando troca de lead (ou modo). Depender do
  // objeto `lead` inteiro ou de `columns` causa loop: a subscription realtime
  // do KanbanBoard troca a referencia de `columns` a cada update silencioso.
  useEffect(() => {
    if (mode === 'edit' && lead) {
      setFormData({
        ...lead,
        board_id: activeBoardId || '',
        scheduled_call_at: lead.scheduled_call_at
          ? new Date(lead.scheduled_call_at).toISOString().slice(0, 16) : ''
      });
      setActiveTab('timeline');
      supabase.functions.invoke('calculate-lead-score', { body: { leadId: lead.id } }).catch(() => {});
    } else if (mode === 'add') {
      setFormData({
        name: '', whatsapp: '', email: '', instagram: '', company_name: '',
        notes: '', tags: [], lead_score: 0, potential_value: undefined,
        scheduled_call_at: '', priority: 'medium',
        column_id: defaultColumnId || columns[0]?.id || '',
        board_id: activeBoardId || ''
      });
      setActiveTab('edit');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, mode, activeBoardId]);

  const handleBoardChange = async (boardId: string) => {
    setFormData(prev => ({ ...prev, board_id: boardId, column_id: '' }));
    const { data } = await supabase
      .from('crm_columns')
      .select('id, name')
      .eq('board_id', boardId)
      .order('sort_order', { ascending: true });
    if (data) setDynamicColumns(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!formData.whatsapp?.trim()) { toast.error('WhatsApp é obrigatório'); return; }
    setIsLoading(true);
    try {
      const dataToSave = {
        ...formData,
        whatsapp: normalizePhoneBR(formData.whatsapp || ''),
        scheduled_call_at: formData.scheduled_call_at
          ? new Date(formData.scheduled_call_at).toISOString() : null
      };
      await onSave(dataToSave);
      toast.success(mode === 'add' ? 'Lead criado!' : 'Lead atualizado!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    } finally { setIsLoading(false); }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), newTag.trim()] }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags?.filter(t => t !== tagToRemove) || [] }));
  };

  const handleMoveToColumn = async (columnId: string) => {
    if (!lead || columnId === lead.column_id) return;
    setMovingTo(columnId);
    try {
      const oldCol = columns.find(c => c.id === lead.column_id);
      const newCol = columns.find(c => c.id === columnId);
      await onSave({ column_id: columnId });
      await supabase.from('crm_activities').insert({
        lead_id: lead.id,
        activity_type: 'column_change',
        description: `${lead.name} movido de ${oldCol?.name} para ${newCol?.name}`,
        from_column_name: oldCol?.name,
        to_column_name: newCol?.name,
      });
      toast.success(`Movido para ${newCol?.name}`);
    } catch (e: any) {
      toast.error('Erro ao mover');
    } finally {
      setMovingTo(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const handleOpenOpportunity = (oppId: string) => {
    if (oppId === lead?.id) return;
    // KanbanBoard escuta esse evento e troca o lead selecionado mantendo
    // o modal aberto, evitando flash de fechar+abrir.
    window.dispatchEvent(new CustomEvent('crm:open-lead', { detail: { leadId: oppId } }));
  };

  // TEMPO NA BASE: prioriza first_contact_at (cross-board), fallback created_at
  const baseDate = lead?.first_contact_at || lead?.created_at;
  const timeInFunnel = baseDate
    ? formatDistanceToNow(new Date(baseDate), { locale: ptBR })
    : null;

  // CDN do WhatsApp (pps.whatsapp.net) bloqueia hotlinking — sem proxy, a <img>
  // falha silenciosamente. Instagram do storage do Supabase ja' eh hospedado
  // pelo nosso lado, nao precisa de proxy. weserv.nl resolve CORS de qualquer URL.
  const proxyImg = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.includes('pps.whatsapp.net') || url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}`;
    }
    return url;
  };
  const igAvatar = proxyImg(lead?.instagram_profile_pic_url);
  const waAvatar = proxyImg((lead as any)?.whatsapp_profile_pic_url);
  const initials = lead?.name
    ? lead.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const isWon = !!(lead as any)?.closed_at && !(lead as any)?.lost_reason;
  const currentBoardName = effectiveBoards.find(b => b.id === effectiveActiveBoardId)?.name || '';

  const TAB_DEFS: { value: string; icon: any; label: string }[] = [
    { value: 'timeline', icon: Clock, label: 'Timeline' },
    { value: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
    { value: 'data', icon: User, label: 'Comercial' },
    { value: 'dossier', icon: FileText, label: 'Dossiê' },
    { value: 'profile', icon: Instagram, label: 'Insta' },
    { value: 'evolution', icon: TrendingUp, label: 'Evolução' },
    { value: 'insights', icon: Brain, label: 'IA' },
    { value: 'meetings', icon: Video, label: 'Reuniões' },
    { value: 'tasks', icon: CheckSquare, label: 'Tarefas' },
    { value: 'onboarding', icon: Rocket, label: 'Onboarding' },
    { value: 'cadence', icon: ListOrdered, label: 'Cadência' },
    { value: 'social_selling', icon: Camera, label: 'Social Selling' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[1400px] w-[97vw] max-h-[95vh] overflow-hidden flex flex-col p-0 border-border gap-0"
      >
        {mode === 'edit' && lead ? (
          <div className="flex flex-col h-full overflow-hidden bg-background">
            {/* ====================== HEADER ====================== */}
            <div className="relative border-b border-border bg-card/30">
              {/* faixa colorida sutil topo */}
              <div className={`absolute top-0 inset-x-0 h-1 ${
                isWon ? 'bg-green-500' :
                lead.priority === 'urgent' ? 'bg-red-500' :
                lead.priority === 'high' ? 'bg-orange-500' :
                'bg-primary/40'
              }`} />

              <div className="px-5 pt-4 pb-3">
                {/* breadcrumb Voltar */}
                <button
                  onClick={onClose}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>

                <div className="flex items-start gap-4">
                  {/* AVATARES — mostra Instagram + WhatsApp lado a lado quando
                       ambos disponiveis, com pillzinha de origem em cada um.
                       Fallback: iniciais. Trofeu vai sobre o ultimo avatar. */}
                  <div className="relative flex-shrink-0 flex items-center -space-x-3">
                    {igAvatar && (
                      <div className="relative group">
                        <img
                          src={igAvatar}
                          alt={`${lead.name} (Instagram)`}
                          title="Foto do Instagram"
                          className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/60 shadow-sm bg-background"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                        />
                        <span className="absolute -bottom-1 -left-1 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-br from-pink-500 to-purple-500 text-white px-1.5 py-0.5 rounded-full border border-background shadow-sm">IG</span>
                      </div>
                    )}
                    {waAvatar && (
                      <div className="relative group">
                        <img
                          src={waAvatar}
                          alt={`${lead.name} (WhatsApp)`}
                          title="Foto do WhatsApp"
                          className="w-16 h-16 rounded-full object-cover border-2 border-green-500/60 shadow-sm bg-background"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                        />
                        <span className="absolute -bottom-1 -right-1 text-[9px] font-bold uppercase tracking-wider bg-green-600 text-white px-1.5 py-0.5 rounded-full border border-background shadow-sm">WA</span>
                      </div>
                    )}
                    {!igAvatar && !waAvatar && (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-border flex items-center justify-center text-xl font-bold text-primary">
                        {initials}
                      </div>
                    )}
                    {isWon && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-background flex items-center justify-center z-10">
                        <Trophy className="w-3 h-3 text-background" />
                      </div>
                    )}
                  </div>

                  {/* INFO */}
                  <div className="flex-1 min-w-0">
                    {/* Linha 1: nome + score + edit */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h2 className="text-xl font-bold tracking-tight truncate">{lead.name}</h2>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                        <Star className="w-3 h-3 fill-red-400" />
                        <span className="text-[11px] font-bold">{lead.lead_score || 0}/100</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => setActiveTab('data')}
                        title="Editar dados"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <div className="ml-auto flex items-center gap-1.5">
                        {isWon && (
                          <ActivateAsMemberButton
                            lead={lead}
                            onActivated={() => window.dispatchEvent(new Event('refresh-lead'))}
                          />
                        )}
                        <AgentPauseControl leadId={lead.id} />
                      </div>
                    </div>

                    {/* Linha 2: chips por Kanban com Popover dos estagios.
                         Cada chip eh um board. Clicar abre dropdown com os
                         stages daquele Kanban — stage atual destacado. Permite
                         mover entre boards diferentes (cross-pipeline). */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {effectiveBoards.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">Carregando pipelines...</span>
                      )}
                      {effectiveBoards.map(board => {
                        const isCurrentBoard = board.id === effectiveActiveBoardId;
                        const stages = boardColumns[board.id] || [];
                        const currentStage = isCurrentBoard ? stages.find(s => s.id === lead.column_id) : null;
                        const isOpen = openBoardId === board.id;
                        return (
                          <Popover key={board.id} open={isOpen} onOpenChange={(o) => setOpenBoardId(o ? board.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                disabled={!!movingTo}
                                className={`group flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md transition-all border ${
                                  isCurrentBoard
                                    ? 'bg-primary/15 border-primary/40 text-foreground'
                                    : 'bg-secondary/40 border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                                } ${movingTo ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Workflow className={`w-3 h-3 ${isCurrentBoard ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="font-medium">{board.name}</span>
                                {currentStage && (
                                  <>
                                    <span className="text-muted-foreground/60">·</span>
                                    <span className="font-semibold text-primary">{currentStage.name}</span>
                                  </>
                                )}
                                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-56 p-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5 border-b border-border mb-1">
                                Estágios · {board.name}
                              </div>
                              {stages.length === 0 ? (
                                <div className="px-2 py-2 text-xs text-muted-foreground">Carregando...</div>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  {stages.map(stage => {
                                    const isActiveStage = isCurrentBoard && stage.id === lead.column_id;
                                    const isMoving = movingTo === stage.id;
                                    return (
                                      <button
                                        key={stage.id}
                                        onClick={() => handleMoveToBoardColumn(board.id, stage.id)}
                                        disabled={isActiveStage || !!movingTo}
                                        className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
                                          isActiveStage
                                            ? 'bg-primary/15 text-primary font-semibold'
                                            : 'text-foreground hover:bg-muted/60'
                                        }`}
                                      >
                                        {isMoving ? (
                                          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                                        ) : isActiveStage ? (
                                          <Check className="w-3 h-3 text-primary flex-shrink-0" />
                                        ) : (
                                          <span className="w-3 h-3 flex-shrink-0" />
                                        )}
                                        <span className="truncate">{stage.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>

                    {/* Linha 3: contato + ações */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap text-xs">
                      {lead.email && (
                        <button
                          onClick={() => copyToClipboard(lead.email!, 'Email')}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
                          title="Clique para copiar"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{lead.email}</span>
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(lead.whatsapp, 'WhatsApp')}
                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
                        title="Clique para copiar"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{lead.whatsapp}</span>
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      <CallButton phoneNumber={lead.whatsapp} leadId={lead.id} size="sm" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px] px-2.5"
                        onClick={() => setActiveTab('whatsapp')}
                      >
                        <MessageSquare className="w-3 h-3" /> WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px] px-2.5"
                        onClick={() => setShowScheduleMeeting(true)}
                      >
                        <Calendar className="w-3 h-3" /> Agendar
                      </Button>
                      {lead.company_name && (
                        <Badge variant="outline" className="text-[10px] gap-1 h-6">
                          <Building2 className="w-2.5 h-2.5" /> {lead.company_name}
                        </Badge>
                      )}
                      {lead.instagram && (
                        <a
                          href={`https://instagram.com/${lead.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors text-[11px]"
                        >
                          <Instagram className="w-3 h-3" /> @{lead.instagram}
                        </a>
                      )}
                    </div>

                    {/* Linha 4: meta */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      {timeInFunnel && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Lead há {timeInFunnel}
                        </span>
                      )}
                      {lead.assigned_to && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {lead.assigned_to}
                        </span>
                      )}
                      {(currentBoardName || lead.source) && (
                        <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-card">
                          <Globe className="w-2.5 h-2.5" />
                          {[currentBoardName, lead.source].filter(Boolean).join(' · ')}
                        </Badge>
                      )}
                      {lead.tags?.slice(0, 4).map(t => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-[10px] h-5 bg-primary/10 text-primary border-primary/30"
                        >
                          {t}
                        </Badge>
                      ))}
                      {lead.tags && lead.tags.length > 4 && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          +{lead.tags.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ====================== BODY: 2 COLUNAS ====================== */}
            <div className="flex-1 overflow-hidden flex">
              {/* SIDEBAR ESQUERDA */}
              <aside className="w-[320px] flex-shrink-0 border-r border-border overflow-y-auto p-4 bg-muted/10">
                <LeadSidebar
                  leadId={lead.id}
                  leadWhatsapp={lead.whatsapp}
                  leadSourceId={lead.source_lead_id}
                  leadSource={lead.source}
                  leadNotes={lead.notes}
                  leadName={lead.name}
                  leadDiscProfile={(lead as any).disc_profile}
                  leadDiscScores={(lead as any).disc_scores}
                  onOpenOpportunity={handleOpenOpportunity}
                />
              </aside>

              {/* CONTEÚDO DIREITA */}
              <main className="flex-1 overflow-hidden flex flex-col">
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex-1 overflow-hidden flex flex-col"
                >
                  {/* TABS STRIP, chip style, horizontal scroll */}
                  <div className="px-5 pt-3 pb-2 border-b border-border bg-card/20">
                    <TabsList className="bg-transparent p-0 h-auto gap-1 overflow-x-auto flex-nowrap w-full justify-start">
                      {TAB_DEFS.map(t => {
                        const isActive = activeTab === t.value;
                        return (
                          <TabsTrigger
                            key={t.value}
                            value={t.value}
                            className={`flex-shrink-0 h-8 px-3 gap-1.5 text-xs rounded-lg border transition-all data-[state=active]:shadow-none ${
                              isActive
                                ? 'data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:border-primary/40'
                                : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                          >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </div>

                  {/* CONTEÚDO TAB */}
                  <div className="flex-1 overflow-auto px-5 py-4">
                    <TabsContent value="timeline" className="mt-0 h-full">
                      <LeadTimeline
                        leadId={lead.id}
                        leadCreatedAt={lead.created_at}
                        leadSource={lead.source}
                        leadName={lead.name}
                      />
                    </TabsContent>

                    <TabsContent value="whatsapp" className="mt-0 h-full">
                      <WhatsAppLeadTab
                        leadId={lead.id}
                        leadName={lead.name}
                        leadPhone={lead.whatsapp}
                        boardId={(lead as any).board_id}
                        onOpenFullChat={() => setShowChat(true)}
                      />
                    </TabsContent>

                    <TabsContent value="data" className="mt-0 h-full">
                      <LeadDataTab lead={lead} columns={dynamicColumns} onSave={onSave} />
                      {(lead as any).closed_at && !(lead as any).lost_reason && (
                        <PostSaleTracker
                          currentStage={(lead as any).post_sale_stage || null}
                          onStageChange={async (stage) => {
                            try {
                              await supabase
                                .from('crm_leads')
                                .update({ post_sale_stage: stage } as any)
                                .eq('id', lead.id);
                              toast.success('Etapa pos-venda atualizada!');
                            } catch {
                              toast.error('Erro ao atualizar etapa');
                            }
                          }}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="dossier" className="mt-0 h-full">
                      <div className="space-y-4">
                        <DiscPdfPanel
                          leadId={lead.id}
                          leadEvento={(lead as any).evento}
                          leadDiscProfile={(lead as any).disc_profile}
                          leadWhatsapp={lead.whatsapp}
                        />
                        <LeadDossierTab
                          leadId={lead.id}
                          leadName={lead.name}
                          leadWhatsapp={lead.whatsapp}
                          leadInstagram={lead.instagram}
                          leadSource={lead.source}
                          leadScore={lead.lead_score}
                          leadNotes={lead.notes}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="profile" className="mt-0 h-full">
                      <LeadProfileTab lead={lead} />
                    </TabsContent>

                    <TabsContent value="evolution" className="mt-0 h-full">
                      <InstagramEvolutionTab leadId={lead.id} leadInstagram={lead.instagram} />
                    </TabsContent>

                    <TabsContent value="insights" className="mt-0 h-full">
                      <LeadInsightsTab leadId={lead.id} />
                    </TabsContent>

                    <TabsContent value="meetings" className="mt-0 h-full">
                      <MeetingsTab leadId={lead.id} leadName={lead.name} leadWhatsapp={lead.whatsapp} />
                    </TabsContent>

                    <TabsContent value="tasks" className="mt-0 h-full">
                      <LeadTasksTab leadId={lead.id} leadName={lead.name} />
                    </TabsContent>

                    <TabsContent value="onboarding" className="mt-0 h-full">
                      <div className="space-y-4">
                        <OnboardingPanel leadId={lead.id} leadName={lead.name} />
                        <LeadOnboardingTab leadId={lead.id} leadName={lead.name} leadWhatsapp={lead.whatsapp} />
                      </div>
                    </TabsContent>

                    <TabsContent value="cadence" className="mt-0 h-full">
                      <LeadCadenceEnrollment leadId={lead.id} leadName={lead.name} />
                    </TabsContent>

                    <TabsContent value="social_selling" className="mt-0 h-full">
                      <LeadSocialSellingTab leadId={lead.id} leadName={lead.name} leadInstagram={lead.instagram} />
                    </TabsContent>
                  </div>
                </Tabs>
              </main>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <DialogHeader>
              <DialogTitle>Novo Lead</DialogTitle>
              <DialogDescription>Preencha os dados do novo lead</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <LeadForm
                formData={formData} setFormData={setFormData} columns={dynamicColumns}
                newTag={newTag} setNewTag={setNewTag} addTag={addTag} removeTag={removeTag}
                onSubmit={handleSubmit} onClose={onClose} isLoading={isLoading} mode={mode}
                boards={boards} onBoardChange={handleBoardChange}
              />
            </div>
          </div>
        )}

        {showChat && lead && (
          <WhatsAppChat
            leadId={lead.id} leadName={lead.name} leadPhone={lead.whatsapp}
            leadProfilePic={lead.instagram_profile_pic_url}
            onClose={() => setShowChat(false)}
          />
        )}

        {showScheduleMeeting && lead && (
          <ScheduleMeetingModal
            isOpen={showScheduleMeeting}
            onClose={() => setShowScheduleMeeting(false)}
            leadId={lead.id}
            leadName={lead.name}
            leadWhatsapp={lead.whatsapp}
          />
        )}

        {/* Dialog "Fechado": pergunta ganho/perda + valor antes de marcar
             closed_at e disparar onboarding/financeira. */}
        {lead && (
          <FinalStageDialog
            isOpen={finalStageDialogOpen}
            leadName={lead.name}
            leadId={lead.id}
            onConfirmWon={handleFinalStageWon}
            onConfirmLost={handleFinalStageLost}
            onCancel={() => { setFinalStageDialogOpen(false); setPendingFinalMove(null); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
