import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Paperclip, Phone, MessageSquare, RefreshCw, FileText, Mic, Check, CheckCheck, Download, X, User, Image, Video, File, Upload, Bot, BotOff, Timer, CornerUpLeft, Smile, Reply, MapPin, Trash2, Pencil, UserPlus, MoreVertical, Copy, Forward, Info, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { formatInstancePhone, shortInstanceName, getInstanceTag, describeInstance } from '@/lib/whatsappInstance';
import { normalizePhoneBR } from '@/lib/phone';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatContact } from './ChatContactList';
import { CallButton as CallButtonInline } from '@/components/calls/CallButton';
import { LeadDetailModal } from '@/components/crm/LeadDetailModal';
import { EmojiPicker } from './EmojiPicker';
import { VideoPTVRecorder } from './VideoPTVRecorder';
import { AudioPlayer } from './AudioPlayer';
import { nomeValido } from '@/lib/whatsapp-display';
import { TemplateExtras } from './TemplateExtras';

// Transforma URLs (http/https) em links clicaveis dentro de texto puro.
// O split com grupo de captura mantem as URLs como pedacos proprios; o teste
// de cada pedaco usa regex NAO-global pra evitar o bug de lastIndex do flag /g.
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
function renderWithLinks(text: string): React.ReactNode {
  return text.split(URL_REGEX).map((part, i) =>
    /^https?:\/\//i.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-300 underline break-all hover:text-sky-200"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

// Detecta um contato compartilhado (vCard). O webhook grava como texto puro
// (message_type='text') com linhas tipo "Phone: +55 75 98206-3823". Extrai
// nome + telefone pra renderizar um card clicavel "abrir conversa".
function parseVcard(text: string): { name: string; phone: string } | null {
  if (!text) return null;
  const phoneMatch = text.match(/phone[^\n:]*:\s*([+()\d][\d\s()+-]{6,})/i);
  if (!phoneMatch) return null;
  const phone = phoneMatch[1].replace(/\D/g, '');
  if (phone.length < 10) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let name = lines[0] || 'Contato';
  const bizName = text.match(/X-Wa-Biz-Name:\s*(.+)/i);
  if (/^(x-wa|company|phone|tel)/i.test(name) && bizName) name = bizName[1].trim();
  return { name, phone };
}

interface MsgReaction { from: string; name?: string | null; emoji: string; at: string; }
interface QuotedRef { id?: string | null; content?: string | null; type?: string | null; from?: string | null; }

interface WhatsAppMessage {
  id: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string;
  is_read: boolean;
  created_at: string;
  whatsapp_message_id: string | null;
  instance_id: string | null;
  metadata?: { reactions?: MsgReaction[]; quoted?: QuotedRef; [k: string]: any } | null;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  phone_number: string | null;
  channel: string | null;
  status: string;
  provider: string | null;
  api_url: string | null;
  /** Coluna gerada no banco: diz SE há credencial, sem expor o valor. */
  tem_credenciais?: boolean | null;
  purpose: string | null;
  notes: string | null;
}

interface InlineChatProps {
  contact: ChatContact;
  onOpenContact?: (c: ChatContact) => void;
}

// Channel color/label map
const CHANNEL_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  comercial: { label: 'Comercial', color: 'text-blue-300', bg: 'bg-blue-500/20 border-blue-500/40', dot: 'bg-blue-400' },
  suporte: { label: 'Suporte', color: 'text-green-300', bg: 'bg-green-500/20 border-green-500/40', dot: 'bg-green-400' },
  cs: { label: 'CS', color: 'text-purple-300', bg: 'bg-purple-500/20 border-purple-500/40', dot: 'bg-purple-400' },
  interno: { label: 'Interno', color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-500/40', dot: 'bg-orange-400' },
};

const getChannelStyle = (channel: string | null) => {
  if (!channel) return { label: 'Canal', color: 'text-gray-300', bg: 'bg-gray-500/20 border-gray-500/40', dot: 'bg-gray-400' };
  return CHANNEL_CONFIG[channel.toLowerCase()] || { label: channel, color: 'text-gray-300', bg: 'bg-gray-500/20 border-gray-500/40', dot: 'bg-gray-400' };
};

// Audio recebido sem media_url = o download eager no webhook falhou (normalmente
// sem instancia UAZAPI conectada no momento). Em vez de exigir o clique em
// "Carregar audio", este componente dispara o download sozinho no mount e mostra
// "Carregando..."; quando o media_url chega, o pai re-renderiza e cai no player.
const AudioAutoLoader: React.FC<{
  msg: WhatsAppMessage;
  onDownload: (m: WhatsAppMessage) => Promise<string | null>;
}> = ({ msg, onDownload }) => {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const firedRef = useRef(false);
  const attempt = useCallback(() => {
    setFailed(false);
    setLoading(true);
    onDownload(msg).then((url) => {
      if (!url) setFailed(true);
      setLoading(false);
    });
  }, [msg, onDownload]);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    attempt();
  }, [attempt]);
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 flex-shrink-0 text-green-400" />
        <span className="text-xs italic text-muted-foreground animate-pulse">Carregando áudio...</span>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 flex-shrink-0 text-green-400" />
        <button onClick={attempt} className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors">
          Tentar carregar áudio de novo
        </button>
      </div>
    );
  }
  return null;
};

export const InlineChat: React.FC<InlineChatProps> = ({ contact, onOpenContact }) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  // ===== Mencao (@) em grupo =====
  const [participants, setParticipants] = useState<{ phone: string; name: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // token exato inserido (ex: "@Joao") -> telefone, pra converter no envio
  const mentionsRef = useRef<{ token: string; phone: string }[]>([]);
  const [leadName, setLeadName] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(() => {
    return localStorage.getItem('whatsapp_selected_instance') || null;
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<{ file: File; preview: string | null; type: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [crmColumns, setCrmColumns] = useState<{ id: string; name: string }[]>([]);
  const [chatbotPausedUntil, setChatbotPausedUntil] = useState<string | null>(null);
  const [pausePopoverOpen, setPausePopoverOpen] = useState(false);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [availableBoards, setAvailableBoards] = useState<{ id: string; name: string }[]>([]);
  const [replyingTo, setReplyingTo] = useState<WhatsAppMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [showVideoPTV, setShowVideoPTV] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  // Dialog de escolha "atual / tempo real" antes de enviar localizacao
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  // Estado da live location: quando ativo, manda updates periodicos
  const [liveLocationActive, setLiveLocationActive] = useState(false);
  const [liveLocationRemaining, setLiveLocationRemaining] = useState(0);
  const liveLocationWatchRef = useRef<number | null>(null);
  const liveLocationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveLocationCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [editingMsg, setEditingMsg] = useState<WhatsAppMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<{ id: string; name: string; whatsapp: string | null }[]>([]);
  const [sendingContact, setSendingContact] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState<WhatsAppMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardResults, setForwardResults] = useState<{ id: string; name: string; whatsapp: string | null }[]>([]);
  const [infoMsg, setInfoMsg] = useState<WhatsAppMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversaAnteriorRef = useRef<string | null>(null);
  const [temMensagemNova, setTemMensagemNova] = useState(false);
  // Guarda o contato em que o operador escolheu a instancia na mao — enquanto
  // for o mesmo contato, o auto-switch nao sobrescreve a escolha dele.
  const manualPickRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // Derived state
  const isConnected = instances.length > 0;
  const instanceId = selectedInstanceId && instances.some(i => i.id === selectedInstanceId)
    ? selectedInstanceId
    : instances[0]?.id || null;

  // Instance map for channel badges
  const instanceMap = useMemo(() => {
    const map: Record<string, WhatsAppInstance> = {};
    instances.forEach(inst => { map[inst.id] = inst; });
    return map;
  }, [instances]);

  const activeProvider = instanceId ? (instanceMap[instanceId]?.provider || 'uazapi') : 'uazapi';

  // De qual numero essa conversa vem: a instancia da ultima mensagem que tem
  // instance_id. Serve pra avisar quando o operador esta prestes a responder
  // por um numero diferente do que o lead conhece.
  const conversationInstanceId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].instance_id) return messages[i].instance_id;
    }
    return null;
  }, [messages]);

  // Ao abrir a conversa, seleciona sozinho a instancia por onde ela vinha — o
  // lead precisa receber resposta do MESMO numero que ele conhece. Nao grava no
  // localStorage: aquilo e so o default de quando a conversa nao tem historico.
  // Se o operador trocar na mao (manualPickRef), respeita a escolha dele ate
  // trocar de contato.
  useEffect(() => {
    if (isLoading) return;
    if (!conversationInstanceId) return;
    if (manualPickRef.current === contact.id) return;
    if (!instances.some(i => i.id === conversationInstanceId)) return;
    if (conversationInstanceId === selectedInstanceId) return;
    setSelectedInstanceId(conversationInstanceId);
  }, [isLoading, conversationInstanceId, contact.id, instances, selectedInstanceId]);

  // Trocou de contato: zera a escolha manual pra o auto-switch valer de novo
  useEffect(() => {
    if (manualPickRef.current !== contact.id) manualPickRef.current = null;
  }, [contact.id]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  }, []);

  /** O container rolável das mensagens (o mesmo dos dois layouts). */
  const containerDeScroll = useCallback(() => chatAreaRef.current, []);

  /** Perto o bastante do fim para valer rolar sozinho (mesma folga que o WhatsApp usa). */
  const estaNoFim = useCallback(() => {
    const el = containerDeScroll();
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, [containerDeScroll]);

  // Fetch CRM lead name to override WhatsApp contact name
  useEffect(() => {
    if (contact.leadId) {
      supabase.from('crm_leads').select('name').eq('id', contact.leadId).single()
        .then(({ data }) => { setLeadName(nomeValido(data?.name)); });
    } else {
      setLeadName(null);
    }
  }, [contact.leadId]);

  // Load ALL connected instances
  useEffect(() => {
    const loadInstances = async () => {
      // `as any`: tem_credenciais é coluna nova e o types.ts gerado ainda não a conhece.
      const { data } = await (supabase as any)
        .from('whatsapp_instances')
        // Sem api_key/instance_token: credencial não trafega mais pro browser (o envio já
        // vai por edge function). `tem_credenciais` é coluna gerada e diz o que o filtro
        // abaixo precisa saber. Pedir as colunas revogadas fazia o select inteiro voltar
        // 42501 e a lista ficar vazia — daí o "Nenhuma instância conectada".
        .select('id, instance_name, phone_number, channel, status, provider, api_url, tem_credenciais, purpose, notes')
        .eq('status', 'connected');
      if (data && data.length > 0) {
        const usable = (data as WhatsAppInstance[]).filter(i =>
          i.provider === 'cloud_api' || (i as any).tem_credenciais,
        );
        const final = usable.length > 0 ? usable : data as WhatsAppInstance[];
        setInstances(final);
        const saved = localStorage.getItem('whatsapp_selected_instance');
        if (!saved || !final.some(d => d.id === saved)) {
          setSelectedInstanceId(final[0].id);
          localStorage.setItem('whatsapp_selected_instance', final[0].id);
        }
      }
    };
    loadInstances();
  }, []);

  // Persist selected instance
  const handleSelectInstance = (id: string) => {
    manualPickRef.current = contact.id;
    setSelectedInstanceId(id);
    localStorage.setItem('whatsapp_selected_instance', id);
  };

  // Load CRM columns for LeadDetailModal
  useEffect(() => {
    if (showLeadDetail && crmColumns.length === 0) {
      supabase.from('crm_columns').select('id, name').order('sort_order').then(({ data }) => {
        if (data) setCrmColumns(data);
      });
    }
  }, [showLeadDetail]);

  // Load chatbot pause state for this lead
  useEffect(() => {
    if (!contact.leadId) return;
    supabase.from('crm_leads').select('chatbot_paused_until').eq('id', contact.leadId).single()
      .then(({ data }) => {
        setChatbotPausedUntil((data as any)?.chatbot_paused_until || null);
      });
  }, [contact.leadId]);

  const isChatbotPaused = chatbotPausedUntil && new Date(chatbotPausedUntil) > new Date();

  const handlePauseChatbot = async (minutes: number | 'forever' | 'resume') => {
    if (!contact.leadId) { toast.error('Crie um lead primeiro'); return; }
    let pauseUntil: string | null = null;
    if (minutes === 'resume') {
      pauseUntil = null;
    } else if (minutes === 'forever') {
      pauseUntil = '2099-12-31T23:59:59Z';
    } else {
      pauseUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }
    await supabase.from('crm_leads').update({ chatbot_paused_until: pauseUntil } as any).eq('id', contact.leadId);
    setChatbotPausedUntil(pauseUntil);
    setPausePopoverOpen(false);
    toast.success(pauseUntil ? `IA pausada${minutes === 'forever' ? ' permanentemente' : ` por ${minutes} min`}` : 'IA reativada!');
  };

  // Mark as read on UAZAPI
  useEffect(() => {
    if (isConnected && instanceId && contact.phone) {
      supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'chat_read', instance_id: instanceId, number: contact.phone, read: true },
      }).catch(() => {});
    }
  }, [isConnected, instanceId, contact.phone]);

  // Load messages
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    const cleanPhone = contact.phone.replace(/\D/g, '');
    // Variantes EXATAS do telefone (com/sem 55, com/sem o 9 do celular) pra
    // casar com os formatos que o webhook grava. Antes era remote_phone.ilike.
    // %p% (curinga dos dois lados), que NAO usa indice e fazia seq scan na
    // tabela inteira a cada chat aberto (2-4s). Match exato via .in() usa o
    // indice idx_whatsapp_messages_remote_phone. Mensagens ja' ligadas ao lead
    // sao cobertas pelo lead_id.eq (indice idx_wa_messages_lead_created).
    const buildVariants = (clean: string): string[] => {
      if (!clean) return [];
      const set = new Set<string>();
      const no55 = clean.startsWith('55') ? clean.slice(2) : clean;
      for (const base of [clean, no55, '55' + no55]) set.add(base);
      if (no55.length === 11) {
        const semNove = no55.slice(0, 2) + no55.slice(3);
        set.add(semNove); set.add('55' + semNove);
      } else if (no55.length === 10) {
        const comNove = no55.slice(0, 2) + '9' + no55.slice(2);
        set.add(comNove); set.add('55' + comNove);
      }
      return [...set];
    };
    const phoneVariants = buildVariants(cleanPhone);
    const orParts: string[] = [];
    if (contact.leadId) orParts.push(`lead_id.eq.${contact.leadId}`);
    if (phoneVariants.length) orParts.push(`remote_phone.in.(${phoneVariants.join(',')})`);
    if (orParts.length === 0) { setMessages([]); setIsLoading(false); return; }

    // Pega as 200 mais RECENTES (descendente), depois inverte pra mostrar
    // cronologico. Antes era .order(asc).limit(200) — em conversa com mais
    // de 200 msgs (caso comum quando o lead tem leads duplicados, ex: 855
    // msgs da Victoria) as mensagens novas eram cortadas pelo limit e a UI
    // ficava parada nas mais antigas.
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('id, direction, message_type, content, media_url, status, is_read, created_at, whatsapp_message_id, instance_id, metadata')
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      const ordered = (data as WhatsAppMessage[]).slice().reverse();
      setMessages(ordered);
      const unreadIds = ordered.filter(m => !m.is_read && m.direction === 'inbound').map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('whatsapp_messages').update({ is_read: true }).in('id', unreadIds);
      }
    }
    setIsLoading(false);
  }, [contact.leadId, contact.phone]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime
  useEffect(() => {
    const cleanPhone = contact.phone.replace(/\D/g, '');
    const normalizeBRPhone = (phone: string): string => {
      let p = phone.replace(/\D/g, '');
      if (p.startsWith('55') && p.length === 12) {
        p = p.slice(0, 4) + '9' + p.slice(4);
      }
      return p;
    };
    const normalizedContact = normalizeBRPhone(cleanPhone);

    const channel = supabase
      .channel(`inline-chat-${contact.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new as any;
          const msgPhone = msg.remote_phone?.replace(/\D/g, '');
          const normalizedMsg = normalizeBRPhone(msgPhone || '');
          const isMatch = (contact.leadId && msg.lead_id === contact.leadId) || normalizedContact === normalizedMsg;
          if (!isMatch) return;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            // Dedup do optimistic: se ja temos um temp- com mesmo conteudo+direction
            // recente (<60s), substitui em vez de duplicar.
            if (msg.direction === 'outbound') {
              const tempIdx = prev.findIndex(m =>
                m.id.startsWith('temp-') &&
                m.direction === 'outbound' &&
                m.message_type === msg.message_type &&
                (m.content || '') === (msg.content || '') &&
                Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 60_000
              );
              if (tempIdx >= 0) {
                const next = [...prev];
                next[tempIdx] = msg;
                return next;
              }
            }
            return [...prev, msg];
          });
          if (msg.direction === 'inbound') {
            supabase.from('whatsapp_messages').update({ is_read: true }).eq('id', msg.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contact.id, contact.leadId, contact.phone]);

  // Rolagem no modelo do WhatsApp: desce sozinho só quando você JÁ está no fim. Se você
  // subiu para ler o histórico, a tela fica parada e aparece o aviso de mensagem nova —
  // antes qualquer mensagem que chegasse arrancava você de onde estava lendo.
  useEffect(() => {
    if (conversaAnteriorRef.current !== contact.id) {
      conversaAnteriorRef.current = contact.id;
      setTemMensagemNova(false);
      scrollToBottom('auto');   // conversa nova abre no fim, sem animação
      return;
    }
    if (!messages.length) return;
    if (estaNoFim()) {
      scrollToBottom();
      setTemMensagemNova(false);
    } else {
      // Só avisa se a mensagem é de quem está do outro lado; o que EU mando desce sempre.
      const ultima = messages[messages.length - 1];
      if (ultima?.direction === 'outbound') scrollToBottom();
      else setTemMensagemNova(true);
    }
  }, [messages, contact.id, estaNoFim, scrollToBottom]);

  // Voltou ao fim rolando na mão: some o aviso.
  useEffect(() => {
    const el = containerDeScroll();
    if (!el) return;
    const aoRolar = () => { if (estaNoFim()) setTemMensagemNova(false); };
    el.addEventListener('scroll', aoRolar, { passive: true });
    return () => el.removeEventListener('scroll', aoRolar);
  }, [containerDeScroll, estaNoFim, messages.length]);

  // Reagir com emoji em uma msg (manda pro UAZAPI + atualiza local)
  // useCallback pra estabilizar a referencia, permitindo memoizar o render
  // da lista de mensagens (evita refresh de 200 bubbles a cada keystroke).
  const handleReact = useCallback(async (msg: WhatsAppMessage, emoji: string) => {
    setReactionPickerFor(null);
    if (!instanceId || !msg.whatsapp_message_id) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const meta = (m.metadata || {}) as any;
      const reactions = Array.isArray(meta.reactions) ? [...meta.reactions] : [];
      const idx = reactions.findIndex((r: any) => r.from === 'me');
      const r = { from: 'me', name: 'Voce', emoji, at: new Date().toISOString() };
      if (idx >= 0) reactions[idx] = r; else reactions.push(r);
      return { ...m, metadata: { ...meta, reactions } };
    }));
    try {
      await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'message_react', instance_id: instanceId,
          number: contact.phone, message_id: msg.whatsapp_message_id, emoji,
        },
      });
    } catch (e: any) {
      toast.error('Erro ao reagir: ' + e.message);
    }
  }, [instanceId, contact.phone]);

  const cancelReply = useCallback(() => setReplyingTo(null), []);

  // Apaga uma msg propria no WhatsApp. UAZAPI message_delete usa o
  // whatsapp_message_id (key.id) — funciona enquanto a janela do WhatsApp
  // permitir (geralmente 2h ou ate o lead ter lido).
  const handleDeleteMessage = useCallback(async (msg: WhatsAppMessage) => {
    if (!instanceId || !msg.whatsapp_message_id) return;
    if (msg.direction !== 'outbound') {
      toast.error('Só dá pra apagar mensagens próprias');
      return;
    }
    if (!window.confirm('Apagar esta mensagem para todos?')) return;
    // Otimista — marca local como "apagada"
    setMessages(prev => prev.map(m => m.id === msg.id
      ? { ...m, content: '🗑️ Mensagem apagada', message_type: 'text', media_url: null }
      : m
    ));
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'message_delete', instance_id: instanceId, message_id: msg.whatsapp_message_id },
      });
      if (res.error) throw new Error(res.error.message || 'Falha ao apagar');
      // Marca soft-delete no DB pra refletir em outros devices
      await supabase.from('whatsapp_messages')
        .update({ content: '🗑️ Mensagem apagada', message_type: 'text', media_url: null } as any)
        .eq('id', msg.id);
      toast.success('Mensagem apagada');
    } catch (e: any) {
      toast.error('Erro ao apagar: ' + e.message);
    }
  }, [instanceId]);

  // Inicia edicao inline de uma msg propria (so texto, WhatsApp nao
  // permite editar midia). UI: barra de edicao acima do input, igual
  // ao reply preview. Confirmar manda message_edit pro UAZAPI.
  const startEditMessage = useCallback((msg: WhatsAppMessage) => {
    if (msg.direction !== 'outbound') return;
    if (msg.message_type !== 'text') {
      toast.error('Só dá pra editar mensagens de texto');
      return;
    }
    setEditingMsg(msg);
    setEditText(msg.content || '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMsg(null);
    setEditText('');
  }, []);

  const confirmEdit = useCallback(async () => {
    if (!editingMsg || !instanceId || !editingMsg.whatsapp_message_id) return;
    const newText = editText.trim();
    if (!newText || newText === editingMsg.content) {
      cancelEdit();
      return;
    }
    const msgId = editingMsg.id;
    const originalContent = editingMsg.content;
    // Otimista
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newText } : m));
    setEditingMsg(null);
    setEditText('');
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'message_edit', instance_id: instanceId,
          message_id: editingMsg.whatsapp_message_id, text: newText,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Falha ao editar');
      await supabase.from('whatsapp_messages').update({ content: newText } as any).eq('id', msgId);
      toast.success('Mensagem editada');
    } catch (e: any) {
      // Rollback otimista
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: originalContent } : m));
      toast.error('Erro ao editar: ' + e.message);
    }
  }, [editingMsg, editText, instanceId, cancelEdit]);

  // Busca leads do CRM pra envio de contato (vCard). UAZAPI send_contact
  // monta automaticamente o vCard a partir dos campos passados.
  const searchContacts = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setContactResults([]);
      return;
    }
    const { data } = await supabase
      .from('crm_leads')
      .select('id, name, whatsapp')
      .or(`name.ilike.%${term}%,whatsapp.ilike.%${term.replace(/\D/g, '')}%`)
      .not('whatsapp', 'is', null)
      .limit(8);
    setContactResults((data || []) as any);
  }, []);

  // Copia o conteudo da msg pro clipboard. Pra midia, copia a URL.
  const handleCopyMessage = useCallback(async (msg: WhatsAppMessage) => {
    const text = (() => {
      if (msg.message_type === 'text') return msg.content || '';
      if (msg.media_url) return msg.media_url;
      return msg.content || '';
    })();
    if (!text) {
      toast.error('Nada para copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado!');
    } catch {
      toast.error('Falha ao copiar');
    }
  }, []);

  // Encaminhar — abre dialog de selecao de destino. Replica a msg via
  // send_text/send_media (UAZAPI nao tem endpoint message_forward
  // exposto no nosso proxy, mas re-envio funciona perfeitamente e
  // mantem rastreio em whatsapp_messages).
  const openForward = useCallback((msg: WhatsAppMessage) => {
    setForwardingMsg(msg);
    setForwardSearch('');
    setForwardResults([]);
  }, []);

  const searchForwardTargets = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setForwardResults([]);
      return;
    }
    const { data } = await supabase
      .from('crm_leads')
      .select('id, name, whatsapp')
      .or(`name.ilike.%${term}%,whatsapp.ilike.%${term.replace(/\D/g, '')}%`)
      .not('whatsapp', 'is', null)
      .limit(8);
    setForwardResults((data || []) as any);
  }, []);

  const executeForward = useCallback(async (target: { id: string; name: string; whatsapp: string | null }) => {
    if (!forwardingMsg || !instanceId || !target.whatsapp) return;
    const targetPhone = target.whatsapp.replace(/\D/g, '');
    const msg = forwardingMsg;
    setForwardingMsg(null);
    try {
      if (msg.message_type === 'text') {
        const res = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            action: 'send_text', instance_id: instanceId,
            phone: targetPhone, text: msg.content || '',
            lead_id: target.id, readchat: false,
          },
        });
        if (res.error) throw new Error(res.error.message);
      } else if (msg.media_url && ['image', 'video', 'audio', 'ptt', 'ptv', 'document'].includes(msg.message_type)) {
        const res = await supabase.functions.invoke('uazapi-proxy', {
          body: {
            action: 'send_media', instance_id: instanceId,
            phone: targetPhone, type: msg.message_type,
            file: msg.media_url, caption: msg.content || '',
            lead_id: target.id, readchat: false,
          },
        });
        if (res.error) throw new Error(res.error.message);
      } else {
        throw new Error('Tipo de mensagem não pode ser encaminhado');
      }
      toast.success(`Encaminhado para ${target.name}`);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  }, [forwardingMsg, instanceId]);

  const handleSendContact = useCallback(async (lead: { id: string; name: string; whatsapp: string | null }) => {
    if (!instanceId || !lead.whatsapp || sendingContact) return;
    setSendingContact(true);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: WhatsAppMessage = {
      id: tempId,
      direction: 'outbound',
      message_type: 'contact',
      content: `👤 ${lead.name} • ${lead.whatsapp}`,
      media_url: null,
      status: 'sending',
      is_read: true,
      created_at: new Date().toISOString(),
      whatsapp_message_id: null,
      instance_id: instanceId,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_contact', instance_id: instanceId, phone: contact.phone,
          fullName: lead.name, phoneNumber: lead.whatsapp.replace(/\D/g, ''),
        },
      });
      if (res.error) throw new Error(res.error.message || 'Falha ao enviar contato');
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      toast.success('Contato enviado');
      setShowContactPicker(false);
      setContactSearch('');
      setContactResults([]);
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      toast.error('Erro: ' + e.message);
    }
    setSendingContact(false);
  }, [instanceId, contact.phone, sendingContact]);

  // Snippet curto pra mostrar no quote preview
  const quotePreview = useCallback((msg: WhatsAppMessage): string => {
    if (msg.message_type === 'image') return '📷 Foto';
    if (msg.message_type === 'video') return '🎥 Video';
    if (msg.message_type === 'ptv') return '🎥 Video instantâneo';
    if (msg.message_type === 'audio' || msg.message_type === 'ptt') return '🎤 Audio';
    if (msg.message_type === 'document') return '📄 Documento';
    if (msg.message_type === 'sticker') return '🏷️ Figurinha';
    if (msg.message_type === 'location') return '📍 Localizacao';
    return (msg.content || '').slice(0, 80);
  }, []);

  // Download media
  const handleDownloadMedia = useCallback(async (msg: WhatsAppMessage) => {
    if (!msg.whatsapp_message_id || !instanceId) return null;
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'message_download', instance_id: instanceId, message_id: msg.whatsapp_message_id, return_link: true },
      });
      // UAZAPI 2.x retorna fileURL (nao url/link)
      const d = res.data?.data || {};
      const url = d.fileURL || d.url || d.link || d.file_url || null;
      if (url) {
        await supabase.from('whatsapp_messages').update({ media_url: url }).eq('id', msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, media_url: url } : m));
        return url;
      }
    } catch (e) { console.error('Download failed:', e); }
    return null;
  }, [instanceId]);

  const handleSend = async () => {
    if (!newMessage.trim() || !instanceId || isSending) return;
    // Converte cada mencao "@Nome" -> "@<numero>" (o WhatsApp so renderiza a
    // mencao se o numero estiver no texto) e monta o array de telefones. So
    // conta mencoes cujo token ainda esta no texto (usuario pode ter apagado).
    let text = newMessage.trim();
    const mentions: string[] = [];
    for (const m of mentionsRef.current) {
      if (text.includes(m.token)) {
        text = text.replace(m.token, `@${m.phone}`);
        mentions.push(m.phone);
      }
    }
    mentionsRef.current = [];
    setMentionQuery(null);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Optimistic insert — mensagem aparece na hora com status 'sending'
    const optimistic: WhatsAppMessage = {
      id: tempId,
      direction: 'outbound',
      message_type: 'text',
      content: text,
      media_url: null,
      status: 'sending',
      is_read: true,
      created_at: new Date().toISOString(),
      whatsapp_message_id: null,
      instance_id: instanceId,
    };
    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');
    // Reset altura do textarea após enviar (auto-resize deixa ele grande)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
    const replyId = replyingTo?.whatsapp_message_id || null;
    setReplyingTo(null);
    const sendViaProvider = activeProvider === 'cloud_api'
      ? supabase.functions.invoke('wa-send-cloud', {
          body: {
            action: 'send_text', instance_id: instanceId, phone: contact.phone,
            text, lead_id: contact.leadId,
          },
        })
      : supabase.functions.invoke('uazapi-proxy', {
          body: {
            action: 'send_text', instance_id: instanceId, phone: contact.phone,
            text, lead_id: contact.leadId, board_id: contact.boardId, readchat: true,
            ...(replyId ? { replyid: replyId } : {}),
            ...(mentions.length ? { mentions } : {}),
          },
        });

    sendViaProvider.then((res) => {
      if (res.data?.success) {
        const realId = res.data?.data?.key?.id || res.data?.data?.messageId || res.data?.message_id || null;
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent', whatsapp_message_id: realId } : m));
      } else {
        const errMsg = res.data?.error || res.data?.details?.error?.message || '';
        const isWindowClosed = errMsg.includes('Re-engagement message') || errMsg.includes('24') || errMsg.includes('template');
        if (isWindowClosed && activeProvider === 'cloud_api') {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
          toast.error('Janela de 24h fechada. Use um template aprovado pra iniciar a conversa.');
        } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
          toast.error(errMsg || 'Erro ao enviar');
        }
      }
    }).catch((e: any) => {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      toast.error(e.message);
    });
  };

  // ==================== FILE UPLOAD ====================
  const detectFileType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const type = detectFileType(file);
    let preview: string | null = null;
    if (type === 'image' || type === 'video') {
      preview = URL.createObjectURL(file);
    }
    setUploadingFile({ file, preview, type });
  };

  const handleUploadAndSend = async () => {
    if (!uploadingFile || !instanceId) return;
    const { file, type } = uploadingFile;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localUrl = URL.createObjectURL(file);
    // Optimistic insert
    const optimistic: WhatsAppMessage = {
      id: tempId,
      direction: 'outbound',
      message_type: type,
      content: type === 'document' ? file.name : null,
      media_url: localUrl,
      status: 'sending',
      is_read: true,
      created_at: new Date().toISOString(),
      whatsapp_message_id: null,
      instance_id: instanceId,
    };
    setMessages(prev => [...prev, optimistic]);
    setUploadingFile(null);
    setIsSending(true);
    setUploadProgress(10);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${contact.phone}/${Date.now()}.${ext}`;
      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);
      setUploadProgress(70);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      setUploadProgress(85);
      const replyId = replyingTo?.whatsapp_message_id || null;
      setReplyingTo(null);
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_media', instance_id: instanceId, phone: contact.phone,
          type, file: publicUrl, docName: file.name,
          lead_id: contact.leadId, board_id: contact.boardId, readchat: true,
          ...(replyId ? { replyid: replyId } : {}),
        },
      });
      setUploadProgress(100);
      if (res.data?.success) {
        const realId = res.data?.data?.key?.id || res.data?.data?.messageId || null;
        setMessages(prev => prev.map(m => m.id === tempId ? {
          ...m, status: 'sent', media_url: publicUrl, whatsapp_message_id: realId,
        } : m));
        toast.success('Arquivo enviado!');
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        toast.error(res.data?.error || 'Erro ao enviar');
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      toast.error(e.message);
    }
    setIsSending(false);
    setUploadProgress(0);
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Audio recording
  // Escolhe o melhor codec que o browser suporta. WhatsApp Web grava em
  // webm/opus e funciona, entao priorizamos esse. Safari fica com mp4/aac.
  const pickAudioMime = (): { mime: string; ext: string } => {
    if (typeof MediaRecorder === 'undefined') return { mime: '', ext: 'webm' };
    const candidates = [
      { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/mp4', ext: 'm4a' },
      { mime: 'audio/webm', ext: 'webm' },
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return { mime: '', ext: 'webm' };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mime, ext } = pickAudioMime();
      const mediaRecorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        // Cancelado pelo user durante a gravacao — para o stream sem enviar.
        // Why: cancelRecording mata os tracks do stream, o que dispara onstop
        // automaticamente; sem essa flag, o audio gravado ate o cancelamento ia
        // pra UAZAPI mesmo assim.
        if (recordingCancelledRef.current) {
          audioChunksRef.current = [];
          recordingCancelledRef.current = false;
          return;
        }
        // Usa o mime real do recorder pro Blob (nao mente sobre o container)
        const recordedMime = mediaRecorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: recordedMime });
        if (!instanceId || blob.size === 0) return;

        // Optimistic insert — mostra mensagem na hora com URL local (object URL)
        const localUrl = URL.createObjectURL(blob);
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // Se o browser conseguiu gravar em ogg/opus, manda como ptt (msg de voz
        // com bolinha do mic no WhatsApp). Caso contrario manda como audio
        // normal — UAZAPI/WhatsApp aceita formatos variados quando type=audio,
        // mas type=ptt exige OGG/Opus estrito.
        const isOggOpus = recordedMime.includes('ogg') && recordedMime.includes('opus');
        const sendType = isOggOpus ? 'ptt' : 'audio';

        const optimistic: WhatsAppMessage = {
          id: tempId,
          direction: 'outbound',
          message_type: sendType,
          content: null,
          media_url: localUrl,
          status: 'sending',
          is_read: true,
          created_at: new Date().toISOString(),
          whatsapp_message_id: null,
          instance_id: instanceId,
        };
        setMessages(prev => [...prev, optimistic]);

        setIsSending(true);
        try {
          // Sobe o audio pro Supabase Storage primeiro (em vez de mandar base64
          // gigante via JSON, que fazia o realtime descartar/atrasar)
          const path = `${contact.phone}/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(path, blob, { cacheControl: '3600', contentType: recordedMime, upsert: false });
          if (uploadError) throw new Error(`Upload audio falhou: ${uploadError.message}`);
          const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
          const publicUrl = urlData.publicUrl;

          const replyId = replyingTo?.whatsapp_message_id || null;
          setReplyingTo(null);
          const res = await supabase.functions.invoke('uazapi-proxy', {
            body: {
              action: 'send_media', instance_id: instanceId, phone: contact.phone,
              type: sendType, file: publicUrl,
              lead_id: contact.leadId, board_id: contact.boardId, readchat: true,
              ...(replyId ? { replyid: replyId } : {}),
            },
          });
          if (res.data?.success) {
            const realId = res.data?.data?.key?.id || res.data?.data?.messageId || null;
            setMessages(prev => prev.map(m => m.id === tempId ? {
              ...m, status: 'sent', media_url: publicUrl, whatsapp_message_id: realId,
            } : m));
            toast.success('Áudio enviado!');
          } else {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
            toast.error(res.data?.error || 'Erro ao enviar áudio');
          }
        } catch (e: any) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
          toast.error(e.message);
        }
        setIsSending(false);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e) {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    // Marca cancelamento ANTES de parar — onstop checa essa flag e aborta.
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // stop() dispara onstop com a flag setada; tambem para o stream.
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  // ===== Mencao (@) em grupo: carrega participantes do grupo aberto =====
  // OBS: whatsapp_group_participants hoje so tem quem JA falou no grupo (o
  // espiao grava por mensagem). Pra roster completo falta um sync via
  // /group/info da UAZAPI (a fazer). Pra grupos com espiao ativo ja da pra
  // mencionar quem participou.
  useEffect(() => {
    if (!contact.isGroup) { setParticipants([]); return; }
    const jid = (contact.phone || '').replace(/\D/g, '');
    if (!jid) { setParticipants([]); return; }
    let cancelled = false;

    const merge = (rows: { phone: any; name: any }[]) => {
      if (cancelled) return;
      setParticipants(prev => {
        const map = new Map<string, string>();
        for (const p of prev) map.set(p.phone, p.name);
        for (const p of rows) {
          const phone = String(p.phone || '').replace(/\D/g, '');
          if (!phone) continue;
          const name = (p.name || '').trim();
          // nome real do roster tem prioridade sobre o telefone-como-nome
          if (name || !map.has(phone)) map.set(phone, name || map.get(phone) || phone);
        }
        return Array.from(map, ([phone, name]) => ({ phone, name: name || phone }));
      });
    };

    (async () => {
      // 1) cache local (quem ja falou) — instantaneo
      const { data } = await supabase
        .from('whatsapp_group_participants')
        .select('phone, name')
        .eq('group_jid', jid)
        .order('message_count', { ascending: false })
        .limit(500);
      merge((data || []) as any[]);

      // 2) roster COMPLETO via /group/info (traz quem nunca falou tambem)
      if (instanceId) {
        try {
          const res = await supabase.functions.invoke('uazapi-proxy', {
            body: { action: 'group_participants', instance_id: instanceId, group_jid: jid },
          });
          const parts = res.data?.data?.participants || res.data?.participants || [];
          if (Array.isArray(parts) && parts.length) merge(parts);
        } catch { /* roster e best-effort; cache local ja cobre o basico */ }
      }
    })();
    return () => { cancelled = true; };
  }, [contact.isGroup, contact.phone, instanceId]);

  // Detecta o token @ que o cursor esta editando (ex: "oi @jo|") -> {query,start}
  const activeMentionToken = (value: string, caret: number): { query: string; start: number } | null => {
    const upto = value.slice(0, caret);
    const m = upto.match(/(?:^|\s)@([^\s@]*)$/);
    if (!m) return null;
    return { query: m[1], start: caret - m[1].length - 1 };
  };

  const mentionMatches = (mentionQuery === null ? [] : participants.filter(p => {
    const q = mentionQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.phone.includes(q.replace(/\D/g, ''));
  })).slice(0, 6);

  // Reavalia o dropdown de mencao conforme o usuario digita/move o cursor
  const refreshMentionState = (value: string, caret: number) => {
    if (!contact.isGroup) { setMentionQuery(null); return; }
    const tok = activeMentionToken(value, caret);
    setMentionQuery(tok ? tok.query : null);
    setMentionIndex(0);
  };

  // Insere o participante escolhido no lugar do token @ e registra a mencao
  const pickMention = (p: { phone: string; name: string }) => {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? newMessage.length;
    const tok = activeMentionToken(newMessage, caret);
    if (!tok) return;
    const display = `@${p.name}`;
    const before = newMessage.slice(0, tok.start);
    const after = newMessage.slice(caret);
    const next = `${before}${display} ${after}`;
    mentionsRef.current = [
      ...mentionsRef.current.filter(m => m.phone !== p.phone),
      { token: display, phone: p.phone },
    ];
    setNewMessage(next);
    setMentionQuery(null);
    setTimeout(() => {
      if (!inputRef.current) return;
      const pos = (before + display + ' ').length;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(pos, pos);
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 144)}px`;
    }, 0);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Com o dropdown de mencao aberto, as setas/Enter/Tab navegam a lista
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionMatches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mentionMatches[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Insere emoji no input no ponto onde o cursor estiver (ou no fim, se o
  // input nao tiver foco). Mantem o foco no input apos inserir pra
  // continuar digitando.
  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) {
      setNewMessage(prev => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? newMessage.length;
    const end = el.selectionEnd ?? newMessage.length;
    const next = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(next);
    // Restaura cursor logo apos o emoji
    setTimeout(() => {
      if (!inputRef.current) return;
      const pos = start + emoji.length;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(pos, pos);
    }, 0);
  };

  // Helper interno — envia 1 ponto de localizacao (usado tanto pelo
  // envio "atual" quanto pelos updates periodicos do "tempo real").
  const sendSingleLocation = useCallback(async (
    lat: number, lng: number, name: string = 'Localização', asLive: boolean = false
  ) => {
    if (!instanceId) return;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prefix = asLive ? '🔴 Ao vivo' : '📍';
    const optimistic: WhatsAppMessage = {
      id: tempId,
      direction: 'outbound',
      message_type: 'location',
      content: `${prefix} ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      media_url: null,
      status: 'sending',
      is_read: true,
      created_at: new Date().toISOString(),
      whatsapp_message_id: null,
      instance_id: instanceId,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_location', instance_id: instanceId, phone: contact.phone,
          latitude: lat, longitude: lng, name, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        },
      });
      if (!res.error) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  }, [instanceId, contact.phone]);

  // Click no botao de localizacao agora abre o dialog (antes mandava direto)
  const handleOpenLocationDialog = () => {
    if (liveLocationActive) {
      // Ja tem live rolando — abrir o dialog mostra opcao de parar
      setShowLocationDialog(true);
      return;
    }
    setShowLocationDialog(true);
  };

  // Envia 1 ponto atual e fecha o dialog
  const handleSendCurrentLocation = async () => {
    if (!instanceId || sendingLocation) return;
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }
    setSendingLocation(true);
    setShowLocationDialog(false);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 30000,
        });
      });
      const { latitude, longitude } = position.coords;
      await sendSingleLocation(latitude, longitude, 'Localização atual', false);
      toast.success('Localização enviada');
    } catch (e: any) {
      if (e?.code === 1) toast.error('Permissão de localização negada');
      else if (e?.code === 3) toast.error('Timeout obtendo localização');
      else toast.error(e?.message || 'Erro ao obter localização');
    }
    setSendingLocation(false);
  };

  // Compartilhamento ao vivo — manda 1 ponto agora, depois 1 a cada 30s.
  // Para automatico apos `durationMinutes`. Mostra faixa no topo com tempo
  // restante e botao de parar. Usa watchPosition pra manter a posicao
  // atualizada em background; o interval e que dispara o envio.
  const startLiveLocation = useCallback(async (durationMinutes: number) => {
    if (!instanceId) return;
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada');
      return;
    }
    setShowLocationDialog(false);

    // Pega posicao inicial pra mandar imediatamente
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            lastKnownPositionRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
            sendSingleLocation(p.coords.latitude, p.coords.longitude, 'Compartilhamento ao vivo', true);
            resolve();
          },
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      });
    } catch (e: any) {
      if (e?.code === 1) toast.error('Permissão de localização negada');
      else toast.error('Erro ao obter localização inicial');
      return;
    }

    // watchPosition mantem a posicao mais recente atualizada
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        lastKnownPositionRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
      },
      (err) => console.warn('[LiveLocation] watch error:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    liveLocationWatchRef.current = watchId;

    setLiveLocationActive(true);
    const totalSec = durationMinutes * 60;
    setLiveLocationRemaining(totalSec);

    // Manda update a cada 30s
    liveLocationIntervalRef.current = setInterval(() => {
      const pos = lastKnownPositionRef.current;
      if (pos) sendSingleLocation(pos.lat, pos.lng, 'Compartilhamento ao vivo', true);
    }, 30_000);

    // Countdown visivel + auto-stop
    liveLocationCountdownRef.current = setInterval(() => {
      setLiveLocationRemaining(prev => {
        if (prev <= 1) {
          stopLiveLocation(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    toast.success(`Localização ao vivo iniciada (${durationMinutes} min)`);
  }, [instanceId, sendSingleLocation]);

  const stopLiveLocation = useCallback((silent: boolean = false) => {
    if (liveLocationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(liveLocationWatchRef.current);
      liveLocationWatchRef.current = null;
    }
    if (liveLocationIntervalRef.current) {
      clearInterval(liveLocationIntervalRef.current);
      liveLocationIntervalRef.current = null;
    }
    if (liveLocationCountdownRef.current) {
      clearInterval(liveLocationCountdownRef.current);
      liveLocationCountdownRef.current = null;
    }
    setLiveLocationActive(false);
    setLiveLocationRemaining(0);
    lastKnownPositionRef.current = null;
    if (!silent && instanceId) {
      // Manda 1 mensagem de texto avisando que parou
      supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_text', instance_id: instanceId, phone: contact.phone,
          text: '📍 Compartilhamento de localização encerrado.',
          lead_id: contact.leadId, readchat: false,
        },
      }).catch(() => {});
      toast.info('Localização ao vivo encerrada');
    }
  }, [instanceId, contact.phone, contact.leadId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveLocationWatchRef.current !== null) navigator.geolocation.clearWatch(liveLocationWatchRef.current);
      if (liveLocationIntervalRef.current) clearInterval(liveLocationIntervalRef.current);
      if (liveLocationCountdownRef.current) clearInterval(liveLocationCountdownRef.current);
    };
  }, []);

  // Recebe o blob do VideoPTVRecorder: sobe pro storage, dispara send_media
  // com type=ptv (instant video circular do WhatsApp). UAZAPI aceita 'ptv'
  // como tipo de midia — o WhatsApp renderiza redondo, igual nota de voz.
  const handleSendPTV = async (blob: Blob, mime: string, ext: string, durationSec: number) => {
    if (!instanceId) {
      toast.error('Sem instância conectada');
      setShowVideoPTV(false);
      return;
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localUrl = URL.createObjectURL(blob);
    const optimistic: WhatsAppMessage = {
      id: tempId,
      direction: 'outbound',
      message_type: 'ptv',
      content: null,
      media_url: localUrl,
      status: 'sending',
      is_read: true,
      created_at: new Date().toISOString(),
      whatsapp_message_id: null,
      instance_id: instanceId,
    };
    setMessages(prev => [...prev, optimistic]);
    setIsSending(true);
    try {
      const path = `${contact.phone}/${Date.now()}.${ext || 'webm'}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { cacheControl: '3600', contentType: mime || 'video/webm', upsert: false });
      if (uploadError) throw new Error(`Upload vídeo falhou: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const replyId = replyingTo?.whatsapp_message_id || null;
      setReplyingTo(null);
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_media',
          instance_id: instanceId,
          phone: contact.phone,
          type: 'ptv',
          file: publicUrl,
          lead_id: contact.leadId,
          board_id: contact.boardId,
          readchat: true,
          ...(replyId ? { replyid: replyId } : {}),
        },
      });
      if (res.data?.success !== false && !res.error) {
        const realId = res.data?.data?.key?.id || res.data?.data?.messageId || null;
        setMessages(prev => prev.map(m => m.id === tempId ? {
          ...m, status: 'sent', media_url: publicUrl, whatsapp_message_id: realId,
        } : m));
        toast.success('Vídeo enviado!');
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        toast.error(res.data?.error || res.error?.message || 'Erro ao enviar vídeo');
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      toast.error(e.message);
    }
    setIsSending(false);
    setShowVideoPTV(false);
  };

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="w-3 h-3 text-blue-400" />;
      case 'delivered': return <CheckCheck className="w-3 h-3 text-green-200" />;
      case 'sent': return <Check className="w-3 h-3 text-green-200" />;
      case 'sending': return <RefreshCw className="w-3 h-3 text-white/50 animate-spin" />;
      case 'failed': return <X className="w-3 h-3 text-red-400" />;
      default: return <Check className="w-3 h-3 text-green-300/50" />;
    }
  }, []);

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Identificacao real de por onde a mensagem passou: NOME + NUMERO + tipo
  // (OFICIAL / COEX / NAO OFICIAL). O channel sozinho ("Comercial") se repete
  // nas 3 instancias e confunde na hora de ligar pro lead.
  const renderChannelBadge = useCallback((msg: WhatsAppMessage) => {
    if (!msg.instance_id) return null;
    const inst = instanceMap[msg.instance_id];
    if (!inst) return null;
    const style = getChannelStyle(inst.channel);
    const tag = getInstanceTag(inst);
    const phone = formatInstancePhone(inst.phone_number);
    return (
      <div
        className="flex items-center gap-1 mb-0.5 flex-wrap"
        title={`${describeInstance(inst)} · canal ${style.label}`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        <span className={`text-[10px] font-semibold ${style.color}`}>{shortInstanceName(inst.instance_name)}</span>
        {phone && <span className="text-[10px] font-mono text-muted-foreground">{phone}</span>}
        <span className={`text-[9px] px-1 py-px rounded font-semibold uppercase tracking-wide ${tag.className}`}>
          {tag.label}
        </span>
      </div>
    );
  }, [instanceMap]);

  const renderMessageContent = useCallback((msg: WhatsAppMessage) => {
    const needsDownload = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(msg.message_type) && !msg.media_url;

    switch (msg.message_type) {
      case 'sticker':
        return (
          <div>
            {msg.media_url ? (
              <img src={msg.media_url} alt="figurinha" className="w-[120px] h-[120px] object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.media_url!, '_blank')} />
            ) : needsDownload ? (
              <button onClick={() => handleDownloadMedia(msg)} className="flex items-center gap-2 text-xs text-emerald-300 hover:text-emerald-200 py-2 transition-colors">
                <Download className="w-4 h-4" /> Carregar figurinha
              </button>
            ) : (
              <span className="text-xs italic">🏷️ Figurinha</span>
            )}
          </div>
        );
      case 'image':
        return (
          <div>
            {msg.media_url ? (
              <img src={msg.media_url} alt="" className="max-w-[260px] rounded-lg mb-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.media_url!, '_blank')} />
            ) : needsDownload ? (
              <button onClick={() => handleDownloadMedia(msg)} className="flex items-center gap-2 text-xs text-emerald-300 hover:text-emerald-200 py-2 transition-colors">
                <Download className="w-4 h-4" /> Carregar imagem
              </button>
            ) : null}
            {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
          </div>
        );
      case 'video':
        return (
          <div>
            {msg.media_url ? (
              <video src={msg.media_url} controls className="max-w-[260px] rounded-lg mb-1" />
            ) : needsDownload ? (
              <button onClick={() => handleDownloadMedia(msg)} className="flex items-center gap-2 text-xs text-emerald-300 hover:text-emerald-200 py-2 transition-colors">
                <Download className="w-4 h-4" /> Carregar vídeo
              </button>
            ) : null}
            {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
          </div>
        );
      case 'ptv':
        return (
          <div>
            {msg.media_url ? (
              <video
                src={msg.media_url}
                controls
                className="w-[220px] h-[220px] rounded-full object-cover mb-1 bg-black"
              />
            ) : needsDownload ? (
              <button onClick={() => handleDownloadMedia(msg)} className="flex items-center gap-2 text-xs text-emerald-300 hover:text-emerald-200 py-2 transition-colors">
                <Download className="w-4 h-4" /> Carregar vídeo instantâneo
              </button>
            ) : (
              <span className="text-xs italic">🎥 Vídeo instantâneo</span>
            )}
          </div>
        );
      case 'contact':
        return (
          <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600/40 to-pink-700/40 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-purple-200" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{(msg.content || 'Contato').replace(/^👤\s*/, '').split('•')[0]?.trim() || 'Contato'}</p>
              <p className="text-[11px] text-white/60 truncate">{(msg.content || '').split('•')[1]?.trim() || 'vCard'}</p>
            </div>
          </div>
        );
      case 'location':
        return (
          <a
            href={(() => {
              const m = (msg.content || '').match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
              return m ? `https://www.google.com/maps?q=${m[1]},${m[2]}` : '#';
            })()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-black/10 rounded-lg hover:bg-black/20 transition-colors"
          >
            <MapPin className="w-5 h-5 flex-shrink-0 text-red-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Localização</p>
              <p className="text-[11px] text-white/60 truncate">{msg.content || 'Toque para abrir no mapa'}</p>
            </div>
          </a>
        );
      case 'audio': case 'ptt':
        return msg.media_url ? (
          <AudioPlayer
            src={msg.media_url}
            isOutbound={msg.direction === 'outbound'}
            variant={msg.message_type === 'ptt' ? 'ptt' : 'audio'}
          />
        ) : needsDownload ? (
          <AudioAutoLoader msg={msg} onDownload={handleDownloadMedia} />
        ) : (
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 flex-shrink-0 text-green-400" />
            <span className="text-xs italic">Áudio</span>
          </div>
        );
      case 'document': {
        const filename = msg.content || 'Documento';
        const url = msg.media_url || '';
        // PDF detectado pelo MIME implicito no URL (.pdf) ou pelo
        // nome do arquivo. PDF ganha preview embed inline.
        const isPdf = /\.pdf(\?|$)/i.test(url) || /\.pdf$/i.test(filename);
        const ext = filename.split('.').pop()?.toUpperCase() || '';
        return (
          <div className="flex flex-col gap-1.5">
            {isPdf && url && (
              // Preview inline do PDF — iframe com toolbar oculta pra
              // visualizar primeira pagina diretamente na bolha. Click
              // abre em nova aba pro PDF completo.
              <a href={url} target="_blank" rel="noopener noreferrer" className="block relative group/pdf">
                <iframe
                  src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                  className="w-[260px] h-[300px] rounded-lg border border-white/10 bg-white pointer-events-none"
                  title={filename}
                />
                <div className="absolute inset-0 rounded-lg ring-0 group-hover/pdf:ring-2 ring-emerald-400/50 transition-all" />
                <div className="absolute bottom-2 right-2 bg-black/70 rounded-full p-1.5 opacity-0 group-hover/pdf:opacity-100 transition-opacity">
                  <Download className="w-3.5 h-3.5 text-white" />
                </div>
              </a>
            )}
            <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
              <div className="w-9 h-9 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{filename}</p>
                {ext && <p className="text-[10px] text-white/50 uppercase">{ext}</p>}
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" title="Baixar"><Download className="w-4 h-4 hover:text-blue-400 transition-colors" /></a>
              ) : needsDownload ? (
                <button onClick={() => handleDownloadMedia(msg)} title="Carregar"><Download className="w-4 h-4 text-emerald-300 hover:text-emerald-200" /></button>
              ) : null}
            </div>
          </div>
        );
      }
      default: {
        const vc = msg.content ? parseVcard(msg.content) : null;
        if (vc) {
          return (
            <div className="flex flex-col gap-2 min-w-[210px]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{vc.name}</p>
                  <p className="text-xs text-white/60">{vc.phone}</p>
                </div>
              </div>
              <button
                onClick={() => onOpenContact?.({
                  id: vc.phone, leadId: null, name: vc.name, phone: vc.phone,
                  profilePic: null, lastMessage: null, lastMessageAt: null, unreadCount: 0, boardId: null,
                })}
                disabled={!onOpenContact}
                className="text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-200 rounded-md py-1.5 px-2 transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Abrir conversa
              </button>
            </div>
          );
        }
        return msg.content ? <p className="whitespace-pre-wrap break-words text-sm">{renderWithLinks(msg.content)}</p> :
          <p className="text-xs italic text-white/40">Mensagem sem conteúdo</p>;
      }
    }
  }, [handleDownloadMedia, onOpenContact]);

  // Memoiza a lista renderizada — antes, a cada keystroke no input ou a
  // cada update de estado nao relacionado (recording, isSending, etc.) os
  // 200 message bubbles eram recriados. Agora so refaz quando messages /
  // instanceMap / reactionPickerFor mudam.
  const renderedMessages = useMemo(() => {
    return messages.map((msg, idx) => {
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
          <div className={`group/msg flex relative items-start ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[80%] ${msg.message_type === 'sticker' ? 'bg-transparent shadow-none' : 'rounded-lg px-3 py-1.5 shadow-sm'} text-sm ${
              msg.message_type === 'sticker' ? '' : isOutbound ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
            }`}>
              {/* Menu de acoes — sempre visivel no canto da bolha. Click
                  abre dropdown com Reagir / Responder / Encaminhar /
                  Copiar / Editar / Apagar / Info. Substitui o hover bar
                  antigo (que ficava invisivel pra muita gente). */}
              {msg.message_type !== 'sticker' && !msg.id.startsWith('temp-') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`absolute top-1 ${isOutbound ? 'right-1' : 'right-1'} w-6 h-6 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white hover:text-white transition-all opacity-90 z-10 shadow-md`}
                      title="Mais ações"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isOutbound ? 'end' : 'start'} className="w-52">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-sm">
                        <Smile className="w-4 h-4 mr-2" />
                        Reagir
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="flex gap-1 p-1.5">
                        {['👍','❤️','😂','😮','😢','🙏','🔥','✅'].map(emo => (
                          <button
                            key={emo}
                            onClick={() => msg.whatsapp_message_id && handleReact(msg, emo)}
                            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-lg transition-transform hover:scale-125"
                          >
                            {emo}
                          </button>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => setReplyingTo(msg)} className="text-sm">
                      <Reply className="w-4 h-4 mr-2" /> Responder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openForward(msg)} className="text-sm">
                      <Forward className="w-4 h-4 mr-2" /> Encaminhar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyMessage(msg)} className="text-sm">
                      <Copy className="w-4 h-4 mr-2" /> Copiar
                    </DropdownMenuItem>
                    {isOutbound && msg.message_type === 'text' && (
                      <DropdownMenuItem onClick={() => startEditMessage(msg)} className="text-sm">
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setInfoMsg(msg)} className="text-sm">
                      <Info className="w-4 h-4 mr-2" /> Detalhes
                    </DropdownMenuItem>
                    {isOutbound && (
                      <DropdownMenuItem onClick={() => handleDeleteMessage(msg)} className="text-sm text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Apagar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {renderChannelBadge(msg)}
              {(contact.isGroup || (contact.phone || '').replace(/\D/g, '').length >= 15) && !isOutbound && (msg.metadata?.senderName || msg.metadata?.contact_name) && (
                <div className="flex items-center gap-1.5 mb-1">
                  {(msg.metadata?.chat_details_pic || msg.metadata?.chat_image) ? (
                    <img src={msg.metadata.chat_details_pic || msg.metadata.chat_image} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center text-[9px] font-bold text-emerald-200 flex-shrink-0">
                      {(msg.metadata.senderName || msg.metadata.contact_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[11px] font-semibold text-emerald-300 truncate">{msg.metadata.senderName || msg.metadata.contact_name}</span>
                </div>
              )}
              {msg.metadata?.quoted && (msg.metadata.quoted.content || msg.metadata.quoted.type) && (
                <div className={`border-l-2 ${isOutbound ? 'border-emerald-300' : 'border-blue-300'} pl-2 py-1 mb-1 bg-black/20 rounded text-xs opacity-90`}>
                  <p className="text-[10px] font-semibold opacity-70">{msg.metadata.quoted.from || 'Mensagem'}</p>
                  <p className="truncate max-w-[220px]">{msg.metadata.quoted.content || `${msg.metadata.quoted.type}`}</p>
                </div>
              )}
              {renderMessageContent(msg)}
              {msg.message_type !== 'sticker' && (
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[10px] text-white/50">{format(new Date(msg.created_at), 'HH:mm')}</span>
                  {isOutbound && getStatusIcon(msg.status)}
                </div>
              )}
              {msg.message_type === 'template' && (
                <TemplateExtras templateName={msg.metadata?.template_name} isOutbound={isOutbound} />
              )}
              {Array.isArray(msg.metadata?.reactions) && msg.metadata.reactions.length > 0 && (
                <div className={`absolute -bottom-3 ${isOutbound ? 'right-2' : 'left-2'} flex gap-0.5 bg-[#1a252c] border border-border rounded-full px-1.5 py-0.5 shadow-md`}>
                  {Array.from(new Set(msg.metadata.reactions.map((r: MsgReaction) => r.emoji))).slice(0, 3).map(emo => (
                    <span key={emo} className="text-xs leading-none">{emo}</span>
                  ))}
                  {msg.metadata.reactions.length > 1 && (
                    <span className="text-[9px] text-white/60 ml-0.5">{msg.metadata.reactions.length}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </React.Fragment>
      );
    });
  }, [messages, reactionPickerFor, handleReact, renderChannelBadge, renderMessageContent, getStatusIcon, startEditMessage, handleDeleteMessage, handleCopyMessage, openForward]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#202c33] to-[#1a252c] px-4 py-3 flex items-center gap-3 border-b border-border/50 flex-shrink-0">
        <div className="relative cursor-pointer" onClick={async () => {
          if (contact.leadId) {
            setShowLeadDetail(true);
          } else {
            // Show board picker to choose where to create the lead
            const { data: boards } = await supabase.from('crm_boards').select('id, name').eq('is_active', true).order('sort_order');
            if (!boards?.length) { toast.error('Nenhum board ativo'); return; }
            setAvailableBoards(boards);
            setShowBoardPicker(true);
          }
        }}>
          {contact.profilePic ? (
            <img src={contact.profilePic} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-green-500/30 hover:ring-primary/50 transition-all" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600/40 to-emerald-700/40 flex items-center justify-center hover:from-green-500/40 hover:to-emerald-600/40 transition-all">
              <User className="w-5 h-5 text-green-300" />
            </div>
          )}
          {isConnected && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#202c33] animate-pulse" />}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
          if (contact.leadId) setShowLeadDetail(true);
        }}>
          <h3 className="font-semibold text-sm text-foreground truncate hover:text-primary transition-colors">{leadName || nomeValido(contact.name) || contact.phone}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" /> {contact.phone}
            {!contact.leadId && <span className="text-amber-400 ml-1">(clique na foto para criar lead)</span>}
          </p>
        </div>
        <CallButtonInline phoneNumber={contact.phone} leadId={contact.leadId} />
        
        {/* Chatbot Pause Button */}
        <Popover open={pausePopoverOpen} onOpenChange={setPausePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" title={isChatbotPaused ? 'IA pausada' : 'Pausar IA'}>
              {isChatbotPaused ? <BotOff className="w-4 h-4 text-destructive" /> : <Bot className="w-4 h-4 text-green-400" />}
              {isChatbotPaused && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="end">
            <p className="text-xs font-semibold mb-2 px-1">
              {isChatbotPaused ? '🔴 IA Pausada' : '🟢 IA Ativa'}
            </p>
            {isChatbotPaused && chatbotPausedUntil && new Date(chatbotPausedUntil).getFullYear() < 2099 && (
              <p className="text-[10px] text-muted-foreground px-1 mb-2">
                Até {format(new Date(chatbotPausedUntil), "HH:mm 'de' dd/MM", { locale: ptBR })}
              </p>
            )}
            {isChatbotPaused ? (
              <Button size="sm" className="w-full text-xs gap-1.5" onClick={() => handlePauseChatbot('resume')}>
                <Bot className="w-3 h-3" /> Reativar IA
              </Button>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground px-1">Pausar por:</p>
                {[
                  { label: '15 minutos', value: 15 },
                  { label: '30 minutos', value: 30 },
                  { label: '1 hora', value: 60 },
                  { label: '~8 horas', value: 500 },
                  { label: '~16 horas', value: 1000 },
                ].map(opt => (
                  <Button key={opt.value} variant="ghost" size="sm" className="w-full justify-start text-xs h-7 gap-1.5"
                    onClick={() => handlePauseChatbot(opt.value)}>
                    <Timer className="w-3 h-3" /> {opt.label}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => handlePauseChatbot('forever')}>
                  <BotOff className="w-3 h-3" /> Para sempre
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {isConnected ? (
          <Badge className="bg-green-500/20 text-green-400 text-[10px] border-green-500/30 animate-pulse">● Online</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Offline</Badge>
        )}
      </div>

      {/* Aviso de numero divergente: a conversa veio por um numero e o envio
          esta apontado pra outro. Sem isso o lead recebe resposta de um numero
          que ele nao reconhece — e quem liga depois nao sabe por onde falou. */}
      {conversationInstanceId && instanceId && conversationInstanceId !== instanceId && (() => {
        const from = instanceMap[conversationInstanceId];
        const to = instanceMap[instanceId];
        if (!from || !to) return null;
        return (
          <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-2 flex-shrink-0 flex-wrap">
            <span className="text-[11px] text-amber-200/90">
              Esta conversa é do <b>{shortInstanceName(from.name)}</b>{' '}
              <span className="font-mono">{formatInstancePhone(from.phone)}</span>, mas você vai responder pelo{' '}
              <b>{shortInstanceName(to.name)}</b> <span className="font-mono">{formatInstancePhone(to.phone)}</span>.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 border-amber-500/40 text-amber-200 hover:text-amber-100"
              onClick={() => handleSelectInstance(conversationInstanceId)}
            >
              Responder pelo número da conversa
            </Button>
          </div>
        );
      })()}

      {/* Faixa de live location ativa — mostra abaixo do header com
          tempo restante e botao "Parar". WhatsApp original mostra coisa
          parecida quando voce ta compartilhando ao vivo. */}
      {liveLocationActive && (
        <div className="px-3 py-1.5 bg-red-500/15 border-b border-red-500/30 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
              <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 animate-ping opacity-75" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500" />
            </div>
            <span className="text-xs text-red-300 font-medium truncate">
              Compartilhando localização ao vivo
            </span>
            <span className="text-xs font-mono text-red-200">
              {Math.floor(liveLocationRemaining / 60)}:{(liveLocationRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={() => stopLiveLocation(false)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/30 hover:bg-red-500/50 text-white transition-colors flex-shrink-0"
          >
            Parar
          </button>
        </div>
      )}

      {/* Messages area with drag-drop */}
      <div
        ref={chatAreaRef}
        className={`flex-1 overflow-y-auto p-3 space-y-1 transition-colors ${isDragging ? 'bg-green-900/20 ring-2 ring-green-500/50 ring-inset' : ''}`}
        style={{ backgroundColor: isDragging ? undefined : '#0b141a' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-green-600/90 rounded-2xl px-8 py-6 text-white flex flex-col items-center gap-2 shadow-2xl">
              <Upload className="w-10 h-10" />
              <span className="font-semibold">Solte o arquivo aqui</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Carregando mensagens...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <>
            {renderedMessages}
            <div ref={messagesEndRef} />

            {/* Lendo o histórico e chegou mensagem: a tela fica parada e o aviso avisa.
                Antes qualquer mensagem nova arrancava você de onde estava lendo. */}
            {temMensagemNova && (
              <button
                type="button"
                onClick={() => { scrollToBottom(); setTemMensagemNova(false); }}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-[#25d366] px-3 py-1.5 text-xs font-medium text-black shadow-lg hover:bg-[#128C7E] hover:text-white transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Mensagem nova
              </button>
            )}
          </>
        )}
      </div>

      {/* File upload preview */}
      {uploadingFile && (
        <div className="p-3 border-t border-border bg-[#1a252c] flex items-center gap-3 flex-shrink-0">
          {uploadingFile.preview ? (
            <img src={uploadingFile.preview} alt="" className="w-16 h-16 rounded-lg object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
              <File className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{uploadingFile.file.name}</p>
            <p className="text-xs text-muted-foreground">{(uploadingFile.file.size / 1024).toFixed(0)} KB • {uploadingFile.type}</p>
            {uploadProgress > 0 && (
              <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
          <Button size="icon" variant="ghost" onClick={() => { setUploadingFile(null); setUploadProgress(0); }} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
          <Button size="icon" onClick={handleUploadAndSend} disabled={isSending} className="bg-green-600 hover:bg-green-700 h-9 w-9">
            {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Seletor de instancia. Todas as instancias sao "Comercial", entao o que
          identifica cada uma e NOME + NUMERO — e o numero que o lead ve e pra
          onde ele responde. O provider vira so um selo secundario. */}
      {instances.length > 1 && (
        <div className="px-3 py-1.5 border-t border-border/50 bg-[#1a252c] flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          <span className="text-[10px] text-muted-foreground mr-1">Enviando por:</span>
          {instances.map(inst => {
            const style = getChannelStyle(inst.channel);
            const isSelected = inst.id === instanceId;
            const isCloud = inst.provider === 'cloud_api';
            const providerLabel = isCloud ? 'API Oficial (Meta)' : 'UAZAPI';
            const phone = formatInstancePhone(inst.phone_number);
            return (
              <button
                key={inst.id}
                onClick={() => handleSelectInstance(inst.id)}
                title={`${inst.instance_name}${phone ? ` · ${phone}` : ''} · ${providerLabel} · canal ${style.label}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] transition-all ${
                  isSelected
                    ? `${style.bg} ${style.color} border-current shadow-sm`
                    : 'border-border/30 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? style.dot : 'bg-muted-foreground/50'}`} />
                <span className="font-semibold">{shortInstanceName(inst.instance_name)}</span>
                {phone && <span className="font-mono opacity-80">{phone}</span>}
                <span className={`text-[9px] px-1 rounded ${isCloud ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {isCloud ? '✓ OFICIAL' : '📱 UAZAPI'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Instancia unica — mesmo assim mostra nome + numero */}
      {instances.length === 1 && (
        <div className="px-3 py-1 border-t border-border/50 bg-[#1a252c] flex items-center gap-1.5 flex-shrink-0">
          {(() => {
            const inst = instances[0];
            const style = getChannelStyle(inst.channel);
            const isCloud = inst.provider === 'cloud_api';
            const phone = formatInstancePhone(inst.phone_number);
            return (
              <>
                <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <span className="text-[10px] text-muted-foreground">Enviando por:</span>
                <span className={`text-[10px] font-semibold ${style.color}`}>{shortInstanceName(inst.instance_name)}</span>
                {phone && <span className="text-[10px] font-mono text-muted-foreground">{phone}</span>}
                <span className={`text-[9px] px-1 rounded ${isCloud ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {isCloud ? '✓ OFICIAL' : '📱 UAZAPI'}
                </span>
              </>
            );
          })()}
        </div>
      )}

      {/* Edit preview — quando o user clica em editar, mostra barra acima
          do input igual ao reply. Enter confirma, Esc cancela. */}
      {editingMsg && (
        <div className="px-3 py-2 border-t border-border bg-[#1a252c] flex items-center gap-2 flex-shrink-0">
          <div className="w-1 self-stretch bg-yellow-400 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-yellow-300">Editando mensagem</p>
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit(); }
                else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              }}
              autoFocus
              className="bg-[#2a3942] border-none text-[#e9edef] h-7 mt-0.5 text-sm focus-visible:ring-0"
            />
          </div>
          <Button size="icon" onClick={confirmEdit} className="bg-green-600 hover:bg-green-700 h-7 w-7" title="Confirmar (Enter)">
            <Check className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Cancelar (Esc)">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="px-3 py-2 border-t border-border bg-[#1a252c] flex items-center gap-2 flex-shrink-0">
          <div className="w-1 self-stretch bg-emerald-400 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-emerald-300">Respondendo a {replyingTo.direction === 'outbound' ? 'você' : (leadName || contact.name)}</p>
            <p className="text-xs text-foreground/70 truncate">{quotePreview(replyingTo)}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={cancelReply} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Dropdown de mencao (@) — participantes do grupo */}
      {mentionQuery !== null && mentionMatches.length > 0 && (
        <div className="relative flex-shrink-0">
          <div className="absolute left-2 right-2 bottom-1 z-30 max-h-56 overflow-y-auto rounded-lg border border-border bg-[#111b21] shadow-xl">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
              Mencionar no grupo
            </div>
            {mentionMatches.map((p, i) => (
              <button
                key={p.phone}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pickMention(p); }}
                onMouseEnter={() => setMentionIndex(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  i === mentionIndex ? 'bg-emerald-500/20' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-emerald-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">+{p.phone}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-2 border-t border-border bg-[#202c33] flex gap-2 items-center flex-shrink-0">
        {!isConnected ? (
          <p className="text-xs text-destructive flex-1 text-center py-2">Nenhuma instância conectada</p>
        ) : isRecording ? (
          <>
            <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0" onClick={cancelRecording}>
              <X className="w-5 h-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2 px-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-400 font-mono">{formatRecordingTime(recordingTime)}</span>
              <span className="text-xs text-muted-foreground">Gravando...</span>
            </div>
            <Button size="icon" onClick={stopRecording} className="bg-green-600 hover:bg-green-700 h-9 w-9 flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            {/* Emoji picker — abre popover com grid categorizado, insere no
                cursor do input mantendo foco. */}
            <EmojiPicker onSelect={insertEmoji} />

            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-[#8696a0] hover:text-green-400 hover:bg-green-500/10 flex-shrink-0 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              title="Anexar arquivo"
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            {/* Localizacao — agora abre dialog (atual / tempo real) ao
                inves de enviar direto. */}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleOpenLocationDialog}
              disabled={sendingLocation}
              className={`h-9 w-9 flex-shrink-0 transition-colors ${
                liveLocationActive
                  ? 'text-red-400 bg-red-500/15 hover:bg-red-500/25'
                  : 'text-[#8696a0] hover:text-red-400 hover:bg-red-500/10'
              }`}
              title={liveLocationActive ? 'Compartilhamento ao vivo ativo' : 'Enviar localização'}
            >
              {sendingLocation ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapPin className={`w-5 h-5 ${liveLocationActive ? 'animate-pulse' : ''}`} />}
            </Button>

            {/* Enviar contato (vCard) — busca em crm_leads e manda via UAZAPI */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowContactPicker(true)}
              className="h-9 w-9 text-[#8696a0] hover:text-purple-400 hover:bg-purple-500/10 flex-shrink-0 transition-colors"
              title="Enviar contato"
            >
              <UserPlus className="w-5 h-5" />
            </Button>

            {/* Video PTV — vídeo instantâneo redondo (lembretezinho que toca
                igual nota de áudio) */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowVideoPTV(true)}
              className="h-9 w-9 text-[#8696a0] hover:text-blue-400 hover:bg-blue-500/10 flex-shrink-0 transition-colors"
              title="Vídeo instantâneo (lembrete)"
            >
              <Video className="w-5 h-5" />
            </Button>

            <Textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => {
                const el = e.target as HTMLTextAreaElement;
                setNewMessage(el.value);
                refreshMentionState(el.value, el.selectionStart ?? el.value.length);
                // Auto-resize: ajusta altura conforme conteudo, com max de 6 linhas (~144px).
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
              }}
              onClick={(e) => {
                const el = e.target as HTMLTextAreaElement;
                refreshMentionState(el.value, el.selectionStart ?? el.value.length);
              }}
              onKeyDown={handleKeyPress}
              placeholder="Digite uma mensagem... (Shift+Enter quebra linha)"
              rows={1}
              className="flex-1 bg-[#2a3942] border-none text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-0 min-h-[36px] max-h-36 resize-none py-2 px-3 leading-snug overflow-y-auto"
              autoFocus
            />
            {newMessage.trim() ? (
              <Button size="icon" onClick={handleSend} disabled={isSending} className="bg-green-600 hover:bg-green-700 h-9 w-9 flex-shrink-0">
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={startRecording} className="h-9 w-9 text-[#8696a0] hover:text-green-400 hover:bg-green-500/10 flex-shrink-0 transition-colors" title="Gravar áudio">
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Video PTV Recorder */}
      <VideoPTVRecorder
        isOpen={showVideoPTV}
        onClose={() => setShowVideoPTV(false)}
        onRecorded={handleSendPTV}
      />

      {/* Location Dialog — escolha entre Atual / Tempo real / Cancelar */}
      {showLocationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowLocationDialog(false)}>
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-400" /> Enviar localização
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setShowLocationDialog(false)} className="h-7 w-7">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {liveLocationActive ? (
              // Ja tem live rolando — opcoes sao "Manter" ou "Parar"
              <>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1">
                  <p className="text-sm font-medium text-red-300">🔴 Você está compartilhando ao vivo</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(liveLocationRemaining / 60)}min {liveLocationRemaining % 60}s restantes — atualizando a cada 30s
                  </p>
                </div>
                <Button
                  onClick={() => { stopLiveLocation(false); setShowLocationDialog(false); }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  Parar compartilhamento
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSendCurrentLocation}
                  disabled={sendingLocation}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:border-red-400/50 hover:bg-red-500/5 transition-all text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Localização atual</p>
                    <p className="text-[11px] text-muted-foreground">Envia 1 ponto único agora</p>
                  </div>
                </button>

                <button
                  onClick={() => startLiveLocation(15)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:border-red-400/50 hover:bg-red-500/5 transition-all text-left"
                >
                  <div className="relative w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-red-400" />
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Compartilhar em tempo real</p>
                    <p className="text-[11px] text-muted-foreground">15 minutos · atualiza a cada 30s</p>
                  </div>
                </button>

                <button
                  onClick={() => startLiveLocation(60)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border hover:border-red-400/50 hover:bg-red-500/5 transition-all text-left"
                >
                  <div className="relative w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-red-400" />
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Tempo real estendido</p>
                    <p className="text-[11px] text-muted-foreground">1 hora · atualiza a cada 30s</p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Forward Dialog — escolhe outro lead pra reenviar a msg */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setForwardingMsg(null)}>
          <div className="bg-card border border-border rounded-xl p-4 max-w-md w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Forward className="w-4 h-4 text-emerald-400" /> Encaminhar mensagem
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setForwardingMsg(null)} className="h-7 w-7">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-2 bg-[#202c33] rounded text-xs text-white/70 max-h-20 overflow-hidden">
              <span className="font-semibold text-emerald-300">Preview: </span>
              {forwardingMsg.message_type === 'text'
                ? (forwardingMsg.content || '').slice(0, 120)
                : `${forwardingMsg.message_type === 'image' ? '📷' : forwardingMsg.message_type === 'video' ? '🎥' : forwardingMsg.message_type === 'audio' || forwardingMsg.message_type === 'ptt' ? '🎤' : forwardingMsg.message_type === 'document' ? '📄' : forwardingMsg.message_type === 'ptv' ? '🎥' : '📎'} ${forwardingMsg.content || forwardingMsg.message_type}`}
            </div>
            <Input
              autoFocus
              placeholder="Buscar contato..."
              value={forwardSearch}
              onChange={(e) => { setForwardSearch(e.target.value); searchForwardTargets(e.target.value); }}
              className="bg-[#2a3942] border-none text-foreground"
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {forwardResults.length === 0 && forwardSearch.length >= 2 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
              )}
              {forwardResults.length === 0 && forwardSearch.length < 2 && (
                <p className="text-xs text-muted-foreground text-center py-6">Digite ao menos 2 caracteres</p>
              )}
              {forwardResults.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => executeForward(lead)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600/40 to-teal-700/40 flex items-center justify-center">
                    <User className="w-4 h-4 text-emerald-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                    <p className="text-[11px] text-muted-foreground">{lead.whatsapp}</p>
                  </div>
                  <Forward className="w-4 h-4 text-emerald-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info Dialog — detalhes da msg (timestamp, status, ids) */}
      {infoMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setInfoMsg(null)}>
          <div className="bg-card border border-border rounded-xl p-4 max-w-sm w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" /> Detalhes da mensagem
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setInfoMsg(null)} className="h-7 w-7">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Tipo</span><span className="font-mono">{infoMsg.message_type}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Direção</span><span>{infoMsg.direction === 'outbound' ? '📤 Enviada' : '📥 Recebida'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Status</span><span className="capitalize">{infoMsg.status}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Enviada em</span><span>{format(new Date(infoMsg.created_at), "dd/MM/yyyy HH:mm:ss")}</span></div>
              {infoMsg.whatsapp_message_id && (
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">WhatsApp ID</span><span className="font-mono truncate max-w-[180px]" title={infoMsg.whatsapp_message_id}>{infoMsg.whatsapp_message_id.slice(0, 18)}...</span></div>
              )}
              {infoMsg.media_url && (
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Mídia</span><a href={infoMsg.media_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">abrir</a></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Picker — busca em crm_leads pra enviar como vCard */}
      {showContactPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowContactPicker(false)}>
          <div className="bg-card border border-border rounded-xl p-4 max-w-md w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Enviar contato</h3>
              <Button size="icon" variant="ghost" onClick={() => { setShowContactPicker(false); setContactSearch(''); setContactResults([]); }} className="h-7 w-7">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <Input
              autoFocus
              placeholder="Buscar nome ou telefone..."
              value={contactSearch}
              onChange={(e) => { setContactSearch(e.target.value); searchContacts(e.target.value); }}
              className="bg-[#2a3942] border-none text-foreground"
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {contactResults.length === 0 && contactSearch.length >= 2 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead encontrado</p>
              )}
              {contactResults.length === 0 && contactSearch.length < 2 && (
                <p className="text-xs text-muted-foreground text-center py-6">Digite ao menos 2 caracteres</p>
              )}
              {contactResults.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => handleSendContact(lead)}
                  disabled={sendingContact}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600/40 to-pink-700/40 flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                    <p className="text-[11px] text-muted-foreground">{lead.whatsapp}</p>
                  </div>
                  <Send className="w-4 h-4 text-green-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {showLeadDetail && contact.leadId && (
        <LeadDetailModal
          isOpen={showLeadDetail}
          onClose={() => setShowLeadDetail(false)}
          lead={{
            id: contact.leadId,
            name: leadName || contact.name,
            whatsapp: contact.phone,
            instagram_profile_pic_url: contact.profilePic,
            lead_score: 0,
            priority: 'medium',
            column_id: '',
          }}
          columns={crmColumns}
          onSave={async () => {}}
          mode="edit"
        />
      )}

      {/* Board picker dialog for creating lead */}
      {showBoardPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowBoardPicker(false)}>
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground">Criar Lead no CRM</h3>
            <p className="text-sm text-muted-foreground">Selecione o quadro para <strong>{leadName || contact.name}</strong>:</p>
            <div className="space-y-2">
              {availableBoards.map(board => (
                <button
                  key={board.id}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-foreground"
                  onClick={async () => {
                    try {
                      const { data: cols } = await supabase.from('crm_columns').select('id').eq('board_id', board.id).order('sort_order').limit(1);
                      const colId = cols?.[0]?.id;
                      if (!colId) { toast.error('Nenhuma coluna neste quadro'); return; }
                      const { data: newLead, error } = await supabase.from('crm_leads').insert({
                        name: leadName || contact.name,
                        whatsapp: normalizePhoneBR(contact.phone),
                        whatsapp_profile_pic_url: contact.profilePic || null,
                        board_id: board.id,
                        column_id: colId,
                        source: 'whatsapp_chat',
                      }).select('id').single();
                      if (error) throw error;
                      toast.success(`Lead criado em "${board.name}"!`);
                      (contact as any).leadId = newLead.id;
                      setShowBoardPicker(false);
                      setShowLeadDetail(true);
                    } catch (e: any) { toast.error('Erro: ' + e.message); }
                  }}
                >
                  {board.name}
                </button>
              ))}
            </div>
            <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setShowBoardPicker(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
