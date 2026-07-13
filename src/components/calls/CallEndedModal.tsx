import React, { useState, useEffect, useRef } from 'react';
import { Phone, Clock, ArrowUpRight, ArrowDownLeft, Brain, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCallContext } from '@/contexts/CallContext';
import { formatDuration } from '@/hooks/useWavoip';
import { supabase } from '@/integrations/supabase/client';

export const CallEndedModal: React.FC = () => {
  const { callEndedResult, showCallEndedModal, setShowCallEndedModal, transcriptions } = useCallContext();
  const [aiStatus, setAiStatus] = useState<'pending' | 'done' | 'error'>('pending');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for AI completion
  useEffect(() => {
    if (!showCallEndedModal || !callEndedResult?.callId) {
      setAiStatus('pending');
      setAiSummary(null);
      return;
    }

    const finals = transcriptions.filter(t => t.is_final);
    if (finals.length === 0) {
      setAiStatus('done'); // No transcription = nothing to analyze
      return;
    }

    setAiStatus('pending');
    let attempts = 0;
    const maxAttempts = 20; // ~40s max

    const poll = async () => {
      attempts++;
      try {
        const { data } = await supabase
          .from('call_history')
          .select('ai_summary, ai_processed_at')
          .eq('id', callEndedResult.callId)
          .single();

        if (data?.ai_processed_at) {
          setAiStatus('done');
          setAiSummary(data.ai_summary || null);
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
      } catch {}

      if (attempts >= maxAttempts) {
        setAiStatus('error');
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };

    pollRef.current = setInterval(poll, 2000);
    // First check immediately
    poll();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [showCallEndedModal, callEndedResult?.callId, transcriptions]);

  if (!callEndedResult) return null;

  const finalTranscriptions = transcriptions.filter(t => t.is_final);

  return (
    <Dialog open={showCallEndedModal} onOpenChange={setShowCallEndedModal}>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-muted-foreground" />
            Chamada encerrada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 min-h-0 overflow-y-auto">
          {/* Call info */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              {callEndedResult.direction === 'INCOMING' ? (
                <ArrowDownLeft className="w-5 h-5 text-blue-400" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-green-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{callEndedResult.peerName || callEndedResult.peerPhone}</p>
              <p className="text-xs text-muted-foreground">
                {callEndedResult.direction === 'INCOMING' ? 'Recebida' : 'Enviada'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{formatDuration(callEndedResult.duration)}</span>
            </div>
          </div>

          {/* Transcription summary */}
          {finalTranscriptions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                📝 Transcrição ({finalTranscriptions.length} segmentos)
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-muted/20 rounded-lg text-xs">
                {finalTranscriptions.map((seg, i) => (
                  <div key={seg.id || i}>
                    <span className={`font-semibold ${seg.speakerType === 'local' ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {seg.speaker}:
                    </span>{' '}
                    <span className="text-foreground/80">{seg.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20">
              <p className="text-xs text-muted-foreground text-center">
                Nenhuma transcrição capturada nesta chamada
              </p>
            </div>
          )}

          {/* AI analysis status */}
          {finalTranscriptions.length > 0 && (
            <>
              {aiStatus === 'pending' && (
                <div className="flex items-center gap-2 p-2.5 bg-primary/5 rounded-lg border border-primary/10">
                  <Brain className="w-4 h-4 text-primary animate-pulse" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-primary">Análise IA em andamento...</p>
                    <p className="text-[10px] text-muted-foreground">Aguardando resumo e insights</p>
                  </div>
                </div>
              )}
              {aiStatus === 'done' && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-emerald-400">Análise IA concluída ✅</p>
                    {aiSummary && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{aiSummary}</p>
                    )}
                  </div>
                </div>
              )}
              {aiStatus === 'error' && (
                <div className="flex items-center gap-2 p-2.5 bg-destructive/5 rounded-lg border border-destructive/10">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-destructive">Análise IA falhou</p>
                    <p className="text-[10px] text-muted-foreground">Verifique os logs ou tente novamente na timeline</p>
                  </div>
                </div>
              )}
            </>
          )}

          <Button variant="outline" className="w-full" onClick={() => setShowCallEndedModal(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
