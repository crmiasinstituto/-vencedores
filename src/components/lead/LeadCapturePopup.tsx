import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Instagram, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { WhatsAppInput } from './WhatsAppInput';
import { DDD3DElement } from './DDD3DElement';
import { useRegionDetector } from './RegionDetector';

interface LeadFormData {
  name: string;
  whatsapp: string;
  instagram: string;
}

interface LeadCapturePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeadCapturePopup: React.FC<LeadCapturePopupProps> = ({ isOpen, onClose }) => {
  const [currentDDD, setCurrentDDD] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(1.5);
  const [isAnalyzingInstagram, setIsAnalyzingInstagram] = useState(false);
  const [instagramAnalysis, setInstagramAnalysis] = useState<any>(null);
  
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<LeadFormData>();
  const { regionData, detectRegion } = useRegionDetector();

  // Detectar região quando DDD mudar
  useEffect(() => {
    if (currentDDD && currentDDD.length === 2) {
      console.log('🔍 Detectando região para DDD:', currentDDD);
      detectRegion(currentDDD);
    }
  }, [currentDDD, detectRegion]);

  const analyzeInstagram = async (username: string, leadName?: string) => {
    if (!username || username.length < 3) return null;
    
    setIsAnalyzingInstagram(true);
    try {
      console.log('Analyzing Instagram profile:', username, leadName ? `for ${leadName}` : '');
      
      const { data, error } = await supabase.functions.invoke('analyze-instagram-profile', {
        body: { 
          username: username.replace('@', ''),
          leadName: leadName,
          context: 'b2b'
        }
      });

      if (error) {
        console.error('Instagram analysis error:', error);
        return null;
      }

      if (data?.success) {
        setInstagramAnalysis(data);
        toast.success(`Instagram de ${username} analisado!`);
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error analyzing Instagram:', error);
      return null;
    } finally {
      setIsAnalyzingInstagram(false);
    }
  };

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    
    try {
      console.log('📝 Iniciando submissão do formulário:', data);

      // Validação básica
      if (!data.name || data.name.trim().length < 2) {
        throw new Error('Nome muito curto');
      }

      const cleanWhatsapp = data.whatsapp.replace(/\D/g, '');
      console.log('📱 WhatsApp limpo:', cleanWhatsapp);
      
      if (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11) {
        throw new Error('Número de WhatsApp inválido');
      }

      const ddd = cleanWhatsapp.slice(0, 2);
      console.log('📍 DDD extraído:', ddd);

      // Analyze Instagram if provided (não bloqueia o envio em caso de erro)
      let currentInstagramData = instagramAnalysis;
      if (data.instagram && data.instagram.trim()) {
        try {
          console.log('🔍 Analisando Instagram:', data.instagram);
          if (!instagramAnalysis || instagramAnalysis.username !== data.instagram) {
            currentInstagramData = await analyzeInstagram(data.instagram, data.name);
          }
        } catch (igError) {
          console.warn('⚠️ Erro ao analisar Instagram (não crítico):', igError);
          // Continua mesmo com erro no Instagram
        }
      }
      
      // Preparar dados para inserção
      const leadData = {
        name: data.name.trim(),
        whatsapp: cleanWhatsapp,
        instagram: data.instagram?.trim() || null,
        ddd: ddd,
        region: regionData?.region || null,
        estado: regionData?.estado || null,
        cidade: regionData?.cidade || null,
        emoji: regionData?.emoji || null,
        cor: regionData?.cor || null,
        mensagem: regionData?.mensagem || null,
        source: 'popup_ddd',
        instagram_data: currentInstagramData?.instagramData || null,
        instagram_profile_pic_url: currentInstagramData?.profilePicPath || null,
        mensagem_personalizada: currentInstagramData?.personalizedMessage || null
      };

      console.log('📤 Enviando dados do lead:', leadData);

      // Salvar no Supabase
      const { data: insertedData, error: insertError } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro do Supabase:', insertError);
        throw new Error(`Erro ao salvar: ${insertError.message}`);
      }

      console.log('✅ Lead salvo com sucesso:', insertedData);

      // Enviar webhook para iAutomatize (assíncrono, não bloqueia UX)
      try {
        console.log('🔔 Enviando webhook para iAutomatize...');
        const { data: webhookData, error: webhookError } = await supabase.functions.invoke('send-to-iautomatize', {
          body: leadData
        });

        if (webhookError) {
          console.error('⚠️ Erro ao enviar webhook (não crítico):', webhookError);
        } else {
          console.log('✅ Webhook enviado com sucesso:', webhookData);
        }
      } catch (webhookError) {
        console.error('⚠️ Erro na chamada do webhook (não crítico):', webhookError);
      }

      setShowSuccess(true);
      toast.success(`Sucesso! ${regionData?.mensagem || 'Dados coletados com sucesso!'}`);
      
      // Store in localStorage to prevent showing again
      localStorage.setItem('lead_captured', 'true');
      localStorage.setItem('lead_captured_date', new Date().toISOString());
      
      // Iniciar countdown visual
      setCountdown(1.5);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 0.1) {
            clearInterval(countdownInterval);
            // Reset all internal states first
            setShowSuccess(false);
            setIsSubmitting(false);
            setCountdown(1.5);
            // Then close popup
            onClose();
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
      
      // Backup timeout - reset states and close
      setTimeout(() => {
        clearInterval(countdownInterval);
        setShowSuccess(false);
        setIsSubmitting(false);
        setCountdown(1.5);
        onClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('❌ Erro ao salvar lead:', error);
      const errorMessage = error?.message || 'Erro desconhecido';
      toast.error(`Erro ao enviar dados: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-carbon/95 to-carbon flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-carbon/80 backdrop-blur-xl border border-yellow/20 rounded-2xl p-8 text-center max-w-md"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-4 w-16 h-16 bg-yellow/20 rounded-full flex items-center justify-center"
          >
            <Sparkles className="w-8 h-8 text-yellow" />
          </motion.div>
          <h3 className="text-2xl font-bold text-yellow mb-2">Sucesso!</h3>
          <p className="text-gray-300 mb-4">
            {regionData?.mensagem || 'Seus dados foram coletados com sucesso!'}
          </p>
          <div className="text-sm text-gray-400">
            Redirecionando em <span className="text-yellow font-mono">{countdown.toFixed(1)}s</span>
          </div>
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
          className="fixed inset-0 z-50 bg-gradient-to-br from-carbon/95 to-carbon flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative bg-carbon/80 backdrop-blur-xl border border-yellow/20 rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-yellow"
            >
              <X className="w-5 h-5" />
            </Button>

            {/* 3D Element */}
            <div className="mb-6 h-32 relative">
              <DDD3DElement region={regionData} />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-yellow mb-2">
                Bem-vindo ao Futuro!
              </h2>
              <p className="text-gray-300 text-sm">
                Conecte-se conosco e descubra oportunidades incríveis
              </p>
            </div>

            {/* Regional Message */}
            <AnimatePresence>
              {regionData && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 bg-yellow/10 border border-yellow/20 rounded-lg text-center"
                >
                  <p className="text-yellow text-sm font-medium">
                    {regionData.emoji} {regionData.mensagem}
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
                  className="mt-1 bg-white/90 backdrop-blur-sm border-white/30 text-black placeholder-gray-600 focus:border-yellow focus:ring-yellow/20"
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
                    console.log('📱 DDD detectado:', ddd);
                    setCurrentDDD(ddd);
                  }}
                  className="mt-1"
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
                     className="mt-1 bg-white/90 backdrop-blur-sm border-white/30 text-black placeholder-gray-600 focus:border-yellow focus:ring-yellow/20 pl-10"
                     placeholder="@seuusuario"
                     onBlur={(e) => {
                       const username = e.target.value.trim();
                       if (username && username !== instagramAnalysis?.username) {
                         analyzeInstagram(username);
                       }
                     }}
                   />
                   <Instagram className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                   {isAnalyzingInstagram && (
                     <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                       <Loader2 className="h-4 w-4 animate-spin text-yellow" />
                     </div>
                   )}
                 </div>
                 {errors.instagram && (
                   <p className="text-red-400 text-xs mt-1">{errors.instagram.message}</p>
                 )}
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
                         className="w-8 h-8 rounded-full"
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
                     <p className="text-gray-300 text-xs">
                       ✨ Mensagem personalizada gerada com base no perfil
                     </p>
                   </motion.div>
                 )}
               </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-yellow to-yellow-400 text-black font-bold py-4 rounded-xl shadow-lg shadow-yellow/50 border-2 border-yellow-400 hover:shadow-xl hover:shadow-yellow/70 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-carbon/30 border-t-carbon rounded-full"
                  />
                ) : (
                  'Conectar-se ao Futuro! 🚀'
                )}
              </Button>
            </form>

            {/* Footer */}
            <p className="text-xs text-gray-500 text-center mt-4">
              Seus dados estão seguros e protegidos conosco
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};