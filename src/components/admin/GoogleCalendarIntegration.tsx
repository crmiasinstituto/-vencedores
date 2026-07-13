import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  RefreshCw, Link2, Check, AlertCircle, Loader2, LogOut, Download, Upload, ExternalLink,
} from 'lucide-react';

interface Props {
  onSyncComplete?: () => void;
}

export default function GoogleCalendarIntegration({ onSyncComplete }: Props) {
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<any>({ configured: false, client_id: '', redirect_uri: 'https://squaad.com.br/admin/agenda' });
  const [connected, setConnected] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ client_id: '', client_secret: '', redirect_uri: 'https://squaad.com.br/admin/agenda' });

  useEffect(() => {
    loadStatus();
    // Detect OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code) {
      handleOAuthCallback(code, state || 'default');
    }
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data: cfg } = await supabase.functions.invoke('sync-google-calendar', { body: { action: 'get_config' } });
      setConfig(cfg);
      if (cfg?.client_id) setForm({ client_id: cfg.client_id, client_secret: '', redirect_uri: cfg.redirect_uri });
      if (cfg?.configured) {
        const { data: conn } = await supabase.functions.invoke('sync-google-calendar', { body: { action: 'connection_status' } });
        setConnected(conn?.connected ? conn.token : null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const saveConfig = async () => {
    if (!form.client_id || !form.client_secret) {
      toast.error('Preencha Client ID e Client Secret');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: {
          action: 'save_config',
          client_id: form.client_id,
          client_secret: form.client_secret,
          redirect_uri: form.redirect_uri,
        },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message);
      toast.success('Credenciais salvas. Agora conecte sua conta.');
      setConfigOpen(false);
      loadStatus();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally { setBusy(false); }
  };

  const startOAuth = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', { body: { action: 'oauth_url' } });
      if (error || !data?.url) throw new Error(data?.error || error?.message || 'Erro');
      // Same tab: Google redirects back here with ?code=xxx
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar OAuth');
      setBusy(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    // Clean URL immediately so refresh doesn't re-trigger
    const u = new URL(window.location.href);
    u.searchParams.delete('code');
    u.searchParams.delete('state');
    u.searchParams.delete('scope');
    u.searchParams.delete('authuser');
    u.searchParams.delete('prompt');
    window.history.replaceState({}, '', u.toString());

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: { action: 'exchange_code', code, owner_id: state },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Erro');
      toast.success('Google Calendar conectado');
      loadStatus();
      // First pull
      await supabase.functions.invoke('sync-google-calendar', { body: { action: 'pull' } });
      onSyncComplete?.();
    } catch (e: any) {
      toast.error('Falha ao conectar: ' + (e.message || e));
    } finally { setBusy(false); }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const [{ data: pushRes }, { data: pullRes }] = await Promise.all([
        supabase.functions.invoke('sync-google-calendar', { body: { action: 'push' } }),
        supabase.functions.invoke('sync-google-calendar', { body: { action: 'pull' } }),
      ]);
      toast.success(`Sincronizado: ${pushRes?.pushed || 0} enviados, ${pullRes?.pulled || 0} recebidos`);
      onSyncComplete?.();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!confirm('Desconectar Google Calendar? Eventos ja sincronizados permanecem.')) return;
    setBusy(true);
    try {
      await supabase.functions.invoke('sync-google-calendar', { body: { action: 'disconnect' } });
      toast.success('Desconectado');
      loadStatus();
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e));
    } finally { setBusy(false); }
  };

  if (loading) return <Button size="sm" variant="outline" disabled><Loader2 className="w-3.5 h-3.5 animate-spin" /></Button>;

  // Not configured yet
  if (!config.configured) {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
          <Link2 className="w-3.5 h-3.5 mr-1.5" /> Conectar Google Calendar
        </Button>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Configurar Google Calendar</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs space-y-2">
                <p className="font-semibold">Passo-a-passo (~10 min):</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Abra <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline text-primary">Google Cloud Console</a></li>
                  <li>Crie/selecione um projeto</li>
                  <li>Vá em <strong>APIs & Services → Library</strong> e habilite "Google Calendar API"</li>
                  <li>Vá em <strong>APIs & Services → OAuth consent screen</strong>: External, nome "+ que Vencedores Agenda", email, salvar</li>
                  <li>Vá em <strong>APIs & Services → Credentials → + Create Credentials → OAuth Client ID</strong>: type "Web application"</li>
                  <li>Em <strong>Authorized redirect URIs</strong> adicione: <code className="bg-background px-1 rounded text-[10px]">{form.redirect_uri}</code></li>
                  <li>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong> gerados e cole abaixo</li>
                </ol>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client ID</Label>
                <Input
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  placeholder="123456789-xxxxxx.apps.googleusercontent.com"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type="password"
                  value={form.client_secret}
                  onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                  placeholder="GOCSPX-xxxxx"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Redirect URI (adicionar no Google Cloud)</Label>
                <Input
                  value={form.redirect_uri}
                  onChange={(e) => setForm({ ...form, redirect_uri: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={saveConfig} disabled={busy}>
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                Salvar credenciais
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Configured but not connected yet
  if (!connected) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={startOAuth} disabled={busy} className="bg-[#4285F4] hover:bg-[#4285F4]/90 text-white">
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
          Conectar minha conta Google
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setForm({ client_id: config.client_id, client_secret: '', redirect_uri: config.redirect_uri }); setConfigOpen(true); }}>
          Credenciais
        </Button>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar credenciais</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client ID</Label>
                <Input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client Secret (deixe em branco pra manter)</Label>
                <Input type="password" value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} className="font-mono text-xs" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={saveConfig} disabled={busy}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Connected
  return (
    <div className="flex items-center gap-2">
      <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
        <Check className="w-3 h-3" /> Google Calendar
      </Badge>
      <Button size="sm" variant="outline" onClick={syncNow} disabled={busy}>
        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
        Sincronizar
      </Button>
      <Button size="sm" variant="ghost" onClick={disconnect} disabled={busy} title="Desconectar">
        <LogOut className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
