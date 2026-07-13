/**
 * AdminPortaria — Modo Portaria (mobile)
 *
 * /admin/credenciar/:eventId
 *
 * Página pensada pro celular do time fazer credenciamento na porta:
 *  - leitor de QR pela câmera (lê CK:<codigo> e dá check-in instantâneo)
 *  - busca por nome/WhatsApp + botão grande "Credenciar"
 *  - adicionar cortesia ou venda na hora, já credenciando
 *
 * Tudo via event_attendees + RPCs (checkin_by_code, toggle_event_checkin).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft, Search, ScanLine, X, CheckCircle2, Loader2, UserPlus,
  Gift, ShoppingCart, Users, DollarSign, Copy, ExternalLink,
} from 'lucide-react';
import { generateAttendeeCharge } from '@/lib/eventCharge';

const PRODUCTS = ['MentorIA', 'Método + que Vencedores', 'Enterprise', 'Treinamento + que Vencedores', 'Masterclass IA'];
const METHODS = [{ v: 'pix', l: 'PIX' }, { v: 'credit_card', l: 'Crédito' }, { v: 'debit_card', l: 'Débito' }, { v: 'dinheiro', l: 'Dinheiro' }, { v: 'boleto', l: 'Boleto' }];

interface Attendee {
  id: string; name: string; whatsapp: string | null; email: string | null;
  cpf: string | null; amount: number | null;
  origin: string; product: string | null; payment_status: string;
  instagram_profile_pic_url: string | null; checked_in_at: string | null;
  tickets_total: number; tickets_checked_in: number;
}

export default function AdminPortaria() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [eventTitle, setEventTitle] = useState('');
  const [rows, setRows] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'already' | 'fail'; text: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [chargeFor, setChargeFor] = useState<Attendee | null>(null);

  async function load() {
    if (!eventId) return;
    const [{ data: ev }, { data }] = await Promise.all([
      (supabase as any).from('collective_events').select('title').eq('id', eventId).maybeSingle(),
      (supabase as any).from('event_attendees').select('id,name,whatsapp,email,cpf,amount,origin,product,payment_status,instagram_profile_pic_url,checked_in_at,tickets_total,tickets_checked_in')
        .eq('event_id', eventId).order('checked_in_at', { ascending: false, nullsFirst: false }).order('name'),
    ]);
    setEventTitle(ev?.title ?? 'Evento');
    setRows((data as Attendee[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId]);

  const stats = useMemo(() => ({
    total: rows.reduce((s, r) => s + (r.tickets_total || 1), 0),
    checked: rows.reduce((s, r) => s + (r.tickets_checked_in || 0), 0),
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows.slice(0, 40);
    const d = q.replace(/\D/g, '');
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) || (d && (r.whatsapp ?? '').includes(d)) || (r.email ?? '').toLowerCase().includes(q),
    ).slice(0, 40);
  }, [rows, search]);

  async function credenciar(a: Attendee) {
    if (a.checked_in_at) return;
    setBusyId(a.id);
    const { data, error } = await (supabase.rpc as any)('toggle_event_checkin', { p_attendee_id: a.id, p_checked: true });
    setBusyId(null);
    if (error || !(data as any)?.ok) { toast.error('Falhou, tenta de novo'); return; }
    const d = data as any;
    setRows((prev) => prev.map((r) => r.id === a.id ? { ...r, checked_in_at: d.checked_in_at, tickets_checked_in: d.tickets_checked_in ?? r.tickets_checked_in } : r));
    showFlash('ok', `${a.name} credenciado`);
  }

  async function adjustTicket(a: Attendee, delta: number) {
    setBusyId(a.id);
    const { data, error } = await (supabase.rpc as any)('adjust_event_checkin', { p_attendee_id: a.id, p_delta: delta });
    setBusyId(null);
    if (error || !(data as any)?.ok) { toast.error('Falhou, tenta de novo'); return; }
    const d = data as any;
    setRows((prev) => prev.map((r) => r.id === a.id
      ? { ...r, tickets_checked_in: d.tickets_checked_in, checked_in_at: d.tickets_checked_in > 0 ? (r.checked_in_at ?? new Date().toISOString()) : null }
      : r));
    if (delta > 0) showFlash('ok', `${a.name.split(' ')[0]}: ${d.tickets_checked_in}/${d.tickets_total} entraram`);
  }

  function showFlash(kind: 'ok' | 'already' | 'fail', text: string) {
    setFlash({ kind, text });
    if (navigator.vibrate) navigator.vibrate(kind === 'ok' ? 120 : 60);
    setTimeout(() => setFlash(null), 2200);
  }

  // ---- Scanner QR (html5-qrcode, import dinamico) ----
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  async function onDecode(decoded: string) {
    const code = decoded.replace(/^CK:/i, '').trim();
    const now = Date.now();
    // debounce: ignora o mesmo QR lido em sequencia
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < 3500) return;
    lastScanRef.current = { code, at: now };
    const { data, error } = await (supabase.rpc as any)('checkin_by_code', { p_event_id: eventId, p_code: code });
    if (error || !(data as any)?.ok) { showFlash('fail', 'QR não confere com este evento'); return; }
    const r = data as any;
    const tk = (r.tickets_total ?? 1) > 1 ? ` (${r.tickets_checked_in}/${r.tickets_total})` : '';
    showFlash(r.already ? 'already' : 'ok', r.already ? `${r.name} já completou${tk}` : `${r.name} credenciado${tk}`);
    load();
  }

  // Usa Html5QrcodeScanner (UI completa com botao de permissao + seletor de camera).
  // Inicia em useEffect, depois que a <div id="qr-reader"> ja existe no DOM.
  useEffect(() => {
    if (!scanning) return;
    setScanError(null);
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setScanError('A câmera só funciona em HTTPS. Abra pelo endereço squaad.com.br no celular, não pelo IP local.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new mod.Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 240, height: 240 }, rememberLastUsedCamera: true, aspectRatio: 1.0,
            supportedScanTypes: [mod.Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
          false,
        );
        scannerRef.current = scanner;
        scanner.render(
          (decoded: string) => onDecode(decoded),
          () => {},
        );
      } catch (e: any) {
        if (!cancelled) setScanError(e?.message ?? String(e));
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) { try { s.clear(); } catch { /* */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* topo fixo */}
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/admin/credenciamento')} className="p-1.5 -ml-1.5 text-zinc-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{eventTitle}</p>
            <p className="text-[11px] text-zinc-500">Modo portaria</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-400 leading-none tabular-nums">{stats.checked}<span className="text-zinc-600 text-sm">/{stats.total}</span></p>
            <p className="text-[10px] text-zinc-500 uppercase">credenciados</p>
          </div>
        </div>
      </div>

      {/* flash de feedback grande */}
      {flash && (
        <div className={`mx-4 mt-3 rounded-xl px-4 py-3 text-center font-semibold ${
          flash.kind === 'ok' ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-200'
          : flash.kind === 'already' ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200'
          : 'bg-red-500/15 border border-red-500/40 text-red-200'}`}>
          {flash.text}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* acoes */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setScanning((s) => !s)} className={scanning ? 'bg-red-500 text-white hover:bg-red-600 h-12' : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 h-12'}>
            {scanning ? <><X className="w-4 h-4 mr-1.5" /> Parar câmera</> : <><ScanLine className="w-4 h-4 mr-1.5" /> Escanear QR</>}
          </Button>
          <Button variant="outline" onClick={() => setAddOpen(true)} className="h-12">
            <UserPlus className="w-4 h-4 mr-1.5" /> Adicionar
          </Button>
        </div>

        {/* area da camera */}
        {scanning && (
          <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black">
            {scanError ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-sm text-red-300 font-medium">Não consegui abrir a câmera</p>
                <p className="text-xs text-zinc-400 break-words">{scanError}</p>
                <p className="text-[11px] text-zinc-500">
                  Dica: use o site pelo HTTPS (squaad.com.br) e toque em permitir a câmera. Você ainda pode credenciar pela busca por nome abaixo.
                </p>
              </div>
            ) : (
              <>
                <div id="qr-reader" className="w-full [&_img]:hidden [&_button]:!bg-amber-500 [&_button]:!text-zinc-950 [&_button]:!border-0 [&_select]:!text-zinc-900 [&_video]:!rounded-lg" />
                <p className="text-[11px] text-zinc-500 text-center py-2">Aponte pro QR do participante</p>
              </>
            )}
          </div>
        )}

        {/* busca */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome ou WhatsApp..." className="pl-9 h-12 text-base" />
        </div>

        {/* lista */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-8">
            {search ? 'Ninguém bate com a busca.' : 'Lista vazia.'}
          </p>
        ) : (
          <div className="space-y-2 pb-20">
            {filtered.map((a) => {
              const total = a.tickets_total || 1;
              const inCount = a.tickets_checked_in || 0;
              const full = inCount >= total;
              const checked = total <= 1 ? !!a.checked_in_at : full;
              return (
                <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${checked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
                  <div className="w-11 h-11 rounded-full bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {a.instagram_profile_pic_url
                      ? <img src={a.instagram_profile_pic_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="text-base font-semibold text-zinc-400">{a.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium truncate">
                      {a.name}
                      {total > 1 && (
                        <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded border align-middle ${full ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                          {inCount}/{total} ingressos
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {a.origin === 'compra' ? 'Comprou' : a.origin === 'cortesia' ? 'Cortesia' : a.origin === 'auto' ? 'Auto-cadastro' : 'Manual'}
                      {a.product ? ` · ${a.product}` : ''}{a.whatsapp ? ` · ${a.whatsapp}` : ''}
                    </p>
                  </div>
                  {a.payment_status !== 'paid' && (
                    <Button onClick={() => setChargeFor(a)} variant="outline" title="Cobrar (Asaas)"
                      className="border-amber-500/40 text-amber-300 h-11 w-11 p-0 shrink-0">
                      <DollarSign className="w-5 h-5" />
                    </Button>
                  )}
                  {total > 1 ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" disabled={busyId === a.id || inCount <= 0} onClick={() => adjustTicket(a, -1)} className="h-11 w-10 p-0 text-lg">−</Button>
                      <span className={`text-base font-bold tabular-nums w-12 text-center ${full ? 'text-emerald-400' : 'text-zinc-100'}`}>{inCount}/{total}</span>
                      <Button disabled={busyId === a.id || full} onClick={() => adjustTicket(a, 1)} className="h-11 w-10 p-0 text-lg bg-emerald-500 text-zinc-950 hover:bg-emerald-400">+</Button>
                    </div>
                  ) : checked ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-sm font-medium px-2">
                      <CheckCircle2 className="w-5 h-5" /> OK
                    </span>
                  ) : (
                    <Button onClick={() => credenciar(a)} disabled={busyId === a.id} className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400 h-11 px-4">
                      {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Credenciar'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {addOpen && (
        <QuickAdd eventId={eventId!} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} onFlash={showFlash} />
      )}

      {chargeFor && (
        <ChargeSheet attendee={chargeFor} onClose={() => setChargeFor(null)} onDone={() => load()} />
      )}
    </div>
  );
}

// Cobranca Asaas na fila (bottom sheet mobile)
function ChargeSheet({ attendee, onClose, onDone }: { attendee: Attendee; onClose: () => void; onDone: () => void }) {
  const [product, setProduct] = useState(attendee.product && PRODUCTS.includes(attendee.product) ? attendee.product : PRODUCTS[0]);
  const [amount, setAmount] = useState(attendee.amount != null ? String(attendee.amount) : '');
  const [billing, setBilling] = useState<'UNDEFINED' | 'PIX' | 'CREDIT_CARD' | 'BOLETO'>('UNDEFINED');
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const noCpf = !attendee.cpf;

  async function generate() {
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) { toast.error('Informe o valor'); return; }
    setLoading(true);
    const r = await generateAttendeeCharge(attendee.id, product, value, billing);
    setLoading(false);
    if (!r.ok) { toast.error(r.error ?? 'Falha ao gerar cobrança', { duration: 7000 }); return; }
    setUrl(r.url!);
    toast.success('Cobrança gerada');
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full bg-zinc-950 border-t border-zinc-800 rounded-t-2xl p-4 space-y-3 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-400" /> Cobrar {attendee.name.split(' ')[0]}</h3>
          <button onClick={onClose} className="p-1 text-zinc-400"><X className="w-5 h-5" /></button>
        </div>

        {url ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
              <p className="text-xs text-emerald-300 mb-1">Link de pagamento:</p>
              <p className="text-xs font-mono text-zinc-200 break-all">{url}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-11" onClick={() => { navigator.clipboard.writeText(url); toast.success('Copiado'); }}>
                <Copy className="w-4 h-4" />
              </Button>
              {attendee.whatsapp && (
                <a href={`https://wa.me/${attendee.whatsapp}?text=${encodeURIComponent('Segue o link pra pagamento: ' + url)}`} target="_blank" rel="noopener noreferrer">
                  <Button className="h-11 w-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400">WhatsApp</Button>
                </a>
              )}
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button className="h-11 w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"><ExternalLink className="w-4 h-4" /></Button>
              </a>
            </div>
            <Button onClick={onClose} className="w-full h-11">Concluir</Button>
          </div>
        ) : (
          <>
            {noCpf && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 px-3 py-2 text-xs">
                Sem CPF. O Asaas exige CPF: adicione no inscrito antes de cobrar.
              </div>
            )}
            <select value={product} onChange={(e) => setProduct(e.target.value)} className="w-full h-12 rounded-md bg-zinc-900 border border-zinc-800 px-3 text-base">
              {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor R$" className="h-12 text-base" inputMode="decimal" />
              <select value={billing} onChange={(e) => setBilling(e.target.value as any)} className="h-12 rounded-md bg-zinc-900 border border-zinc-800 px-3 text-base">
                <option value="UNDEFINED">Cliente escolhe</option>
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartão</option>
                <option value="BOLETO">Boleto</option>
              </select>
            </div>
            <Button onClick={generate} disabled={loading || noCpf} className="w-full h-12 bg-amber-500 text-zinc-950 hover:bg-amber-400">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gerar cobrança'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Adicionar cortesia / venda na hora, já credenciando (bottom sheet)
function QuickAdd({
  eventId, onClose, onAdded, onFlash,
}: { eventId: string; onClose: () => void; onAdded: () => void; onFlash: (k: 'ok' | 'already' | 'fail', t: string) => void }) {
  const [kind, setKind] = useState<'cortesia' | 'venda'>('cortesia');
  const [f, setF] = useState({ name: '', whatsapp: '', cpf: '', product: PRODUCTS[0], amount: '', method: 'pix' });
  const [credenciarJa, setCredenciarJa] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim()) { toast.error('Informe o nome'); return; }
    setSaving(true);
    const phone = f.whatsapp.replace(/\D/g, '');
    const row: any = {
      event_id: eventId, name: f.name.trim(),
      whatsapp: phone ? (phone.startsWith('55') ? phone : '55' + phone) : null,
      cpf: f.cpf.replace(/\D/g, '') || null,
      origin: kind === 'cortesia' ? 'cortesia' : 'manual',
      payment_status: kind === 'cortesia' ? 'courtesy' : 'paid',
    };
    if (kind === 'venda') { row.product = f.product; row.amount = f.amount ? Number(f.amount.replace(',', '.')) : null; row.payment_method = f.method; }
    if (credenciarJa) row.checked_in_at = new Date().toISOString();
    const { error } = await (supabase as any).from('event_attendees').insert(row);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Já tem alguém com esse WhatsApp' : error.message);
      return;
    }
    onFlash('ok', `${f.name.split(' ')[0]} ${kind === 'cortesia' ? '(cortesia)' : '(venda)'}${credenciarJa ? ' credenciado' : ' adicionado'}`);
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full bg-zinc-950 border-t border-zinc-800 rounded-t-2xl p-4 space-y-3 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Adicionar na hora</h3>
          <button onClick={onClose} className="p-1 text-zinc-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setKind('cortesia')} className={`flex-1 py-2.5 rounded-lg text-sm border ${kind === 'cortesia' ? 'border-purple-500/50 bg-purple-500/10 text-purple-200' : 'border-zinc-800 text-zinc-400'}`}>
            <Gift className="w-4 h-4 inline mr-1.5" /> Cortesia
          </button>
          <button onClick={() => setKind('venda')} className={`flex-1 py-2.5 rounded-lg text-sm border ${kind === 'venda' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-zinc-800 text-zinc-400'}`}>
            <ShoppingCart className="w-4 h-4 inline mr-1.5" /> Pago na hora
          </button>
        </div>

        <Input value={f.name} onChange={set('name')} placeholder="Nome completo *" className="h-12 text-base" autoFocus />
        <Input value={f.whatsapp} onChange={set('whatsapp')} placeholder="WhatsApp" className="h-12 text-base" inputMode="tel" />
        {kind === 'venda' && (
          <>
            <Input value={f.cpf} onChange={set('cpf')} placeholder="CPF (pra nota/cobrança)" className="h-12 text-base" inputMode="numeric" />
            <select value={f.product} onChange={(e) => setF((p) => ({ ...p, product: e.target.value }))} className="w-full h-12 rounded-md bg-zinc-900 border border-zinc-800 px-3 text-base">
              {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input value={f.amount} onChange={set('amount')} placeholder="Valor R$" className="h-12 text-base" inputMode="decimal" />
              <select value={f.method} onChange={(e) => setF((p) => ({ ...p, method: e.target.value }))} className="h-12 rounded-md bg-zinc-900 border border-zinc-800 px-3 text-base">
                {METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          </>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-300 py-1">
          <input type="checkbox" checked={credenciarJa} onChange={(e) => setCredenciarJa(e.target.checked)} className="w-4 h-4" />
          Já credenciar (marcar presença agora)
        </label>

        <Button onClick={save} disabled={saving} className="w-full h-12 bg-amber-500 text-zinc-950 hover:bg-amber-400">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : kind === 'cortesia' ? 'Adicionar cortesia' : 'Registrar venda'}
        </Button>
      </div>
    </div>
  );
}
