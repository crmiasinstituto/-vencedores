import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Loader2, Save, KeyRound, Pencil } from 'lucide-react';
import { hashPassword, verifyPassword } from '@/lib/memberCrypto';

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}

export default function ProfileEditor({
  member, onUpdated,
}: {
  member: any;
  onUpdated: (m: any) => void;
}) {
  const [openEdit, setOpenEdit] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);

  // Edit profile state
  const [name, setName] = useState(member.name || '');
  const [bio, setBio] = useState(member.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member.avatar_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentCred, setCurrentCred] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changing, setChanging] = useState(false);

  const openEditReset = () => {
    setName(member.name || '');
    setBio(member.bio || '');
    setAvatarUrl(member.avatar_url || null);
    setOpenEdit(true);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (maximo 5 MB)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const key = `avatars/${member.id}/${Date.now()}.${ext}`;
      const { data: sign, error: signErr } = await supabase.functions.invoke('create-b2-upload-url', {
        body: { key, contentType: file.type || 'image/jpeg' },
      });
      if (signErr || !sign?.upload_url) throw new Error(sign?.error || signErr?.message || 'Falha ao assinar upload');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sign.upload_url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`));
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(file);
      });

      setAvatarUrl(sign.public_url);
      toast.success('Foto enviada. Clique em Salvar para confirmar.');
    } catch (e: any) {
      toast.error('Erro ao enviar foto: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!name.trim()) { toast.error('Nome obrigatorio'); return; }
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).from('members')
        .update({
          name: name.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', member.id)
        .select()
        .single();
      if (error) throw error;
      toast.success('Perfil atualizado');
      onUpdated(data);
      // Refresh the cached session too (name/avatar shown in layout)
      const raw = localStorage.getItem('squaad_member_session');
      if (raw) {
        const s = JSON.parse(raw);
        s.member_name = data.name;
        localStorage.setItem('squaad_member_session', JSON.stringify(s));
      }
      setOpenEdit(false);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentCred) { toast.error('Informe seu telefone ou senha atual'); return; }
    if (newPass.length < 6) { toast.error('Nova senha precisa ter ao menos 6 caracteres'); return; }
    if (newPass !== confirmPass) { toast.error('As senhas nao coincidem'); return; }

    setChanging(true);
    try {
      // Re-verify current credential against latest DB state
      const { data: fresh } = await (supabase as any).from('members')
        .select('id, phone, password_hash, session_token')
        .eq('id', member.id).maybeSingle();
      if (!fresh) throw new Error('Sessao invalida');

      let authenticated = false;
      const typed = currentCred.trim();
      if (fresh.password_hash) {
        authenticated = await verifyPassword(typed, fresh.password_hash);
      }
      if (!authenticated && fresh.phone && normalizePhone(typed) === fresh.phone) {
        authenticated = true;
      }
      if (!authenticated) throw new Error('Senha atual incorreta');

      const hash = await hashPassword(newPass);
      const { error } = await (supabase as any).from('members').update({
        password_hash: hash,
        password_set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', member.id);
      if (error) throw error;

      toast.success('Senha atualizada com sucesso');
      setCurrentCred(''); setNewPass(''); setConfirmPass('');
      setOpenPassword(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao trocar senha');
    } finally {
      setChanging(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm" variant="outline"
          className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
          onClick={openEditReset}
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar perfil
        </Button>
        <Button
          size="sm" variant="outline"
          className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
          onClick={() => setOpenPassword(true)}
        >
          <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Trocar senha
        </Button>
      </div>

      {/* Edit profile dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border-2 border-[#3B82F6]/30">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-[#141414] text-[#3B82F6] text-2xl font-bold">
                  {name.charAt(0)?.toUpperCase() || 'M'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#3B82F6]/10"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                  Trocar foto
                </Button>
                <p className="text-xs text-white/40 mt-1">JPG ou PNG ate 5 MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Bio (opcional)</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Conte em poucas linhas sobre voce ou seu negocio"
                className="bg-white/5 border-white/10 text-white min-h-[80px]"
                maxLength={280}
              />
              <p className="text-xs text-white/40 text-right">{bio.length}/280</p>
            </div>

            <div className="text-xs text-white/50 bg-white/5 border border-white/10 rounded-lg p-3">
              Email (usado para login): <strong className="text-white/80">{member.email}</strong>
              <br />Nao pode ser alterado aqui. Fale com o suporte se precisar mudar.
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button
              onClick={saveProfile}
              disabled={saving || uploading}
              className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change password dialog */}
      <Dialog open={openPassword} onOpenChange={setOpenPassword}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {member.password_hash ? 'Senha atual' : 'Telefone cadastrado'}
              </Label>
              <Input
                type="password"
                value={currentCred}
                onChange={(e) => setCurrentCred(e.target.value)}
                placeholder={member.password_hash ? 'Sua senha atual' : 'O telefone usado no login'}
                className="bg-white/5 border-white/10 text-white"
                autoComplete="current-password"
              />
              <p className="text-[11px] text-white/40">
                {member.password_hash
                  ? 'Usamos sua senha atual pra confirmar que e voce.'
                  : 'Como e o primeiro acesso, confirme com o telefone que voce usa pra logar.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Ao menos 6 caracteres"
                className="bg-white/5 border-white/10 text-white"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button
              onClick={changePassword}
              disabled={changing}
              className="bg-[#3B82F6] text-black hover:bg-[#3B82F6]/90"
            >
              {changing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Atualizar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
