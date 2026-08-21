import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Megaphone, Plus, Trash2, Loader2, ExternalLink, Clock } from 'lucide-react';
import { FAIXAS, FAIXA_INFO, type Faixa } from '@/maisvencedores/types/member';
import UploadImagem from '@/maisvencedores/components/admin/UploadImagem';

interface Aviso {
  id: string;
  title: string;
  content: string;
  announcement_type: string;
  is_active: boolean;
  is_popup: boolean;
  starts_at: string;
  ends_at: string | null;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  faixas_alvo: string[];
  max_exibicoes: number;
  priority: number;
}

const vazio = {
  title: '',
  content: '',
  announcement_type: 'info',
  is_popup: true,
  dias_ativo: '7',
  link_url: '',
  link_label: '',
  image_url: '',
  faixas_alvo: [] as Faixa[],
  max_exibicoes: '1',
  priority: '0',
};

export default function AdminAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(vazio);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    setAvisos((data as Aviso[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Título e mensagem são obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      // "Fica ativo por N dias" é o jeito que o time pensa; o banco guarda a data final.
      // Vazio/0 = sem prazo, o aviso só sai quando alguém desliga.
      const dias = parseInt(form.dias_ativo || '0', 10);
      const ends_at = dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null;

      const { error } = await supabase.from('announcements').insert({
        title: form.title.trim(),
        content: form.content.trim(),
        announcement_type: form.announcement_type,
        is_active: true,
        is_popup: form.is_popup,
        starts_at: new Date().toISOString(),
        ends_at,
        link_url: form.link_url.trim() || null,
        link_label: form.link_label.trim() || null,
        image_url: form.image_url.trim() || null,
        faixas_alvo: form.faixas_alvo,
        max_exibicoes: parseInt(form.max_exibicoes || '1', 10),
        priority: parseInt(form.priority || '0', 10),
      });
      if (error) throw error;
      toast.success('Aviso publicado');
      setForm(vazio);
      setAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (a: Aviso) => {
    await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id);
    carregar();
  };

  const remover = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    toast.success('Aviso removido');
    carregar();
  };

  const alternarFaixa = (f: Faixa) =>
    setForm({
      ...form,
      faixas_alvo: form.faixas_alvo.includes(f)
        ? form.faixas_alvo.filter((x) => x !== f)
        : [...form.faixas_alvo, f],
    });

  const situacao = (a: Aviso) => {
    if (!a.is_active) return { txt: 'desligado', cor: 'bg-muted text-muted-foreground' };
    if (a.ends_at && new Date(a.ends_at) < new Date()) return { txt: 'expirado', cor: 'bg-muted text-muted-foreground' };
    return { txt: 'no ar', cor: 'bg-emerald-500/15 text-emerald-500' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Avisos da Comunidade
          </h1>
          <p className="text-sm text-muted-foreground">
            Aparecem como popup para os membros ao entrar na área.
          </p>
        </div>
        <Button onClick={() => setAberto(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo aviso
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : avisos.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Nenhum aviso ainda. Crie o primeiro para avisar a comunidade.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {avisos.map((a) => {
            const s = situacao(a);
            return (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {a.image_url && (
                      <img src={a.image_url} alt="" className="w-24 h-16 object-cover rounded-md flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{a.title}</p>
                        <Badge className={s.cor} variant="secondary">{s.txt}</Badge>
                        {a.is_popup && <Badge variant="outline">popup</Badge>}
                        {a.faixas_alvo?.length > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {a.faixas_alvo.map((f) => FAIXA_INFO[f as Faixa]?.nome).join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        {a.ends_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            até {new Date(a.ends_at).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> sem prazo</span>
                        )}
                        {a.link_url && (
                          <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" /> {a.link_label || 'link'}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={a.is_active} onCheckedChange={() => alternarAtivo(a)} />
                      <Button variant="ghost" size="icon" onClick={() => remover(a.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo aviso</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Inscrições abertas para o RPG10X" />
            </div>
            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea rows={4} value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="O que a comunidade precisa saber." />
            </div>

            <UploadImagem
              label="Imagem do aviso (opcional)"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              pasta="avisos"
              ajuda="Aparece no topo do popup."
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link (opcional)</Label>
                <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Texto do botão</Label>
                <Input value={form.link_label} onChange={(e) => setForm({ ...form, link_label: e.target.value })}
                  placeholder="Ex: Garantir minha vaga" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fica ativo por (dias)</Label>
                <Input type="number" min="0" value={form.dias_ativo}
                  onChange={(e) => setForm({ ...form, dias_ativo: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">0 = sem prazo</p>
              </div>
              <div className="space-y-2">
                <Label>Vezes que cada membro vê</Label>
                <Input type="number" min="0" value={form.max_exibicoes}
                  onChange={(e) => setForm({ ...form, max_exibicoes: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">0 = toda vez que entrar</p>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input type="number" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">maior aparece primeiro</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border p-3">
              <Switch checked={form.is_popup} onCheckedChange={(v) => setForm({ ...form, is_popup: v })} />
              <div>
                <p className="text-sm font-medium">Abrir como popup</p>
                <p className="text-[11px] text-muted-foreground">
                  Desligado, o aviso fica só na lista da área de eventos.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quem vê</Label>
              <div className="flex flex-wrap gap-2">
                {FAIXAS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => alternarFaixa(f)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      form.faixas_alvo.includes(f)
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    {FAIXA_INFO[f].nome}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Nenhuma marcada = todas as faixas veem.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando} className="gap-2">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Publicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
