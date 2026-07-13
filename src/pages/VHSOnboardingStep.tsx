import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VHSOnboardingProgress } from '@/components/vhs/VHSOnboardingProgress';
import { VHSQuestionCard, OptionButton, MultiSelectOption, SliderInput } from '@/components/vhs/VHSQuestionCard';
import { ChevronLeft, ChevronRight, Loader2, Briefcase, DollarSign, Clock, MessageSquare, Calendar, Heart, Users, Target, Star, Lightbulb, TrendingUp, HelpCircle, Sparkles, Brain, Zap } from 'lucide-react';
import { toast } from 'sonner';

const TOTAL_STEPS = 6;

// Step configurations - removed emojis, using icons instead
const stepConfig = {
  1: {
    title: 'Seu Momento Atual',
    icon: Briefcase,
    message: 'Antes de tudo, queremos te conhecer. Não existe resposta certa ou errada. Seja 100% honesto!',
    fields: ['current_situation', 'monthly_income', 'work_hours_weekly', 'main_frustration']
  },
  2: {
    title: 'Sua Vida Pessoal',
    icon: Heart,
    message: 'Saber sobre sua família nos ajuda a entender suas motivações reais.',
    fields: ['age_range', 'marital_status', 'has_children', 'children_count', 'family_dependents']
  },
  3: {
    title: 'Seus Sonhos',
    icon: Star,
    message: 'Sonhe alto! Não tenha medo de pensar grande. A IA está tornando possível o que antes parecia impossível.',
    fields: ['biggest_dream', 'dream_deadline', 'what_would_change', 'dream_income']
  },
  4: {
    title: 'Suas Dores',
    icon: MessageSquare,
    message: 'Entender suas dores nos ajuda a criar uma imersão que realmente transforma.',
    fields: ['feels_undervalued', 'salary_covers_bills', 'has_financial_freedom', 'main_pain_points']
  },
  5: {
    title: 'O Que Você Quer em 2026',
    icon: Target,
    message: '2026 pode ser o ano da virada. O que você mais quer conquistar?',
    fields: ['goals_2026', 'priority_goal', 'why_this_event', 'commitment_level']
  },
  6: {
    title: 'Suas Expectativas',
    icon: Sparkles,
    message: 'Última etapa! Conte pra gente o que espera aprender.',
    fields: ['expects_from_event', 'already_knows_ai', 'ai_experience_level', 'main_doubts']
  }
};

const situationOptions = [
  { value: 'clt', label: 'CLT (Empregado)' },
  { value: 'autonomo', label: 'Autônomo / Freelancer' },
  { value: 'empresario', label: 'Empresário' },
  { value: 'desempregado', label: 'Desempregado / Em transição' },
  { value: 'aposentado', label: 'Aposentado' },
  { value: 'estudante', label: 'Estudante' }
];

const incomeOptions = [
  { value: 'ate_2k', label: 'Até R$ 2.000' },
  { value: '2k_5k', label: 'R$ 2.000 - R$ 5.000' },
  { value: '5k_10k', label: 'R$ 5.000 - R$ 10.000' },
  { value: '10k_20k', label: 'R$ 10.000 - R$ 20.000' },
  { value: 'acima_20k', label: 'Acima de R$ 20.000' }
];

const hoursOptions = [
  { value: 'ate_20h', label: 'Até 20h por semana' },
  { value: '20_40h', label: '20h - 40h por semana' },
  { value: '40_60h', label: '40h - 60h por semana' },
  { value: 'acima_60h', label: 'Mais de 60h por semana' }
];

const ageOptions = [
  { value: '25_35', label: '25 a 35 anos' },
  { value: '35_45', label: '35 a 45 anos' },
  { value: '45_55', label: '45 a 55 anos' },
  { value: '55_plus', label: 'Acima de 55 anos' }
];

const maritalOptions = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a) / União estável' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' }
];

const deadlineOptions = [
  { value: '6_meses', label: 'Em 6 meses' },
  { value: '1_ano', label: 'Em 1 ano' },
  { value: '2_anos', label: 'Em 2 anos' },
  { value: '5_anos', label: 'Em 5 anos' }
];

const painOptions = [
  'Falta de reconhecimento no trabalho',
  'Salário que não acompanha a inflação',
  'Insegurança financeira',
  'Depender de uma única fonte de renda',
  'Não ter tempo para a família',
  'Medo de ser substituído por IA',
  'Sensação de estar "para trás" tecnologicamente',
  'Falta de propósito no trabalho atual'
];

const goalsOptions = [
  'Aumentar minha renda atual',
  'Criar uma segunda fonte de renda',
  'Ter mais liberdade de horário',
  'Dar melhor qualidade de vida para minha família',
  'Me atualizar sobre tecnologia/IA',
  'Empreender usando IA',
  'Mudar de carreira',
  'Sair do CLT'
];

const aiLevelOptions = [
  { value: 'nenhum', label: 'Nenhum - nunca usei' },
  { value: 'basico', label: 'Básico - já usei ChatGPT' },
  { value: 'intermediario', label: 'Intermediário - uso no dia a dia' },
  { value: 'avancado', label: 'Avançado - crio automações' }
];

// Instagram data interface
interface LeadInstagramData {
  name?: string;
  instagram?: string;
  profilePicUrl?: string;
  followers?: number;
  category?: string;
  bio?: string;
}

const VHSOnboardingStep: React.FC = () => {
  const { step } = useParams<{ step: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const currentStep = parseInt(step || '1');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [stepStartTime, setStepStartTime] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [leadData, setLeadData] = useState<LeadInstagramData | null>(null);

  // Fetch participant data on mount (only once)
  useEffect(() => {
    // Se já carregamos os dados, não precisa buscar novamente
    if (dataLoaded) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      if (!token) {
        console.error('VHSOnboardingStep: Token não encontrado');
        setError('Link de acesso inválido.');
        setLoading(false);
        return;
      }

      try {
        console.log('VHSOnboardingStep: Buscando participante com token:', token);
        
        // Fetch participant with lead data
        const { data, error: fetchError } = await supabase
          .from('vhs_participants')
          .select('*, lead_id')
          .eq('onboarding_token', token)
          .single();

        if (fetchError || !data) {
          console.error('VHSOnboardingStep: Erro ao buscar participante:', fetchError);
          setError('Não foi possível carregar seus dados. Tente novamente.');
          setLoading(false);
          return;
        }

        console.log('VHSOnboardingStep: Participante encontrado:', data.id);
        setParticipantId(data.id);
        setFormData(data);

        // If participant has lead_id, fetch lead data with Instagram info
        if (data.lead_id) {
          const { data: leadInfo, error: leadError } = await supabase
            .from('leads')
            .select('name, instagram, instagram_data, instagram_profile_pic_url')
            .eq('id', data.lead_id)
            .single();

          if (leadInfo && !leadError) {
            const instagramData = leadInfo.instagram_data as Record<string, any> | null;
            setLeadData({
              name: leadInfo.name,
              instagram: leadInfo.instagram,
              profilePicUrl: leadInfo.instagram_profile_pic_url,
              followers: instagramData?.followers,
              category: instagramData?.category,
              bio: instagramData?.biography
            });
            console.log('VHSOnboardingStep: Dados do Instagram carregados:', leadInfo.instagram);
          }
        }

        setDataLoaded(true);
        setLoading(false);
      } catch (err) {
        console.error('VHSOnboardingStep: Erro inesperado:', err);
        setError('Erro inesperado. Tente novamente.');
        setLoading(false);
      }
    };

    fetchData();
  }, [token, dataLoaded]);

  // Reset step start time when currentStep changes
  useEffect(() => {
    if (dataLoaded) {
      setStepStartTime(new Date());
    }
  }, [currentStep, dataLoaded]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: string, value: string) => {
    setFormData(prev => {
      const current = prev[field] || [];
      const updated = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const saveProgress = async () => {
    if (!participantId) return;

    setSaving(true);

    const config = stepConfig[currentStep as keyof typeof stepConfig];
    const stepData: Record<string, any> = {};
    config.fields.forEach(field => {
      stepData[field] = formData[field];
    });

    // Calculate time spent on step
    const timeSpent = Math.round((new Date().getTime() - stepStartTime.getTime()) / 1000);

    // Save step progress
    await supabase.from('vhs_onboarding_progress').insert({
      participant_id: participantId,
      step_number: currentStep,
      step_name: config.title,
      completed_at: new Date().toISOString(),
      time_spent_seconds: timeSpent,
      step_data: stepData
    });

    // Update participant
    const updateData: Record<string, any> = {
      ...stepData,
      onboarding_step: currentStep,
      updated_at: new Date().toISOString()
    };

    if (currentStep === TOTAL_STEPS) {
      updateData.onboarding_completed = true;
      updateData.onboarding_completed_at = new Date().toISOString();
    }

    await supabase
      .from('vhs_participants')
      .update(updateData)
      .eq('id', participantId);

    setSaving(false);
  };

  const handleNext = async () => {
    await saveProgress();

    if (currentStep < TOTAL_STEPS) {
      navigate(`/vhs/onboarding/step/${currentStep + 1}?token=${token}`);
    } else {
      navigate(`/vhs/onboarding/complete?token=${token}`);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      navigate(`/vhs/onboarding/step/${currentStep - 1}?token=${token}`);
    }
  };

  // Common input styles for better contrast
  const inputStyles = "bg-white border-gray-300 text-black placeholder:text-gray-500 focus:border-yellow focus:ring-yellow";
  const textareaStyles = `${inputStyles} min-h-[100px]`;

  if (loading) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow/10 flex items-center justify-center">
            <HelpCircle className="w-8 h-8 text-yellow" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Ops!</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()}
            className="bg-yellow hover:bg-yellow-400 text-black font-bold"
          >
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  const config = stepConfig[currentStep as keyof typeof stepConfig];
  const StepIcon = config.icon;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <VHSQuestionCard icon={Briefcase} title="Qual sua situação profissional atual?">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {situationOptions.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={formData.current_situation === opt.value}
                    onClick={() => updateField('current_situation', opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={DollarSign} title="Qual sua faixa de renda mensal atual?">
              <div className="space-y-2">
                {incomeOptions.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={formData.monthly_income === opt.value}
                    onClick={() => updateField('monthly_income', opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={Clock} title="Quantas horas você trabalha por semana?">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {hoursOptions.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={formData.work_hours_weekly === opt.value}
                    onClick={() => updateField('work_hours_weekly', opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={MessageSquare} title="Qual sua principal frustração no trabalho atual?">
              <Textarea
                value={formData.main_frustration || ''}
                onChange={(e) => updateField('main_frustration', e.target.value)}
                placeholder="Descreva o que mais te frustra..."
                className={textareaStyles}
              />
            </VHSQuestionCard>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <VHSQuestionCard icon={Calendar} title="Qual sua faixa etária?">
              <div className="grid grid-cols-2 gap-3">
                {ageOptions.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={formData.age_range === opt.value}
                    onClick={() => updateField('age_range', opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={Heart} title="Qual seu estado civil?">
              <div className="grid grid-cols-2 gap-3">
                {maritalOptions.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={formData.marital_status === opt.value}
                    onClick={() => updateField('marital_status', opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={Users} title="Você tem filhos?">
              <div className="grid grid-cols-2 gap-3">
                <OptionButton
                  selected={formData.has_children === true}
                  onClick={() => updateField('has_children', true)}
                >
                  Sim, tenho filhos
                </OptionButton>
                <OptionButton
                  selected={formData.has_children === false}
                  onClick={() => updateField('has_children', false)}
                >
                  Não tenho filhos
                </OptionButton>
              </div>

              {formData.has_children && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4"
                >
                  <label className="text-gray-300 text-sm mb-2 block">Quantos filhos?</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.children_count || ''}
                    onChange={(e) => updateField('children_count', parseInt(e.target.value))}
                    className={`${inputStyles} w-24`}
                  />
                </motion.div>
              )}
            </VHSQuestionCard>

            <VHSQuestionCard icon={Users} title="Quantas pessoas dependem financeiramente de você?">
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map(num => (
                  <OptionButton
                    key={num}
                    selected={formData.family_dependents === num}
                    onClick={() => updateField('family_dependents', num)}
                  >
                    {num === 3 ? '3+' : num}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <VHSQuestionCard icon={Star} title="Qual é o seu maior sonho profissional?">
              <Textarea
                value={formData.biggest_dream || ''}
                onChange={(e) => updateField('biggest_dream', e.target.value)}
                placeholder="Não tenha medo de sonhar alto..."
                className={`${inputStyles} min-h-[120px]`}
              />
            </VHSQuestionCard>

            <VHSQuestionCard icon={Clock} title="Em quanto tempo você quer realizar esse sonho?">
              <div className="grid grid-cols-2 gap-3">
                {deadlineOptions.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={formData.dream_deadline === opt.value}
                    onClick={() => updateField('dream_deadline', opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={TrendingUp} title="O que mudaria na sua vida se você ganhasse 3x mais?">
              <Textarea
                value={formData.what_would_change || ''}
                onChange={(e) => updateField('what_would_change', e.target.value)}
                placeholder="Descreva as mudanças que faria..."
                className={textareaStyles}
              />
            </VHSQuestionCard>

            <VHSQuestionCard icon={DollarSign} title="Qual salário você acredita que MERECE ganhar?">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-bold">R$</span>
                <Input
                  type="text"
                  value={formData.dream_income || ''}
                  onChange={(e) => updateField('dream_income', e.target.value)}
                  placeholder="Ex: 15.000"
                  className={`${inputStyles} pl-12 text-xl font-bold`}
                />
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Dica: Pense no valor que realmente reflete seu potencial, não o que o mercado "paga".
              </p>
            </VHSQuestionCard>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <VHSQuestionCard icon={MessageSquare} title="Responda com honestidade:">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-carbon/50 rounded-xl border border-gray-700">
                  <span className="text-gray-300">Me sinto desvalorizado no trabalho</span>
                  <div className="flex gap-2">
                    <OptionButton
                      selected={formData.feels_undervalued === true}
                      onClick={() => updateField('feels_undervalued', true)}
                      className="!w-auto !px-4"
                    >
                      Sim
                    </OptionButton>
                    <OptionButton
                      selected={formData.feels_undervalued === false}
                      onClick={() => updateField('feels_undervalued', false)}
                      className="!w-auto !px-4"
                    >
                      Não
                    </OptionButton>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-carbon/50 rounded-xl border border-gray-700">
                  <span className="text-gray-300">Meu salário mal paga as contas</span>
                  <div className="flex gap-2">
                    <OptionButton
                      selected={formData.salary_covers_bills === false}
                      onClick={() => updateField('salary_covers_bills', false)}
                      className="!w-auto !px-4"
                    >
                      Sim
                    </OptionButton>
                    <OptionButton
                      selected={formData.salary_covers_bills === true}
                      onClick={() => updateField('salary_covers_bills', true)}
                      className="!w-auto !px-4"
                    >
                      Não
                    </OptionButton>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-carbon/50 rounded-xl border border-gray-700">
                  <span className="text-gray-300">Tenho liberdade financeira</span>
                  <div className="flex gap-2">
                    <OptionButton
                      selected={formData.has_financial_freedom === true}
                      onClick={() => updateField('has_financial_freedom', true)}
                      className="!w-auto !px-4"
                    >
                      Sim
                    </OptionButton>
                    <OptionButton
                      selected={formData.has_financial_freedom === false}
                      onClick={() => updateField('has_financial_freedom', false)}
                      className="!w-auto !px-4"
                    >
                      Não
                    </OptionButton>
                  </div>
                </div>
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={Lightbulb} title="Quais dessas dores você sente? (selecione todas)">
              <div className="space-y-2">
                {painOptions.map(pain => (
                  <MultiSelectOption
                    key={pain}
                    selected={(formData.main_pain_points || []).includes(pain)}
                    onClick={() => toggleArrayField('main_pain_points', pain)}
                  >
                    {pain}
                  </MultiSelectOption>
                ))}
              </div>
            </VHSQuestionCard>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <VHSQuestionCard icon={Target} title="Quais desses objetivos são seus para 2026? (selecione todos)">
              <div className="space-y-2">
                {goalsOptions.map(goal => (
                  <MultiSelectOption
                    key={goal}
                    selected={(formData.goals_2026 || []).includes(goal)}
                    onClick={() => toggleArrayField('goals_2026', goal)}
                  >
                    {goal}
                  </MultiSelectOption>
                ))}
              </div>
            </VHSQuestionCard>

            {(formData.goals_2026 || []).length > 0 && (
              <VHSQuestionCard icon={Star} title="Qual é o MAIS importante?">
                <div className="space-y-2">
                  {(formData.goals_2026 || []).map((goal: string) => (
                    <OptionButton
                      key={goal}
                      selected={formData.priority_goal === goal}
                      onClick={() => updateField('priority_goal', goal)}
                    >
                      {goal}
                    </OptionButton>
                  ))}
                </div>
              </VHSQuestionCard>
            )}

            <VHSQuestionCard icon={HelpCircle} title="Por que você escolheu participar desta imersão?">
              <Textarea
                value={formData.why_this_event || ''}
                onChange={(e) => updateField('why_this_event', e.target.value)}
                placeholder="O que te motivou a investir nessa oportunidade..."
                className={textareaStyles}
              />
            </VHSQuestionCard>

            <VHSQuestionCard icon={Zap} title="De 1 a 10, qual seu nível de comprometimento com essa transformação?">
              <SliderInput
                value={formData.commitment_level || 5}
                onChange={(value) => updateField('commitment_level', value)}
              />
            </VHSQuestionCard>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <VHSQuestionCard icon={Sparkles} title="O que você MAIS espera aprender na imersão?">
              <Textarea
                value={formData.expects_from_event || ''}
                onChange={(e) => updateField('expects_from_event', e.target.value)}
                placeholder="O que você quer sair sabendo fazer..."
                className={`${inputStyles} min-h-[120px]`}
              />
            </VHSQuestionCard>

            <VHSQuestionCard icon={Brain} title="Você já usou alguma ferramenta de IA?">
              <div className="grid grid-cols-2 gap-3">
                <OptionButton
                  selected={formData.already_knows_ai === true}
                  onClick={() => updateField('already_knows_ai', true)}
                >
                  Sim, já usei
                </OptionButton>
                <OptionButton
                  selected={formData.already_knows_ai === false}
                  onClick={() => updateField('already_knows_ai', false)}
                >
                  Nunca usei
                </OptionButton>
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={TrendingUp} title="Como você avalia seu conhecimento em IA?">
              <div className="space-y-2">
                {aiLevelOptions.map(opt => (
                  <OptionButton
                    key={opt.value}
                    selected={formData.ai_experience_level === opt.value}
                    onClick={() => updateField('ai_experience_level', opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </VHSQuestionCard>

            <VHSQuestionCard icon={HelpCircle} title="Qual sua maior dúvida sobre IA?">
              <Textarea
                value={formData.main_doubts || ''}
                onChange={(e) => updateField('main_doubts', e.target.value)}
                placeholder="Pergunte qualquer coisa... vamos responder na imersão!"
                className={textareaStyles}
              />
            </VHSQuestionCard>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>{`Onboarding - Passo ${currentStep} | Do VHS ao Prompt`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-carbon relative">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow/5 via-carbon to-carbon" />

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Header with progress */}
          <div className="sticky top-0 z-20 bg-carbon/90 backdrop-blur-sm border-b border-yellow/10 py-4">
            <VHSOnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          </div>

          {/* Step content */}
          <div className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Personalized header with Instagram data */}
                {leadData?.profilePicUrl && currentStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-carbon/80 to-carbon/60 rounded-xl border border-yellow/20"
                  >
                    <img 
                      src={leadData.profilePicUrl} 
                      alt={leadData.name || 'Perfil'}
                      className="w-14 h-14 rounded-full border-2 border-yellow object-cover"
                    />
                    <div>
                      <p className="text-white font-bold text-lg">
                        Olá, {leadData.name?.split(' ')[0] || 'Participante'}!
                      </p>
                      {leadData.followers && (
                        <p className="text-gray-400 text-sm">
                          @{leadData.instagram} • {leadData.followers.toLocaleString('pt-BR')} seguidores
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow/20 to-yellow/5 flex items-center justify-center border border-yellow/20">
                    <StepIcon className="w-8 h-8 text-yellow" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    {config.title}
                  </h1>
                  <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
                    {config.message}
                  </p>
                </div>

                {/* Step fields */}
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="sticky bottom-0 bg-carbon/90 backdrop-blur-sm border-t border-yellow/10 p-4">
            <div className="max-w-2xl mx-auto flex justify-between items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || saving}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>

              <span className="text-gray-500 text-sm">
                {currentStep} de {TOTAL_STEPS}
              </span>

              <Button
                onClick={handleNext}
                disabled={saving}
                className="bg-gradient-to-r from-yellow to-yellow-500 hover:from-yellow-400 hover:to-yellow-600 text-carbon font-bold"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : currentStep === TOTAL_STEPS ? (
                  'Concluir'
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VHSOnboardingStep;
