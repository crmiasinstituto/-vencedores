import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Instagram, Loader2, Rocket, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { WhatsAppInput } from '@/components/lead/WhatsAppInput';
import { useVHSRegionDetector } from './VHSRegionMessages';
import { trackEvent } from '@/components/tracking/MetaPixel';

interface VHSLeadFormData {
  name: string;
  whatsapp: string;
  instagram: string;
}

interface VHSLeadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Formata WhatsApp para padrão internacional: 55 + DDD + 9 dígito + número
const formatWhatsAppForWebhook = (rawNumber: string): string => {
  let digits = rawNumber.replace(/\D/g, '');
  
  // Remove 55 se já vier com código do país
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  // Se tem 10 dígitos (DDD + 8), adiciona o 9 após o DDD
  if (digits.length === 10) {
    digits = digits.slice(0, 2) + '9' + digits.slice(2);
  }
  
  // Adiciona código do país
  return '55' + digits;
};

export const VHSLeadPopup: React.FC<VHSLeadPopupProps> = ({ isOpen, onClose, onSuccess }) => {
  const [currentDDD, setCurrentDDD] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isAnalyzingInstagram, setIsAnalyzingInstagram] = useState(false);
  const [instagramAnalysis, setInstagramAnalysis] = useState<any>(null);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm<VHSLeadFormData>();
  const { regionData, detectRegion } = useVHSRegionDetector();

  // Detectar região quando DDD mudar
  useEffect(() => {
    if (currentDDD && currentDDD.length === 2) {
      console.log('🔍 VHS - Detectando região para DDD:', currentDDD);
      detectRegion(currentDDD);
    }
  }, [currentDDD, detectRegion]);

  const analyzeInstagram = async (username: string, leadName?: string): Promise<any> => {
    if (!username || username.length < 3) return null;
    
    setIsAnalyzingInstagram(true);
    try {
      const cleanUsername = username.replace('@', '').trim();
      console.log('🔍 VHS - Analyzing Instagram profile:', cleanUsername);
      
      const { data, error } = await supabase.functions.invoke('analyze-instagram-profile', {
        body: { 
          username: cleanUsername,
          leadName: leadName,
          context: 'vhs'
        }
      });

      if (error) {
        console.error('❌ Instagram analysis error:', error);
        return null;
      }

      if (data?.success) {
        console.log('✅ VHS - Instagram analysis complete:', {
          followers: data.instagramData?.followers,
          posts: data.instagramData?.posts?.length,
          hasMessage: !!data.personalizedMessage
        });
        setInstagramAnalysis(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Error analyzing Instagram:', error);
      return null;
    } finally {
      setIsAnalyzingInstagram(false);
    }
  };

  const onSubmit = async (data: VHSLeadFormData) => {
    // Validação básica PRIMEIRO (rápidas)
    if (!data.name || data.name.trim().length < 2) {
      toast.error('Nome muito curto');
      return;
    }

    const cleanWhatsapp = data.whatsapp.replace(/\D/g, '');
    if (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11) {
      toast.error('Número de WhatsApp inválido');
      return;
    }

    // MOSTRAR TELA DE PROCESSAMENTO IMEDIATAMENTE
    setShowProcessing(true);
    setIsSubmitting(true);
    
    try {
      console.log('📝 VHS - Iniciando submissão do formulário:', data);
      console.log('📱 VHS - WhatsApp limpo:', cleanWhatsapp);

      const ddd = cleanWhatsapp.slice(0, 2);
      const formattedWhatsapp = formatWhatsAppForWebhook(cleanWhatsapp);
      console.log('📱 VHS - WhatsApp formatado:', formattedWhatsapp);

      // Agora faz o scraping em background (usuário vê tela bonita)
      let finalInstagramData = instagramAnalysis;
      
      if (data.instagram?.trim() && !instagramAnalysis) {
        console.log('⏳ VHS - Fazendo análise do Instagram em background...');
        
        finalInstagramData = await analyzeInstagram(
          data.instagram.trim(), 
          data.name.trim()
        );
        
        console.log('✅ VHS - Análise do Instagram concluída:', finalInstagramData ? 'com dados' : 'sem dados');
      }
      
      // Preparar dados para inserção com dados do Instagram garantidos
      const leadData = {
        name: data.name.trim(),
        whatsapp: formattedWhatsapp,
        instagram: data.instagram?.trim() || null,
        ddd: ddd,
        region: regionData?.region || null,
        estado: regionData?.estado || null,
        cidade: regionData?.cidade || null,
        emoji: regionData?.emoji || null,
        cor: regionData?.cor || null,
        mensagem: regionData?.mensagemMotivacional || regionData?.mensagem || null,
        source: 'vhs_ao_prompt',
        instagram_data: finalInstagramData?.instagramData || null,
        instagram_profile_pic_url: finalInstagramData?.profilePicPath || null,
        mensagem_personalizada: finalInstagramData?.personalizedMessage || null
      };

      console.log('📤 VHS - Enviando dados do lead:', {
        ...leadData,
        instagram_data: leadData.instagram_data ? 'PRESENTE' : 'null',
        mensagem_personalizada: leadData.mensagem_personalizada ? 'PRESENTE' : 'null'
      });

      // Executar em PARALELO: salvar no Supabase + enviar webhook + criar no CRM
      const webhookData = {
        ...leadData,
        mensagemMotivacional: regionData?.mensagemMotivacional || null
      };

      const [insertResult, webhookResult, crmResult] = await Promise.all([
        supabase.from('leads').insert(leadData).select().single(),
        supabase.functions.invoke('send-to-iautomatize-vhs', {
          body: webhookData
        }).catch(e => ({ error: e })),
        // Criar lead automaticamente no CRM Kanban
        supabase.functions.invoke('create-crm-lead-from-popup', {
          body: {
            name: data.name.trim(),
            whatsapp: formattedWhatsapp,
            instagram: data.instagram?.trim() || null,
            instagram_profile_pic_url: finalInstagramData?.profilePicPath || null
          }
        }).catch(e => ({ error: e }))
      ]);

      if (insertResult.error) {
        console.error('❌ VHS - Erro do Supabase:', insertResult.error);
        throw new Error(`Erro ao salvar: ${insertResult.error.message}`);
      }

      console.log('✅ VHS - Lead salvo com sucesso:', insertResult.data);

      if (webhookResult.error) {
        console.warn('⚠️ VHS - Erro ao enviar webhook (não crítico):', webhookResult.error);
      } else {
        console.log('✅ VHS - Webhook enviado com sucesso');
      }

      if (crmResult.error) {
        console.warn('⚠️ VHS - Erro ao criar no CRM (não crítico):', crmResult.error);
      } else {
        console.log('✅ VHS - Lead criado no CRM Kanban');
      }

      // Atualizar instagramAnalysis com dados finais para tela de sucesso
      if (finalInstagramData && !instagramAnalysis) {
        setInstagramAnalysis(finalInstagramData);
      }

      // Transicionar de processamento para sucesso
      setShowProcessing(false);
      setShowSuccess(true);
      toast.success('Inscrição realizada com sucesso!');
      
      // Meta Pixel - Lead event
      trackEvent('Lead', {
        content_name: 'VHS ao Prompt - Lead Capturado',
        content_category: 'Imersão IA'
      });
      
      // Fechar após 2s e scroll para seção de preços
      setTimeout(() => {
        setShowSuccess(false);
        setIsSubmitting(false);
        onClose();
        
        // Scroll suave para a seção "Escolha seu acesso"
        setTimeout(() => {
          const pricingSection = document.getElementById('pricing-section');
          if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ VHS - Erro ao salvar lead:', error);
      const errorMessage = error?.message || 'Erro desconhecido';
      toast.error(`Erro ao enviar dados: ${errorMessage}`);
      setShowProcessing(false);
      setIsSubmitting(false);
    }
  };

  // 1. Tela de processamento (NOVA - enquanto scraping acontece)
  if (showProcessing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-carbon/98 to-carbon flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          {/* Ícone animado */}
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 1, repeat: Infinity }
            }}
            className="w-20 h-20 mx-auto mb-8 bg-gradient-to-br from-yellow to-yellow-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow/40"
          >
            <Rocket className="w-10 h-10 text-carbon" />
          </motion.div>
          
          {/* Frase impactante */}
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl font-bold text-yellow mb-4 leading-tight"
          >
            "Vender serviços com IA em 2026 vai criar mais novos <span className="text-white">RICOS</span> do que qualquer profissão da última década."
          </motion.h2>
          
          {/* Subtítulo */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-400 text-lg mb-8"
          >
            Preparando sua jornada...
          </motion.p>
          
          {/* Dots animados de loading */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ 
                  y: [0, -10, 0],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 0.8, 
                  repeat: Infinity, 
                  delay: i * 0.2 
                }}
                className="w-3 h-3 bg-yellow rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // 2. Tela de sucesso (existente)
  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-carbon/98 to-carbon flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-carbon/90 backdrop-blur-xl border-2 border-yellow/40 rounded-2xl p-8 text-center max-w-md shadow-2xl shadow-yellow/20"
        >
          {/* Foto do Instagram ou ícone padrão */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mx-auto mb-6"
          >
            {instagramAnalysis?.profilePicPath ? (
              <img 
                src={instagramAnalysis.profilePicPath}
                alt="Seu perfil"
                className="w-24 h-24 rounded-full border-4 border-yellow shadow-lg shadow-yellow/30 mx-auto"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-yellow to-yellow-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-12 h-12 text-carbon" />
              </div>
            )}
          </motion.div>
          
          {/* Nome personalizado */}
          <h3 className="text-3xl font-bold text-yellow mb-3">
            Parabéns, {watch('name')?.split(' ')[0] || 'você'}! 🎉
          </h3>
          
          <p className="text-white text-lg mb-4">
            Sua inscrição foi registrada!
          </p>
          
          <p className="text-gray-300 mb-4">
            Agora conheça mais sobre a Imersão e garanta sua vaga.
          </p>
          
          {/* Mensagem motivacional regional */}
          {regionData?.mensagemMotivacional && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-4 p-4 bg-yellow/10 border border-yellow/30 rounded-xl"
            >
              <p className="text-yellow text-sm font-medium">
                {regionData.emoji} {regionData.mensagemMotivacional}
              </p>
            </motion.div>
          )}
          
          {/* Stats do Instagram se disponível */}
          {instagramAnalysis?.instagramData?.followers && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-gray-400 text-sm"
            >
              Você e seus {instagramAnalysis.instagramData.followers.toLocaleString()} seguidores vão adorar! 🚀
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-gradient-to-br from-carbon/98 to-carbon flex items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative bg-carbon/90 backdrop-blur-xl border-2 border-yellow/30 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl shadow-yellow/10 my-8"
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-yellow hover:bg-yellow/10"
              aria-label="Fechar popup de inscrição"
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <motion.div 
                className="w-16 h-16 bg-gradient-to-br from-yellow to-yellow-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow/30"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Rocket className="w-8 h-8 text-carbon" />
              </motion.div>
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-yellow mb-2">
                Garanta Sua Vaga! 🚀
              </h2>
              <p className="text-gray-300 text-sm">
                Preencha seus dados para garantir sua vaga na imersão
              </p>
              <p className="text-yellow/80 text-xs mt-1 font-semibold">
                Apenas R$ 97 • 6 horas de conteúdo ao vivo
              </p>
            </div>

            {/* Mensagem Motivacional por DDD */}
            <AnimatePresence>
              {regionData && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="mb-4 p-4 bg-gradient-to-r from-yellow/10 to-yellow/5 border border-yellow/30 rounded-xl"
                >
                  <p className="text-yellow text-sm font-medium leading-relaxed">
                    {regionData.emoji} {regionData.mensagemMotivacional}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Nome */}
              <div>
                <Label htmlFor="name" className="text-gray-300 text-sm font-medium">
                  Nome Completo *
                </Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Nome é obrigatório' })}
                  className="mt-1 bg-white/95 backdrop-blur-sm border-white/30 text-black placeholder-gray-500 focus:border-yellow focus:ring-yellow/30 h-12"
                  placeholder="Seu nome completo"
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* WhatsApp */}
              <div>
                <Label htmlFor="whatsapp" className="text-gray-300 text-sm font-medium">
                  WhatsApp *
                </Label>
                <WhatsAppInput
                  {...register('whatsapp', { 
                    required: 'WhatsApp é obrigatório',
                    pattern: {
                      value: /^\(\d{2}\)\s9\d{4}-\d{4}$/,
                      message: 'WhatsApp inválido'
                    }
                  })}
                  onDDDChange={(ddd) => {
                    console.log('📱 VHS - DDD detectado:', ddd);
                    setCurrentDDD(ddd);
                  }}
                  className="mt-1 h-12"
                />
                {errors.whatsapp && (
                  <p className="text-red-400 text-xs mt-1">{errors.whatsapp.message}</p>
                )}
              </div>

              {/* Instagram */}
              <div>
                <Label htmlFor="instagram" className="text-gray-300 text-sm font-medium">
                  Instagram (opcional)
                </Label>
                <div className="relative">
                  <Input
                    id="instagram"
                    {...register('instagram', {
                      pattern: {
                        value: /^@?[a-zA-Z0-9._]+$/,
                        message: 'Instagram inválido'
                      }
                    })}
                    className="mt-1 bg-white/95 backdrop-blur-sm border-white/30 text-black placeholder-gray-500 focus:border-yellow focus:ring-yellow/30 pl-10 h-12"
                    placeholder="@seuusuario"
                    onBlur={(e) => {
                      const username = e.target.value.trim();
                      const nameValue = watch('name');
                      if (username && username !== instagramAnalysis?.username) {
                        analyzeInstagram(username, nameValue);
                      }
                    }}
                  />
                  <Instagram className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  {isAnalyzingInstagram && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="h-5 w-5 animate-spin text-yellow" />
                    </div>
                  )}
                </div>
                {errors.instagram && (
                  <p className="text-red-400 text-xs mt-1">{errors.instagram.message}</p>
                )}
                
                {/* Instagram Analysis Result */}
                {instagramAnalysis && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 bg-yellow/10 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <img 
                        src={instagramAnalysis.profilePicPath || "/placeholder.svg"} 
                        alt="Profile"
                        className="w-10 h-10 rounded-full border-2 border-yellow/30"
                      />
                      <div>
                        <p className="text-yellow text-sm font-medium">
                          {instagramAnalysis.instagramData?.followers?.toLocaleString()} seguidores
                        </p>
                        <p className="text-gray-400 text-xs">
                          {instagramAnalysis.instagramData?.category}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-300 text-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow" />
                      Mensagem personalizada gerada com IA!
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-yellow via-yellow-400 to-yellow text-carbon font-bold py-6 rounded-xl shadow-lg shadow-yellow/40 border-2 border-yellow-300 hover:shadow-xl hover:shadow-yellow/60 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 text-lg"
              >
                {isSubmitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-3 border-carbon/30 border-t-carbon rounded-full"
                  />
                ) : (
                  <>
                    GARANTIR MINHA VAGA POR R$97 
                    <Rocket className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Trust Badges */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                🔒 Dados protegidos
              </span>
              <span className="flex items-center gap-1">
                ✅ 100% seguro
              </span>
            </div>

            {/* Footer */}
            <p className="text-xs text-gray-500 text-center mt-4">
              Ao se inscrever, você concorda em receber comunicações sobre o evento
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
