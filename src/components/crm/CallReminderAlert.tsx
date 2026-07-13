import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UpcomingCall {
  id: string;
  name: string;
  whatsapp: string;
  instagram_profile_pic_url?: string;
  scheduled_call_at: string;
  board_name?: string;
}

export const CallReminderAlert: React.FC = () => {
  const [upcomingCalls, setUpcomingCalls] = useState<UpcomingCall[]>([]);
  const [dismissedCalls, setDismissedCalls] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef<Set<string>>(new Set());

  // Criar audio element
  useEffect(() => {
    // Usar um beep simples gerado por Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playBeep = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880; // A5
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    };

    // Salvar referência para tocar
    (window as any).__playCallBeep = () => {
      // Tocar 3 beeps
      playBeep();
      setTimeout(playBeep, 200);
      setTimeout(playBeep, 400);
    };

    return () => {
      audioContext.close();
    };
  }, []);

  const checkUpcomingCalls = useCallback(async () => {
    try {
      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);

      const { data, error } = await supabase
        .from('crm_leads')
        .select(`
          id,
          name,
          whatsapp,
          instagram_profile_pic_url,
          scheduled_call_at,
          call_reminder_sent,
          crm_boards!inner(name)
        `)
        .not('scheduled_call_at', 'is', null)
        .gte('scheduled_call_at', now.toISOString())
        .lte('scheduled_call_at', fiveMinutesLater.toISOString())
        .eq('call_reminder_sent', false);

      if (error) {
        console.error('Erro ao verificar calls:', error);
        return;
      }

      if (data && data.length > 0) {
        const calls = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          whatsapp: item.whatsapp,
          instagram_profile_pic_url: item.instagram_profile_pic_url,
          scheduled_call_at: item.scheduled_call_at,
          board_name: item.crm_boards?.name
        }));

        // Filtrar calls já dispensadas
        const newCalls = calls.filter(c => !dismissedCalls.has(c.id));
        
        // Tocar som para novas calls
        const unnotifiedCalls = newCalls.filter(c => !hasPlayedRef.current.has(c.id));
        if (unnotifiedCalls.length > 0) {
          (window as any).__playCallBeep?.();
          unnotifiedCalls.forEach(c => hasPlayedRef.current.add(c.id));
        }

        setUpcomingCalls(newCalls);
      } else {
        setUpcomingCalls([]);
      }
    } catch (error) {
      console.error('Erro ao verificar calls:', error);
    }
  }, [dismissedCalls]);

  // Polling a cada 30 segundos
  useEffect(() => {
    checkUpcomingCalls();
    const interval = setInterval(checkUpcomingCalls, 30000);
    return () => clearInterval(interval);
  }, [checkUpcomingCalls]);

  const dismissCall = async (callId: string) => {
    setDismissedCalls(prev => new Set([...prev, callId]));
    setUpcomingCalls(prev => prev.filter(c => c.id !== callId));

    // Marcar como notificado no banco
    await supabase
      .from('crm_leads')
      .update({ call_reminder_sent: true })
      .eq('id', callId);
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  if (upcomingCalls.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        className="fixed bottom-4 right-4 z-50 w-80"
      >
        <div className="bg-yellow text-carbon rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-carbon/10 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 animate-bounce" />
              <span className="font-bold">CALL EM BREVE!</span>
            </div>
            <span className="text-xs bg-carbon/20 px-2 py-0.5 rounded-full">
              {upcomingCalls.length} {upcomingCalls.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>

          {/* Lista de calls */}
          <div className="divide-y divide-carbon/10 max-h-64 overflow-y-auto">
            {upcomingCalls.map((call) => (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4"
              >
                <div className="flex items-start gap-3">
                  {call.instagram_profile_pic_url ? (
                    <img
                      src={call.instagram_profile_pic_url}
                      alt={call.name}
                      className="w-10 h-10 rounded-full border-2 border-carbon/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-carbon/20 flex items-center justify-center">
                      <Phone className="w-5 h-5" />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <p className="font-bold">{call.name}</p>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="w-3 h-3" />
                      {format(new Date(call.scheduled_call_at), "HH:mm", { locale: ptBR })}
                    </div>
                    {call.board_name && (
                      <p className="text-xs text-carbon/70 mt-0.5">{call.board_name}</p>
                    )}
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-carbon/50 hover:text-carbon hover:bg-carbon/10"
                    onClick={() => dismissCall(call.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Botão WhatsApp */}
                <a
                  href={`https://wa.me/55${call.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-carbon text-yellow rounded-lg font-bold hover:bg-carbon/90 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {formatPhone(call.whatsapp)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
