import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  MapPin,
  Clock,
  Users,
  Award,
  Flame,
  Zap,
  Play,
  Coffee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Marquee } from '@/components/ui/marquee';
import TeamShowcase, { TeamMember } from '@/components/ui/team-showcase';
import { MetaPixel, trackEvent } from '@/components/tracking/MetaPixel';
import { getCheckoutUrl } from '@/lib/masterclass-checkout';
import { MasterclassLeadPopup } from '@/components/masterclass/MasterclassLeadPopup';
import carlosEventoPhoto from '@/assets/carlos-evento-palco.jpg';
import carlosFullstackPhoto from '@/assets/carlos-fullstack-ia.jpg';
import alessandroPhoto from '@/assets/empresarios/alessandro-gomes.avif';
import kleisonPhoto from '@/assets/empresarios/kleison-melo.jpg';
import jefersonPhoto from '@/assets/empresarios/jeferson-carlos.jpg';
import isaacPhoto from '@/assets/empresarios/isaac-santos.jpg';
import pedroPhoto from '@/assets/empresarios/pedro-azevedo.jpg';
import keilerPhoto from '@/assets/empresarios/keiler-lobo.jpg';
import julianaPhoto from '@/assets/empresarios/juliana-mafra.jpg';
import anaKarinyPhoto from '@/assets/empresarios/ana-kariny.jpg';

const PROFISSOES_FAIXA = [
  'Clínicas', 'Advocacia', 'Contabilidade', 'Odontologia', 'Psicologia',
  'Arquitetura', 'E-commerce', 'Consultorias', 'Nutrição', 'Imobiliárias',
  'Agências', 'Coaches', 'Engenharia', 'Varejo', 'Tricologia',
];

const PILARES = [
  {
    n: '01',
    title: 'CRM AI First',
    description:
      'Qualifica o lead, agenda a call, faz follow-up e prepara o vendedor para o fechamento. Tudo automático, 24 horas por dia.',
  },
  {
    n: '02',
    title: 'Prospecção Ativa com IA',
    description:
      'Captura, segmenta e aborda o cliente ideal em escala. Mensagem personalizada por IA no ritmo da conversão.',
  },
  {
    n: '03',
    title: 'IA de Atendimento 24/7',
    description:
      'Responde, qualifica e encaminha pelo WhatsApp. Quem não tem está perdendo venda todo dia. Simples assim.',
  },
];

// As 3 partes do workshop (arco/promessa do conteúdo).
const WORKSHOP_PARTES = [
  { n: '01', title: 'Por que a maioria das pessoas não faz dinheiro com IA' },
  { n: '02', title: '7 formas de fazer R$ 15 a R$ 100k por mês com IA' },
  { n: '03', title: 'Como faturar de R$ 15 a R$ 100k por mês com IA' },
];

// Agenda das 5 horas. Início pontual 8h, encerramento previsto 13h. Ajuste os horários conforme o roteiro final.
const AGENDA: { time: string; title: string; desc?: string; break?: boolean }[] = [
  { time: '08:00', title: 'Credenciamento e boas-vindas', desc: 'Check-in e networking com empresários da região.' },
  { time: '10:00', title: 'Pausa para banheiro, lanche e hidratação', break: true },
  { time: '10:20', title: 'Aplicação real da IA nos negócios', desc: 'Demonstração ao vivo da plataforma + que Vencedores, do lead frio ao fechamento, com IA em cada etapa.' },
  { time: '13:00', title: 'Encerramento', desc: 'Seu plano pra implementar IA no negócio nos próximos 90 dias.' },
];

// Vídeo da seção "Na Prática". Cole um link do YouTube/Vimeo OU a URL de um .mp4.
// Deixe src: '' pra mostrar só a capa com "prévia em breve" (sem quebrar layout).
const PRACTICE_VIDEO: { src: string; poster: string } = {
  src: 'https://youtu.be/1YEqU8kffV0',
  poster: 'https://img.youtube.com/vi/1YEqU8kffV0/maxresdefault.jpg',
};

// Resolve o src do vídeo pra um embed (YouTube/Vimeo) ou arquivo (.mp4).
function resolveVideoEmbed(src: string): { kind: 'iframe' | 'file'; url: string } | null {
  if (!src) return null;
  const yt = src.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt) return { kind: 'iframe', url: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1` };
  const vimeo = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: 'iframe', url: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(src)) return { kind: 'file', url: src };
  return { kind: 'iframe', url: src };
}

// Player "facade": só carrega o vídeo no clique. Zero bytes de vídeo no load da página.
const PracticeVideoFacade: React.FC = () => {
  const [playing, setPlaying] = useState(false);
  const embed = resolveVideoEmbed(PRACTICE_VIDEO.src);
  const hasVideo = !!embed;

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* glow dourado por tras do player */}
      <div className="absolute -inset-2 bg-gradient-to-r from-yellow/20 via-yellow/[0.06] to-yellow/20 rounded-[32px] blur-2xl opacity-60" />

      <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-yellow/30 bg-black shadow-[0_24px_90px_-24px_rgba(250,200,0,0.45)]">
        {playing && embed ? (
          embed.kind === 'file' ? (
            <video src={embed.url} className="w-full h-full object-cover" controls autoPlay playsInline />
          ) : (
            <iframe
              src={embed.url}
              title="O que você vai ver na prática"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => hasVideo && setPlaying(true)}
            className="group absolute inset-0 w-full h-full text-left cursor-pointer disabled:cursor-default"
            aria-label={hasVideo ? 'Assistir à demonstração' : 'Prévia em breve'}
            disabled={!hasVideo}
          >
            {PRACTICE_VIDEO.poster && (
              <img
                src={PRACTICE_VIDEO.poster}
                alt="Prévia da Masterclass IA"
                className="w-full h-full object-cover scale-[1.01] group-hover:scale-105 transition-transform duration-[1200ms] ease-out"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  if (e.currentTarget.src !== carlosFullstackPhoto) e.currentTarget.src = carlosFullstackPhoto;
                }}
              />
            )}
            {/* escurecimento e vinheta pra dar contraste */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/30" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />

            {/* selo superior */}
            <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white/90 text-[10px] font-bold uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Momentos reais
            </div>

            {/* botao de play com aneis pulsantes */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="relative flex items-center justify-center">
                {hasVideo && (
                  <>
                    <motion.span
                      className="absolute w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-yellow/30"
                      animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <motion.span
                      className="absolute w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-yellow/20"
                      animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 1.2 }}
                    />
                  </>
                )}
                <span className="relative flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-[#3B82F6] text-black shadow-[0_8px_44px_-4px_rgba(250,200,0,0.75)] group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-7 h-7 lg:w-8 lg:h-8 ml-1 fill-black" />
                </span>
              </span>
            </div>

            {/* legenda de conversao na base */}
            <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-7">
              <p className="text-white font-extrabold text-lg lg:text-2xl leading-tight tracking-tight mb-1">
                {hasVideo ? 'Experiências vividas em nossa Masterclass' : 'Prévia em breve'}
              </p>
              <p className="text-white/60 text-[13px] lg:text-[15px] leading-snug max-w-md">
                {hasVideo ? 'Toque para assistir.' : 'O vídeo entra aqui assim que estiver pronto.'}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

const EMPRESARIOS_SQUAAD: TeamMember[] = [
  { id: '1', name: 'Kleison Melo', role: 'Empresário e Mentor', initials: 'KM', image: kleisonPhoto, imagePosition: 'center 18%' },
  { id: '2', name: 'Alessandro Gomes', role: 'Imobiliária Gomes e Souza', initials: 'AG', image: alessandroPhoto, imagePosition: 'center 22%' },
  { id: '3', name: 'Isaac Santos', role: 'Especialista em PNL', initials: 'IS', image: isaacPhoto, imagePosition: 'center 20%' },
  { id: '4', name: 'Jeferson Carlos', role: 'Shine RH', initials: 'JC', image: jefersonPhoto, imagePosition: 'center 18%' },
  { id: '5', name: 'Keiler Lobo', role: 'Treinador de Líderes', initials: 'KL', image: keilerPhoto, imagePosition: 'center 18%' },
  { id: '6', name: 'Juliana Mafra e Alexandre', role: 'Convites Feito à Mão', initials: 'JM', image: julianaPhoto, imagePosition: 'center 28%' },
  { id: '7', name: 'Ana Kariny', role: 'Tricologista e Mentora', initials: 'AK', image: anaKarinyPhoto, imagePosition: 'center 22%' },
  { id: '8', name: 'Pedro Azevedo', role: 'Instrumentador Cirúrgico', initials: 'PA', image: pedroPhoto, imagePosition: 'center 25%' },
];

const FAQS = [
  {
    q: 'Preciso ter conhecimento técnico?',
    a: 'Zero. Você não vai programar nada.',
  },
  {
    q: 'Onde é o evento e como chego?',
    a: 'O evento é presencial em Feira de Santana, BA, no dia 25 de julho (sábado), com início pontual às 8h da manhã. O endereço completo do local é enviado por WhatsApp e e-mail a todos os inscritos assim que a turma é confirmada. Local com estacionamento e fácil acesso.',
  },
  {
    q: 'Funciona para o meu nicho?',
    a: 'Clínicas, advocacia, contabilidade, imobiliário, e-commerce, agências, consultorias, varejo, mentoria. O método se adapta a qualquer negócio com vendas consultivas, B2B ou B2C.',
  },
  {
    q: 'E se eu comprar e não puder ir?',
    a: 'A próxima turma não tem data confirmada. Se não puder comparecer, entre em contato antes do evento. Mas sinceramente: se IA é prioridade pra você, esteja lá.',
  },
  {
    q: 'Como funciona a garantia?',
    a: 'Garantia incondicional até o fim da Masterclass. Participou e sentiu que o método não vai transformar sua operação? 100% devolvido, sem perguntas.',
  },
  {
    q: 'Posso parcelar?',
    a: 'Sim. Até 10x no cartão. No Pix sai R$ 47 à vista.',
  },
];

const EVENT_DATE = new Date('2026-07-25T08:00:00-03:00');

function useCountdown() {
  const calc = useCallback(() => {
    const now = new Date().getTime();
    const diff = EVENT_DATE.getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false,
    };
  }, []);

  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);
  return time;
}

const MASTERCLASS_BOARD_ID = '99bc8808-c191-4dd5-b120-67107005044c';

function useMasterclassCount() {
  const [count, setCount] = useState<number>(0);
  const prevCount = useRef(0);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    supabase.rpc('get_masterclass_lead_count').then(({ data }) => {
      if (typeof data === 'number') {
        setCount(data);
        prevCount.current = data;
      }
    });

    const channel = supabase
      .channel('masterclass-leads-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_leads',
          filter: `board_id=eq.${MASTERCLASS_BOARD_ID}`,
        },
        () => {
          setCount((c) => {
            const next = c + 1;
            prevCount.current = c;
            return next;
          });
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 2000);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { count, justUpdated };
}

const MasterclassIA = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupShown, setPopupShown] = useState(() => sessionStorage.getItem('mc_popup') === '1');
  const [showStickyBar, setShowStickyBar] = useState(false);
  const countdown = useCountdown();
  const { count: leadCount, justUpdated: leadJustUpdated } = useMasterclassCount();
  const pricingRef = useRef<HTMLElement | null>(null);
  const addToCartFired = useRef(false);

  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: 'Masterclass IA - Landing',
      content_category: 'Masterclass IA',
      value: 47,
      currency: 'BRL',
    });
  }, []);

  // AddToCart: usuario rolou ate a oferta/preco = sinal de consideracao (dispara 1x)
  useEffect(() => {
    const el = pricingRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !addToCartFired.current) {
          addToCartFired.current = true;
          trackEvent('AddToCart', {
            content_name: 'Masterclass IA - Oferta vista',
            content_category: 'Masterclass IA',
            value: 47,
            currency: 'BRL',
          });
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (popupShown) return;
    const timer = setTimeout(() => {
      setShowPopup(true);
      setPopupShown(true);
      sessionStorage.setItem('mc_popup', '1');
    }, 1500);
    return () => clearTimeout(timer);
  }, [popupShown]);

  useEffect(() => {
    if (popupShown) return;
    const handler = (e: MouseEvent) => {
      if (e.clientY <= 5) {
        setShowPopup(true);
        setPopupShown(true);
        sessionStorage.setItem('mc_popup', '1');
      }
    };
    document.addEventListener('mouseleave', handler);
    return () => document.removeEventListener('mouseleave', handler);
  }, [popupShown]);

  useEffect(() => {
    const handler = () => setShowStickyBar(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const goToCheckout = () => {
    // InitiateCheckout e disparado pelo pixel do Kirvano na pagina de pagamento
    // (evita contagem dupla). Aqui so redireciona.
    window.location.href = getCheckoutUrl();
  };

  return (
    <>
      <MetaPixel />
      <Helmet>
        <title>Masterclass IA para Negócios · 25 de Julho · Feira de Santana</title>
        <meta
          name="description"
          content="Como aumentar seu faturamento de R$15k a R$100k/mês com Inteligência Artificial. Masterclass presencial em Feira de Santana, 25 de julho. Vagas limitadas."
        />
        <meta property="og:title" content="Masterclass IA para Negócios · + que Vencedores" />
        <meta
          property="og:description"
          content="Método presencial com CRM AI First, Prospecção Ativa e IA de Atendimento. Feira de Santana, 25 de julho."
        />
        <meta property="og:type" content="website" />
        <link rel="preload" as="image" href={carlosEventoPhoto} />
      </Helmet>

      <MasterclassLeadPopup isOpen={showPopup} onClose={() => setShowPopup(false)} leadCount={leadCount} />

      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#0a0a0a]/95 backdrop-blur-md border-t border-yellow/30 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">Masterclass IA</p>
                <p className="text-yellow text-xs font-semibold">R$ 47 · Lote Promocional</p>
              </div>
              <Button
                onClick={goToCheckout}
                className="bg-[#3B82F6] hover:bg-[#FFD61F] text-black font-bold text-sm px-5 py-3 rounded-full border-0 flex-shrink-0"
              >
                Garantir vaga
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-display antialiased selection:bg-yellow selection:text-black">

        {/* ───────── HERO (texto no escuro + video com auditorio nitido atras) ───────── */}
        <section className="relative min-h-[92vh] flex items-center px-6 lg:px-12 py-16 lg:py-24 overflow-hidden bg-[#0a0a0a]">
          {/* fundo escuro solido: glow dourado + grid sutil (sem foto atras do texto) */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(250,200,0,0.13),transparent_70%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(250,200,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(250,200,0,0.02)_1px,transparent_1px)] bg-[size:64px_64px] opacity-50" />
          </div>

          <div className="relative max-w-5xl mx-auto w-full text-center z-10">
            {/* badges */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-2 mb-7"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 text-[11px] font-semibold uppercase tracking-[0.2em]">
                <Flame className="w-3.5 h-3.5 animate-pulse" />
                Lote promocional
              </span>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-yellow/30 bg-yellow/5 text-yellow text-[11px] font-semibold uppercase tracking-[0.2em]">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow animate-pulse" />
                25 de julho · 8h · Feira de Santana
              </span>
            </motion.div>

            {/* headline grande, arejada, sobre o escuro */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="text-[2.1rem] sm:text-5xl lg:text-[3.6rem] font-extrabold leading-[1.16] tracking-[-0.015em] mb-9 max-w-4xl mx-auto"
            >
              Como aumentar seu faturamento de{' '}
              <span className="text-yellow">R$ 15k a R$ 100k por mês</span>{' '}
              com{' '}
              <span className="font-editorial italic font-normal text-yellow">Inteligência Artificial</span>
            </motion.h1>

            {/* faixa do video: auditorio NITIDO atras, ocupando a largura toda, sumindo nas bordas */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative mb-10"
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-screen max-w-[1800px] overflow-hidden pointer-events-none rounded-3xl">
                <img
                  src={carlosEventoPhoto}
                  alt="Carlos Eduardo na Masterclass IA presencial, sala lotada de empresários em Feira de Santana"
                  className="w-full h-full object-cover object-[center_42%]"
                  loading="eager"
                  width={2048}
                  height={1365}
                  decoding="async"
                />
                <div className="absolute inset-0 bg-[#0a0a0a]/35" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/10 to-[#0a0a0a]" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-transparent to-[#0a0a0a]/60" />
              </div>
              <div className="relative max-w-3xl mx-auto">
                <PracticeVideoFacade />
              </div>
            </motion.div>

            {/* texto descritivo, sobre o escuro (leitura limpa) */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-lg lg:text-xl text-white/80 leading-relaxed mb-4 max-w-2xl mx-auto"
            >
              O mesmo <strong className="text-white">método</strong> que gerou <strong className="text-yellow">+R$ 10 milhões em faturamento</strong> para empresas em 2025. Presencialmente, em Feira de Santana, aplicado ao seu negócio.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-base lg:text-lg text-white/55 leading-relaxed mb-9 max-w-2xl mx-auto"
            >
              5 horas. Hands-on. Sem programar. Você sai com o caminho claro pra faturar com IA nos próximos 90 dias.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex flex-col items-center gap-3"
            >
              <Button
                onClick={goToCheckout}
                className="group bg-[#3B82F6] hover:bg-[#FFD61F] text-black font-extrabold text-base px-8 py-6 rounded-full shadow-[0_8px_32px_-4px_rgba(250,200,0,0.45)] hover:shadow-[0_12px_40px_-4px_rgba(250,200,0,0.7)] hover:scale-[1.02] transition-all border-0"
              >
                GARANTIR MINHA VAGA POR R$ 47
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <span className="text-white/40 text-xs">ou 10x de R$ 5,56</span>
            </motion.div>

            {/* prova rapida */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-white/65">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-yellow" /> +R$ 10M gerados com IA em 2025</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-yellow" /> +40 empresas AI First</span>
                <span className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-yellow" /> Garantia incondicional</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 text-[13px] text-white/50">
                <span className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-yellow flex-shrink-0" />
                  Feira de Santana, BA · endereço enviado aos inscritos
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-yellow flex-shrink-0" />
                  25/07 (sáb) às 08:00
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ───────── COUNTDOWN + URGENCIA ───────── */}
        <section id="countdown-bar" className="border-y border-yellow/20 bg-gradient-to-r from-[#0a0a0a] via-yellow/[0.06] to-[#0a0a0a] py-5 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            {!countdown.expired ? (
              <>
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="font-semibold text-white">O evento começa em:</span>
                </div>
                <div className="flex items-center gap-3">
                  {[
                    { v: countdown.days, l: 'dias' },
                    { v: countdown.hours, l: 'hrs' },
                    { v: countdown.minutes, l: 'min' },
                    { v: countdown.seconds, l: 'seg' },
                  ].map((u) => (
                    <div key={u.l} className="flex flex-col items-center">
                      <span className="text-2xl sm:text-3xl font-extrabold text-yellow tabular-nums leading-none">
                        {String(u.v).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{u.l}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-yellow" />
                  <span className="text-white/70">
                    <motion.strong
                      key={leadCount}
                      initial={{ scale: 1.4, color: '#22c55e' }}
                      animate={{ scale: 1, color: '#3B82F6' }}
                      transition={{ duration: 0.6 }}
                      className="text-yellow inline-block"
                    >
                      {leadCount}
                    </motion.strong>
                    {' '}profissionais já confirmaram
                  </span>
                  {leadJustUpdated && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-green-400 text-xs font-bold"
                    >
                      +1 agora!
                    </motion.span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-yellow font-bold text-lg">O evento já começou!</p>
            )}
          </div>
        </section>

        {/* ───────── FAIXA PROFISSOES ───────── */}
        <section className="border-b border-white/5 bg-black py-5">
          <p className="text-center text-[10px] uppercase tracking-[0.4em] text-white/40 mb-3 font-medium">
            Profissionais que já estão faturando com IA
          </p>
          <Marquee className="[--duration:38s] [--gap:4rem]" repeat={3} pauseOnHover>
            {PROFISSOES_FAIXA.map((p) => (
              <span key={p} className="text-base font-medium text-white/70 whitespace-nowrap">
                {p}
              </span>
            ))}
          </Marquee>
        </section>

        {/* ───────── PILARES ───────── */}
        <section id="pilares" className="py-16 lg:py-20 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mb-12">
              <p className="inline-flex items-center gap-2.5 text-yellow text-[11px] uppercase tracking-[0.3em] font-semibold mb-4">
                <span className="h-px w-8 bg-yellow" /> O que você vai aprender
              </p>
              <h2 className="text-3xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight mb-5">
                Três pilares que <span className="font-editorial italic font-normal text-yellow">transformam faturamento</span>
              </h2>
              <p className="text-white/60 text-base lg:text-lg leading-relaxed max-w-2xl">
                Não é prompt. Não é ChatGPT. É infraestrutura de negócio gerando receita 24h por dia.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-yellow/15 rounded-2xl overflow-hidden border border-yellow/25">
              {PILARES.map((p) => (
                <div
                  key={p.n}
                  className="group bg-[#0a0a0a] p-7 lg:p-9 hover:bg-gradient-to-br hover:from-yellow/[0.04] hover:to-transparent transition-colors"
                >
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-yellow font-editorial italic text-3xl">{p.n}</span>
                    <span className="h-px flex-1 bg-white/10 group-hover:bg-yellow/40 transition-colors" />
                  </div>
                  <h3 className="text-xl lg:text-2xl font-bold mb-3 leading-tight">{p.title}</h3>
                  <p className="text-white/60 text-[15px] leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── WORKSHOP EM 3 PARTES ───────── */}
        <section id="workshop-3-partes" className="py-16 lg:py-20 px-6 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-center mb-10 lg:mb-12">
              Esse workshop em <span className="text-yellow">3 partes</span>
            </h2>
            <div className="space-y-4">
              {WORKSHOP_PARTES.map((p) => (
                <div
                  key={p.n}
                  className="group flex items-center gap-5 lg:gap-7 bg-[#0d0d0d] border border-white/10 border-l-[3px] border-l-yellow/60 rounded-2xl px-6 lg:px-8 py-6 hover:border-l-yellow hover:bg-yellow/[0.03] transition-colors"
                >
                  <span className="text-yellow font-extrabold text-3xl lg:text-4xl tabular-nums leading-none flex-shrink-0">
                    {p.n}
                  </span>
                  <h3 className="text-lg lg:text-2xl font-bold leading-tight">{p.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── AGENDA ───────── */}
        <section id="agenda" className="py-16 lg:py-20 px-6 lg:px-12 bg-gradient-to-b from-transparent via-yellow/[0.03] to-transparent">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <p className="inline-flex items-center gap-2.5 text-yellow text-[11px] uppercase tracking-[0.3em] font-semibold mb-4">
                <span className="h-px w-8 bg-yellow" /> Agenda da Masterclass
              </p>
              <h2 className="text-3xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight mb-4">
                Como serão as <span className="font-editorial italic font-normal text-yellow">5 horas</span>
              </h2>
              <p className="text-white/60 text-base lg:text-lg leading-relaxed">
                25 de julho, das 8h às 13h, em Feira de Santana. Início pontual, conteúdo prático do começo ao fim.
              </p>
            </div>

            <ol className="relative border-l border-white/10 pl-6 space-y-6">
              {AGENDA.map((item) => (
                <li key={item.time} className="relative">
                  <span
                    className={`absolute -left-[31px] flex items-center justify-center w-5 h-5 rounded-full border-2 ${
                      item.break ? 'bg-[#0a0a0a] border-white/30' : 'bg-yellow border-yellow'
                    }`}
                  >
                    {item.break && <Coffee className="w-2.5 h-2.5 text-white/60" />}
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <span className="text-yellow font-bold text-sm tabular-nums w-14 flex-shrink-0">{item.time}</span>
                    <div>
                      <h3 className={`font-bold leading-tight ${item.break ? 'text-white/55 text-[15px]' : 'text-white text-base lg:text-lg'}`}>
                        {item.title}
                      </h3>
                      {item.desc && <p className="text-white/50 text-[13px] lg:text-sm leading-relaxed mt-0.5">{item.desc}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <p className="text-white/35 text-xs mt-8 text-center">
              Programação sujeita a pequenos ajustes. O conteúdo aplicado é garantido.
            </p>
          </div>
        </section>

        {/* ───────── AUTORIDADE: CARLOS EDUARDO ───────── */}
        <section className="py-16 lg:py-20 px-6 lg:px-12 bg-gradient-to-b from-transparent via-yellow/[0.03] to-transparent">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <img
                  src={carlosFullstackPhoto}
                  alt="Carlos Eduardo - Full Stack AI Nível 5 - Premiado em Alphaville SP"
                  className="rounded-2xl w-full max-w-md mx-auto lg:max-w-none shadow-2xl shadow-yellow/10"
                  loading="lazy"
                  width={700}
                  height={1050}
                  decoding="async"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-yellow/30 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-yellow flex-shrink-0" />
                    <div>
                      <p className="text-yellow text-xs font-bold uppercase tracking-wider">Full Stack AI - Nível Máximo</p>
                      <p className="text-white/60 text-[11px]">Premiado em Alphaville, São Paulo - IAP</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <p className="inline-flex items-center gap-2.5 text-yellow text-[11px] uppercase tracking-[0.3em] font-semibold mb-4">
                  <span className="h-px w-8 bg-yellow" /> Quem vai te ensinar
                </p>
                <h2 className="text-3xl lg:text-4xl font-extrabold leading-[1.1] tracking-tight mb-5">
                  Carlos Eduardo
                </h2>

                <div className="space-y-4 text-white/75 text-base leading-relaxed">
                  <p>
                    Baiano, 32 anos, <strong className="text-white">empresário há mais de 15 anos</strong>. Proprietário de uma Clínica de Tricologia e Estética. Carlos não é guru de IA. É empresário que <strong className="text-white">usa IA no próprio negócio todos os dias</strong>.
                  </p>
                  <p>
                    Reconhecido e premiado em <strong className="text-yellow">Alphaville, São Paulo</strong>, com o título <strong className="text-yellow">Full Stack AI Nível 5</strong>, a certificação máxima do IAP (IA na Prática), que poucos profissionais no Brasil possuem.
                  </p>
                  <p>
                    Em 2025, as soluções de IA que Carlos desenvolveu <strong className="text-yellow">geraram mais de R$ 10 milhões em faturamento</strong> para as empresas que implementaram o método + que Vencedores.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                  {[
                    { icon: Zap, label: '+R$ 10M', sub: 'faturamento gerado em 2025' },
                    { icon: Users, label: '+40 empresas', sub: 'com IA implementada' },
                    { icon: Award, label: 'Full Stack AI', sub: 'nível máximo no Brasil' },
                    { icon: Flame, label: '15+ anos', sub: 'como empresário' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                      <s.icon className="w-5 h-5 text-yellow mb-2" />
                      <p className="text-white font-bold text-lg leading-tight">{s.label}</p>
                      <p className="text-white/50 text-xs mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ───────── EMPRESARIOS + que Vencedores ───────── */}
        <section className="py-16 lg:py-20 px-6 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-3xl mb-10">
              <p className="inline-flex items-center gap-2.5 text-yellow text-[11px] uppercase tracking-[0.3em] font-semibold mb-4">
                <span className="h-px w-8 bg-yellow" /> Prova real
              </p>
              <h2 className="text-3xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight mb-4">
                Empresários que <span className="font-editorial italic font-normal text-yellow">já faturam</span> com o método
              </h2>
              <p className="text-white/60 text-base lg:text-lg leading-relaxed">
                Não são alunos esperando resultado. São empresas com a operação rodando, faturando e validando o sistema todos os dias.
              </p>
            </div>
            <TeamShowcase members={EMPRESARIOS_SQUAAD} />
          </div>
        </section>

        {/* ───────── PRICING ───────── */}
        <section ref={pricingRef} id="pricing" className="py-16 lg:py-24 px-6 lg:px-12 bg-gradient-to-b from-transparent via-yellow/[0.04] to-transparent">
          <div className="max-w-3xl mx-auto text-center">
            <p className="inline-flex items-center gap-2.5 text-yellow text-[11px] uppercase tracking-[0.3em] font-semibold mb-4">
              <span className="h-px w-8 bg-yellow" /> Investimento <span className="h-px w-8 bg-yellow" />
            </p>
            <h2 className="text-3xl lg:text-5xl font-extrabold mb-3 leading-[1.05] tracking-tight">
              Quanto custa <span className="font-editorial italic font-normal text-yellow">transformar seu negócio</span>?
            </h2>
            <p className="text-white/60 text-base lg:text-lg mb-10 max-w-xl mx-auto">
              Empresas pagam de R$ 8.000 a R$ 25.000 para implantar esse método. Você vai aprender presencialmente por uma fração disso.
            </p>

            <div className="relative bg-[#0d0d0d] border-2 border-yellow/40 rounded-3xl p-8 lg:p-10 shadow-[0_0_60px_-15px_rgba(250,200,0,0.3)]">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                Lote Promocional
              </div>

              <div className="mt-4 mb-6">
                <p className="text-white/40 text-sm mb-2">
                  De <span className="line-through text-white/50">R$ 490</span> por apenas
                </p>
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-white/50 text-xl">R$</span>
                  <span className="text-7xl lg:text-8xl font-extrabold text-white tracking-tighter">47</span>
                </div>
                <p className="text-sm text-white/50">à vista no Pix ou 10x de R$ 5,56 no cartão</p>
              </div>

              <div className="bg-yellow/[0.06] border border-yellow/20 rounded-xl p-4 mb-8 max-w-md mx-auto">
                <p className="text-yellow text-sm font-semibold">
                  Isso é menos que um almoço de negócios. O retorno pode ser de R$ 15k+ no primeiro mês.
                </p>
              </div>

              <ul className="text-left space-y-3 mb-9 max-w-lg mx-auto">
                {[
                  { t: '5 horas de evento prático para ação imediata', s: '25 de julho (sábado), 8h, em Feira de Santana, BA · endereço enviado aos inscritos' },
                  { t: 'Trilha completa do zero aos R$ 100k/mês com IA', s: 'passo a passo executável, sem teoria' },
                  { t: 'CRM AI First + Funil de Vendas estruturado', s: 'o mesmo sistema das +40 empresas + que Vencedores' },
                  { t: 'Sistema de Prospecção Ativa + 30 créditos', s: 'ferramenta + que Vencedores pronta para uso imediato' },
                  { t: 'IA de Atendimento integrada ao WhatsApp', s: 'qualifica, agenda e encaminha 24/7' },
                  { t: 'Acesso direto a Carlos Eduardo e time + que Vencedores', s: 'tire dúvidas ao vivo, aplique no seu negócio na hora' },
                  { t: 'Garantia incondicional até o fim da Masterclass', s: '' },
                ].map((b) => (
                  <li key={b.t} className="flex items-start gap-3 text-white/85 text-[15px]">
                    <CheckCircle2 className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold leading-tight">{b.t}</p>
                      {b.s && <p className="text-white/45 text-[12px] leading-snug mt-0.5">{b.s}</p>}
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => {
                  // InitiateCheckout fica por conta do pixel do Kirvano (sem duplicar)
                  window.location.href = getCheckoutUrl();
                }}
                className="group w-full bg-[#3B82F6] hover:bg-[#FFD61F] text-black font-extrabold text-lg py-7 rounded-full shadow-[0_8px_32px_-4px_rgba(250,200,0,0.5)] hover:shadow-[0_12px_40px_-4px_rgba(250,200,0,0.75)] hover:scale-[1.01] transition-all border-0"
              >
                GARANTIR MINHA VAGA AGORA
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <p className="text-[12px] text-white/40 mt-4 flex items-center justify-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Pagamento seguro Kirvano</span>
                <span>·</span>
                <span>Garantia ate o fim da Masterclass</span>
                <span>·</span>
                <span>Cancele quando quiser</span>
              </p>

              {!countdown.expired && (
                <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-sm">
                  <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-white/60">Este preço encerra em</span>
                  <span className="text-yellow font-bold">
                    {countdown.days}d {String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ───────── GARANTIA ───────── */}
        <section className="py-12 px-6 lg:px-12">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-yellow/[0.06] to-transparent border border-yellow/30 rounded-3xl p-8 lg:p-10 text-center">
            <div className="inline-flex w-12 h-12 mx-auto bg-yellow/15 border border-yellow/40 rounded-2xl items-center justify-center mb-5 shadow-[0_0_30px_-4px_rgba(250,200,0,0.4)]">
              <Shield className="w-6 h-6 text-yellow" />
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold mb-3 tracking-tight">Risco zero. Sério.</h3>
            <p className="text-white/65 leading-relaxed max-w-xl mx-auto mb-4">
              Você acompanha a Masterclass inteira. Se ao fim sentir que o método não vai transformar a sua operação, devolvemos <strong className="text-white">100% do investimento</strong>. Sem perguntas, sem burocracia.
            </p>
            <p className="text-yellow text-sm font-semibold">
              Se R$ 47 fosse risco, você não estaria lendo isso. O risco real é não estar lá.
            </p>
          </div>
        </section>

        {/* ───────── FAQ ───────── */}
        <section className="py-16 lg:py-20 px-6 lg:px-12">
          <div className="max-w-3xl mx-auto">
            <div className="mb-10">
              <p className="text-yellow text-[11px] uppercase tracking-[0.3em] font-semibold mb-4">
                Dúvidas
              </p>
              <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tight">Perguntas frequentes</h2>
            </div>

            <Accordion type="single" collapsible className="space-y-2">
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="bg-white/[0.02] border border-white/10 rounded-xl px-5 hover:border-white/20 transition-colors"
                >
                  <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-4">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/65 leading-relaxed pb-4">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ───────── FINAL CTA ───────── */}
        <section className="py-16 lg:py-24 px-6 lg:px-12 border-t border-white/5 bg-gradient-to-t from-yellow/[0.04] to-transparent">
          <div className="max-w-3xl mx-auto text-center">
            <div>
              <h2 className="text-3xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight mb-5">
                {countdown.expired ? 'Hoje' : `Daqui a ${countdown.days} dias`}, você pode estar no mesmo lugar. <span className="font-editorial italic font-normal text-yellow">Ou pode estar faturando com IA.</span>
              </h2>
              <p className="text-white/65 text-base lg:text-lg mb-4 max-w-xl mx-auto leading-relaxed">
                25 de julho, 8h, presencial em Feira de Santana. O método que gerou +R$ 10 milhões por R$ 47.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 mb-9 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-yellow" />
                  <span className="text-yellow font-bold">{leadCount}</span> confirmados
                </span>
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-yellow" /> Sala limitada</span>
                <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-red-400" /> Lote promocional</span>
              </div>

              <Button
                onClick={goToCheckout}
                className="group bg-[#3B82F6] hover:bg-[#FFD61F] text-black font-extrabold text-lg px-10 py-7 rounded-full shadow-[0_8px_32px_-4px_rgba(250,200,0,0.5)] hover:shadow-[0_16px_48px_-4px_rgba(250,200,0,0.75)] hover:scale-[1.02] transition-all border-0"
              >
                <Sparkles className="mr-2 w-5 h-5" />
                QUERO MINHA VAGA AGORA
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <p className="text-white/40 text-xs mt-5">
                Pagamento seguro. Garantia incondicional. Proxima turma sem data confirmada.
              </p>
            </div>
          </div>
        </section>

        <footer className="py-8 px-6 border-t border-white/5 text-center text-[11px] text-white/30 uppercase tracking-[0.2em]">
          &copy; 2026 + que Vencedores - Todos os direitos reservados
        </footer>
      </div>
    </>
  );
};

export default MasterclassIA;
