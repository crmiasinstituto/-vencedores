import React, { useEffect, useRef, useState } from 'react';
import { Send, Maximize2, Loader2, Check, CheckCheck, AlertTriangle, Image as ImageIcon, FileText, Mic, Video, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AudioPlayer } from '@/components/whatsapp/AudioPlayer';

interface WhatsAppMessage {
  id: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string;
  is_read: boolean;
  created_at: string;
  instance_id: string | null;
}

interface WhatsAppLeadTabProps {
  leadId: string;
  leadName: string;
  leadPhone: string;
  boardId?: string;
  onOpenFullChat?: () => void;
}

export const WhatsAppLeadTab: React.FC<WhatsAppLeadTabProps> = ({
  leadId, leadName, leadPhone, boardId, onOpenFullChat,
}) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [instances, setInstances] = useState<{ id: string; instance_name: string }[]>([]);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leadId) return;
    loadMessages();

    const channel = supabase
      .channel(`wa-lead-${leadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `lead_id=eq.${leadId}` },
        () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leadId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name')
        .eq('status', 'connected');
      if (data && data.length) {
        setInstances(data);
        const saved = localStorage.getItem('whatsapp_selected_instance');
        const fallback = data.find((i) => i.id === saved)?.id || data[0].id;
        setInstanceId(fallback);
      }
    })();
  }, []);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('id, direction, message_type, content, media_url, status, is_read, created_at, instance_id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) setMessages(data as any);
    setLoading(false);
  }

  async function handleSend() {
    if (!text.trim() || !instanceId || sending) return;
    setSending(true);
    try {
      const r = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_text',
          instance_id: instanceId,
          phone: leadPhone,
          text: text.trim(),
          lead_id: leadId,
          board_id: boardId,
          readchat: true,
        },
      });
      if (r.data?.success) {
        setText('');
      } else {
        toast.error(r.data?.error || 'Erro ao enviar');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setSending(false);
  }

  function statusIcon(status: string) {
    if (status === 'read') return <CheckCheck className="w-3 h-3 text-blue-400" />;
    if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    if (status === 'sent') return <Check className="w-3 h-3 text-muted-foreground" />;
    if (status === 'failed') return <AlertTriangle className="w-3 h-3 text-red-400" />;
    return <Check className="w-3 h-3 text-muted-foreground/40" />;
  }

  function renderBody(msg: WhatsAppMessage) {
    const t = msg.message_type;
    if (t === 'image' && msg.media_url) {
      return (
        <div>
          <img
            src={msg.media_url}
            alt=""
            className="max-w-[260px] rounded-lg mb-1 cursor-pointer"
            onClick={() => window.open(msg.media_url!, '_blank')}
          />
          {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
        </div>
      );
    }
    // ptt = nota de voz do WhatsApp (todo audio gravado vem como ptt).
    // Sem incluir 'ptt' aqui, a nota de voz caia no fallback de texto e nao
    // virava player nenhum nesta aba.
    if ((t === 'audio' || t === 'ptt') && msg.media_url) {
      return <AudioPlayer src={msg.media_url} variant={t === 'ptt' ? 'ptt' : 'audio'} />;
    }
    if (t === 'video' && msg.media_url) {
      return (
        <video src={msg.media_url} controls className="max-w-[260px] rounded-lg" />
      );
    }
    if (t === 'document') {
      return (
        <a
          href={msg.media_url || '#'}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm underline decoration-dotted"
        >
          <FileText className="w-4 h-4" /> {msg.content || 'documento'}
        </a>
      );
    }
    if (t === 'location') {
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4" /> {msg.content || 'Localização compartilhada'}
        </div>
      );
    }
    return <p className="whitespace-pre-wrap break-words text-sm">{msg.content || '—'}</p>;
  }

  return (
    <div className="flex flex-col h-[60vh] rounded-lg border border-border overflow-hidden bg-card">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{leadName}</span>
          <span className="text-[11px] text-muted-foreground">+{leadPhone}</span>
        </div>
        <div className="flex items-center gap-2">
          {instances.length > 1 && (
            <select
              value={instanceId || ''}
              onChange={(e) => {
                setInstanceId(e.target.value);
                localStorage.setItem('whatsapp_selected_instance', e.target.value);
              }}
              className="h-7 text-[11px] bg-background border border-border rounded px-1.5"
            >
              {instances.map((i) => (
                <option key={i.id} value={i.id}>{i.instance_name}</option>
              ))}
            </select>
          )}
          {onOpenFullChat && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onOpenFullChat}>
              <Maximize2 className="w-3 h-3" /> Chat completo
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 bg-background">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm gap-2">
            <p>Nenhuma mensagem trocada ainda</p>
            <p className="text-[11px]">Envie a primeira pra começar a conversa</p>
          </div>
        ) : (
          messages.map((m) => {
            const out = m.direction === 'outgoing' || m.direction === 'sent';
            return (
              <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${out
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  title={format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                >
                  {renderBody(m)}
                  <div className={`flex items-center gap-1 justify-end mt-0.5 text-[9px] ${out ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    <span>{format(new Date(m.created_at), 'HH:mm')}</span>
                    {out && statusIcon(m.status)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-border p-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Mensagem…"
            className="h-9 text-sm"
            disabled={!instanceId || sending}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!text.trim() || !instanceId || sending}
            className="h-9 gap-1"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        {!instanceId && (
          <p className="text-[10px] text-amber-400 mt-1">
            Nenhuma instância WhatsApp conectada — não é possível enviar.
          </p>
        )}
      </footer>
    </div>
  );
};
