import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, Heart, Target, ChevronRight, Loader2 } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  onboarding_token: string;
  onboarding_step: number;
}

const VHSOnboardingStart: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParticipant = async () => {
      if (!token) {
        setError('Token de acesso não encontrado.');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('vhs_participants')
        .select('id, name, onboarding_token, onboarding_step')
        .eq('onboarding_token', token)
        .single();

      if (fetchError || !data) {
        setError('Link inválido ou expirado.');
        setLoading(false);
        return;
      }

      setParticipant(data);
      
      // Update onboarding_started_at if not set
      await supabase
        .from('vhs_participants')
        .update({ onboarding_started_at: new Date().toISOString() })
        .eq('id', data.id)
        .is('onboarding_started_at', null);

      setLoading(false);
    };

    fetchParticipant();
  }, [token]);

  const handleStart = () => {
    if (!token || !participant) {
      console.error('VHSOnboardingStart: Token ou participante não encontrado');
      return;
    }
    
    // If they already started, continue from where they left
    const startStep = participant.onboarding_step && participant.onboarding_step > 0 
      ? participant.onboarding_step 
      : 1;
    
    console.log('VHSOnboardingStart: Navegando para step', startStep, 'com token:', token);
    navigate(`/vhs/onboarding/step/${startStep}?token=${token}`);
  };

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
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-white mb-2">Ops!</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const firstName = participant?.name?.split(' ')[0] || 'Aluno';

  return (
    <>
      <Helmet>
        <title>Onboarding | Do VHS ao Prompt</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-carbon relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow/10 via-carbon to-carbon" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow/30 rounded-full"
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: Math.random() * window.innerHeight,
                opacity: 0 
              }}
              animate={{ 
                y: [null, Math.random() * -200],
                opacity: [0, 0.5, 0]
              }}
              transition={{ 
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl w-full text-center"
          >
            {/* Greeting */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center gap-2 bg-yellow/10 border border-yellow/30 rounded-full px-4 py-2 mb-6"
            >
              <Sparkles className="w-4 h-4 text-yellow" />
              <span className="text-yellow text-sm font-medium">Parabéns pela sua decisão!</span>
            </motion.div>

            {/* Main heading */}
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Olá, <span className="text-yellow">{firstName}</span>! 👋
            </h1>

            <p className="text-gray-300 text-lg md:text-xl mb-8 leading-relaxed">
              Você tomou uma das melhores decisões de 2026.
              <br />
              <span className="text-yellow font-medium">Agora queremos te conhecer melhor.</span>
            </p>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-carbon/80 border border-yellow/20 rounded-xl p-4"
              >
                <Clock className="w-6 h-6 text-yellow mx-auto mb-2" />
                <p className="text-white font-semibold">~5 minutos</p>
                <p className="text-gray-400 text-sm">para completar</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-carbon/80 border border-yellow/20 rounded-xl p-4"
              >
                <Heart className="w-6 h-6 text-yellow mx-auto mb-2" />
                <p className="text-white font-semibold">100% Honesto</p>
                <p className="text-gray-400 text-sm">não existe resposta errada</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-carbon/80 border border-yellow/20 rounded-xl p-4"
              >
                <Target className="w-6 h-6 text-yellow mx-auto mb-2" />
                <p className="text-white font-semibold">Personalizado</p>
                <p className="text-gray-400 text-sm">imersão feita pra você</p>
              </motion.div>
            </div>

            {/* Why section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-r from-yellow/5 to-transparent border-l-4 border-yellow rounded-r-xl p-6 mb-8 text-left"
            >
              <h3 className="text-white font-bold mb-2">Por que esse onboarding?</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Queremos que sua experiência no dia <strong className="text-yellow">01 de Março</strong> seja 
                <strong className="text-white"> 100% personalizada</strong>. Suas respostas nos ajudam a criar 
                uma imersão que fala diretamente com suas dores e sonhos.
              </p>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button
                onClick={handleStart}
                size="lg"
                className="bg-gradient-to-r from-yellow to-yellow-500 hover:from-yellow-400 hover:to-yellow-600 text-black font-bold text-lg px-8 py-6 rounded-xl shadow-lg shadow-yellow/30 group"
              >
                {participant?.onboarding_step && participant.onboarding_step > 0 
                  ? 'Continuar Onboarding' 
                  : 'Começar Minha Jornada'
                }
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>

            {/* Footer note */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-gray-500 text-sm mt-6"
            >
              🔒 Suas respostas são confidenciais e usadas apenas para melhorar sua experiência.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default VHSOnboardingStart;
