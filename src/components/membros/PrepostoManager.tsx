import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, UserPlus, Send, Loader2, Mail, Phone, Briefcase, Cake,
  CheckCircle2, MessageCircle, Trash2, RefreshCw,
} from 'lucide-react';

const db = supabase as any;

interface Props {
  contratanteId: string;
}

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}

function randomPassword(): string {
  const a = Math.random().toString(36).slice(2, 6);
  const b = Math.random().toString(36).slice(2, 6);
  return `${a}${b}`.toLowerCase();
}

export default function PrepostoManager({ contratanteId }: Props) {
  const [prepostos, setPrepostos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', job_title: '',
    relationship: 'funcionario', bio: '', birthdate: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await db.from('members')
      .select('id, name, email, phone, avatar_url, job_title, relationship, status, credentials_sent_at, xp, level, total_lessons_completed')
      .eq('contratante_member_id', contratanteId)
      .order('created_at', { ascending: false });
    setPrepostos(data || []);
    setLoading(false);
  };

  useEffect(() => { if (contratanteId) load(); }, [contratanteId]);

  const reset = () => setForm({
    name: '', email: '', phone: '', job_title: '',
    relationship: 'funcionario', bio: '', birthdate: '',
  });

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error('Preencha nome, email e telefone');
      return;
    }
    setSaving(true);
    try {
      const normEmail = form.email.trim().toLowerCase();
      const normPhone = normalizePhone(form.phone);

      // Check duplicate
      const { data: existing } = await db.from('members')
        .select('id').eq('email', normEmail).maybeSingle();
      if (existing) throw new Error('Ja existe um membro com esse email');

      const { data: created, error } = await db.from('members').insert({
        name: form.name.trim(),
        email: normEmail,
        phone: normPhone,
        job_title: form.job_title.trim() || null,
        relationship: form.relationship,
        bio: form.bio.trim() || null,
        birthdate: form.birthdate || null,
        member_role: 'preposto',
        contratante_member_id: contratanteId,
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: 'contratante_self',
        program: 'metodo-vencedores',
      }).select().single();
      if (error) throw error;

      toast.success('Preposto cadastrado — enviando credenciais...');
      setShowDialog(false);
      reset();
      load();

      // Send credentials (fire and forget with toast feedback)
      const { data: sendRes } = await supabase.functions.invoke('send-member-credentials', {
        body: { member_id: created.id },
      });
      if ((sendRes as any)?.ok) {
        toast.success('Credenciais enviadas no WhatsApp de ambos!');
      } else {
        toast.warning('Cadastrado, mas falhou ao enviar WhatsApp. Use o botao "Reenviar".');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  };

  const resendCredentials = async (id: string) => {
    setSendingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('send-member-credentials', {
        body: { member_id: id },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message);
      toast.success('Credenciais reenviadas!');
      load();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally { setSendingId(null); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este preposto? Ele perde o acesso a area de membros.')) return;
    await db.from('members').update({ status: 'blocked' }).eq('id', id);
    toast.success('Preposto removido');
    load();
  };

  return (
    <>
      <Card className="bg-white/5 border-white/10 rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Prepostos (quem assiste as aulas)
              </p>
              <p className="text-xs text-white/50 mt-1">
                Se o programa e pro seu time (filho, socio, funcionario), cadastre aqui. Cada preposto recebe login proprio e voce acompanha o progresso.
              </p>
            </div>
            <Button size="sm" className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90" onClick={() => { reset(); setShowDialog(true); }}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Adicionar
            </Button>
          </div>

          {loading ? (
            <p className="text-xs text-white/50"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Carregando...</p>
          ) : prepostos.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-8 h-8 mx-auto text-white/30 mb-2" />
              <p className="text-xs text-white/50">Nenhum preposto cadastrado ainda.</p>
              <p className="text-[11px] text-white/30 mt-1">Voce esta como aluno direto. Se quiser passar o acesso para alguem do time, clique em "Adicionar".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {prepostos.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback className="bg-[#3B82F6]/15 text-[#3B82F6] text-sm">
                      {(p.name || '').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                      {p.relationship && <Badge variant="outline" className="text-[9px] uppercase border-white/20 text-white/60">{p.relationship}</Badge>}
                      {p.status !== 'active' && <Badge variant="outline" className="text-[9px] uppercase border-red-500/30 text-red-400">{p.status}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-white/50 mt-0.5">
                      <span>Nivel {p.level || 1}</span>
                      <span>{p.xp || 0} XP</span>
                      <span>{p.total_lessons_completed || 0} aulas</span>
                      {p.job_title && <span>· {p.job_title}</span>}
                    </div>
                    {p.credentials_sent_at && (
                      <p className="text-[10px] text-green-400 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Credenciais enviadas {new Date(p.credentials_sent_at).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-[#3B82F6]" onClick={() => resendCredentials(p.id)} disabled={sendingId === p.id} title="Reenviar credenciais">
                      {sendingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => remove(p.id)} title="Remover">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar preposto</DialogTitle>
            <p className="text-xs text-white/50">
              Pessoa do seu time que vai consumir o programa. Ela recebe login proprio e voce acompanha o progresso dela.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome completo</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Relacao com voce</Label>
                <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filho">Filho(a)</SelectItem>
                    <SelectItem value="conjuge">Conjuge</SelectItem>
                    <SelectItem value="socio">Socio(a)</SelectItem>
                    <SelectItem value="funcionario">Funcionario(a)</SelectItem>
                    <SelectItem value="gestor">Gestor(a) do time</SelectItem>
                    <SelectItem value="parente">Parente</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="email de login" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Briefcase className="w-3 h-3" /> Cargo/Funcao</Label>
                <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Ex: Gerente de Marketing" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Cake className="w-3 h-3" /> Aniversario (opcional)</Label>
                <Input type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Sobre o preposto (objetivos, contexto)</Label>
              <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="bg-white/5 border-white/10 text-white min-h-[70px]" placeholder="Ex: Meu filho, 22 anos, vai assumir a operacao. Quero que ele domine IA no atendimento." />
            </div>

            <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg p-3 flex items-start gap-2">
              <Send className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-white/80">
                <strong className="text-[#3B82F6]">Envio automatico:</strong> quando clicar em "Cadastrar", o sistema envia no WhatsApp do preposto o link de acesso + credenciais de login. Voce tambem recebe uma copia com confirmacao.
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={saving} className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
              Cadastrar e enviar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
