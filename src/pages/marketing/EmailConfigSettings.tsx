import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Mail, Webhook, Building2, Send, Save, KeyRound, Copy, CheckCircle2,
  AlertCircle, ShieldCheck, Loader2, ExternalLink,
} from 'lucide-react';
import {
  useEmailConfig,
  useSaveEmailConfig,
  useSendTestEmail,
} from '@/hooks/useEmailConfig';
import { cn } from '@/lib/utils';

const SUPABASE_PROJECT_REF = 'iymlwsawrmghhbawiavz';
const WEBHOOK_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/process-email-event`;
const UNSUBSCRIBE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/email-unsubscribe`;

interface FormState {
  resend_api_key: string;
  resend_webhook_secret: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  company_name: string;
  company_address: string;
  app_url: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  resend_api_key: '',
  resend_webhook_secret: '',
  from_email: '',
  from_name: '',
  reply_to: '',
  company_name: '',
  company_address: '',
  app_url: '',
  is_active: false,
};

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
      <code className="flex-1 truncate font-mono">{url}</code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-0 font-medium',
        ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

export default function EmailConfigSettings() {
  const { data: config, isLoading } = useEmailConfig();
  const save = useSaveEmailConfig();
  const sendTest = useSendTestEmail();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [testEmail, setTestEmail] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      resend_api_key: config.resend_api_key || '',
      resend_webhook_secret: config.resend_webhook_secret || '',
      from_email: config.from_email || '',
      from_name: config.from_name || '',
      reply_to: config.reply_to || '',
      company_name: config.company_name || '',
      company_address: config.company_address || '',
      app_url: config.app_url || 'https://squaadcrm.com',
      is_active: !!config.is_active,
    });
  }, [config?.updated_at]);

  const status = useMemo(() => ({
    // `tem_api_key` é coluna gerada no banco. A chave em si não vem mais pro browser,
    // então testar `!!config.resend_api_key` daria sempre falso.
    apiKey: !!(config as any)?.tem_api_key,
    webhook: !!config?.resend_webhook_secret,
    fromEmail: !!config?.from_email,
    active: !!config?.is_active,
  }), [config]);

  const canActivate = status.apiKey && status.fromEmail;

  const handleSave = async () => {
    if (!form.from_email && form.is_active) {
      toast.error('from_email obrigatório para ativar.');
      return;
    }
    try {
      await save.mutateAsync({
        resend_api_key: form.resend_api_key || null,
        resend_webhook_secret: form.resend_webhook_secret || null,
        from_email: form.from_email || null,
        from_name: form.from_name || null,
        reply_to: form.reply_to || null,
        company_name: form.company_name || null,
        company_address: form.company_address || null,
        app_url: form.app_url || null,
        is_active: form.is_active,
      });
      toast.success('Configurações salvas');
    } catch (err: any) {
      toast.error(`Erro: ${err.message || 'falha ao salvar'}`);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error('Informa um email pra teste');
      return;
    }
    if (!status.apiKey || !status.fromEmail || !status.active) {
      toast.error('Salve a config e ative antes de testar');
      return;
    }
    try {
      await sendTest.mutateAsync({
        to: testEmail,
        subject: 'Teste de configuração + que Vencedores Marketing',
        html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#BAA05E;">Olá {{primeiro_nome}}!</h2>
          <p>Este é um <strong>email de teste</strong> do módulo Marketing do + que Vencedores CRM.</p>
          <p>Se você está lendo isso, significa que:</p>
          <ul>
            <li>✅ Resend API key está OK</li>
            <li>✅ Domínio verificado</li>
            <li>✅ Edge function <code>send-email-campaign</code> rodando</li>
          </ul>
          <p>Agora você já pode criar campanhas reais.</p>
          <p style="margin-top:24px;color:#888;font-size:12px;">Enviado de ${form.from_email || 'seu CRM'} · {{empresa}}</p>
        </body></html>`,
      });
      toast.success(`Teste enviado para ${testEmail}. Confira a caixa de entrada.`);
    } catch (err: any) {
      toast.error(`Falha: ${err.message || 'verifique a config'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando configurações...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <header className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
            Marketing · Configurações
          </span>
          <h1 className="text-2xl font-semibold mt-1 leading-tight tracking-tight">
            Email Config
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurações do Resend para envio de emails em massa e automações.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <StatusPill ok={status.apiKey} label="API key" />
          <StatusPill ok={status.fromEmail} label="from_email" />
          <StatusPill ok={status.webhook} label="Webhook" />
          <StatusPill ok={status.active} label={status.active ? 'Ativo' : 'Inativo'} />
        </div>
      </header>

      {!status.active && canActivate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Tudo pronto, mas inativo</p>
            <p className="text-amber-800/80">
              Liga o toggle "Ativar envio" abaixo e salva pra começar a enviar emails.
            </p>
          </div>
        </div>
      )}

      {/* ====== CREDENCIAIS RESEND ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-[#BAA05E]" />
            Credenciais Resend
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pega em{' '}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground inline-flex items-center gap-0.5"
            >
              resend.com/api-keys <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type={showSecrets ? 'text' : 'password'}
              placeholder="re_..."
              value={form.resend_api_key}
              onChange={(e) => setForm({ ...form, resend_api_key: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhook">Webhook Secret (opcional)</Label>
            <Input
              id="webhook"
              type={showSecrets ? 'text' : 'password'}
              placeholder="whsec_..."
              value={form.resend_webhook_secret}
              onChange={(e) => setForm({ ...form, resend_webhook_secret: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Sem secret, webhook ainda funciona mas sem validação Svix (modo permissivo).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowSecrets((v) => !v)}
              className="text-muted-foreground hover:text-foreground underline"
            >
              {showSecrets ? 'Esconder' : 'Mostrar'} valores
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ====== WEBHOOK URL ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4 text-[#BAA05E]" />
            Webhook do Resend
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cola esta URL em{' '}
            <a
              href="https://resend.com/webhooks"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground inline-flex items-center gap-0.5"
            >
              resend.com/webhooks <ExternalLink className="h-3 w-3" />
            </a>
            {' '}— eventos: <code className="text-[11px]">email.sent, delivered, opened, clicked, bounced, complained</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Endpoint URL</Label>
            <CopyableUrl url={WEBHOOK_URL} />
          </div>
          <div>
            <Label className="text-xs">URL de descadastro (List-Unsubscribe)</Label>
            <CopyableUrl url={UNSUBSCRIBE_URL} />
          </div>
        </CardContent>
      </Card>

      {/* ====== BRANDING ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-[#BAA05E]" />
            Remetente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Email e nome que aparecem no inbox do destinatário.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="from_email">From Email *</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="carloseduardo@squaad.com.br"
                value={form.from_email}
                onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                onBlur={(e) => {
                  // Auto-corrige squaad.com -> squaad.com.br (domínio verificado no Resend)
                  const v = e.target.value.trim();
                  if (v.endsWith("@squaad.com")) {
                    setForm({ ...form, from_email: v + ".br" });
                    toast.success("Auto-corrigido pra @squaad.com.br (domínio verificado)");
                  }
                }}
              />
              {form.from_email && form.from_email.endsWith("@squaad.com") && (
                <p className="text-xs text-amber-300 flex items-center gap-1">
                  ⚠️ <code>@squaad.com</code> não está verificado no Resend. Use <code>@squaad.com.br</code>.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Domínio verificado: <code className="text-emerald-400">@squaad.com.br</code>. Outros domínios precisam ser adicionados em{" "}
                <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline text-[#BAA05E]">resend.com/domains</a>.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from_name">From Name</Label>
              <Input
                id="from_name"
                placeholder="+ que Vencedores"
                value={form.from_name}
                onChange={(e) => setForm({ ...form, from_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="reply_to">Reply-To (opcional)</Label>
              <Input
                id="reply_to"
                type="email"
                placeholder="contato@squaad.com.br"
                value={form.reply_to}
                onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== LGPD ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-[#BAA05E]" />
            Identificação da empresa (LGPD)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aparece no footer obrigatório de cada email (junto ao link de descadastro).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company_name">Nome da empresa</Label>
              <Input
                id="company_name"
                placeholder="+ que Vencedores Empresarial"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app_url">URL do app</Label>
              <Input
                id="app_url"
                placeholder="https://squaadcrm.com"
                value={form.app_url}
                onChange={(e) => setForm({ ...form, app_url: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="company_address">Endereço</Label>
              <Textarea
                id="company_address"
                placeholder="Rua Exemplo, 123 — São Paulo/SP — CEP 00000-000"
                rows={2}
                value={form.company_address}
                onChange={(e) => setForm({ ...form, company_address: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====== ATIVAÇÃO ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-[#BAA05E]" />
            Ativação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="is_active" className="text-sm font-medium">
                Ativar envio de emails
              </Label>
              <p className="text-xs text-muted-foreground">
                {canActivate
                  ? 'Edges param de abortar e campanhas saem pra valer.'
                  : 'Preencha API key e from_email primeiro.'}
              </p>
            </div>
            <Switch
              id="is_active"
              checked={form.is_active}
              disabled={!canActivate}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border border-border/60">
        <Button
          variant="outline"
          onClick={() => config && setForm({
            resend_api_key: config.resend_api_key || '',
            resend_webhook_secret: config.resend_webhook_secret || '',
            from_email: config.from_email || '',
            from_name: config.from_name || '',
            reply_to: config.reply_to || '',
            company_name: config.company_name || '',
            company_address: config.company_address || '',
            app_url: config.app_url || 'https://squaadcrm.com',
            is_active: !!config.is_active,
          })}
        >
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={save.isPending} className="bg-[#BAA05E] hover:bg-[#917D3D] text-white">
          {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      {/* ====== TESTE DE ENVIO ====== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-[#BAA05E]" />
            Teste de envio
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Manda um email de teste com HTML padrão. Salve a config + ative antes.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="seu-email@dominio.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              onClick={handleTest}
              disabled={sendTest.isPending || !canActivate || !status.active}
            >
              {sendTest.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar teste
            </Button>
          </div>
          {!status.active && (
            <p className="text-xs text-amber-700">
              ⚠️ Edge aborta com "Email marketing inativo" se você não ativar primeiro.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
