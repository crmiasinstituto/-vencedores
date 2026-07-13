import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';

// Helper to query untyped tables
const supabaseRaw = supabase as any;
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Table,
  MessageSquare,
  Users,
  Megaphone,
  MessageCircle,
  BarChart,
  DollarSign,
  Kanban,
  Calendar,
  PenTool,
  GraduationCap,
  Link,
  Plus,
  Sparkles,
  CheckCircle2,
  Shield,
  HeadphonesIcon,
  Infinity,
  Crown,
  CreditCard,
  QrCode,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrollmentData {
  id: string;
  name: string;
  company: string;
  role: string;
  whatsapp: string;
  email: string;
  expectation: string;
  ai_goals: string[];
  custom_goal: string;
  ai_level: string;
  uses_ai_tools: boolean;
  ai_tools_used: string;
  biggest_challenge: string;
  weekly_hours: string;
  payment_method: string;
  payment_status: string;
  payment_value: number;
  personalized_plan: any[];
  onboarding_step: number;
  status: string;
}

// ─── AI Goal options ──────────────────────────────────────────────────────────

const AI_GOALS = [
  { id: 'planilhas', label: 'Organizar planilhas e dados', icon: Table },
  { id: 'sdr', label: 'Agente de atendimento / SDR', icon: MessageSquare },
  { id: 'funcionarios', label: 'Controlar funcionários', icon: Users },
  { id: 'marketing', label: 'Automação de marketing', icon: Megaphone },
  { id: 'whatsapp', label: 'Chatbot WhatsApp', icon: MessageCircle },
  { id: 'relatorios', label: 'Análise de dados e relatórios', icon: BarChart },
  { id: 'financeiro', label: 'Gestão financeira', icon: DollarSign },
  { id: 'crm', label: 'CRM personalizado', icon: Kanban },
  { id: 'agendamento', label: 'Agendamento inteligente', icon: Calendar },
  { id: 'conteudo', label: 'Geração de conteúdo com IA', icon: PenTool },
  { id: 'treinamento', label: 'Treinamento de equipe em IA', icon: GraduationCap },
  { id: 'integracao', label: 'Integração de sistemas', icon: Link },
];

// ─── Payment options ──────────────────────────────────────────────────────────

const PAYMENT_OPTIONS = [
  {
    id: 'pix',
    label: 'PIX',
    value: 4497,
    display: 'R$ 4.497,00',
    detail: '10% de desconto',
    icon: QrCode,
    highlight: true,
  },
  {
    id: 'boleto',
    label: 'Boleto',
    value: 4997,
    display: 'R$ 4.997,00',
    detail: 'à vista',
    icon: FileText,
  },
  {
    id: 'cartao_avista',
    label: 'Cartão à vista',
    value: 4997,
    display: 'R$ 4.997,00',
    detail: 'à vista',
    icon: CreditCard,
  },
  {
    id: 'cartao_3x',
    label: 'Cartão 3x',
    value: 5196,
    display: '3x R$ 1.732,00',
    detail: 'sem juros',
    icon: CreditCard,
  },
  {
    id: 'cartao_6x',
    label: 'Cartão 6x',
    value: 5394,
    display: '6x R$ 899,00',
    detail: 'sem juros',
    icon: CreditCard,
  },
  {
    id: 'cartao_12x',
    label: 'Cartão 12x',
    value: 5988,
    display: '12x R$ 499,00',
    detail: 'com juros',
    icon: CreditCard,
  },
];

// ─── Module generator ─────────────────────────────────────────────────────────

const GOAL_MODULES: Record<string, { title: string; modules: string[] }> = {
  planilhas: {
    title: 'Organização de Dados',
    modules: [
      'Estruturação de planilhas com IA',
      'Automação de relatórios no Google Sheets',
      'Dashboard inteligente com dados em tempo real',
    ],
  },
  sdr: {
    title: 'Agente SDR com IA',
    modules: [
      'Criação de agente de qualificação de leads',
      'Scripts de atendimento automatizado',
      'Integração SDR + CRM + WhatsApp',
    ],
  },
  funcionarios: {
    title: 'Gestão de Equipe',
    modules: [
      'Painel de controle de tarefas com IA',
      'Automação de onboarding de colaboradores',
      'Relatórios de desempenho automatizados',
    ],
  },
  marketing: {
    title: 'Marketing Automatizado',
    modules: [
      'Funis de e-mail marketing com IA',
      'Automação de campanhas multi-canal',
      'Análise preditiva de conversão',
    ],
  },
  whatsapp: {
    title: 'Chatbot WhatsApp',
    modules: [
      'Configuração de chatbot inteligente',
      'Fluxos de atendimento automatizado',
      'Integração WhatsApp + CRM + pagamentos',
    ],
  },
  relatorios: {
    title: 'Analytics & BI',
    modules: [
      'Dashboards inteligentes com IA',
      'Relatórios automatizados semanais',
      'Análise preditiva de tendências',
    ],
  },
  financeiro: {
    title: 'Gestão Financeira',
    modules: [
      'Automação de cobranças e recebimentos',
      'Dashboard financeiro em tempo real',
      'Previsão de fluxo de caixa com IA',
    ],
  },
  crm: {
    title: 'CRM Personalizado',
    modules: [
      'Construção de CRM sob medida',
      'Automação de follow-ups inteligentes',
      'Pipeline de vendas com scoring de leads',
    ],
  },
  agendamento: {
    title: 'Agendamento Inteligente',
    modules: [
      'Sistema de agendamento com IA',
      'Automação de confirmações e lembretes',
      'Integração com Google Calendar e WhatsApp',
    ],
  },
  conteudo: {
    title: 'Conteúdo com IA',
    modules: [
      'Geração de posts para redes sociais',
      'Criação de e-mails e copies com IA',
      'Planejamento editorial automatizado',
    ],
  },
  treinamento: {
    title: 'Treinamento de Equipe',
    modules: [
      'Workshops de IA para times',
      'Playbooks de uso de ferramentas de IA',
      'Cultura de inovação e adoção de IA',
    ],
  },
  integracao: {
    title: 'Integração de Sistemas',
    modules: [
      'Conexão entre plataformas via API',
      'Automação de fluxos entre sistemas',
      'Sincronização de dados em tempo real',
    ],
  },
};

// ─── Slide animation variants ─────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 200 : -200,
    opacity: 0,
  }),
};

// ─── Main Component ───────────────────────────────────────────────────────────

const MetodoSquaadOnboarding: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [programName, setProgramName] = useState('Método + que Vencedores');

  // Current step & animation direction
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const totalSteps = 4;

  // Step 1 - Profile
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [expectation, setExpectation] = useState('');

  // Step 2 - AI Goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState('');
  const [showCustomGoal, setShowCustomGoal] = useState(false);

  // Step 3 - Level Assessment
  const [aiLevel, setAiLevel] = useState(0); // 0=iniciante, 1=intermediario, 2=avancado
  const [usesAiTools, setUsesAiTools] = useState(false);
  const [aiToolsUsed, setAiToolsUsed] = useState('');
  const [biggestChallenge, setBiggestChallenge] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('4h');

  // Step 4 - Payment
  const [paymentMethod, setPaymentMethod] = useState('');

  // ── Fetch enrollment on mount ───────────────────────────────────────────────

  useEffect(() => {
    const fetchEnrollment = async () => {
      if (!token) {
        setError('Token de acesso não encontrado.');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabaseRaw
        .from('metodo_squaad_enrollments')
        .select('*')
        .eq('onboarding_token', token)
        .single();

      if (fetchError || !data) {
        setError('Link inválido ou expirado.');
        setLoading(false);
        return;
      }

      const d = data as any;
      setEnrollmentId(d.id);
      setStep(d.onboarding_step || 1);
      if (d.program) setProgramName(d.program);

      // Restore saved data
      if (d.name) setName(d.name);
      if (d.company) setCompany(d.company);
      if (d.role) setRole(d.role);
      if (d.whatsapp) setWhatsapp(d.whatsapp);
      if (d.email) setEmail(d.email);
      if (d.expectation) setExpectation(d.expectation);
      if (d.ai_goals?.length) setSelectedGoals(d.ai_goals);
      if (d.custom_goal) {
        setCustomGoal(d.custom_goal);
        setShowCustomGoal(true);
      }
      if (d.ai_level === 'intermediario') setAiLevel(1);
      else if (d.ai_level === 'avancado') setAiLevel(2);
      if (d.uses_ai_tools) setUsesAiTools(true);
      if (d.ai_tools_used) setAiToolsUsed(d.ai_tools_used);
      if (d.biggest_challenge) setBiggestChallenge(d.biggest_challenge);
      if (d.weekly_hours) setWeeklyHours(d.weekly_hours);
      if (d.payment_method) setPaymentMethod(d.payment_method);

      // Mark as in_progress
      if (d.status === 'pending') {
        await supabaseRaw
          .from('metodo_squaad_enrollments')
          .update({ status: 'in_progress' })
          .eq('id', d.id);
      }

      setLoading(false);
    };

    fetchEnrollment();
  }, [token]);

  // ── Helper: level label ─────────────────────────────────────────────────────

  const levelLabel = aiLevel === 0 ? 'Iniciante' : aiLevel === 1 ? 'Intermediário' : 'Avançado';
  const levelKey = aiLevel === 0 ? 'iniciante' : aiLevel === 1 ? 'intermediario' : 'avancado';

  // ── Personalized plan based on selected goals ───────────────────────────────

  const personalizedPlan = useMemo(() => {
    return selectedGoals
      .filter((g) => g !== 'outro')
      .map((goalId) => GOAL_MODULES[goalId])
      .filter(Boolean);
  }, [selectedGoals]);

  // ── Save current step data ──────────────────────────────────────────────────

  const saveStepData = async (nextStep: number) => {
    if (!enrollmentId) return;
    setSaving(true);

    const updates: Record<string, any> = {
      onboarding_step: nextStep,
      updated_at: new Date().toISOString(),
    };

    // Always save profile
    updates.name = name;
    updates.company = company;
    updates.role = role;
    updates.whatsapp = whatsapp;
    updates.email = email;
    updates.expectation = expectation;

    // Save goals
    updates.ai_goals = selectedGoals;
    updates.custom_goal = customGoal;

    // Save level
    updates.ai_level = levelKey;
    updates.uses_ai_tools = usesAiTools;
    updates.ai_tools_used = aiToolsUsed;
    updates.biggest_challenge = biggestChallenge;
    updates.weekly_hours = weeklyHours;

    // Save payment
    updates.payment_method = paymentMethod;
    const payOpt = PAYMENT_OPTIONS.find((p) => p.id === paymentMethod);
    if (payOpt) updates.payment_value = payOpt.value;

    // Save plan on completion
    if (nextStep === 4) {
      updates.personalized_plan = personalizedPlan;
      updates.status = 'completed';
    }

    await supabaseRaw
      .from('metodo_squaad_enrollments')
      .update(updates)
      .eq('id', enrollmentId);

    setSaving(false);
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim() !== '' && whatsapp.trim() !== '';
      case 2:
        return selectedGoals.length > 0;
      case 3:
        return biggestChallenge.trim() !== '';
      case 4: // confirmation
        return true;
      default:
        return true;
    }
  };

  const goNext = async () => {
    if (!canProceed()) {
      toast.error('Preencha os campos obrigatórios para continuar.');
      return;
    }
    const next = Math.min(step + 1, totalSteps);
    await saveStepData(next);
    setDirection(1);
    setStep(next);
  };

  const goPrev = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  // ── Toggle goal selection ───────────────────────────────────────────────────

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]
    );
  };

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="text-6xl mb-6">😕</div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Ops!</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button
            onClick={() => window.open('https://wa.me/5575983080330', '_blank')}
            className="bg-primary text-primary-foreground"
          >
            Falar no WhatsApp
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Progress ────────────────────────────────────────────────────────────────

  const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>{programName} - Onboarding</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-background to-background" />

        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Top bar with progress */}
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">{programName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Etapa {step} de {totalSteps}
                </span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
            <div className="max-w-3xl w-full">
              <AnimatePresence mode="wait" custom={direction}>
                {/* ─── STEP 1: Welcome & Profile ─── */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                        className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-2 mb-4"
                      >
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-primary text-sm font-medium">
                          Bem-vindo ao {programName}
                        </span>
                      </motion.div>
                      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                        Sua jornada na{' '}
                        <span className="text-primary">Inteligência Artificial</span> começa aqui
                      </h1>
                      <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                        O {programName} é uma mentoria personalizada onde você vai aprender a criar
                        suas próprias soluções de IA para o seu negócio. Vamos conhecer você melhor.
                      </p>
                    </div>

                    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 md:p-8 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Nome completo <span className="text-destructive">*</span>
                          </label>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Seu nome completo"
                            className="bg-input border-border/50 text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Empresa
                          </label>
                          <Input
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="Nome da sua empresa"
                            className="bg-input border-border/50 text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Cargo / Função
                          </label>
                          <Input
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="Ex: CEO, Gerente, Fundador"
                            className="bg-input border-border/50 text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            WhatsApp <span className="text-destructive">*</span>
                          </label>
                          <Input
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            placeholder="(00) 00000-0000"
                            className="bg-input border-border/50 text-foreground"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          E-mail
                        </label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          className="bg-input border-border/50 text-foreground"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          O que você espera do programa?
                        </label>
                        <Textarea
                          value={expectation}
                          onChange={(e) => setExpectation(e.target.value)}
                          placeholder="Conte um pouco sobre suas expectativas com a mentoria..."
                          rows={3}
                          className="bg-input border-border/50 text-foreground resize-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 2: AI Goals ─── */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <div className="text-center mb-8">
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                        Quais são seus{' '}
                        <span className="text-primary">objetivos com IA</span>?
                      </h2>
                      <p className="text-muted-foreground">
                        Selecione todos os temas que fazem sentido para o seu negócio.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {AI_GOALS.map((goal, idx) => {
                        const Icon = goal.icon;
                        const selected = selectedGoals.includes(goal.id);
                        return (
                          <motion.button
                            key={goal.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            onClick={() => toggleGoal(goal.id)}
                            className={`relative flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                              selected
                                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                                : 'bg-card/60 border-border/50 hover:border-primary/40 hover:bg-card/80'
                            }`}
                          >
                            <div
                              className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                                selected ? 'bg-primary/20' : 'bg-muted/50'
                              }`}
                            >
                              <Icon
                                className={`w-5 h-5 ${
                                  selected ? 'text-primary' : 'text-muted-foreground'
                                }`}
                              />
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                selected ? 'text-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              {goal.label}
                            </span>
                            {selected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-2 right-2"
                              >
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}

                      {/* Outro card */}
                      <motion.button
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: AI_GOALS.length * 0.04 }}
                        onClick={() => {
                          setShowCustomGoal(!showCustomGoal);
                          if (!showCustomGoal) {
                            setSelectedGoals((prev) =>
                              prev.includes('outro') ? prev : [...prev, 'outro']
                            );
                          } else {
                            setSelectedGoals((prev) => prev.filter((g) => g !== 'outro'));
                            setCustomGoal('');
                          }
                        }}
                        className={`relative flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                          showCustomGoal
                            ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                            : 'bg-card/60 border-border/50 hover:border-primary/40 hover:bg-card/80'
                        }`}
                      >
                        <div
                          className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                            showCustomGoal ? 'bg-primary/20' : 'bg-muted/50'
                          }`}
                        >
                          <Plus
                            className={`w-5 h-5 ${
                              showCustomGoal ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            showCustomGoal ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          Outro
                        </span>
                        {showCustomGoal && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          </motion.div>
                        )}
                      </motion.button>
                    </div>

                    {showCustomGoal && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4"
                      >
                        <Input
                          value={customGoal}
                          onChange={(e) => setCustomGoal(e.target.value)}
                          placeholder="Descreva seu objetivo..."
                          className="bg-input border-border/50 text-foreground"
                        />
                      </motion.div>
                    )}

                    {selectedGoals.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 flex flex-wrap gap-2"
                      >
                        {selectedGoals.map((gId) => {
                          const g = AI_GOALS.find((x) => x.id === gId);
                          return (
                            <Badge
                              key={gId}
                              variant="outline"
                              className="border-primary/40 text-primary bg-primary/5"
                            >
                              {g?.label || 'Outro'}
                            </Badge>
                          );
                        })}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ─── STEP 3: Level Assessment ─── */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <div className="text-center mb-8">
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                        Seu <span className="text-primary">nível atual</span>
                      </h2>
                      <p className="text-muted-foreground">
                        Nos ajude a entender onde você está para montar o melhor plano.
                      </p>
                    </div>

                    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 md:p-8 space-y-8">
                      {/* AI Level Slider */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-4 block">
                          Como você classifica seu conhecimento em IA?
                        </label>
                        <div className="px-2">
                          <Slider
                            value={[aiLevel]}
                            onValueChange={(val) => setAiLevel(val[0])}
                            max={2}
                            min={0}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between mt-2">
                            <span
                              className={`text-xs ${
                                aiLevel === 0
                                  ? 'text-primary font-semibold'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Iniciante
                            </span>
                            <span
                              className={`text-xs ${
                                aiLevel === 1
                                  ? 'text-primary font-semibold'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Intermediário
                            </span>
                            <span
                              className={`text-xs ${
                                aiLevel === 2
                                  ? 'text-primary font-semibold'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Avançado
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 text-center">
                          <Badge
                            variant="outline"
                            className="border-primary/40 text-primary bg-primary/5"
                          >
                            {levelLabel}
                          </Badge>
                        </div>
                      </div>

                      {/* Uses AI Tools */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-3 block">
                          Já usa alguma ferramenta de IA?
                        </label>
                        <div className="flex items-center gap-3">
                          <Switch checked={usesAiTools} onCheckedChange={setUsesAiTools} />
                          <span className="text-sm text-muted-foreground">
                            {usesAiTools ? 'Sim, já uso' : 'Ainda não'}
                          </span>
                        </div>
                        {usesAiTools && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3"
                          >
                            <Input
                              value={aiToolsUsed}
                              onChange={(e) => setAiToolsUsed(e.target.value)}
                              placeholder="Quais ferramentas? (Ex: ChatGPT, Zapier, Make...)"
                              className="bg-input border-border/50 text-foreground"
                            />
                          </motion.div>
                        )}
                      </div>

                      {/* Biggest Challenge */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Qual seu maior desafio hoje?{' '}
                          <span className="text-destructive">*</span>
                        </label>
                        <Textarea
                          value={biggestChallenge}
                          onChange={(e) => setBiggestChallenge(e.target.value)}
                          placeholder="Descreva o principal desafio que você quer resolver com IA..."
                          rows={3}
                          className="bg-input border-border/50 text-foreground resize-none"
                        />
                      </div>

                      {/* Weekly Hours */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          Quanto tempo por semana pode dedicar ao programa?
                        </label>
                        <Select value={weeklyHours} onValueChange={setWeeklyHours}>
                          <SelectTrigger className="bg-input border-border/50 text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2h">2 horas por semana</SelectItem>
                            <SelectItem value="4h">4 horas por semana</SelectItem>
                            <SelectItem value="6h">6 horas por semana</SelectItem>
                            <SelectItem value="8h+">8+ horas por semana</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 4: Payment Plan ─── */}
                {step === 99 && (
                  <motion.div
                    key="step4"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    <div className="text-center mb-8">
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                        Escolha seu <span className="text-primary">plano de pagamento</span>
                      </h2>
                      <p className="text-muted-foreground">
                        Invista no seu futuro com IA. Escolha a forma que melhor se encaixa.
                      </p>
                    </div>

                    {/* Program Card */}
                    <div className="bg-gradient-to-b from-primary/10 via-card/80 to-card/80 backdrop-blur-xl rounded-2xl border border-primary/30 p-6 md:p-8 mb-6">
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 mb-3">
                          <Crown className="w-6 h-6 text-primary" />
                          <span className="text-lg font-bold text-primary">
                            {programName} - Mentoria em IA
                          </span>
                        </div>
                        <div className="text-4xl font-bold text-foreground">
                          R$ 4.997<span className="text-lg text-muted-foreground">,00</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          ou a partir de R$ 4.497,00 no PIX
                        </p>
                      </div>

                      {/* Payment Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {PAYMENT_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const selected = paymentMethod === opt.id;
                          return (
                            <motion.button
                              key={opt.id}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setPaymentMethod(opt.id)}
                              className={`relative flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                                selected
                                  ? 'bg-primary/15 border-primary shadow-lg shadow-primary/10'
                                  : 'bg-card/60 border-border/50 hover:border-primary/40'
                              } ${opt.highlight && !selected ? 'ring-1 ring-primary/20' : ''}`}
                            >
                              <div
                                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                                  selected ? 'bg-primary/20' : 'bg-muted/50'
                                }`}
                              >
                                <Icon
                                  className={`w-5 h-5 ${
                                    selected ? 'text-primary' : 'text-muted-foreground'
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm font-semibold ${
                                    selected ? 'text-foreground' : 'text-muted-foreground'
                                  }`}
                                >
                                  {opt.label}
                                </div>
                                <div className="text-xs text-primary font-medium">
                                  {opt.display}
                                </div>
                                <div className="text-xs text-muted-foreground">{opt.detail}</div>
                              </div>
                              {selected && (
                                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                              )}
                              {opt.highlight && (
                                <div className="absolute -top-2 -right-2">
                                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                                    Melhor
                                  </Badge>
                                </div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* PIX info */}
                      {paymentMethod === 'pix' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20 text-center"
                        >
                          <p className="text-sm text-foreground font-medium mb-1">
                            Chave PIX (CNPJ):
                          </p>
                          <p className="text-primary font-mono text-sm">
                            contato@squaad.com.br
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Após o pagamento, envie o comprovante pelo WhatsApp
                          </p>
                        </motion.div>
                      )}
                    </div>

                    {/* Trust badges */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card/60 border border-border/30">
                        <Shield className="w-5 h-5 text-primary" />
                        <span className="text-xs text-center text-muted-foreground font-medium">
                          Garantia de 7 dias
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card/60 border border-border/30">
                        <HeadphonesIcon className="w-5 h-5 text-primary" />
                        <span className="text-xs text-center text-muted-foreground font-medium">
                          Suporte exclusivo
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card/60 border border-border/30">
                        <Infinity className="w-5 h-5 text-primary" />
                        <span className="text-xs text-center text-muted-foreground font-medium">
                          Acesso vitalício
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 5: Confirmation & Personalized Plan ─── */}
                {step === 4 && (
                  <motion.div
                    key="step5"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  >
                    {/* Success animation */}
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 10 }}
                        className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4"
                      >
                        <CheckCircle2 className="w-10 h-10 text-primary" />
                      </motion.div>
                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl md:text-3xl font-bold text-foreground mb-2"
                      >
                        Inscrição <span className="text-primary">confirmada</span>!
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-muted-foreground"
                      >
                        Seu plano personalizado já foi montado com base nas suas respostas.
                      </motion.p>
                    </div>

                    {/* Personalized Plan */}
                    {personalizedPlan.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-6 md:p-8 mb-6"
                      >
                        <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-primary" />
                          Seu Plano Personalizado
                        </h3>

                        <div className="space-y-5">
                          {personalizedPlan.map((section, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.5 + idx * 0.1 }}
                            >
                              <h4 className="text-sm font-semibold text-primary mb-2">
                                {section.title}
                              </h4>
                              <div className="space-y-2">
                                {section.modules.map((mod: string, mIdx: number) => (
                                  <div
                                    key={mIdx}
                                    className="flex items-center gap-2 pl-3 py-1.5 text-sm text-muted-foreground"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                    {mod}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Mentor contact */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="bg-gradient-to-r from-primary/10 via-card/80 to-card/80 rounded-2xl border border-primary/20 p-6 text-center"
                    >
                      <p className="text-foreground font-medium mb-3">
                        Seu mentor entrará em contato em até{' '}
                        <span className="text-primary font-bold">24 horas</span> para alinhar seu
                        plano personalizado.
                      </p>
                      <Button
                        onClick={() =>
                          window.open(
                            'https://wa.me/5575983080330?text=Olá! Acabei de me inscrever no {programName}!',
                            '_blank'
                          )
                        }
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Falar com Carlos no WhatsApp
                      </Button>
                    </motion.div>

                    {/* Footer */}
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9 }}
                      className="text-center text-xs text-muted-foreground mt-6"
                    >
                      {programName} - Inteligência Artificial para Negócios
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Navigation Buttons ─── */}
              {step < 5 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-between mt-8"
                >
                  <Button
                    variant="ghost"
                    onClick={goPrev}
                    disabled={step === 1}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Voltar
                  </Button>

                  <Button
                    onClick={goNext}
                    disabled={saving || !canProceed()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6 group"
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {step === totalSteps ? 'Finalizar' : 'Continuar'}
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MetodoSquaadOnboarding;
