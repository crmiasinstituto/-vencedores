import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Trash2, Pencil, Loader2, Mic, MessageSquare, Image as ImageIcon,
  Video, FileText, Zap, CheckCircle2, AlertCircle, MousePointerClick,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MediaDropzone } from '@/components/marketing-mod/MediaDropzone';
import MarketingPageHeader from '@/components/marketing-mod/MarketingPageHeader';
import {
  useRespostasAutomaticas, useBotoesDosTemplates, useRespostasLog,
  useSalvarRespostaAutomatica, useRemoverRespostaAutomatica,
  type RespostaAutomatica, type TipoResposta,
} from '@/hooks/useRespostasAutomaticas';
import { cn } from '@/lib/utils';

const TIPOS: { value: TipoResposta; label: string; icon: any }[] = [
  { value: 'audio', label: 'Áudio', icon: Mic },
  { value: 'text', label: 'Texto', icon: MessageSquare },
  { value: 'image', label: 'Imagem', icon: ImageIcon },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'document', label: 'Documento', icon: FileText },
];

const vazio = {
  nome: '',
  gatilho: '',
  tipo: 'audio' as TipoResposta,
  media_url: '',
  mensagem: '',
  delay_segundos: 3,
  is_active: true,
};

/**
 * Quando o lead toca um botão do template, ele abre a janela de 24h — e é só aí que
 * a Meta deixa mandar áudio (fora da janela, só template, e template não carrega áudio).
 * Esta tela programa o que sai nesse momento.
 */
export default function RespostasAutomaticas() {
  const { data: regras = [], isLoading } = useRespostasAutomaticas();
  const { data: botoes = [] } = useBotoesDosTemplates();
  const { data: log = [] } = useRespostasLog();
  const salvar = useSalvarRespostaAutomatica();
  const remover = useRemoverRespostaAutomatica();

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<typeof vazio & { id?: string }>(vazio);

  const abrirNovo = () => { setForm(vazio); setAberto(true); };
  const abrirEdicao = (r: RespostaAutomatica) => {
    setForm({
      id: r.id,
      nome: r.nome,
      gatilho: r.gatilho,
      tipo: r.tipo,
      media_url: r.media_url || '',
      mensagem: r.mensagem || '',
      delay_segundos: r.delay_segundos,
      is_active: r.is_active,
    });
    setAberto(true);
  };

  const podeSalvar =
    form.nome.trim() &&
    form.gatilho.trim() &&
    (form.tipo === 'text' ? form.mensagem.trim() : form.media_url.trim());

  const confirmar = async () => {
    await salvar.mutateAsync({
      id: form.id,
      nome: form.nome.trim(),
      gatilho: form.gatilho.trim(),
      tipo: form.tipo,
      media_url: form.tipo === 'text' ? null : form.media_url.trim() || null,
      mensagem: form.mensagem.trim() || null,
      delay_segundos: form.delay_segundos,
      is_active: form.is_active,
    });
    setAberto(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
        <MarketingPageHeader
          eyebrow="Marketing · WhatsApp"
          title="Respostas automáticas"
          description={
            <>
              O que sai quando o lead <strong>toca um botão</strong> do template. É o único
              momento em que dá pra mandar áudio: o clique abre a janela de 24h.
            </>
          }
          action={
            <Button size="sm" className="bg-[#25d366] hover:bg-[#128C7E] text-white gap-1.5" onClick={abrirNovo}>
              <Plus className="h-3.5 w-3.5" /> Nova resposta
            </Button>
          }
        />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : regras.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#25d366]/10 flex items-center justify-center mx-auto">
                <MousePointerClick className="h-7 w-7 text-[#25d366]" />
              </div>
              <div>
                <p className="font-semibold">Nenhuma resposta automática ainda</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-lg mx-auto">
                  Exemplo: o lead toca <span className="font-mono text-xs">Confirmar inscrição</span> no
                  template do Reprograme-se 10X e recebe, três segundos depois, o seu áudio de
                  boas-vindas.
                </p>
              </div>
              <Button onClick={abrirNovo} className="bg-[#25d366] hover:bg-[#128C7E] text-white gap-2">
                <Plus className="h-4 w-4" /> Criar a primeira
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {regras.map((r) => {
              const Icone = TIPOS.find((t) => t.value === r.tipo)?.icon || Zap;
              return (
                <Card key={r.id} className="group hover:border-[#25d366]/40 transition-colors">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#25d366]/10 text-[#128C7E] flex items-center justify-center shrink-0">
                      <Icone className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          botão: {r.gatilho}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {TIPOS.find((t) => t.value === r.tipo)?.label}
                        </Badge>
                        {r.delay_segundos > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            após {r.delay_segundos}s
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold truncate">{r.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.total_enviados} envio{r.total_enviados === 1 ? '' : 's'} ·{' '}
                        {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => salvar.mutate({ id: r.id, is_active: v })}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`Remover "${r.nome}"?`)) remover.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {log.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Últimos disparos
              </Label>
              <ScrollArea className="h-[180px] mt-3 pr-3">
                <div className="space-y-1">
                  {(log as any[]).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0">
                      {l.status === 'enviado' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : l.status === 'falhou' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 truncate">{l.remote_phone}</span>
                      {l.erro && (
                        <span className="text-[10px] text-destructive truncate max-w-[260px]">{l.erro}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Editar resposta' : 'Nova resposta automática'}</DialogTitle>
              <DialogDescription>
                Dispara quando o lead toca o botão escolhido. Vale para qualquer template que
                tenha esse botão.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Áudio de boas-vindas do RPG10X"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Botão que dispara</Label>
                <Input
                  value={form.gatilho}
                  onChange={(e) => setForm({ ...form, gatilho: e.target.value })}
                  placeholder="Confirmar inscrição"
                  className="text-sm font-mono"
                />
                {botoes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {botoes.map((b) => (
                      <button
                        key={b.texto}
                        type="button"
                        onClick={() => setForm({ ...form, gatilho: b.texto })}
                        title={`Usado em: ${b.templates.join(', ')}`}
                        className={cn(
                          'text-[11px] px-2 py-1 rounded-md border transition-colors',
                          form.gatilho === b.texto
                            ? 'border-[#25d366] bg-[#25d366]/10 text-[#128C7E]'
                            : 'border-border hover:border-[#25d366]/50 text-muted-foreground',
                        )}
                      >
                        {b.texto}
                        <span className="ml-1 opacity-60">({b.templates.length})</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Os botões acima vêm dos seus templates aprovados. Acento e maiúscula não
                  importam na hora de casar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">O que enviar</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v: TipoResposta) => setForm({ ...form, tipo: v })}
                  >
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Esperar antes (segundos)</Label>
                  <Input
                    type="number" min={0} max={60}
                    value={form.delay_segundos}
                    onChange={(e) => setForm({ ...form, delay_segundos: Number(e.target.value) || 0 })}
                    className="text-sm"
                  />
                </div>
              </div>

              {form.tipo !== 'text' && (
                <div className="space-y-2">
                  <Label className="text-xs">
                    {form.tipo === 'audio' ? 'Arquivo de áudio' : 'Arquivo'}
                  </Label>
                  <MediaDropzone
                    value={form.media_url}
                    tipo={form.tipo as any}
                    folder="respostas-automaticas"
                    onChange={(url) => setForm({ ...form, media_url: url })}
                  />
                  {form.tipo === 'audio' && (
                    <p className="text-[11px] text-muted-foreground">
                      O WhatsApp toca melhor em .ogg (opus) ou .mp3. Áudio não aceita legenda.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">
                  {form.tipo === 'text' ? 'Mensagem' : 'Legenda (opcional)'}
                </Label>
                <Textarea
                  value={form.mensagem}
                  onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                  rows={3}
                  placeholder={form.tipo === 'text' ? 'O que responder...' : 'Texto junto do arquivo'}
                  className="text-sm resize-none"
                  disabled={form.tipo === 'audio'}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
              <Button
                onClick={confirmar}
                disabled={!podeSalvar || salvar.isPending}
                className="bg-[#25d366] hover:bg-[#128C7E] text-white gap-1.5"
              >
                {salvar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
