import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Trash2, KeyRound, Loader2, ShieldCheck, Info } from 'lucide-react';
import { AREAS_ADMIN, ACESSO_TOTAL, TODAS_AS_AREAS } from '@/lib/permissoes';

interface Colaborador {
  email: string;
  nome: string | null;
  is_active: boolean;
  permissoes: string[];
  added_at: string;
  added_by: string | null;
}

const ENDPOINT = '/.netlify/functions/admin-colaboradores';

async function chamar(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada — entre novamente.');
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `Falha (${r.status})`);
  return j;
}

export default function ColaboradoresPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ email: '', senha: '', nome: '', permissoes: [] as string[] });
  const [editando, setEditando] = useState<Colaborador | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [removendo, setRemovendo] = useState<Colaborador | null>(null);

  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: async (): Promise<Colaborador[]> => (await chamar({ action: 'list' })).colaboradores || [],
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ['colaboradores'] });

  const mCriar = useMutation({
    mutationFn: () => chamar({ action: 'create', ...form }),
    onSuccess: (r: any) => {
      toast({
        title: r.criado ? 'Colaborador criado' : 'Colaborador vinculado',
        description: r.criado
          ? `${form.email} já pode entrar com a senha definida.`
          : `${form.email} já tinha login; a senha foi atualizada e o acesso liberado.`,
      });
      setForm({ email: '', senha: '', nome: '', permissoes: [] });
      setCriando(false);
      recarregar();
    },
    onError: (e: Error) => toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' }),
  });

  const mAtualizar = useMutation({
    mutationFn: (p: Record<string, unknown>) => chamar({ action: 'update', ...p }),
    onSuccess: () => { toast({ title: 'Atualizado' }); setEditando(null); setNovaSenha(''); recarregar(); },
    onError: (e: Error) => toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' }),
  });

  const mRemover = useMutation({
    mutationFn: (email: string) => chamar({ action: 'delete', email }),
    onSuccess: () => { toast({ title: 'Acesso removido' }); setRemovendo(null); recarregar(); },
    onError: (e: Error) => toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' }),
  });

  const alternar = (lista: string[], url: string) =>
    lista.includes(url) ? lista.filter((x) => x !== url) : [...lista, url];

  const SeletorAreas = ({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) => {
    const total = valor.includes(ACESSO_TOTAL);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border p-3">
          <Checkbox
            checked={total}
            onCheckedChange={(c) => onChange(c ? [ACESSO_TOTAL] : [])}
            id="acesso-total"
          />
          <Label htmlFor="acesso-total" className="flex items-center gap-2 cursor-pointer">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Acesso total (administrador)
          </Label>
        </div>
        {!total && (
          <div className="space-y-4 max-h-80 overflow-auto pr-1">
            {AREAS_ADMIN.map((g) => {
              const urls = g.itens.map((i) => i.url);
              const marcados = urls.filter((u) => valor.includes(u)).length;
              return (
                <div key={g.grupo} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{g.grupo}</p>
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() =>
                        onChange(marcados === urls.length
                          ? valor.filter((v) => !urls.includes(v))
                          : Array.from(new Set([...valor, ...urls])))
                      }
                    >
                      {marcados === urls.length ? 'desmarcar grupo' : 'marcar grupo'}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {g.itens.map((i) => (
                      <label key={i.url} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={valor.includes(i.url)} onCheckedChange={() => onChange(alternar(valor, i.url))} />
                        <span>{i.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const resumo = (c: Colaborador) => {
    if (c.permissoes?.includes(ACESSO_TOTAL)) return 'Acesso total';
    const n = c.permissoes?.length || 0;
    return `${n} ${n === 1 ? 'área' : 'áreas'} de ${TODAS_AS_AREAS.length}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Colaboradores</h3>
          <p className="text-sm text-muted-foreground">
            Quem pode entrar no painel e quais áreas cada um enxerga.
          </p>
        </div>
        <Button onClick={() => setCriando((v) => !v)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          {criando ? 'Cancelar' : 'Adicionar colaborador'}
        </Button>
      </div>

      <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-muted-foreground">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p>
          O recorte por área controla o que aparece no painel e bloqueia o acesso pelas telas.
          No banco, todo colaborador ainda é tratado como administrador — então dê acesso apenas
          a quem você confiaria com os dados inteiros. <strong>Desativar</strong> um colaborador,
          esse sim, corta o acesso por completo.
        </p>
      </div>

      {criando && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="pessoa@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome (opcional)</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Como aparece na lista"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Áreas liberadas</Label>
              <SeletorAreas valor={form.permissoes} onChange={(v) => setForm({ ...form, permissoes: v })} />
            </div>
            <Button
              onClick={() => mCriar.mutate()}
              disabled={!form.email || form.senha.length < 6 || form.permissoes.length === 0 || mCriar.isPending}
              className="gap-2"
            >
              {mCriar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Criar colaborador
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {colaboradores.map((c) => (
            <Card key={c.email}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{c.nome || c.email}</p>
                      {c.permissoes?.includes(ACESSO_TOTAL) && <Badge variant="secondary">admin</Badge>}
                      {!c.is_active && <Badge variant="destructive">desativado</Badge>}
                    </div>
                    {c.nome && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    <p className="text-xs text-muted-foreground">{resumo(c)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(v) => mAtualizar.mutate({ email: c.email, is_active: v })}
                      />
                      <span className="text-xs text-muted-foreground">ativo</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setEditando(c); setNovaSenha(''); }}>
                      Editar acessos
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setRemovendo(c)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editando?.email === c.email && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    <SeletorAreas
                      valor={editando.permissoes || []}
                      onChange={(v) => setEditando({ ...editando, permissoes: v })}
                    />
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2"><KeyRound className="w-3.5 h-3.5" /> Trocar senha (opcional)</Label>
                      <Input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="deixe vazio pra manter" />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => mAtualizar.mutate({
                          email: c.email,
                          permissoes: editando.permissoes,
                          ...(novaSenha ? { senha: novaSenha } : {}),
                        })}
                        disabled={mAtualizar.isPending}
                        className="gap-2"
                      >
                        {mAtualizar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Salvar
                      </Button>
                      <Button variant="ghost" onClick={() => { setEditando(null); setNovaSenha(''); }}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!removendo} onOpenChange={(o) => !o && setRemovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso de {removendo?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa deixa de entrar no painel. O login dela continua existindo (não apagamos o
              usuário), então dá pra liberar de novo depois sem recriar a conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removendo && mRemover.mutate(removendo.email)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
