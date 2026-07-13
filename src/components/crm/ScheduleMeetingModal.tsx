import React, { useState, useEffect, useCallback } from 'react';
import { Video, ExternalLink, Calendar, Send, ClipboardPaste, CheckCircle2, CalendarClock, Zap, Link2, MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  leadWhatsapp?: string;
  onCreated?: () => void;
  onStartInstant?: (meetingId: string, meetingUrl: string, meetingTitle: string) => void;
}

const DURATION_OPTIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2 horas' },
];

const MEETING_CATEGORIES = [
  { value: 'onboarding', label: '🎯 Onboarding' },
  { value: 'implantacao', label: '⚙️ Implantação' },
  { value: 'cs', label: '💚 CS' },
  { value: 'vendas', label: '💰 Vendas' },
  { value: 'presencial', label: '🏢 Presencial' },
  { value: 'outro', label: '📋 Outro' },
];

const isMeetLink = (url: string) => /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url);

function generateRoomName(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `meet-${ts}-${rand}`;
}

const normalizeBRPhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length >= 10 && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  if (cleaned.startsWith('55') && cleaned.length === 12) {
    cleaned = cleaned.slice(0, 4) + '9' + cleaned.slice(4);
  }
  return cleaned;
};

const formatPhoneMask = (phone: string): string => {
  const n = normalizeBRPhone(phone);
  if (n.length === 13) {
    return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`;
  }
  return phone;
};

type MeetingMode = 'choose' | 'schedule' | 'instant' | 'presencial';
type LinkType = 'squaad' | 'external';

const SQUAAD_DOMAIN = 'https://squaad.com.br';

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  isOpen, onClose, leadId, leadName, leadWhatsapp, onCreated, onStartInstant,
}) => {
  const [mode, setMode] = useState<MeetingMode>('choose');
  const [linkType, setLinkType] = useState<LinkType>('squaad');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState(`Reunião com ${leadName}`);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForLink, setWaitingForLink] = useState(false);
  const [linkCaptured, setLinkCaptured] = useState(false);
  const [meetingAddress, setMeetingAddress] = useState('');

  // Auto-open Meet when entering schedule mode
  const enterScheduleMode = () => {
    setMode('schedule');
  };

  const openMeetForSchedule = () => {
    setWaitingForLink(true);
    setLinkCaptured(false);
    window.open('https://meet.google.com/landing', '_blank');
    toast.info('Crie a reunião no Meet, copie o link e volte aqui. Colaremos automaticamente!', { duration: 8000 });
  };

  const enterInstantMode = async () => {
    setMode('instant');
    // Don't auto-open Meet — user can choose Sala + que Vencedores (default) or external link
  };

  // When user comes back from Meet tab, try to read clipboard
  const tryReadClipboard = useCallback(async () => {
    if (!waitingForLink || meetingUrl) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && isMeetLink(text)) {
        setMeetingUrl(text.trim());
        setLinkCaptured(true);
        setWaitingForLink(false);
        toast.success('✅ Link do Meet capturado automaticamente!');
      }
    } catch {
      // Clipboard permission denied — user will paste manually
    }
  }, [waitingForLink, meetingUrl]);

  useEffect(() => {
    if (!waitingForLink) return;
    const handler = () => { tryReadClipboard(); };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [waitingForLink, tryReadClipboard]);

  useEffect(() => {
    if (meetingUrl && isMeetLink(meetingUrl)) {
      setLinkCaptured(true);
    } else {
      setLinkCaptured(false);
    }
  }, [meetingUrl]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isMeetLink(text)) {
        setMeetingUrl(text.trim());
        setLinkCaptured(true);
        toast.success('✅ Link colado!');
      } else if (text) {
        setMeetingUrl(text.trim());
        toast.info('Link colado (não parece ser Google Meet)');
      } else {
        toast.error('Clipboard vazio');
      }
    } catch {
      toast.error('Sem permissão para ler clipboard. Cole manualmente.');
    }
  };

  const getDurationLabel = (val: string) => DURATION_OPTIONS.find(d => d.value === val)?.label || val;

  const sendWhatsAppNotification = async (scheduledDate: Date, meetUrl: string) => {
    console.log('[Meeting] leadWhatsapp value:', leadWhatsapp);
    if (!leadWhatsapp) {
      toast.warning('WhatsApp do lead não informado — convite não enviado');
      return;
    }

    try {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('status', 'connected')
        .limit(1);

      if (!instances?.[0]?.id) {
        console.warn('[Meeting] Nenhuma instância WhatsApp conectada');
        toast.error('Nenhuma instância WhatsApp conectada para enviar a notificação');
        return;
      }

      const dateStr = scheduledDate.toLocaleDateString('pt-BR');
      const timeStr = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const durationLabel = getDurationLabel(duration);

      let message = `Olá ${leadName}! 👋\n\nSua reunião *"${title}"* foi agendada:\n\n📅 *Data:* ${dateStr}\n⏰ *Horário:* ${timeStr}\n⏱️ *Duração:* ${durationLabel}`;
      if (meetUrl) {
        message += `\n🔗 *Link:* ${meetUrl}`;
      }
      if (meetingAddress) {
        message += `\n📍 *Local:* ${meetingAddress}`;
      }
      if (notes) {
        message += `\n\n📝 *Observações:* ${notes}`;
      }
      message += '\n\nNos vemos lá! 🚀';

      const cleanPhone = normalizeBRPhone(leadWhatsapp);
      console.log('[Meeting] Enviando WhatsApp para:', cleanPhone, 'via instância:', instances[0].id);

      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_text',
          instance_id: instances[0].id,
          number: cleanPhone,
          text: message,
          lead_id: leadId,
        },
      });

      console.log('[Meeting] Resposta uazapi-proxy:', res.data);

      if (res.error) {
        console.error('[Meeting] Edge function error:', res.error);
        toast.error('Falha ao enviar notificação WhatsApp');
        return;
      }

      if (!res.data?.success && res.data?.error) {
        console.error('[Meeting] UAZAPI error:', res.data?.error);
        toast.error(`Falha ao enviar WhatsApp: ${res.data?.error?.substring?.(0, 80) || 'Erro desconhecido'}`);
        return;
      }

      toast.success('📩 Convite enviado no WhatsApp do lead!');
    } catch (e) {
      console.error('[Meeting] Erro ao enviar WhatsApp:', e);
      toast.error('Erro ao enviar notificação WhatsApp');
    }
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Título é obrigatório'); return; }
    if (!date) { toast.error('Data é obrigatória'); return; }
    if (!time) { toast.error('Hora é obrigatória'); return; }
    const finalUrl = meetingUrl.trim();
    const isPresencial = mode === 'presencial';
    const isSquaad = linkType === 'squaad';
    if (!isPresencial && !isSquaad && !finalUrl) { toast.error('Cole o link da reunião antes de agendar'); return; }
    if (isPresencial && !meetingAddress.trim()) { toast.error('Informe o endereço da reunião'); return; }

    setIsLoading(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      const livekitRoom = (!isPresencial) ? generateRoomName() : null;
      const livekitGuestUrl = livekitRoom ? `${SQUAAD_DOMAIN}/meet/${livekitRoom}?role=guest&name=${encodeURIComponent(leadName)}` : null;

      // Determine what URL to save as meeting_url
      let savedMeetingUrl: string | null = null;
      if (isPresencial) {
        savedMeetingUrl = null;
      } else if (isSquaad) {
        savedMeetingUrl = livekitGuestUrl;
      } else {
        savedMeetingUrl = finalUrl || livekitGuestUrl;
      }

      const { error } = await supabase
        .from('meetings' as any)
        .insert({
          lead_id: leadId,
          title: title.trim(),
          meeting_url: savedMeetingUrl,
          livekit_room_name: livekitRoom,
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled',
          metadata: {
            notes: notes || null,
            duration_minutes: parseInt(duration),
            category: category || null,
            meeting_type: isPresencial ? 'presencial' : 'online',
            link_type: isPresencial ? 'presencial' : linkType,
            address: isPresencial ? meetingAddress.trim() : null,
            livekit_meet_url: livekitGuestUrl,
          },
        } as any);
      if (error) throw error;

      await supabase.from('crm_activities').insert({
        lead_id: leadId,
        activity_type: 'meeting_scheduled',
        description: `Reunião "${title}" agendada para ${scheduledAt.toLocaleDateString('pt-BR')} às ${scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${getDurationLabel(duration)})`,
      });

      // Send WhatsApp with guest link
      const whatsappUrl = isPresencial ? '' : (savedMeetingUrl || '');
      await sendWhatsAppNotification(scheduledAt, whatsappUrl);
      toast.success('Reunião agendada!');
      onCreated?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantStart = async () => {
    const finalUrl = meetingUrl.trim();
    const isSquaad = linkType === 'squaad';
    if (!isSquaad && !finalUrl) { toast.error('Cole o link da reunião'); return; }

    setIsLoading(true);
    try {
      const livekitRoom = generateRoomName();
      const livekitGuestUrl = `${SQUAAD_DOMAIN}/meet/${livekitRoom}?role=guest&name=${encodeURIComponent(leadName)}`;
      const livekitHostUrl = `${SQUAAD_DOMAIN}/meet/${livekitRoom}?role=host&name=Host`;

      const savedMeetingUrl = isSquaad ? livekitGuestUrl : (finalUrl || livekitGuestUrl);

      const { data: insertedRows, error } = await supabase
        .from('meetings' as any)
        .insert({
          lead_id: leadId,
          title: title.trim(),
          meeting_url: savedMeetingUrl,
          livekit_room_name: livekitRoom,
          scheduled_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          status: 'in_progress',
          metadata: { notes: notes || null, category: category || null, link_type: linkType, livekit_meet_url: livekitGuestUrl },
        } as any)
        .select('id');
      if (error) throw error;

      const meetingId = (insertedRows as any)?.[0]?.id;

      await supabase.from('crm_activities').insert({
        lead_id: leadId,
        activity_type: 'meeting_started',
        description: `Reunião instantânea "${title}" iniciada`,
      });

      // Send WhatsApp with guest link
      await sendWhatsAppNotification(new Date(), savedMeetingUrl);
      toast.success('Reunião iniciada!');
      onCreated?.();
      onClose();

      // If + que Vencedores room, open host URL in new tab
      if (isSquaad) {
        window.open(livekitHostUrl, '_blank');
      }

      if (onStartInstant && meetingId) {
        onStartInstant(meetingId, isSquaad ? livekitHostUrl : finalUrl, title.trim());
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar reunião');
    } finally {
      setIsLoading(false);
    }
  };

  // Link type selector (Sala + que Vencedores vs Link externo)
  const renderLinkTypeSelector = () => (
    <div className="flex gap-2 mb-3">
      <button
        type="button"
        onClick={() => setLinkType('squaad')}
        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border transition-all text-sm font-medium ${
          linkType === 'squaad'
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-transparent border-border text-muted-foreground hover:bg-accent/50'
        }`}
      >
        <MonitorPlay className="w-4 h-4" />
        Sala + que Vencedores
      </button>
      <button
        type="button"
        onClick={() => setLinkType('external')}
        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border transition-all text-sm font-medium ${
          linkType === 'external'
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-transparent border-border text-muted-foreground hover:bg-accent/50'
        }`}
      >
        <ExternalLink className="w-4 h-4" />
        Link externo
      </button>
    </div>
  );

  // Link input shared between modes
  const renderLinkCapture = () => (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={meetingUrl}
          onChange={e => setMeetingUrl(e.target.value)}
          placeholder="Cole o link do Meet aqui ou clique Colar →"
          className={`flex-1 ${linkCaptured ? 'border-green-500/50 bg-green-500/5' : ''}`}
        />
        <Button type="button" variant="outline" size="sm" onClick={handlePasteFromClipboard} className="flex-shrink-0">
          <ClipboardPaste className="w-4 h-4 mr-1" /> Colar
        </Button>
      </div>
      {linkCaptured && (
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Link do Meet capturado!
        </div>
      )}
      {waitingForLink && !linkCaptured && (
        <p className="text-xs text-amber-400 animate-pulse">
          ⏳ Aguardando você copiar o link do Meet e voltar aqui...
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-400" />
            {mode === 'choose' ? 'Nova Reunião' : mode === 'schedule' ? 'Agendar Online' : mode === 'presencial' ? 'Agendar Presencial' : 'Reunião Instantânea'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'choose'
              ? `Como deseja reunir com ${leadName}?`
              : mode === 'schedule'
                ? `Agende uma reunião online com ${leadName}`
                : mode === 'presencial'
                  ? `Agende uma reunião presencial com ${leadName}`
                  : `Inicie agora uma reunião com ${leadName}`}
          </DialogDescription>
        </DialogHeader>

        {/* === STEP 1: Choose mode === */}
        {mode === 'choose' && (
          <div className="space-y-3 py-2">
            <button
              onClick={enterScheduleMode}
              className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
            >
              <div className="p-2.5 rounded-lg bg-primary/10">
                <CalendarClock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Reunião Online</p>
                <p className="text-xs text-muted-foreground">Sala + que Vencedores ou link externo. O lead recebe o convite por WhatsApp</p>
              </div>
            </button>
            <button
              onClick={() => { setMode('presencial'); setCategory('presencial'); setTitle(`Presencial — ${leadName}`); }}
              className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
            >
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <Calendar className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Reunião Presencial</p>
                <p className="text-xs text-muted-foreground">Agende com endereço, o lead receberá local e horário por WhatsApp</p>
              </div>
            </button>
            <button
              onClick={enterInstantMode}
              className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
            >
              <div className="p-2.5 rounded-lg bg-green-500/10">
                <Zap className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Iniciar reunião instantânea</p>
                <p className="text-xs text-muted-foreground">Comece agora e envie o link ao lead imediatamente</p>
              </div>
            </button>
          </div>
        )}

        {/* === STEP 2A: Schedule for later === */}
        {mode === 'schedule' && (
          <form onSubmit={handleSubmitSchedule} className="space-y-4">
            {/* Link type selector */}
            {renderLinkTypeSelector()}

            {/* Meet link capture (only for external) */}
            {linkType === 'external' && (
              <div>
                <Label className="mb-1.5 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Link externo (Meet/Zoom) *
                </Label>
                {!linkCaptured && !waitingForLink && (
                  <Button type="button" variant="outline" className="w-full mb-2" onClick={openMeetForSchedule}>
                    <ExternalLink className="w-4 h-4 mr-1" /> Abrir Google Meet para copiar link
                  </Button>
                )}
                {renderLinkCapture()}
              </div>
            )}

            {linkType === 'squaad' && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                <MonitorPlay className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary">Link da Sala + que Vencedores sera gerado automaticamente ao agendar</span>
              </div>
            )}

            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(val) => {
                setCategory(val);
                const cat = MEETING_CATEGORIES.find(c => c.value === val);
                if (cat) setTitle(`${cat.label.replace(/^.+\s/, '')} — ${leadName}`);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {MEETING_CATEGORIES.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Reunião de apresentação" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
              <Label>Data *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-foreground [color-scheme:dark]" />
              </div>
              <div>
                <Label>Hora *</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="text-foreground [color-scheme:dark]" />
              </div>
            </div>

            <div>
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notas / Pauta</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Assuntos a discutir..." rows={2} />
            </div>

            {leadWhatsapp && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                <Send className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-400">
                  Convite será enviado para {formatPhoneMask(leadWhatsapp)}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setMode('choose')} className="flex-1">Voltar</Button>
              <Button type="submit" disabled={isLoading || (linkType === 'external' && !linkCaptured)} className="flex-1">
                <Calendar className="w-4 h-4 mr-1" />
                {isLoading ? 'Agendando...' : 'Agendar'}
              </Button>
            </div>
          </form>
        )}

        {/* === STEP 2C: Presencial meeting === */}
        {mode === 'presencial' && (
          <form onSubmit={handleSubmitSchedule} className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Reunião presencial" />
            </div>

            <div>
              <Label>📍 Endereço / Local *</Label>
              <Input value={meetingAddress} onChange={e => setMeetingAddress(e.target.value)} placeholder="Ex: Rua Augusta, 1234 - São Paulo" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-foreground [color-scheme:dark]" />
              </div>
              <div>
                <Label>Hora *</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="text-foreground [color-scheme:dark]" />
              </div>
            </div>

            <div>
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notas / Pauta</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Assuntos a discutir..." rows={2} />
            </div>

            {leadWhatsapp && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                <Send className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-400">
                  Convite com endereço será enviado para {formatPhoneMask(leadWhatsapp)}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setMode('choose')} className="flex-1">Voltar</Button>
              <Button type="submit" disabled={isLoading || !meetingAddress.trim()} className="flex-1">
                <Calendar className="w-4 h-4 mr-1" />
                {isLoading ? 'Agendando...' : 'Agendar Presencial'}
              </Button>
            </div>
          </form>
        )}

        {/* === STEP 2B: Instant meeting === */}
        {mode === 'instant' && (
          <div className="space-y-4">
            {/* Link type selector */}
            {renderLinkTypeSelector()}

            {linkType === 'external' && (
              <div>
                <Label className="mb-1.5 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Link externo (Meet/Zoom) *
                </Label>
                {renderLinkCapture()}
              </div>
            )}

            {linkType === 'squaad' && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                <MonitorPlay className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary">Sala + que Vencedores sera criada automaticamente. Voce entrara como Host.</span>
              </div>
            )}

            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(val) => {
                setCategory(val);
                const cat = MEETING_CATEGORIES.find(c => c.value === val);
                if (cat) setTitle(`${cat.label.replace(/^.+\s/, '')} — ${leadName}`);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {MEETING_CATEGORIES.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Reunião com lead" />
            </div>

            {leadWhatsapp && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                <Send className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-400">
                  Link será enviado para {formatPhoneMask(leadWhatsapp)}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setMode('choose')} className="flex-1">Voltar</Button>
              <Button onClick={handleInstantStart} disabled={isLoading || (linkType === 'external' && !linkCaptured)} className="flex-1 bg-green-600 hover:bg-green-700">
                <Zap className="w-4 h-4 mr-1" />
                {isLoading ? 'Iniciando...' : 'Iniciar Agora'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
