import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Tutor IA por aula. Botao flutuante bottom-right que abre um painel
// fixo de 400x600 (desktop) ou fullscreen drawer (mobile).
// Chama edge function ai-tutor que ja faz auth via x-member-token,
// carrega contexto da aula e responde com Gemini Flash.

interface Props {
  lessonId: string;
  lessonTitle?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const PRE_PROMPTS = [
  'Resuma essa aula em 3 bullets',
  'O que e o conceito principal?',
  'Como aplico isso no meu negocio?',
  'Me da um exemplo pratico',
];

export function LessonTutorChat({ lessonId, lessonTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset chat quando muda de aula (id muda)
    setMessages([]);
    setInput('');
  }, [lessonId]);

  useEffect(() => {
    // Auto-scroll pro final ao receber msg
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function sendQuestion(q: string) {
    if (!q.trim() || sending) return;
    const question = q.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: { lesson_id: lessonId, question },
      });

      if (error || !data?.answer) {
        const msg = (data && (data as any).error) || error?.message || 'Tutor sem resposta. Tenta de novo.';
        toast.error(msg);
        setMessages((m) => m.slice(0, -1)); // remove a user msg que falhou
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      toast.error('Erro de rede. Tenta de novo em 1 minuto.');
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Botao flutuante */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
        onClick={() => setOpen(true)}
        aria-label="Abrir tutor IA"
        className={`fixed bottom-6 right-6 z-40 group flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#FFE066] shadow-[0_8px_24px_rgba(250,200,0,0.35)] hover:shadow-[0_12px_32px_rgba(250,200,0,0.5)] hover:scale-105 active:scale-95 transition-all duration-200 ${open ? 'scale-0 opacity-0 pointer-events-none' : ''}`}
      >
        <Sparkles className="w-5 h-5 text-black" />
        <span className="text-sm font-bold text-black pr-1 hidden sm:inline">Tutor IA</span>
      </motion.button>

      {/* Painel chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 bottom-6 right-6 w-[calc(100vw-3rem)] sm:w-[400px] h-[600px] max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl border border-[#3B82F6]/30 bg-gradient-to-br from-[#0a0a0a] via-[#0a0a0a] to-[#1a1a0a] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(250,200,0,0.15)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#3B82F6]/10 to-transparent">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#FFE066] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-black" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">Tutor IA</p>
                  <p className="text-[10px] text-white/40 truncate">
                    {lessonTitle ? `Aula: ${lessonTitle}` : 'Pergunta sobre essa aula'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar tutor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && !sending && (
                <div className="flex flex-col items-center justify-center text-center py-6 px-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/15 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-[#3B82F6]" />
                  </div>
                  <p className="text-sm text-white/80 font-medium">Pergunta sobre essa aula</p>
                  <p className="text-xs text-white/40 mt-1 max-w-xs">
                    Tutor responde com base no conteudo da aula. Pra travamento de jornada, chama o time pelo WhatsApp.
                  </p>
                  <div className="flex flex-col gap-2 mt-5 w-full max-w-xs">
                    {PRE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => sendQuestion(p)}
                        className="text-xs text-left px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#3B82F6]/30 text-white/70 hover:text-white transition-all"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === 'user'
                        ? 'bg-[#3B82F6] text-black rounded-tr-md font-medium'
                        : 'bg-white/[0.06] text-white/90 border border-white/5 rounded-tl-md'
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="px-3.5 py-2.5 rounded-2xl bg-white/[0.06] border border-white/5 flex items-center gap-2 text-white/60 text-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Pensando...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-white/10 p-3 bg-black/40">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendQuestion(input);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunta sobre a aula..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendQuestion(input);
                    }
                  }}
                  className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#3B82F6]/50 max-h-32"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !input.trim()}
                  className="h-10 w-10 rounded-xl bg-[#3B82F6] hover:bg-[#FFE066] text-black disabled:opacity-40 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <p className="text-[10px] text-white/30 mt-2 text-center">
                IA pode errar. Confira informacoes criticas com a equipe.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
