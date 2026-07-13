import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Paperclip, Phone, MessageSquare, RefreshCw, Image, FileText, Mic, Video, Smile, MoreVertical, Check, CheckCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WhatsAppMessage {
  id: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string;
  is_read: boolean;
  created_at: string;
  whatsapp_message_id?: string | null;
}

interface WhatsAppChatProps {
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadProfilePic?: string | null;
  boardId?: string;
  onClose: () => void;
}

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  leadId, leadName, leadPhone, leadProfilePic, boardId, onClose,
}) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<string>('image');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(leadProfilePic || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Load connected instance
  useEffect(() => {
    const loadInstance = async () => {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('id, status')
        .eq('status', 'connected')
        .limit(1);
      if (data && data.length > 0) {
        setInstanceId(data[0].id);
        setIsConnected(true);
      }
    };
    loadInstance();
  }, []);

  // Update profile pic from lead's instagram_profile_pic_url
  useEffect(() => {
    if (!leadProfilePic && leadId) {
      const fetchProfilePic = async () => {
        const { data } = await supabase
          .from('crm_leads')
          .select('instagram_profile_pic_url')
          .eq('id', leadId)
          .single();
        if (data?.instagram_profile_pic_url) {
          setProfilePicUrl(data.instagram_profile_pic_url);
        }
      };
      fetchProfilePic();
    }
  }, [leadId, leadProfilePic]);

  // Mark chat as read on UAZAPI when opening
  useEffect(() => {
    if (isConnected && instanceId && leadPhone) {
      const cleanPhone = leadPhone.replace(/\D/g, '');
      supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'chat_read',
          instance_id: instanceId,
          number: cleanPhone,
          read: true,
        },
      }).catch(() => {});
    }
  }, [isConnected, instanceId, leadPhone]);

  // Load messages
  const loadMessages = useCallback(async () => {
    const cleanPhone = leadPhone.replace(/\D/g, '');
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .or(`lead_id.eq.${leadId},remote_phone.ilike.%${cleanPhone}%`)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!error && data) {
      setMessages(data as WhatsAppMessage[]);
      // Mark as read in DB
      const unreadIds = data.filter((m: any) => !m.is_read && m.direction === 'inbound').map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('whatsapp_messages').update({ is_read: true }).in('id', unreadIds);
      }
    }
    setIsLoading(false);
  }, [leadId, leadPhone]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const cleanPhone = leadPhone.replace(/\D/g, '');
    const channel = supabase
      .channel(`whatsapp-chat-${leadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
      }, (payload) => {
        const msg = payload.new as any;
        const msgPhone = msg.remote_phone?.replace(/\D/g, '');
        if (msg.lead_id === leadId || msgPhone?.includes(cleanPhone) || cleanPhone?.includes(msgPhone)) {
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.direction === 'inbound') {
            supabase.from('whatsapp_messages').update({ is_read: true }).eq('id', msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leadId, leadPhone]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send text
  const handleSend = async () => {
    if (!newMessage.trim() || !instanceId || isSending) return;
    setIsSending(true);
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_text',
          instance_id: instanceId,
          phone: leadPhone,
          text: newMessage.trim(),
          lead_id: leadId,
          board_id: boardId,
          readchat: true,
        },
      });
      if (res.data?.success) {
        setNewMessage('');
        inputRef.current?.focus();
      } else {
        toast.error(res.data?.error || 'Erro ao enviar');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setIsSending(false);
  };

  // Send media
  const handleSendMedia = async () => {
    if (!mediaUrl.trim() || !instanceId) return;
    setIsSending(true);
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_media',
          instance_id: instanceId,
          phone: leadPhone,
          type: mediaType,
          file: mediaUrl.trim(),
          lead_id: leadId,
          board_id: boardId,
          readchat: true,
        },
      });
      if (res.data?.success) {
        setMediaUrl('');
        setShowMediaInput(false);
        toast.success('Mídia enviada!');
      } else {
        toast.error(res.data?.error || 'Erro ao enviar mídia');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setIsSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Status icons
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="w-3 h-3 text-blue-400" />;
      case 'delivered': return <CheckCheck className="w-3 h-3 text-green-200" />;
      case 'sent': return <Check className="w-3 h-3 text-green-200" />;
      default: return <Check className="w-3 h-3 text-green-300/50" />;
    }
  };

  // Render message content based on type
  const renderMessageContent = (msg: WhatsAppMessage) => {
    switch (msg.message_type) {
      case 'image':
        return (
          <div>
            {msg.media_url && (
              <img src={msg.media_url} alt="" className="max-w-full rounded-lg mb-1 cursor-pointer hover:opacity-90" onClick={() => window.open(msg.media_url!, '_blank')} />
            )}
            {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
          </div>
        );
      case 'video':
        return (
          <div>
            {msg.media_url && (
              <video src={msg.media_url} controls className="max-w-full rounded-lg mb-1" />
            )}
            {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
          </div>
        );
      case 'audio':
      case 'ptt':
        return (
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 flex-shrink-0" />
            {msg.media_url ? (
              <audio src={msg.media_url} controls className="max-w-[200px] h-8" />
            ) : (
              <span className="text-xs italic">Áudio</span>
            )}
          </div>
        );
      case 'document':
        return (
          <div className="flex items-center gap-2 p-2 bg-black/10 rounded">
            <FileText className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{msg.content || 'Documento'}</p>
            </div>
            {msg.media_url && (
              <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 hover:text-blue-400" />
              </a>
            )}
          </div>
        );
      default:
        return msg.content ? <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p> : null;
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl w-full max-w-lg h-[85vh] max-h-[700px] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-green-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {profilePicUrl ? (
              <img src={profilePicUrl} alt={leadName} className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
            ) : (
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-sm">{leadName}</h3>
              <p className="text-xs text-green-100 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {formatPhone(leadPhone)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge className="bg-green-800 text-green-100 text-xs border-green-600">Online</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Offline</Badge>
            )}
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-1"
          style={{
            backgroundColor: '#0b141a',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'.7\' numOctaves=\'10\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'.03\'/%3E%3C/svg%3E")',
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-green-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma mensagem ainda</p>
              <p className="text-xs mt-1">Envie a primeira mensagem!</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isOutbound = msg.direction === 'outbound';
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDate = !prevMsg || format(new Date(msg.created_at), 'dd/MM/yyyy') !== format(new Date(prevMsg.created_at), 'dd/MM/yyyy');

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-2">
                        <span className="bg-[#1d2b36] text-[#8696a0] text-[11px] px-3 py-1 rounded-lg shadow">
                          {format(new Date(msg.created_at), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${
                          isOutbound
                            ? 'bg-[#005c4b] text-white rounded-tr-none'
                            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                        }`}
                      >
                        {renderMessageContent(msg)}
                        <div className={`flex items-center justify-end gap-1 mt-0.5`}>
                          <span className="text-[10px] text-white/50">
                            {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                          </span>
                          {isOutbound && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Media input bar */}
        {showMediaInput && (
          <div className="p-2 border-t border-border bg-muted/50 flex gap-2 items-center flex-shrink-0">
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              className="text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground"
            >
              <option value="image">📷 Imagem</option>
              <option value="video">🎥 Vídeo</option>
              <option value="audio">🎵 Áudio</option>
              <option value="document">📄 Documento</option>
              <option value="ptt">🎤 Voz</option>
            </select>
            <Input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="URL do arquivo..."
              className="flex-1 text-xs h-8"
            />
            <Button size="sm" onClick={handleSendMedia} disabled={!mediaUrl.trim() || isSending} className="h-8 bg-green-600 hover:bg-green-700">
              <Send className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowMediaInput(false); setMediaUrl(''); }} className="h-8">
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="p-2 border-t border-border bg-[#202c33] flex gap-2 items-center flex-shrink-0">
          {!isConnected ? (
            <p className="text-xs text-destructive flex-1 text-center py-2">
              Nenhuma instância WhatsApp conectada
            </p>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-[#8696a0] hover:text-white hover:bg-white/10 flex-shrink-0"
                onClick={() => setShowMediaInput(!showMediaInput)}
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-[#2a3942] border-none text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-0 h-9"
                autoFocus
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!newMessage.trim() || isSending}
                className="bg-green-600 hover:bg-green-700 h-9 w-9 flex-shrink-0"
              >
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
