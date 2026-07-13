import React, { useState, useRef, useEffect } from 'react';
import { Video, Mic, Monitor, StopCircle, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMeetingTranscription } from '@/hooks/useMeetingTranscription';

interface StartMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingUrl?: string;
  meetingTitle: string;
  leadId?: string;
  onCompleted?: () => void;
}

export const StartMeetingModal: React.FC<StartMeetingModalProps> = ({
  isOpen, onClose, meetingId, meetingUrl, meetingTitle, leadId, onCompleted,
}) => {
  const [step, setStep] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isTranscribing, isReconnecting, transcriptions, error,
    startMeetingTranscription, stopMeetingTranscription,
    saveMeetingTranscriptions,
  } = useMeetingTranscription();

  // Timer
  useEffect(() => {
    if (isTranscribing) {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTranscribing]);

  // Auto-scroll transcription
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]);

  const handleOpenMeet = () => {
    if (meetingUrl) {
      window.open(meetingUrl, '_blank');
    } else {
      window.open('https://meet.google.com/new', '_blank');
    }
  };

  const handleStartTranscription = async () => {
    try {
      // Update meeting status
      await supabase
        .from('meetings' as any)
        .update({ status: 'in_progress', started_at: new Date().toISOString() } as any)
        .eq('id', meetingId);

      await startMeetingTranscription();
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar transcrição');
    }
  };

  const handleEndMeeting = async () => {
    setIsSaving(true);
    try {
      stopMeetingTranscription();
      const { finals, duration } = await saveMeetingTranscriptions(meetingId);

      // Trigger AI analysis
      if (finals.length > 0) {
        const transcriptionText = finals.map(t => `${t.speaker}: ${t.text}`).join('\n');
        supabase.functions.invoke('analyze-sales-call', {
          body: {
            callId: meetingId,
            transcription: transcriptionText,
            leadContext: `Reunião: ${meetingTitle}`,
            tableName: 'meetings',
          },
        }).catch(err => console.error('[Meeting] AI analysis error:', err));
      }

      // Log activity
      if (leadId) {
        await supabase.from('crm_activities').insert({
          lead_id: leadId,
          activity_type: 'meeting_completed',
          description: `Reunião "${meetingTitle}" finalizada (${formatTime(elapsedSeconds)})`,
        });
      }

      toast.success('Reunião finalizada e salva!');
      onCompleted?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClose = async () => {
    if (isTranscribing || step === 3) {
      const confirm = window.confirm('A transcrição está em andamento. Deseja encerrar e salvar?');
      if (!confirm) return;
      // Finalize the meeting properly instead of just stopping transcription
      await handleEndMeeting();
      return;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            {meetingTitle}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Etapa 1 de 3 — Abra o Google Meet'}
            {step === 2 && 'Etapa 2 de 3 — Inicie a Transcrição'}
            {step === 3 && 'Etapa 3 de 3 — Transcrição em Andamento'}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                step >= s ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'
              }`}>
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Open Meet */}
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Video className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Abra o Google Meet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Abra a reunião no Google Meet em outra aba do navegador antes de iniciar a transcrição.
              </p>
            </div>
            <Button onClick={handleOpenMeet} className="bg-green-600 hover:bg-green-700">
              <ExternalLink className="w-4 h-4 mr-2" /> Abrir Google Meet
            </Button>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Já abri o Meet, pular →
            </button>
          </div>
        )}

        {/* Step 2: Start Transcription */}
        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Inicie a Transcrição</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ao clicar, selecione a <strong>aba do Google Meet</strong> e marque{' '}
                <strong>"Compartilhar áudio"</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">Importante: marque "Compartilhar áudio da guia" para capturar os participantes!</p>
            </div>
            <Button onClick={handleStartTranscription} size="lg">
              <Monitor className="w-4 h-4 mr-2" /> Iniciar Transcrição
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button onClick={() => setStep(1)} className="text-xs text-muted-foreground underline">← Voltar</button>
          </div>
        )}

        {/* Step 3: Live Transcription */}
        {step === 3 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Status bar */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-semibold text-red-400">GRAVANDO</span>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {formatTime(elapsedSeconds)}
                </Badge>
                {isReconnecting && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Reconectando...
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mic className="w-3.5 h-3.5" /> Mic
                <Monitor className="w-3.5 h-3.5 ml-2" /> Tela
              </div>
            </div>

            {/* Transcription area */}
            <ScrollArea className="flex-1 min-h-[300px]">
              <div ref={scrollRef} className="space-y-2 pr-2">
                {transcriptions.filter(t => t.is_final || t.text.length > 3).map((t, i) => (
                  <div key={t.is_final ? t.id : `partial-${t.speaker}`} className={`text-sm ${!t.is_final ? 'opacity-50 italic' : ''}`}>
                    <span className={`font-semibold text-xs ${t.speakerType === 'local' ? 'text-blue-400' : 'text-green-400'}`}>
                      {t.speaker}:
                    </span>{' '}
                    <span className="text-foreground">{t.text}</span>
                  </div>
                ))}
                {transcriptions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aguardando áudio... Fale algo para testar o microfone.
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* End button */}
            <div className="pt-3 mt-3 border-t border-border">
              <Button
                onClick={handleEndMeeting}
                variant="destructive"
                className="w-full"
                disabled={isSaving}
              >
                <StopCircle className="w-4 h-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Encerrar Reunião'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
