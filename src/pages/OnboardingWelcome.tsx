import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Rocket, CheckCircle2, ArrowRight, Clock, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientData {
  id: string;
  company_name: string;
  responsible_name: string;
  onboarding_step: number;
  status: string;
  lead_id: string | null;
}

interface LeadData {
  name: string;
  instagram: string | null;
  instagram_profile_pic_url: string | null;
  instagram_data: any;
}

const ONBOARDING_STEPS = [
  { number: 1, title: 'Identificação', icon: '🏢' },
  { number: 2, title: 'Público-Alvo', icon: '🎯' },
  { number: 3, title: 'Produtos e Serviços', icon: '📦' },
  { number: 4, title: 'Políticas Comerciais', icon: '💰' },
  { number: 5, title: 'Tom de Voz', icon: '🗣️' },
  { number: 6, title: 'Identidade da IA', icon: '🤖' },
  { number: 7, title: 'Operações', icon: '⚙️' },
  { number: 8, title: 'Marketing', icon: '📣' },
  { number: 9, title: 'Políticas Especiais', icon: '📋' },
  { number: 10, title: 'Objetivos', icon: '🎯' },
  { number: 11, title: 'Materiais', icon: '📁' },
  { number: 12, title: 'Fluxos e FAQ', icon: '💬' },
];

export default function OnboardingWelcome() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientData | null>(null);
  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClient() {
      if (!token) {
        setError('Token de onboarding não encontrado');
        setLoading(false);
        return;
      }

      try {
        // Fetch client by token
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('onboarding_token', token)
          .maybeSingle();

        if (clientError) throw clientError;

        if (!clientData) {
          setError('Link de onboarding inválido ou expirado');
          setLoading(false);
          return;
        }

        setClient(clientData);

        // Fetch lead data if available
        if (clientData.lead_id) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('name, instagram, instagram_profile_pic_url, instagram_data')
            .eq('id', clientData.lead_id)
            .maybeSingle();

          if (leadData) {
            setLead(leadData);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar cliente:', err);
        setError('Erro ao carregar dados do onboarding');
      } finally {
        setLoading(false);
      }
    }

    fetchClient();
  }, [token]);

  const handleStartOnboarding = () => {
    if (client) {
      // Update status to in_progress
      supabase
        .from('clients')
        .update({ status: 'in_progress' })
        .eq('id', client.id)
        .then(() => {
          navigate(`/onboarding/${token}/step/1`);
        });
    }
  };

  const handleContinueOnboarding = () => {
    if (client) {
      navigate(`/onboarding/${token}/step/${client.onboarding_step}`);
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="text-6xl mb-6">😕</div>
          <h1 className="text-2xl font-bold text-foreground mb-4">{error}</h1>
          <p className="text-muted-foreground mb-6">
            Entre em contato conosco pelo WhatsApp para obter um novo link de acesso.
          </p>
          <Button
            onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
            className="bg-primary text-primary-foreground"
          >
            Falar no WhatsApp
          </Button>
        </motion.div>
      </div>
    );
  }

  const isReturning = client?.status === 'in_progress' && client.onboarding_step > 1;
  const isCompleted = client?.status === 'completed';
  const progressPercentage = client ? ((client.onboarding_step - 1) / 12) * 100 : 0;

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23fbbf24" fill-opacity="0.1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16">
        {/* Header with logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Onboarding + que Vencedores</span>
          </div>
        </motion.div>

        {/* Main welcome card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-card/80 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
            {/* Profile section */}
            <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-8 md:p-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.3 }}
                className="mb-6"
              >
                {lead?.instagram_profile_pic_url ? (
                  <img
                    src={lead.instagram_profile_pic_url}
                    alt={client?.company_name}
                    className="w-24 h-24 rounded-full mx-auto border-4 border-primary shadow-lg shadow-primary/20 object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full mx-auto border-4 border-primary shadow-lg shadow-primary/20 bg-primary/20 flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary">
                      {client?.responsible_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl md:text-4xl font-bold text-foreground mb-4"
              >
                {isReturning ? 'Bem-vindo de volta,' : isCompleted ? 'Parabéns!' : 'Bem-vindo,'}
                <span className="block text-primary mt-2">{client?.responsible_name}! 👋</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg text-muted-foreground max-w-lg mx-auto"
              >
                {isCompleted
                  ? `O onboarding da ${client?.company_name} foi concluído com sucesso!`
                  : isReturning
                  ? `Continue o onboarding da ${client?.company_name} de onde parou.`
                  : `Estamos prontos para configurar a IA perfeita para a ${client?.company_name}!`}
              </motion.p>
            </div>

            {/* Progress section */}
            {!isCompleted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="px-8 md:px-12 py-6 border-b border-border/50"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Progresso do Onboarding</span>
                  <span className="text-sm text-muted-foreground">
                    {client?.onboarding_step === 1 ? '0' : client?.onboarding_step! - 1}/12 etapas
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                  />
                </div>
              </motion.div>
            )}

            {/* Content section */}
            <div className="p-8 md:p-12">
              {isCompleted ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    Onboarding Concluído! 🎉
                  </h2>
                  <p className="text-muted-foreground mb-8">
                    Nossa equipe já está trabalhando na configuração da sua IA. Em breve você receberá atualizações sobre o progresso.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Falar com a Equipe
                  </Button>
                </motion.div>
              ) : (
                <>
                  {/* What to expect */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mb-8"
                  >
                    <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                      <Rocket className="w-5 h-5 text-primary" />
                      {isReturning ? 'Próximas etapas' : 'O que vamos configurar'}
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {ONBOARDING_STEPS.slice(client?.onboarding_step! - 1, client?.onboarding_step! + 3).map((step, index) => (
                        <motion.div
                          key={step.number}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.8 + index * 0.1 }}
                          className={`p-4 rounded-xl border ${
                            step.number === client?.onboarding_step
                              ? 'bg-primary/10 border-primary'
                              : 'bg-muted/50 border-border/50'
                          }`}
                        >
                          <div className="text-2xl mb-2">{step.icon}</div>
                          <div className="text-xs text-muted-foreground">Etapa {step.number}</div>
                          <div className="text-sm font-medium text-foreground">{step.title}</div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Benefits */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="grid md:grid-cols-3 gap-4 mb-8"
                  >
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30">
                      <Clock className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium text-foreground text-sm">~15 minutos</h3>
                        <p className="text-xs text-muted-foreground">Tempo estimado</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30">
                      <Shield className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium text-foreground text-sm">Salva automático</h3>
                        <p className="text-xs text-muted-foreground">Pode pausar quando quiser</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30">
                      <Zap className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium text-foreground text-sm">IA Personalizada</h3>
                        <p className="text-xs text-muted-foreground">100% adaptada ao seu negócio</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="text-center"
                  >
                    <Button
                      size="lg"
                      onClick={isReturning ? handleContinueOnboarding : handleStartOnboarding}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg group"
                    >
                      {isReturning ? 'Continuar Onboarding' : 'Iniciar Onboarding'}
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                      Suas respostas são salvas automaticamente
                    </p>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-muted-foreground">
            © 2025 + que Vencedores - Inteligência Artificial para Negócios
          </p>
        </motion.div>
      </div>
    </div>
  );
}
