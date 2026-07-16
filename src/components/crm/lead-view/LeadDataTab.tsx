import React, { useState, useEffect } from 'react';
import { Phone, Globe, Calendar, DollarSign, ArrowRight, Check, X, Sparkles, Mail, Building2, Instagram as InstagramIcon, Pencil, User as UserIcon, Clock as ClockIcon, Target, IdCard, Cake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CallButton } from '@/components/calls/CallButton';
import { FinalStageDialog } from '../FinalStageDialog';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadDataTabProps {
  lead: {
    id: string;
    name: string;
    whatsapp: string;
    email?: string;
    instagram?: string;
    company_name?: string;
    lead_score: number;
    potential_value?: number;
    priority: string;
    source?: string;
    created_at?: string;
    first_contact_at?: string;
    column_id: string;
    tags?: string[];
    notes?: string;
    cpf?: string;
    birthday?: string;
  };
  columns: { id: string; name: string }[];
  onSave: (data: any) => Promise<void>;
}

// Instagram editable field
function InstagramField({ leadId, initialValue }: { leadId: string; initialValue: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);

  const save = async () => {
    const clean = value.replace('@', '').trim();
    await supabase.from('crm_leads').update({ instagram: clean }).eq('id', leadId);
    setSaved(clean);
    setValue(clean);
    setEditing(false);
    toast.success('Instagram atualizado');
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="@usuario"
          className="h-7 text-xs"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(saved); setEditing(false); } }}
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save}><Check className="w-3 h-3 text-green-500" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setValue(saved); setEditing(false); }}><X className="w-3 h-3 text-red-500" /></Button>
      </div>
    );
  }

  return (
    <span
      className="cursor-pointer hover:text-primary transition-colors text-muted-foreground"
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {saved ? `@${saved}` : 'Adicionar Instagram'}
    </span>
  );
}

// Inline email field — clique pra editar, salva ao Enter ou no check
function EmailField({ leadId, initialValue }: { leadId: string; initialValue: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);

  const save = async () => {
    const clean = value.trim().toLowerCase();
    if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error('Email inválido');
      return;
    }
    await supabase.from('crm_leads').update({ email: clean || null }).eq('id', leadId);
    setSaved(clean);
    setValue(clean);
    setEditing(false);
    toast.success(clean ? 'Email atualizado' : 'Email removido');
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1">
        <Input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="lead@email.com"
          className="h-7 text-xs"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(saved); setEditing(false); } }}
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save}><Check className="w-3 h-3 text-green-500" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setValue(saved); setEditing(false); }}><X className="w-3 h-3 text-red-500" /></Button>
      </div>
    );
  }

  return (
    <span
      className="cursor-pointer hover:text-primary transition-colors text-muted-foreground"
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {saved || 'Adicionar email'}
    </span>
  );
}

// Mascara progressiva pra CPF: 000.000.000-00
function maskCpf(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function CpfField({ leadId, initialValue }: { leadId: string; initialValue: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(maskCpf(initialValue || ''));
  const [saved, setSaved] = useState(maskCpf(initialValue || ''));

  const save = async () => {
    const digits = value.replace(/\D/g, '');
    if (digits && digits.length !== 11) {
      toast.error('CPF precisa ter 11 dígitos');
      return;
    }
    const masked = digits ? maskCpf(digits) : '';
    await supabase.from('crm_leads').update({ cpf: masked || null } as any).eq('id', leadId);
    setSaved(masked);
    setValue(masked);
    setEditing(false);
    toast.success(masked ? 'CPF atualizado' : 'CPF removido');
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1">
        <Input
          value={value}
          onChange={(e) => setValue(maskCpf(e.target.value))}
          placeholder="000.000.000-00"
          className="h-7 text-xs font-mono"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(saved); setEditing(false); } }}
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save}><Check className="w-3 h-3 text-green-500" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setValue(saved); setEditing(false); }}><X className="w-3 h-3 text-red-500" /></Button>
      </div>
    );
  }

  return (
    <span
      className="cursor-pointer hover:text-primary transition-colors text-muted-foreground font-mono"
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {saved || 'Adicionar CPF'}
    </span>
  );
}

function BirthdayField({ leadId, initialValue }: { leadId: string; initialValue: string }) {
  // initialValue chega como YYYY-MM-DD (date do Postgres). Exibimos formatado.
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue || '');
  const [saved, setSaved] = useState(initialValue || '');

  const save = async () => {
    await supabase.from('crm_leads').update({ birthday: value || null } as any).eq('id', leadId);
    setSaved(value);
    setEditing(false);
    toast.success(value ? 'Data de nascimento atualizada' : 'Data removida');
  };

  const display = saved ? format(new Date(saved + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR }) : '';
  const age = saved ? Math.floor((Date.now() - new Date(saved + 'T00:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1">
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 text-xs"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(saved); setEditing(false); } }}
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save}><Check className="w-3 h-3 text-green-500" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setValue(saved); setEditing(false); }}><X className="w-3 h-3 text-red-500" /></Button>
      </div>
    );
  }

  return (
    <span
      className="cursor-pointer hover:text-primary transition-colors text-muted-foreground"
      onClick={() => setEditing(true)}
      title="Clique para editar"
    >
      {display ? (
        <>
          {display}
          {age != null && <span className="ml-2 text-[10px] opacity-70">({age} anos)</span>}
        </>
      ) : 'Adicionar data de nascimento'}
    </span>
  );
}

// Migrate to another board/product
function MigrateBoard({ leadId }: { leadId: string }) {
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [currentBoard, setCurrentBoard] = useState<string>('');
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: lead } = await supabase.from('crm_leads').select('board_id').eq('id', leadId).single();
      if (lead) setCurrentBoard(lead.board_id);
      const { data } = await supabase.from('crm_boards').select('id, name').eq('is_active', true).order('sort_order');
      if (data) setBoards(data);
    })();
  }, [leadId]);

  const migrate = async (targetBoardId: string) => {
    if (targetBoardId === currentBoard) return;
    setMigrating(true);
    try {
      const { data: cols } = await supabase.from('crm_columns').select('id').eq('board_id', targetBoardId).order('sort_order').limit(1);
      if (!cols?.[0]) { toast.error('Board sem colunas'); return; }

      const fromBoard = boards.find(b => b.id === currentBoard)?.name || '';
      const toBoard = boards.find(b => b.id === targetBoardId)?.name || '';

      await supabase.from('crm_leads').update({ board_id: targetBoardId, column_id: cols[0].id }).eq('id', leadId);
      await supabase.from('crm_activities').insert({
        lead_id: leadId,
        activity_type: 'board_transfer',
        description: `Lead migrado de ${fromBoard} para ${toBoard}`,
      });

      setCurrentBoard(targetBoardId);
      toast.success(`Migrado para ${toBoard}`);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setMigrating(false);
    }
  };

  const currentBoardName = boards.find(b => b.id === currentBoard)?.name || '';

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">PRODUTO / BOARD</span>
      </div>
      {currentBoardName && (
        <Badge className="mb-3 bg-blue-500/15 text-blue-400 border-blue-500/30">{currentBoardName}</Badge>
      )}
      <p className="text-xs text-muted-foreground mb-2">Migrar para:</p>
      <div className="flex flex-wrap gap-1.5">
        {boards.filter(b => b.id !== currentBoard).map(board => (
          <button
            key={board.id}
            onClick={() => migrate(board.id)}
            disabled={migrating}
            className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-blue-500/50 hover:bg-blue-500/10 transition-all text-muted-foreground hover:text-blue-400"
          >
            {board.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// BANT Qualification
interface BANTData {
  budget: string;
  authority: string;
  need: string;
  timeline: string;
}

const BANT_OPTIONS: Record<string, { label: string; options: { value: string; label: string; color: string }[] }> = {
  budget: {
    label: 'Budget',
    options: [
      { value: 'undefined', label: 'Indefinido', color: 'bg-muted text-muted-foreground' },
      { value: 'low', label: 'Baixo', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
      { value: 'medium', label: 'Médio', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      { value: 'high', label: 'Alto', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    ]
  },
  authority: {
    label: 'Authority',
    options: [
      { value: 'undefined', label: 'Indefinido', color: 'bg-muted text-muted-foreground' },
      { value: 'influencer', label: 'Influenciador', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      { value: 'decision_maker', label: 'Decisor', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    ]
  },
  need: {
    label: 'Need',
    options: [
      { value: 'undefined', label: 'Indefinido', color: 'bg-muted text-muted-foreground' },
      { value: 'exploring', label: 'Explorando', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
      { value: 'identified', label: 'Identificada', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      { value: 'urgent', label: 'Urgente', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    ]
  },
  timeline: {
    label: 'Timeline',
    options: [
      { value: 'undefined', label: 'Indefinido', color: 'bg-muted text-muted-foreground' },
      { value: 'long', label: '6+ meses', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
      { value: 'medium', label: '1-3 meses', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      { value: 'short', label: 'Imediato', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    ]
  },
};

const BANT_ICONS: Record<string, string> = {
  budget: '$',
  authority: 'A',
  need: 'N',
  timeline: 'T',
};

export const LeadDataTab: React.FC<LeadDataTabProps> = ({ lead, columns, onSave }) => {
  const [bant, setBant] = useState<BANTData>({ budget: 'undefined', authority: 'undefined', need: 'undefined', timeline: 'undefined' });
  const [isEditing, setIsEditing] = useState(false);
  const [dealValue, setDealValue] = useState(lead.potential_value?.toString() || '');
  const [lostReason, setLostReason] = useState('');
  const [movingTo, setMovingTo] = useState<string | null>(null);

  // Load BANT from lead metadata (stored in notes as JSON prefix or separate)
  useEffect(() => {
    if (lead.notes) {
      try {
        const match = lead.notes.match(/\[BANT:(.*?)\]/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          setBant(prev => ({ ...prev, ...parsed }));
        }
      } catch {}
    }
  }, [lead.notes]);

  // Calculate BANT score 0-100 based on categorical values
  const bantPointMap: Record<string, Record<string, number>> = {
    budget: { undefined: 0, low: 8, medium: 17, high: 25 },
    authority: { undefined: 0, influencer: 12, decision_maker: 25 },
    need: { undefined: 0, exploring: 8, identified: 17, urgent: 25 },
    timeline: { undefined: 0, long: 8, medium: 17, short: 25 },
  };
  const bantTotal = Object.entries(bant).reduce((sum, [key, val]) => sum + (bantPointMap[key]?.[val] || 0), 0);
  const bantScore = Object.values(bant).filter(v => v !== 'undefined').length;

  const saveBant = async (newBant: BANTData) => {
    setBant(newBant);
    const bantString = `[BANT:${JSON.stringify(newBant)}]`;
    const cleanNotes = (lead.notes || '').replace(/\[BANT:.*?\]/, '').trim();
    const newNotes = `${bantString}${cleanNotes ? '\n' + cleanNotes : ''}`;
    await supabase.from('crm_leads').update({ notes: newNotes }).eq('id', lead.id);
  };

  const handleMoveToColumn = async (columnId: string) => {
    setMovingTo(columnId);
    try {
      const oldColumn = columns.find(c => c.id === lead.column_id);
      const newColumn = columns.find(c => c.id === columnId);
      await onSave({ column_id: columnId });
      
      // Log activity
      await supabase.from('crm_activities').insert({
        lead_id: lead.id,
        activity_type: 'column_change',
        description: `${lead.name} movido de ${oldColumn?.name} para ${newColumn?.name}`,
        from_column_name: oldColumn?.name,
        to_column_name: newColumn?.name,
      });
      toast.success(`Movido para ${newColumn?.name}`);
    } catch {
      toast.error('Erro ao mover');
    }
    setMovingTo(null);
  };

  const [showFinalDialog, setShowFinalDialog] = useState(false);

  const handleCloseDeal = () => {
    setShowFinalDialog(true);
  };

  const handleWonConfirm = async (dealVal: number | null, saleData?: any) => {
    const closedColumn = columns.find(c => c.name.toLowerCase().includes('fechado'));
    if (!closedColumn) return toast.error('Coluna "Fechado" não encontrada');

    await onSave({
      column_id: closedColumn.id,
      potential_value: dealVal || parseFloat(dealValue) || 0,
      closed_at: new Date().toISOString(),
      post_sale_stage: 'awaiting_onboarding',
    });

    // Auto-create member + enrollment + contract (same as KanbanBoard)
    const phone = lead.whatsapp.replace(/\D/g, '');
    try {
      // Create member
      const { data: existing } = await (supabase as any).from('members').select('id').eq('phone', phone).maybeSingle();
      let memberId = existing?.id;

      if (!memberId) {
        const { data: newMember } = await (supabase as any).from('members').insert({
          name: lead.name, email: lead.email || `${phone}@squaad.com`, phone,
          status: 'pending', crm_lead_id: lead.id, program: 'metodo-vencedores',
        }).select('id').single();
        memberId = newMember?.id;
      }

      // Create enrollment + send WhatsApp
      const { data: enrollment } = await (supabase as any).from('metodo_squaad_enrollments').insert({
        crm_lead_id: lead.id, name: lead.name, whatsapp: phone, status: 'pending',
      }).select('onboarding_token').single();

      if (enrollment?.onboarding_token) {
        const url = `https://squaad.com.br/metodo-vencedores/onboarding/${enrollment.onboarding_token}`;
        // Onboarding 1-to-1: instancia UAZAPI, nunca Cloud API/blast.
        const { data: instances } = await (supabase as any).from('whatsapp_instances').select('id')
          .eq('status', 'connected')
          .eq('provider', 'uazapi')
          .not('is_dedicated_blast', 'is', true)
          .order('created_at')
          .limit(1);
        if (instances?.[0]) {
          await supabase.functions.invoke('uazapi-proxy', {
            body: {
              action: 'send_text', instance_id: instances[0].id,
              number: phone.startsWith('55') ? phone : '55' + phone,
              text: `Parabens ${lead.name}, seja muito bem-vindo ao programa.\n\nVamos jogar duro juntos, esse e o comeco de uma jornada que vai transformar seu negocio com Inteligencia Artificial.\n\nPreencha seu onboarding personalizado:\n\n${url}\n\nQualquer duvida, estou aqui.`,
            },
          });
          toast.success('Onboarding enviado via WhatsApp!');
        }
      }

      // Create contract if saleData
      if (saleData && memberId) {
        const installmentValue = saleData.numInstallments > 0
          ? (saleData.totalValue - saleData.entryValue) / saleData.numInstallments : 0;

        const { data: contract } = await (supabase as any).from('member_contracts').insert({
          member_id: memberId, crm_lead_id: lead.id, program: 'metodo-vencedores',
          total_value: saleData.totalValue, entry_value: saleData.entryValue,
          entry_method: saleData.entryMethod, num_installments: saleData.numInstallments,
          installment_value: Math.round(installmentValue * 100) / 100,
          payment_method: saleData.installmentMethod, status: 'active', gateway: 'manual',
          is_promise: saleData.isPromise || false, promise_date: saleData.promiseDate || null,
        }).select('id').single();

        if (contract?.id) {
          const payments: any[] = [];
          const firstDue = new Date(saleData.firstDueDate + 'T12:00:00');
          for (let i = 0; i < saleData.numInstallments; i++) {
            const dueDate = new Date(firstDue);
            dueDate.setMonth(dueDate.getMonth() + i);
            payments.push({
              contract_id: contract.id, member_id: memberId, installment_number: i + 1,
              value: Math.round(installmentValue * 100) / 100,
              due_date: dueDate.toISOString().split('T')[0], status: 'pending',
            });
          }
          if (payments.length > 0) await (supabase as any).from('member_payments').insert(payments);
          toast.success(`Contrato: ${saleData.numInstallments}x R$ ${(Math.round(installmentValue * 100) / 100).toFixed(2)}`);
        }
      }
    } catch (e: any) {
      console.error('Post-sale error:', e);
    }

    setShowFinalDialog(false);
    toast.success('Negocio fechado!');
  };

  const handleLostDeal = async () => {
    const lostColumn = columns.find(c => c.name.toLowerCase().includes('perdido'));
    if (!lostColumn) return toast.error('Coluna "Perdido" não encontrada');
    await onSave({ column_id: lostColumn.id, lost_reason: lostReason || 'Não informado' });
    toast.success('Lead marcado como perdido');
  };

  const currentColumn = columns.find(c => c.id === lead.column_id);
  const sourceLabel = getSourceLabel(lead.source);
  // TEMPO NA BASE = primeiro contato real da pessoa (cross-board), não só desse lead
  const baseDate = lead.first_contact_at || lead.created_at;
  const timeInFunnel = baseDate ? formatDistanceToNow(new Date(baseDate), { locale: ptBR }) : '—';
  const isReturningLead = !!(lead.first_contact_at && lead.created_at &&
    new Date(lead.created_at).getTime() - new Date(lead.first_contact_at).getTime() > 86_400_000);

  return (
    <div className="space-y-4 overflow-auto max-h-[60vh] pr-1">
      {/* Contact Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CONTATO</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsEditing(!isEditing)}>
              <Pencil className="w-3 h-3" />
              Editar
            </Button>
            <CallButton phoneNumber={lead.whatsapp} leadId={lead.id} size="sm" />
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">+{lead.whatsapp}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <EmailField leadId={lead.id} initialValue={lead.email || ''} />
          </div>
          <div className="flex items-center gap-2">
            <InstagramIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <InstagramField leadId={lead.id} initialValue={lead.instagram || ''} />
          </div>
          <div className="flex items-center gap-2">
            <IdCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <CpfField leadId={lead.id} initialValue={lead.cpf || ''} />
          </div>
          <div className="flex items-center gap-2">
            <Cake className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <BirthdayField leadId={lead.id} initialValue={lead.birthday || ''} />
          </div>
          {lead.company_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span>{lead.company_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Origin / Tracking */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ORIGEM / TRACKING</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Fonte</p>
            <p className="text-sm font-medium">{sourceLabel}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Score</p>
            <p className="text-sm font-medium">{lead.lead_score}/100</p>
          </div>
        </div>
        {baseDate && (
          <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span>
                Primeiro contato em{' '}
                {format(new Date(baseDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {isReturningLead && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow/15 text-yellow border border-yellow/30">
                    LEAD RECORRENTE
                  </span>
                )}
              </span>
            </div>
            {isReturningLead && lead.created_at && (
              <div className="flex items-center gap-1.5 pl-[18px] text-[11px]">
                <span className="opacity-70">
                  Entrou nesse board em{' '}
                  {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BANT Qualification */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${bantTotal >= 70 ? 'bg-green-500/15 text-green-400' : bantTotal >= 40 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
              {bantTotal}
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">BANT</span>
              <span className="text-[10px] text-muted-foreground">{bantScore}/4 criterios</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-sm font-bold ${bantTotal >= 70 ? 'text-green-400' : bantTotal >= 40 ? 'text-yellow-400' : 'text-muted-foreground'}`}>{bantTotal}/100</span>
          </div>
        </div>
        {/* BANT Progress Bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${bantTotal >= 70 ? 'bg-gradient-to-r from-green-500/60 to-green-500' : bantTotal >= 40 ? 'bg-gradient-to-r from-yellow-500/60 to-yellow-500' : 'bg-gradient-to-r from-muted-foreground/40 to-muted-foreground'}`}
            style={{ width: `${bantTotal}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(BANT_OPTIONS) as (keyof BANTData)[]).map(key => {
            const config = BANT_OPTIONS[key];
            const current = config.options.find(o => o.value === bant[key]) || config.options[0];
            return (
              <Select
                key={key}
                value={bant[key]}
                onValueChange={(val) => {
                  const newBant = { ...bant, [key]: val };
                  saveBant(newBant);
                }}
              >
                <SelectTrigger className={`h-auto py-2 px-3 ${current.color} border`}>
                  <div className="flex items-center gap-2 text-left">
                    <span>{BANT_ICONS[key]}</span>
                    <div>
                      <p className="text-xs font-semibold">{config.label}</p>
                      <p className="text-[10px] opacity-70">{current.label}</p>
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {config.options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
        </div>
      </div>

      {/* Migrate to another board/product */}
      <MigrateBoard leadId={lead.id} />

      {/* Negotiation */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">NEGOCIAÇÃO</span>
        </div>

        {currentColumn && (
          <Badge className="mb-3 bg-primary/15 text-primary border-primary/30">{currentColumn.name}</Badge>
        )}

        <p className="text-xs text-muted-foreground mb-2">Mover para:</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {columns
            .filter(c => c.id !== lead.column_id)
            .slice(0, 6)
            .map(col => (
              <Button
                key={col.id}
                size="sm"
                variant="outline"
                className="h-7 text-[11px] gap-1"
                disabled={movingTo === col.id}
                onClick={() => handleMoveToColumn(col.id)}
              >
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                {col.name}
              </Button>
            ))}
        </div>

        {/* Close / Lost */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Valor R$"
              value={dealValue}
              onChange={e => setDealValue(e.target.value)}
              className="flex-1 h-9"
              type="number"
            />
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-9 gap-1" onClick={handleCloseDeal}>
              Fechou <Check className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={lostReason} onValueChange={setLostReason}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preco">Preço</SelectItem>
                <SelectItem value="concorrente">Concorrente</SelectItem>
                <SelectItem value="timing">Timing</SelectItem>
                <SelectItem value="sem_resposta">Sem resposta</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-9 gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={handleLostDeal}>
              Perdeu <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lead.tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Final Stage Dialog (sale form) */}
      <FinalStageDialog
        isOpen={showFinalDialog}
        leadName={lead.name}
        leadId={lead.id}
        onConfirmWon={handleWonConfirm}
        onConfirmLost={(reason) => {
          handleLostDeal();
          setShowFinalDialog(false);
        }}
        onCancel={() => setShowFinalDialog(false)}
      />
    </div>
  );
};

function getSourceLabel(source?: string) {
  switch (source) {
    case 'popup_ddd': return 'Landing Page';
    case 'manual': return 'Manual';
    case 'webhook': return 'Webhook';
    case 'vhs': case 'vhs_popup': return 'VHS Popup';
    case 'checkout_vhs': return 'Checkout VHS';
    case 'whatsapp': return 'WhatsApp';
    default: return source || '—';
  }
}
