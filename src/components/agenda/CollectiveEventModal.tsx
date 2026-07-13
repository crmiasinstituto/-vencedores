/**
 * CollectiveEventModal
 *
 * Criação de evento coletivo (Masterclass, Workshop, Aulão, Live) na agenda.
 * Segmenta leads do kanban (colunas, tags, post-sale), pré-cria salas LiveKit shards,
 * gera template por áudio via Gemini e agenda lembretes D-3/D-1/H-1.
 *
 * Edge: collective-event-create. Reusa AITemplateGenerator pro recorder de áudio.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2, Users, MapPin, Globe, Mic, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AITemplateGenerator from '@/components/email-marketing/AITemplateGenerator';

type EventFormat = 'online' | 'presencial' | 'hybrid';

interface KanbanColumn { id: string; name: string; board_id: string; board_name?: string }
interface EmailTemplate { id: string; name: string }
interface WaTemplate { id: string; name: string; status?: string }
interface TagOption { tag: string; n: number }
interface SelectedLead { id: string; name: string; whatsapp: string | null; email: string | null }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  initialEventId?: string; // carrega rascunho pra editar
  onCreated?: (eventId: string) => void;
}

interface TemplateGeneration {
  at: string;
  model: string;
  brief: string;
  subject: string;
  html_excerpt: string;
}

interface LibraryTemplate {
  id: string;
  name: string;
  subject: string | null;
  preheader: string | null;
  html_content: string;
  wa_text: string | null;
  brief: string | null;
  is_favorite: boolean;
  used_count: number;
  created_at: string;
  last_used_at: string | null;
}

interface FormState {
  event_id: string | null;            // null = novo. preenchido = editando rascunho
  title: string;
  description: string;
  event_format: EventFormat;
  scheduled_date: string; // yyyy-mm-dd
  scheduled_time: string; // HH:mm
  duration_minutes: number;
  max_per_room: number;
  recording_enabled: boolean;
  recording_destination: 'members' | 'archive';
  recording_target_module_id: string;
  venue_name: string;
  venue_address: string;
  venue_complement: string;
  venue_capacity: string;
  venue_map_url: string;
  whatsapp_group_url: string;
  whatsapp_group_label: string;
  broadcast_group_jids: string[];
  column_ids: string[];
  tag_filters: string;
  post_sale_stages: string;
  exclude_lost: boolean;
  specific_leads: SelectedLead[];
  template_html: string;
  template_wa_text: string;
  template_subject: string;
  template_preheader: string;
  template_brief: string;
  template_generations: TemplateGeneration[];
  email_template_id: string | null;
  wa_template_id: string | null;
  reminders: {
    d3: { email: boolean; wa: boolean };
    d1: { email: boolean; wa: boolean };
    h1: { email: boolean; wa: boolean };
  };
}

function initialForm(date?: Date): FormState {
  const d = date ?? new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return {
    event_id: null,
    title: '',
    description: '',
    event_format: 'online',
    scheduled_date: `${yyyy}-${mm}-${dd}`,
    scheduled_time: `${hh}:00`,
    duration_minutes: 60,
    max_per_room: 50,
    recording_enabled: true,
    recording_destination: 'archive',
    recording_target_module_id: '',
    venue_name: '',
    venue_address: '',
    venue_complement: '',
    venue_capacity: '',
    venue_map_url: '',
    whatsapp_group_url: '',
    whatsapp_group_label: 'Entrar no Grupo Exclusivo',
    broadcast_group_jids: [],
    column_ids: [],
    tag_filters: '',
    post_sale_stages: '',
    exclude_lost: true,
    specific_leads: [],
    template_html: '',
    template_wa_text: '',
    template_subject: '',
    template_preheader: '',
    template_brief: '',
    template_generations: [],
    email_template_id: null,
    wa_template_id: null,
    reminders: {
      d3: { email: true, wa: true },
      d1: { email: true, wa: true },
      h1: { email: true, wa: true },
    },
  };
}

export default function CollectiveEventModal({ open, onOpenChange, initialDate, initialEventId, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(() => initialForm(initialDate));
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [library, setLibrary] = useState<LibraryTemplate[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<SelectedLead[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [tab, setTab] = useState<'details' | 'segment' | 'content' | 'reminders'>('details');
  const [waGroups, setWaGroups] = useState<{ jid: string; name: string }[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [memberModules, setMemberModules] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (!open) return;
    (supabase as any).from('wa_groups').select('jid, name').order('name').then(({ data }: any) => setWaGroups(data || []));
    (supabase as any).from('member_modules').select('id, title').order('sort_order').then(({ data }: any) => setMemberModules(data || []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialEventId) {
      // Carrega rascunho existente
      (async () => {
        const { data, error } = await (supabase as any)
          .from('collective_events')
          .select('*')
          .eq('id', initialEventId)
          .maybeSingle();
        if (error || !data) {
          toast.error('Não consegui carregar o rascunho');
          setForm(initialForm(initialDate));
          return;
        }
        const sched = new Date(data.scheduled_at);
        const yyyy = sched.getFullYear();
        const mm = String(sched.getMonth() + 1).padStart(2, '0');
        const dd = String(sched.getDate()).padStart(2, '0');
        const hh = String(sched.getHours()).padStart(2, '0');
        const mn = String(sched.getMinutes()).padStart(2, '0');
        const seg = data.target_segment ?? {};
        setForm({
          event_id: data.id,
          title: data.title ?? '',
          description: data.description ?? '',
          event_format: data.event_format ?? 'online',
          scheduled_date: `${yyyy}-${mm}-${dd}`,
          scheduled_time: `${hh}:${mn}`,
          duration_minutes: data.duration_minutes ?? 60,
          max_per_room: data.max_per_room ?? 50,
          recording_enabled: data.recording_enabled ?? true,
          recording_destination: (data.recording_destination as any) ?? 'archive',
          recording_target_module_id: data.recording_target_module_id ?? '',
          venue_name: data.venue_name ?? '',
          venue_address: data.venue_address ?? '',
          venue_complement: data.venue_complement ?? '',
          venue_capacity: data.venue_capacity?.toString() ?? '',
          venue_map_url: data.venue_map_url ?? '',
          whatsapp_group_url: data.whatsapp_group_url ?? '',
          whatsapp_group_label: data.whatsapp_group_label ?? 'Entrar no Grupo Exclusivo',
          broadcast_group_jids: Array.isArray(data.broadcast_group_jids) ? data.broadcast_group_jids : [],
          column_ids: Array.isArray(seg.column_ids) ? seg.column_ids : [],
          tag_filters: Array.isArray(seg.tag_filters) ? seg.tag_filters.join(', ') : '',
          post_sale_stages: Array.isArray(seg.post_sale_stages) ? seg.post_sale_stages.join(', ') : '',
          exclude_lost: seg.exclude_lost ?? true,
          specific_leads: [], // hidrata depois
          template_html: data.template_html ?? '',
          template_wa_text: data.template_wa_text ?? '',
          template_subject: data.template_subject ?? '',
          template_preheader: data.template_preheader ?? '',
          template_brief: data.template_brief ?? '',
          template_generations: Array.isArray(data.template_generations) ? data.template_generations : [],
          email_template_id: data.email_template_id ?? null,
          wa_template_id: data.wa_template_id ?? null,
          reminders: data.reminders_config ?? {
            d3: { email: true, wa: true },
            d1: { email: true, wa: true },
            h1: { email: true, wa: true },
          },
        });
        // Hidrata os leads específicos do segmento
        const leadIds: string[] = Array.isArray(seg.lead_ids) ? seg.lead_ids : [];
        if (leadIds.length > 0) {
          const { data: leadsData } = await (supabase as any)
            .from('crm_leads')
            .select('id, name, whatsapp, email')
            .in('id', leadIds);
          if (leadsData) {
            setForm((f) => ({ ...f, specific_leads: leadsData as SelectedLead[] }));
          }
        }
      })();
    } else {
      setForm(initialForm(initialDate));
    }
  }, [open, initialDate, initialEventId]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const sb = supabase as any;
      const [colsRes, boardsRes, emailRes, waRes, tagsRes] = await Promise.all([
        sb.from('crm_columns').select('id, name, board_id, sort_order').order('sort_order'),
        sb.from('crm_boards').select('id, name'),
        sb.from('email_templates').select('id, name').eq('is_active', true).order('name'),
        sb.from('wa_cloud_templates').select('id, name, status').eq('provider', 'cloud_api'),
        sb.rpc('list_active_lead_tags', { p_min_count: 1 }),
      ]);
      if (!alive) return;
      const boardNames = new Map<string, string>();
      (boardsRes.data as any[] ?? []).forEach((b) => boardNames.set(b.id, b.name));
      if (colsRes.data) {
        setColumns((colsRes.data as any[]).map((c) => ({
          ...c,
          board_name: boardNames.get(c.board_id) ?? '',
        })) as KanbanColumn[]);
      }
      if (emailRes.data) setEmailTemplates(emailRes.data as unknown as EmailTemplate[]);
      if (waRes.data) setWaTemplates(waRes.data as unknown as WaTemplate[]);
      if (tagsRes.data) {
        setAvailableTags((tagsRes.data as any[]).map((t: any) => ({ tag: t.tag, n: Number(t.lead_count) })));
      }
      // Biblioteca de templates salvos
      const libRes = await sb
        .from('event_template_library')
        .select('id, name, subject, preheader, html_content, wa_text, brief, is_favorite, used_count, created_at, last_used_at')
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      if (libRes.data) setLibrary(libRes.data as LibraryTemplate[]);
    })();
    return () => { alive = false; };
  }, [open]);

  const targetSegment = useMemo(() => {
    const tag_filters = form.tag_filters.split(',').map((s) => s.trim()).filter(Boolean);
    const post_sale_stages = form.post_sale_stages.split(',').map((s) => s.trim()).filter(Boolean);
    return {
      column_ids: form.column_ids,
      tag_filters,
      post_sale_stages,
      exclude_lost: form.exclude_lost,
      lead_ids: form.specific_leads.map((l) => l.id),
    };
  }, [form.column_ids, form.tag_filters, form.post_sale_stages, form.exclude_lost, form.specific_leads]);

  // Search com debounce
  useEffect(() => {
    if (!leadSearch.trim() || leadSearch.trim().length < 2) {
      setLeadResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLeadSearchLoading(true);
      try {
        const q = leadSearch.trim();
        const { data } = await (supabase as any)
          .from('crm_leads')
          .select('id, name, whatsapp, email')
          .or(`name.ilike.%${q}%,whatsapp.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(20);
        const selectedIds = new Set(form.specific_leads.map((l) => l.id));
        setLeadResults(
          ((data as SelectedLead[]) ?? []).filter((l) => !selectedIds.has(l.id)),
        );
      } catch {
        setLeadResults([]);
      } finally {
        setLeadSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [leadSearch, form.specific_leads]);

  function addSpecificLead(lead: SelectedLead) {
    setForm((f) => ({ ...f, specific_leads: [...f.specific_leads, lead] }));
    setLeadSearch('');
    setLeadResults([]);
  }

  function removeSpecificLead(id: string) {
    setForm((f) => ({ ...f, specific_leads: f.specific_leads.filter((l) => l.id !== id) }));
  }

  async function saveToLibrary(template: { subject: string; preheader?: string; html_content: string; wa_text?: string; brief?: string }) {
    try {
      const sb = supabase as any;
      const name = (template.subject || form.title || 'Template sem título').slice(0, 80);
      const { data, error } = await sb
        .from('event_template_library')
        .insert({
          name,
          subject: template.subject,
          preheader: template.preheader ?? null,
          html_content: template.html_content,
          wa_text: template.wa_text ?? null,
          brief: template.brief ?? null,
          source_event_id: form.event_id,
        })
        .select('id, name, subject, preheader, html_content, wa_text, brief, is_favorite, used_count, created_at, last_used_at')
        .single();
      if (error) throw error;
      if (data) setLibrary((prev) => [data as LibraryTemplate, ...prev]);
      return data?.id;
    } catch {
      // silent — não bloqueia geração
      return null;
    }
  }

  function applyFromLibrary(tpl: LibraryTemplate) {
    setForm((f) => ({
      ...f,
      template_subject: tpl.subject ?? '',
      template_preheader: tpl.preheader ?? '',
      template_html: tpl.html_content,
      template_wa_text: tpl.wa_text ?? f.template_wa_text,
      template_brief: tpl.brief ?? f.template_brief,
    }));
    // incrementa uso (fire and forget)
    (supabase as any)
      .from('event_template_library')
      .update({ used_count: tpl.used_count + 1, last_used_at: new Date().toISOString() })
      .eq('id', tpl.id);
    setLibraryOpen(false);
    toast.success(`Template "${tpl.name}" carregado`);
  }

  async function toggleLibraryFavorite(tpl: LibraryTemplate) {
    const next = !tpl.is_favorite;
    setLibrary((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, is_favorite: next } : t)));
    await (supabase as any).from('event_template_library').update({ is_favorite: next }).eq('id', tpl.id);
  }

  async function deleteLibraryTemplate(tpl: LibraryTemplate) {
    if (!confirm(`Excluir template "${tpl.name}" da biblioteca?`)) return;
    setLibrary((prev) => prev.filter((t) => t.id !== tpl.id));
    await (supabase as any).from('event_template_library').delete().eq('id', tpl.id);
    toast.success('Template removido da biblioteca');
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      let query: any = (supabase as any)
        .from('crm_leads')
        .select('id', { count: 'exact', head: true });
      if (targetSegment.column_ids.length > 0) {
        query = query.in('column_id', targetSegment.column_ids);
      }
      if (targetSegment.tag_filters.length > 0) {
        query = query.overlaps('tags', targetSegment.tag_filters);
      }
      if (targetSegment.post_sale_stages.length > 0) {
        query = query.in('post_sale_stage', targetSegment.post_sale_stages);
      }
      if (targetSegment.exclude_lost) {
        query = query.is('lost_reason', null);
      }
      query = query.eq('email_opted_out', false);
      const { count, error } = await query;
      if (error) throw error;
      // Soma com leads específicos (deduplica IDs que já estão no segmento via UNION na RPC, mas pra estimativa de UI somamos sem dedup)
      const baseCount = count ?? 0;
      const specificCount = form.specific_leads.length;
      setPreviewCount(baseCount + specificCount);
    } catch (err: any) {
      toast.error(`Erro ao prever segmento: ${err.message}`);
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit(status: 'draft' | 'scheduled' = 'scheduled') {
    if (!form.title.trim()) { toast.error('Título obrigatório'); return; }
    if (!form.scheduled_date || !form.scheduled_time) { toast.error('Data e hora obrigatórias'); return; }
    const scheduled_at = new Date(`${form.scheduled_date}T${form.scheduled_time}:00`).toISOString();
    if (
      status === 'scheduled' &&
      form.column_ids.length === 0 &&
      !form.tag_filters.trim() &&
      !form.post_sale_stages.trim() &&
      form.specific_leads.length === 0
    ) {
      toast.error('Pra disparar, defina ao menos um filtro de segmento OU adicione leads específicos. Pra só salvar rascunho, use o botão "Salvar rascunho".');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        event_id: form.event_id ?? undefined,
        status,
        title: form.title,
        description: form.description || null,
        event_format: form.event_format,
        scheduled_at,
        duration_minutes: form.duration_minutes,
        max_per_room: form.max_per_room,
        recording_enabled: form.recording_enabled,
        recording_destination: form.recording_destination,
        recording_target_module_id:
          form.recording_destination === 'members' && form.recording_target_module_id
            ? form.recording_target_module_id
            : null,
        target_segment: targetSegment,
        venue: form.event_format === 'online' ? undefined : {
          name: form.venue_name || undefined,
          address: form.venue_address || undefined,
          complement: form.venue_complement || undefined,
          capacity: form.venue_capacity ? parseInt(form.venue_capacity, 10) : undefined,
          map_url: form.venue_map_url || undefined,
        },
        whatsapp_group_url: form.whatsapp_group_url.trim() || undefined,
        whatsapp_group_label: form.whatsapp_group_label.trim() || undefined,
        template_html: form.template_html || undefined,
        template_subject: form.template_subject || undefined,
        template_preheader: form.template_preheader || undefined,
        template_brief: form.template_brief || undefined,
        template_wa_text: form.template_wa_text || undefined,
        email_template_id: form.email_template_id || undefined,
        wa_template_id: form.wa_template_id || undefined,
        reminders_config: form.reminders,
      };

      const { data, error } = await supabase.functions.invoke('collective-event-create', {
        body: payload,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).detail || (data as any).error);

      const eventId = (data as any)?.event_id;
      // Grupos de broadcast: salvos direto (a edge collective-event-create nao
      // trata esse campo). Postagem do link + lembretes roda via cron no banco.
      if (eventId) {
        await (supabase as any).from('collective_events')
          .update({ broadcast_group_jids: form.broadcast_group_jids })
          .eq('id', eventId);
      }
      if (status === 'draft') {
        toast.success('Rascunho salvo, pode voltar a editar quando quiser', {
          action: eventId ? {
            label: 'Ver detalhes',
            onClick: () => window.location.assign(`/admin/marketing/eventos-coletivos/${eventId}`),
          } : undefined,
        });
        if (eventId) setForm((f) => ({ ...f, event_id: eventId }));
      } else {
        toast.success(`Evento criado, ${(data as any)?.invites_created ?? 0} convites enfileirados`, {
          duration: 8000,
          action: eventId ? {
            label: 'Ver detalhes',
            onClick: () => window.location.assign(`/admin/marketing/eventos-coletivos/${eventId}`),
          } : undefined,
        });
        onCreated?.(eventId);
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const toggleColumn = (id: string) => {
    setForm((f) => ({
      ...f,
      column_ids: f.column_ids.includes(id) ? f.column_ids.filter((c) => c !== id) : [...f.column_ids, id],
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Novo evento coletivo
            </DialogTitle>
            <DialogDescription>
              Masterclass, Workshop, Aulão ou Live. Segmenta leads do kanban e dispara convite + lembretes D-3, D-1, H-1.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="segment">Segmento</TabsTrigger>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="reminders">Lembretes</TabsTrigger>
            </TabsList>

            {/* TAB: Detalhes */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Masterclass: LinkedIn que Vende"
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Resumo do que vai ser abordado"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, event_format: 'online' })}
                  className={`rounded-lg border p-3 text-sm flex flex-col items-center gap-1 ${
                    form.event_format === 'online' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700'
                  }`}
                >
                  <Globe className="w-4 h-4" /> Online
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, event_format: 'presencial' })}
                  className={`rounded-lg border p-3 text-sm flex flex-col items-center gap-1 ${
                    form.event_format === 'presencial' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700'
                  }`}
                >
                  <MapPin className="w-4 h-4" /> Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, event_format: 'hybrid' })}
                  className={`rounded-lg border p-3 text-sm flex flex-col items-center gap-1 ${
                    form.event_format === 'hybrid' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700'
                  }`}
                >
                  <Users className="w-4 h-4" /> Híbrido
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={form.scheduled_time}
                    onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value, 10) || 60 })}
                  />
                </div>
              </div>

              {form.event_format !== 'online' && (
                <Card className="p-4 space-y-3 border-zinc-700">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Local físico
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={form.venue_name}
                        onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
                        placeholder="+ que Vencedores HQ"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Capacidade física</Label>
                      <Input
                        type="number"
                        value={form.venue_capacity}
                        onChange={(e) => setForm({ ...form, venue_capacity: e.target.value })}
                        placeholder="50"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Endereço</Label>
                    <Input
                      value={form.venue_address}
                      onChange={(e) => setForm({ ...form, venue_address: e.target.value })}
                      placeholder="Av. Paulista, 1000, São Paulo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Complemento</Label>
                      <Input
                        value={form.venue_complement}
                        onChange={(e) => setForm({ ...form, venue_complement: e.target.value })}
                        placeholder="Sala 5, 2º andar"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Link do mapa</Label>
                      <Input
                        value={form.venue_map_url}
                        onChange={(e) => setForm({ ...form, venue_map_url: e.target.value })}
                        placeholder="https://maps.app.goo.gl/..."
                      />
                    </div>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Capacidade por sala online</Label>
                  <Input
                    type="number"
                    value={form.max_per_room}
                    onChange={(e) => setForm({ ...form, max_per_room: parseInt(e.target.value, 10) || 50 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando estoura, abre nova sala automaticamente.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Checkbox
                    checked={form.recording_enabled}
                    onCheckedChange={(c) => setForm({ ...form, recording_enabled: !!c })}
                  />
                  <Label className="font-normal">Gravar evento (recomendado)</Label>
                </div>
              </div>

              {/* Destino da gravacao: area de membros (publica aula) ou so arquivo interno */}
              {form.recording_enabled && (
                <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
                  <Label className="text-sm font-medium">O que fazer com a gravação?</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, recording_destination: 'archive' })}
                      className={`text-left rounded-lg border p-3 text-sm transition-colors ${
                        form.recording_destination === 'archive'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium">Arquivar no evento</div>
                      <div className="text-xs text-muted-foreground">Uso interno (CRM). Não aparece pros alunos.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, recording_destination: 'members' })}
                      className={`text-left rounded-lg border p-3 text-sm transition-colors ${
                        form.recording_destination === 'members'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium">Publicar na área de membros</div>
                      <div className="text-xs text-muted-foreground">Vira aula (com resumo) no módulo escolhido.</div>
                    </button>
                  </div>
                  {form.recording_destination === 'members' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Módulo da área de membros</Label>
                      <select
                        value={form.recording_target_module_id}
                        onChange={(e) => setForm({ ...form, recording_target_module_id: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Selecione o módulo...</option>
                        {memberModules.map((m) => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Grupo WhatsApp opcional */}
              <Card className="p-4 space-y-3 border-emerald-500/30 bg-emerald-500/5">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500" /> Grupo WhatsApp exclusivo (opcional)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se você criou um grupo de WhatsApp pros confirmados, cole o link aqui. O botão aparece na landing após a confirmação de presença e no email.
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Link do convite do grupo</Label>
                  <Input
                    value={form.whatsapp_group_url}
                    onChange={(e) => setForm({ ...form, whatsapp_group_url: e.target.value })}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </div>
                <div>
                  <Label className="text-xs">Texto do botão</Label>
                  <Input
                    value={form.whatsapp_group_label}
                    onChange={(e) => setForm({ ...form, whatsapp_group_label: e.target.value })}
                    placeholder="Entrar no Grupo Exclusivo"
                  />
                </div>
                <div>
                  <Label className="text-xs">Postar link + lembretes nestes grupos</Label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    O link do evento e os lembretes (D-3, D-1, 1h) serao postados automaticamente nos grupos escolhidos.
                  </p>
                  {form.broadcast_group_jids.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.broadcast_group_jids.map((jid) => {
                        const g = waGroups.find((x) => x.jid === jid);
                        return (
                          <span key={jid} className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-200 text-xs rounded-full px-2 py-1">
                            {g?.name || jid}
                            <button type="button" className="hover:text-white"
                              onClick={() => setForm({ ...form, broadcast_group_jids: form.broadcast_group_jids.filter((j) => j !== jid) })}>×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <Input value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder={`Buscar entre ${waGroups.length} grupos...`} />
                  {groupSearch.trim().length >= 2 && (
                    <div className="mt-1 max-h-44 overflow-y-auto border border-white/10 rounded-lg divide-y divide-white/5">
                      {waGroups
                        .filter((g) => (g.name || '').toLowerCase().includes(groupSearch.toLowerCase()) && !form.broadcast_group_jids.includes(g.jid))
                        .slice(0, 30)
                        .map((g) => (
                          <button key={g.jid} type="button"
                            onClick={() => { setForm({ ...form, broadcast_group_jids: [...form.broadcast_group_jids, g.jid] }); setGroupSearch(''); }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 truncate">
                            {g.name || g.jid}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>

            {/* TAB: Segmento */}
            <TabsContent value="segment" className="space-y-4 mt-4">
              <div>
                <Label className="mb-2 block">Colunas do kanban</Label>
                <div className="grid grid-cols-1 gap-0.5 max-h-72 overflow-y-auto border rounded p-2">
                  {(() => {
                    const grouped = new Map<string, KanbanColumn[]>();
                    for (const c of columns) {
                      const key = c.board_name || 'Sem board';
                      if (!grouped.has(key)) grouped.set(key, []);
                      grouped.get(key)!.push(c);
                    }
                    return Array.from(grouped.entries()).map(([board, cols]) => (
                      <div key={board} className="mb-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                          {board}
                        </p>
                        {cols.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm hover:bg-zinc-800/50 rounded px-2 py-1 cursor-pointer">
                            <Checkbox
                              checked={form.column_ids.includes(c.id)}
                              onCheckedChange={() => toggleColumn(c.id)}
                            />
                            <span>{c.name}</span>
                          </label>
                        ))}
                      </div>
                    ));
                  })()}
                  {columns.length === 0 && (
                    <p className="text-xs text-muted-foreground p-4 text-center">
                      Carregando colunas do kanban...
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Tags ativas ({availableTags.length} disponíveis)</Label>
                {availableTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Carregando tags...</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto border rounded p-2">
                    {availableTags.map((t) => {
                      const selectedTags = form.tag_filters
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const active = selectedTags.includes(t.tag);
                      return (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? selectedTags.filter((s) => s !== t.tag)
                              : [...selectedTags, t.tag];
                            setForm({ ...form, tag_filters: next.join(', ') });
                          }}
                          className={`px-2.5 py-1 text-xs rounded-full border ${
                            active
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                              : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {t.tag}
                          <span className={`ml-1.5 text-[10px] ${active ? 'text-amber-300' : 'text-zinc-500'}`}>
                            {t.n}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Clique pra selecionar. Lead precisa ter ao menos 1 das tags marcadas (OR).
                </p>
              </div>

              <div>
                <Label>Estágios pós-venda (separados por vírgula)</Label>
                <Input
                  value={form.post_sale_stages}
                  onChange={(e) => setForm({ ...form, post_sale_stages: e.target.value })}
                  placeholder="onboarding, ativo"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.exclude_lost}
                  onCheckedChange={(c) => setForm({ ...form, exclude_lost: !!c })}
                />
                <Label className="font-normal">Excluir leads perdidos</Label>
              </div>

              {/* Leads específicos */}
              <div className="border-t border-zinc-800 pt-4 mt-4">
                <Label className="mb-2 block">
                  Leads específicos
                  {form.specific_leads.length > 0 && (
                    <span className="ml-2 text-xs text-amber-300">
                      ({form.specific_leads.length} adicionados)
                    </span>
                  )}
                </Label>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Adicione leads individualmente, eles entram no convite mesmo que não batam os filtros acima.
                </p>
                <div className="relative">
                  <Input
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Buscar por nome, WhatsApp ou email..."
                  />
                  {leadSearchLoading && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                {leadResults.length > 0 && (
                  <div className="border rounded mt-1 max-h-48 overflow-y-auto bg-zinc-900 border-zinc-700">
                    {leadResults.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => addSpecificLead(l)}
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
                {leadSearch.length >= 2 && leadResults.length === 0 && !leadSearchLoading && (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum lead encontrado</p>
                )}
                {form.specific_leads.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {form.specific_leads.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-100"
                      >
                        {l.name || l.whatsapp || l.email || l.id.slice(0, 6)}
                        <button
                          type="button"
                          onClick={() => removeSpecificLead(l.id)}
                          className="hover:text-amber-300"
                          aria-label="Remover"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handlePreview} disabled={previewLoading} variant="outline">
                  {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                  Prever leads
                </Button>
                {previewCount !== null && (
                  <Badge variant="secondary" className="text-sm">
                    {previewCount} {previewCount === 1 ? 'lead' : 'leads'} no segmento
                  </Badge>
                )}
              </div>
            </TabsContent>

            {/* TAB: Conteúdo */}
            <TabsContent value="content" className="space-y-4 mt-4">
              <Card className="p-4 space-y-3 border-amber-500/30 bg-amber-500/5">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Mic className="w-4 h-4 text-amber-500" /> Gerar conteúdo por áudio
                </h4>
                <p className="text-xs text-muted-foreground">
                  Grave um áudio descrevendo o evento, a IA monta o template de email e o texto WA pra você.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setAiOpen(true)} variant="outline" size="sm">
                    <Sparkles className="w-4 h-4 mr-2" /> {form.template_html ? 'Regenerar com IA' : 'Gerar com IA'}
                  </Button>
                  <Button
                    onClick={() => setLibraryOpen(true)}
                    variant="outline"
                    size="sm"
                    disabled={library.length === 0}
                  >
                    Biblioteca {library.length > 0 && <span className="ml-1 opacity-60">({library.length})</span>}
                  </Button>
                  {form.template_html && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, template_html: '', template_subject: '', template_preheader: '', template_brief: '' }))}
                    >
                      Limpar
                    </Button>
                  )}
                </div>
                {form.template_subject && (
                  <div className="space-y-3 mt-3">
                    {(() => {
                      const hasLogo = /squaad-logo/.test(form.template_html);
                      const hasYellowHeader = /#3B82F6/i.test(form.template_html);
                      const isEventLikely = /evento|masterclass|workshop|aul[aã]o|live/i.test(form.title);
                      const looksValid = hasLogo && (!isEventLikely || hasYellowHeader);
                      return !looksValid && (
                        <div className="text-xs p-3 rounded border border-amber-500/50 bg-amber-500/10 text-amber-200">
                          O template gerado parece não estar no padrão + que Vencedores (header amarelo + logo). Clique em <strong>Regenerar com IA</strong>.
                        </div>
                      );
                    })()}
                    <div className="text-xs p-3 rounded bg-zinc-900 border border-zinc-700">
                      <p className="text-zinc-400 mb-1">Assunto gerado:</p>
                      <p className="font-medium text-zinc-100">{form.template_subject}</p>
                      {form.template_preheader && (
                        <p className="text-zinc-400 mt-2 text-[11px]">Preview inbox: {form.template_preheader}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">Pré-visualização do email:</p>
                      <iframe
                        title="Preview template"
                        srcDoc={form.template_html}
                        className="w-full h-[500px] bg-white border border-zinc-700 rounded"
                        sandbox=""
                      />
                    </div>
                    {form.template_brief && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-100 select-none">
                          Briefing usado ({form.template_brief.length} chars)
                        </summary>
                        <p className="mt-2 p-3 rounded bg-zinc-900 border border-zinc-700 whitespace-pre-wrap">
                          {form.template_brief}
                        </p>
                      </details>
                    )}
                    {form.template_generations.length > 1 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-100 select-none">
                          Histórico de gerações ({form.template_generations.length})
                        </summary>
                        <ul className="mt-2 space-y-1.5">
                          {form.template_generations.slice().reverse().map((g, i) => (
                            <li key={i} className="p-2 rounded bg-zinc-900 border border-zinc-700">
                              <p className="text-zinc-500 text-[10px]">
                                {new Date(g.at).toLocaleString('pt-BR')} · {g.model}
                              </p>
                              <p className="text-zinc-200 mt-1">{g.subject}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </Card>

              <div>
                <Label>Texto pro WhatsApp (opcional, manual)</Label>
                <Textarea
                  value={form.template_wa_text}
                  onChange={(e) => setForm({ ...form, template_wa_text: e.target.value })}
                  rows={3}
                  placeholder="Texto curto pro convite (WA Cloud API usa o template aprovado, isso é fallback)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Template Email</Label>
                  <Select
                    value={form.email_template_id ?? 'none'}
                    onValueChange={(v) => setForm({ ...form, email_template_id: v === 'none' ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Usar HTML gerado por áudio</SelectItem>
                      {emailTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Template WhatsApp (Meta aprovado)</Label>
                  <Select
                    value={form.wa_template_id ?? 'none'}
                    onValueChange={(v) => setForm({ ...form, wa_template_id: v === 'none' ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem WhatsApp</SelectItem>
                      {waTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.status ? `· ${t.status}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Lembretes */}
            <TabsContent value="reminders" className="space-y-4 mt-4">
              {(['d3', 'd1', 'h1'] as const).map((k) => {
                const labels = { d3: '3 dias antes', d1: '1 dia antes', h1: '1 hora antes' };
                return (
                  <Card key={k} className="p-4">
                    <h4 className="text-sm font-semibold mb-2">{labels[k]}</h4>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.reminders[k].email}
                          onCheckedChange={(c) => setForm({
                            ...form,
                            reminders: { ...form.reminders, [k]: { ...form.reminders[k], email: !!c } },
                          })}
                        />
                        Email
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.reminders[k].wa}
                          onCheckedChange={(c) => setForm({
                            ...form,
                            reminders: { ...form.reminders, [k]: { ...form.reminders[k], wa: !!c } },
                          })}
                        />
                        WhatsApp (Cloud API oficial)
                      </label>
                    </div>
                  </Card>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Lembretes só enviam via Cloud API oficial. Memória: fallback UAZAPI causou ban em 17/05/2026.
              </p>
            </TabsContent>
          </Tabs>

          {/* Resumo "o que vai acontecer ao criar" */}
          <Card className="p-4 mt-4 border-amber-500/30 bg-amber-500/5">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> O que vai acontecer ao criar
            </h4>
            <ul className="text-xs space-y-1 text-zinc-300">
              <li>
                {previewCount !== null
                  ? `→ ${previewCount} leads do segmento recebem convite imediato`
                  : '→ Os leads do segmento recebem convite imediato (clique em "Prever leads" na tab Segmento pra ver quantos)'}
              </li>
              <li>→ Cada lead recebe um link único {window.location.origin}/r/&lt;token&gt;</li>
              <li>→ Sala LiveKit pré-criada (auto-shard se passar de {form.max_per_room} pessoas)</li>
              {form.recording_enabled && <li>→ Gravação automática ligada</li>}
              {form.reminders.d3.email || form.reminders.d3.wa ? (
                <li>→ Lembrete D-3 ({[form.reminders.d3.email && 'email', form.reminders.d3.wa && 'WA'].filter(Boolean).join(' + ')})</li>
              ) : null}
              {form.reminders.d1.email || form.reminders.d1.wa ? (
                <li>→ Lembrete D-1 ({[form.reminders.d1.email && 'email', form.reminders.d1.wa && 'WA'].filter(Boolean).join(' + ')})</li>
              ) : null}
              {form.reminders.h1.email || form.reminders.h1.wa ? (
                <li>→ Lembrete H-1 ({[form.reminders.h1.email && 'email', form.reminders.h1.wa && 'WA'].filter(Boolean).join(' + ')})</li>
              ) : null}
              <li>→ Você acompanha tudo no painel /admin/marketing/eventos-coletivos</li>
            </ul>
            <p className="text-[11px] text-zinc-500 mt-3">
              Se ainda não definiu segmento ou conteúdo, use <strong>Salvar rascunho</strong> e volte depois.
            </p>
          </Card>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => handleSubmit('draft')} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar rascunho
            </Button>
            <Button onClick={() => handleSubmit('scheduled')} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar e disparar convites
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Biblioteca de templates salvos */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Biblioteca de templates
            </DialogTitle>
            <DialogDescription>
              Todos os templates que você já gerou ficam aqui. Favorite os bons, exclua o que não presta. Clique pra usar no evento atual.
            </DialogDescription>
          </DialogHeader>
          {library.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sua biblioteca está vazia. Gere um template com IA pra começar.
            </p>
          ) : (
            <div className="space-y-2">
              {library.map((tpl) => (
                <Card key={tpl.id} className="border-zinc-700">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{tpl.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(tpl.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                          {tpl.used_count > 0 && ` · usado ${tpl.used_count}x`}
                          {tpl.last_used_at && ` · último uso ${new Date(tpl.last_used_at).toLocaleDateString('pt-BR')}`}
                        </p>
                        {tpl.brief && (
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{tpl.brief}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleLibraryFavorite(tpl)}
                          className={`text-lg leading-none px-1 ${tpl.is_favorite ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                          aria-label="Favoritar"
                          title={tpl.is_favorite ? 'Desfavoritar' : 'Favoritar'}
                        >
                          ★
                        </button>
                        <Button size="sm" variant="outline" onClick={() => applyFromLibrary(tpl)}>
                          Usar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteLibraryTemplate(tpl)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          aria-label="Excluir"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                    {tpl.html_content && (
                      <details className="mt-2">
                        <summary className="text-[11px] cursor-pointer text-zinc-500 hover:text-zinc-300">
                          Pré-visualizar
                        </summary>
                        <iframe
                          title={`preview-${tpl.id}`}
                          srcDoc={tpl.html_content}
                          className="w-full h-64 bg-white border border-zinc-700 rounded mt-2"
                          sandbox=""
                        />
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AITemplateGenerator
        open={aiOpen}
        onOpenChange={setAiOpen}
        seedPrompt={(() => {
          if (!form.title) return '';
          const fmt = form.event_format === 'online'
            ? 'online, na sala + que Vencedores'
            : form.event_format === 'presencial'
              ? `presencial${form.venue_name ? `, no ${form.venue_name}` : ''}`
              : 'híbrido (online e presencial)';
          const data = form.scheduled_date
            ? new Date(`${form.scheduled_date}T${form.scheduled_time || '20:00'}:00`).toLocaleString('pt-BR', {
                day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
              })
            : '';
          return `Convite pra ${form.title}, evento ${fmt}, no dia ${data}.\n\nDescreva o tom da mensagem, sensação que quer passar, e o que o convidado vai aprender ou ganhar.`;
        })()}
        extraContext={[
          'Este email é um CONVITE pra evento coletivo + que Vencedores (Masterclass/Workshop/Aulão/Live).',
          'O sysprompt já tem todas as regras de marca, siga ele à risca.',
          `Dados específicos: título "${form.title}", data ${form.scheduled_date} às ${form.scheduled_time}, formato ${form.event_format}${form.venue_name ? ', local: ' + form.venue_name : ''}.`,
          'CTA principal deve ser "CONFIRMAR PRESENÇA" apontando pra {{link_evento}}.',
          form.whatsapp_group_url
            ? `Este evento TEM grupo exclusivo de WhatsApp. Inclua um SEGUNDO botão verde (#25D366) depois do CTA principal com texto "${form.whatsapp_group_label || 'Entrar no Grupo Exclusivo'}" apontando pra {{link_grupo_whatsapp}}. Faça um parágrafo curto antes desse botão explicando que o grupo é só pra confirmados.`
            : '',
        ].filter(Boolean).join('\n')}
        onResult={(data) => {
          const generation = {
            at: new Date().toISOString(),
            model: 'gemini',
            brief: data.brief ?? '',
            subject: data.subject,
            html_excerpt: (data.html_content || '').slice(0, 600),
          };
          const wa = data.html_content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 800);
          setForm((f) => ({
            ...f,
            template_subject: data.subject,
            template_html: data.html_content,
            template_brief: data.brief ?? f.template_brief,
            template_preheader: data.preheader ?? f.template_preheader,
            template_wa_text: f.template_wa_text || wa,
            template_generations: [...(f.template_generations || []), generation],
          }));
          // Salva automaticamente na biblioteca permanente
          saveToLibrary({
            subject: data.subject,
            preheader: data.preheader,
            html_content: data.html_content,
            wa_text: wa,
            brief: data.brief,
          }).then((id) => {
            if (id) toast.success('Template salvo na biblioteca pra reusar depois', { duration: 4000 });
          });
        }}
      />
    </>
  );
}
