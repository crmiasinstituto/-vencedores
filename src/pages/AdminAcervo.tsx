// Acervo do Time dentro do CRM (admin). Mesmo acervo/quadro que o time ve
// em /time (RLS compartilhado), mais a aba Equipe pra gerir as contas de
// acesso externo (criar, resetar senha, ativar/desativar).
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import DriveExplorer from '@/components/drive/DriveExplorer';
import TeamBoard from '@/components/drive/TeamBoard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  HardDrive, KanbanSquare, Users, Plus, KeyRound, Loader2, Copy, ExternalLink,
} from 'lucide-react';

const db = supabase as any;

interface TeamUser {
  id: string; name: string; email: string; role: string;
  is_active: boolean; last_login_at: string | null; created_at: string;
}

export default function AdminAcervo() {
  const { user } = useAdminAuth();
  const actorName = user?.email?.split('@')[0] || 'Admin';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Acervo do Time</h1>
          <p className="text-sm text-muted-foreground">Banco de takes, videos e arquivos. Compartilhado com o acesso externo do time.</p>
        </div>
        <a href="/time" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm"><ExternalLink className="w-4 h-4 mr-1" /> Abrir /time</Button>
        </a>
      </div>

      <Tabs defaultValue="acervo">
        <TabsList className="mb-4">
          <TabsTrigger value="acervo"><HardDrive className="w-4 h-4 mr-1.5" /> Acervo</TabsTrigger>
          <TabsTrigger value="quadro"><KanbanSquare className="w-4 h-4 mr-1.5" /> Quadro</TabsTrigger>
          <TabsTrigger value="equipe"><Users className="w-4 h-4 mr-1.5" /> Equipe</TabsTrigger>
        </TabsList>
        <TabsContent value="acervo"><DriveExplorer actorName={actorName} /></TabsContent>
        <TabsContent value="quadro"><TeamBoard actorName={actorName} /></TabsContent>
        <TabsContent value="equipe"><TeamUsersManager /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Gestao das contas do time ──────────────────────────────
function TeamUsersManager() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<TeamUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.from('team_users')
      .select('id, name, email, role, is_active, last_login_at, created_at')
      .order('created_at', { ascending: false });
    if (error) toast.error('Falha ao carregar a equipe.');
    setUsers((data as TeamUser[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (u: TeamUser) => {
    const { data, error } = await db.rpc('admin_toggle_team_user', { p_id: u.id, p_active: !u.is_active });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || 'Falha ao atualizar.'); return; }
    toast.success(u.is_active ? 'Acesso desativado' : 'Acesso reativado');
    load();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">
          <Plus className="w-4 h-4 mr-1" /> Nova conta
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma conta criada. Crie a primeira pra liberar o acesso do time.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Nome</th>
                <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Email</th>
                <th className="text-left font-medium px-4 py-2 hidden md:table-cell">Ultimo login</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-right font-medium px-4 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('pt-BR') : 'Nunca'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                      {u.is_active ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setPwOpen(u)} title="Resetar senha">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(u)}>
                      {u.is_active ? 'Desativar' : 'Reativar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} onCreated={load} />}
      {pwOpen && <ResetPasswordDialog user={pwOpen} onClose={() => setPwOpen(null)} />}
    </div>
  );
}

function randomPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 10; i++) s += chars[arr[i] % chars.length];
  return s;
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(randomPassword());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Preencha nome, email e uma senha de 6+ caracteres.');
      return;
    }
    setSaving(true);
    const { data, error: err } = await db.rpc('admin_create_team_user', {
      p_name: name, p_email: email, p_password: password, p_role: 'member',
    });
    setSaving(false);
    if (err) { setError('Erro de conexao. Tente de novo.'); return; }
    if ((data as any)?.error) { setError((data as any).error); return; }
    setCreated(true);
    onCreated();
  };

  const copyCreds = () => {
    navigator.clipboard.writeText(`Acesso ao Acervo do Time\nLink: ${window.location.origin}/time\nEmail: ${email.trim().toLowerCase()}\nSenha: ${password}`);
    toast.success('Acesso copiado');
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? 'Conta criada' : 'Nova conta do time'}</DialogTitle>
          <DialogDescription>
            {created ? 'Copie o acesso e envie pra pessoa do time.' : 'A pessoa entra em /time com email e senha. So enxerga o acervo.'}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm font-mono space-y-1">
              <div>Link: {window.location.origin}/time</div>
              <div>Email: {email.trim().toLowerCase()}</div>
              <div>Senha: {password}</div>
            </div>
            <Button onClick={copyCreds} variant="outline" className="w-full"><Copy className="w-4 h-4 mr-1" /> Copiar acesso</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-sm text-red-500">{error}</div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da pessoa" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Senha inicial</label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>Gerar</Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <Button onClick={onClose} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">Concluir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={submit} disabled={saving} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar acesso'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: TeamUser; onClose: () => void }) {
  const [password, setPassword] = useState(randomPassword());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 6) { toast.error('Senha de 6+ caracteres.'); return; }
    setSaving(true);
    const { data, error } = await db.rpc('admin_set_team_password', { p_id: user.id, p_password: password });
    setSaving(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || 'Falha ao resetar.'); return; }
    setDone(true);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar senha de {user.name}</DialogTitle>
          <DialogDescription>A pessoa sera deslogada e precisa entrar com a nova senha.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => setPassword(randomPassword())}>Gerar</Button>
        </div>
        {done && (
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-2.5 text-sm text-green-600 flex items-center justify-between">
            <span>Senha atualizada: <span className="font-mono">{password}</span></span>
            <button onClick={() => { navigator.clipboard.writeText(password); toast.success('Copiada'); }} className="text-green-600"><Copy className="w-4 h-4" /></button>
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={onClose} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">Concluir</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={submit} disabled={saving} className="bg-[#3B82F6] text-black hover:bg-[#e0b400]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resetar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
