import React, { useState, useEffect } from 'react';
import { Video, Calendar, Play, Clock, Brain, ChevronDown, ChevronUp, Plus, ExternalLink, Timer, CheckCircle, Crown, Eye, Copy, Send, Film } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, formatDistanceToNow, differenceInSeconds, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { StartMeetingModal } from './StartMeetingModal';
import PostCallPlanPanel from './PostCallPlanPanel';
import { SITE_URL } from '@/lib/site';


// ISO -> valor pro <input type="datetime-local"> (horario local, sem timezone).
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface MeetingsTabProps {
  leadId: string;
  leadName: string;
  leadWhatsapp?: string;
}

interface Meeting {
  id: string;
  title: string;
  meeting_url: string | null;
  livekit_room_name: string | null;
  recording_url: string | null;
  recording_status: string | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcription: string | null;
  ai_summary: string | null;
  ai_key_points: any[];
  ai_sentiment: string | null;
  metadata: any;
  created_at: string;
}

const CountdownTimer: React.FC<{ targetDate: string }> = ({ targetDate }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = new Date(targetDate);
  const diffSec = differenceInSeconds(target, now);

  if (diffSec <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 animate-pulse">
        <Timer className="w-3.5 h-3.5" />
        Reunião agora!
      </div>
    );
  }

  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${String(seconds).padStart(2, '0')}s`);

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <Timer className="w-3.5 h-3.5 text-amber-400" />
      <span className="text-amber-400 font-semibold">{parts.join(' ')}</span>
      <span className="text-muted-foreground">restantes</span>
    </div>
  );
};

export const MeetingsTab: React.FC<MeetingsTabProps> = ({ leadId, leadName, leadWhatsapp }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  // Reagendamento inline (data/hora + duracao) por reuniao.
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDur, setEditDur] = useState('30');
  const [savingTime, setSavingTime] = useState(false);

  const saveReschedule = async (meeting: Meeting) => {
    if (!editDate) { toast.error('Escolha data e hora'); return; }
    setSavingTime(true);
    try {
      const iso = new Date(editDate).toISOString();
      const dur = parseInt(editDur, 10) || meeting.metadata?.duration_minutes || 30;
      const newMeta = { ...(meeting.metadata || {}), duration_minutes: dur };
      const upd: any = {
        scheduled_at: iso,
        members_duration_minutes: dur,
        metadata: newMeta,
        // limpa flags de lembrete pra reenviar com o novo horario
        reminder_sent_at: null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase.from('meetings' as any) as any)
        .update(upd)
        .eq('id', meeting.id);
      if (error) { toast.error('Erro ao reagendar: ' + error.message); return; }
      toast.success('Reuniao reagendada');
      setEditingTimeId(null);
      loadMeetings();
    } catch (e: any) {
      toast.error('Erro ao reagendar');
    } finally {
      setSavingTime(false);
    }
  };

  const loadMeetings = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('meetings' as any)
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setMeetings(data.map((m: any) => ({
        ...m,
        ai_key_points: Array.isArray(m.ai_key_points) ? m.ai_key_points : [],
      })));
    }
    setIsLoading(false);
  };

  useEffect(() => { loadMeetings(); }, [leadId]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      scheduled: { label: '📅 Agendada', className: 'border-amber-500/40 text-amber-400' },
      in_progress: { label: '🔴 Em andamento', className: 'border-red-500/40 text-red-400' },
      completed: { label: '✅ Concluída', className: 'border-green-500/40 text-green-400' },
      cancelled: { label: '❌ Cancelada', className: 'border-muted-foreground/40 text-muted-foreground' },
    };
    const s = map[status] || map.scheduled;
    return <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
  };

  const getRecordingBadge = (meeting: Meeting) => {
    if (meeting.recording_status === 'recording') {
      return <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 animate-pulse">Gravando</Badge>;
    }
    if (meeting.recording_url) {
      return <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-400">Gravacao disponivel</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">Sem gravacao</Badge>;
  };

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

  const sendGuestLinkWhatsApp = async (meeting: Meeting) => {
    if (!leadWhatsapp) {
      toast.error('WhatsApp do lead nao informado');
      return;
    }
    const guestUrl = meeting.meeting_url || (meeting.livekit_room_name ? `${SITE_URL}/meet/${meeting.livekit_room_name}?role=guest&name=${encodeURIComponent(leadName)}` : null);
    if (!guestUrl) {
      toast.error('Nenhum link disponivel');
      return;
    }
    try {
      // Envio de reuniao: SO instancia UAZAPI nao-oficial (nao mistura com Cloud API
      // dedicada a campanhas/blast — Carlos quer mensagens 1-to-1 fora do canal de disparo).
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('status', 'connected')
        .eq('provider', 'uazapi')
        .not('is_dedicated_blast', 'is', true)
        .order('created_at')
        .limit(1);
      if (!instances?.[0]?.id) {
        toast.error('Nenhuma instancia WhatsApp UAZAPI conectada');
        return;
      }
      const message = `Ola ${leadName}! 👋\n\nSegue o link da sua reuniao *"${meeting.title}"*:\n\n🔗 ${guestUrl}\n\nClique para entrar! 🚀`;
      const cleanPhone = normalizeBRPhone(leadWhatsapp);
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'send_text',
          instance_id: instances[0].id,
          number: cleanPhone,
          text: message,
          lead_id: leadId,
        },
      });
      if (res.error) { toast.error('Falha ao enviar WhatsApp'); return; }
      toast.success('Link enviado por WhatsApp!');
    } catch {
      toast.error('Erro ao enviar WhatsApp');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{meetings.length} reuniões</p>
        <Button size="sm" variant="outline" onClick={() => setShowSchedule(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova Reunião
        </Button>
      </div>

      <ScrollArea className="h-[420px]">
        {meetings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma reunião registrada</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowSchedule(true)}>
              Agendar Reunião
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pr-2">
            {meetings.map(meeting => {
              const isExpanded = expandedId === meeting.id;
              const isScheduled = meeting.status === 'scheduled';
              const scheduledDate = meeting.scheduled_at ? new Date(meeting.scheduled_at) : null;
              const durationMin = meeting.metadata?.duration_minutes;
              const notes = meeting.metadata?.notes;

              return (
                <div
                  key={meeting.id}
                  className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
                >
                  <div
                    className="flex items-start justify-between gap-2 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-400">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{meeting.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {getStatusBadge(meeting.status)}
                          {scheduledDate && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(scheduledDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                          {meeting.duration_seconds ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {formatDuration(meeting.duration_seconds)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isScheduled && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                            onClick={(e) => { e.stopPropagation(); setActiveMeeting(meeting); }}
                          >
                            <Play className="w-3 h-3 mr-1" /> Iniciar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await supabase
                                .from('meetings' as any)
                                .update({ status: 'completed', ended_at: new Date().toISOString() })
                                .eq('id', meeting.id);
                              loadMeetings();
                              toast.success('Reunião concluída!');
                            }}
                          >
                            ✅ Concluir
                          </Button>
                        </>
                      )}
                      {meeting.ai_summary && <Brain className="w-3.5 h-3.5 text-primary" />}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      {/* Countdown for scheduled meetings */}
                      {isScheduled && scheduledDate && !isPast(scheduledDate) && (
                        <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20">
                          <CountdownTimer targetDate={meeting.scheduled_at!} />
                        </div>
                      )}

                      {isScheduled && scheduledDate && isPast(scheduledDate) && (
                        <div className="p-2.5 rounded-md bg-red-500/5 border border-red-500/20">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 animate-pulse">
                            <Timer className="w-3.5 h-3.5" />
                            Reunião atrasada — {formatDistanceToNow(scheduledDate, { locale: ptBR })} atrás
                          </div>
                        </div>
                      )}

                      {/* Meeting details — com reagendamento inline */}
                      {editingTimeId === meeting.id ? (
                        <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-2" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs font-semibold flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary" /> Reagendar reunião</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Data e hora</label>
                              <input
                                type="datetime-local"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-full h-8 text-xs rounded-md bg-background border border-border px-2 text-foreground"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Duração (min)</label>
                              <input
                                type="number"
                                min={5}
                                step={5}
                                value={editDur}
                                onChange={(e) => setEditDur(e.target.value)}
                                className="w-full h-8 text-xs rounded-md bg-background border border-border px-2 text-foreground"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" disabled={savingTime} onClick={() => saveReschedule(meeting)}>
                              {savingTime ? 'Salvando...' : 'Salvar novo horário'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingTimeId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {scheduledDate && (
                            <div className="p-2 rounded-md bg-muted/50 border border-border">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-muted-foreground mb-0.5">📅 Data e hora</p>
                                {isScheduled && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTimeId(meeting.id);
                                      setEditDate(toLocalInput(meeting.scheduled_at));
                                      setEditDur(String(durationMin || 30));
                                    }}
                                    className="text-[10px] text-primary hover:underline font-medium"
                                  >
                                    Reagendar
                                  </button>
                                )}
                              </div>
                              <p className="font-medium text-foreground">{format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            </div>
                          )}
                          {durationMin && (
                            <div className="p-2 rounded-md bg-muted/50 border border-border">
                              <p className="text-muted-foreground mb-0.5">⏱️ Duração prevista</p>
                              <p className="font-medium text-foreground">{durationMin} min</p>
                            </div>
                          )}
                        </div>
                      )}

                      {meeting.meeting_url && !meeting.livekit_room_name && (
                        <a
                          href={meeting.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-xs text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="truncate">{meeting.meeting_url}</span>
                        </a>
                      )}

                      {/* LiveKit / Sala + que Vencedores actions */}
                      {meeting.livekit_room_name && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`${SITE_URL}/meet/${meeting.livekit_room_name}?role=host&name=Host`, '_blank');
                              }}
                            >
                              <Crown className="w-3 h-3 mr-1" /> Entrar como Host
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`${SITE_URL}/meet/${meeting.livekit_room_name}?role=observer&name=Coach`, '_blank');
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" /> Observar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                const guestUrl = `${SITE_URL}/meet/${meeting.livekit_room_name}?role=guest&name=${encodeURIComponent(leadName)}`;
                                navigator.clipboard.writeText(guestUrl);
                                toast.success('Link do lead copiado!');
                              }}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Copiar Link do Lead
                            </Button>
                            {leadWhatsapp && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendGuestLinkWhatsApp(meeting);
                                }}
                              >
                                <Send className="w-3 h-3 mr-1" /> Enviar Link
                              </Button>
                            )}
                          </div>

                          {/* Recording status */}
                          <div className="flex items-center gap-2">
                            {getRecordingBadge(meeting)}
                            {meeting.recording_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(meeting.recording_url!, '_blank');
                                }}
                              >
                                <Film className="w-3 h-3 mr-1" /> Ver Gravacao
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {notes && (
                        <div className="p-2 rounded-md bg-muted/50 border border-border">
                          <p className="text-xs font-semibold mb-1">📝 Notas</p>
                          <p className="text-xs text-muted-foreground">{notes}</p>
                        </div>
                      )}

                      {meeting.ai_summary && (
                        <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Brain className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">Resumo IA</span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{meeting.ai_summary}</p>
                        </div>
                      )}

                      {meeting.ai_key_points.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Pontos-chave</p>
                          <ul className="space-y-1">
                            {meeting.ai_key_points.map((p: any, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-indigo-400 mt-0.5">•</span>
                                {typeof p === 'string' ? p : JSON.stringify(p)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {meeting.transcription && (
                        <div className="p-2.5 rounded-md bg-muted/50 border border-border">
                          <p className="text-xs font-semibold mb-1">💬 Transcrição</p>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap">
                            {meeting.transcription}
                          </p>
                        </div>
                      )}

                      {/* Plano pos-call IA (1-click actions) */}
                      {((meeting as any).metadata?.post_call_plan || meeting.ai_summary) && (
                        <PostCallPlanPanel
                          meetingId={meeting.id}
                          plan={(meeting as any).metadata?.post_call_plan}
                          leadId={leadId || null}
                          onUpdated={loadMeetings}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {showSchedule && (
        <ScheduleMeetingModal
          isOpen={showSchedule}
          onClose={() => setShowSchedule(false)}
          leadId={leadId}
          leadName={leadName}
          leadWhatsapp={leadWhatsapp}
          onCreated={loadMeetings}
          onStartInstant={(meetingId, meetingUrl, meetingTitle) => {
            setShowSchedule(false);
            setActiveMeeting({ id: meetingId, title: meetingTitle, meeting_url: meetingUrl, livekit_room_name: null, recording_url: null, recording_status: null, status: 'in_progress', scheduled_at: null, started_at: new Date().toISOString(), ended_at: null, duration_seconds: null, transcription: null, ai_summary: null, ai_key_points: [], ai_sentiment: null, metadata: null, created_at: new Date().toISOString() });
          }}
        />
      )}

      {activeMeeting && (
        <StartMeetingModal
          isOpen={!!activeMeeting}
          onClose={() => setActiveMeeting(null)}
          meetingId={activeMeeting.id}
          meetingUrl={activeMeeting.meeting_url || undefined}
          meetingTitle={activeMeeting.title}
          leadId={leadId}
          onCompleted={loadMeetings}
        />
      )}
    </>
  );
};
