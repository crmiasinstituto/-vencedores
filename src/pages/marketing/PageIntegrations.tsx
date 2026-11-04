import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PlugZap, Plus, Copy, Check, Loader2, Trash2, Settings2, Code2, Workflow, Inbox, X, FlaskConical,
  ExternalLink, ArrowRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import MarketingPageHeader from '@/components/marketing-mod/MarketingPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAudienceOptions } from '@/hooks/useAudienceOptions';
import { useEmailAutomations } from '@/hooks/useEmailAutomations';
import {
  usePageIntegrations, usePageIntegrationSubmissions, useSavePageIntegration, useTogglePageIntegration,
  useDeletePageIntegration, useTestPageIntegration, capturaEndpoint, slugify, CAPTURA_BASE_URL,
  type PageIntegration, type PageIntegrationInput,
} from '@/hooks/usePageIntegrations';
import { cn } from '@/lib/utils';

const STATUS_ENVIO: Record<string, { label: string; classe: string }> = {
  novo:       { label: 'Lead novo',   classe: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  atualizado: { label: 'Já existia',  classe: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  teste:      { label: 'Teste',       classe: 'bg-muted text-muted-foreground' },
  erro:       { label: 'Erro',        classe: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const VAZIA: PageIntegrationInput = {
  name: '', slug: '', board_id: '', column_id: null, tags: [], redirect_url: null, success_message: null, is_active: true,
};

export default function PageIntegrations() {
  const { data: integracoes = [], isLoading } = usePageIntegrations();
  const toggle = useTogglePageIntegration();
  const [aberta, setAberta] = useState<{ integracao: PageIntegration | null; aba: string } | null>(null);

  // Mantém o modal apontando pra versão mais nova da integração depois de salvar
  const atual = aberta?.integracao ? integracoes.find((i) => i.id === aberta.integracao!.id) || aberta.integracao : null;

  return (
    <AppLayout>
      <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
        <MarketingPageHeader
          eyebrow="Marketing · Captura"
          title="Captura de Páginas"
          description="Ligue qualquer landing page ao CRM: escolha o quadro, a coluna e as tags, cole o código na página e dispare automações de e-mail a cada inscrição."
          action={
            <Button
              size="sm"
              className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5"
              onClick={() => setAberta({ integracao: null, aba: 'config' })}
            >
              <Plus className="h-3.5 w-3.5" /> Nova integração
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#BAA05E]" /></div>
        ) : integracoes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <PlugZap className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="font-medium">Nenhuma página ligada ainda</p>
              <p className="text-sm text-muted-foreground">Crie uma integração e o CRM gera o código pra colar na sua landing page.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {integracoes.map((i) => (
              <Card key={i.id} className={cn('transition-opacity', !i.is_active && 'opacity-60')}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{i.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        {i.board?.name || 'Quadro removido'}
                        <ArrowRight className="h-3 w-3" />
                        {i.column?.name || 'primeira coluna'}
                      </p>
                    </div>
                    <Switch
                      checked={i.is_active}
                      onCheckedChange={(v) => toggle.mutate({ id: i.id, is_active: v })}
                      aria-label={i.is_active ? 'Pausar integração' : 'Ativar integração'}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[22px]">
                    {i.tags.map((t) => <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>)}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-semibold tabular-nums">{i.total_received}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.last_received_at
                          ? `último ${formatDistanceToNow(new Date(i.last_received_at), { addSuffix: true, locale: ptBR })}`
                          : 'nenhum envio ainda'}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAberta({ integracao: i, aba: 'instalar' })}>
                        <Code2 className="h-3.5 w-3.5" /> Código
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAberta({ integracao: i, aba: 'config' })}>
                        <Settings2 className="h-3.5 w-3.5" /> Abrir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!aberta} onOpenChange={(v) => !v && setAberta(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{atual ? atual.name : 'Nova integração de página'}</DialogTitle>
          </DialogHeader>
          {aberta && (
            <Tabs value={aberta.aba} onValueChange={(aba) => setAberta({ ...aberta, aba })}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="config" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Destino</TabsTrigger>
                <TabsTrigger value="instalar" disabled={!atual} className="gap-1.5"><Code2 className="h-3.5 w-3.5" /> Instalar na página</TabsTrigger>
                <TabsTrigger value="automacao" disabled={!atual} className="gap-1.5"><Workflow className="h-3.5 w-3.5" /> Automação</TabsTrigger>
                <TabsTrigger value="envios" disabled={!atual} className="gap-1.5"><Inbox className="h-3.5 w-3.5" /> Envios</TabsTrigger>
              </TabsList>
              <TabsContent value="config" className="mt-5">
                <ConfigTab
                  key={atual?.id || 'nova'}
                  integracao={atual}
                  onSaved={(salva, nova) => setAberta({ integracao: salva, aba: nova ? 'instalar' : 'config' })}
                  onDeleted={() => setAberta(null)}
                />
              </TabsContent>
              {atual && (
                <>
                  <TabsContent value="instalar" className="mt-5"><InstalarTab integracao={atual} /></TabsContent>
                  <TabsContent value="automacao" className="mt-5"><AutomacaoTab integracao={atual} /></TabsContent>
                  <TabsContent value="envios" className="mt-5"><EnviosTab integracao={atual} /></TabsContent>
                </>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ------------------------------------------------------------------ Destino (quadro, coluna, tags)
function ConfigTab({ integracao, onSaved, onDeleted }: {
  integracao: PageIntegration | null;
  onSaved: (i: PageIntegration, nova: boolean) => void;
  onDeleted: () => void;
}) {
  const save = useSavePageIntegration();
  const remove = useDeletePageIntegration();
  const { data: opts, isLoading: carregandoOpcoes } = useAudienceOptions();
  const [form, setForm] = useState<PageIntegrationInput>(() =>
    integracao
      ? {
          id: integracao.id, name: integracao.name, slug: integracao.slug, board_id: integracao.board_id,
          column_id: integracao.column_id, tags: integracao.tags, redirect_url: integracao.redirect_url,
          success_message: integracao.success_message, is_active: integracao.is_active,
        }
      : VAZIA,
  );
  const [novaTag, setNovaTag] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const isNova = !integracao;

  const colunas = (opts?.allColumns || []).filter((c) => c.board_id === form.board_id);
  const set = (patch: Partial<PageIntegrationInput>) => setForm((f) => ({ ...f, ...patch }));

  const addTag = (t: string) => {
    const tag = t.trim();
    if (tag && !form.tags.includes(tag)) set({ tags: [...form.tags, tag] });
    setNovaTag('');
  };

  const salvar = async () => {
    const tags = novaTag.trim() && !form.tags.includes(novaTag.trim()) ? [...form.tags, novaTag.trim()] : form.tags;
    const payload: PageIntegrationInput = {
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug || form.name),
      tags: tags.length > 0 ? tags : [form.name.trim()],
      redirect_url: form.redirect_url?.trim() || null,
      success_message: form.success_message?.trim() || null,
    };
    setNovaTag('');
    const salva = await save.mutateAsync(payload);
    onSaved(salva, isNova);
  };

  const podeSalvar = form.name.trim() && form.board_id && !save.isPending;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome da integração *</Label>
          <Input
            value={form.name}
            onChange={(e) => set({ name: e.target.value, ...(isNova ? { slug: slugify(e.target.value) } : {}) })}
            placeholder="Ex: Operação 50K"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Identificador</Label>
          <Input value={form.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} disabled={!isNova} />
          <p className="text-[11px] text-muted-foreground">
            {isNova ? 'Vai no código da página. Não dá pra trocar depois.' : 'Fixo: a página já usa esse identificador.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Quadro (kanban) *</Label>
          <Select value={form.board_id} onValueChange={(v) => set({ board_id: v, column_id: null })}>
            <SelectTrigger><SelectValue placeholder={carregandoOpcoes ? 'Carregando...' : 'Escolha o quadro'} /></SelectTrigger>
            <SelectContent>
              {(opts?.boards || []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Coluna de entrada</Label>
          <Select
            value={form.column_id || 'primeira'}
            onValueChange={(v) => set({ column_id: v === 'primeira' ? null : v })}
            disabled={!form.board_id}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="primeira">Primeira coluna do quadro</SelectItem>
              {colunas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tags do lead</Label>
        <div className="flex flex-wrap gap-1.5 rounded-md border p-2 min-h-[42px]">
          {form.tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 pr-1">
              {t}
              <button type="button" onClick={() => set({ tags: form.tags.filter((x) => x !== t) })} aria-label={`Remover ${t}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <input
            list="captura-tags"
            value={novaTag}
            onChange={(e) => setNovaTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(novaTag); }
            }}
            onBlur={() => novaTag && addTag(novaTag)}
            placeholder={form.tags.length ? 'Adicionar tag...' : 'Digite e aperte Enter'}
            className="flex-1 min-w-[140px] bg-transparent text-sm outline-none px-1"
          />
          <datalist id="captura-tags">
            {(opts?.tags || []).slice(0, 200).map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Toda inscrição recebe essas tags, inclusive quem já era lead. É por elas que a automação dispara.
          Sem tag, usamos o nome da integração.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Depois de enviar, ir para (opcional)</Label>
          <Input
            value={form.redirect_url || ''}
            onChange={(e) => set({ redirect_url: e.target.value })}
            placeholder="https://seusite.com.br/obrigado"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Mensagem de sucesso (opcional)</Label>
          <Textarea
            rows={1}
            value={form.success_message || ''}
            onChange={(e) => set({ success_message: e.target.value })}
            placeholder="Inscrição confirmada!"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Integração ativa</p>
          <p className="text-xs text-muted-foreground">Pausada, a página recebe erro e nenhum lead entra.</p>
        </div>
        <Switch checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
      </div>

      <div className="flex items-center justify-between pt-1">
        {integracao ? (
          <Button variant="ghost" size="sm" className="text-red-600 gap-1.5" onClick={() => setConfirmarExclusao(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir integração
          </Button>
        ) : <span />}
        <Button onClick={salvar} disabled={!podeSalvar} className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5">
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isNova ? 'Criar e gerar código' : 'Salvar'}
        </Button>
      </div>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{integracao?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A página que usa essa integração para de enviar leads. Os leads que já entraram continuam no CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => { await remove.mutateAsync(integracao!.id); onDeleted(); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ------------------------------------------------------------------ Instalar na página
function CodeBox({ titulo, descricao, codigo }: { titulo: string; descricao: string; codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () =>
    navigator.clipboard.writeText(codigo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{titulo}</p>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
        <Button size="sm" variant="outline" onClick={copiar} className="gap-1.5 shrink-0">
          {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <pre className="text-[11px] leading-relaxed bg-muted/60 border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">{codigo}</pre>
    </div>
  );
}

function InstalarTab({ integracao }: { integracao: PageIntegration }) {
  const teste = useTestPageIntegration();
  const script = `<script src="${CAPTURA_BASE_URL}/captura.js" data-integracao="${integracao.slug}" data-chave="${integracao.public_key}" defer></script>`;
  const formulario = `<form>
  <input name="nome" placeholder="Seu nome" required>
  <input name="email" type="email" placeholder="Seu melhor e-mail">
  <input name="telefone" type="tel" placeholder="WhatsApp com DDD" required>
  <button type="submit">Quero participar</button>
</form>
${script}`;

  return (
    <div className="space-y-6">
      {!integracao.is_active && (
        <p className="text-sm rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 p-3">
          Essa integração está pausada. Ative em "Destino" pra página conseguir enviar leads.
        </p>
      )}
      <CodeBox
        titulo="1. Página que já tem formulário (recomendado)"
        descricao="Cole no final da página. O código encontra sozinho os campos de nome, e-mail e WhatsApp."
        codigo={script}
      />
      <CodeBox
        titulo="2. Página sem formulário"
        descricao="Formulário pronto + código. Cole onde o formulário deve aparecer."
        codigo={formulario}
      />
      <CodeBox
        titulo="3. Webhook (Elementor, Hotmart, Typeform, n8n...)"
        descricao="Envie POST em JSON ou formulário com os campos nome, email e telefone."
        codigo={capturaEndpoint(integracao)}
      />
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Testar a ligação</p>
          <p className="text-xs text-muted-foreground">Confere chave, quadro e campos sem criar card. O resultado aparece em "Envios".</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => teste.mutate(integracao)} disabled={teste.isPending}>
          {teste.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          Enviar teste
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Automação de e-mail
function AutomacaoTab({ integracao }: { integracao: PageIntegration }) {
  const navigate = useNavigate();
  const { data: automacoes = [], isLoading } = useEmailAutomations();
  const [tag, setTag] = useState(integracao.tags[0] || '');
  useEffect(() => { if (!integracao.tags.includes(tag)) setTag(integracao.tags[0] || ''); }, [integracao.tags, tag]);

  const ligadas = useMemo(
    () => automacoes.filter((a) => {
      const f = a.trigger_filter || {};
      if (a.trigger_event === 'lead_tag_added') return integracao.tags.includes(f.tag);
      if (a.trigger_event === 'lead_created') return f.source === `pagina:${integracao.slug}` || (f.board_id === integracao.board_id && !f.source);
      return false;
    }),
    [automacoes, integracao],
  );

  const criar = () => {
    const p = new URLSearchParams({ gatilho: 'lead_tag_added', tag, nome: `Boas-vindas · ${integracao.name}` });
    navigate(`/admin/marketing/automacoes/nova?${p.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Disparar uma automação a cada inscrição</p>
          <p className="text-xs text-muted-foreground">
            Abre o editor de automações com o gatilho "Tag adicionada" já apontando pra tag dessa página.
            Lá você monta a sequência com e-mail, WhatsApp, convite pro grupo, tarefa pro vendedor,
            mover no funil... e ativa. Roda toda vez que a pessoa preencher a página, mesmo que já seja lead.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {integracao.tags.length > 1 && (
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {integracao.tags.map((t) => <SelectItem key={t} value={t}>Tag: {t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={criar} disabled={!tag} className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Criar automação
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Automações ligadas a essa página</p>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : ligadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ainda.</p>
        ) : (
          ligadas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/admin/marketing/automacoes/${a.id}`)}
              className="w-full flex items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.trigger_event === 'lead_tag_added' ? `Tag adicionada: ${a.trigger_filter?.tag}` : 'Lead criado no quadro'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={a.is_active ? STATUS_ENVIO.novo.classe : ''}>
                  {a.is_active ? 'Ativa' : 'Desligada'}
                </Badge>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Envios
function EnviosTab({ integracao }: { integracao: PageIntegration }) {
  const { data: envios = [], isLoading } = usePageIntegrationSubmissions(integracao.id);
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (envios.length === 0) return <p className="text-sm text-muted-foreground">Nenhum envio ainda. Use "Enviar teste" em "Instalar na página".</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Últimos 30 envios · atualiza sozinho</p>
      {envios.map((e) => {
        const p = e.payload || {};
        const st = STATUS_ENVIO[e.status] || STATUS_ENVIO.erro;
        return (
          <div key={e.id} className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium truncate">{p.nome || p.name || '(sem nome)'}</p>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={st.classe}>{st.label}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {[p.email, p.telefone || p.phone || p.whatsapp, p.utm_source && `utm: ${p.utm_source}`].filter(Boolean).join(' · ')}
            </p>
            {e.error && <p className="text-xs text-red-600">{e.error}</p>}
          </div>
        );
      })}
    </div>
  );
}
