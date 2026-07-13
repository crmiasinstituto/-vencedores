import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MessageCircleQuestion, X, Check, Clock } from 'lucide-react';

interface Question {
  id: string;
  meeting_id: string | null;
  livekit_room_name: string | null;
  asker_name: string | null;
  asker_identity: string | null;
  content: string;
  answered: boolean;
  answered_at: string | null;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string | null;
  roomName: string | null;
  onUnreadChange?: (count: number) => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export default function HostQuestionsDrawer({ isOpen, onClose, meetingId, roomName, onUnreadChange }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Inicial load + realtime subscription
  useEffect(() => {
    if (!roomName) return; // sem roomName nao da pra subscrever
    let active = true;

    const loadQuestions = async () => {
      setLoading(true);
      // Carga inicial: pega TUDO da sala (lead pode ter inserido sem meeting_id
      // se ainda nao tinha buscado o id no momento). Filtramos por
      // livekit_room_name que e' SEMPRE setado pelo cliente.
      const { data } = await (supabase as any)
        .from('meet_questions')
        .select('*')
        .eq('livekit_room_name', roomName)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!active) return;
      setQuestions(data || []);
      setLoading(false);
    };

    loadQuestions();

    // Realtime channel — SEMPRE filtra por livekit_room_name (estavel pra
    // host e lead). Antes filtrava por meeting_id quando disponivel, mas
    // o lead nao tinha meetingInfo populado e inseria meeting_id=null,
    // entao o evento nunca casava o filtro do host. Bug critico.
    const channel = supabase
      .channel(`meet_questions:${roomName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meet_questions',
          filter: `livekit_room_name=eq.${roomName}`,
        },
        (payload: any) => {
          if (!active) return;
          if (payload.eventType === 'INSERT') {
            const q = payload.new as Question;
            setQuestions((prev) => [q, ...prev]);
            toast(`💬 ${q.asker_name || 'Participante'} mandou uma pergunta`, {
              duration: 10000,
              description: q.content.length > 80 ? q.content.slice(0, 80) + '...' : q.content,
            });
          } else if (payload.eventType === 'UPDATE') {
            const q = payload.new as Question;
            setQuestions((prev) => prev.map((x) => (x.id === q.id ? q : x)));
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id;
            setQuestions((prev) => prev.filter((x) => x.id !== id));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomName]);

  // Notifica parent sobre unread count
  useEffect(() => {
    const unread = questions.filter((q) => !q.answered).length;
    onUnreadChange?.(unread);
  }, [questions, onUnreadChange]);

  const markAnswered = async (q: Question) => {
    const { error } = await (supabase as any)
      .from('meet_questions')
      .update({ answered: true, answered_at: new Date().toISOString() })
      .eq('id', q.id);
    if (error) toast.error('Erro: ' + error.message);
  };

  if (!isOpen) return null;

  const unanswered = questions.filter((q) => !q.answered);
  const answered = questions.filter((q) => q.answered);

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-[#0d0d0d] border-l border-white/10 flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Perguntas</h3>
          {unanswered.length > 0 && (
            <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              {unanswered.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && <p className="text-gray-500 text-xs text-center mt-4">Carregando...</p>}

        {!loading && questions.length === 0 && (
          <div className="text-center mt-12 px-4">
            <MessageCircleQuestion className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Sem perguntas ainda</p>
            <p className="text-gray-700 text-xs mt-1">Os participantes podem mandar perguntas pelo botao "Pergunta"</p>
          </div>
        )}

        {unanswered.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold px-1">
              Pendentes
            </p>
            {unanswered.map((q) => (
              <div key={q.id} className="bg-primary/[0.04] border border-primary/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-xs font-semibold text-primary truncate">{q.asker_name || 'Participante'}</span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {timeAgo(q.created_at)}
                  </span>
                </div>
                <p className="text-sm text-white leading-snug whitespace-pre-wrap break-words">{q.content}</p>
                <button
                  onClick={() => markAnswered(q)}
                  className="mt-2.5 w-full text-xs font-medium bg-white/5 hover:bg-primary/15 hover:text-primary border border-white/10 hover:border-primary/30 text-gray-300 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  Marcar respondida
                </button>
              </div>
            ))}
          </div>
        )}

        {answered.length > 0 && (
          <div className="space-y-2 pt-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-semibold px-1">
              Respondidas
            </p>
            {answered.map((q) => (
              <div key={q.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 opacity-60">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs font-medium text-gray-400 truncate">{q.asker_name || 'Participante'}</span>
                  <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-400 leading-snug whitespace-pre-wrap break-words line-clamp-2">{q.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
