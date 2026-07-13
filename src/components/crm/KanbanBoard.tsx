import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { LeadDetailModal } from './LeadDetailModal';
import { AddColumnModal } from './AddColumnModal';
import { FinalStageDialog } from './FinalStageDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CRMColumn {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_final_stage: boolean;
}

interface CRMLead {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  company_name?: string;
  notes?: string;
  tags?: string[];
  lead_score: number;
  potential_value?: number;
  scheduled_call_at?: string;
  call_reminder_sent: boolean;
  priority: string;
  created_at: string;
  first_contact_at?: string;
  column_id: string;
  board_id: string;
}

interface CRMBoard {
  id: string;
  name: string;
}

interface KanbanBoardProps {
  boardId: string;
  boardName: string;
  allBoards?: CRMBoard[];
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ boardId, boardName, allBoards }) => {
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadModalMode, setLeadModalMode] = useState<'add' | 'edit'>('add');
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<string>('');
  
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [columnModalMode, setColumnModalMode] = useState<'add' | 'edit'>('add');
  const [selectedColumn, setSelectedColumn] = useState<CRMColumn | null>(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<CRMLead | null>(null);

  // Final stage dialog state
  const [finalStageDialogOpen, setFinalStageDialogOpen] = useState(false);
  const [pendingFinalMove, setPendingFinalMove] = useState<{
    leadId: string;
    leadName: string;
    targetColumnId: string;
    oldColumnId: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Carregar dados. `silent=true` evita flash de loading durante refresh em background.
  const loadData = useCallback(async (silent = false) => {
    if (!boardId) return;

    if (!silent) setIsLoading(true);
    try {
      const [columnsRes, leadsRes] = await Promise.all([
        supabase
          .from('crm_columns')
          .select('*')
          .eq('board_id', boardId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('crm_leads')
          .select('*')
          .eq('board_id', boardId)
          .order('sort_order', { ascending: true })
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (leadsRes.error) throw leadsRes.error;

      setColumns(columnsRes.data || []);

      // Enriquece leads com flags de engagement (email aberto / clicou) via view.
      // Não bloqueia render: se falhar, leads aparecem sem badges.
      const leadsList = (leadsRes.data || []) as any[];
      try {
        const leadIds = leadsList.map((l) => l.id);
        if (leadIds.length > 0) {
          const { data: eng } = await (supabase as any)
            .from('crm_leads_engagement')
            .select('id, last_email_opened_at, last_email_clicked_at, email_open_count, email_click_count')
            .in('id', leadIds);
          const engMap = new Map((eng || []).map((e: any) => [e.id, e]));
          const enriched = leadsList.map((l) => ({ ...l, ...(engMap.get(l.id) || {}) }));
          setLeads(enriched);
        } else {
          setLeads(leadsList);
        }
      } catch (e) {
        console.warn('engagement view falhou, leads sem badges:', e);
        setLeads(leadsList);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      if (!silent) toast.error('Erro ao carregar dados do Kanban');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscription com debounce e usando ref do loadData
  // (evita re-subscribe quando loadData muda; evita refetch em cascata)
  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  useEffect(() => {
    if (!boardId) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`crm_leads_${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_leads', filter: `board_id=eq.${boardId}` },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            loadDataRef.current(true); // refresh silencioso (sem flash de loading)
          }, 350);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  // crm:open-lead — sidebar de Oportunidades pode pedir abertura de outro lead
  // (cross-board). Buscamos o lead diretamente do supabase porque pode estar
  // em outro board e nao estar no state local.
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const targetId = detail?.leadId;
      if (!targetId) return;
      const { data } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();
      if (data) {
        setSelectedLead(data as any);
        setLeadModalMode('edit');
        setLeadModalOpen(true);
      }
    };
    window.addEventListener('crm:open-lead', handler);
    return () => window.removeEventListener('crm:open-lead', handler);
  }, []);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;
    
    // Encontrar a coluna de destino
    let targetColumnId = overId;
    
    // Se over.id é um lead, pegar a coluna desse lead
    const overLead = leads.find(l => l.id === overId);
    if (overLead) {
      targetColumnId = overLead.column_id;
    }
    
    // Se é uma coluna válida
    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const oldColumnId = lead.column_id;

    if (oldColumnId === targetColumnId) return;

    // If target is a final stage, show the dialog first
    if (targetColumn.is_final_stage) {
      // Optimistic update visually
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, column_id: targetColumnId } : l
      ));
      setPendingFinalMove({
        leadId,
        leadName: lead.name,
        targetColumnId,
        oldColumnId,
      });
      setFinalStageDialogOpen(true);
      return;
    }

    // Normal (non-final) column move
    await executeColumnMove(leadId, oldColumnId, targetColumnId);
  };

  // Execute the actual column move (shared between normal and final stage moves)
  const executeColumnMove = async (
    leadId: string,
    oldColumnId: string,
    targetColumnId: string,
    extraUpdate?: Record<string, any>
  ) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const oldColumn = columns.find(c => c.id === oldColumnId);
    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return;

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, column_id: targetColumnId, ...extraUpdate } : l
    ));

    try {
      const updatePayload: Record<string, any> = { column_id: targetColumnId, ...extraUpdate };

      const { error } = await supabase
        .from('crm_leads')
        .update(updatePayload)
        .eq('id', leadId);

      if (error) throw error;

      // Registrar atividade
      await supabase.from('crm_activities').insert({
        lead_id: leadId,
        board_id: boardId,
        activity_type: 'column_change',
        description: `${lead.name} movido`,
        from_column_name: oldColumn?.name || 'Desconhecido',
        to_column_name: targetColumn.name,
        board_name: boardName
      });

      // Auto-recalculate lead score after column change
      supabase.functions.invoke('calculate-lead-score', { body: { leadId } }).catch(() => {});

      // Auto-trigger onboarding when moved to "Fechado"
      if (targetColumn.name === 'Fechado' && targetColumn.is_final_stage) {
        try {
          const { data: onboardingResult, error: onboardingError } = await supabase.functions.invoke('create-vhs-participant', {
            body: { name: lead.name, whatsapp: lead.whatsapp }
          });

          if (!onboardingError && onboardingResult?.onboarding_url) {
            await supabase.from('crm_activities').insert({
              lead_id: leadId,
              board_id: boardId,
              activity_type: 'onboarding_sent',
              description: `Onboarding VHS enviado automaticamente para ${lead.name}`,
              metadata: { onboarding_url: onboardingResult.onboarding_url, token: onboardingResult.onboarding_token }
            });

            toast.success(`Onboarding enviado para ${lead.name}!`, {
              description: onboardingResult.already_existed
                ? 'Link existente recuperado'
                : 'Novo link de onboarding criado',
              action: {
                label: 'Copiar Link',
                onClick: () => {
                  navigator.clipboard.writeText(onboardingResult.onboarding_url);
                  toast.info('Link copiado!');
                }
              }
            });
          }
        } catch (onboardingErr) {
          console.warn('Erro ao criar onboarding:', onboardingErr);
        }
      }

    } catch (error: any) {
      console.error('Erro ao mover lead:', error);
      toast.error('Erro ao mover lead');
      loadData();
    }
  };

  // Final stage dialog handlers
  const handleFinalStageWon = async (dealValue: number | null, saleData?: any) => {
    if (!pendingFinalMove) return;
    const { leadId, oldColumnId, targetColumnId } = pendingFinalMove;
    setFinalStageDialogOpen(false);
    setPendingFinalMove(null);

    const extra: Record<string, any> = {
      closed_at: new Date().toISOString(),
      post_sale_stage: 'awaiting_onboarding',
    };
    if (dealValue !== null) extra.deal_value = dealValue;

    await executeColumnMove(leadId, oldColumnId, targetColumnId, extra);

    // Auto-create member for the won lead
    let memberId: string | null = null;
    try {
      const lead = leads.find(l => l.id === leadId);
      if (lead?.whatsapp) {
        const phone = lead.whatsapp.replace(/\D/g, '');
        // Check if member already exists
        const { data: existing } = await (supabase as any)
          .from('members')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();

        if (!existing) {
          const { data: newMember } = await (supabase as any)
            .from('members')
            .insert({
              name: lead.name,
              email: lead.email || `${phone}@squaad.com`,
              phone: phone,
              status: 'pending',
              crm_lead_id: leadId,
              program: boardName?.toLowerCase().includes('mentoria') ? 'mentoria' : 'metodo-squaad',
              // Propaga o CPF do lead pro member: o Asaas exige CPF/CNPJ e sem
              // isso a geracao de cobranca era pulada silenciosamente.
              cpf: lead.cpf ? String(lead.cpf).replace(/\D/g, '') : null,
            })
            .select('id')
            .single();
          memberId = newMember?.id || null;
          toast.info('Membro criado (pendente aprovacao em Admin > Membros)');

          // Create onboarding enrollment
          const { data: enrollment } = await (supabase as any)
            .from('metodo_squaad_enrollments')
            .insert({
              crm_lead_id: leadId,
              name: lead.name,
              whatsapp: phone,
              status: 'pending',
              program: boardName || 'Metodo + que Vencedores',
            })
            .select('onboarding_token')
            .single();

          // Send welcome message + onboarding link via WhatsApp
          const { data: waInstances } = await (supabase as any)
            .from('whatsapp_instances')
            .select('id')
            .eq('status', 'connected')
            .eq('provider', 'uazapi')
            .or('is_dedicated_blast.is.null,is_dedicated_blast.eq.false')
            .order('created_at', { ascending: true })
            .limit(1);

          if (waInstances?.[0] && enrollment?.onboarding_token) {
            const onboardingUrl = `https://squaad.com.br/metodo-squaad/onboarding/${enrollment.onboarding_token}`;
            const phoneNumber = phone.startsWith('55') ? phone : '55' + phone;
            await supabase.functions.invoke('uazapi-proxy', {
              body: {
                action: 'send_text',
                instance_id: waInstances[0].id,
                number: phoneNumber,
                text: `Parabens ${lead.name}, seja muito bem-vindo ao ${boardName || 'Metodo + que Vencedores'}.\n\nVamos jogar duro juntos, esse e o comeco de uma jornada que vai transformar seu negocio com Inteligencia Artificial.\n\nPreciso que voce preencha seu onboarding personalizado pra eu montar sua trilha de aulas sob medida:\n\n${onboardingUrl}\n\nQualquer duvida, estou aqui.`,
              },
            });
            toast.success('Mensagem de boas-vindas enviada via WhatsApp!');
          }
        } else {
          memberId = existing.id;
        }
      }
    } catch (e) {
      console.error('Auto-create member failed:', e);
    }

    // Create contract and payment installments
    if (saleData && memberId) {
      try {
        const installmentValue = saleData.numInstallments > 0
          ? (saleData.totalValue - saleData.entryValue) / saleData.numInstallments
          : 0;

        const isEntryVip = saleData.entryMethod === 'vip';
        const isInstallmentVip = saleData.installmentMethod === 'vip';
        const isFullVip = isEntryVip && isInstallmentVip;

        // Origem/gateway do pagamento + "ja recebido presencial"
        // Sem gateway escolhido => NAO gera cobranca. So Asaas/Stripe geram link,
        // e somente quando explicitamente selecionados (nunca por padrao).
        const paymentGateway = saleData.paymentGateway || '';
        const isOnlineGateway = ['asaas', 'stripe'].includes(paymentGateway);
        const alreadyPaid = !!saleData.alreadyPaid;
        // Antecipado: recebido tudo de uma vez (ex: maquina antecipou o parcelado do cartao).
        // Nao lanca parcelas com vencimento futuro, so 1 recebimento hoje.
        const isAnticipated = alreadyPaid && !!saleData.anticipated;

        const { data: contract } = await (supabase as any)
          .from('member_contracts')
          .insert({
            member_id: memberId,
            crm_lead_id: leadId,
            program: 'metodo-squaad',
            total_value: saleData.totalValue,
            entry_value: saleData.entryValue,
            entry_method: saleData.entryMethod,
            entry_paid: alreadyPaid,
            entry_paid_at: alreadyPaid && saleData.entryValue > 0 ? new Date().toISOString() : null,
            num_installments: saleData.numInstallments,
            installment_value: Math.round(installmentValue * 100) / 100,
            payment_method: saleData.installmentMethod,
            payment_origin: paymentGateway,
            status: isFullVip ? 'vip' : (saleData.isPromise ? 'promise' : 'active'),
            gateway: isFullVip ? 'vip' : (!alreadyPaid && isOnlineGateway ? paymentGateway : 'manual'),
            is_promise: saleData.isPromise || false,
            promise_date: saleData.promiseDate || null,
            notes: isFullVip
              ? 'Venda VIP / Parceria — não contabiliza no financeiro'
              : (isEntryVip || isInstallmentVip)
                ? `Venda VIP parcial — ${isEntryVip ? 'entrada' : 'parcelas'} não contabiliza(m) no financeiro`
                : null,
          })
          .select('id')
          .single();

        if (contract?.id) {
          // Generate payment installments — pula partes VIP (não contam no financeiro)
          const payments: any[] = [];
          const firstDue = new Date(saleData.firstDueDate + 'T12:00:00');

          // Parcela #0 = entrada (só se houver E não for VIP)
          if (saleData.entryValue > 0 && !isEntryVip) {
            const entryDue = saleData.isPromise && saleData.promiseDate
              ? saleData.promiseDate
              : new Date().toISOString().split('T')[0];
            payments.push({
              contract_id: contract.id,
              member_id: memberId,
              installment_number: 0,
              value: Math.round(saleData.entryValue * 100) / 100,
              due_date: entryDue,
              status: alreadyPaid ? 'paid' : 'pending',
              paid_at: alreadyPaid ? new Date().toISOString() : null,
              paid_value: alreadyPaid ? Math.round(saleData.entryValue * 100) / 100 : null,
              payment_method: saleData.entryMethod,
              payment_origin: paymentGateway,
              notes: saleData.isPromise
                ? `Entrada (promessa de pagamento ${saleData.promiseDate})`
                : 'Entrada',
            });
          }

          // Parcelas regulares — só se installment não for VIP
          if (!isInstallmentVip) {
            if (isAnticipated) {
              // Antecipado: 1 recebimento hoje do valor financiado, SEM datas futuras
              const financed = Math.round((saleData.totalValue - saleData.entryValue) * 100) / 100;
              if (financed > 0) {
                const nowIso = new Date().toISOString();
                payments.push({
                  contract_id: contract.id,
                  member_id: memberId,
                  installment_number: 1,
                  value: financed,
                  due_date: nowIso.split('T')[0],
                  status: 'paid',
                  paid_at: nowIso,
                  paid_value: financed,
                  payment_method: saleData.installmentMethod,
                  payment_origin: paymentGateway,
                  notes: `Antecipado (cliente parcelou em ${saleData.numInstallments}x via ${paymentGateway})`,
                });
              }
            } else {
              for (let i = 0; i < saleData.numInstallments; i++) {
                const dueDate = new Date(firstDue);
                dueDate.setMonth(dueDate.getMonth() + i);
                payments.push({
                  contract_id: contract.id,
                  member_id: memberId,
                  installment_number: i + 1,
                  value: Math.round(installmentValue * 100) / 100,
                  due_date: dueDate.toISOString().split('T')[0],
                  status: alreadyPaid ? 'paid' : 'pending',
                  paid_at: alreadyPaid ? new Date().toISOString() : null,
                  paid_value: alreadyPaid ? Math.round(installmentValue * 100) / 100 : null,
                  payment_method: saleData.installmentMethod,
                  payment_origin: paymentGateway,
                });
              }
            }
          }

          if (payments.length > 0) {
            await (supabase as any).from('member_payments').insert(payments);
          }

          if (isFullVip) {
            toast.success(`⚜️ Venda VIP registrada (parceria — não contabiliza no financeiro)`);
          } else if (isEntryVip || isInstallmentVip) {
            toast.success(`Contrato criado (VIP parcial — partes da venda não contam no financeiro)`);
          } else {
            toast.success(`Contrato criado: ${saleData.numInstallments}x de R$ ${(Math.round(installmentValue * 100) / 100).toFixed(2)}`);
          }

          // Gera link de pagamento da primeira parcela (gateway ativo: stripe ou asaas)
          // Pula se parcelas são VIP — nao tem o que cobrar
          try {
            if (isInstallmentVip) {
              throw new Error('skip-gateway-vip');
            }
            if (alreadyPaid) {
              // Ja recebido presencial — nada a cobrar online
              toast.success('Venda registrada como ja paga (sem cobranca gerada).');
              throw new Error('skip-already-paid');
            }
            if (!isOnlineGateway) {
              // Gateway offline (Stone, Sicoob, PIX presencial, dinheiro): cobrado fora do sistema
              toast.info(`Contrato criado. Cobranca via ${paymentGateway} sera feita fora do sistema.`);
              throw new Error('skip-offline-gateway');
            }
            const { data: firstPayment } = await (supabase as any)
              .from('member_payments')
              .select('id')
              .eq('contract_id', contract.id)
              .eq('installment_number', 1)
              .single();

            if (firstPayment) {
              // Gateway escolhido no dialog (asaas ou stripe)
              const gateway = paymentGateway;
              const fnName = gateway === 'asaas' ? 'asaas-create-payment' : 'stripe-create-payment';

              // Asaas precisa de CPF; activate-lead-as-member ja propaga do lead, mas
              // em vendas manuais sem CPF, fica vazio. Pula geracao silenciosa se faltar.
              if (gateway === 'asaas') {
                const { data: m } = await (supabase as any)
                  .from('members').select('cpf').eq('id', memberId).maybeSingle();
                const cpfDigits = (m?.cpf || '').replace(/\D/g, '');
                if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
                  toast.info('Contrato criado. Cadastre o CPF do membro pra gerar o link Asaas.');
                  throw new Error('skip-asaas-no-cpf');
                }
              }

              const stripeRes = await supabase.functions.invoke(fnName, {
                body: { payment_id: firstPayment.id, member_id: memberId, contract_id: contract.id },
              });

              if (stripeRes.data?.url) {
                // Send payment link via WhatsApp
                const lead = leads.find(l => l.id === leadId);
                if (lead?.whatsapp) {
                  const cleanPhone = lead.whatsapp.replace(/\D/g, '');
                  const phoneNumber = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

                  // Fetch connected WhatsApp instance
                  const { data: instances } = await (supabase as any)
                    .from('whatsapp_instances')
                    .select('id')
                    .eq('status', 'connected')
                    .eq('provider', 'uazapi')
                    .or('is_dedicated_blast.is.null,is_dedicated_blast.eq.false')
                    .order('created_at', { ascending: true })
                    .limit(1);

                  if (instances?.[0]) {
                    await supabase.functions.invoke('uazapi-proxy', {
                      body: {
                        action: 'send_text',
                        instance_id: instances[0].id,
                        number: phoneNumber,
                        text: `Oi ${lead.name}, segue o link para pagamento da primeira parcela do Metodo + que Vencedores:\n\n${stripeRes.data.url}\n\nQualquer duvida estou aqui.`,
                      },
                    });
                    toast.success('Link de pagamento enviado via WhatsApp!');
                  }
                }
              }
            }
          } catch (stripeErr) {
            console.error('Stripe payment link failed:', stripeErr);
            // Non-blocking - sale still saved even if Stripe fails
          }
        }
      } catch (e) {
        console.error('Failed to create contract:', e);
        toast.error('Erro ao criar contrato financeiro');
      }
    }

    toast.success('Lead marcado como ganho!');
  };

  const handleFinalStageLost = async (reason: string) => {
    if (!pendingFinalMove) return;
    const { leadId, oldColumnId, targetColumnId } = pendingFinalMove;
    setFinalStageDialogOpen(false);
    setPendingFinalMove(null);

    await executeColumnMove(leadId, oldColumnId, targetColumnId, {
      closed_at: new Date().toISOString(),
      lost_reason: reason,
    });
    toast.info('Lead marcado como perdido.');
  };

  const handleFinalStageCancel = () => {
    // Revert optimistic update
    if (pendingFinalMove) {
      setLeads(prev => prev.map(l =>
        l.id === pendingFinalMove.leadId
          ? { ...l, column_id: pendingFinalMove.oldColumnId }
          : l
      ));
    }
    setFinalStageDialogOpen(false);
    setPendingFinalMove(null);
  };

  // Lead handlers
  const handleAddLead = (columnId: string) => {
    setDefaultColumnId(columnId);
    setSelectedLead(null);
    setLeadModalMode('add');
    setLeadModalOpen(true);
  };

  const handleEditLead = (lead: CRMLead) => {
    setSelectedLead(lead);
    setLeadModalMode('edit');
    setLeadModalOpen(true);
  };

  const handleDeleteLead = (lead: CRMLead) => {
    setLeadToDelete(lead);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;

    try {
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', leadToDelete.id);

      if (error) throw error;

      setLeads(prev => prev.filter(l => l.id !== leadToDelete.id));
      toast.success('Lead excluído!');
    } catch (error: any) {
      toast.error('Erro ao excluir lead');
    } finally {
      setDeleteConfirmOpen(false);
      setLeadToDelete(null);
    }
  };

  const handleSaveLead = async (leadData: Partial<CRMLead>) => {
    if (leadModalMode === 'add') {
      const { data, error } = await supabase
        .from('crm_leads')
        .insert({
          name: leadData.name,
          whatsapp: leadData.whatsapp,
          email: leadData.email,
          instagram: leadData.instagram,
          company_name: leadData.company_name,
          notes: leadData.notes,
          tags: leadData.tags,
          lead_score: leadData.lead_score,
          potential_value: leadData.potential_value,
          scheduled_call_at: leadData.scheduled_call_at,
          priority: leadData.priority,
          board_id: boardId,
          column_id: leadData.column_id || defaultColumnId
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Registrar atividade
      const column = columns.find(c => c.id === (leadData.column_id || defaultColumnId));
      await supabase.from('crm_activities').insert({
        lead_id: data.id,
        board_id: boardId,
        activity_type: 'lead_created',
        description: `Lead ${leadData.name} criado manualmente`,
        to_column_name: column?.name,
        board_name: boardName
      });

      setLeads(prev => [...prev, data]);

      // Auto-scrap Instagram if provided and no pic
      if (leadData.instagram && !leadData.instagram_profile_pic_url) {
        triggerInstagramScrap(data.id, leadData.instagram);
      }
    } else if (selectedLead) {
      const { error } = await supabase
        .from('crm_leads')
        .update(leadData)
        .eq('id', selectedLead.id);

      if (error) throw error;

      // Registrar atividade
      await supabase.from('crm_activities').insert({
        lead_id: selectedLead.id,
        board_id: boardId,
        activity_type: 'lead_edited',
        description: `Lead ${leadData.name} editado`,
        board_name: boardName
      });

      setLeads(prev => prev.map(l => 
        l.id === selectedLead.id ? { ...l, ...leadData } : l
      ));

      // Auto-scrap Instagram if added/changed and no pic
      if (leadData.instagram && !leadData.instagram_profile_pic_url && leadData.instagram !== selectedLead.instagram) {
        triggerInstagramScrap(selectedLead.id, leadData.instagram);
      }
    }
  };

  // Auto-scrap Instagram profile in background
  const triggerInstagramScrap = async (leadId: string, instagram: string) => {
    try {
      const cleanHandle = instagram.replace('@', '');
      toast.info(`📸 Analisando Instagram @${cleanHandle}...`);
      const { data, error } = await supabase.functions.invoke('analyze-instagram-profile', {
        body: { username: cleanHandle, leadName: leads.find(l => l.id === leadId)?.name || '', context: 'vhs' }
      });
      if (!error && data?.profilePicPath) {
        // Update local state
        setLeads(prev => prev.map(l => 
          l.id === leadId ? { ...l, instagram_profile_pic_url: data.profilePicPath } : l
        ));
        toast.success(`✅ Instagram @${cleanHandle} analisado!`);
      }
    } catch (err) {
      console.warn('Instagram scrap failed:', err);
    }
  };

  // Column handlers
  const handleAddColumn = () => {
    setSelectedColumn(null);
    setColumnModalMode('add');
    setColumnModalOpen(true);
  };

  const handleEditColumn = (column: CRMColumn) => {
    setSelectedColumn(column);
    setColumnModalMode('edit');
    setColumnModalOpen(true);
  };

  const handleDeleteColumn = async (column: CRMColumn) => {
    const leadsInColumn = leads.filter(l => l.column_id === column.id);
    if (leadsInColumn.length > 0) {
      toast.error(`Não é possível excluir. Existem ${leadsInColumn.length} leads nesta coluna.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('crm_columns')
        .delete()
        .eq('id', column.id);

      if (error) throw error;

      setColumns(prev => prev.filter(c => c.id !== column.id));
      toast.success('Coluna excluída!');
    } catch (error: any) {
      toast.error('Erro ao excluir coluna');
    }
  };

  const handleSaveColumn = async (columnData: Partial<CRMColumn>) => {
    if (columnModalMode === 'add') {
      const maxSortOrder = Math.max(...columns.map(c => c.sort_order), 0);
      
      const { data, error } = await supabase
        .from('crm_columns')
        .insert({
          name: columnData.name,
          color: columnData.color,
          is_final_stage: columnData.is_final_stage,
          board_id: boardId,
          sort_order: maxSortOrder + 1
        } as any)
        .select()
        .single();

      if (error) throw error;

      setColumns(prev => [...prev, data]);
    } else if (selectedColumn) {
      const { error } = await supabase
        .from('crm_columns')
        .update(columnData)
        .eq('id', selectedColumn.id);

      if (error) throw error;

      setColumns(prev => prev.map(c => 
        c.id === selectedColumn.id ? { ...c, ...columnData } : c
      ));
    }
  };

  // Boards available for "Move to Board" (exclude current board)
  const availableBoards = (allBoards || []).filter(b => b.id !== boardId);

  const handleMoveToBoard = async (lead: CRMLead, targetBoard: CRMBoard) => {
    try {
      // Fetch the first column of the target board
      const { data: targetColumns, error: colError } = await supabase
        .from('crm_columns')
        .select('id, name')
        .eq('board_id', targetBoard.id)
        .order('sort_order', { ascending: true })
        .limit(1);

      if (colError || !targetColumns || targetColumns.length === 0) {
        toast.error('Nenhuma coluna encontrada no board de destino');
        return;
      }

      const targetColumn = targetColumns[0];

      // Update the lead's board_id and column_id
      const { error: updateError } = await supabase
        .from('crm_leads')
        .update({ board_id: targetBoard.id, column_id: targetColumn.id })
        .eq('id', lead.id);

      if (updateError) throw updateError;

      // Log the board transfer activity
      await supabase.from('crm_activities').insert({
        lead_id: lead.id,
        board_id: targetBoard.id,
        activity_type: 'board_transfer',
        description: `Lead ${lead.name} migrado de ${boardName} para ${targetBoard.name}`,
        from_column_name: columns.find(c => c.id === lead.column_id)?.name || 'Desconhecido',
        to_column_name: targetColumn.name,
        board_name: targetBoard.name
      });

      // Remove from local state (lead is no longer on this board)
      setLeads(prev => prev.filter(l => l.id !== lead.id));

      toast.success(`Lead ${lead.name} movido para ${targetBoard.name}!`);
    } catch (error: any) {
      console.error('Erro ao mover lead para outro board:', error);
      toast.error('Erro ao mover lead para outro board');
    }
  };

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 px-1">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              leads={leads}
              onAddLead={handleAddLead}
              onEditLead={handleEditLead}
              onDeleteLead={handleDeleteLead}
              onEditColumn={handleEditColumn}
              onDeleteColumn={handleDeleteColumn}
              onMoveToBoard={handleMoveToBoard}
              availableBoards={availableBoards}
            />
          ))}
          
          {/* Botão adicionar coluna */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-shrink-0"
          >
            <Button
              variant="ghost"
              onClick={handleAddColumn}
              className="h-full min-h-[200px] w-72 border-2 border-dashed border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 rounded-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              Adicionar Coluna
            </Button>
          </motion.div>
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="opacity-80">
              <KanbanCard
                lead={activeLead}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      <LeadDetailModal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        lead={selectedLead}
        columns={columns}
        onSave={handleSaveLead}
        mode={leadModalMode}
        defaultColumnId={defaultColumnId}
      />

      <AddColumnModal
        isOpen={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        column={selectedColumn}
        onSave={handleSaveColumn}
        mode={columnModalMode}
      />

      {/* Delete Confirmation */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card p-6 rounded-xl max-w-sm">
            <h3 className="font-semibold text-lg mb-2">Excluir Lead?</h3>
            <p className="text-muted-foreground mb-4">
              Tem certeza que deseja excluir "{leadToDelete?.name}"? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteLead} className="flex-1">
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Final Stage Dialog (Won/Lost) */}
      <FinalStageDialog
        isOpen={finalStageDialogOpen}
        leadName={pendingFinalMove?.leadName || ''}
        leadId={pendingFinalMove?.leadId}
        onConfirmWon={handleFinalStageWon}
        onConfirmLost={handleFinalStageLost}
        onCancel={handleFinalStageCancel}
      />
    </>
  );
};
