import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MessageSquare, Plus, RefreshCw, Smartphone, QrCode, Trash2, Settings,
  DollarSign, Headphones, Heart, Building, User, Image, Globe, Eye,
  Link2, ChevronDown, ChevronUp, Phone, Bot, PhoneCall, Save, Wifi, WifiOff,
  AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatContactList, type ChatContact } from '@/components/whatsapp/ChatContactList';
import { InlineChat } from '@/components/whatsapp/InlineChat';
import { ChatLeadPanel } from '@/components/whatsapp/ChatLeadPanel';

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  instance_token: string | null;
  subdomain: string;
  status: string;
  qr_code: string | null;
  phone_number: string | null;
  webhook_url: string | null;
  created_at: string;
  channel?: string;
}

const CHANNELS = [
  { value: 'comercial', label: 'Comercial', icon: DollarSign, color: 'bg-green-500', border: 'border-green-500' },
  { value: 'suporte', label: 'Suporte', icon: Headphones, color: 'bg-blue-500', border: 'border-blue-500' },
  { value: 'cs', label: 'CS', icon: Heart, color: 'bg-purple-500', border: 'border-purple-500' },
  { value: 'interno', label: 'Interno', icon: Building, color: 'bg-gray-500', border: 'border-gray-500' },
] as const;

const WEBHOOK_EVENTS = [
  { value: 'messages', label: 'Mensagens' },
  { value: 'connection', label: 'Conexão' },
  { value: 'messages_update', label: 'Atualizações' },
  { value: 'presence', label: 'Presença' },
  { value: 'groups', label: 'Grupos' },
  { value: 'chats', label: 'Chats' },
  { value: 'contacts', label: 'Contatos' },
  { value: 'labels', label: 'Etiquetas' },
];

const AdminWhatsApp: React.FC = () => {
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newInstanceName, setNewInstanceName] = useState('squaad-crm');
  const [selectedChannel, setSelectedChannel] = useState('comercial');
  const [isCreating, setIsCreating] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Disconnection alert
  const [disconnectedAlert, setDisconnectedAlert] = useState<WhatsAppInstance | null>(null);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  // WaVoIP config
  const [wavoipDevices, setWavoipDevices] = useState<any[]>([]);
  const [wavoipName, setWavoipName] = useState('');
  const [wavoipToken, setWavoipToken] = useState('');
  const [isSavingWavoip, setIsSavingWavoip] = useState(false);
  const [editingWavoipId, setEditingWavoipId] = useState<string | null>(null);

  // Connect modal
  const [connectModal, setConnectModal] = useState<WhatsAppInstance | null>(null);
  // Pareamento é o padrão: o QR expira em ~20-60s e a tela não avisava, então o usuário
  // ficava olhando "Aguardando..." com um código já morto. O código de pareamento dura mais
  // e é digitado, não escaneado.
  const [connectMode, setConnectMode] = useState<'qr' | 'pairing'>('pairing');
  // Segundos de validade restantes do código atual. null = não há código no ar.
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const [expirou, setExpirou] = useState(false);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Webhook modal
  const [webhookModal, setWebhookModal] = useState<WhatsAppInstance | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['messages', 'connection', 'messages_update']);
  const [excludeWasSentByApi, setExcludeWasSentByApi] = useState(true);
  const [webhookCurrent, setWebhookCurrent] = useState<any>(null);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

  // Profile
  const [profileOpen, setProfileOpen] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileImage, setProfileImage] = useState('');

  const loadInstances = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setInstances(data as WhatsAppInstance[]);
      // Update prev status tracking
      for (const inst of data as WhatsAppInstance[]) {
        prevStatusRef.current.set(inst.id, inst.status);
      }
    }
    setIsLoading(false);
  }, []);

  const loadWavoipDevices = useCallback(async () => {
    const { data } = await supabase.from('wavoip_devices').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (data) setWavoipDevices(data);
  }, []);

  useEffect(() => { loadInstances(); loadWavoipDevices(); }, [loadInstances, loadWavoipDevices]);

  // Realtime no wavoip_devices: quando o CallContext atualiza status (open /
  // disconnected) via dev.onStatus, queremos refletir no card sem precisar de
  // F5. Sem isso o card mostrava "disconnected" velho mesmo o socket ja' aberto.
  useEffect(() => {
    const channel = supabase
      .channel('wavoip-devices-admin')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'wavoip_devices' },
        () => { loadWavoipDevices(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadWavoipDevices]);

  // ===== REALTIME STATUS MONITORING =====
  useEffect(() => {
    const interval = setInterval(async () => {
      // Cloud API e stateless (sempre conectada se token valido). Soh poll UAZAPI.
      // Sem este filtro, uazapi-proxy/status falha contra cloud_api e dispara
      // modal falso de "WhatsApp Desconectado".
      const connectedInstances = instances.filter(
        i => i.status === 'connected' && i.provider !== 'cloud_api'
      );
      if (connectedInstances.length === 0) return;

      for (const inst of connectedInstances) {
        try {
          const res = await supabase.functions.invoke('uazapi-proxy', {
            body: { action: 'status', instance_id: inst.id },
          });
          // Se o invoke falhou (CORS, network, 5xx), res.error vem setado e
          // res.data e null. NUNCA tratar isso como "desconectou" porque
          // dispara modal falso (incidente: x-member-token CORS quebrava o
          // proxy e o app vivia mostrando "WhatsApp Desconectado" mesmo com
          // UAZAPI saudavel). So atualiza status com base em resposta real.
          if (res.error || !res.data) {
            console.warn('[AdminWhatsApp] Status check skipped (proxy error):', res.error);
            continue;
          }
          const statusData = res.data?.data;
          const currentStatus = statusData?.status || statusData?.instance?.status;
          if (!currentStatus) {
            // Resposta sem campo de status — nao confia, pula
            continue;
          }

          if (currentStatus !== 'connected' && prevStatusRef.current.get(inst.id) === 'connected') {
            // Instance just disconnected!
            setDisconnectedAlert(inst);
            toast.error(`⚠️ WhatsApp "${inst.instance_name}" desconectou!`, { duration: 10000 });

            // Update local state
            setInstances(prev => prev.map(i =>
              i.id === inst.id ? { ...i, status: 'disconnected' } : i
            ));

            // Update DB
            await supabase.from('whatsapp_instances').update({ status: 'disconnected' }).eq('id', inst.id);
          }

          prevStatusRef.current.set(inst.id, currentStatus);
        } catch (e) {
          console.error('Status check error:', e);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [instances]);

  const handleReconnect = (instance: WhatsAppInstance) => {
    setDisconnectedAlert(null);
    setConnectModal(instance);
    setConnectMode('qr');
    setPairingPhone('');
    setPairingCode(null);
    setShowSettings(true);
  };

  const handleSaveWavoipDevice = async () => {
    if (!wavoipName.trim() || !wavoipToken.trim()) { toast.error('Preencha nome e token'); return; }
    const tokenTrimmed = wavoipToken.trim();
    // Bloqueia token duplicado, dois devices no mesmo token derrubam o ack do
    // socket WaVoIP (CALLING trava em TIMEOUT_15S). Ver [[wavoip-socket-timeout]].
    const duplicate = wavoipDevices.find(d => d.token === tokenTrimmed && d.id !== editingWavoipId);
    if (duplicate) {
      toast.error(
        `Esse token ja esta em "${duplicate.name || 'outro dispositivo'}". Dois devices no mesmo token quebram as ligacoes (timeout no ack do socket). Remova o duplicado ou use outro token.`,
        { duration: 10000 }
      );
      return;
    }
    setIsSavingWavoip(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) { toast.error('Faça login primeiro'); setIsSavingWavoip(false); return; }

      if (editingWavoipId) {
        await supabase.from('wavoip_devices').update({ name: wavoipName.trim(), token: tokenTrimmed }).eq('id', editingWavoipId);
        toast.success('Dispositivo atualizado!');
      } else {
        await supabase.from('wavoip_devices').insert({ user_id: userId, name: wavoipName.trim(), token: tokenTrimmed });
        toast.success('Dispositivo adicionado!');
      }
      setWavoipName(''); setWavoipToken(''); setEditingWavoipId(null);
      loadWavoipDevices();
    } catch (e: any) { toast.error(e.message); }
    setIsSavingWavoip(false);
  };

  // Set dos tokens que aparecem em mais de um device. Cada device duplicado
  // ganha um banner vermelho no card avisando que ligações vão falhar.
  const duplicateTokens = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of wavoipDevices) counts.set(d.token, (counts.get(d.token) || 0) + 1);
    return new Set([...counts.entries()].filter(([_, n]) => n > 1).map(([t]) => t));
  }, [wavoipDevices]);

  const handleDeleteWavoipDevice = async (id: string) => {
    if (!confirm('Remover este dispositivo WaVoIP?')) return;
    // DELETE pode falhar se houver call_history vinculado (FK). Quando isso
    // acontecer, cai pro soft delete (is_active=false) — preserva historico e
    // some da lista (loadWavoipDevices ja filtra por is_active=true).
    const { error: delError } = await supabase.from('wavoip_devices').delete().eq('id', id);
    if (delError) {
      console.warn('[WaVoIP] Hard delete failed, trying soft delete:', delError);
      const { error: updError } = await supabase
        .from('wavoip_devices')
        .update({ is_active: false })
        .eq('id', id);
      if (updError) {
        toast.error('Nao foi possivel remover: ' + updError.message);
        return;
      }
      toast.success('Dispositivo arquivado (tinha historico de chamadas vinculado)');
    } else {
      toast.success('Dispositivo removido');
    }
    loadWavoipDevices();
  };

  // Contador regressivo do código. A UAZAPI derruba por "Pair Code timeout"/"QR Code timeout"
  // por volta de 2 minutos; mostramos isso em vez de deixar girando pra sempre.
  useEffect(() => {
    if (segundosRestantes === null) return;
    if (segundosRestantes <= 0) {
      setExpirou(true);
      setSegundosRestantes(null);
      setPollingId(null);
      return;
    }
    const t = setTimeout(() => setSegundosRestantes((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [segundosRestantes]);

  // Polling for QR code connection
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const res = await supabase.functions.invoke('uazapi-proxy', {
          body: { action: 'status', instance_id: pollingId },
        });
        const statusData = res.data?.data;
        const instanceData = statusData?.instance;
        const currentStatus = statusData?.status || instanceData?.status || 'disconnected';
        if (currentStatus === 'connected') {
          toast.success('WhatsApp conectado!');
          setPollingId(null);
          setConnectModal(null);
          setPairingCode(null);
          setSegundosRestantes(null);
          setExpirou(false);

          // api_url em branco fazia o disparo falhar com "instance.api_url ausente (UAZAPI)"
          // mesmo com o número conectado. Preenche na conexão pra não descobrir isso no envio.
          await supabase
            .from('whatsapp_instances')
            .update({ status: 'connected', api_url: 'https://squaad.uazapi.com' })
            .eq('id', pollingId)
            .is('api_url', null);

          // Puxa os grupos assim que conecta — é o passo que o usuário faria na mão logo depois.
          try {
            const r = await fetch('/.netlify/functions/sync-grupos-whatsapp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instance_id: pollingId }),
            });
            const j = await r.json();
            if (j?.total > 0) toast.success(`${j.total} grupos sincronizados`);
          } catch { /* não bloqueia a conexão */ }

          loadInstances();
        } else if (currentStatus === 'disconnected' && segundosRestantes !== null) {
          // A UAZAPI já derrubou o código. Sem este ramo a tela seguia "Aguardando..." pra sempre.
          setExpirou(true);
          setSegundosRestantes(null);
          setPollingId(null);
        } else {
          const qr = instanceData?.qrcode || statusData?.qrcode || null;
          setInstances(prev => prev.map(i =>
            i.id === pollingId ? { ...i, qr_code: qr || i.qr_code, status: currentStatus || i.status } : i
          ));
        }
      } catch (e) { console.error('Polling error:', e); }
    }, 4000);
    return () => clearInterval(interval);
  }, [pollingId, loadInstances]);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) return;
    setIsCreating(true);
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: { action: 'create_instance', name: newInstanceName.trim(), channel: selectedChannel },
      });
      if (res.data?.success) { toast.success('Instância criada!'); loadInstances(); setNewInstanceName(''); }
      else toast.error(res.data?.error || 'Erro ao criar');
    } catch (e: any) { toast.error(e.message); }
    setIsCreating(false);
  };

  const handleConnect = async (mode: 'qr' | 'pairing') => {
    if (!connectModal) return;
    setIsConnecting(true);
    try {
      const body: any = { action: 'connect', instance_id: connectModal.id };
      // Se o admin não digitou, usa o número já cadastrado na instância — era retrabalho
      // digitar de novo um número que o sistema já conhece.
      const fone = pairingPhone.trim() || (connectModal.phone_number || '').replace(/\D/g, '');
      if (mode === 'pairing' && fone) body.phone = fone;
      const res = await supabase.functions.invoke('uazapi-proxy', { body });
      if (res.data?.success) {
        const d = res.data.data;
        if (mode === 'pairing' && (d?.pairingCode || d?.paircode || d?.instance?.paircode)) {
          setPairingCode(d.pairingCode || d.paircode || d.instance?.paircode);
        } else {
          const qr = d?.instance?.qrcode || d?.qrcode || d?.qr || null;
          if (qr) setInstances(prev => prev.map(i => i.id === connectModal.id ? { ...i, status: 'connecting', qr_code: qr } : i));
          toast.info('Escaneie o QR Code');
        }
        setPollingId(connectModal.id);
        setExpirou(false);
        setSegundosRestantes(120);
      } else toast.error(res.data?.error || 'Erro');
    } catch (e: any) { toast.error(e.message); }
    setIsConnecting(false);
  };

  const handleDisconnect = async (instance: WhatsAppInstance) => {
    try {
      await supabase.functions.invoke('uazapi-proxy', { body: { action: 'disconnect', instance_id: instance.id } });
      toast.success('Desconectado');
      setPollingId(null);
      loadInstances();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (instance: WhatsAppInstance) => {
    if (!confirm('Deletar esta instância?')) return;
    try {
      await supabase.functions.invoke('uazapi-proxy', { body: { action: 'delete_instance', instance_id: instance.id } });
      toast.success('Deletada');
      loadInstances();
    } catch (e: any) { toast.error(e.message); }
  };

  // Mostra quanto tempo o código ainda vale. Antes só havia um spinner com "Aguardando...",
  // que continuava girando muito depois do código ter morrido.
  const StatusDoCodigo = () => (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Aguardando você confirmar no celular…
      </div>
      {segundosRestantes !== null && (
        <span className={segundosRestantes <= 30 ? 'text-xs font-medium text-amber-500' : 'text-xs text-muted-foreground'}>
          expira em {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
        </span>
      )}
    </div>
  );

  const openWebhookModal = (instance: WhatsAppInstance) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    setWebhookUrl(instance.webhook_url || `${supabaseUrl}/functions/v1/uazapi-webhook-receiver`);
    setWebhookEvents(['messages', 'connection', 'messages_update']);
    setExcludeWasSentByApi(true);
    setWebhookCurrent(null);
    setWebhookModal(instance);
  };

  const handleGetCurrentWebhook = async () => {
    if (!webhookModal) return;
    const res = await supabase.functions.invoke('uazapi-proxy', { body: { action: 'get_webhook', instance_id: webhookModal.id } });
    setWebhookCurrent(res.data?.data || null);
  };

  const handleSaveWebhook = async () => {
    if (!webhookModal) return;
    setIsSavingWebhook(true);
    try {
      const res = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'set_webhook', instance_id: webhookModal.id, webhook_url: webhookUrl,
          events: webhookEvents, exclude_messages: excludeWasSentByApi ? ['wasSentByApi'] : [],
        },
      });
      if (res.data?.success) { toast.success('Webhook salvo!'); setWebhookModal(null); loadInstances(); }
      else toast.error(res.data?.error || 'Erro');
    } catch (e: any) { toast.error(e.message); }
    setIsSavingWebhook(false);
  };

  const handleProfileName = async (instance: WhatsAppInstance) => {
    if (!profileName.trim()) return;
    const res = await supabase.functions.invoke('uazapi-proxy', { body: { action: 'profile_name', instance_id: instance.id, name: profileName.trim() } });
    if (res.data?.success) toast.success('Nome alterado!'); else toast.error(res.data?.error || 'Erro');
  };

  const handleProfileImage = async (instance: WhatsAppInstance) => {
    if (!profileImage.trim()) return;
    const res = await supabase.functions.invoke('uazapi-proxy', { body: { action: 'profile_image', instance_id: instance.id, image: profileImage.trim() } });
    if (res.data?.success) toast.success('Foto alterada!'); else toast.error(res.data?.error || 'Erro');
  };

  const getChannelConfig = (ch: string) => CHANNELS.find(c => c.value === ch) || CHANNELS[0];
  const currentConnectInstance = connectModal ? instances.find(i => i.id === connectModal.id) || connectModal : null;
  const connectedCount = instances.filter(i => i.status === 'connected').length;
  // Cloud API e stateless: nunca conta como desconectada (nao tem QR pra reconectar mesmo)
  const disconnectedCount = instances.filter(i =>
    (i as any).provider !== 'cloud_api' &&
    i.status !== 'connected' &&
    i.status !== 'connecting'
  ).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Gestao unificada: cadastro/edicao/upload/PIN agora ficam em Marketing → Instancias */}
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border-b border-blue-500/30 flex-shrink-0">
        <ExternalLink className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span className="text-xs text-blue-300">
          Cadastro, edição e foto das instâncias agora em um lugar só:
        </span>
        <a
          href="/admin/marketing/whatsapp/instancias"
          className="text-xs text-blue-400 font-medium hover:text-blue-300 underline ml-1"
        >
          Marketing → Instâncias
        </a>
        <span className="text-xs text-blue-300/70 ml-auto">
          Esta tela mantém: conexão QR, WaVoIP, sync de chats.
        </span>
      </div>

      {/* Disconnected banner */}
      {disconnectedCount > 0 && instances.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/30 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400 font-medium">
            {disconnectedCount} instância{disconnectedCount > 1 ? 's' : ''} desconectada{disconnectedCount > 1 ? 's' : ''}
          </span>
          <Button 
            size="sm" variant="outline" 
            className="h-6 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10 ml-auto"
            onClick={() => {
              setShowSettings(true);
              const disc = instances.find(i => i.status !== 'connected');
              if (disc) {
                setConnectModal(disc);
                setConnectMode('qr');
                setPairingPhone('');
                setPairingCode(null);
              }
            }}
          >
            <QrCode className="w-3 h-3 mr-1" /> Reconectar
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">WhatsApp AI FIRST</h1>
            <p className="text-xs text-muted-foreground">
              {connectedCount > 0 ? `${connectedCount} instância${connectedCount > 1 ? 's' : ''} conectada${connectedCount > 1 ? 's' : ''}` : 'Nenhuma instância conectada'}
            </p>
          </div>
        </div>
        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-1" /> Instâncias
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[450px] sm:max-w-[450px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Gerenciar Instâncias</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {/* Create Instance */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Instância</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="Nome" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} className="flex-1" />
                    <Button size="sm" onClick={handleCreateInstance} disabled={isCreating}>
                      {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {CHANNELS.map((ch) => {
                      const Icon = ch.icon;
                      return (
                        <button key={ch.value} onClick={() => setSelectedChannel(ch.value)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            selectedChannel === ch.value ? `${ch.border} ${ch.color} text-white` : 'border-border bg-card text-muted-foreground'
                          }`}>
                          <Icon className="w-3 h-3" /> {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Instance list */}
              {instances.map((instance) => {
                const ch = getChannelConfig(instance.channel || 'comercial');
                const ChIcon = ch.icon;
                const isProfileOpen = profileOpen === instance.id;
                // Cloud API e stateless: status real depende soh de ter token + phone_number_id.
                // Sem este derivado, polling antigo grava 'disconnected' e UI mostra
                // "Reconectar QR" pra Cloud API (nao faz sentido, Cloud nao tem QR).
                const isCloudApi = (instance as any).provider === 'cloud_api';
                const cloudHasCreds = isCloudApi && !!(instance as any).api_key && !!(instance as any).phone_number_id;
                const effectiveStatus = cloudHasCreds ? 'connected' : instance.status;
                return (
                  <Card key={instance.id} className={effectiveStatus === 'connected' ? 'border-green-500/50' : effectiveStatus !== 'connecting' ? 'border-red-500/30' : ''}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className={`w-4 h-4 ${effectiveStatus === 'connected' ? 'text-green-500' : 'text-red-400'}`} />
                          <span className="font-medium text-sm">{instance.instance_name}</span>
                          <Badge className={`${ch.color} text-white text-[10px]`}><ChIcon className="w-3 h-3 mr-0.5" />{ch.label}</Badge>
                          {isCloudApi && (
                            <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-400">
                              API OFICIAL
                            </Badge>
                          )}
                        </div>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDelete(instance)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={effectiveStatus === 'connected' ? 'default' : 'secondary'} className={`text-[10px] ${effectiveStatus !== 'connected' && effectiveStatus !== 'connecting' ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}`}>
                          {effectiveStatus === 'connected' ? '🟢 Conectado' : effectiveStatus === 'connecting' ? '🟡 Conectando' : '🔴 Desconectado'}
                        </Badge>
                        {instance.phone_number && <span className="text-xs text-muted-foreground">📱 {instance.phone_number}</span>}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {/* QR/Reconectar so faz sentido pra UAZAPI. Cloud API e stateless, sem QR. */}
                        {!isCloudApi && effectiveStatus !== 'connected' && (
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => { setConnectModal(instance); setConnectMode('qr'); setPairingPhone(''); setPairingCode(null); }}>
                            <QrCode className="w-3 h-3 mr-1" /> Reconectar
                          </Button>
                        )}
                        {isCloudApi ? (
                          <span className="text-xs text-muted-foreground italic">
                            Configurar em Marketing → Instâncias
                          </span>
                        ) : effectiveStatus === 'connected' && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openWebhookModal(instance)}><Settings className="w-3 h-3 mr-1" /> Webhook</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDisconnect(instance)}><Smartphone className="w-3 h-3 mr-1" /> Desconectar</Button>
                          </>
                        )}
                      </div>
                      {!isCloudApi && effectiveStatus === 'connected' && (
                        <Collapsible open={isProfileOpen} onOpenChange={(open) => setProfileOpen(open ? instance.id : null)}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 text-xs">
                              <User className="w-3 h-3 mr-1" /> Perfil {isProfileOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-2 p-3 bg-muted/30 rounded-lg">
                            <div className="flex gap-2">
                              <Input placeholder="Nome do perfil" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="flex-1 h-8 text-xs" />
                              <Button size="sm" className="h-8 text-xs" onClick={() => handleProfileName(instance)}>Salvar</Button>
                            </div>
                            <div className="flex gap-2">
                              <Input placeholder="URL foto 640x640" value={profileImage} onChange={(e) => setProfileImage(e.target.value)} className="flex-1 h-8 text-xs" />
                              <Button size="sm" className="h-8 text-xs" onClick={() => handleProfileImage(instance)}>Salvar</Button>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {/* WaVoIP Config */}
              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <PhoneCall className="w-4 h-4 text-primary" /> WaVoIP — Chamadas VoIP
                </h3>
                
                {/* Add / Edit device */}
                <Card className="mb-3">
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label className="text-xs">Nome do Dispositivo</Label>
                      <Input placeholder="Ex: Carlos Eduardo - Comercial" value={wavoipName} onChange={(e) => setWavoipName(e.target.value)} className="mt-1 h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Token WaVoIP</Label>
                      <Input placeholder="Token da API WaVoIP" value={wavoipToken} onChange={(e) => setWavoipToken(e.target.value)} className="mt-1 h-8 text-xs font-mono" />
                    </div>
                    <Button size="sm" className="w-full h-8 text-xs" onClick={handleSaveWavoipDevice} disabled={isSavingWavoip}>
                      {isSavingWavoip ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                      {editingWavoipId ? 'Atualizar' : 'Adicionar Dispositivo'}
                    </Button>
                    {editingWavoipId && (
                      <Button size="sm" variant="ghost" className="w-full h-7 text-xs text-muted-foreground" onClick={() => { setEditingWavoipId(null); setWavoipName(''); setWavoipToken(''); }}>
                        Cancelar edição
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Device list */}
                {wavoipDevices.map((dev) => {
                  const isDup = duplicateTokens.has(dev.token);
                  return (
                  <Card key={dev.id} className={`mb-2 ${isDup ? 'border-red-500/60' : dev.status === 'open' || dev.status === 'connected' ? 'border-green-500/50' : ''}`}>
                    <CardContent className="pt-3 pb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PhoneCall className={`w-4 h-4 ${dev.status === 'open' || dev.status === 'connected' ? 'text-green-500' : 'text-muted-foreground'}`} />
                          <span className="font-medium text-xs">{dev.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingWavoipId(dev.id); setWavoipName(dev.name || ''); setWavoipToken(dev.token); }}>
                            <Settings className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="destructive" className="h-6 w-6" onClick={() => handleDeleteWavoipDevice(dev.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {isDup && (
                        <div className="flex items-start gap-2 rounded border border-red-500/50 bg-red-500/10 px-2 py-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-red-300 leading-tight">
                            <strong>Token duplicado.</strong> Outro dispositivo usa o mesmo token, ligações vão travar em "Chamando". Apague um dos dois.
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant={dev.status === 'open' || dev.status === 'connected' ? 'default' : 'secondary'} className="text-[10px]">
                          {dev.status === 'open' || dev.status === 'connected' ? <><Wifi className="w-3 h-3 mr-1" /> Conectado</> : <><WifiOff className="w-3 h-3 mr-1" /> {dev.status}</>}
                        </Badge>
                        {dev.phone_number && <span className="text-[10px] text-muted-foreground">📱 {dev.phone_number}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">Token: {dev.token.slice(0, 12)}...{dev.token.slice(-4)}</p>
                    </CardContent>
                  </Card>
                  );
                })}
                {wavoipDevices.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum dispositivo WaVoIP configurado</p>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Contacts */}
        <div className="w-80 flex-shrink-0">
          <ChatContactList selectedContact={selectedContact} onSelectContact={setSelectedContact} />
        </div>

        {/* Chat */}
        <div className="flex-1 min-w-0">
          {selectedContact ? (
            <InlineChat contact={selectedContact} onOpenContact={setSelectedContact} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background">
              <Bot className="w-16 h-16 mb-4 opacity-20" />
              <h2 className="text-lg font-medium">WhatsApp AI FIRST</h2>
              <p className="text-sm mt-1">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>

        {/* Lead panel */}
        {selectedContact && (
          <div className="w-72 flex-shrink-0 hidden lg:block">
            <ChatLeadPanel contact={selectedContact} />
          </div>
        )}
      </div>

      {/* ===== Disconnection Alert Dialog ===== */}
      <Dialog open={!!disconnectedAlert} onOpenChange={(open) => { if (!open) setDisconnectedAlert(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              WhatsApp Desconectado!
            </DialogTitle>
            <DialogDescription>
              A instância <strong className="text-foreground">"{disconnectedAlert?.instance_name}"</strong> perdeu a conexão com o WhatsApp. 
              Suas mensagens não serão enviadas nem recebidas até reconectar.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400 font-medium">Conexão perdida</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Isso pode acontecer quando o WhatsApp é aberto em outro dispositivo ou a sessão expira.
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDisconnectedAlert(null)}>
              Fechar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => disconnectedAlert && handleReconnect(disconnectedAlert)}
            >
              <QrCode className="w-4 h-4 mr-1" /> Reconectar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Connect Modal ===== */}
      <Dialog open={!!connectModal} onOpenChange={(open) => { if (!open) { setConnectModal(null); setPairingCode(null); setSegundosRestantes(null); setExpirou(false); setPollingId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>Escolha o método de conexão</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant={connectMode === 'qr' ? 'default' : 'outline'} size="sm" onClick={() => { setConnectMode('qr'); setPairingCode(null); }} className="flex-1">
              <QrCode className="w-4 h-4 mr-1" /> QR Code
            </Button>
            <Button variant={connectMode === 'pairing' ? 'default' : 'outline'} size="sm" onClick={() => { setConnectMode('pairing'); setPairingCode(null); }} className="flex-1">
              <Phone className="w-4 h-4 mr-1" /> Pareamento
            </Button>
          </div>
          {connectMode === 'pairing' && (
            <div>
              <Label className="text-sm">Número (com DDI)</Label>
              <Input placeholder="5511999999999" value={pairingPhone} onChange={(e) => setPairingPhone(e.target.value)} className="mt-1" />
            </div>
          )}
          {connectMode === 'qr' && currentConnectInstance?.qr_code && pollingId === currentConnectInstance?.id && (
            <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg">
              <img
                src={currentConnectInstance.qr_code.startsWith('data:') ? currentConnectInstance.qr_code : `data:image/png;base64,${currentConnectInstance.qr_code}`}
                alt="QR Code" className="w-56 h-56"
              />
              <StatusDoCodigo />
            </div>
          )}
          {pairingCode && !expirou && (
            <div className="flex flex-col items-center gap-2 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Digite no WhatsApp:</p>
              <p className="text-3xl font-mono font-bold tracking-[.5em] text-foreground">{pairingCode}</p>
              <StatusDoCodigo />
            </div>
          )}
          {expirou && (
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-amber-500/40 bg-amber-500/5">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <p className="text-sm font-medium">O código expirou</p>
              <p className="text-xs text-muted-foreground text-center">
                O WhatsApp invalida o código em cerca de 2 minutos. Deixe o celular já aberto em
                <strong> Aparelhos conectados → Conectar aparelho</strong> e gere outro.
              </p>
            </div>
          )}
          <div className="rounded-md bg-muted/50 p-3 text-[11px] text-muted-foreground leading-relaxed">
            No celular: <strong>WhatsApp → Aparelhos conectados → Conectar aparelho</strong>
            {connectMode === 'pairing' && <> → <strong>Conectar com número de telefone</strong></>}
          </div>
          <DialogFooter>
            <Button onClick={() => handleConnect(connectMode)} disabled={isConnecting || (connectMode === 'pairing' && !pairingPhone.trim())}>
              {isConnecting && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
              {expirou ? 'Gerar novo código' : connectMode === 'qr' ? 'Gerar QR Code' : 'Gerar Código'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Webhook Modal ===== */}
      <Dialog open={!!webhookModal} onOpenChange={(open) => { if (!open) setWebhookModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Webhook</DialogTitle>
            <DialogDescription>Configure os eventos da instância</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">URL do Webhook</Label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="mt-1 font-mono text-xs" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Eventos</Label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((evt) => (
                  <label key={evt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={webhookEvents.includes(evt.value)} onCheckedChange={(checked) => {
                      setWebhookEvents(prev => checked ? [...prev, evt.value] : prev.filter(e => e !== evt.value));
                    }} />
                    {evt.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer p-2 bg-muted/50 rounded">
              <Checkbox checked={excludeWasSentByApi} onCheckedChange={(c) => setExcludeWasSentByApi(!!c)} />
              Ignorar msgs da API <span className="text-xs text-muted-foreground">(evita loops)</span>
            </label>
            <Button variant="ghost" size="sm" onClick={handleGetCurrentWebhook} className="text-muted-foreground">
              <Eye className="w-4 h-4 mr-1" /> Ver atual
            </Button>
            {webhookCurrent && (
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">{JSON.stringify(webhookCurrent, null, 2)}</pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookModal(null)}>Cancelar</Button>
            <Button onClick={handleSaveWebhook} disabled={isSavingWebhook}>
              {isSavingWebhook ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWhatsApp;
