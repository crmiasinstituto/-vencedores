import React, { useState, useEffect } from 'react';
import { ClipboardCopy, Send, CheckCircle2, Clock, Loader2, UserCheck, Target, DollarSign, Heart, Briefcase, GraduationCap, Flame, Star, AlertTriangle, TrendingUp, Brain, ExternalLink, Rocket, XCircle, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper to query untyped tables
const supabaseRaw = supabase as any;

interface VHSParticipant {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  onboarding_token: string;
  onboarding_step: number;
  payment_confirmed_at?: string;
  created_at: string;
}

interface OnboardingProgress {
  step_number: number;
  step_name: string;
  step_data: any;
  completed_at?: string;
}

interface LeadOnboardingTabProps {
  leadId: string;
  leadName: string;
  leadWhatsapp: string;
}

// ============ HUMANIZATION MAPS ============

const VALUE_LABELS: Record<string, Record<string, string>> = {
  current_situation: {
    empregado: 'Empregado(a) CLT',
    autonomo: 'Autônomo / Freelancer',
    empresario: 'Empresário(a)',
    desempregado: 'Desempregado(a)',
    estudante: 'Estudante',
    aposentado: 'Aposentado(a)',
  },
  monthly_income: {
    ate_3k: 'Até R$ 3.000',
    '3k_5k': 'R$ 3.000 - R$ 5.000',
    '5k_10k': 'R$ 5.000 - R$ 10.000',
    '10k_20k': 'R$ 10.000 - R$ 20.000',
    '20k_50k': 'R$ 20.000 - R$ 50.000',
    acima_50k: 'Acima de R$ 50.000',
  },
  work_hours_weekly: {
    menos_20h: 'Menos de 20h',
    '20_40h': '20h - 40h',
    '40_60h': '40h - 60h',
    mais_60h: 'Mais de 60h',
  },
  age_range: {
    '18_25': '18 a 25 anos',
    '25_35': '25 a 35 anos',
    '35_45': '35 a 45 anos',
    '45_55': '45 a 55 anos',
    '55_plus': '55+ anos',
  },
  marital_status: {
    solteiro: 'Solteiro(a)',
    casado: 'Casado(a)',
    divorciado: 'Divorciado(a)',
    viuvo: 'Viúvo(a)',
    uniao_estavel: 'União Estável',
  },
  dream_deadline: {
    '3_meses': 'Em 3 meses',
    '6_meses': 'Em 6 meses',
    '1_ano': 'Em 1 ano',
    '2_anos': 'Em 2 anos',
    sem_prazo: 'Sem prazo definido',
  },
  ai_experience_level: {
    nenhum: 'Nenhum - nunca usei',
    basico: 'Básico - já usei ChatGPT',
    intermediario: 'Intermediário - uso ferramentas de IA',
    avancado: 'Avançado - implemento IA no trabalho',
  },
};

const FIELD_LABELS: Record<string, string> = {
  current_situation: 'Situação',
  monthly_income: 'Renda Mensal',
  work_hours_weekly: 'Horas/Semana',
  main_frustration: 'Maior Frustração',
  age_range: 'Idade',
  marital_status: 'Estado Civil',
  has_children: 'Filhos',
  children_count: 'Qtd. Filhos',
  family_dependents: 'Dependentes',
  biggest_dream: 'Maior Sonho',
  dream_deadline: 'Prazo do Sonho',
  dream_income: 'Renda Desejada',
  what_would_change: 'O que Mudaria',
  main_pain_points: 'Dores Principais',
  salary_covers_bills: 'Salário Cobre Contas',
  feels_undervalued: 'Se Sente Desvalorizado',
  has_financial_freedom: 'Liberdade Financeira',
  commitment_level: 'Comprometimento',
  goals_2026: 'Metas 2026',
  priority_goal: 'Meta Prioritária',
  why_this_event: 'Por que Este Evento',
  ai_experience_level: 'Nível IA',
  already_knows_ai: 'Conhece IA',
  expects_from_event: 'Expectativa do Evento',
  main_doubts: 'Dúvidas Principais',
};

function humanize(key: string, value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    if (key === 'commitment_level') return `${value}/10`;
    if (key === 'children_count') return `${value} filho${value > 1 ? 's' : ''}`;
    if (key === 'family_dependents') return `${value} pessoa${value > 1 ? 's' : ''}`;
    return String(value);
  }
  if (Array.isArray(value)) return value.join(' • ');
  const map = VALUE_LABELS[key];
  if (map && map[value]) return map[value];
  return String(value);
}

const STEP_CONFIG = [
  { name: 'Seu Momento Atual', icon: Briefcase, fields: ['current_situation', 'monthly_income', 'work_hours_weekly', 'main_frustration'] },
  { name: 'Sua Vida Pessoal', icon: Heart, fields: ['age_range', 'marital_status', 'has_children', 'children_count', 'family_dependents'] },
  { name: 'Seus Sonhos', icon: Star, fields: ['biggest_dream', 'dream_deadline', 'dream_income', 'what_would_change'] },
  { name: 'Suas Dores', icon: AlertTriangle, fields: ['main_pain_points', 'salary_covers_bills', 'feels_undervalued', 'has_financial_freedom'] },
  { name: 'O Que Quer em 2026', icon: Target, fields: ['commitment_level', 'goals_2026', 'priority_goal', 'why_this_event'] },
  { name: 'Suas Expectativas', icon: Brain, fields: ['ai_experience_level', 'already_knows_ai', 'expects_from_event', 'main_doubts'] },
];

export const LeadOnboardingTab: React.FC<LeadOnboardingTabProps> = ({ leadId, leadName, leadWhatsapp }) => {
  const [participant, setParticipant] = useState<VHSParticipant | null>(null);
  const [progress, setProgress] = useState<OnboardingProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const cleanPhone = leadWhatsapp.replace(/\D/g, '');

  useEffect(() => {
    fetchParticipant();
  }, [leadWhatsapp]);

  const fetchParticipant = async () => {
    setIsLoading(true);
    try {
      const variants = [cleanPhone];
      if (!cleanPhone.startsWith('55')) variants.push('55' + cleanPhone);
      if (cleanPhone.startsWith('55')) variants.push(cleanPhone.slice(2));

      const { data: participantData } = await supabase
        .from('vhs_participants')
        .select('*')
        .in('whatsapp', variants)
        .order('onboarding_step', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (participantData) {
        setParticipant(participantData);
        const { data: progressData } = await supabase
          .from('vhs_onboarding_progress')
          .select('step_number, step_name, step_data, completed_at')
          .eq('participant_id', participantData.id)
          .order('step_number', { ascending: true });
        setProgress(progressData || []);
      } else {
        setParticipant(null);
        setProgress([]);
      }
    } catch (err) {
      console.error('Error fetching participant:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOnboarding = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-vhs-participant', {
        body: { name: leadName, whatsapp: cleanPhone }
      });
      if (error) throw error;
      await supabase.from('crm_activities').insert({
        lead_id: leadId,
        activity_type: 'onboarding_sent',
        description: `Onboarding VHS enviado para ${leadName}`,
        metadata: { onboarding_url: data?.onboarding_url, token: data?.onboarding_token }
      });
      toast.success('Onboarding criado!', { description: data?.onboarding_url });
      fetchParticipant();
    } catch (err: any) {
      toast.error('Erro ao criar onboarding: ' + (err.message || ''));
    } finally {
      setIsSending(false);
    }
  };

  const copyLink = () => {
    if (!participant) return;
    const url = `https://squaad.lovable.app/vhs/onboarding?token=${participant.onboarding_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="space-y-4">
        <MetodoSquaadSection leadId={leadId} leadName={leadName} leadWhatsapp={leadWhatsapp} />
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Send className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nenhum onboarding VHS enviado para este lead.</p>
          <Button onClick={sendOnboarding} disabled={isSending} className="gap-2">
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar Onboarding VHS
          </Button>
        </div>
      </div>
    );
  }

  const totalSteps = 6;
  const progressPercent = (participant.onboarding_step / totalSteps) * 100;
  const isComplete = participant.onboarding_step >= totalSteps;

  // Build step data map
  const stepDataMap: Record<number, any> = {};
  progress.forEach(p => { stepDataMap[p.step_number] = p.step_data || {}; });

  // Extract strategic insights
  const insights = extractInsights(stepDataMap);

  return (
    <div className="space-y-4 overflow-auto max-h-[60vh] pr-1">
      {/* Método + que Vencedores */}
      <MetodoSquaadSection leadId={leadId} leadName={leadName} leadWhatsapp={leadWhatsapp} />

      {/* VHS Onboarding - Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isComplete ? 'bg-green-500' : participant.onboarding_step > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-muted'}`} />
          <Badge variant={isComplete ? 'default' : 'outline'}>
            {isComplete ? '✅ Completo' : participant.onboarding_step > 0 ? `Etapa ${participant.onboarding_step}/${totalSteps}` : 'Aguardando'}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 text-xs">
          <ClipboardCopy className="w-3.5 h-3.5" /> Copiar Link
        </Button>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progresso</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Strategic Insights */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/10">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Insights Estratégicos
          </h4>
          <div className="flex flex-wrap gap-2">
            {insights.map((insight, i) => (
              <Badge key={i} variant="outline" className={`text-xs ${insight.color}`}>
                {insight.icon} {insight.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Humanized Steps */}
      <div className="space-y-3">
        {STEP_CONFIG.map((step, i) => {
          const stepNum = i + 1;
          const isDone = participant.onboarding_step >= stepNum;
          const data = stepDataMap[stepNum] || {};
          const Icon = step.icon;

          return (
            <Card key={i} className={`transition-all ${isDone ? 'border-primary/30 bg-primary/5' : 'opacity-40'}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-sm font-semibold flex-1">{stepNum}. {step.name}</p>
                  {isDone && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                </div>
                
                {isDone && Object.keys(data).length > 0 && (
                  <div className="ml-9 space-y-1.5">
                    {step.fields.map(field => {
                      const val = data[field];
                      if (val === undefined || val === null || val === '') return null;
                      const label = FIELD_LABELS[field] || field;
                      const display = humanize(field, val);
                      
                      // Long text fields get special treatment
                      const isLong = typeof val === 'string' && val.length > 50;
                      const isArray = Array.isArray(val);
                      
                      if (isArray && val.length > 0) {
                        return (
                          <div key={field}>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {val.map((item: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] font-normal">{item}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      
                      if (isLong) {
                        return (
                          <div key={field}>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                            <p className="text-xs text-foreground/80 mt-0.5 italic">"{display}"</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={field} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{label}:</span>
                          <span className="font-medium text-foreground">{display}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Token info */}
      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        Token: <code className="bg-muted px-1 rounded">{participant.onboarding_token}</code>
        {participant.payment_confirmed_at && (
          <span className="ml-2">• Pagamento: {new Date(participant.payment_confirmed_at).toLocaleDateString('pt-BR')}</span>
        )}
      </div>
    </div>
  );
};

// ============ MÉTODO + que Vencedores ONBOARDING SECTION ============

interface MetodoSquaadEnrollment {
  id: string;
  name: string;
  whatsapp: string;
  crm_lead_id: string;
  onboarding_token: string;
  onboarding_step: number;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  completed: { label: 'Completo', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  paid: { label: 'Pago', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
};

const MetodoSquaadSection: React.FC<{ leadId: string; leadName: string; leadWhatsapp: string }> = ({
  leadId, leadName, leadWhatsapp
}) => {
  const [enrollment, setEnrollment] = useState<MetodoSquaadEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [memberStatus, setMemberStatus] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [creatingMember, setCreatingMember] = useState(false);
  const [resending, setResending] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    fetchEnrollment();
  }, [leadId]);

  const fetchEnrollment = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseRaw
        .from('metodo_squaad_enrollments')
        .select('*')
        .eq('crm_lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setEnrollment(data || null);

      // Check if member exists
      const cleanPhone = leadWhatsapp.replace(/\D/g, '');
      const { data: member } = await supabaseRaw
        .from('members')
        .select('id, status')
        .or(`crm_lead_id.eq.${leadId},phone.eq.${cleanPhone}`)
        .maybeSingle();
      setMemberStatus(member?.status || null);
      setMemberId(member?.id || null);
    } catch (err) {
      console.error('Error fetching Método + que Vencedores enrollment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cria membro chamando a edge function activate-lead-as-member.
  // Garante que o WhatsApp com credenciais e disparado (corrige o caso do
  // INSERT direto que so criava o registro sem mandar mensagem).
  const createMember = async () => {
    setCreatingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke('activate-lead-as-member', {
        body: {
          lead_id: leadId,
          program: 'metodo-squaad',
          payment_method: 'other',
          num_installments: 1,
          send_credentials: true,
          force: false,
        },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      const d = data as any;
      setMemberStatus('active');
      setMemberId(d.member_id);
      toast.success(
        d.credentials_sent
          ? `✅ Acesso criado e credenciais enviadas no WhatsApp pra ${leadName}`
          : `Acesso criado pra ${leadName} (mas o envio do WhatsApp falhou — use Reenviar)`,
      );
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || ''));
    } finally {
      setCreatingMember(false);
    }
  };

  const resendCredentials = async () => {
    if (!memberId) return;
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-member-credentials', {
        body: { member_id: memberId, force: true },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      toast.success('Credenciais reenviadas no WhatsApp');
    } catch (err: any) {
      toast.error('Erro ao reenviar: ' + (err.message || ''));
    } finally {
      setResending(false);
    }
  };

  // Habilitar Metodo + que Vencedores all-in-one: gera enrollment (se nao tem) e cria
  // acesso + manda credenciais. Util pra Enterprise/clientes especiais que nao
  // passaram pelo fluxo de fechamento normal.
  const enableMetodoSquaad = async () => {
    setEnabling(true);
    try {
      const cleanPhone = leadWhatsapp.replace(/\D/g, '');
      // 1) garantir enrollment
      if (!enrollment) {
        const { data: enrl, error: enrlErr } = await supabaseRaw
          .from('metodo_squaad_enrollments')
          .insert({
            crm_lead_id: leadId,
            name: leadName,
            whatsapp: cleanPhone,
          })
          .select()
          .single();
        if (enrlErr) throw enrlErr;
        setEnrollment(enrl);
        await supabase.from('crm_activities').insert({
          lead_id: leadId,
          activity_type: 'onboarding_sent',
          description: `Metodo + que Vencedores habilitado pra ${leadName}`,
          metadata: { enrollment_id: enrl.id, type: 'metodo_squaad' },
        });
      }
      // 2) criar member + disparar credenciais
      const { data, error } = await supabase.functions.invoke('activate-lead-as-member', {
        body: {
          lead_id: leadId,
          program: 'metodo-squaad',
          payment_method: 'other',
          num_installments: 1,
          send_credentials: true,
          force: memberStatus === 'active',
        },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      const d = data as any;
      setMemberStatus('active');
      setMemberId(d.member_id);
      toast.success(
        d.credentials_sent
          ? `✅ Método + que Vencedores habilitado + credenciais enviadas no WhatsApp`
          : `Método + que Vencedores habilitado (envio WhatsApp falhou — clique Reenviar)`,
      );
    } catch (err: any) {
      toast.error('Erro ao habilitar: ' + (err.message || ''));
    } finally {
      setEnabling(false);
    }
  };

  const cancelOnboarding = async () => {
    if (!enrollment) return;
    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-onboarding', {
        body: { enrollment_id: enrollment.id, reason: 'Cancelado manualmente pelo admin' },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast.success('Onboarding cancelado — mensagens automáticas paradas');
      fetchEnrollment();
    } catch (err: any) {
      toast.error('Erro ao cancelar: ' + (err.message || ''));
    } finally {
      setIsCancelling(false);
    }
  };

  const generateLink = async () => {
    setIsGenerating(true);
    try {
      const cleanPhone = leadWhatsapp.replace(/\D/g, '');
      const { data, error } = await supabaseRaw
        .from('metodo_squaad_enrollments')
        .insert({
          crm_lead_id: leadId,
          name: leadName,
          whatsapp: cleanPhone,
        })
        .select()
        .single();

      if (error) throw error;

      setEnrollment(data);

      // Log activity
      await supabase.from('crm_activities').insert({
        lead_id: leadId,
        activity_type: 'onboarding_sent',
        description: `Link Método + que Vencedores gerado para ${leadName}`,
        metadata: {
          enrollment_id: data.id,
          onboarding_token: data.onboarding_token,
          type: 'metodo_squaad',
        },
      });

      toast.success('Link de onboarding gerado!');
    } catch (err: any) {
      toast.error('Erro ao gerar link: ' + (err.message || ''));
    } finally {
      setIsGenerating(false);
    }
  };

  const getOnboardingUrl = () => {
    if (!enrollment) return '';
    return `https://squaad.com.br/metodo-squaad/onboarding/${enrollment.onboarding_token}`;
  };

  const copyLink = () => {
    const url = getOnboardingUrl();
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const openLink = () => {
    window.open(getOnboardingUrl(), '_blank');
  };

  const statusInfo = enrollment ? (STATUS_LABELS[enrollment.status] || STATUS_LABELS.pending) : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Onboarding + que Vencedores</h4>
            <p className="text-[11px] text-muted-foreground">Onboarding personalizado do programa</p>
          </div>
          {enrollment && statusInfo && (
            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
              {statusInfo.label}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : enrollment ? (
          <div className="space-y-2.5">
            {/* Link display */}
            <div className="bg-muted/50 rounded-lg p-2.5 border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Link de Onboarding</p>
              <code className="text-xs text-foreground/80 break-all block">{getOnboardingUrl()}</code>
            </div>

            {/* Progress info */}
            {enrollment.onboarding_step > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Etapa {enrollment.onboarding_step} do onboarding</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 text-xs flex-1" disabled={enrollment.status === 'cancelled'}>
                <ClipboardCopy className="w-3.5 h-3.5" /> Copiar Link
              </Button>
              <Button size="sm" variant="outline" onClick={openLink} className="gap-1.5 text-xs flex-1" disabled={enrollment.status === 'cancelled'}>
                <ExternalLink className="w-3.5 h-3.5" /> Abrir
              </Button>
            </div>

            {/* Cancelar onboarding — só pra status pending/in_progress */}
            {(enrollment.status === 'pending' || enrollment.status === 'in_progress') && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs w-full border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <Ban className="w-3.5 h-3.5" /> Cancelar onboarding
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar onboarding?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso vai parar as mensagens automáticas de lembrete que estão sendo enviadas pelo WhatsApp.
                      O lead não vai conseguir usar mais o link de onboarding atual. Você pode gerar um novo link
                      depois se mudar de ideia.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={cancelOnboarding}
                      disabled={isCancelling}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      {isCancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Sim, cancelar onboarding
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Status cancelled — permite gerar novo link */}
            {enrollment.status === 'cancelled' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                  <Ban className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-xs text-red-400 font-medium">
                    Onboarding cancelado — mensagens automáticas paradas
                  </span>
                </div>
                <Button onClick={generateLink} disabled={isGenerating} size="sm" className="gap-1.5 text-xs w-full">
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                  Gerar novo link de onboarding
                </Button>
              </div>
            )}

            {/* Member access */}
            {memberStatus === 'active' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-2.5">
                  <GraduationCap className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-400 font-medium flex-1">Acesso a Area de Membros ativo</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resendCredentials}
                  disabled={resending || !memberId}
                  className="gap-1.5 text-xs w-full border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10"
                  title="Reenviar link e credenciais no WhatsApp"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Reenviar credenciais no WhatsApp
                </Button>
              </div>
            ) : memberStatus === 'pending' ? (
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-yellow-400 font-medium">Acesso pendente de aprovacao</span>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={createMember} disabled={creatingMember} className="gap-1.5 text-xs w-full border-green-500/30 text-green-400 hover:bg-green-500/10">
                {creatingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
                Criar Acesso + Enviar no WhatsApp
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              Nenhum onboarding Método + que Vencedores gerado para este lead.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={enableMetodoSquaad}
                disabled={enabling}
                size="sm"
                className="gap-2 bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-black"
                title="Cria onboarding + acesso à área de membros + envia link no WhatsApp em um clique"
              >
                {enabling ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                Habilitar Método + que Vencedores (tudo de uma vez)
              </Button>
              <Button onClick={generateLink} disabled={isGenerating} size="sm" variant="outline" className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                Só gerar link de onboarding
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Extract key insights from onboarding data
function extractInsights(stepDataMap: Record<number, any>) {
  const insights: { label: string; color: string; icon: string }[] = [];
  const s1 = stepDataMap[1] || {};
  const s2 = stepDataMap[2] || {};
  const s3 = stepDataMap[3] || {};
  const s5 = stepDataMap[5] || {};
  const s6 = stepDataMap[6] || {};

  // Income
  if (s1.monthly_income) {
    const incomeLabel = VALUE_LABELS.monthly_income?.[s1.monthly_income] || s1.monthly_income;
    insights.push({ label: incomeLabel, color: 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10', icon: '💰' });
  }

  // Commitment
  if (s5.commitment_level != null) {
    const level = Number(s5.commitment_level);
    const color = level >= 8 ? 'border-green-500/50 text-green-400 bg-green-500/10' : level >= 5 ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' : 'border-red-500/50 text-red-400 bg-red-500/10';
    insights.push({ label: `Comprometimento: ${level}/10`, color, icon: level >= 8 ? '🔥' : '⚡' });
  }

  // Dream income
  if (s3.dream_income) {
    insights.push({ label: `Meta: R$ ${s3.dream_income}`, color: 'border-blue-500/50 text-blue-400 bg-blue-500/10', icon: '🎯' });
  }

  // AI experience
  if (s6.ai_experience_level) {
    const aiLabel = VALUE_LABELS.ai_experience_level?.[s6.ai_experience_level] || s6.ai_experience_level;
    insights.push({ label: aiLabel, color: 'border-purple-500/50 text-purple-400 bg-purple-500/10', icon: '🤖' });
  }

  // Situation
  if (s1.current_situation) {
    const sitLabel = VALUE_LABELS.current_situation?.[s1.current_situation] || s1.current_situation;
    insights.push({ label: sitLabel, color: 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10', icon: '👤' });
  }

  // Age
  if (s2.age_range) {
    const ageLabel = VALUE_LABELS.age_range?.[s2.age_range] || s2.age_range;
    insights.push({ label: ageLabel, color: 'border-muted-foreground/50 text-muted-foreground', icon: '📅' });
  }

  return insights;
}
