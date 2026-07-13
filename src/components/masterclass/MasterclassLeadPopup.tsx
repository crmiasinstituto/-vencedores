import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Instagram, ArrowRight, Loader2, MapPin, Calendar, Clock, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { WhatsAppInput } from '@/components/lead/WhatsAppInput';
import { useVHSRegionDetector } from '@/components/vhs/VHSRegionMessages';
import { trackEvent } from '@/components/tracking/MetaPixel';
import { getCheckoutUrl } from '@/lib/masterclass-checkout';

interface FormData {
  name: string;
  whatsapp: string;
  instagram: string;
}

interface MasterclassLeadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  leadCount?: number;
}

const DDD_GREETINGS: Record<string, string[]> = {
  '71': [
    'Salvador, cidade prospera e cheia de oportunidade!',
    'Soteropolitano(a) com visao. A energia de SSA e unica.',
    'Do dende ao digital. Salvador esta pronta pra IA.',
    'Capital baiana na area. Gente boa e negocio bom.',
    'SSA representando forte. Bora transformar faturamento.',
    'Capital baiana na área. Bora faturar com IA!',
    'Quem e de Salvador ja sabe: oportunidade nao espera.',
  ],
  '75': [
    'Feira de Santana na area. Interior baiano forte!',
    'Feirense e direto pro resultado, sem enrolacao.',
    'Do interior pra frente. Feira esta acordando pra IA.',
    'Princesa do sertao representando. Bora faturar.',
  ],
  '73': [
    'Sul da Bahia chegou. Boa energia pra IA.',
    'Ilheus, Itabuna... Sul baiano e prospero.',
    'Costa do Cacau com visao de futuro. Gostei.',
  ],
  '74': [
    'Juazeiro na area. Norte baiano e forte.',
    'Sertao conectado. Juazeiro sabe o que quer.',
  ],
  '77': [
    'Oeste baiano forte. Agronegocio + IA = perfeito.',
    'Barreiras, LEM... Oeste baiano e potencia.',
  ],
  '79': [
    'Sergipe na area! Aracaju representando.',
    'Menor estado, grande ambicao. Sergipe e assim.',
  ],
  '82': [
    'Alagoas presente! Maceio na linha.',
    'De Alagoas pro topo. Nordeste e potencia.',
  ],
  '83': [
    'Paraiba na area! Joao Pessoa representando.',
    'Jampa com visao. Paraiba e forte.',
  ],
  '84': [
    'Rio Grande do Norte presente! Natal na linha.',
    'Potiguar com ambicao. Gostei do perfil.',
  ],
  '81': [
    'Recife na linha. Porto Digital + IA = futuro.',
    'Pernambuco e polo de tech. Voce no lugar certo.',
    'Recife sempre na frente em inovacao. Bora.',
  ],
  '85': [
    'Fortaleza na area! Cearense decide rapido.',
    'Ceara e resistencia e prosperidade. Vamos.',
    'Cearense com IA e uma forca da natureza.',
  ],
  '86': [
    'Piaui presente! Teresina na linha.',
    'De Teresina pro topo. Piaui ta crescendo muito.',
  ],
  '91': [
    'Belem na linha. Norte do Brasil representando.',
    'Para e grandeza. Belem com visao.',
  ],
  '92': [
    'Manaus na area! Zona Franca + IA.',
    'Amazonas representando. Potencia verde e digital.',
  ],
  '98': [
    'Sao Luis na linha! Maranhao forte.',
    'Ilha do amor e dos negocios. Bora.',
  ],
  '11': [
    'SP na linha. Quem e de Sampa ja sabe: tempo e dinheiro.',
    'Paulistano(a) que toma decisao rapido. Meu tipo de pessoa.',
    'A capital dos negocios presente. SP nao para.',
    'Sao Paulo sempre na frente. IA e o proximo passo.',
    'Selva de pedra, selva de oportunidade.',
  ],
  '12': [
    'Vale do Paraiba na linha! Regiao forte.',
    'SJC, polo de tecnologia. Combina com IA.',
  ],
  '13': [
    'Baixada Santista representando! Litoral prospero.',
  ],
  '14': [
    'Interior de SP representando! Regiao forte.',
  ],
  '15': [
    'Sorocaba na area! Interior forte de SP.',
  ],
  '16': [
    'Ribeirao Preto na linha! Capital do agro + IA.',
  ],
  '17': [
    'Noroeste paulista representando!',
  ],
  '19': [
    'Campinas na linha! Inovacao pura.',
    'Campinas e tecnologia de ponta. IA e o proximo passo.',
  ],
  '21': [
    'Rio de Janeiro continua lindo, e cheio de gente prospera.',
    'Carioca com visao de negocio. Combinacao perfeita.',
    'Do Rio pro mundo. IA nao conhece fronteira.',
    'Cidade maravilhosa, profissional maravilhoso(a). Bora.',
  ],
  '22': [
    'Norte fluminense na area! Campos representando.',
  ],
  '24': [
    'Regiao serrana do RJ na linha! Forte demais.',
  ],
  '27': [
    'Espirito Santo presente! Vitoria representando.',
    'Capixaba com visao. ES e potencia.',
  ],
  '31': [
    'Mineiro(a) com IA e combinacao perigosa. No bom sentido.',
    'BH chegou. Quem e de Minas sabe multiplicar.',
    'De Beaga pro topo. Mineiro quando decide, e certeiro.',
    'Capital mineira presente. Trem bom e IA que fatura.',
  ],
  '34': [
    'Triangulo Mineiro e potencia. Agro + IA = futuro.',
    'Uberlandia/Uberaba representando!',
  ],
  '41': [
    'Curitiba na linha! Qualidade de vida e negocios.',
    'Curitibano(a) organizado(a) e estrategico(a). Perfeito.',
  ],
  '43': [
    'Londrina na linha! Norte do Parana e prospero.',
  ],
  '44': [
    'Maringa na area! Cidade que so cresce.',
  ],
  '47': [
    'Joinville/Blumenau na area. Polo de inovacao do Sul.',
    'Vale europeu com visao de futuro. SC forte.',
  ],
  '48': [
    'Floripa na linha! Ilha da magia e dos negocios.',
    'Florianopolis prospera. Startups, tech, e agora IA.',
  ],
  '49': [
    'Oeste catarinense na area! Chapeco representando.',
  ],
  '51': [
    'Gaucho(a) que toma decisao rapido. Do meu time.',
    'Porto Alegre na linha. Resiliencia e prosperidade.',
  ],
  '54': [
    'Serra gaucha na linha! Caxias representando.',
  ],
  '61': [
    'Brasilia na linha! Onde as decisoes acontecem.',
    'DF representando. Capital federal com visao de futuro.',
  ],
  '62': [
    'Goiania na area! Goias e potencia.',
    'Goiano(a) prospero(a). Bola da vez.',
  ],
  '63': [
    'Tocantins presente! Palmas na linha.',
  ],
  '65': [
    'Cuiaba na linha! Mato Grosso e grandeza.',
  ],
  '67': [
    'Campo Grande na linha! MS forte.',
  ],
};

function pickDDDGreeting(ddd: string, cidade?: string | null): string | null {
  const pool = DDD_GREETINGS[ddd];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (cidade) return `${cidade} na linha. Bom te ver por aqui!`;
  return null;
}

const formatWhatsAppForWebhook = (raw: string) => {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10) digits = digits.slice(0, 2) + '9' + digits.slice(2);
  return '55' + digits;
};

export const MasterclassLeadPopup: React.FC<MasterclassLeadPopupProps> = ({ isOpen, onClose, leadCount = 0 }) => {
  const [submitting, setSubmitting] = useState(false);
  const [currentDDD, setCurrentDDD] = useState('');
  const [greeting, setGreeting] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const { regionData, detectRegion } = useVHSRegionDetector();

  useEffect(() => {
    if (currentDDD && currentDDD.length === 2) {
      detectRegion(currentDDD);
    }
  }, [currentDDD, detectRegion]);

  useEffect(() => {
    if (regionData && currentDDD.length === 2) {
      setGreeting(pickDDDGreeting(currentDDD, regionData.cidade));
    }
  }, [regionData, currentDDD]);

  const onSubmit = async (data: FormData) => {
    if (!data.name || data.name.trim().length < 2) {
      toast.error('Informe seu nome completo');
      return;
    }
    const cleanWp = data.whatsapp.replace(/\D/g, '');
    if (cleanWp.length < 10 || cleanWp.length > 11) {
      toast.error('WhatsApp invalido');
      return;
    }

    setSubmitting(true);

    const ddd = cleanWp.slice(0, 2);
    const formattedWp = formatWhatsAppForWebhook(cleanWp);
    const instagramUsername = data.instagram?.replace('@', '').trim() || null;

    try {
      if (instagramUsername) {
        supabase.functions
          .invoke('masterclass-instagram-scrap', { body: { username: instagramUsername } })
          .catch(() => {});
      }

      const leadRow = {
        name: data.name.trim(),
        whatsapp: formattedWp,
        instagram: instagramUsername,
        ddd,
        region: regionData?.region || null,
        estado: regionData?.estado || null,
        cidade: regionData?.cidade || null,
        emoji: regionData?.emoji || null,
        cor: regionData?.cor || null,
        mensagem: regionData?.mensagemMotivacional || null,
        source: 'masterclass_ia',
      };

      await Promise.all([
        supabase.from('leads').insert(leadRow).select().single(),
        supabase.functions
          .invoke('create-crm-lead-masterclass', {
            body: {
              name: data.name.trim(),
              whatsapp: formattedWp,
              instagram: instagramUsername,
              ddd,
              cidade: regionData?.cidade,
              estado: regionData?.estado,
            },
          })
          .catch(() => {}),
      ]);

      trackEvent('Lead', {
        content_name: 'Masterclass IA - Lead Capturado',
        content_category: 'Masterclass IA',
      });

      // InitiateCheckout fica por conta do pixel do Kirvano na pagina de pagamento

      setTimeout(() => {
        window.location.href = getCheckoutUrl();
      }, 2000);
    } catch (e) {
      console.error('masterclass popup submit error', e);
      setSubmitting(false);
      window.location.href = getCheckoutUrl();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="mc-popup-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 24 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
          className="relative w-full max-w-[420px] my-8 overflow-hidden rounded-3xl shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Top banner - warm gradient */}
          <div className="relative bg-gradient-to-br from-[#3B82F6] via-[#F5B800] to-[#E8A900] px-6 pt-6 pb-8 text-center overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-[-30px] right-[-20px] w-32 h-32 rounded-full bg-white/15" />
            <div className="absolute bottom-[-40px] left-[-15px] w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute top-4 left-6 w-8 h-8 rounded-full bg-white/20" />

            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="relative"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/15 text-black/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
                <Sparkles className="w-3 h-3" />
                Evento presencial em Feira de Santana
              </div>
              <h2 className="text-[1.5rem] lg:text-[1.7rem] font-extrabold text-black leading-[1.15] tracking-tight">
                Garanta sua presença na Masterclass de IA
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-[11px] text-black/70 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 25 de julho
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 8h
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Feira de Santana, BA
                </span>
              </div>
            </motion.div>
          </div>

          {/* Notch connector */}
          <div className="relative">
            <svg viewBox="0 0 420 24" className="w-full block" preserveAspectRatio="none">
              <path d="M0,0 L420,0 L420,24 Q350,0 210,0 Q70,0 0,24 Z" fill="#3B82F6" />
              <path d="M0,24 Q70,0 210,0 Q350,0 420,24 L420,24 L0,24 Z" fill="white" />
            </svg>
          </div>

          {/* White form area */}
          <div className="bg-white px-6 pb-6 pt-1">
            {submitting ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-10 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="mx-auto w-14 h-14 mb-4 rounded-full border-[3px] border-gray-200 border-t-[#3B82F6]"
                />
                <p className="text-gray-900 text-lg font-bold mb-1">Reservando sua vaga...</p>
                <p className="text-gray-500 text-sm">Redirecionando para pagamento seguro</p>
              </motion.div>
            ) : (
              <>
                {/* DDD greeting */}
                <AnimatePresence>
                  {greeting && regionData && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-amber-800 text-sm font-bold flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          {regionData.cidade}, {regionData.estado}
                        </p>
                        <p className="text-amber-700 text-[13px] leading-snug mt-0.5 italic">
                          {greeting}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="popup-name" className="text-gray-700 text-sm font-semibold">
                      Nome completo
                    </Label>
                    <Input
                      id="popup-name"
                      {...register('name', { required: 'Nome é obrigatório' })}
                      className="mt-1.5 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3B82F6] focus:ring-[#3B82F6]/30 rounded-xl text-base"
                      placeholder="Como podemos te chamar?"
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="popup-whatsapp" className="text-gray-700 text-sm font-semibold">
                      WhatsApp
                    </Label>
                    <WhatsAppInput
                      {...register('whatsapp', {
                        required: 'WhatsApp é obrigatório',
                        pattern: {
                          value: /^\(\d{2}\)\s9\d{4}-\d{4}$/,
                          message: 'WhatsApp invalido',
                        },
                      })}
                      onDDDChange={setCurrentDDD}
                      className="mt-1.5 h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3B82F6] focus:ring-[#3B82F6]/30 rounded-xl text-base"
                    />
                    {errors.whatsapp && (
                      <p className="text-red-500 text-xs mt-1">{errors.whatsapp.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="popup-instagram" className="text-gray-700 text-sm font-semibold">
                      Instagram <span className="text-gray-400 font-normal">(opcional)</span>
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="popup-instagram"
                        {...register('instagram', {
                          pattern: {
                            value: /^@?[a-zA-Z0-9._]+$/,
                            message: 'Instagram invalido',
                          },
                        })}
                        className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3B82F6] focus:ring-[#3B82F6]/30 pl-10 h-12 rounded-xl text-base"
                        placeholder="@seuusuario"
                      />
                      <Instagram className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {errors.instagram && (
                      <p className="text-red-500 text-xs mt-1">{errors.instagram.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="group w-full bg-gradient-to-r from-[#3B82F6] to-[#E8A900] hover:from-[#FFD61F] hover:to-[#F5B800] text-black font-extrabold text-[15px] py-6 mt-1 rounded-full shadow-[0_6px_24px_-4px_rgba(250,200,0,0.5)] hover:shadow-[0_10px_32px_-4px_rgba(250,200,0,0.7)] hover:scale-[1.01] transition-all border-0"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        GARANTIR MINHA VAGA POR R$ 47
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-3 pt-1 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {leadCount > 0 ? `${leadCount} confirmados` : 'Vagas limitadas'}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>Pagamento seguro</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>Garantia total</span>
                  </div>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
