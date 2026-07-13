import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Target, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  ExternalLink, AlertCircle, ShieldCheck, Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type CheckResult = {
  ok: boolean;
  label: string;
  error?: string;
  scopes_missing?: string[];
};

type ValidationState = {
  token?: CheckResult;
  ad_account?: CheckResult;
  page?: CheckResult;
  ig_business?: CheckResult;
  pixel?: CheckResult;
};

type FormState = {
  token: string;
  ad_account_id: string;
  page_id: string;
  ig_business_id: string;
  pixel_id: string;
  app_id: string;
  app_secret: string;
  capi_token: string;
};

const emptyForm: FormState = {
  token: '',
  ad_account_id: '',
  page_id: '',
  ig_business_id: '',
  pixel_id: '',
  app_id: '',
  app_secret: '',
  capi_token: '',
};

function StatusPill({ result, defaultLabel }: { result?: CheckResult; defaultLabel: string }) {
  if (!result) {
    return (
      <Badge variant="outline" className="gap-1.5 border-muted text-muted-foreground font-medium">
        <Info className="h-3 w-3" />
        Nao validado
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-0 font-medium',
        result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
      )}
    >
      {result.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {result.ok ? result.label : (result.error ?? defaultLabel)}
    </Badge>
  );
}

function FieldRow({
  id,
  label,
  hint,
  hintUrl,
  hintUrlLabel = 'Abrir no Meta',
  value,
  onChange,
  result,
  defaultLabel,
  type = 'text',
  optional = false,
  toggleSecret,
  showSecret,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  hintUrl?: string;
  hintUrlLabel?: string;
  value: string;
  onChange: (v: string) => void;
  result?: CheckResult;
  defaultLabel: string;
  type?: 'text' | 'password';
  optional?: boolean;
  toggleSecret?: () => void;
  showSecret?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {optional && <span className="ml-2 text-xs text-muted-foreground font-normal">(opcional)</span>}
        </Label>
        <StatusPill result={result} defaultLabel={defaultLabel} />
      </div>
      <div className="relative">
        <Input
          id={id}
          type={type === 'password' && !showSecret ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'font-mono text-sm',
            result?.ok && 'border-green-300',
            result && !result.ok && 'border-red-300',
            toggleSecret && 'pr-10',
          )}
        />
        {toggleSecret && (
          <button
            type="button"
            onClick={toggleSecret}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {(hint || hintUrl) && (
        <div className="text-xs text-muted-foreground flex items-start gap-2 flex-wrap">
          {hint && <span className="flex-1 min-w-0">{hint}</span>}
          {hintUrl && (
            <a
              href={hintUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-primary hover:bg-primary/10 hover:underline whitespace-nowrap"
            >
              {hintUrlLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      {result?.error && !result.ok && (
        <p className="text-xs text-red-600 flex items-start gap-1.5">
          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{result.error}</span>
        </p>
      )}
    </div>
  );
}

export default function MetaAdsIntegration() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [checks, setChecks] = useState<ValidationState>({});
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showCapi, setShowCapi] = useState(false);
  const [validatedAt, setValidatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega valores ja salvos (token vem mascarado, demais em claro)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_integration_keys_masked');
      if (error) {
        toast.error('Falha lendo integracoes existentes');
        setLoading(false);
        return;
      }
      const meta = (data ?? []).find((r: any) => r.service === 'meta_ads');
      if (meta) {
        const m = (meta.metadata ?? {}) as Record<string, string>;
        setForm({
          token: '', // nunca preencher token mascarado, deixar vazio pra usuario digitar de novo se quiser trocar
          ad_account_id: meta.account_id ?? '',
          page_id: m.page_id ?? '',
          ig_business_id: m.ig_business_id ?? '',
          pixel_id: m.pixel_id ?? '',
          app_id: m.app_id ?? '',
          app_secret: '',
          capi_token: m.capi_token ?? '',
        });
        setValidatedAt(m.validated_at ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Limpa o check daquele campo quando o usuario edita
    if (key === 'token') setChecks({});
    else if (key === 'ad_account_id') setChecks((p) => ({ ...p, ad_account: undefined }));
    else if (key === 'page_id') setChecks((p) => ({ ...p, page: undefined }));
    else if (key === 'ig_business_id') setChecks((p) => ({ ...p, ig_business: undefined }));
    else if (key === 'pixel_id') setChecks((p) => ({ ...p, pixel: undefined }));
  };

  const handleValidate = async () => {
    if (!form.token.trim()) {
      toast.error('Cole o token primeiro pra validar');
      return;
    }
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-meta', {
        body: {
          action: 'validate',
          token: form.token.trim(),
          ad_account_id: form.ad_account_id.trim(),
          page_id: form.page_id.trim(),
          ig_business_id: form.ig_business_id.trim(),
          pixel_id: form.pixel_id.trim(),
        },
      });
      if (error) {
        toast.error('Erro validando: ' + error.message);
        return;
      }
      if (!data?.success) {
        toast.error(data?.error ?? 'Validacao falhou');
        return;
      }
      setChecks(data.checks);
      if (data.all_ok) {
        toast.success('Todas as credenciais obrigatorias OK. Pode salvar.');
      } else {
        toast.warning('Algumas credenciais falharam, veja os detalhes abaixo.');
      }
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!checks.token?.ok || !checks.ad_account?.ok) {
      toast.error('Token e Ad Account precisam estar validados pra salvar');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketing-meta', {
        body: {
          action: 'save',
          token: form.token.trim(),
          ad_account_id: form.ad_account_id.trim(),
          page_id: form.page_id.trim(),
          ig_business_id: form.ig_business_id.trim() || undefined,
          pixel_id: form.pixel_id.trim(),
          app_id: form.app_id.trim() || undefined,
          app_secret: form.app_secret.trim() || undefined,
          capi_token: form.capi_token.trim() || undefined,
        },
      });
      if (error) {
        toast.error('Erro salvando: ' + error.message);
        return;
      }
      if (!data?.success) {
        toast.error(data?.error ?? 'Falha ao salvar');
        return;
      }
      setValidatedAt(data.validated_at);
      toast.success('Meta Ads configurado e validado. O agente Midia ja consegue ler insights e estruturar campanhas.');
    } finally {
      setSaving(false);
    }
  };

  // Mínimo pra salvar: token + ad_account validados.
  // Page e pixel podem ficar pendentes (CRM busca depois via API ou usuário cola).
  const minSaveOk = checks.token?.ok && checks.ad_account?.ok;
  const allRequiredOk = minSaveOk && checks.page?.ok && checks.pixel?.ok;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Target className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">Integracao Meta Ads</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Conecte o BM, ad account, page, IG e pixel pra o agente Midia subir campanhas, criar adsets e ler insights reais nos 3 periodos via Graph API v21.0.
          </p>
        </div>
        {validatedAt && (
          <Badge variant="outline" className="gap-1.5 bg-green-50 text-green-700 border-0">
            <ShieldCheck className="h-3 w-3" />
            Validado em {new Date(validatedAt).toLocaleString('pt-BR')}
          </Badge>
        )}
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-amber-900">
                Antes de comecar, leia o passo a passo no repo:
              </p>
              <a
                href="https://github.com/squaad-empresarial/squaad-crm/blob/main/docs/meta-ads-setup.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber-900 underline hover:text-amber-700"
              >
                docs/meta-ads-setup.md
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="text-amber-800/80 text-xs">
                Ele explica como achar cada um dos 5 valores obrigatorios e dos 3 opcionais, com prints e troubleshooting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credenciais obrigatorias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FieldRow
            id="token"
            label="System User Access Token"
            hint="Business Settings, Usuarios do Sistema, seu System User, Gerar Token. Marque 7 scopes: ads_management, ads_read, business_management, pages_read_engagement, pages_manage_ads, instagram_basic, read_insights."
            hintUrl="https://business.facebook.com/settings/system-users"
            hintUrlLabel="Abrir System Users"
            value={form.token}
            onChange={(v) => updateField('token', v)}
            result={checks.token}
            defaultLabel="Token"
            type="password"
            placeholder="EAAB..."
            toggleSecret={() => setShowToken((s) => !s)}
            showSecret={showToken}
          />

          <FieldRow
            id="ad_account_id"
            label="Ad Account ID"
            hint="Ads Manager, canto superior esquerdo, seletor de conta. Apenas digitos, sem o prefixo act_"
            hintUrl="https://adsmanager.facebook.com/adsmanager/manage/campaigns"
            hintUrlLabel="Abrir Ads Manager"
            value={form.ad_account_id}
            onChange={(v) => updateField('ad_account_id', v)}
            result={checks.ad_account}
            defaultLabel="Ad Account"
            placeholder="123456789012345"
          />

          <FieldRow
            id="page_id"
            label="Facebook Page ID"
            hint="Business Settings, Contas, Paginas, sua page, ID embaixo do nome"
            hintUrl="https://business.facebook.com/settings/pages"
            hintUrlLabel="Abrir Paginas"
            value={form.page_id}
            onChange={(v) => updateField('page_id', v)}
            result={checks.page}
            defaultLabel="Page"
            placeholder="987654321098765"
          />

          <FieldRow
            id="pixel_id"
            label="Pixel ID"
            hint="Events Manager, Data Sources, seu pixel, ID embaixo do nome"
            hintUrl="https://business.facebook.com/events_manager"
            hintUrlLabel="Abrir Events Manager"
            value={form.pixel_id}
            onChange={(v) => updateField('pixel_id', v)}
            result={checks.pixel}
            defaultLabel="Pixel"
            placeholder="1234567890123456"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credenciais opcionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FieldRow
            id="ig_business_id"
            label="Instagram Business Account ID"
            hint="Business Settings, Contas, Contas do Instagram, sua conta. Sem isso anuncios saem so no Facebook"
            hintUrl="https://business.facebook.com/settings/instagram-accounts"
            hintUrlLabel="Abrir Contas IG"
            value={form.ig_business_id}
            onChange={(v) => updateField('ig_business_id', v)}
            result={checks.ig_business}
            defaultLabel="IG Business"
            optional
            placeholder="17841412345678901"
          />

          <Separator />

          <FieldRow
            id="app_id"
            label="App ID"
            hint="developers.facebook.com, seu app, Configuracoes, Basico. Necessario pra renovacao automatica do token"
            hintUrl="https://developers.facebook.com/apps"
            hintUrlLabel="Abrir Meus Apps"
            value={form.app_id}
            onChange={(v) => updateField('app_id', v)}
            defaultLabel="App ID"
            optional
            placeholder="1234567890123"
          />

          <FieldRow
            id="app_secret"
            label="App Secret"
            hint="Mesmo lugar do App ID, clique em Mostrar. Guardado criptografado, nunca exibido novamente"
            hintUrl="https://developers.facebook.com/apps"
            hintUrlLabel="Abrir Meus Apps"
            value={form.app_secret}
            onChange={(v) => updateField('app_secret', v)}
            defaultLabel="App Secret"
            type="password"
            optional
            toggleSecret={() => setShowAppSecret((s) => !s)}
            showSecret={showAppSecret}
          />

          <Separator />

          <FieldRow
            id="capi_token"
            label="Conversions API Access Token"
            hint="Events Manager, seu pixel, Settings, Generate Access Token. Melhora match rate em 20-40%"
            hintUrl="https://business.facebook.com/events_manager"
            hintUrlLabel="Abrir Events Manager"
            value={form.capi_token}
            onChange={(v) => updateField('capi_token', v)}
            defaultLabel="CAPI Token"
            type="password"
            optional
            toggleSecret={() => setShowCapi((s) => !s)}
            showSecret={showCapi}
            placeholder="EAAB..."
          />
        </CardContent>
      </Card>

      <Card className={cn(allRequiredOk && 'border-green-300 bg-green-50/30', minSaveOk && !allRequiredOk && 'border-amber-300 bg-amber-50/30')}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium">
                {allRequiredOk
                  ? 'Tudo validado, pronto pra salvar'
                  : minSaveOk
                  ? 'Token e Ad Account OK. Pode salvar parcial e completar Page/Pixel depois.'
                  : 'Cole token e Ad Account, clique Validar'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A validacao bate em Graph API v21.0 antes de salvar. Nenhum valor invalido entra no banco.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={validating || !form.token.trim()}
              >
                {validating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validando...</>
                ) : (
                  'Validar contra Meta API'
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !minSaveOk}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : allRequiredOk ? (
                  'Salvar'
                ) : (
                  'Salvar parcial'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
