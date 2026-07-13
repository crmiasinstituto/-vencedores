import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { EventCountdown } from '@/components/countdown/EventCountdown';
import { Button } from '@/components/ui/button';
import { 
  PartyPopper, 
  Calendar, 
  Monitor, 
  Clock, 
  Sparkles, 
  MessageCircle,
  Share2,
  CalendarPlus,
  Loader2,
  CheckCircle2,
  Target,
  Rocket
} from 'lucide-react';

interface Participant {
  name: string;
  commitment_level: number;
  priority_goal: string;
}

const VHSOnboardingComplete: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);

  // Event date: March 1st, 2026 at 9:00 AM (Brazil time)
  const eventDate = new Date('2026-03-01T09:00:00-03:00');

  useEffect(() => {
    const fetchParticipant = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('vhs_participants')
        .select('name, commitment_level, priority_goal')
        .eq('onboarding_token', token)
        .single();

      if (data) {
        setParticipant(data);
      }
      setLoading(false);
    };

    fetchParticipant();

    // Hide confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [token]);

  const firstName = participant?.name?.split(' ')[0] || 'Aluno';
  const commitment = participant?.commitment_level || 10;

  const handleAddToCalendar = () => {
    // Google Calendar link
    const title = encodeURIComponent('Imersão Do VHS ao Prompt - + que Vencedores');
    const details = encodeURIComponent('Imersão online sobre Inteligência Artificial. Prepare-se para transformar sua carreira!');
    const startDate = '20260301T120000Z'; // UTC time
    const endDate = '20260301T180000Z'; // UTC time
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startDate}/${endDate}`;
    window.open(calendarUrl, '_blank');
  };

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      '🚀 Acabei de me inscrever na imersão "Do VHS ao Prompt" da + que Vencedores!\n\n' +
      'Dia 01 de Março vou aprender ferramentas de IA que menos de 0,001% da população brasileira conhece.\n\n' +
      '👉 Quer vir também? https://squaad.lovable.app/vhs-ao-prompt'
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Parabéns! | Do VHS ao Prompt</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-carbon relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow/20 via-carbon to-carbon" />
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {showConfetti && [...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ 
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), 
                y: -20,
                rotate: 0,
                opacity: 1
              }}
              animate={{ 
                y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 20,
                rotate: Math.random() * 360,
                opacity: [1, 1, 0]
              }}
              transition={{ 
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 2,
                ease: 'easeOut'
              }}
            >
              <div 
                className={`w-3 h-3 ${
                  i % 3 === 0 ? 'bg-yellow' : i % 3 === 1 ? 'bg-yellow-400' : 'bg-yellow-600'
                } ${i % 2 === 0 ? 'rounded-full' : 'rounded-sm'}`}
              />
            </motion.div>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl w-full text-center"
          >
            {/* Celebration icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow to-yellow-600 mb-6"
            >
              <PartyPopper className="w-12 h-12 text-carbon" />
            </motion.div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl md:text-5xl font-bold text-white mb-4"
            >
              PARABÉNS, <span className="text-yellow">{firstName}</span>! 🎉
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-300 text-lg md:text-xl mb-8"
            >
              Você completou seu onboarding e estamos <strong className="text-yellow">MUITO animados</strong> para te ver na imersão!
            </motion.p>

            {/* Event info card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-carbon/90 via-carbon to-carbon/80 border-2 border-yellow/30 rounded-2xl p-6 md:p-8 mb-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center justify-center gap-3 p-4 bg-yellow/10 rounded-xl">
                  <Calendar className="w-6 h-6 text-yellow" />
                  <div className="text-left">
                    <p className="text-yellow font-bold">01 de Março</p>
                    <p className="text-gray-400 text-sm">Domingo</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 p-4 bg-yellow/10 rounded-xl">
                  <Clock className="w-6 h-6 text-yellow" />
                  <div className="text-left">
                    <p className="text-yellow font-bold">09h - 15h</p>
                    <p className="text-gray-400 text-sm">Horário de Brasília</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 p-4 bg-yellow/10 rounded-xl">
                  <Monitor className="w-6 h-6 text-yellow" />
                  <div className="text-left">
                    <p className="text-yellow font-bold">100% ONLINE</p>
                    <p className="text-gray-400 text-sm">Ao vivo</p>
                  </div>
                </div>
              </div>

              {/* Countdown */}
              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-4">Faltam apenas:</p>
                <EventCountdown targetDate={eventDate} />
              </div>
            </motion.div>

            {/* Commitment reminder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-r from-yellow/10 via-yellow/5 to-transparent border-l-4 border-yellow rounded-r-xl p-6 mb-8 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow/20 flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-yellow" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-2">
                    Você PAGOU e afirmou um comprometimento de {commitment}/10
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Não deixe essa oportunidade passar! Menos de <strong className="text-yellow">0,001%</strong> da população brasileira 
                    terá acesso às ferramentas que você vai aprender.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Motivation box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-carbon/80 border border-gray-700 rounded-xl p-6 mb-8"
            >
              <Rocket className="w-8 h-8 text-yellow mx-auto mb-4" />
              <p className="text-white text-lg font-medium mb-2">
                A oportunidade bate na porta <span className="text-yellow">DUAS VEZES</span>...
              </p>
              <p className="text-gray-400">
                E essa é uma delas. Prepare-se para transformar sua carreira! 🚀
              </p>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
            >
              <Button
                onClick={handleAddToCalendar}
                variant="outline"
                className="border-yellow/50 text-yellow hover:bg-yellow/10"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Adicionar ao Calendário
              </Button>

              <Button
                onClick={handleShareWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar no WhatsApp
              </Button>
            </motion.div>

            {/* WhatsApp notice */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex items-center justify-center gap-3 text-gray-400"
            >
              <MessageCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm">
                Fique atento ao <strong className="text-green-400">WhatsApp</strong>! Enviaremos todas as informações por lá.
              </p>
            </motion.div>

            {/* Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-8 p-6 bg-carbon/50 border border-gray-800 rounded-xl"
            >
              <h4 className="text-white font-bold mb-4">✅ O que você precisa fazer agora:</h4>
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-300">Adicionar o evento ao seu calendário</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-300">Separar o dia 01/03 na sua agenda</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-300">Salvar nosso número no WhatsApp</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-300">Preparar um ambiente tranquilo para assistir</span>
                </div>
              </div>
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="text-gray-500 text-sm mt-8"
            >
              🔒 Suas informações estão seguras e serão usadas apenas para personalizar sua experiência.
            </motion.p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default VHSOnboardingComplete;
