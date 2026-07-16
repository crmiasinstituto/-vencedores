import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
  useConnectionState,
  useChat,
  useSpeakingParticipants,
} from '@livekit/components-react';
import { Track, ConnectionState, RoomEvent, DisconnectReason } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/mais-que-vencedores-logo.svg';
import { toast } from 'sonner';
import {
  Loader2, Video, VideoOff, Mic, MicOff, PhoneOff, Crown, Eye,
  Monitor, MonitorOff, MessageSquare, User, Check, Play, Settings, Send, FileText,
  Hand, MessageCircleQuestion, Paperclip, Download, File as FileIcon,
  Volume2, VolumeX, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCallTranscription } from '@/hooks/useCallTranscription';
import { useMeetCaptions } from '@/hooks/useMeetCaptions';
import { useMeetSignals } from '@/hooks/useMeetSignals';
import { useCsAgent } from '@/hooks/useCsAgent';
import { useMeetChatLog } from '@/hooks/useMeetChatLog';
import LiveCoachPanel from '@/components/meet/LiveCoachPanel';
import DeviceSelectorPopover from '@/components/meet/DeviceSelectorPopover';
import MeetingRatingModal from '@/components/meet/MeetingRatingModal';
import AskQuestionModal from '@/components/meet/AskQuestionModal';
import HostQuestionsDrawer from '@/components/meet/HostQuestionsDrawer';
import ReactionBurstOverlay from '@/components/meet/ReactionBurstOverlay';
import BackgroundBlurToggle from '@/components/meet/BackgroundBlurToggle';
import { createRnnoiseProcessor, rnnoiseSupported } from '@/lib/rnnoiseAudioProcessor';

// ======================== Chat Panel (using LiveKit useChat hook) ========================
// Mensagens de midia (imagem, video, PDF, arquivo) sao codificadas como JSON
// dentro da string de texto do useChat, prefixadas com este marker pra distinguir
// de texto puro. send() do LiveKit so transmite string, entao "embarcamos" a midia.
const MEDIA_MARKER = '__SQUAAD_MEDIA__:';
// Marker das mensagens do agente CS: o host posta como "Carol CS - + que Vencedores"
// (visivel pra todos como ela, com selo dourado), nao como o proprio host.
const CAROL_MARKER = '__CAROL_CS__:';
const CAROL_NAME = 'Carol CS - + que Vencedores';

interface MediaPayload {
  url: string;
  name: string;
  size: number;
  mime: string;
}

function encodeMedia(p: MediaPayload): string {
  return MEDIA_MARKER + JSON.stringify(p);
}

function decodeMedia(message: string): MediaPayload | null {
  if (!message.startsWith(MEDIA_MARKER)) return null;
  try {
    return JSON.parse(message.slice(MEDIA_MARKER.length)) as MediaPayload;
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChatMediaBubble({ media }: { media: MediaPayload }) {
  const isImage = media.mime.startsWith('image/');
  const isVideo = media.mime.startsWith('video/');
  const isPdf = media.mime === 'application/pdf' || media.name.toLowerCase().endsWith('.pdf');

  if (isImage) {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={media.url} alt={media.name} className="max-w-full max-h-48 rounded-md object-cover" />
        <span className="block text-[10px] text-gray-400 mt-1 truncate">{media.name}</span>
      </a>
    );
  }
  if (isVideo) {
    return (
      <div className="space-y-1">
        <video src={media.url} controls className="max-w-full max-h-48 rounded-md" />
        <span className="block text-[10px] text-gray-400 truncate">{media.name}</span>
      </div>
    );
  }
  const Icon = isPdf ? FileText : FileIcon;
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      download={media.name}
      className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-md px-2 py-1.5 hover:bg-black/50 transition"
    >
      <Icon className="w-7 h-7 text-primary flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white truncate">{media.name}</p>
        <p className="text-[10px] text-gray-400">{formatFileSize(media.size)}</p>
      </div>
      <Download className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
    </a>
  );
}

function ChatPanel({ isOpen, onClose, onUnreadChange }: {
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (n: number) => void;
}) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenIdxRef = useRef(0);
  const lastNotifiedIdxRef = useRef(0);

  // Toast em mensagem recebida com chat fechado + badge counter
  useEffect(() => {
    const lastIdx = chatMessages.length;
    for (let i = lastNotifiedIdxRef.current; i < lastIdx; i++) {
      const msg = chatMessages[i];
      const isLocal = msg.from?.identity === localParticipant.identity;
      if (isLocal) continue;
      if (!isOpen) {
        const senderName = msg.from?.name || msg.from?.identity || 'Participante';
        const media = decodeMedia(msg.message);
        const preview = media
          ? `📎 ${media.name}`
          : msg.message.length > 80 ? msg.message.slice(0, 80) + '...' : msg.message;
        toast(`💬 ${senderName}`, { description: preview, duration: 6000 });
      }
    }
    lastNotifiedIdxRef.current = lastIdx;

    if (isOpen) {
      lastSeenIdxRef.current = lastIdx;
      onUnreadChange?.(0);
    } else {
      const unread = chatMessages.slice(lastSeenIdxRef.current)
        .filter(m => m.from?.identity !== localParticipant.identity).length;
      onUnreadChange?.(unread);
    }
  }, [chatMessages, isOpen, localParticipant.identity, onUnreadChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    send(input.trim());
    setInput('');
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Limite 25MB pra evitar travar o upload e estourar o bucket
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Arquivo muito grande (max 25MB)');
      return;
    }

    setIsUploading(true);
    try {
      const roomName = room?.name || 'unknown';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `meet-${roomName}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { cacheControl: '3600', contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
      const payload: MediaPayload = {
        url: urlData.publicUrl,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
      };
      send(encodeMedia(payload));
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message || 'falha desconhecida'}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-[#111] border-l border-white/10 flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Chat</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {chatMessages.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-8">Nenhuma mensagem ainda</p>
        )}
        {chatMessages.map((msg, i) => {
          const rawIsLocal = msg.from?.identity === localParticipant.identity;
          // Mensagem da Carol (agente): mostra como ela pra todos, com selo dourado.
          const isCarol = typeof msg.message === 'string' && msg.message.startsWith(CAROL_MARKER);
          const text = isCarol ? msg.message.slice(CAROL_MARKER.length) : msg.message;
          const isLocal = rawIsLocal && !isCarol;
          const media = decodeMedia(text);
          const displayName = isCarol
            ? CAROL_NAME
            : isLocal
              ? 'Voce'
              : (msg.from?.name || msg.from?.identity || 'Participante');
          return (
            <div key={i} className={`flex flex-col ${isLocal ? 'items-end' : 'items-start'}`}>
              <span className={`text-[10px] mb-0.5 flex items-center gap-1 ${isCarol ? 'text-[#3B82F6] font-semibold' : 'text-gray-500'}`}>
                {isCarol && <Sparkles className="w-3 h-3" />}
                {displayName}
              </span>
              <div className={`px-3 py-1.5 rounded-lg text-sm max-w-[85%] break-words ${
                isCarol ? 'bg-[#3B82F6]/15 text-white border border-[#3B82F6]/30'
                  : isLocal ? 'bg-primary/20 text-white' : 'bg-white/10 text-gray-200'
              }`}>
                {media ? <ChatMediaBubble media={media} /> : text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          onClick={handleAttachClick}
          disabled={isUploading || isSending}
          className="text-gray-400 hover:text-primary p-1.5 rounded-md disabled:opacity-40 flex-shrink-0"
          title="Enviar arquivo (imagem, video, PDF, documento)"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 min-w-0"
        />
        <button
          onClick={sendMessage}
          disabled={isSending || !input.trim()}
          className="bg-primary/80 hover:bg-primary text-black px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex-shrink-0"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

// ======================== Participants Panel ========================
// Lista quem esta na sala (local + remotos) com contador, indicador de fala e
// status do microfone. Pro host: botoes de silenciar/ativar geral e por pessoa.
// Resolve o "nao consigo contabilizar quantas pessoas na sala".
function participantRoleLabel(p: any): string | null {
  try {
    const meta = p?.metadata ? JSON.parse(p.metadata) : null;
    if (meta?.role === 'host') return 'Apresentador';
    if (meta?.role === 'observer') return 'Observador';
  } catch {}
  if (typeof p?.identity === 'string' && p.identity.startsWith('host-')) return 'Apresentador';
  return null;
}

function ParticipantsPanel({
  isOpen, onClose, role, speakingSet,
  onMuteParticipant, onRequestUnmute, onMuteAll, onUnmuteAll,
}: {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  speakingSet: Set<string>;
  onMuteParticipant: (identity: string) => void;
  onRequestUnmute: (identity: string) => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

  // Re-render quando alguem liga/desliga mic ou entra/sai (pra o status do mic
  // e o contador ficarem certos sem depender so do React de fora).
  const [, tick] = useState(0);
  useEffect(() => {
    if (!room) return;
    const rerender = () => tick((n) => n + 1);
    const evts = [
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
    ];
    evts.forEach((e) => room.on(e as any, rerender));
    return () => { evts.forEach((e) => room.off(e as any, rerender)); };
  }, [room]);

  if (!isOpen) return null;

  const all = [localParticipant, ...remoteParticipants];
  const isHost = role === 'host';

  return (
    <div className="absolute top-0 right-0 w-80 max-w-[88vw] h-full bg-[#111] border-l border-white/10 flex flex-col z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Pessoas na sala ({all.length})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
      </div>

      {isHost && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <button
            onClick={onMuteAll}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium"
            title="Silenciar o microfone de todos"
          >
            <MicOff className="w-3.5 h-3.5" /> Silenciar todos
          </button>
          <button
            onClick={onUnmuteAll}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 text-[#3B82F6] text-xs font-medium"
            title="Convidar todos a ligar o microfone"
          >
            <Mic className="w-3.5 h-3.5" /> Ativar todos
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {all.map((p: any) => {
          const isLocal = p?.identity === localParticipant?.identity;
          const speaking = speakingSet.has(p?.identity);
          const micOn = !!p?.isMicrophoneEnabled;
          const roleLabel = participantRoleLabel(p);
          const displayName = (p?.name || p?.identity || 'Participante') + (isLocal ? ' (Você)' : '');
          const initial = (p?.name || p?.identity || '?').trim().charAt(0).toUpperCase();
          return (
            <div key={p?.identity || Math.random()} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04]">
              <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                speaking ? 'bg-[#3B82F6] text-black ring-2 ring-[#3B82F6]/60' : 'bg-white/10 text-white/80'
              }`}>
                {initial}
                {speaking && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#3B82F6] border border-[#111] animate-pulse" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate leading-tight">{displayName}</p>
                {roleLabel && <p className="text-[10px] text-[#3B82F6]/80 leading-tight">{roleLabel}</p>}
              </div>
              {/* Status do mic */}
              {micOn ? (
                <Mic className="w-4 h-4 text-green-400 flex-shrink-0" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400/80 flex-shrink-0" />
              )}
              {/* Controles do host pros remotos */}
              {isHost && !isLocal && (
                micOn ? (
                  <button
                    onClick={() => onMuteParticipant(p.identity)}
                    className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/80 font-medium flex-shrink-0"
                    title="Silenciar este participante"
                  >
                    Silenciar
                  </button>
                ) : (
                  <button
                    onClick={() => onRequestUnmute(p.identity)}
                    className="px-2 py-1 rounded-md bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 text-[10px] text-[#3B82F6] font-medium flex-shrink-0"
                    title="Convidar a falar (liga o microfone dele)"
                  >
                    Ativar mic
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================== Transcription Subtitle Overlay ========================
function TranscriptionOverlay({ transcriptions }: { transcriptions: { text: string; speaker: string; is_final: boolean }[] }) {
  const lastLines = useMemo(() => {
    return transcriptions.filter(t => t.text.trim()).slice(-3);
  }, [transcriptions]);

  if (lastLines.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 max-w-[80%] pointer-events-none">
      <div className="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 space-y-1">
        {lastLines.map((line, i) => (
          <p key={i} className={`text-sm text-center ${line.is_final ? 'text-white' : 'text-gray-400 italic'}`}>
            <span className="text-primary font-medium">{line.speaker}: </span>
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}

// ======================== Custom Control Bar ========================
interface ControlBarProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isPaused: boolean;
  isChatOpen: boolean;
  isTranscribing: boolean;
  isDevicePickerOpen: boolean;
  isQuestionPanelOpen: boolean;
  isHandRaised: boolean;
  unansweredQuestions: number;
  unreadChat: number;
  role: string;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onToggleRecord: () => void;
  onTogglePause: () => void;
  onToggleChat: () => void;
  onToggleTranscription: () => void;
  onToggleDevicePicker: () => void;
  onToggleQuestionPanel: () => void;
  onToggleHand: () => void;
  onSendReaction: (emoji: string) => void;
  onMuteAll?: () => void;
  onUnmuteAll?: () => void;
  onTogglePeople: () => void;
  isPeopleOpen: boolean;
  peopleCount: number;
  isCsAgentOn?: boolean;
  onToggleCsAgent?: () => void;
  onLeave: () => void;
}

const REACTION_EMOJIS = ['🔥', '👏', '❤️', '😂'];

// Wrapper visual: botao circular em cima + label maiusculo embaixo.
// Mantem altura consistente (cada celula da control bar tem mesma altura).
function CtrlButton({ label, active, onClick, title, children, badge }: {
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  badge?: number | null;
}) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[52px]">
      <button
        onClick={onClick}
        title={title}
        className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all ${
          active ? 'bg-primary/80 hover:bg-primary text-black' : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {children}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
      <span className="text-[9px] text-white/70 font-semibold uppercase tracking-wider leading-none">{label}</span>
    </div>
  );
}

function CtrlButtonDanger({ label, onClick, title, children }: {
  label: string;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[52px]">
      <button
        onClick={onClick}
        title={title}
        className="w-11 h-11 rounded-full flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white transition-all"
      >
        {children}
      </button>
      <span className="text-[9px] text-red-300 font-semibold uppercase tracking-wider leading-none">{label}</span>
    </div>
  );
}

function CustomControlBar({
  isMicOn, isCamOn, isScreenSharing, isRecording, isPaused, isChatOpen,
  isDevicePickerOpen, isQuestionPanelOpen, isHandRaised,
  unansweredQuestions, unreadChat, role,
  onToggleMic, onToggleCam, onToggleScreen, onToggleRecord, onTogglePause,
  onToggleChat, onToggleDevicePicker,
  onToggleQuestionPanel, onToggleHand, onSendReaction, onMuteAll, onUnmuteAll,
  onTogglePeople, isPeopleOpen, peopleCount,
  isCsAgentOn, onToggleCsAgent, onLeave,
}: ControlBarProps) {
  // Mobile: scroll horizontal pra nao cortar botoes em telas <500px. Reactions
  // ocultas em mobile pra dar espaco aos controles essenciais.
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-end justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 bg-black/80 backdrop-blur-md border-t border-white/10 relative sm:overflow-x-auto scrollbar-thin">
      {/* Mic */}
      {isMicOn ? (
        <CtrlButton label="Microfone" onClick={onToggleMic} title="Desligar microfone">
          <Mic className="w-5 h-5" />
        </CtrlButton>
      ) : (
        <CtrlButtonDanger label="Microfone" onClick={onToggleMic} title="Ligar microfone">
          <MicOff className="w-5 h-5" />
        </CtrlButtonDanger>
      )}

      {/* Camera */}
      {isCamOn ? (
        <CtrlButton label="Câmera" onClick={onToggleCam} title="Desligar câmera">
          <Video className="w-5 h-5" />
        </CtrlButton>
      ) : (
        <CtrlButtonDanger label="Câmera" onClick={onToggleCam} title="Ligar câmera">
          <VideoOff className="w-5 h-5" />
        </CtrlButtonDanger>
      )}

      {/* Audio/Video device picker */}
      <div className="hidden sm:block">
        <CtrlButton label="Áudio/Vídeo" active={isDevicePickerOpen} onClick={onToggleDevicePicker} title="Selecionar dispositivos">
          <Settings className="w-5 h-5" />
        </CtrlButton>
      </div>

      {/* Share Screen */}
      <div className="hidden sm:block">
        <CtrlButton label="Tela" active={isScreenSharing} onClick={onToggleScreen} title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}>
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </CtrlButton>
      </div>

      {/* Chat */}
      <CtrlButton
        label="Chat"
        active={isChatOpen}
        onClick={onToggleChat}
        title="Chat da reunião"
        badge={!isChatOpen ? unreadChat : null}
      >
        <MessageSquare className="w-5 h-5" />
      </CtrlButton>

      {/* Pessoas — todos veem o total; host controla mic por pessoa no painel */}
      <CtrlButton
        label="Pessoas"
        active={isPeopleOpen}
        onClick={onTogglePeople}
        title="Ver quem está na sala"
        badge={!isPeopleOpen ? peopleCount : null}
      >
        <User className="w-5 h-5" />
      </CtrlButton>

      {/* Levantar mao */}
      <CtrlButton
        label="Levantar"
        active={isHandRaised}
        onClick={onToggleHand}
        title={isHandRaised ? 'Abaixar mão' : 'Levantar mão'}
      >
        <Hand className="w-5 h-5" />
      </CtrlButton>

      {/* Pergunta */}
      <CtrlButton
        label="Pergunta"
        active={isQuestionPanelOpen}
        onClick={onToggleQuestionPanel}
        title={role === 'host' ? 'Perguntas dos participantes' : 'Mandar pergunta'}
        badge={role === 'host' ? unansweredQuestions : null}
      >
        <MessageCircleQuestion className="w-5 h-5" />
      </CtrlButton>

      {/* Silenciar todos — so o host. Manda sinal pra todos desligarem o mic. */}
      {role === 'host' && onMuteAll && (
        <CtrlButton
          label="Silenciar"
          onClick={() => {
            onMuteAll();
            toast.success('Microfones de todos silenciados');
          }}
          title="Silenciar o microfone de todos os participantes"
        >
          <MicOff className="w-5 h-5" />
        </CtrlButton>
      )}

      {/* Ativar microfones — so o host. Convida todos a ligar o mic (opt-in).
          Pra ligar o mic de UMA pessoa especifica, use o painel "Pessoas". */}
      {role === 'host' && onUnmuteAll && (
        <CtrlButton
          label="Ativar"
          onClick={() => {
            onUnmuteAll();
            toast.success('Todos foram convidados a ligar o microfone');
          }}
          title="Convidar todos a ligar o microfone (por pessoa: painel Pessoas)"
        >
          <Mic className="w-5 h-5" />
        </CtrlButton>
      )}

      {/* CS IA — so o host. Liga o agente que responde no chat como o Carlos. */}
      {role === 'host' && onToggleCsAgent && (
        <CtrlButton
          label="CS IA"
          active={isCsAgentOn}
          onClick={() => {
            onToggleCsAgent();
            toast[isCsAgentOn ? 'info' : 'success'](
              isCsAgentOn ? 'CS IA desligado' : 'CS IA ligado: a Carol está respondendo no chat'
            );
          }}
          title={isCsAgentOn ? 'Desligar o CS IA' : 'Ligar o CS IA (responde no chat como você)'}
        >
          <Sparkles className="w-5 h-5" />
        </CtrlButton>
      )}

      {/* Record */}
      <div className="hidden sm:block">
        <div className="flex flex-col items-center gap-1 min-w-[52px]">
          <button
            onClick={onToggleRecord}
            title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isRecording && !isPaused ? 'bg-red-600 animate-pulse' : isPaused ? 'bg-yellow-600' : 'bg-red-500/30 hover:bg-red-500/50'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
          </button>
          <span className="text-[9px] text-white/70 font-semibold uppercase tracking-wider leading-none">
            {isRecording ? (isPaused ? 'Pausado' : 'Gravando') : 'Gravar'}
          </span>
        </div>
      </div>

      {/* Pause/Resume — visible only while recording */}
      {isRecording && (
        <CtrlButton
          label={isPaused ? 'Retomar' : 'Pausar'}
          active={isPaused}
          onClick={onTogglePause}
          title={isPaused ? 'Retomar gravação' : 'Pausar gravação'}
        >
          {isPaused ? (
            <Play className="w-5 h-5" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          )}
        </CtrlButton>
      )}

      {/* Reactions — disponiveis tambem no mobile/tablet */}
      <div className="flex items-end gap-1 mx-1 pl-2 border-l border-white/10 pb-3">
        {REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => onSendReaction(e)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-white/10 hover:scale-110 transition-all"
            title={`Reagir ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Leave */}
      <div className="flex flex-col items-center gap-1 ml-2">
        <button
          onClick={onLeave}
          className="px-5 h-11 rounded-full flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium transition-all"
          title="Sair da reunião"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="text-sm">Sair</span>
        </button>
        <span className="text-[9px] text-white/70 font-semibold uppercase tracking-wider leading-none opacity-0">.</span>
      </div>
    </div>
  );
}

// ======================== Participant Video Tile ========================
function ParticipantVideo({ trackRef, name, isLocal, className, handRaised, handPosition, onAskQuestion, speaking, contain }: {
  trackRef: any;
  name: string;
  isLocal?: boolean;
  className?: string;
  handRaised?: boolean;
  handPosition?: number;
  // Quando setado, mostra pill "Mandar pergunta" sobreposto ao tile. So o guest
  // recebe (host nao manda pergunta pra si mesmo). Click abre AskQuestionModal.
  onAskQuestion?: () => void;
  // Borda na cor da marca quando a pessoa esta falando (identifica quem esta
  // com o audio aberto naquele momento). Estilo Zoom.
  speaking?: boolean;
  // contain = mostra o video inteiro sem cortar (object-contain). Usado no
  // compartilhamento de tela pra ninguem ver a pagina cortada. Camera usa cover.
  contain?: boolean;
}) {
  // Anel dourado (#3B82F6) pulsando quando falando.
  const speakingRing = speaking
    ? 'ring-2 ring-[#3B82F6] shadow-[0_0_0_3px_rgba(250,200,0,0.35)]'
    : '';
  // Espelha SO a propria camera (self-view), estilo Zoom/Meet: voce se ve como
  // num espelho. Os outros te veem na orientacao real. Screen share nunca espelha.
  const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: contain ? 'contain' : 'cover',
    transform: isLocal && !contain ? 'scaleX(-1)' : undefined,
  };
  const nameLabel = (
    <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-xs text-white z-10">
      {name}{isLocal ? ' (Você)' : ''}
    </div>
  );
  const questionPill = onAskQuestion ? (
    <button
      onClick={(e) => { e.stopPropagation(); onAskQuestion(); }}
      className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-primary text-black rounded-full pl-2.5 pr-3 py-1.5 shadow-2xl hover:scale-105 transition-transform z-20 font-medium text-sm"
      title="Mandar pergunta pro apresentador"
    >
      <MessageCircleQuestion className="w-4 h-4" />
      <span>Mandar pergunta</span>
    </button>
  ) : null;

  if (!trackRef?.publication?.track) {
    return (
      <div className={`relative bg-gray-900 flex items-center justify-center transition-shadow ${speakingRing} ${className || ''}`}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <User className="w-10 h-10 text-gray-400" />
          </div>
          <span className="text-gray-400 text-sm">{name}</span>
        </div>
        {handRaised && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-400 text-black rounded-full pl-1.5 pr-2 h-8 shadow-lg animate-pulse z-10">
            <span className="text-lg leading-none">✋</span>
            {typeof handPosition === 'number' && handPosition > 0 && (
              <span className="text-[11px] font-bold tabular-nums">{handPosition}º</span>
            )}
          </div>
        )}
        {questionPill}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gray-900 transition-shadow ${speakingRing} ${className || ''}`}>
      <VideoTrack trackRef={trackRef} style={videoStyle} />
      {nameLabel}
      {handRaised && (
        <div className="absolute top-2 left-2 bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg animate-pulse z-10">
          ✋
        </div>
      )}
      {questionPill}
    </div>
  );
}

// Detecta qual track e' do host. Roles vem no metadata do token LiveKit:
// JSON.stringify({ role: 'host'|'guest'|'observer', leadId? }). Tambem aceita
// fallback via identity prefix 'host-' caso o metadata nao venha (compat com
// tokens antigos).
function isHostTrack(track: any): boolean {
  const p = track?.participant;
  if (!p) return false;
  if (typeof p.identity === 'string' && p.identity.startsWith('host-')) return true;
  try {
    const meta = p.metadata ? JSON.parse(p.metadata) : null;
    if (meta?.role === 'host') return true;
  } catch {}
  return false;
}

// ======================== Meeting Content ========================
function MeetingContent({ roomName, role, mode, onLeave }: { roomName: string; role: string; mode: string; onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();
  const room = useRoomContext();

  // Quem esta falando agora (audio aberto) — pra borda dourada estilo Zoom.
  const speakingParticipants = useSpeakingParticipants();
  const speakingSet = useMemo(
    () => new Set(speakingParticipants.map((p) => p.identity)),
    [speakingParticipants]
  );

  // Largura da tela pra grid responsivo (mobile/tablet/web).
  const [viewportW, setViewportW] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  useEffect(() => {
    const h = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Diagnostico: listeners de eventos da sala. Sem isso, quando o lead nao
  // aparece, o host nao sabe se foi token, network, ou track-level.
  useEffect(() => {
    if (!room) return;
    const onJoin = (p: any) => {
      console.log('[MEET] participant connected:', p.identity, p.name);
      toast.success(`${p.name || p.identity} entrou na sala`);
    };
    const onPartLeave = (p: any) => {
      console.log('[MEET] participant disconnected:', p.identity);
      toast.info(`${p.name || p.identity} saiu`);
    };
    const onDisc = (reason?: DisconnectReason) => {
      console.warn('[MEET] disconnected, reason:', reason);
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        toast.error('Outra aba/sessao com mesmo nome — voce foi desconectado');
      }
    };
    const onReconn = () => console.log('[MEET] reconnecting...');
    const onConnQ = (q: any, p: any) => {
      if (q === 'poor' || q === 'lost') console.warn('[MEET] poor connection:', p?.identity, q);
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onPartLeave);
    room.on(RoomEvent.Disconnected, onDisc);
    room.on(RoomEvent.Reconnecting, onReconn);
    room.on(RoomEvent.ConnectionQualityChanged, onConnQ);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onPartLeave);
      room.off(RoomEvent.Disconnected, onDisc);
      room.off(RoomEvent.Reconnecting, onReconn);
      room.off(RoomEvent.ConnectionQualityChanged, onConnQ);
    };
  }, [room]);

  // Get all camera tracks including local
  const allTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Separate local and remote tracks
  const localCamTrack = useMemo(() => {
    return allTracks.find(
      t => t.participant.sid === localParticipant.sid && t.source === Track.Source.Camera
    );
  }, [allTracks, localParticipant.sid]);

  const remoteTracks = useMemo(() => {
    return allTracks.filter(
      t => t.participant.sid !== localParticipant.sid
    );
  }, [allTracks, localParticipant.sid]);

  const screenShareTrack = useMemo(() => {
    return allTracks.find(t => t.source === Track.Source.ScreenShare);
  }, [allTracks]);

  // Control states. Inicializa do estado REAL do LiveKit pra UI nao
  // dessincar (botao mostrava "ligado" quando track estava mutado).
  const [isMicOn, setIsMicOn] = useState(() => localParticipant?.isMicrophoneEnabled ?? true);
  const [isCamOn, setIsCamOn] = useState(() => localParticipant?.isCameraEnabled ?? true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Sincroniza UI com mudancas do LiveKit (ex.: setMicrophoneEnabled rejeitada
  // pelo SO, troca de device, ou toggle via outra origem).
  useEffect(() => {
    if (!localParticipant) return;
    const sync = () => {
      setIsMicOn(localParticipant.isMicrophoneEnabled);
      setIsCamOn(localParticipant.isCameraEnabled);
      setIsScreenSharing(localParticipant.isScreenShareEnabled);
    };
    sync();
    localParticipant.on('trackMuted', sync);
    localParticipant.on('trackUnmuted', sync);
    localParticipant.on('trackPublished', sync);
    localParticipant.on('trackUnpublished', sync);
    return () => {
      localParticipant.off('trackMuted', sync);
      localParticipant.off('trackUnmuted', sync);
      localParticipant.off('trackPublished', sync);
      localParticipant.off('trackUnpublished', sync);
    };
  }, [localParticipant]);

  // Filtro de ruido RNNoise no microfone LOCAL. Cada cliente (host, membro, lead)
  // roda este mesmo componente, entao TODO mundo publica audio ja' limpo de teclado,
  // ventilador e barulho de fundo, alem do noiseSuppression nativo do navegador.
  // Aplica quando a mic e' publicada e reaplica em troca de device.
  useEffect(() => {
    if (!localParticipant || !rnnoiseSupported()) return;
    let cancelled = false;
    let tries = 0;
    const apply = async () => {
      if (cancelled) return;
      const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
      const audioTrack = pub?.audioTrack as any; // LocalAudioTrack
      if (!audioTrack || typeof audioTrack.setProcessor !== 'function') return;
      // Ja' tem o filtro? nao reaplica (evita renegociacao em loop).
      if (audioTrack.getProcessor?.()?.name === 'rnnoise-noise-filter') return;
      try {
        await audioTrack.setProcessor(createRnnoiseProcessor());
        console.log('[MEET] filtro de ruido RNNoise ativo no microfone');
      } catch (e: any) {
        // O LiveKit seta o AudioContext na track durante o connect; se ainda nao
        // veio (timing), tenta de novo por alguns segundos antes de desistir.
        if (!cancelled && tries < 8 && /audio context/i.test(e?.message || '')) {
          tries++;
          setTimeout(apply, 600);
        } else {
          console.warn('[MEET] RNNoise setProcessor falhou (usando NS nativo):', e);
        }
      }
    };
    apply();
    const onPub = (pub: any) => { if (pub?.source === Track.Source.Microphone) { tries = 0; apply(); } };
    localParticipant.on('localTrackPublished', onPub);
    return () => { cancelled = true; localParticipant.off('localTrackPublished', onPub); };
  }, [localParticipant]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  // Acumulado de tempo gravado em segmentos anteriores (pausados+retomados).
  // Display do REC continua contando do total real, nao reseta a cada resume.
  const [recordingAccumulated, setRecordingAccumulated] = useState(0);

  // Timer da gravacao — soma o segmento atual ao acumulado de pausas anteriores.
  useEffect(() => {
    if (!isRecording) {
      setRecordingElapsed(0);
      return;
    }
    if (isPaused || !recordingStartedAt) {
      // Em pause: congela no acumulado, sem contar tempo
      setRecordingElapsed(recordingAccumulated);
      return;
    }
    const tick = () => setRecordingElapsed(
      recordingAccumulated + Math.floor((Date.now() - recordingStartedAt) / 1000)
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRecording, isPaused, recordingStartedAt, recordingAccumulated]);

  // Timer da REUNIAO (independente da gravacao) — comeca quando conecta na sala.
  // Why: o topbar precisa mostrar quanto tempo voce esta na reuniao, mesmo sem
  // estar gravando. How to apply: marca o ts no Connected, tick a cada segundo.
  const [meetingStartedAt, setMeetingStartedAt] = useState<number | null>(null);
  const [meetingElapsed, setMeetingElapsed] = useState(0);
  useEffect(() => {
    if (connectionState === ConnectionState.Connected && !meetingStartedAt) {
      setMeetingStartedAt(Date.now());
    }
  }, [connectionState, meetingStartedAt]);
  useEffect(() => {
    if (!meetingStartedAt) return;
    const tick = () => setMeetingElapsed(Math.floor((Date.now() - meetingStartedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [meetingStartedAt]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  // Ocultar a faixa lateral de cameras durante o screen share (cameraRail),
  // deixando a tela em 100%. Disponivel pra todos. Persiste so na sessao.
  const [thumbsMinimized, setThumbsMinimized] = useState(false);
  // Modo de visualizacao: 'palco' (um destaque grande + filmstrip embaixo) ou
  // 'galeria' (grid igualitario tipo Zoom). Persistido por dispositivo.
  const [viewMode, setViewMode] = useState<'palco' | 'galeria'>(() => {
    if (typeof window === 'undefined') return 'palco';
    return (localStorage.getItem('squaad.meet.viewMode') as 'palco' | 'galeria') || 'palco';
  });
  const chooseViewMode = useCallback((m: 'palco' | 'galeria') => {
    setViewMode(m);
    try { localStorage.setItem('squaad.meet.viewMode', m); } catch { /* noop */ }
  }, []);
  const [isCoachOn, setIsCoachOn] = useState(false);
  const [isDevicePickerOpen, setIsDevicePickerOpen] = useState(false);
  const [isAskQuestionOpen, setIsAskQuestionOpen] = useState(false);
  const [isQuestionsDrawerOpen, setIsQuestionsDrawerOpen] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState(0);
  const [leadAudioCaptured, setLeadAudioCaptured] = useState(false);
  const [meetingInfo, setMeetingInfo] = useState<{ id: string | null; lead_id: string | null }>({ id: null, lead_id: null });

  // ── Musica de espera / inicio da sessao ─────────────────────────────────
  // Enquanto a sessao nao comeca, toca o jingle de abertura pra quem ja entrou.
  // O host clica "Iniciar" pra parar a musica; so entao a gravacao comeca.
  const [sessionStarted, setSessionStarted] = useState(false);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const [musicMutedLocal, setMusicMutedLocal] = useState(false);
  const jingleRef = useRef<HTMLAudioElement | null>(null);

  // Audio da sala bloqueado pelo navegador (autoplay): se true, o participante
  // NAO ouve os outros ate tocar o botao "Ativar audio". Causa comum de "nao
  // consigo ouvir o outro lead", principalmente no mobile.
  const [audioBlocked, setAudioBlocked] = useState(false);
  useEffect(() => {
    if (!room) return;
    const sync = () => setAudioBlocked(!room.canPlaybackAudio);
    sync();
    room.on(RoomEvent.AudioPlaybackStatusChanged, sync);
    return () => { room.off(RoomEvent.AudioPlaybackStatusChanged, sync); };
  }, [room]);

  // Modo CS IA: o "Carlos CS" responde no chat se passando por mim (so host).
  const [csAgentOn, setCsAgentOn] = useState(false);

  // Sinais leves entre participantes (DataChannel): mao levantada + reactions
  const {
    raisedHands, raisedHandsQueue, raisedHandPosition,
    myHandRaised, toggleHand, bursts, sendReaction, muteAll, startSession,
    muteParticipant, unmuteAll, requestUnmute,
    pendingScreenRequests, requestScreenShare, respondScreenShare,
  } = useMeetSignals({ onSessionStart: () => setSessionStarted(true) });

  // Agente CS no chat (so host). Observa mensagens e responde como o Carlos.
  useCsAgent({ enabled: csAgentOn && role === 'host', roomName, meetingId: meetingInfo.id });

  // Log persistente do chat (so host grava). Captura leads + Carol CS.
  useMeetChatLog({ enabled: role === 'host', roomName, meetingId: meetingInfo.id });

  // Tick de 1s pra atualizar o "Xs" do contador da fila de maos. So roda
  // quando ha alguem na fila (evita re-render inutil).
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (raisedHandsQueue.length === 0) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [raisedHandsQueue.length]);

  // Fetch meeting + lead ids (host-only: coach only makes sense for the presenter)
  useEffect(() => {
    if (role !== 'host' || !roomName) return;
    (async () => {
      const { data } = await (supabase as any).from('meetings')
        .select('id, lead_id').eq('livekit_room_name', roomName).maybeSingle();
      if (data) setMeetingInfo({ id: data.id, lead_id: data.lead_id });
    })();
  }, [role, roomName]);

  // Estado da sessao pra TODOS (host e participantes): se ja comecou, nao toca
  // musica (quem entra depois do inicio nao ouve o jingle).
  useEffect(() => {
    if (!roomName) return;
    (async () => {
      const { data } = await (supabase as any).from('meetings')
        .select('session_started_at').eq('livekit_room_name', roomName).maybeSingle();
      if (data?.session_started_at) setSessionStarted(true);
    })();
  }, [roomName]);

  // Toca o jingle de abertura enquanto a sessao nao comecou (e a sala conectou).
  // Autoplay com som costuma ser liberado porque o usuario clicou pra entrar;
  // se o navegador bloquear, mostramos um botao "Ativar som".
  useEffect(() => {
    const a = jingleRef.current;
    if (!a) return;
    if (connectionState === ConnectionState.Connected && !sessionStarted) {
      a.volume = 0.45;
      a.muted = musicMutedLocal;
      a.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true));
    } else {
      try { a.pause(); a.currentTime = 0; } catch {}
    }
  }, [connectionState, sessionStarted, musicMutedLocal]);

  // Host inicia a sessao: para a musica pra todos, persiste no banco e (em
  // aula/live) libera a gravacao automatica.
  const startSessionNow = useCallback(async () => {
    setSessionStarted(true);
    startSession();
    if (meetingInfo.id) {
      try {
        await (supabase as any).from('meetings')
          .update({ session_started_at: new Date().toISOString() })
          .eq('id', meetingInfo.id);
      } catch {}
    }
  }, [startSession, meetingInfo.id]);

  // Transcription (uses mic directly - no screen share needed)
  const {
    isTranscribing,
    transcriptions,
    transcriptionsRef: transcriptionRef,
    startTranscription,
    stopTranscription,
    attachRemoteStream,
    saveTranscriptions,
    getFinalTranscriptions,
  } = useCallTranscription();

  // Legenda ao vivo (transmitida pra todos) + gatilho de dicionario no chat.
  const { captions, broadcastCaption } = useMeetCaptions(roomName);
  const { send: sendChatMsg } = useChat();
  const [captionsHidden, setCaptionsHidden] = useState(false); // ocultar legenda (local)
  const glossaryRef = useRef<Array<{ term: string; aliases: string[]; emoji: string | null; analogy: string | null; definition: string }>>([]);
  const glossaryPostedRef = useRef<Set<string>>(new Set());
  const lastCaptionSigRef = useRef('');

  // Carrega o glossario uma vez (host) pro gatilho de dicionario no chat.
  useEffect(() => {
    if (role !== 'host') return;
    (supabase as any)
      .from('glossary_terms')
      .select('term, aliases, emoji, analogy, definition')
      .eq('is_published', true)
      .then((r: any) => { glossaryRef.current = r.data || []; }, () => {});
  }, [role]);

  // Quando um termo do glossario e' falado, o card cai no chat (1x por termo/sessao).
  const injectGlossaryFromText = useCallback((text: string) => {
    const low = ' ' + text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
    for (const g of glossaryRef.current) {
      const names = [g.term, ...((g.aliases as string[]) || [])];
      const hit = names.some((n) => n && low.includes(' ' + n.toLowerCase() + ' '));
      if (hit && !glossaryPostedRef.current.has(g.term)) {
        glossaryPostedRef.current.add(g.term);
        const msg = `📖 ${g.emoji || ''} ${g.term}\n${g.analogy ? '🍽️ ' + g.analogy + '\n' : ''}${g.definition}`;
        try { sendChatMsg(msg); } catch { /* noop */ }
      }
    }
  }, [sendChatMsg]);

  // Host transmite cada linha de transcricao como legenda pra todos + dispara o
  // gatilho de dicionario nas linhas finais.
  useEffect(() => {
    if (role !== 'host' || !isTranscribing) return;
    const last = transcriptions[transcriptions.length - 1];
    if (!last || !last.text.trim()) return;
    const sig = `${(last as any).id}:${last.is_final}:${last.text}`;
    if (sig === lastCaptionSigRef.current) return;
    lastCaptionSigRef.current = sig;
    broadcastCaption({
      id: String((last as any).id ?? Date.now()),
      text: last.text,
      speaker: last.speaker,
      is_final: last.is_final,
    });
    if (last.is_final) injectGlossaryFromText(last.text);
  }, [transcriptions, isTranscribing, role, broadcastCaption, injectGlossaryFromText]);

  // Sair da sala: DESCONECTA o LiveKit de verdade. O onDisconnected do
  // LiveKitRoom (handleDisconnect) cuida da limpeza + tela de saida. Antes o
  // botao so chamava handleDisconnect sem desconectar, entao o lead nunca saia.
  const handleLeave = useCallback(() => {
    try {
      if (room) { room.disconnect(); return; }
    } catch {}
    onLeave(); // fallback se a sala ja caiu
  }, [room, onLeave]);

  const toggleMic = useCallback(async () => {
    // Le do LiveKit, nao do React state — evita race quando 2 cliques
    // rapidos disparam com isMicOn ainda nao atualizado.
    const target = !localParticipant.isMicrophoneEnabled;
    try {
      await localParticipant.setMicrophoneEnabled(target);
      // O sync via trackMuted/Unmuted vai atualizar setIsMicOn, mas
      // setamos imediatamente pra UX mais responsiva.
      setIsMicOn(target);
    } catch (err: any) {
      console.error('[MEET] mic toggle failed', err);
      toast.error('Erro ao alternar microfone: ' + (err?.message || 'desconhecido'));
      // Revert UI ao estado real
      setIsMicOn(localParticipant.isMicrophoneEnabled);
    }
  }, [localParticipant]);

  const toggleCam = useCallback(async () => {
    const target = !localParticipant.isCameraEnabled;
    try {
      await localParticipant.setCameraEnabled(target);
      setIsCamOn(target);
    } catch (err: any) {
      console.error('[MEET] cam toggle failed', err);
      toast.error('Erro ao alternar camera: ' + (err?.message || 'desconhecido'));
      setIsCamOn(localParticipant.isCameraEnabled);
    }
  }, [localParticipant]);

  // Detecta quando o screen share termina por motivo externo: usuario clicou
  // em "Parar de compartilhar" no popup nativo do browser, janela compartilhada
  // foi fechada, ou SO matou o stream. Sem esse listener, isScreenSharing fica
  // travado em true e o host nao percebe que parou (aluno avisa).
  // Why: bug reportado — compartilhamento "fecha do nada" e o host so descobre
  // tarde. How to apply: ouvi LocalTrackUnpublished + filtra ScreenShare e
  // sincroniza state + toast persistente avisando que o stream caiu.
  useEffect(() => {
    if (!room) return;
    const onUnpublished = (publication: any) => {
      if (publication?.source === Track.Source.ScreenShare || publication?.source === Track.Source.ScreenShareAudio) {
        console.log('[MEET] screen share unpublished', publication.trackSid);
        setIsScreenSharing(false);
        toast.error('Compartilhamento de tela encerrado. Clique em "Tela" pra retomar.', {
          duration: 8000,
        });
      }
    };
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);
    return () => { room.off(RoomEvent.LocalTrackUnpublished, onUnpublished); };
  }, [room]);

  // Guest precisa de aprovacao do host pra compartilhar. Pra evitar o problema
  // do "user activation required" no picker do browser (Promise async perde o
  // gesture original), o fluxo e: 1º clique pede aprovacao → host responde →
  // mostra chip "Aprovado, clique de novo" → 2º clique abre o picker (gesture
  // valido). Estado abaixo guarda a aprovacao por 60s.
  const [screenShareApproved, setScreenShareApproved] = useState(false);
  const screenShareApprovedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Abre o picker do navegador e publica a tela. PRECISA ser chamado direto de
  // um clique (gesto do usuario), senao o browser bloqueia com NotAllowedError
  // "user gesture required". Por isso o guest aprovado clica num botao que chama
  // ISTO direto, em vez de depender de uma Promise async ja resolvida.
  const startScreenShareNow = useCallback(async () => {
    try {
      const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
      toast.info(
        isMac
          ? 'Escolha "Tela inteira" ou "Janela" pra compartilhar app. Se so aparecer "Aba do Chrome", abra Configuracoes do macOS -> Privacidade -> Gravacao de Tela e habilite o Chrome/Brave/Arc, depois reinicie o navegador.'
          : 'Escolha "Tela inteira", "Janela" ou "Aba". Marque "Compartilhar audio" pra transmitir som tambem.',
        { duration: 8000 }
      );
      // Sem displaySurface, sem selfBrowserSurface — deixa o browser oferecer TODAS as
      // opcoes (tela inteira, janela de app, aba). systemAudio:'include' captura audio do
      // sistema/app. noiseSuppression:false evita distorcer musica/video compartilhados.
      try {
        await localParticipant.setScreenShareEnabled(true, {
          audio: true,
          systemAudio: 'include',
          surfaceSwitching: 'include',
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        } as any);
      } catch (innerErr: any) {
        // "Tela inteira" no macOS as vezes falha com a captura de audio do sistema
        // (so suportado em aba). Se o erro NAO foi cancelamento/permissao do usuario,
        // tenta de novo so com video pra nao deixar o compartilhamento travado.
        if (innerErr?.name === 'NotAllowedError' || innerErr?.name === 'NotFoundError') throw innerErr;
        console.warn('[MEET] screen share com audio falhou, tentando so video:', innerErr);
        await localParticipant.setScreenShareEnabled(false).catch(() => {});
        await localParticipant.setScreenShareEnabled(true, { audio: false, surfaceSwitching: 'include' } as any);
      }
      // Estado autoritativo do LiveKit (evita ficar "ligado" sem track de verdade).
      setIsScreenSharing(localParticipant.isScreenShareEnabled);
      // Consome a aprovacao
      setScreenShareApproved(false);
      if (screenShareApprovedTimeoutRef.current) clearTimeout(screenShareApprovedTimeoutRef.current);
      if (localParticipant.isScreenShareEnabled) toast.success('Compartilhamento ativo');
    } catch (err: any) {
      console.error('Screen share error:', err);
      // Limpa qualquer track-zumbi pra um proximo clique conseguir compartilhar de novo.
      try { await localParticipant.setScreenShareEnabled(false); } catch { /* noop */ }
      setIsScreenSharing(false);
      if (err?.name === 'NotAllowedError') {
        toast.info('Compartilhamento cancelado');
      } else if (err?.name === 'NotFoundError' || err?.message?.includes('not allowed')) {
        toast.error(
          'Sem permissao do sistema pra "Tela inteira". No Mac: Ajustes do Sistema -> Privacidade e Seguranca -> Gravacao de Tela -> habilite seu navegador e reinicie ele. (Compartilhar "Janela" funciona sem essa permissao.)',
          { duration: 12000 }
        );
      } else {
        toast.error('Erro ao compartilhar tela: ' + (err?.message || err?.name || 'desconhecido'));
      }
    }
  }, [localParticipant]);

  const toggleScreen = useCallback(async () => {
    try {
      if (isScreenSharing) {
        await localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        return;
      }

      // Host compartilha direto (este clique ja e' o gesto valido).
      if (role === 'host') {
        await startScreenShareNow();
        return;
      }

      // Guest ja aprovado: o proprio clique no botao "Tela"/"Compartilhar agora"
      // e' o gesto, entao abre o picker direto.
      if (screenShareApproved) {
        await startScreenShareNow();
        return;
      }

      // Guest sem aprovacao: pede pro host. Quando aprovar, NAO abrimos o picker
      // aqui (o gesto original ja morreu na espera) — mostramos o botao
      // "Compartilhar agora" pro guest clicar (gesto novo e valido).
      toast.info('Aguardando aprovação do apresentador...', { duration: 5000 });
      const approved = await requestScreenShare();
      if (!approved) {
        toast.error('Compartilhamento de tela não foi aprovado');
        return;
      }
      setScreenShareApproved(true);
      // Janela de 60s pra usar a aprovacao
      if (screenShareApprovedTimeoutRef.current) clearTimeout(screenShareApprovedTimeoutRef.current);
      screenShareApprovedTimeoutRef.current = setTimeout(() => setScreenShareApproved(false), 60000);
      toast.success('Aprovado! Toque no botão "Compartilhar agora" (válido por 60s)', { duration: 8000 });
    } catch (err: any) {
      console.error('Screen share toggle error:', err);
      toast.error('Erro ao compartilhar tela: ' + (err?.message || err?.name || 'desconhecido'));
    }
  }, [localParticipant, isScreenSharing, role, screenShareApproved, requestScreenShare, startScreenShareNow]);

  // Auto-save transcription every 30 seconds during the meeting
  useEffect(() => {
    if (!isTranscribing || !roomName) return;
    const interval = setInterval(async () => {
      try {
        const segments = transcriptionRef?.current?.filter((t: any) => t.is_final && t.text?.trim()) || [];
        if (segments.length === 0) return;
        const text = segments.map((t: any) => `${t.speaker}: ${t.text}`).join('\n');
        if (text.length < 10) return;

        const { data: meeting } = await (supabase as any)
          .from('meetings').select('id, started_at').eq('livekit_room_name', roomName).maybeSingle();
        if (!meeting) return;

        // Garante started_at populado — referencia pro [MM:SS] da Trilha do PDF.
        // Usa o timestamp do PRIMEIRO segmento (mais proximo do inicio real).
        const firstTs = (segments[0] as any)?.timestamp;
        const updatePayload: any = { transcription: text, transcriptions: segments };
        if (!meeting.started_at && typeof firstTs === 'number') {
          updatePayload.started_at = new Date(firstTs).toISOString();
        }
        await (supabase as any).from('meetings').update(updatePayload).eq('id', meeting.id);
        console.log(`[MEET] Auto-saved ${segments.length} transcription segments`);
      } catch (e) {
        // Silent - don't interrupt the meeting
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isTranscribing, roomName]);

  // Trava anti-duplo-clique: o egress (start/stop/pause/resume) e' assincrono e
  // chamadas concorrentes geram corrida de egress. O botao reage na hora (otimista),
  // mas ignora cliques novos ate a operacao anterior terminar.
  const recActionBusy = useRef(false);

  const toggleRecording = useCallback(async () => {
    if (recActionBusy.current) return;
    recActionBusy.current = true;
    const wasRecording = isRecording;
    // Otimista: o botao muda JA; o egress confirma em background.
    if (!wasRecording) {
      setIsRecording(true);
      setIsPaused(false);
      setRecordingAccumulated(0);
      setRecordingStartedAt(Date.now());
    } else {
      setIsRecording(false);
      setIsPaused(false);
      setRecordingAccumulated(0);
      setRecordingStartedAt(null);
    }
    try {
      const res = await supabase.functions.invoke('livekit-start-recording', {
        body: { roomName, action: wasRecording ? 'stop' : 'start' },
      });
      if (!wasRecording) {
        if (res.data?.success) {
          toast.success('Gravacao iniciada');
        } else {
          // reverte: nao iniciou
          setIsRecording(false);
          setRecordingStartedAt(null);
          toast.error('Erro: ' + (res.data?.error || 'falha ao iniciar'));
        }
      } else {
        toast.success('Gravacao parada');
      }
    } catch (err: any) {
      // reverte ao estado anterior ao clique
      setIsRecording(wasRecording);
      setRecordingStartedAt(wasRecording ? Date.now() : null);
      toast.error('Erro na gravacao: ' + (err?.message || err));
    } finally {
      recActionBusy.current = false;
    }
  }, [isRecording, roomName]);

  const togglePause = useCallback(async () => {
    if (recActionBusy.current) return;
    recActionBusy.current = true;
    const wasPaused = isPaused;
    // Otimista: botao + timer mudam na hora; o egress para/retoma em background.
    if (!wasPaused) {
      const segmentDuration = recordingStartedAt
        ? Math.floor((Date.now() - recordingStartedAt) / 1000)
        : 0;
      setIsPaused(true);
      setRecordingAccumulated(prev => prev + segmentDuration);
      setRecordingStartedAt(null);
      toast.success('Pausado');
    } else {
      setIsPaused(false);
      setRecordingStartedAt(Date.now());
      toast.info('Retomando...');
    }
    try {
      const res = await supabase.functions.invoke('livekit-start-recording', {
        body: { roomName, action: wasPaused ? 'start' : 'pause' },
      });
      if (wasPaused && !res.data?.success) {
        // resume falhou -> volta pra pausado
        setIsPaused(true);
        setRecordingStartedAt(null);
        toast.error('Erro ao retomar: ' + (res.data?.error || 'falha'));
      }
    } catch (err: any) {
      // reverte ao estado anterior ao clique
      setIsPaused(wasPaused);
      setRecordingStartedAt(wasPaused ? null : Date.now());
      toast.error('Erro: ' + (err?.message || err));
    } finally {
      recActionBusy.current = false;
    }
  }, [isPaused, recordingStartedAt, roomName]);

  // Auto-start recording for lesson mode AND scheduled live sessions (host only)
  const [autoRecordingStarted, setAutoRecordingStarted] = useState(false);
  useEffect(() => {
    const shouldAutoRecord = (mode === 'lesson' || mode === 'live-session') && role === 'host';
    if (!shouldAutoRecord || autoRecordingStarted || isRecording) return;
    if (connectionState !== ConnectionState.Connected) return;
    // So grava depois que o host inicia a sessao (a musica de espera para).
    if (!sessionStarted) return;
    setAutoRecordingStarted(true);
    (async () => {
      try {
        const res = await supabase.functions.invoke('livekit-start-recording', {
          body: { roomName, action: 'start' },
        });
        if (res.data?.success) {
          setIsRecording(true);
          setRecordingStartedAt(Date.now());
          toast.success(mode === 'live-session'
            ? 'Gravacao da live iniciada automaticamente'
            : 'Gravacao da aula iniciada automaticamente');
        } else {
          toast.error('Falha ao iniciar gravacao: ' + (res.data?.error || 'erro desconhecido'));
        }
      } catch (e: any) {
        console.error('[MEET] Auto-record failed:', e);
        toast.error('Falha ao iniciar gravacao automatica');
      }
    })();
  }, [mode, role, connectionState, autoRecordingStarted, isRecording, roomName, sessionStarted]);

  // Auto-start transcription when connected
  // Captures: mic (vendedor) + remote audio output (lead)
  // IMPORTANTE: Soniox em TEMPO REAL so em call de venda (mode=sales), pro coach
  // ao vivo. Aula/masterclass/live (lesson/live-session) NAO transcrevem ao vivo
  // (custo alto em sessao longa) — a gravacao e' transcrita em LOTE depois via
  // Groq (VPS extract-audio -> transcribe-recording -> process-lesson-recording).
  const [autoTranscriptionStarted, setAutoTranscriptionStarted] = useState(false);
  useEffect(() => {
    if (mode !== 'sales') return;
    if (connectionState === ConnectionState.Connected && !autoTranscriptionStarted && !isTranscribing) {
      setAutoTranscriptionStarted(true);

      // Reaproveita o track de microfone JA publicado pelo LiveKit (evita
      // segundo getUserMedia que fazia o Soniox ficar mudo no macOS).
      const getLiveKitMicStream = (): MediaStream | undefined => {
        const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
        const track = pub?.track as any;
        if (!track) return undefined;
        if (track.mediaStream && track.mediaStream.getAudioTracks().length > 0) {
          return track.mediaStream;
        }
        if (track.mediaStreamTrack) {
          return new MediaStream([track.mediaStreamTrack]);
        }
        return undefined;
      };

      // Create a fake callObj with audio_analyser from remote participant audio tracks
      const setupRemoteAudio = async () => {
        try {
          const audioCtx = new AudioContext({ sampleRate: 48000 });
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;

          // Connect remote audio tracks to analyser
          let remoteConnected = false;
          for (const rp of remoteParticipants) {
            const pub = rp.getTrackPublication(Track.Source.Microphone);
            const audioTrack = pub?.track;
            if (audioTrack) {
              // Try multiple ways to get the MediaStream
              let stream: MediaStream | null = null;
              if (audioTrack.mediaStream) {
                stream = audioTrack.mediaStream;
              } else if ((audioTrack as any).mediaStreamTrack) {
                stream = new MediaStream([(audioTrack as any).mediaStreamTrack]);
              } else if (pub?.audioTrack?.mediaStreamTrack) {
                stream = new MediaStream([pub.audioTrack.mediaStreamTrack]);
              }

              if (stream && stream.getAudioTracks().length > 0) {
                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);
                remoteConnected = true;
                console.log('[MEET] Remote audio connected for transcription:', rp.identity);
              } else {
                console.warn('[MEET] No audio stream for:', rp.identity);
              }
            }
          }

          // Mic do LiveKit pra transcricao do host (sem segundo getUserMedia)
          const micStream = getLiveKitMicStream();

          if (!remoteConnected && !micStream) {
            console.warn('[MEET] No audio sources yet, retrying in 5s...');
            setTimeout(setupRemoteAudio, 5000);
            return;
          }

          if (remoteConnected) {
            // Connect analyser to destination for playback
            analyser.connect(audioCtx.destination);
          }

          // Create fake callObj that startTranscription expects
          const fakeCallObj = remoteConnected
            ? { audio_analyser: Promise.resolve(analyser) }
            : null;

          const leadName = remoteParticipants[0]?.name || remoteParticipants[0]?.identity || 'Lead';
          await startTranscription(fakeCallObj, leadName, micStream);
          console.log('[MEET] Transcricao iniciada — mic LiveKit:', !!micStream, '· remote:', remoteConnected);
        } catch (e: any) {
          console.error('[MEET] Falha transcricao dual:', e);
          // Fallback: mic only (sem getUserMedia novo se possivel)
          const micStream = getLiveKitMicStream();
          await startTranscription(null, 'Participante', micStream);
          console.log('[MEET] Transcricao fallback (mic only)');
        }
      };

      // Wait a bit for remote participants to connect
      setTimeout(setupRemoteAudio, 3000);
    }
  }, [mode, connectionState, autoTranscriptionStarted, isTranscribing, remoteParticipants, localParticipant]);

  // Re-attach do audio do remoto quando ele conecta DEPOIS da transcricao
  // ja ter arrancado (caso classico: host abre a sala, transcricao comeca em
  // mic-only, lead entra 1min depois — sem isso o Coach IA nunca ouve o lead).
  useEffect(() => {
    if (!isTranscribing) {
      setLeadAudioCaptured(false);
      return;
    }
    if (remoteParticipants.length === 0) {
      setLeadAudioCaptured(false);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tryAttach = async () => {
      if (cancelled) return;
      let attached = false;
      for (const rp of remoteParticipants) {
        const pub = rp.getTrackPublication(Track.Source.Microphone);
        const audioTrack = pub?.track as any;
        if (!audioTrack) continue;
        const mst: MediaStreamTrack | undefined = audioTrack.mediaStreamTrack;
        const stream = audioTrack.mediaStream
          ? (audioTrack.mediaStream as MediaStream)
          : mst ? new MediaStream([mst]) : null;
        if (stream && stream.getAudioTracks().length > 0) {
          await attachRemoteStream(stream, rp.name || rp.identity || 'Lead');
          attached = true;
          setLeadAudioCaptured(true);
          console.log('[MEET] Lead audio captured for Coach IA:', rp.identity);
          break;
        }
      }
      attempts += 1;
      if (!attached && attempts < 12) {
        // Backoff mais rapido nas primeiras tentativas (track aparece ~1-2s
        // depois do connect), mais lento depois.
        setTimeout(tryAttach, attempts <= 4 ? 500 : 1500);
      } else if (!attached) {
        console.warn('[MEET] Lead audio attach gave up after', attempts, 'tries');
      }
    };
    tryAttach();
    return () => { cancelled = true; };
  }, [isTranscribing, remoteParticipants, attachRemoteStream]);

  const toggleTranscription = useCallback(async () => {
    if (isTranscribing) {
      stopTranscription();
      toast.info('Transcricao parada');
    } else {
      // Reusa mic do LiveKit (mesma logica do auto-start) pra evitar getUserMedia duplo
      const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
      const t = pub?.track as any;
      const micStream = t?.mediaStream
        ? t.mediaStream
        : t?.mediaStreamTrack
          ? new MediaStream([t.mediaStreamTrack])
          : undefined;
      await startTranscription(null, 'Participante', micStream);
    }
  }, [isTranscribing, startTranscription, stopTranscription, localParticipant]);

  const participantCount = remoteParticipants.length + 1; // +1 for local

  // ---- Render layouts ----

  // Connecting state
  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-gray-400">Conectando...</p>
      </div>
    );
  }

  // Total de miniaturas (self + remotos com camera), pro chip de minimizado.
  const thumbCount = remoteTracks.filter(t => t.source !== Track.Source.ScreenShare).length + 1;

  // Durante o screen share, as cameras ficam numa FAIXA LATERAL (coluna a direita),
  // nunca sobrepostas na tela compartilhada — assim ninguem tapa os itens da tela.
  // Da pra OCULTAR a faixa (qualquer um): colapsa pra um chip e a tela ocupa 100%.
  const railTiles = [
    ...(localCamTrack ? [{ track: localCamTrack, isLocal: true }] : []),
    ...remoteTracks
      .filter(t => t.source !== Track.Source.ScreenShare)
      .map(t => ({ track: t, isLocal: false })),
  ];
  const cameraRail = thumbsMinimized ? (
    <button
      onClick={() => setThumbsMinimized(false)}
      className="absolute top-16 right-3 sm:right-4 z-20 flex items-center gap-1.5 bg-black/80 backdrop-blur-md border border-white/15 rounded-full px-3 py-2 shadow-2xl hover:bg-black/90 transition-colors"
      title="Mostrar participantes"
    >
      <User className="w-4 h-4 text-white/80" />
      <span className="text-white text-xs font-semibold tabular-nums">{thumbCount}</span>
      <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
    </button>
  ) : (
    <div className="w-[112px] sm:w-[200px] shrink-0 h-full bg-[#0a0a0a] border-l border-white/10 flex flex-col gap-2 p-2 overflow-y-auto">
      <button
        onClick={() => setThumbsMinimized(true)}
        className="self-end flex items-center gap-1 bg-black/70 border border-white/10 rounded-full px-2 py-1 shadow hover:bg-black/90 transition-colors shrink-0"
        title="Ocultar faixa de participantes (tela cheia)"
      >
        <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        <span className="text-[10px] text-white/70 font-medium">Ocultar</span>
      </button>
      {railTiles.map(({ track, isLocal }, i) => (
        <div key={track.participant.sid + '-' + track.source}
             className={`w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black shrink-0 transition-all ${
               speakingSet.has(track.participant.identity)
                 ? 'ring-2 ring-[#3B82F6] shadow-[0_0_12px_rgba(250,200,0,0.5)]'
                 : isLocal ? 'ring-1 ring-[#3B82F6]/50' : 'ring-1 ring-white/15'
             }`}>
          <ParticipantVideo
            trackRef={track}
            name={isLocal ? (localParticipant.name || 'Voce') : (track.participant.name || `Participante ${i}`)}
            isLocal={isLocal}
            handRaised={!!raisedHands[track.participant.identity]}
            handPosition={raisedHandPosition[track.participant.identity]}
            speaking={speakingSet.has(track.participant.identity)}
            className="w-full h-full"
          />
        </div>
      ))}
    </div>
  );

  // Format helpers pro topbar
  const formatHMS = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };
  const formatMeetingClock = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}` : `${m}:${(totalSec % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Topbar: logo + AO VIVO + clock da reuniao + REC (se gravando) + contador.
          Responsivo: encolhe no mobile e respeita o notch (safe-area) pra nao
          ficar sob a barra de status do celular. */}
      <div
        className="absolute left-0 right-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-4 pointer-events-none"
        style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        {/* Esquerda: logo + AO VIVO + clock */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}>
          <img src="/mais-que-vencedores-logo.svg" alt="+ que Vencedores" className="h-6 sm:h-9 w-auto shrink-0" />
          <div className="flex items-center gap-1.5 bg-red-600/95 rounded-full pl-1.5 pr-2 sm:pr-3 py-0.5 sm:py-1 shadow-lg shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[9px] sm:text-[11px] font-bold uppercase tracking-wider">Ao vivo</span>
          </div>
          {meetingStartedAt && (
            <span className="hidden sm:inline text-white text-sm font-mono tabular-nums bg-black/60 backdrop-blur-md rounded-full px-3 py-1 shrink-0">
              {formatMeetingClock(meetingElapsed)}
            </span>
          )}
          {isRecording && (
            <span className={`text-[9px] sm:text-[11px] font-bold flex items-center gap-1 sm:gap-1.5 tabular-nums bg-black/60 backdrop-blur-md rounded-full px-2 py-0.5 sm:py-1 shrink-0 ${
              isPaused ? 'text-yellow-400' : 'text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'
              }`} />
              <span>{isPaused ? 'PAUSADO' : 'REC'}</span>
              <span className="hidden sm:inline text-white">{formatHMS(recordingElapsed)}</span>
            </span>
          )}
        </div>

        {/* Direita: contador de participantes */}
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 sm:py-1.5 pointer-events-auto shrink-0" title={`${participantCount} na sala`}>
          <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <span className="text-white text-sm font-semibold tabular-nums">{participantCount}</span>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Toggle de desfocar fundo (canto sup direito) */}
        <BackgroundBlurToggle />
        {/* Alternador Palco (destaque) / Galeria (grid). So' faz sentido com 2+
            pessoas e sem screen share (o share tem layout proprio tela+faixa). */}
        {!screenShareTrack && participantCount >= 2 && (
          <div className="absolute z-20 flex items-center gap-0.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-full p-0.5 shadow-lg"
               style={{ top: 'calc(max(0.5rem, env(safe-area-inset-top)) + 2.6rem)', left: '0.75rem' }}>
            <button
              onClick={() => chooseViewMode('palco')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${viewMode === 'palco' ? 'bg-[#3B82F6] text-black' : 'text-white/70 hover:text-white'}`}
            >
              Palco
            </button>
            <button
              onClick={() => chooseViewMode('galeria')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${viewMode === 'galeria' ? 'bg-[#3B82F6] text-black' : 'text-white/70 hover:text-white'}`}
            >
              Galeria
            </button>
          </div>
        )}

        {/* Botao de LEGENDA ao vivo (host liga/desliga; comeca desligada pra
            controlar custo da transcricao). A transcricao roda no host e e'
            transmitida pra todos via useMeetCaptions. */}
        {role === 'host' && (
          <button
            onClick={() => { setCaptionsHidden(false); toggleTranscription(); }}
            className={`absolute z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md border transition-colors ${
              isTranscribing ? 'bg-[#3B82F6] text-black border-[#3B82F6]' : 'bg-black/70 text-white/80 border-white/10 hover:text-white'
            }`}
            style={{ top: 'calc(max(0.5rem, env(safe-area-inset-top)) + 2.6rem)', right: '0.75rem' }}
            title="Legenda ao vivo (transcricao)"
          >
            <FileText className="w-3.5 h-3.5" />
            {isTranscribing ? 'Legenda ON' : 'Legenda'}
          </button>
        )}

        {/* Overlay da legenda (todos veem). Ocultavel localmente. */}
        {!captionsHidden && captions.length > 0 && (
          <>
            <TranscriptionOverlay transcriptions={captions} />
            <button
              onClick={() => setCaptionsHidden(true)}
              className="absolute bottom-4 right-3 z-20 text-[10px] text-white/60 hover:text-white bg-black/60 rounded-full px-2 py-1"
              title="Ocultar legenda"
            >
              ocultar legenda
            </button>
          </>
        )}
        {captionsHidden && captions.length > 0 && (
          <button
            onClick={() => setCaptionsHidden(false)}
            className="absolute bottom-4 right-3 z-20 text-[10px] text-white/70 hover:text-white bg-black/70 border border-white/15 rounded-full px-2.5 py-1"
            title="Mostrar legenda"
          >
            CC
          </button>
        )}
        {screenShareTrack ? (
          /* ===== SCREEN SHARE MODE: tela + faixa lateral de cameras (sem sobrepor) ===== */
          <div className="relative w-full h-full bg-black flex">
            <div className="flex-1 min-w-0 relative">
              <ParticipantVideo
                trackRef={screenShareTrack}
                name={screenShareTrack.participant.name || 'Apresentador'}
                contain
                className="w-full h-full"
              />
            </div>
            {cameraRail}
          </div>
        ) : participantCount === 1 ? (
          /* ---- Alone: self full screen with waiting overlay ---- */
          <div className="relative w-full h-full">
            <ParticipantVideo
              trackRef={localCamTrack}
              name={localParticipant.name || 'Voce'}
              isLocal
              className="w-full h-full"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6] mx-auto mb-3" />
                <p className="text-white text-lg font-medium">Aguardando participantes...</p>
                <p className="text-gray-400 text-sm mt-1 mb-4">Compartilhe o link da sala para convidar</p>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/meet/${roomName}?role=guest`;
                    navigator.clipboard.writeText(url).then(
                      () => toast.success('Link da sala copiado'),
                      () => toast.error('Falha ao copiar — copia da barra de enderecos'),
                    );
                  }}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 border border-[#3B82F6]/40 text-[#3B82F6] text-sm font-medium transition-colors"
                >
                  Copiar link da sala
                </button>
                <p className="text-gray-500 text-[11px] mt-3">
                  Estado: <span className="text-gray-300">{connectionState}</span>
                  {' · '}
                  Sala: <span className="text-gray-300 font-mono">{roomName}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ---- 2+ pessoas: PALCO (destaque + filmstrip) ou GALERIA (grid) ---- */
          (() => {
            // Todas as cameras (remotas + local), incluindo placeholders de quem
            // esta com camera desligada (viram avatar).
            const camList = [
              ...remoteTracks.filter(t => t.source === Track.Source.Camera),
              ...(localCamTrack ? [localCamTrack] : []),
            ];
            const keyOf = (t: any) => (t?.participant?.sid || '') + '-' + (t?.source || '');
            const isLocalT = (t: any) => t?.participant?.sid === localParticipant.sid;
            const tileName = (t: any, i: number) =>
              isLocalT(t) ? (localParticipant.name || 'Voce') : (t?.participant?.name || `Participante ${i + 1}`);

            if (viewMode === 'galeria') {
              // GALERIA: slots MAIORES com pouca gente, reduzindo conforme o volume
              // aumenta. Colunas ainda limitadas pela largura pra nao virar tile minusculo.
              const n = camList.length;
              const idealCols = n <= 3 ? 2 : n <= 8 ? 3 : n <= 15 ? 4 : 5;
              const maxCols = viewportW < 640 ? 2 : viewportW < 1024 ? 3 : 5;
              const cols = Math.max(1, Math.min(idealCols, maxCols));
              const rows = Math.ceil(n / cols);
              const crowded = rows > 3;
              return (
                <div
                  className={`w-full h-full grid gap-2 p-2 ${crowded ? 'overflow-y-auto' : ''}`}
                  style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridAutoRows: crowded ? 'minmax(200px, 1fr)' : 'minmax(0, 1fr)',
                  }}
                >
                  {camList.map((track, i) => (
                    <ParticipantVideo
                      key={keyOf(track)}
                      trackRef={track}
                      name={tileName(track, i)}
                      isLocal={isLocalT(track)}
                      handRaised={!!raisedHands[track.participant.identity]}
                      handPosition={raisedHandPosition[track.participant.identity]}
                      speaking={speakingSet.has(track.participant.identity)}
                      onAskQuestion={role !== 'host' && isHostTrack(track) ? () => setIsAskQuestionOpen(true) : undefined}
                      className="w-full h-full rounded-lg"
                    />
                  ))}
                </div>
              );
            }

            // PALCO: destaque grande (quem fala -> host -> primeiro remoto) + filmstrip.
            const mainTrack =
              camList.find(t => speakingSet.has(t.participant.identity)) ||
              camList.find(t => isHostTrack(t)) ||
              camList.find(t => !isLocalT(t)) ||
              camList[0];
            const strip = camList.filter(t => keyOf(t) !== keyOf(mainTrack));
            return (
              <div className="w-full h-full flex flex-col p-2 gap-2">
                <div className={`flex-1 min-h-0 rounded-xl overflow-hidden bg-black relative transition-all ${
                  mainTrack && speakingSet.has(mainTrack.participant.identity)
                    ? 'ring-2 ring-[#3B82F6] shadow-[0_0_20px_rgba(250,200,0,0.35)]'
                    : 'ring-1 ring-white/10'
                }`}>
                  {mainTrack && (
                    <ParticipantVideo
                      trackRef={mainTrack}
                      name={tileName(mainTrack, 0)}
                      isLocal={isLocalT(mainTrack)}
                      handRaised={!!raisedHands[mainTrack.participant.identity]}
                      handPosition={raisedHandPosition[mainTrack.participant.identity]}
                      speaking={speakingSet.has(mainTrack.participant.identity)}
                      onAskQuestion={role !== 'host' && isHostTrack(mainTrack) ? () => setIsAskQuestionOpen(true) : undefined}
                      className="w-full h-full"
                    />
                  )}
                </div>
                {strip.length > 0 && (
                  <div className="h-[80px] sm:h-[128px] shrink-0 flex gap-2 overflow-x-auto">
                    {strip.map((track, i) => (
                      <div
                        key={keyOf(track)}
                        className={`h-full aspect-video shrink-0 rounded-xl overflow-hidden bg-black transition-all ${
                          speakingSet.has(track.participant.identity)
                            ? 'ring-2 ring-[#3B82F6] shadow-[0_0_12px_rgba(250,200,0,0.5)]'
                            : isLocalT(track) ? 'ring-1 ring-[#3B82F6]/50' : 'ring-1 ring-white/15'
                        }`}
                      >
                        <ParticipantVideo
                          trackRef={track}
                          name={tileName(track, i)}
                          isLocal={isLocalT(track)}
                          handRaised={!!raisedHands[track.participant.identity]}
                          handPosition={raisedHandPosition[track.participant.identity]}
                          speaking={speakingSet.has(track.participant.identity)}
                          onAskQuestion={role !== 'host' && isHostTrack(track) ? () => setIsAskQuestionOpen(true) : undefined}
                          className="w-full h-full"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* Chat panel */}
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onUnreadChange={setUnreadChat}
        />

        {/* Painel de pessoas (todos veem a lista/contador; host controla mic) */}
        <ParticipantsPanel
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          role={role}
          speakingSet={speakingSet}
          onMuteParticipant={(id) => { muteParticipant(id); toast.success('Participante silenciado'); }}
          onRequestUnmute={(id) => { requestUnmute(id); toast.success('Convite pra falar enviado'); }}
          onMuteAll={() => { muteAll(); toast.success('Microfones de todos silenciados'); }}
          onUnmuteAll={() => { unmuteAll(); toast.success('Todos foram convidados a ligar o microfone'); }}
        />

        {/* Live Coach panel — host only */}
        {role === 'host' && (
          <LiveCoachPanel
            meetingId={meetingInfo.id}
            leadId={meetingInfo.lead_id}
            transcriptions={transcriptions}
            enabled={isCoachOn}
            onToggle={() => setIsCoachOn(!isCoachOn)}
            isTranscribing={isTranscribing}
            onStartTranscription={toggleTranscription}
            micCaptured={isTranscribing}
            leadAudioCaptured={leadAudioCaptured}
            hasRemoteParticipant={remoteParticipants.length > 0}
          />
        )}
      </div>

      {/* Reaction overlay (flutua em cima dos videos) */}
      <ReactionBurstOverlay bursts={bursts} />

      {/* Jingle de abertura (musica de espera). Toca enquanto a sessao nao
          comeca. Nao publicado na sala — cada cliente toca localmente. */}
      <audio ref={jingleRef} src="/sounds/jingle-abertura.mp3" loop preload="auto" />

      {/* Música de espera: barra clara com rótulo + botão de silenciar (pra quem
          quiser) e, pro host, o botão de iniciar (para a música e começa a gravar). */}
      {!sessionStarted && connectionState === ConnectionState.Connected && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-black/80 backdrop-blur-md border border-[#3B82F6]/30 rounded-full pl-3 pr-2 py-1.5 shadow-2xl max-w-[94vw]"
          style={{ top: 'max(3.5rem, calc(env(safe-area-inset-top) + 3rem))' }}
        >
          <span className="text-[#3B82F6] text-base shrink-0">🎵</span>
          <span className="text-white/80 text-xs hidden sm:inline shrink-0">Música de espera</span>
          <button
            onClick={() => {
              if (musicBlocked) {
                jingleRef.current?.play().then(() => setMusicBlocked(false)).catch(() => {});
              } else {
                setMusicMutedLocal((m) => !m);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium shrink-0"
          >
            {musicMutedLocal || musicBlocked ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {musicBlocked ? 'Ativar som' : musicMutedLocal ? 'Ativar música' : 'Silenciar música'}
          </button>
          {role === 'host' && (
            <button
              onClick={startSessionNow}
              title="Para a música e começa a gravar"
              className="px-3.5 py-1.5 rounded-full bg-[#3B82F6] text-black font-bold text-xs hover:bg-[#FFE066] transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              Iniciar reunião
            </button>
          )}
        </div>
      )}

      {/* Áudio bloqueado pelo navegador (autoplay): sem isso o participante NÃO
          ouve os outros. Mostra um botão grande pra desbloquear no primeiro toque. */}
      {audioBlocked && (
        <button
          onClick={() => { try { room?.startAudio(); } catch {} }}
          className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-[#3B82F6] text-black font-bold text-sm shadow-2xl animate-pulse"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
        >
          <Volume2 className="w-5 h-5" />
          Toque para ativar o áudio da sala
        </button>
      )}

      {/* Guest aprovado pra compartilhar: botao proeminente. O clique AQUI e' o
          gesto valido que o browser exige pra abrir o seletor de tela (a Promise
          de aprovacao ja resolveu, entao nao da pra abrir o picker sozinho). */}
      {screenShareApproved && !isScreenSharing && (
        <button
          onClick={startScreenShareNow}
          className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-black font-bold text-sm shadow-2xl animate-pulse"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
        >
          <Monitor className="w-5 h-5" />
          Compartilhar agora
        </button>
      )}

      {/* Pedidos de compartilhamento de tela — so host ve. Aparece como cards
          empilhados no topo direito (ao lado do contador de participantes).
          Aprovar/Recusar dispara screen_share_response pro guest. */}
      {role === 'host' && pendingScreenRequests.length > 0 && (
        <div className="absolute top-20 right-4 z-30 flex flex-col gap-2 max-w-[320px]">
          {pendingScreenRequests.map((req) => (
            <div key={req.requestId} className="bg-black/90 backdrop-blur-md border border-primary/40 rounded-2xl shadow-2xl px-3 py-2.5">
              <div className="flex items-center gap-2 mb-2 text-primary text-[11px] font-bold uppercase tracking-wider">
                <Monitor className="w-3.5 h-3.5" />
                Pedido de tela
              </div>
              <p className="text-white text-sm mb-2">
                <span className="font-semibold">{req.name}</span> quer compartilhar a tela
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => respondScreenShare(req.requestId, true)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  Permitir
                </button>
                <button
                  onClick={() => respondScreenShare(req.requestId, false)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors"
                >
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fila de maos levantadas — visivel pro host quando ha alguem esperando.
          Auto-some quando a fila zera. Cada item mostra posicao + nome. */}
      {role === 'host' && raisedHandsQueue.length > 0 && (
        <div className="absolute top-20 left-4 z-30 bg-black/85 backdrop-blur-md border border-yellow-500/40 rounded-2xl shadow-2xl px-3 py-2.5 min-w-[200px] max-w-[280px]">
          <div className="flex items-center gap-1.5 mb-2 text-yellow-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="text-base leading-none">✋</span>
            Fila ({raisedHandsQueue.length})
          </div>
          <ol className="space-y-1">
            {raisedHandsQueue.map((h, i) => (
              <li key={h.identity} className="flex items-center gap-2 text-xs text-white">
                <span className="w-5 h-5 rounded-full bg-yellow-400 text-black font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="truncate flex-1">{h.name}</span>
                <span className="text-[10px] text-white/40 tabular-nums flex-shrink-0">
                  {Math.max(0, Math.floor((Date.now() - h.ts) / 1000))}s
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Drawer de perguntas (host) */}
      {role === 'host' && (
        <HostQuestionsDrawer
          isOpen={isQuestionsDrawerOpen}
          onClose={() => setIsQuestionsDrawerOpen(false)}
          meetingId={meetingInfo.id}
          roomName={roomName}
          onUnreadChange={setUnansweredQuestions}
        />
      )}

      {/* Modal de pergunta (participantes) */}
      {role !== 'host' && (
        <AskQuestionModal
          open={isAskQuestionOpen}
          onClose={() => setIsAskQuestionOpen(false)}
          meetingId={meetingInfo.id}
          roomName={roomName}
          askerName={localParticipant.name || localParticipant.identity || 'Participante'}
          askerIdentity={localParticipant.identity}
        />
      )}

      {/* Custom Control Bar */}
      <div className="relative">
        <CustomControlBar
          isMicOn={isMicOn}
          isCamOn={isCamOn}
          isScreenSharing={isScreenSharing}
          isRecording={isRecording}
          isPaused={isPaused}
          isChatOpen={isChatOpen}
          isTranscribing={isTranscribing}
          isDevicePickerOpen={isDevicePickerOpen}
          isQuestionPanelOpen={role === 'host' ? isQuestionsDrawerOpen : isAskQuestionOpen}
          isHandRaised={myHandRaised}
          unansweredQuestions={unansweredQuestions}
          unreadChat={unreadChat}
          role={role}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleScreen={toggleScreen}
          onToggleRecord={toggleRecording}
          onTogglePause={togglePause}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onToggleTranscription={toggleTranscription}
          onToggleDevicePicker={() => setIsDevicePickerOpen((v) => !v)}
          onToggleQuestionPanel={() => {
            if (role === 'host') setIsQuestionsDrawerOpen((v) => !v);
            else setIsAskQuestionOpen((v) => !v);
          }}
          onToggleHand={toggleHand}
          onSendReaction={sendReaction}
          onMuteAll={role === 'host' ? muteAll : undefined}
          onUnmuteAll={role === 'host' ? unmuteAll : undefined}
          onTogglePeople={() => setIsParticipantsOpen((v) => !v)}
          isPeopleOpen={isParticipantsOpen}
          peopleCount={participantCount}
          isCsAgentOn={csAgentOn}
          onToggleCsAgent={role === 'host' ? () => setCsAgentOn((v) => !v) : undefined}
          onLeave={handleLeave}
        />
        {isDevicePickerOpen && (
          <DeviceSelectorPopover
            open={isDevicePickerOpen}
            onClose={() => setIsDevicePickerOpen(false)}
            anchorClassName="left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)]"
          />
        )}
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

// ======================== Lesson Post-Call Screen ========================
// Polls the lesson processing pipeline and shows progress to the host
function LessonPostCallScreen({ meetingId }: { meetingId: string | null }) {
  const [job, setJob] = useState<any>(null);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sendingPdf, setSendingPdf] = useState(false);
  const [pdfSent, setPdfSent] = useState(false);

  useEffect(() => {
    if (!meetingId) return;
    let mounted = true;
    const start = Date.now();
    let lastRetryAt = 0; // debounce retrigger
    const RETRY_COOLDOWN_MS = 60_000;

    const poll = async () => {
      try {
        const { data: m } = await (supabase as any)
          .from('meetings').select('recording_url, recording_status, processing_step, processing_error, target_lesson_id, target_module_id')
          .eq('id', meetingId).maybeSingle();
        if (!mounted) return;
        setMeetingData(m);

        const { data: j } = await (supabase as any)
          .from('lesson_recording_jobs').select('*')
          .eq('meeting_id', meetingId).maybeSingle();
        if (!mounted) return;
        setJob(j);

        // Retry the pipeline if waiting for artifacts and we have them now.
        // Cooldown evita disparar 15x/min e gerar lessons duplicadas em race.
        const now = Date.now();
        if (j?.status === 'waiting' && m?.recording_url && (now - lastRetryAt) > RETRY_COOLDOWN_MS) {
          lastRetryAt = now;
          supabase.functions.invoke('process-lesson-recording', {
            body: { meeting_id: meetingId },
          }).catch(() => {});
        }
      } catch {/* ignore */}
    };

    poll();
    const interval = setInterval(poll, 4000);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

    return () => { mounted = false; clearInterval(interval); clearInterval(timer); };
  }, [meetingId]);

  const status = job?.status || 'processing';
  const step = job?.step || meetingData?.processing_step || 'starting';
  // Aula de acelerador finaliza SEM criar lesson_recording_jobs, entao o `status`
  // do job fica 'processing' pra sempre. Reconhece a conclusao tambem pelo estado
  // da reuniao (processing_step='ready' ou recording_status='completed') pra nao
  // ficar em loop eterno no "Processando aula...".
  const ready = status === 'ready'
    || meetingData?.processing_step === 'ready'
    || (meetingData?.recording_status === 'completed' && meetingData?.processing_step !== 'publishing');
  const failed = status === 'failed';

  const stepLabels: Record<string, string> = {
    'starting': 'Iniciando...',
    'waiting_for_recording_url': 'Aguardando upload do video para o B2...',
    'waiting_for_transcription': 'Aguardando transcricao final...',
    'waiting_for_recording_url_transcription': 'Aguardando video e transcricao...',
    'analyzing': 'Analisando conteudo com IA...',
    'generating_pdf': 'Gerando PDF premium da aula...',
    'publishing': 'Publicando aula no modulo...',
    'ready': 'Aula publicada!',
    'failed': 'Erro no processamento',
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <img src={logo} alt="+ que Vencedores" className="w-64 mx-auto" />
        <div className={`${ready ? 'bg-green-500/10 border-green-500/20' : failed ? 'bg-red-500/10 border-red-500/20' : 'bg-primary/10 border-primary/20'} border rounded-2xl p-6`}>
          <div className={`w-16 h-16 ${ready ? 'bg-green-500/20' : failed ? 'bg-red-500/20' : 'bg-primary/20'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {ready ? <Check className="w-8 h-8 text-green-400" /> : failed ? <PhoneOff className="w-8 h-8 text-red-400" /> : <Loader2 className="w-8 h-8 text-primary animate-spin" />}
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {ready ? 'Aula publicada com sucesso!' : failed ? 'Falha no processamento' : 'Processando aula...'}
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            {stepLabels[step] || step}
          </p>
          {!ready && !failed && (
            <p className="text-gray-600 text-xs mb-4">
              Isso pode levar alguns minutos. Voce pode fechar esta aba - a aula sera publicada automaticamente.
              <br/><span className="text-gray-500">Tempo decorrido: {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>
            </p>
          )}
          {failed && job?.error && (
            <p className="text-red-400 text-xs mb-4 font-mono bg-red-500/5 p-2 rounded">{job.error}</p>
          )}
          {ready && job?.lesson_id && (
            <div className="space-y-2">
              <Button
                onClick={() => window.open(`/membros/aula/${job.lesson_id}`, '_blank')}
                className="w-full py-5 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl"
              >
                Ver Aula na Area de Membros
              </Button>
              {job.pdf_url && (
                <>
                  <Button
                    onClick={() => window.open(job.pdf_url, '_blank')}
                    variant="outline"
                    className="w-full py-5 border-primary/30 text-primary hover:bg-primary/10 font-medium rounded-xl"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Baixar PDF Resumo
                  </Button>
                  <Button
                    onClick={async () => {
                      setSendingPdf(true);
                      try {
                        // 1) grupos vinculados ao modulo desta aula
                        let groups: any[] = [];
                        if (meetingData?.target_module_id) {
                          const { data } = await (supabase as any)
                            .from('whatsapp_groups')
                            .select('id, name')
                            .eq('linked_module_id', meetingData.target_module_id)
                            .eq('is_broadcast_enabled', true);
                          groups = data || [];
                        }
                        // 2) fallback: se nenhum grupo vinculado, manda pros grupos com broadcast ativo
                        if (groups.length === 0) {
                          const { data } = await (supabase as any)
                            .from('whatsapp_groups')
                            .select('id, name')
                            .eq('is_broadcast_enabled', true);
                          groups = data || [];
                        }
                        if (groups.length === 0) {
                          toast.error('Nenhum grupo com envio (broadcast) ativo');
                          return;
                        }
                        const title = job?.title || meetingData?.target_lesson_title || 'Aula + que Vencedores';
                        const message =
                          `📚 *PDF da aula:* ${title}\n\nResumo, pontos-chave e exercicios gerados pela IA + que Vencedores a partir da gravacao da aula ao vivo.`;
                        let okCount = 0;
                        for (const g of groups) {
                          const { data: r } = await supabase.functions.invoke('send-group-message', {
                            body: {
                              group_id: g.id,
                              message,
                              media_url: job.pdf_url,
                              media_type: 'document',
                            },
                          });
                          if ((r as any)?.ok !== false) okCount++;
                        }
                        if (okCount > 0) {
                          toast.success(`PDF enviado para ${okCount} grupo(s)`);
                          setPdfSent(true);
                        } else {
                          toast.error('Falhou ao enviar pra todos os grupos');
                        }
                      } catch (e: any) {
                        toast.error('Erro: ' + (e.message || 'desconhecido'));
                      } finally {
                        setSendingPdf(false);
                      }
                    }}
                    disabled={sendingPdf || pdfSent}
                    className={`w-full py-5 font-medium rounded-xl ${
                      pdfSent
                        ? 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {sendingPdf ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : pdfSent ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {pdfSent ? 'PDF enviado pro grupo' : sendingPdf ? 'Enviando...' : 'Enviar PDF pro grupo WhatsApp'}
                  </Button>
                </>
              )}
            </div>
          )}
          <Button
            onClick={() => window.location.href = '/admin/membros'}
            variant="ghost"
            className="w-full mt-3 text-gray-400 hover:text-white"
          >
            Voltar para Admin
          </Button>
        </div>
      </div>
    </div>
  );
}

// Meeting room page
export default function MeetRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();

  const role = searchParams.get('role') || 'guest';
  const leadId = searchParams.get('leadId');
  const paramName = searchParams.get('name') || '';
  const mode = searchParams.get('mode') || 'sales'; // 'sales' | 'lesson' | 'live-session'

  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [name, setName] = useState(paramName);
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [postCallDone, setPostCallDone] = useState(false);
  const [postCallLeadId, setPostCallLeadId] = useState<string | null>(null);
  const [postCallMeetingId, setPostCallMeetingId] = useState<string | null>(null);
  const [ratingDone, setRatingDone] = useState(false);

  // Generate helper functions
  const connectToRoom = useCallback(async () => {
    if (!name.trim() || !roomId) {
      toast.error('Nome e obrigatorio');
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: roomId,
          participantName: name.trim(),
          role,
          leadId,
        },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || 'Erro ao gerar token');
      }

      setToken(data.token);
      setWsUrl(data.url);
      setJoined(true);
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro ao conectar: ' + err.message);
    } finally {
      setConnecting(false);
    }
  }, [name, roomId, role, leadId]);

  const handleDisconnect = useCallback(async () => {
    // Stop recording if active
    try {
      await supabase.functions.invoke('livekit-start-recording', {
        body: { roomName: roomId, action: 'stop' },
      });
    } catch (e) {
      console.log('No active recording to stop');
    }

    // If host, end room for everyone
    if (role === 'host' && roomId) {
      try {
        await supabase.functions.invoke('livekit-end-room', {
          body: { roomName: roomId },
        });
      } catch (e) {
        console.error('Failed to end room:', e);
      }
    }

    // Get meeting ID for saving data
    const { data: meeting } = await (supabase as any)
      .from('meetings')
      .select('id, lead_id')
      .eq('livekit_room_name', roomId)
      .maybeSingle();

    // Update meeting status - only the host ends the meeting in multi-participant modes
    const hostEndsMeeting = role === 'host' || (mode !== 'live-session' && mode !== 'lesson');
    if (roomId && hostEndsMeeting) {
      await (supabase as any)
        .from('meetings')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('livekit_room_name', roomId);
    }

    // Lesson mode: trigger processing pipeline (PDF + publish lesson) — only when host ends
    // Sales mode: run analyze-sales-call on the transcription
    if (meeting?.id) {
      if ((mode === 'lesson' || mode === 'live-session') && role === 'host') {
        try {
          console.log('[MEET] Triggering lesson processing pipeline');
          supabase.functions.invoke('process-lesson-recording', {
            body: { meeting_id: meeting.id },
          }).catch(() => {});
        } catch (e: any) {
          console.error('[MEET] Lesson pipeline trigger error:', e.message || e);
        }
      } else if (mode !== 'lesson' && mode !== 'live-session') {
        try {
          const { data: meetingData } = await (supabase as any)
            .from('meetings').select('transcription').eq('id', meeting.id).single();

          const transcriptText = meetingData?.transcription || '';
          console.log(`[MEET] Transcription from DB: ${transcriptText.length} chars`);

          if (transcriptText.length > 30) {
            const { data: aiResult } = await supabase.functions.invoke('analyze-sales-call', {
              body: {
                callId: meeting.id,
                transcription: transcriptText,
                leadContext: leadId ? `Lead ID: ${leadId}` : undefined,
              },
            });

            if (aiResult?.analysis || aiResult?.success) {
              const analysis = aiResult.analysis || aiResult;
              await (supabase as any).from('meetings').update({
                ai_summary: analysis.diagnostico || analysis.summary || analysis.resumo || JSON.stringify(analysis).substring(0, 2000),
                ai_key_points: analysis.pontos_chave || analysis.key_points || null,
                ai_sentiment: analysis.sentimento || analysis.sentiment || null,
                ai_suggested_tasks: analysis.proximos_passos || analysis.next_steps || analysis.suggested_tasks || null,
                ai_processed_at: new Date().toISOString(),
              }).eq('id', meeting.id);
              console.log('[MEET] AI analysis saved to meeting');

              // Fire-and-forget: gera plano pos-call (email, tarefas, stage sugerido)
              supabase.functions.invoke('generate-post-call-actions', {
                body: { meeting_id: meeting.id, auto_execute: false },
              }).catch(() => {});
            }
          } else {
            console.log('[MEET] Transcription too short for AI analysis');
          }
        } catch (e: any) {
          console.error('[MEET] AI analysis error:', e.message || e);
        }
      }
    }

    setJoined(false);
    setToken('');
    setPostCallMeetingId(meeting?.id || null);
    setPostCallLeadId(leadId || meeting?.lead_id || null);
    setPostCallDone(true);
  }, [role, roomId, leadId, mode]);

  // Observer auto-joins (no PreJoin needed)
  useEffect(() => {
    if (role === 'observer' && name && roomId) {
      connectToRoom();
    }
  }, [role, name, roomId]);

  // Error state
  if (error && !joined) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <PhoneOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Erro na Reuniao</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button onClick={() => { setError(null); setJoined(false); }} variant="outline">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Post-call screen - different for host vs guest/lead
  if (postCallDone) {
    // GUEST/LEAD: Thank you page (with rating modal in lesson/live-session)
    if (role !== 'host') {
      const isLessonMode = mode === 'lesson' || mode === 'live-session';
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          {isLessonMode && !ratingDone && (
            <MeetingRatingModal
              meetingId={postCallMeetingId}
              roomName={roomId || null}
              participantName={name}
              participantIdentity={leadId || undefined}
              onSubmitted={() => setRatingDone(true)}
              onSkip={() => setRatingDone(true)}
            />
          )}
          <div className="max-w-md w-full text-center space-y-6">
            <img src={logo} alt="+ que Vencedores" className="w-64 mx-auto" />
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Obrigado pela sua presenca!</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Foi um prazer conversar com voce. Em breve entraremos em contato com os proximos passos.
              </p>
              <p className="text-gray-500 text-xs mt-4">+ que Vencedores Business Solutions</p>
            </div>
          </div>
        </div>
      );
    }

    // HOST: Lesson mode processing screen
    if (mode === 'lesson' || mode === 'live-session') {
      return (
        <LessonPostCallScreen meetingId={postCallMeetingId} />
      );
    }

    // HOST: Sales call - analysis redirect page
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <img src={logo} alt="+ que Vencedores" className="w-64 mx-auto" />
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Reuniao Encerrada</h2>
            <p className="text-gray-400 text-sm mb-4">
              Transcricao e analise de IA estao sendo processadas.
            </p>
            {postCallLeadId ? (
              <Button
                onClick={() => window.location.href = `/admin/crm?openLead=${postCallLeadId}&tab=reunioes`}
                className="w-full py-5 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl"
              >
                Ver Reunioes do Lead
              </Button>
            ) : (
              <Button
                onClick={() => window.location.href = '/admin/crm'}
                className="w-full py-5 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl"
              >
                Voltar ao CRM
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PreJoin screen - Premium + que Vencedores branding
  if (!joined) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(250,200,0,0.05)_0%,_transparent_70%)]" />

        <div className="max-w-lg w-full space-y-8 relative z-10">
          {/* Logo */}
          <div className="flex justify-center">
            <img src={logo} alt="+ que Vencedores Business Solutions" className="w-72 md:w-96 object-contain" />
          </div>

          {/* Role badge */}
          <div className="text-center">
            {role === 'host' && (
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-4 py-1.5">
                <Crown className="w-4 h-4 text-primary" />
                <span className="text-primary text-sm font-medium">Apresentador</span>
              </div>
            )}
            {role === 'observer' && (
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-4 py-1.5">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">Observador</span>
              </div>
            )}
            {role === 'guest' && (
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
                <Video className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm font-medium">Participante</span>
              </div>
            )}
          </div>

          {/* Form card */}
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 space-y-5 shadow-2xl">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Seu nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como deseja ser identificado"
                className="bg-white/5 border-white/[0.08] text-white h-12 rounded-xl text-base placeholder:text-gray-600"
                onKeyDown={(e) => e.key === 'Enter' && connectToRoom()}
              />
            </div>

            {/* Camera/Mic toggles */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCameraEnabled(!cameraEnabled)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border transition-all ${
                  cameraEnabled
                    ? 'bg-white/5 border-white/[0.08] text-white hover:bg-white/10'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                <span className="text-sm font-medium">Camera</span>
              </button>
              <button
                onClick={() => setMicEnabled(!micEnabled)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border transition-all ${
                  micEnabled
                    ? 'bg-white/5 border-white/[0.08] text-white hover:bg-white/10'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                <span className="text-sm font-medium">Microfone</span>
              </button>
            </div>

            {/* Join button */}
            <Button
              onClick={connectToRoom}
              disabled={connecting || !name.trim()}
              className="w-full py-6 text-base bg-primary hover:bg-primary/90 text-black font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30"
            >
              {connecting ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Video className="w-5 h-5 mr-2" />
              )}
              {connecting ? 'Conectando...' : 'Entrar na Reuniao'}
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-600 text-xs">Reuniao segura e criptografada</p>
        </div>
      </div>
    );
  }

  // Video Conference
  return (
    <div className="bg-[#0a0a0a]" data-lk-theme="default" style={{ height: '100dvh' }}>
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect={true}
        video={cameraEnabled}
        audio={micEnabled}
        onDisconnected={handleDisconnect}
        style={{ height: '100dvh' }}
        options={{
          // Camera 1080p30 para o bubble da gravacao ficar nitido
          videoCaptureDefaults: { resolution: { width: 1920, height: 1080, frameRate: 30 } },
          // Audio limpo: cancela eco + ruido + ganho automatico. Sem isso a fala
          // do remoto volta pelo mic e gera ECO na transmissao.
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          publishDefaults: {
            videoSimulcastLayers: [], // Sem simulcast — egress sempre pega o layer mais alto
            // Screen share em alta qualidade. Resolucao inferida do display, mas
            // encoding garante bitrate suficiente para texto/codigo legivel.
            screenShareEncoding: { maxBitrate: 5_000_000, maxFramerate: 30 },
            videoCodec: 'h264' as any, // h264 = compatibilidade total com egress mp4
          },
        }}
      >
        <MeetingContent roomName={roomId || ''} role={role} mode={mode} onLeave={handleDisconnect} />
      </LiveKitRoom>
    </div>
  );
}
