import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Send, MessageCircleQuestion, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  meetingId: string | null;
  roomName: string | null;
  askerName: string;
  askerIdentity?: string;
}

export default function AskQuestionModal({
  open, onClose, meetingId, roomName, askerName, askerIdentity,
}: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSend = async () => {
    const trimmed = content.trim();
    if (trimmed.length < 3) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from('meet_questions').insert({
        meeting_id: meetingId,
        livekit_room_name: roomName,
        asker_name: askerName || 'Participante',
        asker_identity: askerIdentity || null,
        content: trimmed,
      });
      if (error) throw error;
      toast.success('Pergunta enviada — o mentor vai responder em voz alta');
      setContent('');
      onClose();
    } catch (e: any) {
      toast.error('Falhou: ' + (e.message || 'erro'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 shadow-2xl shadow-primary/5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 bg-primary/20 border border-primary/30 rounded-2xl flex items-center justify-center flex-shrink-0">
            <MessageCircleQuestion className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Mandar pergunta</h2>
            <p className="text-sm text-gray-400">O mentor vai ler e responder em voz alta</p>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Qual sua duvida?"
          rows={5}
          autoFocus
          className="w-full bg-white/[0.02] border border-primary/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/60 resize-none mb-4"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSend();
          }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-gray-300 hover:bg-white/[0.07] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || content.trim().length < 3}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-black flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
