import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hashPassword } from '@/lib/memberCrypto';
import {
  User, Mail, Phone, Briefcase, Cake, Save, Loader2, KeyRound, Camera,
  Users, Crown, Shield, Trophy, Zap, Flame, Send, Copy, ExternalLink, Trash2,
  RefreshCw, CheckCircle2, IdCard,
} from 'lucide-react';

function formatCpfCnpj(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return d;
}

const db = supabase as any;

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}

interface Props {
  member: any;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'filho', label: 'Filho(a)' },
  { value: 'conjuge', label: 'Conjuge' },
  { value: 'socio', label: 'Socio(a)' },
  { value: 'funcionario', label: 'Funcionario(a)' },
  { value: 'gestor', label: 'Gestor(a) do time' },
  { value: 'parente', label: 'Parente' },
  { value: 'outro', label: 'Outro' },
];

export default function MemberEditDialog({ member, open, onClose, onUpdated }: Props) {
  const [form, setForm] = useState<any>(null);
  const [contratante, setContratante] = useState<any>(null);
  const [prepostos, setPrepostos] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !member) return;
    setForm({ ...member, birthdate: member.birthdate || '' });
    setNewPassword('');
    if (member.contratante_member_id) {
      db.from('members').select('id, name, email, phone').eq('id', member.contratante_member_id).maybeSingle()
        .then(({ data }: any) => setContratante(data));
    } else {
      setContratante(null);
    }
    if (member.member_role === 'contratante' || !member.member_role) {
      db.from('members')
        .select('id, name, email, phone, status, relationship, credentials_sent_at, xp, level, total_lessons_completed')
        .eq('contratante_member_id', member.id).order('created_at', { ascending: false })
        .then(({ data }: any) => setPrepostos(data || []));
    } else {
      setPrepostos([]);
    }
  }, [open, member]);

  if (!form) return null;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Maximo 5MB'); return; }
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const key = `avatars/${member.id}/${Date.now()}.${ext}`;
      const { data: sign, error: signErr } = await supabase.functions.invoke('create-b2-upload-url', {
        body: { key, contentType: file.type || 'image/jpeg' },
      });
      if (signErr || !(sign as any)?.upload_url) throw new Error((sign as any)?.error || 'Erro sign');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', (sign as any).upload_url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('upload'));
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(file);
      });
      setForm({ ...form, avatar_url: (sign as any).public_url });
      toast.success('Foto enviada. Salva pra confirmar.');
    } catch (e: any) { toast.error('Erro: ' + e.message); }
    finally { setAvatarUploading(false); }
  };

  const save = async () => {
    if (!form.name?.trim() || !form.email?.trim()) { toast.error('Nome e email sao obrigatorios'); return; }
    setSaving(true);
    try {
      const newEmail = form.email.trim().toLowerCase();
      const newPhone = normalizePhone(form.phone || '');

      // Pre-check: email conflict with another member
      if (newEmail !== (member.email || '').toLowerCase()) {
        const { data: conflict } = await db.from('members').select('id, name').eq('email', newEmail).neq('id', member.id).maybeSingle();
        if (conflict) throw new Error(`Email ja esta em uso por "${conflict.name}". Escolha outro.`);
      }

      const cpfDigits = (form.cpf || '').replace(/\D/g, '');
      const payload: any = {
        name: form.name.trim(),
        email: newEmail,
        phone: newPhone,
        cpf: cpfDigits ? cpfDigits : null,
        avatar_url: form.avatar_url || null,
        bio: form.bio?.trim() || null,
        job_title: form.job_title?.trim() || null,
        relationship: form.relationship || null,
        birthdate: form.birthdate || null,
        status: form.status,
        level: form.level,
        xp: Number(form.xp) || 0,
        welcome_message: form.welcome_message || null,
        program: form.program,
        updated_at: new Date().toISOString(),
      };
      // Strip undefined values so PostgREST doesn't choke
      Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });

      // Fire the UPDATE (without relying on RETURNING, which the proxy occasionally strips)
      const { error } = await db.from('members').update(payload).eq('id', member.id);
      if (error) {
        console.error('[member-edit] update error', error);
        throw error;
      }

      // Confirm via re-read (always works through RLS)
      const { data: reread, error: readErr } = await db.from('members').select('*').eq('id', member.id).single();
      console.log('[member-edit] reread', { error: readErr, email: reread?.email, name: reread?.name, phone: reread?.phone, updated_at: reread?.updated_at });
      if (readErr) throw readErr;
      if (!reread) throw new Error('Membro nao encontrado apos update');

      const matches = reread.email === payload.email && reread.name === payload.name && reread.phone === payload.phone;
      if (!matches) {
        console.warn('[member-edit] update did NOT persist', { expected: payload, got: reread });
        throw new Error(`Update executou mas o banco nao refletiu. Esperado email=${payload.email}, banco retornou email=${reread.email}`);
      }

      toast.success(`Membro "${reread.name}" atualizado`);
      console.log('[member-edit] saved', { id: reread.id, email: reread.email, phone: reread.phone });

      // Sync com Asaas (fire-and-forget pra nao travar UI)
      // Atualiza customer existente OU cria + gera boletos se CPF acabou de ser preenchido
      supabase.functions.invoke('asaas-sync-member', { body: { member_id: member.id } })
        .then(({ data, error }: any) => {
          if (error) {
            console.warn('[asaas-sync] erro:', error);
            return;
          }
          if (data?.skipped) {
            console.log('[asaas-sync] pulado:', data.skipped);
            return;
          }
          const parts = [];
          if (data?.customers_updated) parts.push(`${data.customers_updated} cliente(s) atualizado(s)`);
          if (data?.customers_created) parts.push(`${data.customers_created} cliente(s) criado(s)`);
          if (data?.invoices_generated) parts.push(`${data.invoices_generated} boleto(s) gerado(s)`);
          if (parts.length > 0) toast.success(`Asaas: ${parts.join(' + ')}`);
          if (data?.errors?.length) console.warn('[asaas-sync] erros:', data.errors);
        })
        .catch((e: any) => console.warn('[asaas-sync] exception:', e));

      onUpdated();
      onClose();
    } catch (e: any) {
      console.error('[member-edit] save error', e);
      toast.error('Erro ao salvar: ' + (e.message || e.code || JSON.stringify(e).slice(0, 200)));
    } finally { setSaving(false); }
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Senha precisa ter no minimo 6 caracteres'); return; }
    setResettingPw(true);
    try {
      const hash = await hashPassword(newPassword);
      const { error } = await db.from('members').update({
        password_hash: hash,
        password_set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', member.id);
      if (error) throw error;
      toast.success(`Senha redefinida pra "${newPassword}" — anote ou envie pro membro`);
      // Copy to clipboard
      try { await navigator.clipboard.writeText(newPassword); } catch {}
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally { setResettingPw(false); }
  };

  const clearPasswordHash = async () => {
    if (!confirm('Remover senha definida? O membro volta a usar o telefone como senha.')) return;
    await db.from('members').update({
      password_hash: null, password_set_at: null, updated_at: new Date().toISOString(),
    }).eq('id', member.id);
    toast.success('Senha removida — membro usa telefone como login');
    onUpdated();
  };

  const resendCredentials = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-member-credentials', {
        body: { member_id: member.id, force: true },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      toast.success('Credenciais reenviadas no WhatsApp');
      onUpdated();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    }
  };

  const copyLoginData = async () => {
    const text = `Area de Membros + que Vencedores\nLink: https://squaad.com.br/membros/login\nEmail: ${form.email}\nSenha inicial: ${form.phone}`;
    await navigator.clipboard.writeText(text);
    toast.success('Copiado');
  };

  const isPreposto = form.member_role === 'preposto';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={form.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/15 text-primary text-sm">
                {(form.name || '').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold">{form.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isPreposto ? (
                  <Badge variant="outline" className="text-[10px] uppercase border-blue-500/30 text-blue-500">
                    <Users className="w-2.5 h-2.5 mr-1" /> Preposto
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase border-primary/30 text-primary">
                    <Crown className="w-2.5 h-2.5 mr-1" /> Contratante
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[10px] ${form.status === 'active' ? 'border-green-500/30 text-green-500' : form.status === 'blocked' ? 'border-red-500/30 text-red-500' : 'border-yellow-500/30 text-yellow-500'}`}>
                  {form.status}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="perfil">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="acesso">Acesso</TabsTrigger>
            <TabsTrigger value="gamif">Gamificação</TabsTrigger>
            <TabsTrigger value="relacao">Relações</TabsTrigger>
          </TabsList>

          {/* ============ PERFIL ============ */}
          <TabsContent value="perfil" className="space-y-3 mt-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={form.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">{(form.name || '').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={avatarUploading}>
                  {avatarUploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                  Trocar foto
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">JPG/PNG ate 5MB</p>
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Programa</Label>
                <Select value={form.program || 'metodo-squaad'} onValueChange={(v) => setForm({ ...form, program: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metodo-squaad">Método + que Vencedores</SelectItem>
                    <SelectItem value="mentoria">MentorIA</SelectItem>
                    <SelectItem value="mbai">MBAI</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Cargo/função</Label>
                <Input value={form.job_title || ''} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Cake className="w-3 h-3" /> Data de nascimento</Label>
                <Input type="date" value={form.birthdate || ''} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><IdCard className="w-3 h-3" /> CPF / CNPJ</Label>
              <Input
                value={formatCpfCnpj(form.cpf || '')}
                onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                inputMode="numeric"
              />
              <p className="text-[10px] text-muted-foreground">Necessario pra gerar cobranca via Asaas (PIX, boleto, cartao).</p>
            </div>
            {isPreposto && (
              <div className="space-y-1.5">
                <Label>Relação com o contratante</Label>
                <Select value={form.relationship || 'funcionario'} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Bio / contexto</Label>
              <Textarea value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="min-h-[60px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem de boas-vindas (aparece no dashboard do membro)</Label>
              <Textarea value={form.welcome_message || ''} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} className="min-h-[60px]" />
            </div>
          </TabsContent>

          {/* ============ ACESSO ============ */}
          <TabsContent value="acesso" className="space-y-4 mt-4">
            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Dados de login</p>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email (usado no login)</Label>
                <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone (senha inicial / envio de WhatsApp)</Label>
                <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <p className="text-[10px] text-muted-foreground">Se o membro ainda não definiu uma senha própria, o telefone funciona como senha inicial.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={copyLoginData}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar dados de login
                </Button>
                <Button size="sm" variant="outline" className="text-[#25D366] border-[#25D366]/30" onClick={resendCredentials}>
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Reenviar no WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open('/membros/login', '_blank')}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir tela de login
                </Button>
              </div>
              {form.credentials_sent_at && (
                <p className="text-[11px] text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Credenciais enviadas em {new Date(form.credentials_sent_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>

            <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold flex items-center gap-2"><KeyRound className="w-4 h-4 text-yellow-500" /> Redefinir senha</p>
              <p className="text-xs text-muted-foreground">
                Defina uma senha específica pra esse membro. Ele vai precisar usar ela no login (o telefone deixa de ser aceito).
                Anote ou envie no WhatsApp depois.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nova senha (min. 6 chars)"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  type="text" autoComplete="off"
                />
                <Button
                  size="sm" onClick={resetPassword} disabled={resettingPw || newPassword.length < 6}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  {resettingPw ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
                  Redefinir
                </Button>
              </div>
              {form.password_hash && (
                <Button size="sm" variant="ghost" className="text-red-400" onClick={clearPasswordHash}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remover senha (volta pro telefone)
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ============ GAMIFICACAO ============ */}
          <TabsContent value="gamif" className="space-y-3 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" /> XP</Label>
                <Input type="number" value={form.xp || 0} onChange={(e) => setForm({ ...form, xp: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Trophy className="w-3 h-3 text-yellow-400" /> Nível</Label>
                <Select value={form.level || 'iniciante'} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iniciante">Iniciante</SelectItem>
                    <SelectItem value="explorador">Explorador</SelectItem>
                    <SelectItem value="construtor">Construtor</SelectItem>
                    <SelectItem value="mestre">Mestre</SelectItem>
                    <SelectItem value="lenda">Lenda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> Streak atual</Label>
                <Input type="number" value={form.streak_current || 0} disabled className="bg-muted/40" />
                <p className="text-[10px] text-muted-foreground">Gerenciado automaticamente</p>
              </div>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground">
              Aulas concluídas: {form.total_lessons_completed || 0} · Quizzes feitos: {form.total_quizzes_completed || 0} · Tempo total: {form.total_time_minutes || 0}min
            </div>
          </TabsContent>

          {/* ============ RELACOES ============ */}
          <TabsContent value="relacao" className="space-y-3 mt-4">
            {contratante && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <p className="text-xs uppercase font-bold text-primary">Indicado por (contratante)</p>
                <div className="flex items-center gap-3">
                  <Crown className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{contratante.name}</p>
                    <p className="text-[11px] text-muted-foreground">{contratante.email} · {contratante.phone}</p>
                  </div>
                </div>
              </div>
            )}

            {!isPreposto && (
              <div className="space-y-2">
                <p className="text-sm font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" /> Prepostos vinculados ({prepostos.length})
                </p>
                {prepostos.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum preposto cadastrado</p>
                ) : (
                  <div className="space-y-1.5">
                    {prepostos.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 bg-muted/20 rounded-lg">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">{p.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            {p.relationship && <Badge variant="outline" className="text-[9px]">{p.relationship}</Badge>}
                            <Badge variant="outline" className={`text-[9px] ${p.status === 'active' ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-400'}`}>{p.status}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{p.email} · {p.phone} · nivel {p.level}, {p.xp} XP, {p.total_lessons_completed} aulas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
