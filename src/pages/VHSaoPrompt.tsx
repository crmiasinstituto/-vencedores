import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Rocket, 
  Clock, 
  MapPin, 
  CheckCircle, 
  Zap, 
  TrendingUp, 
  Users, 
  Gift,
  Shield,
  Play,
  Star,
  ChevronDown,
  Brain,
  Sparkles,
  Target,
  Award,
  ArrowRight,
  Flame,
  Crown,
  Lightbulb,
  Bot,
  Workflow,
  DollarSign,
  Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EventCountdown } from '@/components/countdown/EventCountdown';
import { VHSLeadPopup } from '@/components/vhs/VHSLeadPopup';
import { StickyBar } from '@/components/vhs/StickyBar';
import { TestimonialCard } from '@/components/vhs/TestimonialCard';
import { MetaPixel, trackEvent } from '@/components/tracking/MetaPixel';
import expertPhoto from '@/assets/carlos-eduardo-expert.png';
import heroPhoto from '@/assets/carlos-eduardo-hero.jpeg';
import vhsLogo from '@/assets/vhs-logo-branco.png';

// Autoplay video component - plays when scrolled into view
const VideoAutoplay = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldPlay, setShouldPlay] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldPlay(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <iframe
        src={shouldPlay
          ? "https://www.youtube.com/embed/mRCuhPpVihc?autoplay=1&mute=0&loop=1&playlist=mRCuhPpVihc"
          : "about:blank"
        }
        title="Depoimento de aluno"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
};

const VHSaoPrompt = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(true);
  
  
  // Data do evento: 29/03/2026 às 09:00
  const eventDate = new Date('2026-03-29T09:00:00-03:00');
  
  // URLs do checkout Kirvano
  const checkoutUrlVIP = 'https://pay.kirvano.com/425ee53c-6430-4471-9c2d-3fc2e7401552';
  const checkoutUrlPremium = 'https://pay.kirvano.com/11ce4689-1b62-409c-a03f-3ff26a3d1f93';

  

  // Track ViewContent when pricing section is visible
  useEffect(() => {
    const section = document.getElementById('pricing-section');
    if (!section) return;
    let tracked = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !tracked) {
        tracked = true;
        trackEvent('ViewContent', {
          content_name: 'VHS ao Prompt - Seção de Preços',
          content_category: 'Imersão IA',
          value: 97,
          currency: 'BRL'
        });
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleCTAClick = (plan: 'vip' | 'premium' = 'vip') => {
    const value = plan === 'premium' ? 127 : 97;
    trackEvent('InitiateCheckout', {
      content_name: `VHS ao Prompt - ${plan.toUpperCase()}`,
      content_category: 'Imersão IA',
      value,
      currency: 'BRL'
    });
    window.location.href = plan === 'premium' ? checkoutUrlPremium : checkoutUrlVIP;
  };

  const handlePopupSuccess = () => {
    // Mantém o usuário na página após captura do lead
  };

  const benefits = [
    {
      icon: Bot,
      title: "+5 Ferramentas de IA Secretas",
      description: "Domine ChatGPT, Freepik, Lovable, Manus, Claude, Eleven Labs e Abacus — ferramentas que menos de 0,001% da população conhece. A oportunidade bate na porta duas vezes... e essa é uma delas.",
      highlight: "🔒 EXCLUSIVO",
      isSecret: true
    },
    {
      icon: DollarSign,
      title: "Passo a Passo para Ganhar Mais",
      description: "As mesmas técnicas que os maiores especialistas do mercado usam para vender todos os dias no automático. Isso aqui vai mudar sua vida.",
      highlight: "Usado por TOP Players"
    },
    {
      icon: Users,
      title: "Método Simples para Iniciantes",
      description: "Um roteiro claro e simples para começar do zero e construir sua primeira fonte de renda com IA mesmo sem experiência técnica.",
      highlight: "Do Zero ao Primeiro Cliente"
    },
    {
      icon: Gift,
      title: "Framework Prompt Lucrativo",
      description: "Receba o framework exclusivo que uso para vender serviços de IA para clientes",
      highlight: "Bônus R$497"
    }
  ];

  const transformations = [
    { 
      before: "Obsoleto no mercado", 
      after: "Ganhando com IA", 
      icon: Target,
      description: "Empresas vão te procurar para ajudar com IA"
    },
    { 
      before: "Medo da tecnologia", 
      after: "Domina +5 ferramentas", 
      icon: Brain,
      description: "ChatGPT, Freepik, Lovable, Manus, Claude, Eleven Labs e Abacus na ponta dos dedos"
    },
    { 
      before: "Renda estagnada", 
      after: "Múltiplas fontes de renda", 
      icon: TrendingUp,
      description: "Renda extra que pode virar renda principal rapidamente"
    },
    { 
      before: "Trabalho manual repetitivo", 
      after: "Automação inteligente", 
      icon: Workflow,
      description: "Economize 20h por semana com automações que trabalham por você"
    }
  ];

  const targetAudience = [
    { text: "Profissionais 30+ que sentem que estão ficando para trás na tecnologia", icon: "👨‍💼" },
    { text: "CLTs que querem criar uma segunda fonte de renda usando IA", icon: "💼" },
    { text: "Autônomos que querem escalar seus serviços com automação", icon: "🚀" },
    { text: "Quem já tentou aprender IA sozinho mas achou complicado demais", icon: "🧠" }
  ];

  const testimonials = [
    {
      name: "Maria Silva",
      role: "Advogada",
      age: 42,
      city: "São Paulo, SP",
      photo: "👩‍⚖️",
      quote: "Eu tinha medo de tecnologia. Hoje faturo R$12k por mês só com serviços de IA para advogados. O Carlos explica de um jeito que qualquer um entende.",
      resultBefore: "R$4.000/mês",
      resultAfter: "R$12.000/mês",
      metric: "+200% de aumento"
    },
    {
      name: "João Pedro",
      role: "Contador",
      age: 38,
      city: "Rio de Janeiro, RJ",
      photo: "👨‍💼",
      quote: "Automatizei 80% das tarefas do escritório. Sobrou tempo para captar 3x mais clientes. Minha vida profissional mudou completamente.",
      resultBefore: "15h/semana em tarefas manuais",
      resultAfter: "Economizo 15h/semana",
      metric: "Triplicou a carteira de clientes"
    },
    {
      name: "Ana Lúcia",
      role: "Designer",
      age: 45,
      city: "Belo Horizonte, MG",
      photo: "👩‍🎨",
      quote: "Achava que IA ia me substituir. Aprendi a usar e agora entrego projetos 5x mais rápido. Virou meu diferencial competitivo.",
      resultBefore: "3 projetos/mês",
      resultAfter: "15 projetos/mês",
      metric: "5x mais produtividade"
    }
  ];

  const faqs = [
    {
      question: "Preciso ter conhecimento técnico para participar?",
      answer: "Absolutamente não! A imersão foi criada especialmente para pessoas que não são da área de tecnologia. Vamos do básico ao avançado de forma prática e didática. Se você sabe usar WhatsApp, você consegue acompanhar."
    },
    {
      question: "Como funciona a garantia?",
      answer: "Você tem 30 dias de garantia incondicional. Se em até 30 dias você não sentir que o conteúdo vai transformar sua vida profissional, devolvemos 100% do seu investimento, sem perguntas."
    },
    {
      question: "Terei acesso à gravação?",
      answer: "Sim! Além da imersão ao vivo, você terá acesso à gravação por 30 dias para revisar todo o conteúdo quando quiser."
    },
    {
      question: "Qual o horário da imersão?",
      answer: "A imersão acontece no sábado, 29 de março de 2026, das 09:00 às 15:00 (horário de Brasília), com intervalos programados."
    },
    {
      question: "Posso parcelar o investimento?",
      answer: "Sim! Você pode parcelar em até 12x no cartão de crédito. O valor promocional a partir de R$97 é válido apenas para esta turma."
    },
    {
      question: "Qual a diferença entre VIP e Premium?",
      answer: "O plano VIP inclui a imersão completa, gravação por 30 dias e materiais. O plano Premium adiciona uma Mentoria Online Individual para orientar seu caminho no empreendedorismo digital com IA, podendo começar a vender serviços de IA mesmo antes de ter aprendido tudo."
    }
  ];

  

  return (
    <>
      <MetaPixel />
      <Helmet>
        <title>Do VHS ao Prompt | Imersão de IA para Profissionais 30+</title>
        <meta name="description" content="Aprenda a faturar mais de R$10mil com renda extra utilizando IA. 6 horas de imersão ao vivo por apenas R$97. Mesmo sem ser 'tech'!" />
        <meta property="og:title" content="Do VHS ao Prompt | Imersão de IA para Profissionais 30+" />
        <meta property="og:description" content="6 horas de imersão ao vivo que vão te mostrar como sair da obsolescência profissional usando IA" />
        <meta property="og:type" content="website" />
      </Helmet>

      <VHSLeadPopup 
        isOpen={isPopupOpen} 
        onClose={() => setIsPopupOpen(false)}
        onSuccess={handlePopupSuccess}
      />

      {/* Sticky Bar */}
      <StickyBar checkoutUrl={checkoutUrlVIP} targetDate={eventDate} />

      <div className="min-h-screen bg-carbon text-white overflow-x-hidden relative">
        {/* Lightweight Background - CSS only */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(250,200,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(250,200,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        </div>

        {/* Hero Section with Background Photo */}
        <section className="relative min-h-screen flex items-center justify-center px-2 sm:px-4 py-16 sm:py-18 md:py-24 pb-20 md:pb-24">
          {/* Background image as <img> for LCP optimization */}
          <img 
            src={heroPhoto}
            alt="Carlos Eduardo - Expert em IA"
            className="absolute inset-0 w-full h-full object-cover object-top"
            loading="eager"
            fetchPriority="high"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(250,200,0,0.1),transparent_60%)]" />
          
          <div className="relative z-10 max-w-6xl mx-auto w-full">
            <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-center">
              {/* Left Content - Takes 3 columns */}
              <div className="lg:col-span-3 text-center lg:text-left px-2 sm:px-0">

                {/* Main Headline - DO VHS AO PROMPT */}
                <div className="animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                  <div className="mb-4 sm:mb-6 flex flex-col items-center lg:items-start">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-yellow/80 mb-3 sm:mb-4" style={{ textShadow: '0 0 20px rgba(250,200,0,0.5), 0 4px 15px rgba(0,0,0,0.5)' }}>
                      Imersão
                    </h1>
                    <img 
                      src={vhsLogo} 
                      alt="Do VHS ao Prompt" 
                      className="w-36 sm:w-44 md:w-52 lg:w-60 drop-shadow-[0_4px_20px_rgba(250,200,0,0.4)]"
                    />
                  </div>
                  
                  <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white leading-tight mb-4 sm:mb-6 px-2 sm:px-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                    Aprenda a faturar mais de{' '}
                    <span className="text-yellow font-black">R$10mil</span>{' '}
                    com <span className="text-yellow font-black">renda extra</span> utilizando{' '}
                    <span className="text-yellow">IA</span>
                  </h2>
                </div>

                {/* Manifesto */}
                <div className="animate-fade-in mb-4 sm:mb-6" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                  <p className="text-sm sm:text-base md:text-lg text-yellow/90 font-semibold italic leading-relaxed max-w-2xl mx-auto lg:mx-0 px-2 sm:px-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                    "Domine as ferramentas que menos de 0,0001% no mundo estão usando para criar novas fontes de renda e automatizar o que te rouba tempo."
                  </p>
                </div>

                {/* Inimigo comum + Mecanismo único */}
                <div className="animate-fade-in space-y-3 mb-6 sm:mb-8" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
                  <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl mx-auto lg:mx-0 px-2 sm:px-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                    Não ter opções para aumentar a renda sem sacrificar saúde, família e dinheiro — ou agora você pode também ser o funcionário com o salário mais alto da empresa.
                  </p>
                  <p className="text-sm sm:text-base text-white/90 font-medium leading-relaxed max-w-2xl mx-auto lg:mx-0 px-2 sm:px-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                    O evento <span className="text-yellow font-bold">"Do VHS ao Prompt"</span> é o seu divisor de águas. Ou você continua sendo o profissional que a IA vai substituir, ou se torna o estrategista que a IA vai obedecer.
                  </p>
                </div>

                {/* Badge - moved before CTA */}
                <div className="animate-fade-in inline-block mb-4 sm:mb-6" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                  <Badge className="bg-gradient-to-r from-yellow/30 to-yellow/10 text-yellow border-yellow/50 px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold shadow-lg shadow-yellow/20">
                    <span className="inline-flex items-center">
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 fill-yellow" />
                      IMERSÃO AO VIVO • 6 HORAS
                      <Flame className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                    </span>
                  </Badge>
                </div>

                {/* CTA Button */}
                <div className="animate-fade-in mb-4 sm:mb-6 px-2 sm:px-0" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
                  <div className="hover:scale-[1.03] active:scale-[0.98] transition-transform">
                    <Button
                      onClick={() => handleCTAClick('vip')}
                      className="w-full lg:w-auto bg-gradient-to-r from-yellow via-yellow-400 to-yellow text-carbon font-black text-sm sm:text-base md:text-lg lg:text-xl px-6 sm:px-8 md:px-12 py-5 sm:py-6 md:py-8 rounded-xl sm:rounded-2xl shadow-[0_0_50px_rgba(250,200,0,0.5)] border-2 border-yellow-300 hover:shadow-[0_0_70px_rgba(250,200,0,0.7)] transition-all duration-300 group"
                    >
                      <span className="flex items-center justify-center gap-2 sm:gap-3">
                        <span className="text-center leading-tight">QUERO MINHA LIBERDADE FINANCEIRA</span>
                        <Rocket className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform flex-shrink-0" />
                      </span>
                    </Button>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-1 sm:gap-2">
                    <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>🔒 Pagamento seguro • 30 dias de garantia • Acesso imediato</span>
                  </p>
                </div>

                {/* Event Info Pills */}
                <div className="animate-fade-in flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-3 px-2 sm:px-0" style={{ animationDelay: '0.7s', animationFillMode: 'both' }}>
                  <div className="flex items-center gap-1 sm:gap-2 bg-white/5 border border-white/10 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow" />
                    <span className="text-gray-300">Sáb, 29/03/2026 • 09h-15h</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 bg-white/5 border border-white/10 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-yellow" />
                    <span className="text-gray-300">100% Online e Ao Vivo</span>
                  </div>
                </div>
              </div>

              {/* Right Content - Expert Card (Takes 2 columns) */}
              <div className="lg:col-span-2 hidden lg:block animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                <div className="relative bg-carbon/80 backdrop-blur-sm border-2 border-yellow/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(250,200,0,0.2)] hover:scale-[1.02] transition-transform duration-300">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow/10 to-transparent rounded-3xl" />
                  
                  <div className="relative text-center">
                    <div className="w-20 h-20 bg-yellow rounded-full flex items-center justify-center mx-auto mb-4">
                      <Crown className="w-10 h-10 text-carbon" />
                    </div>
                    
                    <h3 className="font-bold text-white text-xl mb-1">Carlos Eduardo S. Souza</h3>
                    <p className="text-yellow text-sm flex items-center justify-center gap-1 mb-4">
                      <Sparkles className="w-4 h-4" />
                      Expert em Inteligência Artificial
                    </p>
                    
                    <div className="space-y-2 text-left text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>+500 alunos transformados</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Formado em Mecânica Industrial</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>7 anos rodando turno em Multinacional</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Fatura +R$1.500.000/ano como empresário</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>CEO: + que Vencedores & TuttiBelle Clinic</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Static floating elements (no infinite animation) */}
                <div className="absolute -top-4 -right-4 bg-yellow/20 backdrop-blur-md border border-yellow/30 rounded-2xl p-3">
                  <Brain className="w-8 h-8 text-yellow" />
                </div>
                
                <div className="absolute -bottom-4 -left-4 bg-yellow/20 backdrop-blur-md border border-yellow/30 rounded-2xl p-3">
                  <Lightbulb className="w-8 h-8 text-yellow" />
                </div>
              </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
              <ChevronDown className="w-8 h-8 text-yellow/50" />
            </div>
          </div>
        </section>

        {/* Countdown Section - Enhanced */}
        <section className="py-6 sm:py-8 md:py-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow/10 via-yellow/5 to-yellow/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(250,200,0,0.1),transparent_70%)]" />
          
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="animate-fade-in">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-4 sm:mb-6 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 inline" />
                ÚLTIMAS VAGAS DISPONÍVEIS
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2 inline" />
              </Badge>
              
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-6 sm:mb-8">
                ⏰ A imersão começa em:
              </h2>
              
              <EventCountdown targetDate={eventDate} showProgress={true} progressPercentage={87} />
              
              <div className="mt-6 sm:mt-8 space-y-2 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  <p className="text-red-400 font-bold text-sm sm:text-base">
                    ⚠️ Restam apenas 23 vagas neste lote promocional
                  </p>
                </div>
                <p className="text-gray-300 text-sm sm:text-base">
                  Junte-se a outros <span className="text-yellow font-bold">55 profissionais</span> que já estão garantindo sua vaga para não ficarem obsoletos em 2026.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Expert Section - Mobile */}
        <section className="py-6 px-3 sm:px-4 lg:hidden">
          <div className="max-w-md mx-auto animate-fade-in">
            <div className="relative bg-gradient-to-br from-yellow/20 to-transparent p-1 rounded-3xl">
              <img
                src={expertPhoto}
                alt="Carlos Eduardo - Expert em IA"
                className="w-full rounded-3xl"
                loading="lazy"
                decoding="async"
                width={400}
                height={500}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-carbon via-transparent to-transparent rounded-3xl" />
              
              <div className="absolute bottom-4 left-4 right-4 bg-carbon/90 backdrop-blur-xl border border-yellow/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow rounded-full flex items-center justify-center">
                    <Crown className="w-5 h-5 text-carbon" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Carlos Eduardo S. Souza</h3>
                    <p className="text-yellow text-sm flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Expert em IA
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Transformation Section */}
        <section className="py-6 sm:py-8 md:py-12 px-3 sm:px-4 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-yellow/5 to-transparent" />
          
          <div className="relative max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-10 px-2 animate-fade-in">
              <Badge className="bg-yellow/10 text-yellow border-yellow/30 mb-4 px-3 sm:px-4 py-1.5 sm:py-2 text-sm">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 inline" />
                TRANSFORMAÇÃO GARANTIDA
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black mb-3 sm:mb-4">
                <span className="text-white">De Onde </span>
                <span className="text-yellow">VOCÊ</span>
                <span className="text-white"> Está para Onde </span>
                <span className="text-yellow">VOCÊ VAI</span>
                <span className="text-white"> Chegar</span>
              </h2>
              <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
                Veja exatamente o que vai mudar na sua vida profissional após a imersão
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              {transformations.map((item, index) => (
                <div
                  key={index}
                  className="group animate-fade-in hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300"
                  style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                >
                  <Card className="bg-gradient-to-br from-carbon to-carbon/50 border-yellow/20 p-4 sm:p-6 md:p-8 h-full relative overflow-hidden hover:border-yellow/50 transition-all duration-500">
                    {/* Glow on hover */}
                    <div className="absolute inset-0 bg-yellow/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="relative">
                      {/* Icon */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-yellow/30 to-yellow/10 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                        <item.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow" />
                      </div>
                      
                      {/* Before/After */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
                        <div className="flex-1 w-full sm:w-auto">
                          <span className="text-xs text-gray-500 uppercase font-medium">Antes</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 flex-shrink-0" />
                            <span className="text-red-400 line-through text-sm sm:text-base md:text-lg">{item.before}</span>
                          </div>
                        </div>
                        
                        <div className="hidden sm:block">
                          <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-yellow" />
                        </div>
                        
                        <div className="flex-1 w-full sm:w-auto sm:text-right">
                          <span className="text-xs text-gray-500 uppercase font-medium">Depois</span>
                          <div className="flex items-center gap-2 mt-1 sm:justify-end">
                            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 flex-shrink-0 sm:hidden" />
                            <span className="text-green-400 font-bold text-sm sm:text-base md:text-lg">{item.after}</span>
                            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500 flex-shrink-0 hidden sm:block" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Description */}
                      <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-6 sm:py-8 md:py-12 px-3 sm:px-4 relative overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-10 px-2 animate-fade-in">
              <Badge className="bg-yellow/10 text-yellow border-yellow/30 mb-4 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                6 HORAS DE PURO CONTEÚDO PRÁTICO
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-3 sm:mb-4">
                O Que Você Vai{' '}
                <span className="text-yellow">Dominar</span>
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base md:text-lg">
                Habilidades que 99,999% dos brasileiros ainda não têm — e que vão te colocar à frente
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="animate-fade-in hover:scale-[1.02] transition-transform duration-300"
                  style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                >
                  <Card className={`bg-gradient-to-br from-carbon via-carbon/80 to-carbon/50 border-yellow/20 p-4 sm:p-6 md:p-8 hover:border-yellow/50 transition-all duration-500 h-full relative group overflow-hidden ${benefit.isSecret ? 'border-yellow/40' : ''}`}>
                    {/* Background glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* Secret badge for first item - static */}
                    {benefit.isSecret && (
                      <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                        <Badge className="bg-red-500/30 text-red-400 border-red-500/50 text-xs">
                          🤫 CONFIDENCIAL
                        </Badge>
                      </div>
                    )}
                    
                    <div className="relative flex flex-col sm:flex-row items-start gap-3 sm:gap-5">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-yellow/30 to-yellow/10 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <benefit.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-white pr-2">
                            ✓ {benefit.title}
                          </h3>
                        </div>
                        <p className="text-gray-400 mb-3 text-xs sm:text-sm md:text-base">
                          {benefit.description}
                        </p>
                        <Badge className={`text-xs sm:text-sm ${benefit.isSecret ? 'bg-yellow/20 text-yellow border-yellow/40' : 'bg-green-500/20 text-green-400 border-green-500/30'}`}>
                          {benefit.highlight}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bônus por Lote */}
        <section className="py-4 sm:py-6 md:py-8 px-3 sm:px-4">
          <div className="max-w-3xl mx-auto">
            <div className="animate-fade-in">
              <Card className="bg-gradient-to-br from-carbon via-carbon/90 to-carbon/70 border-2 border-yellow/40 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-yellow/10 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-yellow/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-7 h-7 sm:w-8 sm:h-8 text-yellow" />
                  </div>
                  <Badge className="bg-yellow/20 text-yellow border-yellow/40 mb-4 px-4 py-2 text-sm font-bold">
                    🎁 BÔNUS EXCLUSIVO POR LOTE
                  </Badge>
                  <p className="text-gray-200 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto">
                    Os primeiros <span className="text-yellow font-bold">80 inscritos</span> receberão ticket para{' '}
                    <span className="text-white font-semibold">perguntas e respostas no dia da imersão</span> + {' '}
                    <span className="text-yellow font-bold">Acesso à Comunidade + que Vencedores</span>
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Social Proof Section with Video */}
        <section className="py-6 sm:py-8 px-3 sm:px-4 bg-gradient-to-b from-yellow/5 to-transparent relative">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-12 px-2 animate-fade-in">
              <Badge className="bg-yellow/10 text-yellow border-yellow/30 mb-4 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                RESULTADOS COMPROVADOS
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                Veja Quem Já <span className="text-yellow">Transformou</span> a Carreira
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base md:text-lg">
                Histórias reais de profissionais que saíram do zero e hoje faturam com IA
              </p>
            </div>

            {/* YouTube Shorts Video Embed - Autoplay on scroll */}
            <div className="flex justify-center mb-8 sm:mb-12 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              <div className="w-[260px] sm:w-[300px] rounded-2xl overflow-hidden border-2 border-yellow/30 shadow-[0_0_30px_rgba(250,200,0,0.15)]">
                <div className="aspect-[9/16]">
                  <VideoAutoplay />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {testimonials.map((testimonial, index) => (
                <TestimonialCard
                  key={index}
                  {...testimonial}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Target Audience Section */}
        <section className="py-6 sm:py-8 md:py-12 px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8 px-2 animate-fade-in">
              <Badge className="bg-yellow/10 text-yellow border-yellow/30 mb-4 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                PARA QUEM É
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-3 sm:mb-4">
                Essa Imersão é <span className="text-yellow">Para Você</span> Se...
              </h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {targetAudience.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 bg-gradient-to-r from-carbon/80 to-carbon/50 border border-yellow/10 rounded-xl sm:rounded-2xl hover:border-yellow/30 hover:translate-x-2 transition-all group animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}
                >
                  <span className="text-2xl sm:text-3xl group-hover:scale-125 transition-transform flex-shrink-0">{item.icon}</span>
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow flex-shrink-0" />
                  <p className="text-gray-200 text-sm sm:text-base md:text-lg">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mega CTA Section - Duas Ofertas */}
        <section id="pricing-section" className="py-6 sm:py-8 md:py-12 px-3 sm:px-4 relative overflow-hidden">
          {/* Static background */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow/20 via-yellow/5 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[400px] md:w-[600px] h-[300px] sm:h-[400px] md:h-[600px] bg-yellow/20 rounded-full blur-3xl opacity-30" />
          
          <div className="relative max-w-5xl mx-auto">
            <div className="text-center mb-8 sm:mb-12 animate-fade-in">
              <Badge className="bg-gradient-to-r from-red-500/30 to-red-500/10 text-red-400 border-red-500/50 mb-4 sm:mb-6 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 inline" />
                PROMOÇÃO DE LANÇAMENTO
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2 inline" />
              </Badge>
              
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-3 sm:mb-4">
                Escolha Seu Acesso
              </h2>
              <p className="text-gray-400 text-sm sm:text-base md:text-lg">
                Dois caminhos para transformar sua carreira com IA
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
              {/* VIP Plan */}
              <div className="relative animate-fade-in hover:scale-[1.02] transition-transform duration-300" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                <Card className="bg-gradient-to-br from-carbon via-carbon/95 to-carbon/90 border-2 border-yellow/30 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 h-full">
                  <div className="text-center mb-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">VIP</h3>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-gray-500 line-through text-base sm:text-lg">De R$ 297</span>
                      <span className="text-yellow font-black text-4xl sm:text-5xl">
                        R$ 97
                      </span>
                      <span className="text-gray-400 text-sm">ou 12x de R$ 9,70</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {[
                      "Imersão ao vivo (6 horas)",
                      "Gravação por 30 dias",
                      "Materiais exclusivos",
                      "Framework Prompt Lucrativo",
                      "Certificado de participação"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-gray-300 text-sm sm:text-base">
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="hover:scale-[1.02] active:scale-[0.98] transition-transform">
                    <Button
                      onClick={() => handleCTAClick('vip')}
                      className="w-full bg-gradient-to-r from-yellow via-yellow-400 to-yellow text-carbon font-black text-base sm:text-lg py-5 sm:py-6 rounded-xl shadow-[0_0_30px_rgba(250,200,0,0.4)] border-2 border-yellow-200 hover:shadow-[0_0_50px_rgba(250,200,0,0.6)] transition-all"
                    >
                      <span className="flex items-center justify-center gap-2">
                        QUERO MINHA LIBERDADE FINANCEIRA
                        <Rocket className="w-5 h-5" />
                      </span>
                    </Button>
                  </div>
                </Card>
              </div>

              {/* PREMIUM Plan */}
              <div className="relative animate-fade-in hover:scale-[1.02] transition-transform duration-300" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                {/* Best Value Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-yellow to-yellow-400 text-carbon font-bold px-4 py-1 text-xs sm:text-sm shadow-lg">
                    <Crown className="w-3 h-3 sm:w-4 sm:h-4 mr-1 inline" />
                    MAIS ESCOLHIDO
                  </Badge>
                </div>
                
                <Card className="bg-gradient-to-br from-carbon via-carbon/95 to-carbon/90 border-2 border-yellow rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 h-full shadow-[0_0_40px_rgba(250,200,0,0.2)]">
                  <div className="text-center mb-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-yellow mb-2">PREMIUM</h3>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-gray-500 line-through text-base sm:text-lg">De R$ 397</span>
                      <span className="text-yellow font-black text-4xl sm:text-5xl">
                        R$ 127
                      </span>
                      <span className="text-gray-400 text-sm">ou 12x de R$ 12,70</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {[
                      "Tudo do Plano VIP",
                      "Mentoria Online Individual",
                      "Orientação personalizada para empreender",
                      "Comece a vender IA mesmo antes de aprender tudo",
                      "Suporte prioritário por 30 dias"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-gray-300 text-sm sm:text-base">
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow flex-shrink-0" />
                        <span className={i === 0 ? "font-bold text-yellow" : ""}>{item}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="hover:scale-[1.02] active:scale-[0.98] transition-transform">
                    <Button
                      onClick={() => handleCTAClick('premium')}
                      className="w-full bg-gradient-to-r from-yellow via-yellow-400 to-yellow text-carbon font-black text-base sm:text-lg py-5 sm:py-6 rounded-xl shadow-[0_0_50px_rgba(250,200,0,0.5)] border-2 border-yellow-200 hover:shadow-[0_0_80px_rgba(250,200,0,0.7)] transition-all"
                    >
                      <span className="flex items-center justify-center gap-2">
                        QUERO MINHA LIBERDADE FINANCEIRA
                        <Crown className="w-5 h-5" />
                      </span>
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-gray-500 mt-6 sm:mt-8 text-center flex flex-wrap items-center justify-center gap-1 sm:gap-2">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>🔒 Pagamento seguro • 30 dias de garantia • Acesso imediato</span>
            </p>
          </div>
        </section>

        {/* Guarantee Section */}
        <section className="py-6 sm:py-8 md:py-10 px-3 sm:px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-green-500/10 to-transparent border-2 border-green-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 text-center relative overflow-hidden animate-fade-in">
              {/* Static blob */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/10 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Shield className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-green-500" />
                </div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-3 sm:mb-4">
                  Garantia Incondicional de 30 Dias
                </h3>
                <p className="text-gray-300 max-w-xl mx-auto text-sm sm:text-base md:text-lg">
                  Se em até 30 dias você não sentir que este conteúdo vai transformar sua vida profissional, 
                  devolvemos <span className="text-green-400 font-bold">100% do seu investimento</span>, 
                  sem perguntas e sem burocracia.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-6 sm:py-8 md:py-12 px-3 sm:px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-6 sm:mb-8 animate-fade-in">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
                Perguntas <span className="text-yellow">Frequentes</span>
              </h2>
            </div>

            <Accordion type="single" collapsible className="space-y-3 sm:space-y-4">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}
                >
                  <AccordionItem 
                    value={`item-${index}`}
                    className="bg-carbon/50 border border-yellow/10 rounded-lg sm:rounded-xl px-4 sm:px-6 data-[state=open]:border-yellow/40 transition-colors"
                  >
                    <AccordionTrigger className="text-left text-white hover:text-yellow transition-colors py-4 sm:py-5 text-sm sm:text-base md:text-lg">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-400 pb-4 sm:pb-5 text-sm sm:text-base">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-6 sm:py-8 px-3 sm:px-4 border-t border-yellow/10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="animate-fade-in">
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-4 sm:mb-6 px-2">
                O futuro pertence a quem domina a <span className="text-yellow">Inteligência Artificial</span>
              </h2>
              <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base md:text-lg">
                Não seja substituído pela IA. Seja quem usa ela para crescer.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <div className="hover:scale-[1.03] active:scale-[0.98] transition-transform">
                  <Button
                    onClick={() => handleCTAClick('vip')}
                    className="w-full sm:w-auto bg-gradient-to-r from-yellow via-yellow-400 to-yellow text-carbon font-black text-sm sm:text-base md:text-lg px-6 sm:px-10 py-5 sm:py-6 rounded-xl shadow-[0_0_40px_rgba(250,200,0,0.4)] border-2 border-yellow-300 hover:shadow-[0_0_60px_rgba(250,200,0,0.6)] transition-all duration-300"
                  >
                    <span className="flex items-center justify-center gap-2">
                      VIP R$97
                      <Rocket className="w-5 h-5 flex-shrink-0" />
                    </span>
                  </Button>
                </div>
                
                <div className="hover:scale-[1.03] active:scale-[0.98] transition-transform">
                  <Button
                    onClick={() => handleCTAClick('premium')}
                    className="w-full sm:w-auto bg-gradient-to-r from-yellow via-yellow-400 to-yellow text-carbon font-black text-sm sm:text-base md:text-lg px-6 sm:px-10 py-5 sm:py-6 rounded-xl shadow-[0_0_40px_rgba(250,200,0,0.4)] border-2 border-yellow-300 hover:shadow-[0_0_60px_rgba(250,200,0,0.6)] transition-all duration-300"
                  >
                    <span className="flex items-center justify-center gap-2">
                      PREMIUM R$127 + Mentoria
                      <Crown className="w-5 h-5 flex-shrink-0" />
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-4 sm:py-6 px-3 sm:px-4 border-t border-white/5 text-center text-gray-500 text-xs sm:text-sm">
          <p>© 2026 + que Vencedores - Todos os direitos reservados</p>
          <p className="mt-1 sm:mt-2">CNPJ: XX.XXX.XXX/0001-XX</p>
        </footer>
      </div>
    </>
  );
};

export default VHSaoPrompt;
