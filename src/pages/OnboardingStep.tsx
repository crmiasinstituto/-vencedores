import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Save, Check, Loader2, Home, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { debounce } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ClientData {
  id: string;
  company_name: string;
  responsible_name: string;
  onboarding_step: number;
  status: string;
  [key: string]: any;
}

const STEP_CONFIG = [
  {
    number: 1,
    title: 'Identificação da Empresa',
    icon: '🏢',
    table: 'clients',
    description: 'Informações básicas sobre sua empresa e negócio',
    fields: [
      { name: 'company_name', label: 'Nome da Empresa', type: 'text', required: true, help: 'Nome fantasia ou razão social que aparece para os clientes' },
      { name: 'responsible_name', label: 'Nome do Responsável', type: 'text', required: true, help: 'Pessoa que será nosso contato principal para o projeto' },
      { name: 'position', label: 'Cargo do Responsável', type: 'text', help: 'Ex: Diretor, Gerente, Proprietário, Sócio...' },
      { name: 'company_age', label: 'Tempo de Empresa (anos)', type: 'text', help: 'Há quanto tempo a empresa está no mercado?' },
      { name: 'employees_count', label: 'Quantidade de Funcionários', type: 'text', help: 'Número aproximado de colaboradores da empresa' },
      { name: 'full_address', label: 'Endereço Completo', type: 'text', help: 'Endereço físico principal (se houver)' },
      { name: 'served_regions', label: 'Regiões Atendidas', type: 'textarea', placeholder: 'Ex: São Paulo capital, Grande SP, Interior...', help: 'Liste todas as cidades/regiões onde você atende clientes' },
      { name: 'business_description', label: 'Descreva seu Negócio', type: 'textarea', placeholder: 'O que sua empresa faz? Qual o core business?', help: 'Explique em detalhes o que sua empresa faz, produtos/serviços principais' },
      { name: 'main_differential', label: 'Principal Diferencial', type: 'textarea', placeholder: 'O que torna sua empresa única no mercado?', help: 'O que você faz diferente dos concorrentes? Por que clientes escolhem você?' },
      { name: 'client_main_pain', label: 'Principal Dor do Cliente', type: 'textarea', placeholder: 'Qual problema principal você resolve para seus clientes?', help: 'Qual a principal necessidade ou problema que seu cliente tem antes de te procurar?' },
    ],
  },
  {
    number: 2,
    title: 'Público-Alvo',
    icon: '🎯',
    table: 'client_audience',
    description: 'Quem são seus clientes ideais e como se comportam',
    fields: [
      { name: 'main_audience_profile', label: 'Perfil do Público Principal', type: 'textarea', placeholder: 'Idade, gênero, classe social, profissão...', help: 'Descreva as características demográficas e comportamentais do seu cliente típico' },
      { name: 'purchase_decision_maker', label: 'Quem Decide a Compra?', type: 'textarea', placeholder: 'Ex: O próprio cliente, família, empresa...', help: 'Identifique quem influencia ou toma a decisão final de compra' },
      { name: 'product_user', label: 'Quem Usa o Produto/Serviço?', type: 'textarea', placeholder: 'É a mesma pessoa que compra?', help: 'Às vezes quem compra não é quem usa - pais compram para filhos, empresas para funcionários...' },
      { name: 'main_objections', label: 'Principais Objeções', type: 'textarea', placeholder: 'Quais as objeções mais comuns? Preço, prazo, confiança...', help: 'Liste as objeções que mais aparecem durante o processo de venda' },
      { name: 'purchase_triggers', label: 'Gatilhos de Compra', type: 'textarea', placeholder: 'O que faz o cliente decidir comprar?', help: 'Situações, dores ou necessidades que fazem o cliente procurar sua solução' },
      { name: 'preferred_channels', label: 'Canais Preferidos', type: 'textarea', placeholder: 'WhatsApp, Instagram, telefone, presencial...', help: 'Por onde seus clientes preferem entrar em contato e comprar?' },
    ],
  },
  {
    number: 3,
    title: 'Produtos e Serviços',
    icon: '📦',
    table: 'client_products',
    description: 'Detalhes sobre o que você vende',
    fields: [
      { name: 'products_list', label: 'Lista de Produtos/Serviços', type: 'textarea', placeholder: 'Liste todos os seus produtos ou serviços principais', help: 'Liste todos os produtos/serviços com nome, descrição breve e faixa de preço' },
      { name: 'best_sellers', label: 'Produtos Mais Vendidos', type: 'textarea', placeholder: 'Quais são os campeões de venda?', help: 'Top 5 produtos/serviços que mais vendem e por que são populares' },
      { name: 'seasonal_products', label: 'Produtos Sazonais', type: 'textarea', placeholder: 'Algum produto vende mais em certas épocas?', help: 'Produtos que têm pico de vendas em datas específicas (Natal, Dia das Mães, etc.)' },
      { name: 'profit_margins', label: 'Margens de Lucro', type: 'textarea', placeholder: 'Quais produtos têm melhor margem?', help: 'Ajuda a IA priorizar produtos mais lucrativos em recomendações' },
      { name: 'non_offered_products', label: 'O que NÃO Oferecemos', type: 'textarea', placeholder: 'Produtos/serviços que você não trabalha', help: 'Importante para a IA não prometer algo que você não faz' },
    ],
  },
  {
    number: 4,
    title: 'Políticas Comerciais',
    icon: '💰',
    table: 'client_products',
    description: 'Condições de pagamento, trocas e promoções',
    fields: [
      { name: 'payment_methods', label: 'Formas de Pagamento', type: 'textarea', placeholder: 'PIX, cartão, boleto, parcelamento...', help: 'Liste todas as formas aceitas e condições de parcelamento' },
      { name: 'exchange_policy', label: 'Política de Trocas', type: 'textarea', placeholder: 'Como funciona a troca de produtos?', help: 'Prazo, condições, quem paga frete de devolução, etc.' },
      { name: 'reservation_policy', label: 'Política de Reservas', type: 'textarea', placeholder: 'Reserva produtos? Como funciona?', help: 'Tempo máximo de reserva, necessita sinal, como cancelar...' },
      { name: 'promotions', label: 'Promoções Vigentes', type: 'textarea', placeholder: 'Quais promoções estão ativas?', help: 'Promoções atuais que a IA pode mencionar' },
      { name: 'discount_approval', label: 'Aprovação de Descontos', type: 'textarea', placeholder: 'A IA pode dar desconto? Até quanto? Quando?', help: 'Defina limites e condições para a IA oferecer descontos automaticamente' },
    ],
  },
  {
    number: 5,
    title: 'Tom de Voz da Marca',
    icon: '🗣️',
    table: 'client_branding',
    description: 'Como sua marca se comunica',
    fields: [
      { name: 'brand_tone', label: 'Tom de Voz', type: 'textarea', placeholder: 'Formal, descontraído, profissional, amigável...', help: 'O tom geral da comunicação - como você fala com clientes?' },
      { name: 'client_treatment', label: 'Como Tratar o Cliente', type: 'textarea', placeholder: 'Você, tu, senhor(a)... Usar nome próprio?', help: 'Tratamento formal ou informal, usar primeiro nome ou sobrenome?' },
      { name: 'phrases_to_use', label: 'Frases que a IA DEVE Usar', type: 'textarea', placeholder: 'Expressões típicas da sua marca', help: 'Expressões, bordões ou frases que representam sua marca' },
      { name: 'phrases_to_avoid', label: 'Frases que a IA NÃO DEVE Usar', type: 'textarea', placeholder: 'Expressões proibidas ou inadequadas', help: 'Palavras ou expressões que vão contra a identidade da marca' },
      { name: 'brand_behaviors', label: 'Comportamentos da Marca', type: 'textarea', placeholder: 'Como a marca se comporta? Qual a personalidade?', help: 'Se a marca fosse uma pessoa, como ela agiria?' },
      { name: 'serious_mistakes', label: 'Erros Graves a Evitar', type: 'textarea', placeholder: 'O que a IA NUNCA deve fazer ou falar?', help: 'Comportamentos ou afirmações que seriam inaceitáveis' },
    ],
  },
  {
    number: 6,
    title: 'Identidade da IA',
    icon: '🤖',
    table: 'client_branding',
    description: 'Personalize sua assistente virtual',
    fields: [
      { name: 'ai_name', label: 'Nome da IA', type: 'text', placeholder: 'Ex: Luna, Max, Assistente Virtual...', help: 'Nome que a IA usará para se identificar nas conversas' },
      { name: 'ai_introduction', label: 'Apresentação da IA', type: 'textarea', placeholder: 'Como a IA deve se apresentar?', help: 'Frase de abertura quando alguém inicia conversa' },
      { name: 'ai_presentation_style', label: 'Estilo de Apresentação', type: 'textarea', placeholder: 'Usar emojis? Ser mais formal? Usar gírias?', help: 'Nível de informalidade, uso de emojis, abreviações, etc.' },
      { name: 'product_vocabulary', label: 'Vocabulário de Produtos', type: 'textarea', placeholder: 'Termos técnicos, nomes internos, jargões do setor...', help: 'Terminologia específica do seu nicho que a IA deve conhecer' },
    ],
  },
  {
    number: 7,
    title: 'Operações e Sistemas',
    icon: '⚙️',
    table: 'client_operations',
    description: 'Sistemas e processos atuais',
    fields: [
      { name: 'current_systems', label: 'Sistemas Atuais', type: 'textarea', placeholder: 'CRM, ERP, planilhas... O que você usa hoje?', help: 'Liste os sistemas que você usa no dia a dia da empresa' },
      { name: 'integrations', label: 'Integrações Existentes', type: 'textarea', placeholder: 'Quais sistemas estão integrados?', help: 'Sistemas que já conversam entre si automaticamente' },
      { name: 'attendance_flows', label: 'Fluxo de Atendimento Atual', type: 'textarea', placeholder: 'Como é o atendimento hoje?', help: 'Descreva passo a passo como funciona o atendimento hoje' },
      { name: 'automation_scope', label: 'Escopo da Automação', type: 'textarea', placeholder: 'O que você quer automatizar?', help: 'O que a IA deve fazer? Só atender? Agendar? Vender?' },
      { name: 'human_escalation_triggers', label: 'Quando Escalar para Humano?', type: 'textarea', placeholder: 'Em quais situações a IA deve transferir?', help: 'Situações onde a IA deve chamar um humano (reclamação, dúvida complexa...)' },
      { name: 'max_response_time', label: 'Tempo Máximo de Resposta', type: 'text', placeholder: 'Ex: 5 minutos, imediato...', help: 'Em quanto tempo o cliente espera uma resposta?' },
    ],
  },
  {
    number: 8,
    title: 'Marketing e Captação',
    icon: '📣',
    table: 'client_operations',
    description: 'Estratégias de marketing e vendas',
    fields: [
      { name: 'marketing_channels', label: 'Canais de Marketing', type: 'textarea', placeholder: 'Instagram, Google Ads, indicação...', help: 'Onde você divulga sua empresa e produtos?' },
      { name: 'paid_ads', label: 'Tráfego Pago', type: 'textarea', placeholder: 'Usa anúncios? Qual plataforma? Quanto investe?', help: 'Detalhes sobre investimento em anúncios online' },
      { name: 'sales_scripts', label: 'Scripts de Vendas', type: 'textarea', placeholder: 'Tem algum script que funciona bem?', help: 'Roteiros de vendas que já deram resultado' },
      { name: 'growth_goals', label: 'Metas de Crescimento', type: 'textarea', placeholder: 'Qual a meta de vendas/atendimentos?', help: 'Objetivos de crescimento para os próximos meses' },
      { name: 'required_client_data', label: 'Dados que Precisa Coletar', type: 'textarea', placeholder: 'Nome, email, telefone, CPF...', help: 'Informações que a IA deve coletar de cada lead' },
      { name: 'client_database', label: 'Base de Clientes Existente', type: 'textarea', placeholder: 'Tem base de clientes? Quantos? Onde está?', help: 'Informações sobre sua base atual de clientes' },
    ],
  },
  {
    number: 9,
    title: 'Políticas Especiais',
    icon: '📋',
    table: 'client_policies',
    description: 'Regras específicas do seu negócio',
    fields: [
      { name: 'competitor_restrictions', label: 'Restrições sobre Concorrentes', type: 'textarea', placeholder: 'A IA pode falar sobre concorrentes?', help: 'Regras sobre mencionar ou comparar com concorrentes' },
      { name: 'discount_policies', label: 'Políticas de Desconto', type: 'textarea', placeholder: 'Regras para concessão de descontos', help: 'Quando e quanto de desconto pode ser oferecido' },
      { name: 'unsatisfied_client_handling', label: 'Cliente Insatisfeito', type: 'textarea', placeholder: 'Como tratar reclamações?', help: 'Protocolo para lidar com clientes insatisfeitos' },
      { name: 'auto_bonuses', label: 'Bônus Automáticos', type: 'textarea', placeholder: 'A IA pode oferecer brindes/bônus?', help: 'Benefícios que a IA pode oferecer automaticamente' },
      { name: 'forbidden_words', label: 'Palavras Proibidas', type: 'textarea', placeholder: 'Termos que a IA nunca deve usar', help: 'Palavras banidas da comunicação da marca' },
      { name: 'followup_routines', label: 'Rotinas de Follow-up', type: 'textarea', placeholder: 'Como fazer follow-up de leads?', help: 'Sequência de mensagens para leads que não responderam' },
      { name: 'save_personal_data', label: 'Salvar Dados Pessoais?', type: 'switch', help: 'A IA pode salvar informações pessoais para uso futuro?' },
    ],
  },
  {
    number: 10,
    title: 'Objetivos e Métricas',
    icon: '🎯',
    table: 'client_goals',
    description: 'O que você espera da IA',
    fields: [
      { name: 'ai_expectations', label: 'Expectativas com a IA', type: 'textarea', placeholder: 'O que você espera que a IA faça por você?', help: 'Resultados esperados: mais vendas, economia de tempo, melhor atendimento...' },
      { name: 'kpis_to_measure', label: 'KPIs para Medir', type: 'textarea', placeholder: 'Conversão, tempo de resposta, satisfação...', help: 'Métricas que você quer acompanhar para medir sucesso' },
      { name: 'success_criteria', label: 'Critérios de Sucesso', type: 'textarea', placeholder: 'Como saber se a IA está funcionando bem?', help: 'O que precisa acontecer para você considerar um sucesso?' },
      { name: 'failure_criteria', label: 'Critérios de Falha', type: 'textarea', placeholder: 'O que seria um fracasso?', help: 'Situações que indicariam que a IA não está funcionando' },
    ],
  },
  {
    number: 11,
    title: 'Materiais de Apoio',
    icon: '📁',
    table: 'client_materials',
    description: 'Arquivos e recursos da marca',
    fields: [
      { name: 'logo_url', label: 'URL do Logo', type: 'text', placeholder: 'Link para o logo da empresa', help: 'Link direto para o arquivo do logo (PNG, JPG ou SVG)' },
      { name: 'brand_texts', label: 'Textos da Marca', type: 'textarea', placeholder: 'Taglines, slogans, descrições institucionais...', help: 'Textos oficiais da marca: slogan, missão, visão, valores...' },
      { name: 'catalogs_manuals', label: 'Catálogos e Manuais', type: 'textarea', placeholder: 'Tem catálogo de produtos? Manuais? Links?', help: 'Links para catálogos, tabelas de preço, manuais de produtos' },
    ],
  },
  {
    number: 12,
    title: 'Fluxos e FAQ',
    icon: '💬',
    table: 'client_expansion',
    description: 'Perguntas frequentes e fluxos especiais',
    fields: [
      { name: 'ai_functions', label: 'Funções da IA', type: 'textarea', placeholder: 'Atendimento, vendas, suporte, ou todos?', help: 'Quais as principais funções que a IA deve desempenhar?' },
      { name: 'multiple_channels', label: 'Múltiplos Canais?', type: 'switch', help: 'A IA vai atender em mais de um canal (WhatsApp, Instagram, site)?' },
      { name: 'followup_count', label: 'Quantidade de Follow-ups', type: 'text', placeholder: 'Ex: 3', help: 'Quantas vezes a IA deve insistir antes de desistir' },
      { name: 'followup_intervals', label: 'Intervalos entre Follow-ups', type: 'text', placeholder: 'Ex: 24h, 48h, 72h', help: 'Tempo de espera entre cada tentativa de follow-up' },
      { name: 'out_of_context_redirect', label: 'Redirecionamento Fora do Contexto', type: 'textarea', placeholder: 'O que fazer quando cliente pergunta algo fora do escopo?', help: 'Como a IA deve responder a perguntas não relacionadas ao negócio' },
      { name: 'special_messages', label: 'Mensagens Especiais', type: 'textarea', placeholder: 'Boas-vindas, despedida, fora do horário...', help: 'Mensagens prontas para situações específicas' },
      { name: 'future_features', label: 'Funcionalidades Futuras', type: 'textarea', placeholder: 'O que gostaria de adicionar no futuro?', help: 'Features que você gostaria de ter no futuro' },
      { name: 'top_10_faqs', label: 'Top 10 Perguntas Frequentes', type: 'textarea', placeholder: 'Liste as 10 perguntas mais comuns dos clientes', help: 'As perguntas que seus clientes mais fazem - com as respostas ideais' },
    ],
  },
];

export default function OnboardingStep() {
  const { token, step } = useParams<{ token: string; step: string }>();
  const navigate = useNavigate();
  const currentStep = parseInt(step || '1');
  const stepConfig = STEP_CONFIG.find((s) => s.number === currentStep);

  const [client, setClient] = useState<ClientData | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Fetch client and step data
  useEffect(() => {
    async function fetchData() {
      if (!token || !stepConfig) {
        navigate('/');
        return;
      }

      try {
        // Fetch client
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('onboarding_token', token)
          .maybeSingle();

        if (clientError) throw clientError;
        if (!clientData) {
          toast.error('Link de onboarding inválido');
          navigate('/');
          return;
        }

        setClient(clientData);

        // If step is clients table, use client data
        if (stepConfig.table === 'clients') {
          const initialData: Record<string, any> = {};
          stepConfig.fields.forEach((field) => {
            initialData[field.name] = clientData[field.name] || '';
          });
          setFormData(initialData);
        } else {
          // Fetch step-specific data
          const { data: stepData } = await supabase
            .from(stepConfig.table as any)
            .select('*')
            .eq('client_id', clientData.id)
            .maybeSingle();

          if (stepData) {
            const initialData: Record<string, any> = {};
            stepConfig.fields.forEach((field) => {
              if (field.type === 'switch') {
                initialData[field.name] = stepData[field.name] ?? false;
              } else {
                initialData[field.name] = stepData[field.name] || '';
              }
            });
            setFormData(initialData);
          } else {
            // Initialize empty form
            const initialData: Record<string, any> = {};
            stepConfig.fields.forEach((field) => {
              initialData[field.name] = field.type === 'switch' ? false : '';
            });
            setFormData(initialData);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    fetchData();
  }, [token, currentStep, stepConfig, navigate]);

  // Auto-save with debounce
  const saveData = useCallback(
    async (data: Record<string, any>) => {
      if (!client || !stepConfig) return;

      setSaving(true);
      try {
        if (stepConfig.table === 'clients') {
          await supabase
            .from('clients')
            .update(data)
            .eq('id', client.id);
        } else {
          // Check if record exists
          const { data: existing } = await supabase
            .from(stepConfig.table as any)
            .select('id')
            .eq('client_id', client.id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from(stepConfig.table as any)
              .update(data)
              .eq('client_id', client.id);
          } else {
            await supabase
              .from(stepConfig.table as any)
              .insert({ ...data, client_id: client.id });
          }
        }

        setLastSaved(new Date());
      } catch (err) {
        console.error('Erro ao salvar:', err);
      } finally {
        setSaving(false);
      }
    },
    [client, stepConfig]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((data: Record<string, any>) => saveData(data), 1500),
    [saveData]
  );

  const handleFieldChange = (fieldName: string, value: any) => {
    const newData = { ...formData, [fieldName]: value };
    setFormData(newData);
    debouncedSave(newData);
  };

  const handleNext = async () => {
    // Save current data
    await saveData(formData);

    if (currentStep < 12) {
      // Update client step
      await supabase
        .from('clients')
        .update({ onboarding_step: currentStep + 1 })
        .eq('id', client?.id);

      navigate(`/onboarding/${token}/step/${currentStep + 1}`);
    } else {
      // Complete onboarding
      await supabase
        .from('clients')
        .update({ status: 'completed', onboarding_step: 12 })
        .eq('id', client?.id);

      toast.success('Onboarding concluído com sucesso! 🎉');
      navigate(`/onboarding/${token}`);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      navigate(`/onboarding/${token}/step/${currentStep - 1}`);
    }
  };

  if (loading || !stepConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/onboarding/${token}`)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Home className="w-4 h-4 mr-2" />
              Início
            </Button>

            <div className="flex items-center gap-2">
              {saving ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Salvando...
                </span>
              ) : lastSaved ? (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Salvo
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-muted/30 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">
              Etapa {currentStep}/12
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentStep / 12) * 100}%` }}
                className="h-full bg-gradient-to-r from-primary to-primary/70"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Step header */}
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">{stepConfig.icon}</div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {stepConfig.title}
              </h1>
              <p className="text-muted-foreground">{stepConfig.description}</p>
            </div>

            {/* Form fields */}
            <div className="space-y-6 bg-card rounded-2xl border border-border p-6 md:p-8">
              {stepConfig.fields.map((field, index) => (
                <motion.div
                  key={field.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Label htmlFor={field.name} className="text-foreground font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.help && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p>{field.help}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {field.type === 'switch' ? (
                    <div className="flex items-center gap-3">
                      <Switch
                        id={field.name}
                        checked={formData[field.name] || false}
                        onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData[field.name] ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      id={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                      className="bg-background border-border focus:border-primary resize-none"
                    />
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="bg-background border-border focus:border-primary"
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 gap-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex-1 md:flex-none"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>

              <Button
                onClick={handleNext}
                className="flex-1 md:flex-none bg-primary hover:bg-primary/90"
              >
                {currentStep === 12 ? (
                  <>
                    Concluir
                    <Check className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
