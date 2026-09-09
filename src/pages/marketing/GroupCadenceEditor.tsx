import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Play, Pause, Users, Clock,
  MessageSquare, Search, CheckCircle2, AlertCircle,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { MediaDropzone } from '@/components/marketing-mod/MediaDropzone';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useGroupCadence, useGroupCadenceSteps, useGroupCadenceSends, useWaGroups,
  useSaveGroupCadence, useSaveCadenceSteps, useStartGroupCadence, useSetCadenceStatus,
  type GroupCadenceStep, type DelayUnit,
} from '@/hooks/useGroupCadences';
import { cn } from '@/lib/utils';

type PassoLocal = Partial<GroupCadenceStep> & { _key: string };

const novoPasso = (primeiro: boolean): PassoLocal => ({
  _key: Math.random().toString(36).slice(2),
  delay_value: primeiro ? 0 : 1,
  delay_unit: 'dias',
  message: '',
  send_at_time: null,
  media_url: null,
  media_type: null,
});

/** Quando cada passo sai, contando do início. Mesma conta que a função no banco faz. */
function cronogramaLegivel(passos: PassoLocal[]): string[] {
  let minutos = 0;
  return passos.map((p) => {
    const v = p.delay_value ?? 0;
    minutos += p.delay_unit === 'minutos' ? v : p.delay_unit === 'horas' ? v * 60 : v * 1440;
    if (minutos === 0) return 'no início';
    if (minutos < 60) return `+${minutos} min`;
    if (minutos < 1440) return `+${Math.round((minutos / 60) * 10) / 10} h`;
    return `+${Math.round((minutos / 1440) * 10) / 10} dias`;
  });
}

export default function GroupCadenceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const nova = !id || id === 'nova';

  const { data: cadencia, isLoading } = useGroupCadence(id);
  const { data: passosSalvos } = useGroupCadenceSteps(id);
  const { data: envios = [] } = useGroupCadenceSends(id);
  const { data: grupos = [], isLoading: carregandoGrupos } = useWaGroups();

  const salvarCadencia = useSaveGroupCadence();
  const salvarPassos = useSaveCadenceSteps();
  const iniciar = useStartGroupCadence();
  const mudarStatus = useSetCadenceStatus();

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [janelaInicio, setJanelaInicio] = useState('08:00');
  const [janelaFim, setJanelaFim] = useState('21:00');
  const [maxPorRodada, setMaxPorRodada] = useState(8);
  const [passos, setPassos] = useState<PassoLocal[]>([novoPasso(true)]);
  const [buscaGrupo, setBuscaGrupo] = useState('');

  useEffect(() => {
    if (!cadencia) return;
    setNome(cadencia.name);
    setDescricao(cadencia.description || '');
    setSelecionados(cadencia.group_jids || []);
    setJanelaInicio((cadencia.window_start || '08:00').slice(0, 5));
    setJanelaFim((cadencia.window_end || '21:00').slice(0, 5));
    setMaxPorRodada(cadencia.max_per_run ?? 8);
  }, [cadencia]);

  useEffect(() => {
    if (!passosSalvos?.length) return;
    setPassos(passosSalvos.map((p) => ({ ...p, _key: p.id })));
  }, [passosSalvos]);

  const gruposFiltrados = useMemo(() => {
    const q = buscaGrupo.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => (g.name || '').toLowerCase().includes(q));
  }, [grupos, buscaGrupo]);

  const cronograma = useMemo(() => cronogramaLegivel(passos), [passos]);
  const totalEnvios = selecionados.length * passos.filter((p) => (p.message || '').trim()).length;

  const enviadosPorPasso = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of envios as any[]) {
      if (e.status === 'sent') m[e.step_id] = (m[e.step_id] || 0) + 1;
    }
    return m;
  }, [envios]);

  const atualizarPasso = (key: string, patch: Partial<GroupCadenceStep>) =>
    setPassos((ps) => ps.map((p) => (p._key === key ? { ...p, ...patch } : p)));

  const moverPasso = (i: number, dir: -1 | 1) =>
    setPassos((ps) => {
      const j = i + dir;
      if (j < 0 || j >= ps.length) return ps;
      const copia = [...ps];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  async function salvar(): Promise<string | null> {
    if (!nome.trim()) { toast.error('Dê um nome pra cadência'); return null; }
    if (!selecionados.length) { toast.error('Selecione pelo menos um grupo'); return null; }
    const validos = passos.filter((p) => (p.message || '').trim());
    if (!validos.length) { toast.error('Escreva pelo menos uma mensagem'); return null; }

    const salva = await salvarCadencia.mutateAsync({
      id: nova ? undefined : id,
      name: nome.trim(),
      description: descricao.trim() || null,
      group_jids: selecionados as any,
      window_start: janelaInicio,
      window_end: janelaFim,
      max_per_run: maxPorRodada,
    });

    await salvarPassos.mutateAsync({ cadenceId: salva.id, steps: validos });
    toast.success('Cadência salva');
    if (nova) navigate(`/admin/marketing/cadencias-grupo/${salva.id}`, { replace: true });
    return salva.id;
  }

  const rodando = cadencia?.status === 'running';
  const concluida = cadencia?.status === 'completed';
  const salvando = salvarCadencia.isPending || salvarPassos.isPending;

  if (isLoading && !nova) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* cabeçalho */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/marketing/automacoes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {nova ? 'Nova cadência em grupos' : nome || 'Cadência'}
                </h1>
                {cadencia && (
                  <Badge
                    className={cn(
                      'text-[10px]',
                      rodando && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                      concluida && 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                    )}
                    variant={rodando || concluida ? 'outline' : 'secondary'}
                  >
                    {{ draft: 'Rascunho', running: 'Rodando', paused: 'Pausada', completed: 'Concluída' }[
                      cadencia.status
                    ]}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                As mensagens são postadas <strong>dentro dos grupos</strong>, na ordem e no intervalo abaixo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!nova && rodando && (
              <Button
                variant="outline" size="sm" className="gap-1.5"
                onClick={() => mudarStatus.mutate({ id: id!, status: 'paused' })}
              >
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
            )}
            {!nova && !rodando && !concluida && (
              <Button
                variant="outline" size="sm" className="gap-1.5"
                onClick={async () => {
                  const salvo = await salvar();
                  if (salvo) iniciar.mutate(salvo);
                }}
                disabled={iniciar.isPending || salvando}
              >
                {iniciar.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Play className="h-3.5 w-3.5" />}
                Iniciar agora
              </Button>
            )}
            <Button
              size="sm" className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5"
              onClick={salvar} disabled={salvando}
            >
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* coluna esquerda: configuração + grupos */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={nome} onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Aquecimento Reprograme-se 10X"
                    className="mt-1.5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    rows={2} placeholder="Pra que serve essa sequência?"
                    className="mt-1.5 text-sm resize-none"
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Não enviar antes de</Label>
                    <Input
                      type="time" value={janelaInicio}
                      onChange={(e) => setJanelaInicio(e.target.value)}
                      className="mt-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nem depois de</Label>
                    <Input
                      type="time" value={janelaFim}
                      onChange={(e) => setJanelaFim(e.target.value)}
                      className="mt-1.5 text-sm"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Horário de Brasília. Fora dessa janela a cadência espera — ninguém recebe mensagem de madrugada.
                </p>

                <div>
                  <Label className="text-xs">Grupos por rodada (a cada 5 min)</Label>
                  <Input
                    type="number" min={1} max={50} value={maxPorRodada}
                    onChange={(e) => setMaxPorRodada(Number(e.target.value) || 8)}
                    className="mt-1.5 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Segura o ritmo pra não parecer disparo em massa. Com {maxPorRodada}, dá ~
                    {maxPorRodada * 12} grupos por hora.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Grupos
                  </Label>
                  <Badge variant="outline" className="text-[10px]">
                    {selecionados.length} de {grupos.length}
                  </Badge>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={buscaGrupo} onChange={(e) => setBuscaGrupo(e.target.value)}
                    placeholder="Buscar grupo..." className="pl-8 text-sm h-8"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" className="text-[11px] h-7 flex-1"
                    onClick={() => setSelecionados(gruposFiltrados.map((g) => g.group_jid))}
                  >
                    Selecionar {buscaGrupo ? 'filtrados' : 'todos'}
                  </Button>
                  <Button
                    variant="outline" size="sm" className="text-[11px] h-7 flex-1"
                    onClick={() => setSelecionados([])}
                  >
                    Limpar
                  </Button>
                </div>

                <ScrollArea className="h-[360px] pr-3">
                  {carregandoGrupos ? (
                    <div className="text-xs text-muted-foreground py-4">Carregando grupos...</div>
                  ) : gruposFiltrados.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4">
                      Nenhum grupo. Sincronize em <span className="font-mono">/admin/grupos</span>.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {gruposFiltrados.map((g) => {
                        const marcado = selecionados.includes(g.group_jid);
                        return (
                          <label
                            key={g.group_jid}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors',
                              marcado ? 'bg-[#BAA05E]/10' : 'hover:bg-muted/50',
                            )}
                          >
                            <Checkbox
                              checked={marcado}
                              onCheckedChange={(v) =>
                                setSelecionados((s) =>
                                  v ? [...s, g.group_jid] : s.filter((x) => x !== g.group_jid),
                                )
                              }
                            />
                            <span className="flex-1 truncate">{g.name || g.group_jid}</span>
                            {g.participants_count ? (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {g.participants_count}
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* coluna direita: sequência */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Sequência de mensagens
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {totalEnvios > 0
                        ? `${passos.length} passo(s) × ${selecionados.length} grupo(s) = ${totalEnvios} envios`
                        : 'Escolha os grupos e escreva as mensagens'}
                    </p>
                  </div>
                  <Button
                    variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setPassos((ps) => [...ps, novoPasso(ps.length === 0)])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Passo
                  </Button>
                </div>

                <div className="space-y-3">
                  {passos.map((p, i) => {
                    const jaEnviados = p.id ? enviadosPorPasso[p.id] || 0 : 0;
                    return (
                      <div key={p._key} className="border rounded-xl p-3 space-y-3 relative">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-7 h-7 rounded-lg bg-[#25d366]/10 text-[#128C7E] flex items-center justify-center text-xs font-semibold shrink-0">
                            {i + 1}
                          </div>

                          {i === 0 ? (
                            <Badge variant="outline" className="text-[10px]">
                              <Clock className="h-3 w-3 mr-1" /> no início
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">esperar</span>
                              <Input
                                type="number" min={0} value={p.delay_value ?? 0}
                                onChange={(e) =>
                                  atualizarPasso(p._key, { delay_value: Number(e.target.value) || 0 })
                                }
                                className="w-16 h-7 text-xs"
                              />
                              <Select
                                value={p.delay_unit || 'dias'}
                                onValueChange={(v) => atualizarPasso(p._key, { delay_unit: v as DelayUnit })}
                              >
                                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="minutos">minutos</SelectItem>
                                  <SelectItem value="horas">horas</SelectItem>
                                  <SelectItem value="dias">dias</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <Badge variant="secondary" className="text-[10px]">{cronograma[i]}</Badge>

                          {jaEnviados > 0 && (
                            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> enviado em {jaEnviados} grupo(s)
                            </Badge>
                          )}

                          <div className="ml-auto flex items-center gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => moverPasso(i, -1)} disabled={i === 0}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => moverPasso(i, 1)} disabled={i === passos.length - 1}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setPassos((ps) => ps.filter((x) => x._key !== p._key))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <Textarea
                          value={p.message || ''}
                          onChange={(e) => atualizarPasso(p._key, { message: e.target.value })}
                          rows={4}
                          placeholder="O que vai ser postado no grupo..."
                          className="text-sm resize-none"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
                          {/* O tipo não é mais escolhido à mão: sai do próprio arquivo.
                              Escolher "imagem" e anexar um PDF fazia a uazapi recusar o envio. */}
                          <MediaDropzone
                            value={p.media_url || ''}
                            tipo={(p.media_type as any) || null}
                            onChange={(url, tipo) =>
                              atualizarPasso(p._key, {
                                media_url: url || null,
                                media_type: tipo,
                              })
                            }
                          />
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              Horário fixo (opcional)
                            </Label>
                            <Input
                              type="time"
                              value={p.send_at_time ? String(p.send_at_time).slice(0, 5) : ''}
                              onChange={(e) => atualizarPasso(p._key, { send_at_time: e.target.value || null })}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Use <span className="font-mono">{'{{grupo}}'}</span> pra citar o nome do grupo.
                          O horário fixo, quando preenchido, manda nesse horário do dia calculado.
                        </p>
                      </div>
                    );
                  })}

                  {passos.length === 0 && (
                    <div className="text-center py-10 text-sm text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Nenhum passo ainda.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* log de envio */}
            {!nova && envios.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Últimos envios
                    </Label>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {cadencia?.sent_count ?? 0} enviados
                      </span>
                      {(cadencia?.failed_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-destructive" />
                          {cadencia?.failed_count} falhas
                        </span>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="h-[200px] pr-3">
                    <div className="space-y-1">
                      {(envios as any[]).map((e) => (
                        <div key={e.id} className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0">
                          {e.status === 'sent' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : e.status === 'failed' ? (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          ) : (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                          )}
                          <span className="flex-1 truncate">{e.group_name || e.group_jid}</span>
                          {e.error && (
                            <span className="text-[10px] text-destructive truncate max-w-[200px]">{e.error}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {format(new Date(e.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {!nova && cadencia?.started_at && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Começou {formatDistanceToNow(new Date(cadencia.started_at), { addSuffix: true, locale: ptBR })}
                {' · '}o motor roda a cada 5 minutos
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
