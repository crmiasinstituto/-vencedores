/**
 * EventAttendeesPanel
 *
 * Aba "Inscritos / Credenciamento" de um Evento Coletivo.
 * Une numa lista so: compradores (Kirvano/Asaas), cortesias, auto-cadastros (QR)
 * e adicoes manuais. Faz credenciamento rapido (busca + 1 toque), mostra o QR
 * publico de auto-cadastro do evento e registra vendas na hora.
 *
 * Tudo via tabela event_attendees + RPCs (import_event_buyers, toggle_event_checkin).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, Search, Copy, QrCode, UserPlus, Download, CheckCircle2,
  Loader2, ShoppingCart, Gift, Smartphone, Hand, Instagram, DollarSign, ExternalLink, Tags,
} from 'lucide-react';
import { generateAttendeeCharge } from '@/lib/eventCharge';

const PRODUCTS = ['MentorIA', 'Método + que Vencedores', 'Enterprise', 'Treinamento + que Vencedores', 'Masterclass IA'];
const PAYMENT_METHODS = [
  { v: 'pix', l: 'PIX' }, { v: 'credit_card', l: 'Cartão crédito' },
  { v: 'debit_card', l: 'Cartão débito' }, { v: 'boleto', l: 'Boleto' },
  { v: 'dinheiro', l: 'Dinheiro' },
];

interface Attendee {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  instagram: string | null;
  instagram_profile_pic_url: string | null;
  origin: 'compra' | 'cortesia' | 'auto' | 'manual';
  product: string | null;
  amount: number | null;
  payment_method: string | null;
  payment_status: 'paid' | 'pending' | 'courtesy' | 'free' | 'refunded';
  checkin_code: string;
  checked_in_at: string | null;
  tickets_total: number;
  tickets_checked_in: number;
  created_at: string;
}

function originBadge(origin: Attendee['origin']) {
  switch (origin) {
    case 'compra': return { icon: <ShoppingCart className="w-3 h-3" />, label: 'Comprou', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    case 'cortesia': return { icon: <Gift className="w-3 h-3" />, label: 'Cortesia', cls: 'bg-purple-500/10 text-purple-300 border-purple-500/30' };
    case 'auto': return { icon: <Smartphone className="w-3 h-3" />, label: 'Auto-cadastro', cls: 'bg-blue-500/10 text-blue-300 border-blue-500/30' };
    default: return { icon: <Hand className="w-3 h-3" />, label: 'Manual', cls: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30' };
  }
}

export default function EventAttendeesPanel({ eventId, signupToken }: { eventId: string; signupToken: string | null }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncingCrm, setSyncingCrm] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [chargeFor, setChargeFor] = useState<Attendee | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://squaad.com.br';
  const signupUrl = signupToken ? `${origin}/inscricao/${signupToken}` : '';

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('event_attendees')
      .select('*')
      .eq('event_id', eventId)
      .order('checked_in_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    setRows((data as Attendee[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const ingressos = rows.reduce((s, r) => s + (r.tickets_total || 1), 0);
    const credenciados = rows.reduce((s, r) => s + (r.tickets_checked_in || 0), 0);
    const compradores = rows.filter((r) => r.origin === 'compra').length;
    return { total, ingressos, credenciados, compradores };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    const digits = q.replace(/\D/g, '');
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (digits && (r.whatsapp ?? '').includes(digits)) ||
      (r.email ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function toggleCheckin(a: Attendee) {
    setBusyId(a.id);
    const next = !a.checked_in_at;
    const { data, error } = await (supabase.rpc as any)('toggle_event_checkin', {
      p_attendee_id: a.id, p_checked: next,
    });
    setBusyId(null);
    if (error || !(data as any)?.ok) { toast.error('Não consegui atualizar o credenciamento'); return; }
    const d = data as any;
    setRows((prev) => prev.map((r) => r.id === a.id ? { ...r, checked_in_at: d.checked_in_at, tickets_checked_in: d.tickets_checked_in ?? r.tickets_checked_in } : r));
    toast.success(next ? `${a.name.split(' ')[0]} credenciado` : 'Credenciamento desfeito');
  }

  async function adjustCheckin(a: Attendee, delta: number) {
    setBusyId(a.id);
    const { data, error } = await (supabase.rpc as any)('adjust_event_checkin', { p_attendee_id: a.id, p_delta: delta });
    setBusyId(null);
    if (error || !(data as any)?.ok) { toast.error('Não consegui atualizar'); return; }
    const d = data as any;
    setRows((prev) => prev.map((r) => r.id === a.id
      ? { ...r, tickets_checked_in: d.tickets_checked_in, checked_in_at: d.tickets_checked_in > 0 ? (r.checked_in_at ?? new Date().toISOString()) : null }
      : r));
  }

  async function importBuyers() {
    setImporting(true);
    // puxa compradores (Kirvano) E quem confirmou presenca pelo link da campanha
    const [buyers, invites] = await Promise.all([
      (supabase.rpc as any)('import_event_buyers', { p_event_id: eventId, p_board_slug: 'masterclass-ia' }),
      (supabase.rpc as any)('import_event_confirmed_invites', { p_event_id: eventId }),
    ]);
    setImporting(false);
    if (buyers.error && invites.error) { toast.error(`Sincronização falhou: ${buyers.error.message}`); return; }
    const b = buyers.data ?? 0, i = invites.data ?? 0;
    toast.success(`${b} compradores e ${i} confirmados pelo link sincronizados`);
    load();
  }

  function openLead(a: Attendee) {
    if (a.crm_lead_id) navigate(`/admin/crm?openLead=${a.crm_lead_id}`);
  }

  async function syncToCrm() {
    setSyncingCrm(true);
    const { data, error } = await (supabase.rpc as any)('sync_event_attendees_to_crm', {
      p_event_id: eventId, p_board_slug: 'masterclass-ia',
    });
    setSyncingCrm(false);
    if (error || !(data as any)?.ok) { toast.error(`Falhou: ${error?.message ?? (data as any)?.error}`); return; }
    const d = data as any;
    toast.success(`${d.created} novos leads no CRM, ${d.linked} vinculados, ${d.tagged} com tag "${d.event_tag}" + Credenciado`, { duration: 9000 });
    load();
  }

  function exportCsv() {
    const header = ['Nome', 'WhatsApp', 'Email', 'CPF', 'Instagram', 'Origem', 'Produto', 'Valor', 'Pagamento', 'Status', 'Credenciado em'];
    const lines = rows.map((r) => [
      r.name, r.whatsapp ?? '', r.email ?? '', r.cpf ?? '', r.instagram ?? '',
      r.origin, r.product ?? '', r.amount ?? '', r.payment_method ?? '', r.payment_status,
      r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('pt-BR') : '',
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `inscritos-${eventId.slice(0, 8)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Header + acoes */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" /> Inscritos / Credenciamento
          </h2>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setQrOpen(true)} disabled={!signupUrl}>
              <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR de inscrição
            </Button>
            <Button size="sm" variant="outline" onClick={importBuyers} disabled={importing}>
              {importing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />}
              Sincronizar
            </Button>
            <Button size="sm" variant="outline" onClick={syncToCrm} disabled={syncingCrm}
              className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
              {syncingCrm ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Tags className="w-3.5 h-3.5 mr-1.5" />}
              Mapear no CRM
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Adicionar
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Inscritos" value={stats.total} />
          <Stat label="Ingressos" value={stats.ingressos} />
          <Stat label="Credenciados" value={stats.credenciados} accent />
          <Stat label="Compradores" value={stats.compradores} />
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou e-mail para credenciar..."
            className="pl-9"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {rows.length === 0
              ? 'Nenhum inscrito ainda. Use "Importar compradores" pra puxar quem comprou, ou compartilhe o QR de inscrição.'
              : 'Nenhum inscrito bate com a busca.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => {
              const ob = originBadge(a.origin);
              const total = a.tickets_total || 1;
              const inCount = a.tickets_checked_in || 0;
              const full = inCount >= total;
              const checked = total <= 1 ? !!a.checked_in_at : full;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${checked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900'}`}
                >
                  {/* avatar (clica abre o lead) */}
                  <button
                    type="button"
                    onClick={() => openLead(a)}
                    disabled={!a.crm_lead_id}
                    title={a.crm_lead_id ? 'Abrir no CRM' : undefined}
                    className={`w-10 h-10 rounded-full bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center ${a.crm_lead_id ? 'cursor-pointer hover:ring-2 hover:ring-amber-500/50' : ''}`}
                  >
                    {a.instagram_profile_pic_url
                      ? <img src={a.instagram_profile_pic_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="text-sm font-semibold text-zinc-400">{a.name.charAt(0).toUpperCase()}</span>}
                  </button>

                  {/* dados */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openLead(a)}
                        disabled={!a.crm_lead_id}
                        className={`text-sm font-medium truncate text-left ${a.crm_lead_id ? 'hover:text-amber-300 hover:underline cursor-pointer' : 'cursor-default'}`}
                      >
                        {a.name}
                      </button>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${ob.cls}`}>
                        {ob.icon} {ob.label}
                      </span>
                      {a.product && <Badge variant="outline" className="text-[10px]">{a.product}</Badge>}
                      {a.payment_status === 'paid' && a.amount != null && (
                        <span className="text-[10px] text-emerald-400">R$ {Number(a.amount).toFixed(2)}</span>
                      )}
                      {total > 1 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${full ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                          {inCount}/{total} entraram
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {[a.whatsapp, a.email, a.instagram ? '@' + a.instagram : null].filter(Boolean).join(' · ') || 'sem contato'}
                    </p>
                  </div>

                  {/* cobrar (Asaas) pra quem nao esta pago */}
                  {a.payment_status !== 'paid' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChargeFor(a)}
                      title="Gerar cobrança Asaas"
                      className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {/* credenciar: stepper pra multi-ingresso, botao simples pra 1 */}
                  {total > 1 ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" disabled={busyId === a.id || inCount <= 0}
                        onClick={() => adjustCheckin(a, -1)} className="h-8 w-8 p-0">−</Button>
                      <span className={`text-sm font-bold tabular-nums w-10 text-center ${full ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {inCount}/{total}
                      </span>
                      <Button size="sm" disabled={busyId === a.id || full}
                        onClick={() => adjustCheckin(a, 1)}
                        className="h-8 w-8 p-0 bg-emerald-500 text-zinc-950 hover:bg-emerald-400">+</Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={checked ? 'outline' : 'default'}
                      onClick={() => toggleCheckin(a)}
                      disabled={busyId === a.id}
                      className={checked ? 'border-emerald-500/40 text-emerald-300' : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'}
                    >
                      {busyId === a.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : checked
                          ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Credenciado</>
                          : 'Credenciar'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* QR publico de inscricao */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center"><QrCode className="w-4 h-4" /> QR de auto-cadastro</DialogTitle>
            <DialogDescription>
              Projete ou imprima. Quem escaneia preenche os dados e cai na lista automaticamente.
            </DialogDescription>
          </DialogHeader>
          {signupUrl && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(signupUrl)}`}
                  alt="QR de inscrição" width={240} height={240}
                />
              </div>
              <p className="text-xs font-mono text-zinc-400 break-all">{signupUrl}</p>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(signupUrl); toast.success('Link copiado'); }}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adicionar cortesia/manual + registrar venda */}
      <AddAttendeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={eventId}
        onSaved={() => { setAddOpen(false); load(); }}
      />

      <ChargeDialog
        attendee={chargeFor}
        onClose={() => setChargeFor(null)}
        onPaidLinkGenerated={() => load()}
      />
    </Card>
  );
}

function ChargeDialog({
  attendee, onClose, onPaidLinkGenerated,
}: { attendee: Attendee | null; onClose: () => void; onPaidLinkGenerated: () => void }) {
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [amount, setAmount] = useState('');
  const [billing, setBilling] = useState<'UNDEFINED' | 'PIX' | 'CREDIT_CARD' | 'BOLETO'>('UNDEFINED');
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (attendee) {
      setProduct(attendee.product && PRODUCTS.includes(attendee.product) ? attendee.product : PRODUCTS[0]);
      setAmount(attendee.amount != null ? String(attendee.amount) : '');
      setBilling('UNDEFINED');
      setUrl(null);
    }
  }, [attendee]);

  async function generate() {
    if (!attendee) return;
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) { toast.error('Informe o valor'); return; }
    setLoading(true);
    const r = await generateAttendeeCharge(attendee.id, product, value, billing);
    setLoading(false);
    if (!r.ok) { toast.error(r.error ?? 'Falha ao gerar cobrança'); return; }
    setUrl(r.url!);
    toast.success('Cobrança gerada no Asaas');
    onPaidLinkGenerated();
  }

  return (
    <Dialog open={!!attendee} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-400" /> Gerar cobrança Asaas</DialogTitle>
          <DialogDescription>{attendee?.name} · gera PIX/cartão/boleto. Quando pagar, o inscrito vira "pago" sozinho.</DialogDescription>
        </DialogHeader>

        {!url ? (
          <div className="space-y-3">
            {!attendee?.cpf && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 px-3 py-2 text-xs">
                Esse inscrito não tem CPF. O Asaas exige CPF: edite o inscrito e adicione antes de cobrar.
              </div>
            )}
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Produto</Label>
              <select value={product} onChange={(e) => setProduct(e.target.value)} className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm">
                {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Valor (R$)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Forma</Label>
                <select value={billing} onChange={(e) => setBilling(e.target.value as any)} className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm">
                  <option value="UNDEFINED">Cliente escolhe</option>
                  <option value="PIX">PIX</option>
                  <option value="CREDIT_CARD">Cartão</option>
                  <option value="BOLETO">Boleto</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
              <p className="text-xs text-emerald-300 mb-1">Link de pagamento Asaas:</p>
              <p className="text-xs font-mono text-zinc-200 break-all">{url}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copiado'); }}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
              </Button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button size="sm" className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir
                </Button>
              </a>
            </div>
          </div>
        )}

        <DialogFooter>
          {!url ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button onClick={generate} disabled={loading || !attendee?.cpf}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                Gerar cobrança
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-emerald-400' : ''}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function AddAttendeeDialog({
  open, onOpenChange, eventId, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; eventId: string; onSaved: () => void }) {
  const [kind, setKind] = useState<'cortesia' | 'venda'>('cortesia');
  const [f, setF] = useState({ name: '', whatsapp: '', email: '', cpf: '', instagram: '', product: PRODUCTS[0], amount: '', method: 'pix', paid: true });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim()) { toast.error('Informe o nome'); return; }
    setSaving(true);
    const phone = f.whatsapp.replace(/\D/g, '');
    const row: any = {
      event_id: eventId,
      name: f.name.trim(),
      whatsapp: phone ? (phone.startsWith('55') ? phone : '55' + phone) : null,
      email: f.email.trim() || null,
      cpf: f.cpf.replace(/\D/g, '') || null,
      instagram: f.instagram.replace('@', '').trim() || null,
      origin: kind === 'cortesia' ? 'cortesia' : 'manual',
      payment_status: kind === 'cortesia' ? 'courtesy' : (f.paid ? 'paid' : 'pending'),
    };
    if (kind === 'venda') {
      row.product = f.product;
      row.amount = f.amount ? Number(f.amount.replace(',', '.')) : null;
      row.payment_method = f.method;
    }
    const { error } = await (supabase as any).from('event_attendees').insert(row);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Já existe um inscrito com esse WhatsApp' : `Erro: ${error.message}`);
      return;
    }
    toast.success(kind === 'cortesia' ? 'Cortesia adicionada' : 'Venda registrada');
    setF({ name: '', whatsapp: '', email: '', cpf: '', instagram: '', product: PRODUCTS[0], amount: '', method: 'pix', paid: true });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Adicionar inscrito</DialogTitle>
          <DialogDescription>Cortesia (convidado sem pagar) ou venda registrada na hora.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <button type="button" onClick={() => setKind('cortesia')}
            className={`flex-1 py-2 rounded-lg text-sm border ${kind === 'cortesia' ? 'border-purple-500/50 bg-purple-500/10 text-purple-200' : 'border-zinc-800 text-zinc-400'}`}>
            <Gift className="w-3.5 h-3.5 inline mr-1.5" /> Cortesia
          </button>
          <button type="button" onClick={() => setKind('venda')}
            className={`flex-1 py-2 rounded-lg text-sm border ${kind === 'venda' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-zinc-800 text-zinc-400'}`}>
            <ShoppingCart className="w-3.5 h-3.5 inline mr-1.5" /> Venda
          </button>
        </div>

        <div className="space-y-3">
          <Row label="Nome *"><Input value={f.name} onChange={set('name')} placeholder="Nome completo" /></Row>
          <Row label="WhatsApp"><Input value={f.whatsapp} onChange={set('whatsapp')} placeholder="(11) 99999-9999" /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="E-mail"><Input value={f.email} onChange={set('email')} placeholder="email" /></Row>
            <Row label="CPF"><Input value={f.cpf} onChange={set('cpf')} placeholder="só números" /></Row>
          </div>
          <Row label="Instagram"><Input value={f.instagram} onChange={set('instagram')} placeholder="@usuario" /></Row>

          {kind === 'venda' && (
            <div className="space-y-3 pt-1 border-t border-zinc-800">
              <Row label="Produto">
                <select value={f.product} onChange={(e) => setF((p) => ({ ...p, product: e.target.value }))}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm">
                  {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Row>
              <div className="grid grid-cols-2 gap-3">
                <Row label="Valor (R$)"><Input value={f.amount} onChange={set('amount')} placeholder="0,00" inputMode="decimal" /></Row>
                <Row label="Forma de pagamento">
                  <select value={f.method} onChange={(e) => setF((p) => ({ ...p, method: e.target.value }))}
                    className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm">
                    {PAYMENT_METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                </Row>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={f.paid} onChange={(e) => setF((p) => ({ ...p, paid: e.target.checked }))} />
                Pagamento já aprovado
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {kind === 'cortesia' ? 'Adicionar cortesia' : 'Registrar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-zinc-400 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
