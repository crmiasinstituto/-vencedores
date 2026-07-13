import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Plus, Edit, Phone, PhoneIncoming, PhoneOutgoing,
  Clock, MessageSquare, Calendar, User, ChevronDown, ChevronUp,
  Brain, Target, AlertCircle, CheckCircle2, XCircle, Video, Send,
  Sparkles, Instagram, Zap,
  Mail, Eye, MousePointerClick, AlertTriangle,
} from 'lucide-react';
import EmailTimelineModal from '@/components/client360/EmailTimelineModal';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface TimelineEvent {
  id: string;
  type:
    | 'creation' | 'column_change' | 'lead_edited' | 'call' | 'note_added'
    | 'call_scheduled' | 'meeting' | 'onboarding_sent' | 'instagram_analyzed' | 'sale'
    | 'email_sent' | 'email_opened' | 'email_clicked' | 'email_bounced'
    | 'payment_paid' | 'payment_overdue' | 'payment_due'
    | 'social_selling' | 'social_selling_qualification'
    | 'collective_invited' | 'collective_d3_sent' | 'collective_d1_sent' | 'collective_h1_sent'
    | 'collective_landing_opened' | 'collective_joined' | 'collective_checked_in';
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
  callData?: {
    direction: string;
    duration_seconds: number | null;
    status: string | null;
    ai_summary: string | null;
    ai_key_points: any[];
    ai_suggested_tasks: any[];
    ai_sentiment: string | null;
    transcription: string | null;
    peer_phone: string;
  };
  fromColumn?: string;
  toColumn?: string;
  boardName?: string;
  emailSend?: {
    send_id: string;
    campaign_id: string | null;
    campaign_name: string | null;
    subject: string | null;
    from_name: string | null;
    from_email: string | null;
    to_email: string;
    status: string;
    html: string | null;
    sent_at: string | null;
    delivered_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounced_at: string | null;
    bounce_reason: string | null;
    open_count: number;
    click_count: number;
    clicked_url: string | null;
    error_message: string | null;
  };
}

interface LeadTimelineProps {
  leadId: string;
  leadCreatedAt?: string;
  leadSource?: string;
  leadName?: string;
}

// Categorias pra filtro Todos/Comercial
const COMERCIAL_TYPES: TimelineEvent['type'][] = [
  'call', 'call_scheduled', 'meeting', 'sale',
  'payment_paid', 'payment_overdue', 'payment_due',
  'column_change',
];
const isComercial = (e: TimelineEvent) => COMERCIAL_TYPES.includes(e.type);

export const LeadTimeline: React.FC<LeadTimelineProps> = ({ leadId, leadCreatedAt, leadSource, leadName }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [emailModalEvent, setEmailModalEvent] = useState<TimelineEvent | null>(null);
  const [filter, setFilter] = useState<'all' | 'comercial'>('all');

  useEffect(() => {
    if (leadId) loadTimeline();
  }, [leadId]);

  const loadTimeline = async () => {
    setIsLoading(true);
    try {
      const [activitiesRes, callsRes, meetingsRes, emailSendsRes, salesRes, collectiveRes] = await Promise.all([
        supabase
          .from('crm_activities')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('call_history')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('meetings' as any)
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('email_sends' as any)
          .select('id, campaign_id, email, status, html, sent_at, delivered_at, opened_at, clicked_at, bounced_at, bounce_reason, open_count, click_count, clicked_url, error_message, campaign:email_campaigns(id, name, subject, from_name, from_email)')
          .eq('lead_id', leadId)
          .order('sent_at', { ascending: false, nullsFirst: false })
          .limit(50),
        supabase
          .from('sales_events')
          .select('id, product_name, amount, payment_method, source, transaction_id, created_at')
          .eq('crm_lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('collective_event_invites' as any)
          .select(
            'id, event_id, attendance_mode, ' +
              'invite_email_sent_at, invite_wa_sent_at, ' +
              'd3_email_sent_at, d3_wa_sent_at, d1_email_sent_at, d1_wa_sent_at, ' +
              'h1_email_sent_at, h1_wa_sent_at, ' +
              'opened_landing_at, joined_at, checked_in_at, ' +
              'event:collective_events(id, title, scheduled_at, event_format)',
          )
          .eq('lead_id', leadId)
          .limit(20),
      ]);

      const timelineEvents: TimelineEvent[] = [];

      if (activitiesRes.data) {
        for (const act of activitiesRes.data) {
          let type: TimelineEvent['type'] = 'note_added';
          if (act.activity_type === 'column_change') type = 'column_change';
          else if (act.activity_type === 'lead_created') type = 'creation';
          else if (act.activity_type === 'lead_edited') type = 'lead_edited';
          else if (act.activity_type === 'call_scheduled') type = 'call_scheduled';
          else if (act.activity_type === 'onboarding_sent') type = 'onboarding_sent';
          else if (act.activity_type === 'instagram_analyzed') type = 'instagram_analyzed';
          else if (act.activity_type === 'sale') type = 'sale';
          else if (act.activity_type === 'social_selling') type = 'social_selling';
          else if (act.activity_type === 'social_selling_qualification') type = 'social_selling_qualification';

          timelineEvents.push({
            id: act.id,
            type,
            title: getActivityTitle(act.activity_type),
            description: act.description,
            timestamp: act.created_at || '',
            fromColumn: act.from_column_name || undefined,
            toColumn: act.to_column_name || undefined,
            boardName: act.board_name || undefined,
            metadata: act.metadata,
          });
        }
      }

      if (callsRes.data) {
        for (const call of callsRes.data) {
          timelineEvents.push({
            id: call.id,
            type: 'call',
            title: call.direction === 'outgoing' ? 'Ligação Realizada' : 'Ligação Recebida',
            description: `${call.direction === 'outgoing' ? 'Ligação para' : 'Ligação de'} ${call.peer_name || call.peer_phone} — ${formatDuration(call.duration_seconds)}`,
            timestamp: call.created_at || '',
            callData: {
              direction: call.direction,
              duration_seconds: call.duration_seconds,
              status: call.status,
              ai_summary: call.ai_summary,
              ai_key_points: Array.isArray(call.ai_key_points) ? call.ai_key_points : [],
              ai_suggested_tasks: Array.isArray(call.ai_suggested_tasks) ? call.ai_suggested_tasks : [],
              ai_sentiment: call.ai_sentiment,
              transcription: call.transcription,
              peer_phone: call.peer_phone,
            },
          });
        }
      }

      if (meetingsRes.data) {
        for (const m of meetingsRes.data as any[]) {
          if (m.status === 'completed') {
            timelineEvents.push({
              id: `meeting-${m.id}`,
              type: 'meeting',
              title: `Reunião: ${m.title}`,
              description: `${m.title} — ${m.duration_seconds ? formatDuration(m.duration_seconds) : 'Duração não registrada'}`,
              timestamp: m.ended_at || m.started_at || m.created_at,
              callData: {
                direction: 'meeting',
                duration_seconds: m.duration_seconds,
                status: m.status,
                ai_summary: m.ai_summary,
                ai_key_points: Array.isArray(m.ai_key_points) ? m.ai_key_points : [],
                ai_suggested_tasks: Array.isArray(m.ai_suggested_tasks) ? m.ai_suggested_tasks : [],
                ai_sentiment: m.ai_sentiment,
                transcription: m.transcription,
                peer_phone: '',
              },
            });
          }
        }
      }

      if (collectiveRes.data) {
        for (const inv of collectiveRes.data as any[]) {
          const evt = inv.event;
          if (!evt) continue;
          const evtLabel = `${evt.title} (${new Date(evt.scheduled_at).toLocaleDateString('pt-BR')})`;
          const pushIf = (ts: string | null | undefined, kind: TimelineEvent['type'], title: string, descSuffix = '') => {
            if (!ts) return;
            timelineEvents.push({
              id: `${kind}-${inv.id}`,
              type: kind,
              title,
              description: `${evtLabel}${descSuffix}`,
              timestamp: ts,
              metadata: { event_id: evt.id, invite_id: inv.id, attendance_mode: inv.attendance_mode },
            });
          };
          // 1 evento por marco/canal (email e WA contam separado)
          pushIf(inv.invite_email_sent_at, 'collective_invited', 'Convite enviado (email)', ' · email');
          pushIf(inv.invite_wa_sent_at, 'collective_invited', 'Convite enviado (WA)', ' · whatsapp');
          pushIf(inv.d3_email_sent_at, 'collective_d3_sent', 'Lembrete D-3 (email)', ' · 3 dias antes');
          pushIf(inv.d3_wa_sent_at, 'collective_d3_sent', 'Lembrete D-3 (WA)', ' · 3 dias antes');
          pushIf(inv.d1_email_sent_at, 'collective_d1_sent', 'Lembrete D-1 (email)', ' · 1 dia antes');
          pushIf(inv.d1_wa_sent_at, 'collective_d1_sent', 'Lembrete D-1 (WA)', ' · 1 dia antes');
          pushIf(inv.h1_email_sent_at, 'collective_h1_sent', 'Lembrete H-1 (email)', ' · 1 hora antes');
          pushIf(inv.h1_wa_sent_at, 'collective_h1_sent', 'Lembrete H-1 (WA)', ' · 1 hora antes');
          pushIf(inv.opened_landing_at, 'collective_landing_opened', 'Abriu o convite', '');
          pushIf(inv.joined_at, 'collective_joined', 'Entrou no evento', '');
          pushIf(inv.checked_in_at, 'collective_checked_in', 'Check-in presencial', '');
        }
      }

      if (salesRes.data) {
        for (const sale of salesRes.data as any[]) {
          const amount = Number(sale.amount || 0);
          const valor = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const metodo = sale.payment_method ? ` · ${sale.payment_method}` : '';
          timelineEvents.push({
            id: `sale-${sale.id}`,
            type: 'sale',
            title: 'Venda Aprovada',
            description: `${sale.product_name || 'Produto'} — ${valor}${metodo}${sale.source ? ` (${sale.source})` : ''}`,
            timestamp: sale.created_at || '',
            metadata: { sale_id: sale.id, amount, source: sale.source, transaction_id: sale.transaction_id },
          });
        }
      }

      timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Email sends → 1 evento por marco (sent / opened / clicked / bounced)
      if (emailSendsRes.data) {
        for (const s of emailSendsRes.data as any[]) {
          const base = {
            send_id: s.id,
            campaign_id: s.campaign_id,
            campaign_name: s.campaign?.name || null,
            subject: s.campaign?.subject || null,
            from_name: s.campaign?.from_name || null,
            from_email: s.campaign?.from_email || null,
            to_email: s.email,
            status: s.status,
            html: s.html,
            sent_at: s.sent_at,
            delivered_at: s.delivered_at,
            opened_at: s.opened_at,
            clicked_at: s.clicked_at,
            bounced_at: s.bounced_at,
            bounce_reason: s.bounce_reason,
            open_count: s.open_count || 0,
            click_count: s.click_count || 0,
            clicked_url: s.clicked_url,
            error_message: s.error_message,
          };
          if (s.sent_at) {
            timelineEvents.push({
              id: `email-sent-${s.id}`,
              type: 'email_sent',
              title: 'Email enviado',
              description: s.campaign?.subject || s.email,
              timestamp: s.sent_at,
              emailSend: base,
            });
          }
          if (s.opened_at) {
            timelineEvents.push({
              id: `email-opened-${s.id}`,
              type: 'email_opened',
              title: 'Email aberto',
              description: `${s.campaign?.subject || s.email} · ${s.open_count || 1}x`,
              timestamp: s.opened_at,
              emailSend: base,
            });
          }
          if (s.clicked_at) {
            timelineEvents.push({
              id: `email-clicked-${s.id}`,
              type: 'email_clicked',
              title: 'Link clicado',
              description: s.clicked_url || s.campaign?.subject || '',
              timestamp: s.clicked_at,
              emailSend: base,
            });
          }
          if (s.bounced_at) {
            timelineEvents.push({
              id: `email-bounced-${s.id}`,
              type: 'email_bounced',
              title: 'Email bounced',
              description: s.bounce_reason || 'Sem motivo',
              timestamp: s.bounced_at,
              emailSend: base,
            });
          }
        }
      }
      timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const hasCreationEvent = timelineEvents.some(e => e.type === 'creation');
      if (!hasCreationEvent && leadCreatedAt) {
        const sourceLabel = getSourceLabel(leadSource);
        timelineEvents.push({
          id: 'auto-entry',
          type: 'creation',
          title: 'Lead Capturado',
          description: `${leadName || 'Lead'} entrou via ${sourceLabel}`,
          timestamp: leadCreatedAt,
        });
        timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      setEvents(timelineEvents);
    } catch (err) {
      console.error('[Timeline] Error loading:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'popup_ddd': return 'Popup Landing Page';
      case 'manual': return 'Cadastro Manual';
      case 'webhook': return 'Webhook Externo';
      case 'vhs': case 'vhs_popup': return 'Popup VHS ao Prompt';
      case 'checkout_vhs': return 'Checkout VHS';
      default: return source || 'Origem desconhecida';
    }
  };

  const getActivityTitle = (type: string) => {
    switch (type) {
      case 'column_change': return 'Movimentação no Funil';
      case 'lead_created': return 'Lead Capturado';
      case 'lead_edited': return 'Lead Editado';
      case 'call_scheduled': return 'Call Agendada';
      case 'note_added': return 'Nota Adicionada';
      case 'onboarding_sent': return 'Onboarding Enviado';
      case 'instagram_analyzed': return 'Instagram Analisado';
      case 'sale': return 'Venda Realizada';
      case 'social_selling': return 'Ação Social Selling';
      case 'social_selling_qualification': return 'Qualificação IA — Social Selling';
      default: return 'Atividade';
    }
  };

  // Labels visuais por action_type do social selling (vem em metadata.action_type)
  const SS_ACTION_META: Record<string, { label: string; icon: string; verb: string }> = {
    curtir_posts:       { label: 'Curtiu post',           icon: '❤️', verb: 'curtir' },
    comentar_post:      { label: 'Comentou post',          icon: '💬', verb: 'comentar' },
    reagir_story:       { label: 'Reagiu ao story',        icon: '🔥', verb: 'reagir' },
    responder_story:    { label: 'Respondeu story (DM)',   icon: '📩', verb: 'responder' },
    enviar_dm:          { label: 'Enviou DM',              icon: '📩', verb: 'enviar DM' },
    followup_story:     { label: 'Follow-up via story',    icon: '🔄', verb: 'follow-up' },
    verificar_resposta: { label: 'Verificou inbox',        icon: '👀', verb: 'verificar' },
  };

  // Extrai shortcode de URL /p/<code>/ ou /reel/<code>/
  const getInstagramPostCode = (url?: string): string | null => {
    if (!url) return null;
    const m = url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    return m?.[1] || null;
  };

  // URL pública de thumbnail do post (Instagram aceita ?size=t pra thumb)
  const getInstagramThumbUrl = (code: string) => `https://www.instagram.com/p/${code}/media/?size=t`;

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds === 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getEventIcon = (type: TimelineEvent['type'], callDirection?: string) => {
    switch (type) {
      case 'creation': return <Zap className="w-4 h-4" />;
      case 'column_change': return <ArrowRight className="w-4 h-4" />;
      case 'lead_edited': return <Edit className="w-4 h-4" />;
      case 'meeting': return <Video className="w-4 h-4" />;
      case 'onboarding_sent': return <Send className="w-4 h-4" />;
      case 'instagram_analyzed': return <Instagram className="w-4 h-4" />;
      case 'sale': return <Sparkles className="w-4 h-4" />;
      case 'call':
        return callDirection === 'outgoing' 
          ? <PhoneOutgoing className="w-4 h-4" /> 
          : <PhoneIncoming className="w-4 h-4" />;
      case 'call_scheduled': return <Calendar className="w-4 h-4" />;
      case 'note_added': return <MessageSquare className="w-4 h-4" />;
      case 'email_sent': return <Mail className="w-4 h-4" />;
      case 'email_opened': return <Eye className="w-4 h-4" />;
      case 'email_clicked': return <MousePointerClick className="w-4 h-4" />;
      case 'collective_invited': return <Send className="w-4 h-4" />;
      case 'collective_d3_sent':
      case 'collective_d1_sent':
      case 'collective_h1_sent':
        return <Calendar className="w-4 h-4" />;
      case 'collective_landing_opened': return <Eye className="w-4 h-4" />;
      case 'collective_joined': return <Video className="w-4 h-4" />;
      case 'collective_checked_in': return <Sparkles className="w-4 h-4" />;
      case 'email_bounced': return <AlertTriangle className="w-4 h-4" />;
      case 'social_selling': return <Instagram className="w-4 h-4" />;
      case 'social_selling_qualification': return <Sparkles className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'creation': return 'from-green-500/30 to-emerald-500/20 text-green-400 border-green-500/40';
      case 'column_change': return 'from-blue-500/30 to-cyan-500/20 text-blue-400 border-blue-500/40';
      case 'lead_edited': return 'from-yellow-500/30 to-amber-500/20 text-yellow-400 border-yellow-500/40';
      case 'call': return 'from-purple-500/30 to-violet-500/20 text-purple-400 border-purple-500/40';
      case 'meeting': return 'from-indigo-500/30 to-blue-500/20 text-indigo-400 border-indigo-500/40';
      case 'call_scheduled': return 'from-amber-500/30 to-orange-500/20 text-amber-400 border-amber-500/40';
      case 'note_added': return 'from-pink-500/30 to-rose-500/20 text-pink-400 border-pink-500/40';
      case 'onboarding_sent': return 'from-teal-500/30 to-cyan-500/20 text-teal-400 border-teal-500/40';
      case 'instagram_analyzed': return 'from-pink-500/30 to-fuchsia-500/20 text-pink-400 border-pink-500/40';
      case 'sale': return 'from-primary/30 to-yellow-500/20 text-primary border-primary/40';
      case 'email_sent': return 'from-sky-500/30 to-cyan-500/20 text-sky-400 border-sky-500/40';
      case 'email_opened': return 'from-indigo-500/30 to-violet-500/20 text-indigo-400 border-indigo-500/40';
      case 'email_clicked': return 'from-purple-500/30 to-fuchsia-500/20 text-purple-400 border-purple-500/40';
      case 'email_bounced': return 'from-red-500/30 to-rose-500/20 text-red-400 border-red-500/40';
      case 'social_selling': return 'from-pink-500/30 via-fuchsia-500/20 to-purple-500/20 text-pink-300 border-pink-500/40';
      case 'social_selling_qualification': return 'from-amber-500/30 via-orange-500/20 to-pink-500/20 text-amber-300 border-amber-500/40';
      default: return 'from-muted to-muted text-muted-foreground border-border';
    }
  };

  const getDotColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'creation': return 'bg-green-500 shadow-green-500/50';
      case 'column_change': return 'bg-blue-500 shadow-blue-500/50';
      case 'lead_edited': return 'bg-yellow-500 shadow-yellow-500/50';
      case 'call': return 'bg-purple-500 shadow-purple-500/50';
      case 'meeting': return 'bg-indigo-500 shadow-indigo-500/50';
      case 'onboarding_sent': return 'bg-teal-500 shadow-teal-500/50';
      case 'instagram_analyzed': return 'bg-pink-500 shadow-pink-500/50';
      case 'sale': return 'bg-primary shadow-primary/50';
      case 'email_sent': return 'bg-sky-500 shadow-sky-500/50';
      case 'email_opened': return 'bg-indigo-500 shadow-indigo-500/50';
      case 'email_clicked': return 'bg-purple-500 shadow-purple-500/50';
      case 'email_bounced': return 'bg-red-500 shadow-red-500/50';
      case 'social_selling': return 'bg-pink-500 shadow-pink-500/60';
      case 'social_selling_qualification': return 'bg-amber-500 shadow-amber-500/60';
      default: return 'bg-muted-foreground shadow-muted-foreground/50';
    }
  };

  const getSentimentIcon = (sentiment: string | null) => {
    if (!sentiment) return null;
    const s = sentiment.toLowerCase();
    if (s.includes('positiv')) return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    if (s.includes('negativ')) return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    return <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />;
  };

  const filteredEvents = filter === 'comercial' ? events.filter(isComercial) : events;

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* HEADER: Título + filtro Todos/Comercial + contador */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-base font-bold">Jornada do Lead</h3>
            <p className="text-[11px] text-muted-foreground">
              Histórico completo de interações
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/40 border border-border">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
                filter === 'all'
                  ? 'bg-background text-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('comercial')}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
                filter === 'comercial'
                  ? 'bg-background text-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Comercial
            </button>
          </div>
          <Badge variant="outline" className="text-[10px] h-6">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'evento' : 'eventos'}
          </Badge>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {filter === 'comercial'
              ? 'Nenhum evento comercial registrado'
              : 'Nenhum evento registrado ainda'}
          </p>
        </div>
      ) : (
    <ScrollArea className="flex-1 pr-2">
      <div className="relative pl-8">
        {/* Gradient vertical line */}
        <div className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-primary/50 via-border to-transparent rounded-full" />

        <div className="space-y-3">
          {filteredEvents.map((event, index) => {
            const isCallOrMeeting = event.type === 'call' || event.type === 'meeting';
            const isEmail = event.type === 'email_sent' || event.type === 'email_opened' || event.type === 'email_clicked' || event.type === 'email_bounced';
            const isExpanded = expandedCallId === event.id;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, type: 'spring', stiffness: 200 }}
                className="relative group"
              >
                {/* Glowing dot */}
                <div className={`absolute -left-8 top-3 w-[12px] h-[12px] rounded-full shadow-lg z-10 ${getDotColor(event.type)}`}>
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }} />
                </div>

                {/* Event card */}
                <motion.div
                  className={`ml-2 p-3.5 rounded-xl border bg-gradient-to-r backdrop-blur-sm ${getEventColor(event.type)} transition-all duration-300 group-hover:scale-[1.01] group-hover:shadow-lg ${(isCallOrMeeting || isEmail) ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (isCallOrMeeting) setExpandedCallId(isExpanded ? null : event.id);
                    else if (isEmail && event.emailSend) setEmailModalEvent(event);
                  }}
                  whileHover={{ y: -1 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-background/50 backdrop-blur-sm flex-shrink-0">
                        {getEventIcon(event.type, event.callData?.direction)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{event.title}</p>
                        <p className="text-xs opacity-80 truncate max-w-[260px]">
                          {event.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isCallOrMeeting && event.callData?.ai_summary && (
                        <Brain className="w-3.5 h-3.5 text-primary" />
                      )}
                      {isCallOrMeeting && (
                        isExpanded 
                          ? <ChevronUp className="w-4 h-4 opacity-60" /> 
                          : <ChevronDown className="w-4 h-4 opacity-60" />
                      )}
                    </div>
                  </div>

                  {/* Column change */}
                  {event.type === 'column_change' && event.fromColumn && event.toColumn && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px] bg-background/30">{event.fromColumn}</Badge>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10">{event.toColumn}</Badge>
                    </div>
                  )}

                  {/* Social Selling — card visual com thumbnail */}
                  {event.type === 'social_selling' && event.metadata && (() => {
                    const at = event.metadata.action_type as string | undefined;
                    const meta = at ? SS_ACTION_META[at] : undefined;
                    const target = (event.metadata.instagram_target || event.metadata.target_url) as string | undefined;
                    const postCode = getInstagramPostCode(target);
                    const contentPreview = event.metadata.content_preview as string | undefined;
                    const screenshotUrl = event.metadata.screenshot_url as string | undefined;
                    const dayNumber = event.metadata.day_number as number | undefined;
                    return (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-stretch gap-3">
                          {/* Thumbnail visual */}
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-pink-500/20 via-fuchsia-500/15 to-purple-500/20 border border-pink-400/30 flex-shrink-0">
                            {screenshotUrl ? (
                              <img
                                src={screenshotUrl}
                                alt="Screenshot"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : postCode ? (
                              <img
                                src={getInstagramThumbUrl(postCode)}
                                alt="Post Instagram"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : null}
                            {/* fallback ícone grande sempre presente atrás da imagem */}
                            <div className="absolute inset-0 flex items-center justify-center text-3xl pointer-events-none">
                              {meta?.icon || '📷'}
                            </div>
                            {/* overlay degradê pra dar profundidade */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-pink-200">{meta?.label || at || 'Ação'}</span>
                                {dayNumber && <Badge variant="outline" className="text-[9px] bg-black/30 border-pink-400/40 text-pink-300">Dia {dayNumber}</Badge>}
                              </div>
                              {contentPreview && (
                                <p className="mt-1.5 text-xs text-pink-100/80 italic line-clamp-2 leading-snug">
                                  "{contentPreview}"
                                </p>
                              )}
                            </div>
                            {target && (
                              <a
                                href={target}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-pink-300 hover:text-pink-200 transition-colors truncate"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Instagram className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">{target.replace(/^https?:\/\//, '')}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Qualificação IA Social Selling — card com score gigante */}
                  {event.type === 'social_selling_qualification' && event.metadata && (() => {
                    const score = event.metadata.score as number | undefined;
                    const reason = event.metadata.reason as string | undefined;
                    const snap = event.metadata.profile_snapshot as any;
                    const automation_name = event.metadata.automation_name as string | undefined;
                    return (
                      <div className="mt-3 flex items-stretch gap-3">
                        {/* Score gigante */}
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-amber-400/40 flex-shrink-0 bg-gradient-to-br from-amber-500/25 via-orange-500/15 to-pink-500/20 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-amber-300 leading-none">{score ?? '?'}</span>
                          <span className="text-[9px] uppercase tracking-wider text-amber-200/70 mt-0.5">score</span>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            {snap?.username && (
                              <p className="text-xs font-semibold text-amber-200">
                                @{snap.username}
                                {snap.is_verified && <span className="ml-1 text-blue-400">✓</span>}
                              </p>
                            )}
                            {reason && (
                              <p className="text-[11px] text-amber-100/80 mt-1 line-clamp-3 leading-snug">{reason}</p>
                            )}
                          </div>
                          {snap && (
                            <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[10px] text-amber-200/60">
                              {snap.follower_count != null && <span>{snap.follower_count.toLocaleString('pt-BR')} seg</span>}
                              {snap.media_count != null && <span>· {snap.media_count} posts</span>}
                              {snap.is_business && <span>· business</span>}
                            </div>
                          )}
                          {automation_name && (
                            <Badge variant="outline" className="self-start mt-1.5 text-[9px] bg-black/30 border-amber-400/40 text-amber-300">
                              {automation_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Timestamp */}
                  <p className="text-[10px] opacity-60 mt-2 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {' · '}
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: ptBR })}
                  </p>

                  {/* Expanded call/meeting details */}
                  <AnimatePresence>
                    {isCallOrMeeting && isExpanded && event.callData && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-current/10 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-[10px] bg-background/30">
                              {event.callData.direction === 'outgoing' ? 'Saída' : event.callData.direction === 'meeting' ? 'Reunião' : 'Entrada'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] bg-background/30">
                              {formatDuration(event.callData.duration_seconds)}
                            </Badge>
                            {event.callData.status && (
                              <Badge variant="outline" className="text-[10px] bg-background/30">
                                {event.callData.status === 'ENDED' ? 'Finalizada' : event.callData.status}
                              </Badge>
                            )}
                            {event.callData.ai_sentiment && (
                              <Badge variant="outline" className="text-[10px] bg-background/30 flex items-center gap-1">
                                {getSentimentIcon(event.callData.ai_sentiment)}
                                {event.callData.ai_sentiment}
                              </Badge>
                            )}
                          </div>

                          {event.callData.ai_summary && (
                            <div className="p-2.5 rounded-lg bg-background/40 border border-current/10">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Brain className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-semibold text-primary">Resumo IA</span>
                              </div>
                              <p className="text-xs leading-relaxed opacity-90">
                                {event.callData.ai_summary}
                              </p>
                            </div>
                          )}

                          {event.callData.ai_key_points.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                                <Target className="w-3 h-3" /> Pontos-chave
                              </p>
                              <ul className="space-y-1">
                                {event.callData.ai_key_points.map((point: any, i: number) => (
                                  <li key={i} className="text-xs opacity-80 flex items-start gap-1.5">
                                    <span className="mt-0.5">•</span>
                                    {typeof point === 'string' ? point : JSON.stringify(point)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {event.callData.ai_suggested_tasks.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Próximos Passos
                              </p>
                              <ul className="space-y-1">
                                {event.callData.ai_suggested_tasks.map((task: any, i: number) => (
                                  <li key={i} className="text-xs opacity-80 flex items-start gap-1.5">
                                    <span className="mt-0.5">→</span>
                                    {typeof task === 'string' ? task : JSON.stringify(task)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
      )}
      <EmailTimelineModal
        open={!!emailModalEvent}
        onOpenChange={(open) => { if (!open) setEmailModalEvent(null); }}
        metadata={emailModalEvent?.emailSend ? {
          ...emailModalEvent.emailSend,
          status: emailModalEvent.emailSend.status,
        } : null}
      />
    </div>
  );
};
