import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Users,
  UserCheck,
  Clock,
  Search,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  Upload,
  Download,
  FileText,
  Video,
  BookOpen,
  BarChart3,
  GraduationCap,
  Trophy,
  Zap,
  DollarSign,
  AlertTriangle,
  Calendar,
  CreditCard,
  Settings,
  ToggleLeft,
  ToggleRight,
  Send,
  Link,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import VideoUploadDialog from '@/components/admin/VideoUploadDialog';
import MembersOnlineWidget from '@/components/admin/MembersOnlineWidget';
import MeetingAccessRequests from '@/components/admin/MeetingAccessRequests';
import LiveSessionsSection from '@/components/admin/LiveSessionsSection';
import SupportMaterialsEditor from '@/components/admin/SupportMaterialsEditor';
import MemberEditDialog from '@/components/admin/MemberEditDialog';
import AcceleratorEditor from '@/components/admin/AcceleratorEditor';
import MemberJourneyMap from '@/components/admin/MemberJourneyMap';
import { MemberFinancialDrawer } from '@/components/admin/MemberFinancialDrawer';
import { MemberEngagementDrawer } from '@/components/admin/MemberEngagementDrawer';
import { transcribeWithSoniox } from '@/lib/sonioxTranscribe';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  blocked: 'Bloqueado',
  expired: 'Expirado',
};

const LEVEL_LABELS: Record<string, string> = {
  iniciante: 'Iniciante',
  explorador: 'Explorador',
  construtor: 'Construtor',
  mestre: 'Mestre',
  lenda: 'Lenda',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  xp: number;
  level: string;
  total_time_minutes: number;
  total_lessons_completed: number;
  last_active_at: string | null;
  created_at: string;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  sort_order: number;
  is_published: boolean;
  is_locked: boolean;
  required_level: string | null;
  allowed_programs: string[] | null;
  total_lessons: number;
  created_at: string;
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  type: string;
  content_url: string | null;
  duration_minutes: number;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  pdf_url?: string | null;
  pdf_status?: 'idle' | 'generating' | 'error' | null;
  pdf_error?: string | null;
  pdf_started_at?: string | null;
  meeting_id?: string | null;
}

interface MemberFile {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  uploaded_by: string | null;
  download_count: number;
  created_at: string;
  thumbnail?: string | null;
  is_published?: boolean;
  is_featured?: boolean;
  publish_at?: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminMembros() {
  const [activeTab, setActiveTab] = useState('alunos');
  const [loading, setLoading] = useState(true);

  // Alunos state
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // Engajamento: rpc member_engagement_list devolve score + classification
  // por member_id. Merge no map. Click no botao abre o drawer.
  const [engagementMap, setEngagementMap] = useState<Record<string, { score: number; classification: string; days: number }>>({});
  const [engagementMemberId, setEngagementMemberId] = useState<string | null>(null);

  // Conteudo state
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  // Set de lesson.id em geração de PDF agora (mantém spinner mesmo sem reload do banco)
  const [pdfGenerating, setPdfGenerating] = useState<Set<string>>(new Set());
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', thumbnail_url: '', category: 'trilha', sort_order: 0, is_published: true, is_locked: false, required_level: '', allowed_programs: [] as string[] });
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', type: 'video', content_url: '', duration_minutes: 0, sort_order: 0, is_published: true, support_description: '', support_materials: [] as any[], clip_start_seconds: '' as string | number, clip_end_seconds: '' as string | number });

  // Files state
  const [files, setFiles] = useState<MemberFile[]>([]);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [editingFile, setEditingFile] = useState<any | null>(null);
  const [fileForm, setFileForm] = useState({ title: '', description: '', file_url: '', file_type: 'pdf', category: 'geral' });

  // Lesson recording / upload state
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [recordModuleId, setRecordModuleId] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState({ title: '', host_name: '+ que Vencedores' });
  const [creatingRecording, setCreatingRecording] = useState(false);

  // Orphan recordings (meetings em modo aula que nao publicaram aula ainda)
  const [orphanRecordings, setOrphanRecordings] = useState<any[]>([]);
  const [recoveringMeetingId, setRecoveringMeetingId] = useState<string | null>(null);

  // Member edit dialog
  const [editingMember, setEditingMember] = useState<any>(null);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<{
    timePerMember: { name: string; minutes: number }[];
    progressPerModule: { name: string; value: number }[];
    activeMembersPerDay: { date: string; count: number }[];
  }>({ timePerMember: [], progressPerModule: [], activeMembersPerDay: [] });

  // Financeiro state
  const [payments, setPayments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [billingConfigs, setBillingConfigs] = useState<any[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentMemberFilter, setPaymentMemberFilter] = useState('');
  const [paymentPeriodFilter, setPaymentPeriodFilter] = useState<'all' | 'day' | 'week' | 'month' | 'year'>('all');
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [sendingLinkPaymentId, setSendingLinkPaymentId] = useState<string | null>(null);
  const [financialDrawerMemberId, setFinancialDrawerMemberId] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.status === 'active').length;
    const pending = members.filter((m) => m.status === 'pending').length;
    const avgTime = total > 0 ? Math.round(members.reduce((s, m) => s + (m.total_time_minutes || 0), 0) / total) : 0;
    return { total, active, pending, avgTime };
  }, [members]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    let list = members;
    if (statusFilter !== 'all') {
      list = list.filter((m) => m.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    }
    return list;
  }, [members, searchQuery, statusFilter]);

  // ─── Data loading ───────────────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadMembers(), loadModules(), loadLessons(), loadFiles(), loadAnalytics(), loadPayments(), loadBillingConfigs(), loadOrphanRecordings()]);
    setLoading(false);
  };

  const loadOrphanRecordings = async () => {
    // Meetings em modo aula que nao foram publicadas ainda
    // (target_lesson_id NULL OU lesson com is_published=false)
    const { data } = await (supabase as any)
      .from('meetings')
      .select('id, title, target_module_id, target_lesson_id, target_lesson_title, recording_url, recording_status, processing_step, transcription, livekit_room_name, ended_at, created_at, status')
      .eq('lesson_mode', true)
      .order('created_at', { ascending: false })
      .limit(30);
    const list = (data || []).filter((m: any) => {
      if (!m.target_lesson_id) return true; // nunca publicou
      // se publicou, checa se aula existe
      return false;
    });
    setOrphanRecordings(list);
  };

  const dismissOrphanRecording = async (meeting: any) => {
    if (!confirm(`Limpar a gravacao "${meeting.target_lesson_title || meeting.title || 'sem titulo'}" da lista? O meeting fica preservado no historico.`)) return;
    try {
      const { error } = await (supabase as any)
        .from('meetings')
        .update({ lesson_mode: false })
        .eq('id', meeting.id);
      if (error) throw error;
      setOrphanRecordings((prev) => prev.filter((m: any) => m.id !== meeting.id));
      toast.success('Gravacao removida da lista');
    } catch (e: any) {
      toast.error('Falha ao limpar: ' + (e.message || 'erro'));
    }
  };

  const recoverRecording = async (meeting: any) => {
    setRecoveringMeetingId(meeting.id);
    const toastId = toast.loading('Buscando gravacao no LiveKit...');
    try {
      // 1. Se nao tem recording_url, tenta recuperar via LiveKit
      if (!meeting.recording_url) {
        const { data: recoverData, error: recoverErr } = await supabase.functions.invoke('lesson-recording-recover', {
          body: { meeting_id: meeting.id },
        });
        if (recoverErr) throw new Error(recoverErr.message);
        if (recoverData?.error) throw new Error(recoverData.error);
        if (!recoverData?.success) {
          throw new Error(recoverData?.message || 'Gravacao nao encontrada no LiveKit');
        }
        toast.loading('Gravacao recuperada. Transcrevendo...', { id: toastId });
      }

      // 2. Recarrega meeting (pode ter ganho recording_url no passo 1)
      const { data: refreshed } = await (supabase as any)
        .from('meetings').select('recording_url, transcription').eq('id', meeting.id).single();
      const url = refreshed?.recording_url;
      if (!url) throw new Error('Nao foi possivel obter URL da gravacao');

      // 3. Se nao tem transcricao, transcreve via Soniox
      let transcription = (refreshed?.transcription || '').trim();
      if (transcription.length < 80) {
        toast.loading('Transcrevendo com Soniox...', { id: toastId });
        transcription = await transcribeWithSoniox(url, (p) => {
          toast.loading(p.message, { id: toastId });
        });
        await (supabase as any).from('meetings').update({ transcription }).eq('id', meeting.id);
      }

      // 4. Pipeline de PDF + publicacao
      toast.loading('Gerando PDF e publicando aula...', { id: toastId });
      const { data, error } = await supabase.functions.invoke('process-lesson-recording', {
        body: { meeting_id: meeting.id, force: true },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Pipeline falhou');
      }

      toast.success(
        data?.pdf_url
          ? 'Aula publicada com PDF'
          : 'Aula publicada (sem PDF)',
        { id: toastId, duration: 8000 }
      );
      loadAll();
    } catch (e: any) {
      toast.error('Falha ao recuperar: ' + e.message, { id: toastId, duration: 12000 });
    } finally {
      setRecoveringMeetingId(null);
    }
  };

  const loadMembers = async () => {
    const [{ data: rows }, { data: eng }] = await Promise.all([
      (supabase as any).from('members').select('*').order('created_at', { ascending: false }),
      (supabase as any).rpc('member_engagement_list', { p_status: null }),
    ]);
    setMembers(rows || []);
    const map: Record<string, { score: number; classification: string; days: number }> = {};
    if (Array.isArray(eng)) {
      for (const e of eng) {
        map[e.member_id] = {
          score: e.engagement_score || 0,
          classification: e.classification || 'inativo',
          days: e.days_since_last_access || 0,
        };
      }
    }
    setEngagementMap(map);
  };

  const loadModules = async () => {
    const { data } = await (supabase as any).from('member_modules').select('*').order('sort_order');
    setModules(data || []);
  };

  const loadLessons = async () => {
    const { data } = await (supabase as any).from('member_lessons').select('*').order('sort_order');

    // Auto-recovery: aulas com pdf_status='generating' ha mais de 15min sao consideradas timeout
    // (provavelmente o user fechou a aba, ou Soniox nao respondeu). Marca como error pra permitir retry.
    const STALE_MS = 15 * 60 * 1000;
    const now = Date.now();
    const stale = (data || []).filter(
      (l: Lesson) =>
        l.pdf_status === 'generating' &&
        l.pdf_started_at &&
        now - new Date(l.pdf_started_at).getTime() > STALE_MS,
    );
    if (stale.length > 0) {
      const ids = stale.map((l: Lesson) => l.id);
      await (supabase as any)
        .from('member_lessons')
        .update({
          pdf_status: 'error',
          pdf_error: 'Geracao expirou (>15min). Provavelmente a aba foi fechada antes de terminar.',
        })
        .in('id', ids);
      // Reflete localmente
      const fixed = (data || []).map((l: Lesson) =>
        ids.includes(l.id) ? { ...l, pdf_status: 'error' as const, pdf_error: 'Geracao expirou' } : l,
      );
      setLessons(fixed);
      return;
    }

    setLessons(data || []);
  };

  const loadFiles = async () => {
    const { data } = await (supabase as any).from('member_files').select('*').order('created_at', { ascending: false });
    setFiles(data || []);
  };

  const loadAnalytics = async () => {
    // Time per member (top 10)
    const { data: membersData } = await (supabase as any)
      .from('members')
      .select('name, total_time_minutes')
      .order('total_time_minutes', { ascending: false })
      .limit(10);

    // Conclusoes por modulo: cruza member_progress.lesson_id -> member_lessons.module_id.
    // (Antes contava TODAS as conclusoes pra cada modulo, dando fatias iguais.)
    const { data: modulesData } = await (supabase as any).from('member_modules').select('id, title');
    const { data: lessonsData } = await (supabase as any).from('member_lessons').select('id, module_id');
    const { data: progressData } = await (supabase as any).from('member_progress').select('lesson_id, completed');

    const lessonToModule: Record<string, string> = {};
    (lessonsData || []).forEach((l: any) => { if (l.module_id) lessonToModule[l.id] = l.module_id; });
    const countByModule: Record<string, number> = {};
    (progressData || []).filter((p: any) => p.completed).forEach((p: any) => {
      const mod = lessonToModule[p.lesson_id];
      if (mod) countByModule[mod] = (countByModule[mod] || 0) + 1;
    });
    const moduleProgress = (modulesData || [])
      .map((mod: any) => ({ name: mod.title?.substring(0, 22) || 'Sem titulo', value: countByModule[mod.id] || 0 }))
      .filter((x: any) => x.value > 0);

    // Membros ativos por dia (DISTINTOS por member_id, nao por sessao) — ultimos 7 dias
    const { data: sessionsData } = await (supabase as any)
      .from('member_sessions')
      .select('started_at, member_id')
      .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const dayMap: Record<string, Set<string>> = {};
    (sessionsData || []).forEach((s: any) => {
      const day = new Date(s.started_at).toISOString().split('T')[0];
      if (!dayMap[day]) dayMap[day] = new Set();
      if (s.member_id) dayMap[day].add(s.member_id);
    });

    const activeDays = Object.entries(dayMap)
      .map(([date, set]) => ({ date: date.substring(5), count: set.size }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setAnalyticsData({
      timePerMember: (membersData || []).map((m: any) => ({ name: m.name?.split(' ')[0] || '?', minutes: m.total_time_minutes || 0 })),
      progressPerModule: moduleProgress,
      activeMembersPerDay: activeDays,
    });
  };

  // ─── Billing data ───────────────────────────────────────────────────────

  const loadPayments = async () => {
    const { data } = await (supabase as any)
      .from('member_payments')
      .select('*, members(name, phone, status)')
      .order('due_date', { ascending: true });
    setPayments(data || []);

    const { data: contractsData } = await (supabase as any)
      .from('member_contracts')
      .select('*')
      .order('created_at', { ascending: false });
    setContracts(contractsData || []);
  };

  const loadBillingConfigs = async () => {
    const { data } = await (supabase as any)
      .from('billing_config')
      .select('*')
      .order('gateway');
    setBillingConfigs(data || []);
  };

  const confirmPayment = async (paymentId: string) => {
    const payment = payments.find((p: any) => p.id === paymentId);
    if (!payment) return;

    const expected = parseFloat(payment.value);
    const input = window.prompt(
      `Valor recebido (em R$). Deixe ${expected.toFixed(2)} para baixa integral, ou informe o valor pago para baixa parcial:`,
      expected.toFixed(2)
    );
    if (input === null) return; // cancelado

    const paid = parseFloat(input.replace(',', '.'));
    if (isNaN(paid) || paid <= 0) {
      toast.error('Valor invalido');
      return;
    }

    setConfirmingPaymentId(paymentId);
    try {
      const isPartial = paid < expected;
      const remaining = Math.round((expected - paid) * 100) / 100;

      // Baixa da parcela original (paid ou partial)
      await (supabase as any).from('member_payments').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_value: paid,
        notes: isPartial
          ? `Baixa parcial: R$ ${paid.toFixed(2)} de R$ ${expected.toFixed(2)} (saldo de R$ ${remaining.toFixed(2)} gerado como nova parcela)`
          : (payment.notes || null),
      }).eq('id', paymentId);

      // Se for parcial, cria nova parcela com o saldo devedor (vencimento +15d)
      if (isPartial && remaining > 0) {
        const newDue = new Date();
        newDue.setDate(newDue.getDate() + 15);
        await (supabase as any).from('member_payments').insert({
          contract_id: payment.contract_id,
          member_id: payment.member_id,
          installment_number: payment.installment_number,
          value: remaining,
          due_date: newDue.toISOString().slice(0, 10),
          status: 'pending',
          payment_method: payment.payment_method,
          notes: `Saldo restante da parcela #${payment.installment_number} (baixa parcial em ${new Date().toLocaleDateString('pt-BR')})`,
        });
        toast.success(`Baixa parcial: R$ ${paid.toFixed(2)} registrado. Saldo de R$ ${remaining.toFixed(2)} criado como nova parcela.`);
      } else {
        toast.success('Pagamento confirmado');
      }

      // Desbloqueia membro se estava bloqueado
      if (payment.member_id) {
        await (supabase as any)
          .from('members')
          .update({ status: 'active' })
          .eq('id', payment.member_id)
          .eq('status', 'blocked');
      }

      loadPayments();
      loadMembers();
    } catch (e) {
      toast.error('Erro ao confirmar pagamento');
    }
    setConfirmingPaymentId(null);
  };

  const deletePayment = async (paymentId: string) => {
    if (!confirm('Excluir esta parcela?')) return;
    try {
      await (supabase as any).from('member_payments').delete().eq('id', paymentId);
      toast.success('Parcela excluida');
      loadPayments();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  const deleteContract = async (contractId: string) => {
    if (!confirm('Excluir este contrato e TODAS as parcelas?')) return;
    try {
      // Payments cascade on contract delete
      await (supabase as any).from('member_contracts').delete().eq('id', contractId);
      toast.success('Contrato e parcelas excluidos');
      loadPayments();
    } catch (e) {
      toast.error('Erro ao excluir contrato');
    }
  };

  const sendPaymentLink = async (payment: any) => {
    setSendingLinkPaymentId(payment.id);
    try {
      let paymentUrl = payment.gateway_invoice_url;

      if (!paymentUrl) {
        // Resolve gateway ativo via RPC (billing_config e service-role-only por RLS, nao da
        // pra ler no client; sem isso caia no stripe quebrado). RPC devolve so o nome.
        const { data: gw } = await (supabase as any).rpc('get_active_billing_gateway');
        const gateway = gw || null;
        if (!gateway) {
          toast.error('Nenhum gateway de cobranca ativo. Ative o Asaas ou Stripe.');
          setSendingLinkPaymentId(null);
          return;
        }
        const fnName = gateway === 'asaas' ? 'asaas-create-payment' : 'stripe-create-payment';

        // Asaas exige CPF: se nao tiver salvo, pede e atualiza member antes
        if (gateway === 'asaas') {
          const { data: m } = await (supabase as any)
            .from('members')
            .select('cpf')
            .eq('id', payment.member_id)
            .maybeSingle();
          let cpf = (m?.cpf || '').replace(/\D/g, '');
          if (cpf.length !== 11 && cpf.length !== 14) {
            const input = window.prompt('CPF ou CNPJ do membro (so numeros, exigencia do Asaas):');
            if (input === null) {
              setSendingLinkPaymentId(null);
              return;
            }
            cpf = input.replace(/\D/g, '');
            if (cpf.length !== 11 && cpf.length !== 14) {
              toast.error('CPF/CNPJ invalido. Precisa ter 11 ou 14 digitos.');
              setSendingLinkPaymentId(null);
              return;
            }
            await (supabase as any).from('members').update({ cpf }).eq('id', payment.member_id);
          }
        }

        const gwRes = await supabase.functions.invoke(fnName, {
          body: { payment_id: payment.id, member_id: payment.member_id, contract_id: payment.contract_id },
        });
        if (gwRes.error || !gwRes.data?.url) {
          toast.error(`Erro ao gerar link ${gateway}: ` + (gwRes.error?.message || gwRes.data?.error || 'sem URL'));
          setSendingLinkPaymentId(null);
          return;
        }
        paymentUrl = gwRes.data.url;
      }

      // Send via WhatsApp if member has phone
      const memberPhone = payment.members?.phone;
      const memberName = payment.members?.name?.split(' ')[0] || 'Aluno';

      // Cobranca no tom certo: atraso vira lembrete gentil; em dia vira so o link
      const due = payment.due_date ? new Date(payment.due_date + 'T00:00:00') : null;
      const daysLate = due ? Math.floor((Date.now() - due.getTime()) / 86400000) : 0;
      const isOverdue = payment.status === 'overdue' || (daysLate > 0 && payment.status !== 'paid');
      const atrasoTxt = daysLate === 1 ? '1 dia' : `${daysLate} dias`;
      const waText = isOverdue
        ? `Oi ${memberName}, tudo bem? Passando aqui rapidinho por causa da parcela #${payment.installment_number} do Metodo + que Vencedores, que venceu tem ${atrasoTxt}. Sei que a correria do dia a dia atropela a gente, entao ja deixei o link atualizado pronto pra voce resolver sem dor de cabeca (da pra pagar no pix ou no boleto):\n\n${paymentUrl}\n\nAssim que acertar me da um toque, combinado? Qualquer coisa to por aqui. Abraco.`
        : `Oi ${memberName}, segue o link pra voce garantir o pagamento da parcela #${payment.installment_number} do Metodo + que Vencedores:\n\n${paymentUrl}\n\nQualquer duvida to por aqui. Abraco.`;

      if (memberPhone) {
        const cleanPhone = memberPhone.replace(/\D/g, '');
        const phoneNumber = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;

        // Envio 1-to-1: so instancia uazapi nao-dedicada (nunca cloud_api/blast)
        const { data: instances } = await (supabase as any)
          .from('whatsapp_instances')
          .select('id')
          .eq('status', 'connected')
          .eq('provider', 'uazapi')
          .neq('is_dedicated_blast', true)
          .order('created_at', { ascending: true })
          .limit(1);

        if (instances?.[0]) {
          const waRes = await supabase.functions.invoke('uazapi-proxy', {
            body: {
              action: 'send_text',
              instance_id: instances[0].id,
              number: phoneNumber,
              text: waText,
            },
          });
          if (waRes.error || waRes.data?.error) {
            toast.error('Falha ao enviar por WhatsApp: ' + (waRes.error?.message || waRes.data?.error || 'erro desconhecido') + '. Link copiado.');
          } else {
            toast.success('Link enviado via WhatsApp!');
          }
        } else {
          toast.info('Nenhuma instancia WhatsApp (uazapi) conectada. Link copiado.');
        }
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(paymentUrl);
      toast.success('Link copiado para a area de transferencia!', {
        description: paymentUrl.substring(0, 60) + '...',
      });

      loadPayments();
    } catch (e: any) {
      console.error('Send payment link failed:', e);
      toast.error('Erro ao enviar link de pagamento');
    }
    setSendingLinkPaymentId(null);
  };

  const updateBillingConfig = async (id: string, updates: any) => {
    await (supabase as any).from('billing_config').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    toast.success('Configuracao atualizada');
    loadBillingConfigs();
  };

  // Recorte por periodo (dia/semana/mes/ano). Data de referencia: paid_at se pago,
  // senao o vencimento. 'all' = tudo. Os KPIs e a tabela respeitam esse recorte.
  const periodPayments = useMemo(() => {
    if (paymentPeriodFilter === 'all') return payments;
    const now = new Date();
    const refDate = (p: any): Date | null =>
      p.paid_at ? new Date(p.paid_at) : (p.due_date ? new Date(p.due_date + 'T12:00:00') : null);
    const inPeriod = (d: Date | null): boolean => {
      if (!d) return false;
      if (paymentPeriodFilter === 'day') return d.toDateString() === now.toDateString();
      if (paymentPeriodFilter === 'week') return d.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000 && d.getTime() <= now.getTime();
      if (paymentPeriodFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (paymentPeriodFilter === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    };
    return payments.filter((p: any) => inPeriod(refDate(p)));
  }, [payments, paymentPeriodFilter]);

  // Billing stats (respeitam o periodo selecionado)
  const billingStats = useMemo(() => {
    // Total a Receber = soma do que falta em todas as parcelas (valor - paid_value)
    const totalReceivable = periodPayments
      .filter((p: any) => p.status !== 'cancelled')
      .reduce((s: number, p: any) => {
        const v = parseFloat(p.value) || 0;
        const paid = parseFloat(p.paid_value) || 0;
        const due = p.status === 'paid' ? Math.max(0, v - paid) : v;
        return s + due;
      }, 0);
    // Recebido = soma dos paid_value (inclusive de baixas parciais)
    const totalReceived = periodPayments
      .filter((p: any) => parseFloat(p.paid_value) > 0)
      .reduce((s: number, p: any) => s + (parseFloat(p.paid_value) || 0), 0);
    // Em Atraso = soma dos pendentes vencidos (ou marcados overdue)
    const totalOverdue = periodPayments
      .filter((p: any) => p.status === 'overdue')
      .reduce((s: number, p: any) => s + (parseFloat(p.value) || 0), 0);
    // Proximos 7 dias = pendentes com vencimento na semana
    const upcoming = periodPayments.filter((p: any) => {
      if (p.status !== 'pending') return false;
      const diff = Math.round((new Date(p.due_date + 'T12:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length;
    return { totalReceivable, totalReceived, totalOverdue, upcoming };
  }, [periodPayments]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    let list = periodPayments;
    if (paymentStatusFilter !== 'all') {
      list = list.filter((p: any) => p.status === paymentStatusFilter);
    }
    if (paymentMemberFilter.trim()) {
      const q = paymentMemberFilter.toLowerCase();
      list = list.filter((p: any) => p.members?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [periodPayments, paymentStatusFilter, paymentMemberFilter]);

  // ─── Member actions ─────────────────────────────────────────────────────

  const deleteMember = async (m: any) => {
    if (!confirm(
      `Excluir DEFINITIVAMENTE o membro "${m.name}"?\n\n` +
      `Remove o acesso a area de membros, o progresso, e tambem contratos/pagamentos ligados a ele. ` +
      `Acao irreversivel (pra so tirar o acesso, use Bloquear).`
    )) return;
    try {
      const { data, error } = await (supabase as any).rpc('admin_delete_member', { p_member: m.id });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      toast.success(`Membro "${m.name}" excluido`);
      loadMembers();
    } catch (e: any) {
      toast.error('Erro ao excluir: ' + (e.message || e));
    }
  };

  const updateMemberStatus = async (memberId: string, status: string) => {
    const member = members.find((m: any) => m.id === memberId);
    if (!member) { toast.error('Membro nao encontrado na lista local'); return; }
    if (member.status === status) { toast.info('Membro ja esta ' + STATUS_LABELS[status]); return; }

    const wasInactive = member.status !== 'active';

    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'active') {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = 'admin';
    }

    try {
      const { error: updateErr } = await (supabase as any).from('members').update(updates).eq('id', memberId);
      if (updateErr) throw updateErr;

      // Confirm via re-read
      const { data: reread } = await (supabase as any).from('members').select('id, status').eq('id', memberId).single();
      console.log('[updateMemberStatus]', { memberId, from: member.status, to: status, reread });
      if (!reread || reread.status !== status) {
        throw new Error(`Status no banco nao refletiu a mudanca (esperado=${status}, atual=${reread?.status || 'null'})`);
      }
    } catch (e: any) {
      console.error('[updateMemberStatus] error', e);
      toast.error('Falha ao atualizar status: ' + (e.message || 'erro desconhecido'));
      loadMembers();
      return;
    }

    // Tag CRM + send credentials only after confirmed
    if (status === 'active') {
      if (member.crm_lead_id) {
        try {
          const { data: lead } = await supabase.from('crm_leads').select('tags').eq('id', member.crm_lead_id).single();
          const currentTags = lead?.tags || [];
          if (!currentTags.includes('CS/Suport')) {
            await supabase.from('crm_leads').update({ tags: [...currentTags, 'CS/Suport'] }).eq('id', member.crm_lead_id);
          }
        } catch (e) { console.warn('Falha ao taguear lead', e); }
      }

      if (wasInactive && !member.credentials_sent_at) {
        try {
          const { data: sendRes, error: sendErr } = await supabase.functions.invoke('send-member-credentials', {
            body: { member_id: memberId },
          });
          if (sendErr || !(sendRes as any)?.ok) {
            toast.success(`Ativado (envio WhatsApp falhou — ${(sendRes as any)?.error || sendErr?.message || 'erro'})`);
          } else if ((sendRes as any)?.skipped) {
            toast.success('Ativado (credenciais ja enviadas recentemente)');
          } else {
            toast.success('Ativado + credenciais enviadas no WhatsApp');
          }
        } catch (e: any) {
          toast.success(`Ativado (falha WhatsApp: ${e.message})`);
        }
      } else {
        toast.success(`Status atualizado para ${STATUS_LABELS[status]}`);
      }
    } else {
      toast.success(`Status atualizado para ${STATUS_LABELS[status]}`);
    }
    loadMembers();
  };

  const resendMemberCredentials = async (memberId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-member-credentials', {
        body: { member_id: memberId, force: true },
      });
      console.log('[resend-credentials]', { memberId, data, error });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'sem detalhe');
      toast.success('Credenciais enviadas no WhatsApp');
      loadMembers();
    } catch (e: any) {
      console.error('[resend-credentials] error', e);
      toast.error('Erro: ' + (e.message || JSON.stringify(e)));
    }
  };

  // ─── Module CRUD ────────────────────────────────────────────────────────

  const openModuleDialog = (mod?: Module) => {
    if (mod) {
      setEditingModule(mod);
      setModuleForm({
        title: mod.title,
        description: mod.description || '',
        thumbnail_url: mod.thumbnail_url || '',
        category: mod.category,
        sort_order: mod.sort_order,
        is_published: mod.is_published,
        is_locked: mod.is_locked,
        required_level: mod.required_level || '',
        allowed_programs: Array.isArray(mod.allowed_programs) ? mod.allowed_programs : [],
      });
    } else {
      setEditingModule(null);
      setModuleForm({ title: '', description: '', thumbnail_url: '', category: 'trilha', sort_order: 0, is_published: true, is_locked: false, required_level: '', allowed_programs: [] });
    }
    setShowModuleDialog(true);
  };

  const saveModule = async () => {
    if (!moduleForm.title.trim()) {
      toast.error('Titulo obrigatorio');
      return;
    }
    const payload = {
      ...moduleForm,
      required_level: null, // nivel nao bloqueia mais
      allowed_programs: moduleForm.allowed_programs && moduleForm.allowed_programs.length > 0
        ? moduleForm.allowed_programs
        : null, // null = todos os programas
    };
    if (editingModule) {
      await (supabase as any).from('member_modules').update(payload).eq('id', editingModule.id);
      toast.success('Modulo atualizado');
    } else {
      await (supabase as any).from('member_modules').insert(payload);
      toast.success('Modulo criado');
    }
    setShowModuleDialog(false);
    loadModules();
  };

  const deleteModule = async (id: string) => {
    if (!confirm('Excluir este modulo e todas as aulas?')) return;
    await (supabase as any).from('member_modules').delete().eq('id', id);
    toast.success('Modulo excluido');
    loadModules();
    loadLessons();
  };

  // ─── Lesson CRUD ────────────────────────────────────────────────────────

  const openLessonDialog = (moduleId: string, lesson?: Lesson) => {
    setSelectedModuleId(moduleId);
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        title: lesson.title,
        description: lesson.description || '',
        type: lesson.type,
        content_url: lesson.content_url || '',
        duration_minutes: lesson.duration_minutes,
        sort_order: lesson.sort_order,
        is_published: lesson.is_published,
        support_description: (lesson as any).support_description || '',
        support_materials: Array.isArray((lesson as any).support_materials) ? (lesson as any).support_materials : [],
        clip_start_seconds: (lesson as any).clip_start_seconds ?? '',
        clip_end_seconds: (lesson as any).clip_end_seconds ?? '',
      });
    } else {
      setEditingLesson(null);
      setLessonForm({ title: '', description: '', type: 'video', content_url: '', duration_minutes: 0, sort_order: 0, is_published: true, support_description: '', support_materials: [], clip_start_seconds: '', clip_end_seconds: '' });
    }
    setShowLessonDialog(true);
  };

  const splitLessonAtCurrent = async () => {
    if (!editingLesson || !lessonForm.content_url) {
      toast.error('Aula precisa ter video e estar salva');
      return;
    }
    const splitAtStr = window.prompt(
      `Dividir aula em duas. Em que segundo o trecho NOVO comeca? (ex: 300 = 5min)\n\nA aula atual vai cortar em clip_end = X. A nova aula sera de X em diante, com mesmo video.`,
      String(parseFloat(String(lessonForm.clip_end_seconds || '')) || 0),
    );
    if (!splitAtStr) return;
    const splitAt = parseFloat(splitAtStr);
    if (isNaN(splitAt) || splitAt <= 0) { toast.error('Valor invalido'); return; }

    const newTitle = window.prompt('Titulo da nova aula:', `${lessonForm.title} - Parte 2`);
    if (!newTitle) return;

    try {
      // 1. Atualiza aula atual com clip_end = splitAt
      await (supabase as any).from('member_lessons').update({
        clip_end_seconds: splitAt,
      }).eq('id', editingLesson.id);

      // 2. Cria nova aula com mesmo video, clip_start = splitAt, clip_end = atual
      const { data: maxRow } = await (supabase as any)
        .from('member_lessons')
        .select('sort_order')
        .eq('module_id', editingLesson.module_id || selectedModuleId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      await (supabase as any).from('member_lessons').insert({
        module_id: editingLesson.module_id || selectedModuleId,
        title: newTitle,
        description: lessonForm.description,
        type: 'video',
        content_url: lessonForm.content_url,
        duration_minutes: lessonForm.duration_minutes,
        sort_order: (maxRow?.sort_order || 0) + 1,
        is_published: lessonForm.is_published,
        clip_start_seconds: splitAt,
        clip_end_seconds: lessonForm.clip_end_seconds || null,
      });

      toast.success(`Aula dividida! Nova aula "${newTitle}" criada.`);
      setShowLessonDialog(false);
      loadLessons();
    } catch (e: any) {
      toast.error('Erro ao dividir: ' + e.message);
    }
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) {
      toast.error('Titulo obrigatorio');
      return;
    }
    const payload: any = {
      ...lessonForm,
      module_id: selectedModuleId,
      clip_start_seconds: lessonForm.clip_start_seconds === '' || lessonForm.clip_start_seconds === null
        ? null : parseFloat(String(lessonForm.clip_start_seconds)),
      clip_end_seconds: lessonForm.clip_end_seconds === '' || lessonForm.clip_end_seconds === null
        ? null : parseFloat(String(lessonForm.clip_end_seconds)),
    };
    delete payload.clip_start_seconds_str;
    if (editingLesson) {
      await (supabase as any).from('member_lessons').update(payload).eq('id', editingLesson.id);
      toast.success('Aula atualizada');
    } else {
      await (supabase as any).from('member_lessons').insert(payload);
      toast.success('Aula criada');
    }
    setShowLessonDialog(false);
    loadLessons();
  };

  const deleteLesson = async (id: string) => {
    if (!confirm('Excluir esta aula?')) return;
    await (supabase as any).from('member_lessons').delete().eq('id', id);
    toast.success('Aula excluida');
    loadLessons();
  };

  // ─── Gravar aula via sala de reuniao ───────────────────────────────────

  const startLessonRecording = async () => {
    if (!recordModuleId || !recordForm.title.trim()) return;
    setCreatingRecording(true);
    try {
      const roomName = `aula-${recordModuleId.slice(0, 8)}-${Date.now()}`;
      const hostName = recordForm.host_name.trim() || '+ que Vencedores';

      const { data, error } = await (supabase as any).from('meetings').insert({
        title: recordForm.title.trim(),
        livekit_room_name: roomName,
        status: 'scheduled',
        kind: 'lesson',
        lesson_mode: true,
        target_module_id: recordModuleId,
        target_lesson_title: recordForm.title.trim(),
        host_name: hostName,
        scheduled_at: new Date().toISOString(),
      }).select('id').single();

      if (error) throw error;

      setShowRecordDialog(false);
      setCreatingRecording(false);

      const url = `/meet/${roomName}?mode=lesson&role=host&name=${encodeURIComponent(hostName)}`;
      window.open(url, '_blank');
      toast.success('Sala criada. Abrindo em nova aba...');
    } catch (e: any) {
      setCreatingRecording(false);
      toast.error('Erro ao criar sala: ' + e.message);
    }
  };

  // ─── Files CRUD ─────────────────────────────────────────────────────────

  const saveFile = async () => {
    if (!fileForm.title.trim() || !fileForm.file_url.trim()) {
      toast.error('Titulo e URL obrigatorios');
      return;
    }
    await (supabase as any).from('member_files').insert({ ...fileForm, uploaded_by: 'admin' });
    toast.success('Arquivo adicionado');
    setShowFileDialog(false);
    setFileForm({ title: '', description: '', file_url: '', file_type: 'pdf', category: 'geral' });
    loadFiles();
  };

  const deleteFile = async (id: string) => {
    if (!confirm('Excluir este arquivo?')) return;
    await (supabase as any).from('member_files').delete().eq('id', id);
    toast.success('Arquivo excluido');
    loadFiles();
  };

  // ─── Format helpers ─────────────────────────────────────────────────────

  const formatMinutes = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Area de Membros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciamento de alunos, conteudo e analytics</p>
        </div>
        {/* Presenca em tempo real: quem esta online agora na area de membros */}
        <MembersOnlineWidget />
      </div>

      {/* Pedidos de acesso a reuniao (gate por programa) — so aparece se houver pendentes */}
      <MeetingAccessRequests />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Membros</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tempo Medio</p>
              <p className="text-xl font-bold">{formatMinutes(stats.avgTime)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="alunos">Alunos</TabsTrigger>
          <TabsTrigger value="mapa">Mapa</TabsTrigger>
          <TabsTrigger value="conteudo">Conteudo</TabsTrigger>
          <TabsTrigger value="aovivo">Ao Vivo</TabsTrigger>
          <TabsTrigger value="aifirst">AI FIRST</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Alunos ─────────────────────────────────────────── */}
        <TabsContent value="alunos" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
                <SelectItem value="expired">Expirados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Telefone</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">XP</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Level</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Tempo</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Ultimo Acesso</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Engajamento</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center p-8 text-muted-foreground">
                          Nenhum membro encontrado
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => (
                        <tr key={m.id} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="p-3 font-medium">
                            <button onClick={() => setEditingMember(m)} className="text-left hover:text-primary hover:underline transition-colors">
                              {m.name}
                            </button>
                          </td>
                          <td className="p-3 text-muted-foreground">{m.email}</td>
                          <td className="p-3 text-muted-foreground">{m.phone}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={STATUS_COLORS[m.status] || ''}>
                              {STATUS_LABELS[m.status] || m.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <span className="flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-yellow-400" />
                              {m.xp || 0}
                            </span>
                          </td>
                          <td className="p-3">{LEVEL_LABELS[m.level] || m.level}</td>
                          <td className="p-3">{formatMinutes(m.total_time_minutes || 0)}</td>
                          <td className="p-3">{formatDate(m.last_active_at)}</td>
                          <td className="p-3">
                            {(() => {
                              const eng = engagementMap[m.id];
                              if (!eng) {
                                return <span className="text-xs text-muted-foreground">-</span>;
                              }
                              const styleMap: Record<string, { bg: string; fg: string; emoji: string; label: string }> = {
                                ativo:     { bg: 'bg-emerald-500/20', fg: 'text-emerald-400', emoji: '🟢', label: 'Ativo' },
                                esfriando: { bg: 'bg-amber-500/20',   fg: 'text-amber-400',   emoji: '🟡', label: 'Esfriando' },
                                em_risco:  { bg: 'bg-red-500/20',     fg: 'text-red-400',     emoji: '🔴', label: 'Em risco' },
                                inativo:   { bg: 'bg-zinc-500/20',    fg: 'text-zinc-400',    emoji: '⚫', label: 'Inativo' },
                              };
                              const s = styleMap[eng.classification] || styleMap.inativo;
                              return (
                                <button
                                  onClick={() => setEngagementMemberId(m.id)}
                                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/5 hover:border-white/30 transition-colors ${s.bg} ${s.fg} text-xs font-medium`}
                                  title={`${eng.score}/100 - ${s.label} - ${eng.days}d sem acesso. Click pra timeline.`}
                                >
                                  <span>{s.emoji}</span>
                                  <span>{eng.score}</span>
                                </button>
                              );
                            })()}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {m.status === 'pending' && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-green-400 hover:text-green-300 h-7 px-2"
                                  title="Aprovar + enviar credenciais"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('[approve click]', m.id, m.name);
                                    updateMemberStatus(m.id, 'active');
                                  }}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              )}
                              {m.status === 'active' && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-red-400 hover:text-red-300 h-7 px-2"
                                  title="Bloquear"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('[block click]', m.id, m.name);
                                    updateMemberStatus(m.id, 'blocked');
                                  }}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {m.status === 'blocked' && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-green-400 hover:text-green-300 h-7 px-2"
                                  title="Reativar"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('[reactivate click]', m.id, m.name);
                                    updateMemberStatus(m.id, 'active');
                                  }}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              )}
                              {m.status === 'active' && m.phone && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-[#25D366] hover:text-[#25D366]/80 h-7 px-2"
                                  onClick={() => resendMemberCredentials(m.id)}
                                  title={(m as any).credentials_sent_at ? `Reenviar (ultimo: ${new Date((m as any).credentials_sent_at).toLocaleDateString('pt-BR')})` : 'Enviar credenciais'}
                                >
                                  <Send className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm" variant="ghost"
                                className="text-blue-400 hover:text-blue-300 h-7 px-2"
                                onClick={() => setEditingMember(m)}
                                title="Editar membro"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className="text-red-500 hover:text-red-400 h-7 px-2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteMember(m);
                                }}
                                title="Excluir membro (definitivo)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab: Mapa de alunos ───────────────────────────────────── */}
        <TabsContent value="mapa" className="space-y-4">
          <MemberJourneyMap />
        </TabsContent>

        {/* ─── Tab 2: Conteudo ───────────────────────────────────────── */}
        <TabsContent value="conteudo" className="space-y-4">
          {/* Gravacoes pendentes (sem aula publicada) */}
          {orphanRecordings.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <CardTitle className="text-base text-amber-300">
                    Gravacoes pendentes ({orphanRecordings.length})
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Aulas gravadas que nao foram publicadas. Clique em "Recuperar" para gerar PDF e publicar.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {orphanRecordings.map((m: any) => {
                    const mod = modules.find((mm) => mm.id === m.target_module_id);
                    const hasUrl = !!m.recording_url;
                    const hasTrans = (m.transcription || '').length >= 80;
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-black/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.target_lesson_title || m.title || 'Aula sem titulo'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {mod?.title || 'Modulo desconhecido'} | {new Date(m.created_at).toLocaleString('pt-BR')}
                          </p>
                          <div className="flex gap-2 mt-1 text-[10px]">
                            <span className={hasUrl ? 'text-green-400' : 'text-amber-400'}>
                              {hasUrl ? 'Video OK' : 'Sem video (recuperar do LK)'}
                            </span>
                            <span className={hasTrans ? 'text-green-400' : 'text-amber-400'}>
                              {hasTrans ? 'Transcricao OK' : 'Sem transcricao (Soniox)'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => recoverRecording(m)}
                            disabled={recoveringMeetingId === m.id || !m.target_module_id}
                            className="bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                          >
                            {recoveringMeetingId === m.id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                            Recuperar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissOrphanRecording(m)}
                            disabled={recoveringMeetingId === m.id}
                            className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                            title="Remover da lista (preserva o meeting no historico)"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Limpar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Modulos</h2>
            <Button size="sm" onClick={() => openModuleDialog()}>
              <Plus className="w-4 h-4 mr-1" /> Novo Modulo
            </Button>
          </div>

          {modules.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum modulo criado ainda
              </CardContent>
            </Card>
          ) : (
            modules.map((mod) => {
              const modLessons = lessons.filter((l) => l.module_id === mod.id);
              return (
                <Card key={mod.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{mod.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {mod.category} | {modLessons.length} aulas | Ordem: {mod.sort_order}
                            {!mod.is_published && ' | Rascunho'}
                            {mod.is_locked && ' | Bloqueado'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setRecordModuleId(mod.id); setRecordForm({ title: '', host_name: '+ que Vencedores' }); setShowRecordDialog(true); }}
                          className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Gravar aula ao vivo"
                        >
                          <Video className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setRecordModuleId(mod.id); setShowUploadDialog(true); }}
                          className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          title="Upload de video"
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openLessonDialog(mod.id)} className="h-8 px-2" title="Adicionar aula manualmente">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openModuleDialog(mod)} className="h-8 px-2">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 h-8 px-2" onClick={() => deleteModule(mod.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {modLessons.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="border-t border-border/30 pt-2 space-y-1">
                        {modLessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/30">
                            <div className="flex items-center gap-2">
                              {lesson.type === 'video' && <Video className="w-4 h-4 text-blue-400" />}
                              {lesson.type === 'quiz' && <FileText className="w-4 h-4 text-green-400" />}
                              {lesson.type === 'document' && <FileText className="w-4 h-4 text-orange-400" />}
                              {lesson.type === 'text' && <FileText className="w-4 h-4 text-gray-400" />}
                              {lesson.type === 'audio' && <FileText className="w-4 h-4 text-purple-400" />}
                              <span className="text-sm">{lesson.title}</span>
                              <span className="text-xs text-muted-foreground">({lesson.duration_minutes}min)</span>
                            </div>
                            <div className="flex gap-1 items-center">
                              {(lesson as any).pdf_url && (
                                <a href={(lesson as any).pdf_url} target="_blank" rel="noopener" className="text-[10px] text-green-400 underline">PDF</a>
                              )}
                              {lesson.type === 'video' && lesson.content_url ? (
                                (() => {
                                  const isGenerating =
                                    pdfGenerating.has(lesson.id) || lesson.pdf_status === 'generating';
                                  const hasError = lesson.pdf_status === 'error';
                                  return (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={isGenerating}
                                      className={`h-7 px-2 text-[10px] ${
                                        hasError
                                          ? 'text-red-400 hover:bg-red-500/10'
                                          : 'text-amber-400 hover:bg-amber-500/10'
                                      } disabled:opacity-100`}
                                      title={
                                        isGenerating
                                          ? 'Gerando PDF... (5s a 4min, pode fechar a aba que nao perde)'
                                          : hasError
                                            ? `Erro: ${lesson.pdf_error || 'desconhecido'} - clique pra tentar de novo`
                                            : lesson.pdf_url
                                              ? 'Re-transcreve via Soniox (com glossario atualizado) e regenera o PDF'
                                              : 'Transcreve audio via Soniox e gera PDF resumo via IA'
                                      }
                                      onClick={async () => {
                                        if (isGenerating) return;
                                        const action = lesson.pdf_url ? 'Regenerar' : 'Gerar';
                                        if (
                                          !confirm(
                                            `${action} PDF da aula "${lesson.title}"?\nLeva ~30s a 4min dependendo do tamanho do video.`,
                                          )
                                        )
                                          return;

                                        // Marca generating no banco + Set local (UI persiste no reload)
                                        setPdfGenerating((s) => new Set(s).add(lesson.id));
                                        await (supabase as any)
                                          .from('member_lessons')
                                          .update({
                                            pdf_status: 'generating',
                                            pdf_error: null,
                                            pdf_started_at: new Date().toISOString(),
                                          })
                                          .eq('id', lesson.id);

                                        // 1. Pega ou cria meeting wrapper
                                        let meetingId = lesson.meeting_id;
                                        if (!meetingId) {
                                          const { data: newMeeting } = await (supabase as any)
                                            .from('meetings')
                                            .insert({
                                              title: lesson.title,
                                              status: 'completed',
                                              kind: 'lesson',
                                              lesson_mode: true,
                                              target_module_id: lesson.module_id,
                                              target_lesson_title: lesson.title,
                                              target_lesson_id: lesson.id,
                                              recording_url: lesson.content_url,
                                              recording_status: 'completed',
                                              ended_at: new Date().toISOString(),
                                            })
                                            .select('id')
                                            .single();
                                          meetingId = newMeeting?.id;
                                          if (meetingId) {
                                            await (supabase as any)
                                              .from('member_lessons')
                                              .update({ meeting_id: meetingId })
                                              .eq('id', lesson.id);
                                          }
                                        }

                                        const toastId = toast.loading(
                                          `Gerando PDF "${lesson.title}"... (pode fechar a aba)`,
                                        );

                                        const finishError = async (msg: string) => {
                                          await (supabase as any)
                                            .from('member_lessons')
                                            .update({ pdf_status: 'error', pdf_error: msg.slice(0, 500) })
                                            .eq('id', lesson.id);
                                          toast.error(`Falhou em "${lesson.title}": ${msg}`, {
                                            id: toastId,
                                            duration: Infinity,
                                          });
                                          setPdfGenerating((s) => {
                                            const ns = new Set(s);
                                            ns.delete(lesson.id);
                                            return ns;
                                          });
                                          loadLessons();
                                        };

                                        if (!meetingId) {
                                          await finishError('Falha ao criar meeting wrapper');
                                          return;
                                        }

                                        try {
                                          // 2. Transcreve via Soniox com progresso
                                          const transcription = await transcribeWithSoniox(
                                            lesson.content_url!,
                                            (p) => {
                                              toast.loading(`${lesson.title}: ${p.message}`, {
                                                id: toastId,
                                              });
                                            },
                                          );

                                          toast.loading(`${lesson.title}: gerando PDF via IA...`, {
                                            id: toastId,
                                          });

                                          // 3. Salva transcricao
                                          await (supabase as any)
                                            .from('meetings')
                                            .update({ transcription })
                                            .eq('id', meetingId);

                                          // 4. Pipeline de PDF + republicacao
                                          const { data, error } = await supabase.functions.invoke(
                                            'process-lesson-recording',
                                            { body: { meeting_id: meetingId, force: true } },
                                          );
                                          if (error || data?.error) {
                                            throw new Error(
                                              data?.error || error?.message || 'Pipeline falhou',
                                            );
                                          }

                                          // Sucesso — limpa estado de erro
                                          await (supabase as any)
                                            .from('member_lessons')
                                            .update({ pdf_status: 'idle', pdf_error: null })
                                            .eq('id', lesson.id);

                                          toast.success(
                                            data?.pdf_url
                                              ? `PDF pronto: "${lesson.title}" (${transcription.length} chars)`
                                              : `Transcricao salva, mas PDF nao gerou — veja logs`,
                                            { id: toastId, duration: 8000 },
                                          );
                                          setPdfGenerating((s) => {
                                            const ns = new Set(s);
                                            ns.delete(lesson.id);
                                            return ns;
                                          });
                                          loadLessons();
                                        } catch (e: any) {
                                          await finishError(e.message || String(e));
                                        }
                                      }}
                                    >
                                      {isGenerating ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Gerando...
                                        </>
                                      ) : hasError ? (
                                        <>
                                          <AlertCircle className="w-3 h-3 mr-1" /> Tentar de novo
                                        </>
                                      ) : lesson.pdf_url ? (
                                        <>
                                          <RefreshCw className="w-3 h-3 mr-1" /> Regenerar PDF
                                        </>
                                      ) : (
                                        'Gerar PDF'
                                      )}
                                    </Button>
                                  );
                                })()
                              ) : null}
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openLessonDialog(mod.id, lesson)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-400 h-7 px-2" onClick={() => deleteLesson(lesson.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── Tab 3: Reunioes ao vivo ───────────────────────────────── */}
        <TabsContent value="aovivo" className="space-y-4">
          <LiveSessionsSection modules={modules} onChanged={loadAll} />
        </TabsContent>

        {/* ─── Tab 4: AI FIRST ───────────────────────────────────────── */}
        <TabsContent value="aifirst" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Aceleradores AI FIRST</h2>
              <p className="text-xs text-muted-foreground">
                Templates, ferramentas e guias que o aluno baixa e usa no desenvolvimento.
              </p>
            </div>
            <Button size="sm" onClick={() => { setEditingFile(null); setShowFileDialog(true); }}>
              <Upload className="w-4 h-4 mr-1" /> Novo Acelerador
            </Button>
          </div>

          {files.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum acelerador cadastrado ainda
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {files.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center overflow-hidden">
                        {file.thumbnail ? (
                          <img src={file.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          {file.title}
                          {file.is_published === false && (
                            <Badge variant="outline" className="text-[10px]">rascunho</Badge>
                          )}
                          {file.is_featured && (
                            <Badge className="text-[10px] bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/30">destaque</Badge>
                          )}
                          {file.publish_at && new Date(file.publish_at) > new Date() && (
                            <Badge className="text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/30">
                              agendado {new Date(file.publish_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.file_type?.toUpperCase()} | {file.category} | {file.download_count} downloads
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setEditingFile(file); setShowFileDialog(true); }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" asChild>
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 h-8 px-2" onClick={() => deleteFile(file.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab 4: Financeiro ─────────────────────────────────────── */}
        <TabsContent value="financeiro" className="space-y-4">
          {/* Billing Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total a Receber</p>
                  <p className="text-xl font-bold">R$ {billingStats.totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="text-xl font-bold text-green-400">R$ {billingStats.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Em Atraso</p>
                  <p className="text-xl font-bold text-red-400">R$ {billingStats.totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Proximos 7 dias</p>
                  <p className="text-xl font-bold">{billingStats.upcoming} parcelas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por membro..."
                value={paymentMemberFilter}
                onChange={(e) => setPaymentMemberFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={paymentPeriodFilter} onValueChange={(v) => setPaymentPeriodFilter(v as typeof paymentPeriodFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o periodo</SelectItem>
                <SelectItem value="day">Hoje</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="overdue">Em Atraso</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payments Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-muted-foreground font-medium">Membro</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Parcela</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Valor</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Vencimento</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Pago em</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                          Nenhum pagamento encontrado
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((p: any) => {
                        const statusColor: Record<string, string> = {
                          pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                          paid: 'bg-green-500/20 text-green-400 border-green-500/30',
                          overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
                          cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                        };
                        const statusLabel: Record<string, string> = {
                          pending: 'Pendente',
                          paid: 'Pago',
                          overdue: 'Em Atraso',
                          cancelled: 'Cancelado',
                        };
                        const isSaldoDevedor = ((p.notes || '').toUpperCase().includes('SALDO DEVEDOR') || (p.notes || '').toLowerCase().includes('saldo restante'));
                        const paidValue = parseFloat(p.paid_value || 0);
                        const fullValue = parseFloat(p.value);
                        const isPartialPaid = p.status === 'paid' && paidValue > 0 && paidValue < fullValue;
                        const remaining = Math.round((fullValue - paidValue) * 100) / 100;
                        return (
                          <tr key={p.id} className={`border-b border-border/30 hover:bg-muted/30 ${isSaldoDevedor ? 'bg-red-500/5' : ''}`}>
                            <td className="p-3 font-medium">
                              <button
                                onClick={() => setFinancialDrawerMemberId(p.member_id)}
                                className="text-left hover:text-primary underline-offset-2 hover:underline"
                                title="Abrir gestao financeira completa"
                              >
                                {p.members?.name || '-'}
                              </button>
                            </td>
                            <td className="p-3 text-muted-foreground">#{p.installment_number}</td>
                            <td className="p-3">
                              {isSaldoDevedor ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-red-400">-R$ {parseFloat(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  <span className="text-[10px] text-red-400/70 uppercase font-semibold">Saldo devedor</span>
                                </div>
                              ) : isPartialPaid ? (
                                <div className="flex flex-col">
                                  <span className="font-medium">R$ {fullValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  <span className="text-[10px] text-amber-400/90">
                                    Pago R$ {paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Falta R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-medium">R$ {parseFloat(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className={statusColor[p.status] || ''}>
                                  {statusLabel[p.status] || p.status}
                                </Badge>
                                {isPartialPaid && (
                                  <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                    PARCIAL
                                  </Badge>
                                )}
                                {isSaldoDevedor && (
                                  <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                                    SALDO DEVEDOR
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1 flex-wrap">
                                {(p.status === 'pending' || p.status === 'overdue') && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white text-xs"
                                      onClick={() => confirmPayment(p.id)}
                                      disabled={confirmingPaymentId === p.id}
                                    >
                                      {confirmingPaymentId === p.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          Confirmar
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-3 text-xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                                      onClick={() => sendPaymentLink(p)}
                                      disabled={sendingLinkPaymentId === p.id}
                                    >
                                      {sendingLinkPaymentId === p.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Send className="w-3 h-3 mr-1" />
                                          {p.gateway_invoice_url ? 'Reenviar Link' : 'Enviar Link'}
                                        </>
                                      )}
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-3 text-xs border-primary/50 text-primary hover:bg-primary/10"
                                  onClick={() => setFinancialDrawerMemberId(p.member_id)}
                                  title="Abrir drawer com gestao financeira completa"
                                >
                                  <Settings className="w-3 h-3 mr-1" />
                                  Gerenciar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deletePayment(p.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Gateway Config */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-primary" />
              Gateways de Pagamento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {billingConfigs.map((cfg: any) => {
                const gatewayLabels: Record<string, string> = { manual: 'Manual (PIX)', stripe: 'Stripe', asaas: 'Asaas' };
                const gatewayIcons: Record<string, string> = { manual: 'bg-primary/20', stripe: 'bg-purple-500/20', asaas: 'bg-blue-500/20' };
                return (
                  <Card key={cfg.id} className={cfg.is_active ? 'border-primary/50' : ''}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${gatewayIcons[cfg.gateway] || 'bg-gray-500/20'} flex items-center justify-center`}>
                            <CreditCard className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-semibold text-sm">{gatewayLabels[cfg.gateway] || cfg.gateway}</span>
                        </div>
                        <button
                          onClick={() => updateBillingConfig(cfg.id, { is_active: !cfg.is_active })}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {cfg.is_active ? (
                            <ToggleRight className="w-6 h-6 text-green-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </button>
                      </div>

                      {cfg.gateway === 'manual' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Chave PIX</Label>
                          <Input
                            placeholder="CPF, CNPJ, email, telefone ou chave aleatoria"
                            defaultValue={cfg.pix_key || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (cfg.pix_key || '')) {
                                updateBillingConfig(cfg.id, { pix_key: e.target.value });
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <Label className="text-xs">Nome do Titular</Label>
                          <Input
                            placeholder="Razao social / nome do titular"
                            defaultValue={cfg.pix_name || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (cfg.pix_name || '')) {
                                updateBillingConfig(cfg.id, { pix_name: e.target.value });
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground italic">Sera enviado automaticamente nos lembretes de cobranca PIX.</p>
                        </div>
                      )}

                      {cfg.gateway !== 'manual' && (
                        <div className="space-y-2">
                          {cfg.gateway === 'asaas' && (
                            <>
                              <Label className="text-xs">Ambiente</Label>
                              <select
                                defaultValue={cfg.config?.environment || 'sandbox'}
                                onChange={(e) => {
                                  const newCfg = { ...(cfg.config || {}), environment: e.target.value };
                                  updateBillingConfig(cfg.id, { config: newCfg });
                                }}
                                className="w-full h-8 text-sm rounded-md border bg-background px-2"
                              >
                                <option value="sandbox">Sandbox</option>
                                <option value="production">Producao</option>
                              </select>
                            </>
                          )}
                          <Label className="text-xs">API Key</Label>
                          <Input
                            type="password"
                            placeholder={`${gatewayLabels[cfg.gateway]} API Key`}
                            defaultValue={cfg.api_key || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (cfg.api_key || '')) {
                                updateBillingConfig(cfg.id, { api_key: e.target.value });
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <Label className="text-xs">
                            {cfg.gateway === 'asaas' ? 'Webhook Access Token' : 'Webhook Secret'}
                          </Label>
                          <Input
                            type="password"
                            placeholder={cfg.gateway === 'asaas' ? 'Token configurado no painel Asaas' : 'Webhook Secret'}
                            defaultValue={cfg.webhook_secret || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (cfg.webhook_secret || '')) {
                                updateBillingConfig(cfg.id, { webhook_secret: e.target.value });
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          {cfg.gateway === 'asaas' && (
                            <p className="text-[10px] text-muted-foreground">
                              Webhook URL: <code className="text-[10px]">{`${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/asaas-webhook`}</code>
                            </p>
                          )}
                        </div>
                      )}

                      <Badge
                        variant="outline"
                        className={cfg.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                      >
                        {cfg.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ─── Tab 5: Analytics ──────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Time per member */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tempo por Membro (min)</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.timePerMember.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analyticsData.timePerMember}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#141414', border: '1px solid #333', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                      <Bar dataKey="minutes" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
                )}
              </CardContent>
            </Card>

            {/* Progress per module */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conclusoes por Modulo</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.progressPerModule.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={analyticsData.progressPerModule}
                        cx="50%"
                        cy="45%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ value }) => value}
                        labelLine={false}
                      >
                        {analyticsData.progressPerModule.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0a0a0a" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#141414', border: '1px solid #333', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
                )}
              </CardContent>
            </Card>

            {/* Active members per day */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Membros Ativos por Dia (ultimos 7 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.activeMembersPerDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={analyticsData.activeMembersPerDay}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#141414', border: '1px solid #333', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                      <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ──────────────────────────────────────────────────── */}

      {/* Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Editar Modulo' : 'Novo Modulo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>URL Thumbnail</Label>
              <Input value={moduleForm.thumbnail_url} onChange={(e) => setModuleForm({ ...moduleForm, thumbnail_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={moduleForm.category} onValueChange={(v) => setModuleForm({ ...moduleForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trilha">Trilha</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="ai-first">AI First</SelectItem>
                    <SelectItem value="masterclass">Masterclass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={moduleForm.sort_order} onChange={(e) => setModuleForm({ ...moduleForm, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Programas com acesso</Label>
              <div className="flex flex-col gap-2 bg-muted/30 rounded-lg p-3 border border-border/40">
                <p className="text-[11px] text-muted-foreground">Se nada selecionado → liberado pra todos os programas.</p>
                {[
                  { value: 'metodo-vencedores', label: 'Metodo + que Vencedores' },
                  { value: 'mentoria', label: 'MentorIA' },
                ].map(opt => {
                  const checked = moduleForm.allowed_programs?.includes(opt.value);
                  return (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = moduleForm.allowed_programs || [];
                          const next = e.target.checked
                            ? [...current, opt.value]
                            : current.filter(p => p !== opt.value);
                          setModuleForm({ ...moduleForm, allowed_programs: next });
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={saveModule}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLesson ? 'Editar Aula' : 'Nova Aula'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={lessonForm.type} onValueChange={(v) => setLessonForm({ ...lessonForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duracao (min)</Label>
                <Input type="number" value={lessonForm.duration_minutes} onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL do Conteudo</Label>
              <Input value={lessonForm.content_url} onChange={(e) => setLessonForm({ ...lessonForm, content_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={lessonForm.sort_order} onChange={(e) => setLessonForm({ ...lessonForm, sort_order: parseInt(e.target.value) || 0 })} />
            </div>

            {lessonForm.type === 'video' && lessonForm.content_url && (
              <div className="space-y-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <Label className="text-xs text-amber-300">Edicao de video (sem alterar arquivo)</Label>
                <p className="text-[10px] text-muted-foreground">
                  Define em que segundo o player comeca/termina. Util pra cortar inicio,
                  fim, ou apontar para um trecho. Deixe em branco para usar arquivo completo.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Inicio (segundos)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={lessonForm.clip_start_seconds}
                      onChange={(e) => setLessonForm({ ...lessonForm, clip_start_seconds: e.target.value })}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Fim (segundos)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={lessonForm.clip_end_seconds}
                      onChange={(e) => setLessonForm({ ...lessonForm, clip_end_seconds: e.target.value })}
                      placeholder="auto"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                {editingLesson && (
                  <Button
                    size="sm" variant="outline"
                    className="w-full mt-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={splitLessonAtCurrent}
                  >
                    Dividir em 2 aulas
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  Ex: para cortar os primeiros 30s e ultimos 60s de um video de 600s, use inicio=30, fim=540.
                  "Dividir" cria automaticamente uma nova aula de "fim" em diante.
                </p>
              </div>
            )}

            <SupportMaterialsEditor
              description={lessonForm.support_description}
              materials={lessonForm.support_materials}
              onDescriptionChange={(v) => setLessonForm({ ...lessonForm, support_description: v })}
              onMaterialsChange={(v) => setLessonForm({ ...lessonForm, support_materials: v })}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={saveLesson}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acelerador Editor (upload real + campos ricos) */}
      <AcceleratorEditor
        open={showFileDialog}
        onOpenChange={setShowFileDialog}
        editing={editingFile}
        modules={modules}
        onSaved={loadFiles}
      />

      {/* Dialog: Gravar aula via sala de reuniao */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gravar nova aula</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
              Vai abrir a sala de reuniao + que Vencedores. A gravacao inicia automaticamente.
              Ao encerrar, o video vai para o B2, a transcricao e analisada e um PDF
              resumo e gerado - tudo publicado como aula neste modulo.
            </div>
            <div className="space-y-2">
              <Label>Titulo da aula</Label>
              <Input
                value={recordForm.title}
                onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
                placeholder="Ex: Prospeccao B2B - Fundamentos"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do apresentador</Label>
              <Input
                value={recordForm.host_name}
                onChange={(e) => setRecordForm({ ...recordForm, host_name: e.target.value })}
                placeholder="Como aparecera na sala"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={startLessonRecording}
              disabled={creatingRecording || !recordForm.title.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {creatingRecording ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
              Abrir sala de gravacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Upload direto de video (Fase 4) */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload direto de video</DialogTitle>
          </DialogHeader>
          <VideoUploadDialog
            moduleId={recordModuleId}
            onClose={() => setShowUploadDialog(false)}
            onPublished={() => { setShowUploadDialog(false); loadLessons(); }}
          />
        </DialogContent>
      </Dialog>

      {editingMember && (
        <MemberEditDialog
          member={editingMember}
          open={!!editingMember}
          onClose={() => setEditingMember(null)}
          onUpdated={loadMembers}
        />
      )}

      <MemberFinancialDrawer
        memberId={financialDrawerMemberId}
        open={!!financialDrawerMemberId}
        onOpenChange={(o) => { if (!o) setFinancialDrawerMemberId(null); }}
        onChanged={() => { loadPayments(); loadMembers(); }}
      />

      <MemberEngagementDrawer
        memberId={engagementMemberId}
        onClose={() => setEngagementMemberId(null)}
      />
    </div>
  );
}
