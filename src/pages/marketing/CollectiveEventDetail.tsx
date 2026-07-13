/**
 * CollectiveEventDetail
 *
 * /admin/marketing/eventos-coletivos/:id
 *
 * Página única que mostra tudo do evento: link da landing, link da sala LiveKit,
 * preview do email gerado, texto WA, lista de convidados com status, ações rápidas.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, Copy, Video, Mail, MessageSquare, Users, RefreshCw,
  Globe, MapPin, Layers, Calendar, Loader2, ExternalLink, Pencil,
  Trash2, Send, Beaker,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import CollectiveEventModal from '@/components/agenda/CollectiveEventModal';

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_format: 'online' | 'presencial' | 'hybrid';
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  recording_enabled: boolean;
  max_per_room: number;
  room_prefix: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_complement: string | null;
  venue_map_url: string | null;
  public_signup_token: string | null;
  whatsapp_group_url: string | null;
  whatsapp_group_label: string | null;
  template_subject: string | null;
  template_preheader: string | null;
  template_html: string | null;
  template_wa_text: string | null;
  template_brief: string | null;
}

interface Room {
  id: string;
  shard_index: number;
  room_name: string;
  attendance_mode: 'online' | 'presencial';
  capacity: number;
  current_count: number;
  recording_url: string | null;
}

interface InviteRow {
  id: string;
  lead_id: string;
  token: string;
  attendance_mode: string;
  rsvp_at: string | null;
  invite_email_sent_at: string | null;
  invite_wa_sent_at: string | null;
  d3_email_sent_at: string | null;
  d1_email_sent_at: string | null;
  h1_email_sent_at: string | null;
  opened_landing_at: string | null;
  joined_at: string | null;
  checked_in_at: string | null;
  lead: { id: string; name: string | null; whatsapp: string | null; email: string | null } | null;
}

function FormatBadge({ fmt }: { fmt: EventRow['event_format'] }) {
  const props =
    fmt === 'online'
      ? { icon: <Globe className="w-3 h-3" />, label: 'Online', cls: 'bg-blue-500/10 text-blue-300' }
      : fmt === 'presencial'
      ? { icon: <MapPin className="w-3 h-3" />, label: 'Presencial', cls: 'bg-emerald-500/10 text-emerald-300' }
      : { icon: <Layers className="w-3 h-3" />, label: 'Híbrido', cls: 'bg-amber-500/10 text-amber-300' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${props.cls}`}>
      {props.icon} {props.label}
    </span>
  );
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado`),
    () => toast.error('Não consegui copiar, copie manualmente'),
  );
}

export default function CollectiveEventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testSearch, setTestSearch] = useState('');
  const [testResults, setTestResults] = useState<Array<{ id: string; name: string | null; whatsapp: string | null; email: string | null }>>([]);
  const [testLead, setTestLead] = useState<{ id: string; name: string | null; whatsapp: string | null; email: string | null } | null>(null);
  const [testChannels, setTestChannels] = useState({ email: true, wa: false });
  const [testSending, setTestSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const sb = supabase as any;
      const [evRes, roomsRes, invitesRes] = await Promise.all([
        sb.from('collective_events').select('*').eq('id', id).maybeSingle(),
        sb.from('collective_event_rooms').select('*').eq('event_id', id).order('shard_index'),
        sb
          .from('collective_event_invites')
          .select(
            'id, lead_id, token, attendance_mode, rsvp_at, ' +
              'invite_email_sent_at, invite_wa_sent_at, d3_email_sent_at, d1_email_sent_at, h1_email_sent_at, ' +
              'opened_landing_at, joined_at, checked_in_at, ' +
              'lead:crm_leads(id, name, whatsapp, email)',
          )
          .eq('event_id', id),
      ]);
      if (evRes.error || !evRes.data) {
        toast.error('Evento não encontrado');
        navigate('/admin/marketing/eventos-coletivos');
        return;
      }
      setEvent(evRes.data as EventRow);
      setRooms((roomsRes.data as Room[]) ?? []);
      setInvites((invitesRes.data as InviteRow[]) ?? []);
      try {
        const rk = await sb.rpc('event_participation_ranking', { p_event_id: id });
        setRanking(rk.data || []);
      } catch { /* ranking opcional */ }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://squaad.com.br';
  const onlineRooms = useMemo(() => rooms.filter((r) => r.attendance_mode === 'online'), [rooms]);

  const stats = useMemo(() => {
    const total = invites.length;
    const sent = invites.filter((i) => i.invite_email_sent_at || i.invite_wa_sent_at).length;
    const opened = invites.filter((i) => i.opened_landing_at).length;
    const rsvp = invites.filter((i) => i.rsvp_at).length;
    const joined = invites.filter((i) => i.joined_at).length;
    return { total, sent, opened, rsvp, joined };
  }, [invites]);

  async function handleResync() {
    if (!id) return;
    const { data, error } = await (supabase.rpc as any)('populate_collective_invites', { p_event_id: id });
    if (error) {
      toast.error(`Resync falhou: ${error.message}`);
      return;
    }
    toast.success(`${data} novos convites adicionados`);
    load();
  }

  async function handleDelete() {
    if (!id) return;
    setActionLoading(true);
    try {
      const { error } = await (supabase as any).from('collective_events').delete().eq('id', id);
      if (error) throw error;
      toast.success('Evento excluído');
      navigate('/admin/marketing/eventos-coletivos');
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setActionLoading(false);
      setDeleteOpen(false);
    }
  }

  async function handleDispatchNow() {
    if (!id || !event) return;
    setActionLoading(true);
    try {
      // Promove rascunho pra scheduled + popula invites
      const { error: updErr } = await (supabase as any)
        .from('collective_events')
        .update({ status: 'scheduled' })
        .eq('id', id);
      if (updErr) throw updErr;

      const { data, error } = await (supabase.rpc as any)('populate_collective_invites', { p_event_id: id });
      if (error) throw error;

      // Envia convites + lembrete do marco atual via SQL (cron tambem continua disparando)
      const { data: batch } = await (supabase.rpc as any)('dispatch_collective_event_batch', { p_event_id: id, p_batch_size: 500 });
      await (supabase.rpc as any)('dispatch_collective_event_reminders', { p_event_id: id, p_batch_size: 500 });

      toast.success(`Evento ativado, ${data} no segmento. ${(batch as any)?.sent ?? 0} convites enviados agora. Lembretes D-1/H-1 saem automatico.`);
      await load();
    } catch (err: any) {
      toast.error(`Erro ao disparar: ${err.message}`);
    } finally {
      setActionLoading(false);
      setDispatchOpen(false);
    }
  }

  async function handleSendNow() {
    if (!id) return;
    setActionLoading(true);
    try {
      const { data: batch, error: e1 } = await (supabase.rpc as any)('dispatch_collective_event_batch', { p_event_id: id, p_batch_size: 500 });
      if (e1) throw e1;
      const { data: rem } = await (supabase.rpc as any)('dispatch_collective_event_reminders', { p_event_id: id, p_batch_size: 500 });
      const sentInvites = (batch as any)?.sent ?? 0;
      const sentRem = (rem as any)?.sent ?? 0;
      const mile = (rem as any)?.milestone;
      toast.success(
        `${sentInvites} convite(s) inicial(is) enviado(s)` +
        (sentRem > 0 ? ` · ${sentRem} lembrete(s) ${mile}` : ''),
        { duration: 8000 },
      );
      await load();
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSendOpen(false);
    }
  }

  // Search leads pra teste
  useEffect(() => {
    if (!testOpen) return;
    if (testSearch.trim().length < 2) {
      setTestResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const q = testSearch.trim();
      const { data } = await (supabase as any)
        .from('crm_leads')
        .select('id, name, whatsapp, email')
        .or(`name.ilike.%${q}%,whatsapp.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(15);
      setTestResults((data as any) ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [testSearch, testOpen]);

  async function handleSendTest() {
    if (!event || !testLead) return;
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('collective-event-send-test', {
        body: {
          event_id: event.id,
          lead_id: testLead.id,
          channels: testChannels,
        },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? {};
      const msgs: string[] = [];
      if (sent.email?.ok) msgs.push(`Email enviado pra ${sent.email.to}`);
      else if (sent.email) msgs.push(`Email falhou: ${sent.email.error}`);
      if (sent.wa?.ok) msgs.push('WA enviado');
      else if (sent.wa) msgs.push(`WA falhou: ${sent.wa.error}`);
      if (msgs.length === 0) toast.error('Nenhum envio realizado');
      else toast.success(msgs.join(' · '), { duration: 8000 });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  }

  async function handleEnterAsHost() {
    if (onlineRooms.length === 0) {
      toast.error('Esse evento não tem sala online');
      return;
    }
    const ev: any = event;
    const toMembers = ev?.recording_destination === 'members';
    // Garante uma meeting ligada ao evento (modo gravacao) pra a sala gravar,
    // transcrever e ser arquivada/publicada conforme o destino escolhido.
    const ensureMeeting = async (room: string) => {
      const { data: existing } = await (supabase as any)
        .from('meetings').select('id').eq('livekit_room_name', room).maybeSingle();
      if (existing) return;
      await (supabase as any).from('meetings').insert({
        title: ev?.title || 'Evento ao vivo',
        livekit_room_name: room,
        status: 'scheduled',
        kind: 'live-session',
        // lesson_mode=true SO quando o destino e a area de membros (publica aula).
        // 'archive' usa false pra NUNCA virar aula publicada (so arquiva no evento).
        lesson_mode: toMembers,
        collective_event_id: ev?.id || null,
        target_module_id: toMembers ? (ev?.recording_target_module_id || null) : null,
        target_lesson_title: ev?.title || null,
        host_name: '+ que Vencedores',
        scheduled_at: new Date().toISOString(),
      });
    };
    const url = (room: string) => `/meet/${room}?mode=live-session&role=host&name=${encodeURIComponent('+ que Vencedores')}`;
    const first = onlineRooms[0].room_name;
    try { await ensureMeeting(first); } catch (e: any) { toast.error('Erro ao preparar gravacao: ' + e.message); }
    navigate(url(first));
    onlineRooms.slice(1).forEach((r) => window.open(url(r.room_name), '_blank'));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) return null;

  // Preview do email com variáveis substituídas pra visualização
  const sampleVars: Record<string, string> = {
    primeiro_nome: 'Carlos',
    nome: 'Carlos Eduardo',
    empresa: '+ que Vencedores',
    nome_evento: event.title,
    data_evento: new Date(event.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
    hora_evento: new Date(event.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    local_evento:
      event.event_format === 'online'
        ? 'online via sala + que Vencedores'
        : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'a confirmar',
    link_evento: `${origin}/r/exemplo-token`,
    link_grupo_whatsapp: event.whatsapp_group_url ?? '',
  };
  const previewHtml = (event.template_html ?? '').replace(
    /{{\s*([a-z_]+)\s*}}/gi,
    (_m, k) => sampleVars[k.toLowerCase()] ?? `{{${k}}}`,
  );
  const previewWaText = (event.template_wa_text ?? '').replace(
    /{{\s*([a-z_]+)\s*}}/gi,
    (_m, k) => sampleVars[k.toLowerCase()] ?? `{{${k}}}`,
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketing/eventos-coletivos')}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <FormatBadge fmt={event.event_format} />
                <Badge variant="outline" className={event.status === 'draft' ? 'border-amber-500/50 text-amber-300' : ''}>
                  {event.status === 'draft' ? 'Rascunho' : event.status}
                </Badge>
                {event.recording_enabled && (
                  <Badge variant="outline" className="border-red-500/40 text-red-300">
                    <Video className="w-3 h-3 mr-1" /> Gravando
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(event.scheduled_at).toLocaleString('pt-BR', {
                    weekday: 'short', day: '2-digit', month: 'long',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">{event.description}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestOpen(true)}
                className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
              >
                <Beaker className="w-3.5 h-3.5 mr-1.5" /> Enviar teste
              </Button>
              {event.status === 'draft' ? (
                <Button
                  size="sm"
                  onClick={() => setDispatchOpen(true)}
                  className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Disparar agora
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleResync}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-sincronizar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setSendOpen(true)}
                    className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Enviar convites
                  </Button>
                </>
              )}
              {(event.event_format === 'online' || event.event_format === 'hybrid') && event.status !== 'draft' && (
                <Button
                  size="sm"
                  onClick={handleEnterAsHost}
                  className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                >
                  <Video className="w-3.5 h-3.5 mr-1.5" /> Entrar como host
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox label="Convidados" value={stats.total} />
        <StatBox label="Conv. enviados" value={stats.sent} />
        <StatBox label="Abriram link" value={stats.opened} />
        <StatBox label="Confirmaram" value={stats.rsvp} />
        <StatBox label="Entraram" value={stats.joined} />
      </div>

      {/* Inscritos e credenciamento ficam na pagina dedicada /admin/credenciamento */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Lista de inscritos, cortesias, auto-cadastro e check-in agora ficam no controle dedicado.
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate('/admin/credenciamento')}>
            <Users className="w-3.5 h-3.5 mr-1.5" /> Abrir Credenciamento
          </Button>
        </CardContent>
      </Card>

      {/* Sala LiveKit */}
      {(event.event_format === 'online' || event.event_format === 'hybrid') && onlineRooms.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-amber-500" /> Sala de reunião (LiveKit)
            </h2>
            <div className="space-y-2">
              {onlineRooms.map((r) => {
                const meetUrl = `${origin}/meet/${r.room_name}`;
                const meetHostUrl = `${meetUrl}?role=host`;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded border border-zinc-800 bg-zinc-900">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Sala {String.fromCharCode(65 + r.shard_index)}</p>
                      <p className="text-xs text-muted-foreground font-mono break-all">{meetUrl}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {r.current_count}/{r.capacity} pessoas atribuídas
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(meetUrl, 'Link da sala')}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" onClick={() => navigate(`/meet/${r.room_name}?role=host`)}>
                        Entrar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              O lead NÃO recebe esse link direto. Ele recebe o link <code>{origin}/r/&lt;token&gt;</code> que valida e redireciona pra cá no horário certo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grupo WhatsApp */}
      {event.whatsapp_group_url && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" /> Grupo WhatsApp exclusivo
                </h2>
                <p className="text-xs text-muted-foreground mb-2">
                  Botão "{event.whatsapp_group_label || 'Entrar no Grupo Exclusivo'}" aparece pra cada lead que confirmar presença.
                </p>
                <p className="text-sm font-mono text-zinc-300 break-all">{event.whatsapp_group_url}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(event.whatsapp_group_url!, 'Link do grupo')}>
                  <Copy className="w-3 h-3" />
                </Button>
                <a href={event.whatsapp_group_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm">Abrir</Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email preview */}
      {event.template_html && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-500" /> Email do convite
              </h2>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(event.template_html ?? '', 'HTML do email')}>
                <Copy className="w-3 h-3 mr-1.5" /> Copiar HTML
              </Button>
            </div>
            {event.template_subject && (
              <div className="text-xs p-3 rounded bg-zinc-900 border border-zinc-700 mb-3">
                <p className="text-zinc-400">Assunto:</p>
                <p className="font-medium text-zinc-100">{event.template_subject}</p>
                {event.template_preheader && (
                  <p className="text-zinc-400 text-[11px] mt-2">Preview inbox: {event.template_preheader}</p>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mb-2">
              Pré-visualização com variáveis preenchidas pra um lead exemplo:
            </p>
            <iframe
              title="Preview email"
              srcDoc={previewHtml}
              className="w-full h-[600px] bg-white border border-zinc-700 rounded"
              sandbox=""
            />
          </CardContent>
        </Card>
      )}

      {/* WA text */}
      {event.template_wa_text && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" /> Mensagem WhatsApp
              </h2>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(previewWaText, 'Texto WA')}>
                <Copy className="w-3 h-3 mr-1.5" /> Copiar
              </Button>
            </div>
            <pre className="text-xs whitespace-pre-wrap p-3 rounded bg-zinc-900 border border-zinc-700 font-sans">
              {previewWaText}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Lista de convidados */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" /> Convidados ({stats.total})
          </h2>
          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground">
              {event.status === 'draft'
                ? 'Rascunho ainda não dispara convites. Clique em "Criar e disparar" pra enviar.'
                : 'Nenhum lead bateu o segmento. Use "Re-sincronizar" ou ajuste filtros.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2 px-2">Lead</th>
                    <th className="text-left py-2 px-2">Contato</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Link único</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.slice(0, 50).map((inv) => {
                    const landingUrl = `${origin}/r/${inv.token}`;
                    const status = inv.joined_at
                      ? 'Entrou'
                      : inv.rsvp_at
                      ? 'Confirmado'
                      : inv.opened_landing_at
                      ? 'Abriu link'
                      : inv.invite_email_sent_at || inv.invite_wa_sent_at
                      ? 'Convite enviado'
                      : 'Aguardando envio';
                    return (
                      <tr key={inv.id} className="border-b border-zinc-800/50">
                        <td className="py-2 px-2">{inv.lead?.name || '(sem nome)'}</td>
                        <td className="py-2 px-2 text-zinc-400">
                          {[inv.lead?.whatsapp, inv.lead?.email].filter(Boolean).join(' · ') || '-'}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-[10px]">{status}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(landingUrl, 'Link único')}
                            className="text-amber-400 hover:text-amber-300 font-mono text-[10px] inline-flex items-center gap-1"
                          >
                            {inv.token.slice(0, 12)}...
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                          <a
                            href={landingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-300 ml-2"
                          >
                            <ExternalLink className="w-3 h-3 inline" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {invites.length > 50 && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Mostrando 50 de {invites.length}. Use filtros pra ver mais.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CollectiveEventModal
        open={editOpen}
        onOpenChange={(o) => { setEditOpen(o); if (!o) load(); }}
        initialEventId={event.id}
        onCreated={() => load()}
      />

      {/* Confirm excluir */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o evento, as salas e {invites.length} convites associados. Não dá pra desfazer.
              {stats.sent > 0 && (
                <span className="block mt-2 text-amber-300 font-medium">
                  Atenção: {stats.sent} leads já receberam o convite. Eles não serão notificados do cancelamento.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir definitivo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm disparar */}
      <AlertDialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disparar campanha agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Vou: 1) ativar o evento (sai de Rascunho), 2) varrer o segmento pra criar convites,
              3) acionar o dispatcher pra enviar os convites por email e WhatsApp imediatamente.
              Lembretes D-3, D-1 e H-1 entram no cron automático depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDispatchNow} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Disparar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar envio de convites/lembretes */}
      <AlertDialog open={sendOpen} onOpenChange={setSendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar convites agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Vou enviar por email: o convite inicial pra quem ainda nao recebeu, e o lembrete do marco atual
              (D-3, D-1 ou H-1) pra quem ja recebeu o convite. Quem ja recebeu cada etapa nao recebe de novo.
              {stats.total > 0 && (
                <span className="block mt-2 text-amber-300">Segmento atual: {stats.total} convidados.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendNow} disabled={actionLoading} className="bg-emerald-500 hover:bg-emerald-600">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enviar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enviar teste */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="w-4 h-4 text-blue-400" /> Enviar teste pra 1 lead
            </DialogTitle>
            <DialogDescription>
              Envio único pra validar variáveis (nome, data, hora, link). Não cria invite real, não conta nas métricas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Buscar lead</Label>
              <Input
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                placeholder="Nome, WhatsApp ou email..."
              />
              {testResults.length > 0 && (
                <div className="border rounded mt-1 max-h-48 overflow-y-auto bg-zinc-900 border-zinc-700">
                  {testResults.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => { setTestLead(l); setTestSearch(''); setTestResults([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 border-b border-zinc-800 last:border-b-0"
                    >
                      <p className="font-medium text-zinc-100">{l.name || '(sem nome)'}</p>
                      <p className="text-[11px] text-zinc-400">
                        {[l.whatsapp, l.email].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {testLead && (
              <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30 text-sm">
                <p className="font-medium text-blue-100">{testLead.name || '(sem nome)'}</p>
                <p className="text-[11px] text-blue-300">
                  Email: {testLead.email || 'não tem'} · WA: {testLead.whatsapp || 'não tem'}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Canais</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={testChannels.email}
                    onCheckedChange={(c) => setTestChannels({ ...testChannels, email: !!c })}
                    disabled={!testLead?.email}
                  />
                  Email {testLead && !testLead.email && '(lead sem email)'}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={testChannels.wa}
                    onCheckedChange={(c) => setTestChannels({ ...testChannels, wa: !!c })}
                    disabled={!testLead?.whatsapp}
                  />
                  WhatsApp {testLead && !testLead.whatsapp && '(lead sem WA)'}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestOpen(false)} disabled={testSending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={!testLead || testSending || (!testChannels.email && !testChannels.wa)}
            >
              {testSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ranking.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <p className="text-base font-semibold px-4 pt-4 pb-2">Ranking de participacao</p>
            <div className="divide-y divide-white/5">
              {ranking.slice(0, 50).map((r: any, i: number) => (
                <div key={r.lead_id || i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.nome || r.whatsapp || 'Lead'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.perguntas} perguntas · {r.interacoes} interacoes · {r.minutos_assistidos} min
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-amber-400">{r.score}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
