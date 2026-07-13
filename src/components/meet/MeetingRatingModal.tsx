import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

interface Props {
  meetingId: string | null;
  roomName: string | null;
  participantName: string;
  participantIdentity?: string;
  onSubmitted: () => void;
  onSkip: () => void;
}

const SCORES = Array.from({ length: 11 }, (_, i) => i); // 0..10

export default function MeetingRatingModal({
  meetingId,
  roomName,
  participantName,
  participantIdentity,
  onSubmitted,
  onSkip,
}: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score == null) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('meet_ratings').insert({
        meeting_id: meetingId,
        livekit_room_name: roomName,
        participant_name: participantName || null,
        participant_identity: participantIdentity || null,
        score,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      toast.success('Obrigado pelo feedback!');
      onSubmitted();
    } catch (e: any) {
      toast.error('Falhou ao enviar: ' + (e.message || 'erro'));
    } finally {
      setSubmitting(false);
    }
  };

  const ctaLabel = score == null ? 'Escolha uma nota' : `Enviar avaliacao · ${score}/10`;
  const ctaActive = score != null && !submitting;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-xl bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 shadow-2xl shadow-primary/5">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🤔</div>
          <h2 className="text-2xl font-bold text-white">Como foi pra voce?</h2>
          <p className="text-sm text-gray-400 mt-1">Do 0 ao 10, o quanto te ajudou?</p>
        </div>

        <div className="grid grid-cols-11 gap-1.5 mb-5">
          {SCORES.map((n) => {
            const selected = score === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                className={`aspect-square rounded-lg border text-sm font-semibold transition-all ${
                  selected
                    ? 'bg-primary border-primary text-black scale-105'
                    : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Algum comentario? (opcional)"
          rows={3}
          className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 resize-none mb-5"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!ctaActive}
          className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
            ctaActive
              ? 'bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/20'
              : 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : score != null ? (
            <Send className="w-4 h-4" />
          ) : null}
          {submitting ? 'Enviando...' : ctaLabel}
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Pular
        </button>
      </div>
    </div>
  );
}
