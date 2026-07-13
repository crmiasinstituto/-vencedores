import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useCampaignInstances,
  useCreateCampaignInstance,
  useUpdateCampaignInstance,
  useDeleteCampaignInstance,
} from '@/hooks/useCampaigns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Smartphone,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  QrCode,
  RefreshCw,
  Wifi,
  WifiOff,
  Cloud,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Provider = 'uazapi' | 'cloud_api';

interface InstanceForm {
  name: string;
  provider: Provider;
  // Cloud API
  phone_number_id: string;
  business_account_id: string;
  api_key: string;
  api_url: string;
  verification_pin: string;
  avatar_url: string;
}

const EMPTY_FORM: InstanceForm = {
  name: '',
  provider: 'uazapi',
  phone_number_id: '',
  business_account_id: '',
  api_key: '',
  api_url: 'https://graph.facebook.com/v22.0',
  verification_pin: '',
  avatar_url: '',
};

export default function CampaignInstancesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: instances = [], isLoading } = useCampaignInstances();
  const createInstance = useCreateCampaignInstance();
  const updateInstance = useUpdateCampaignInstance();
  const deleteInstance = useDeleteCampaignInstance();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstanceForm>(EMPTY_FORM);

  // QR code state
  const [qrMap, setQrMap] = useState<Record<string, string | null>>({});
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande (max 5MB)', variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('whatsapp-instances')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('whatsapp-instances').getPublicUrl(path);
      setForm(prev => ({ ...prev, avatar_url: pub.publicUrl }));
      toast({ title: 'Foto enviada!' });
    } catch (err: any) {
      toast({ title: `Erro no upload: ${err.message}`, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Poll status for all instances on mount
  useEffect(() => {
    instances.forEach((inst: any) => {
      if (inst.api_key && (inst.api_url || inst.webhook_url)) {
        checkStatus(inst);
      }
    });
  }, [instances.length]);

  const checkStatus = async (inst: any) => {
    const url = inst.api_url || inst.webhook_url;
    if (!url || !inst.api_key) return;
    try {
      const res = await fetch(`${url}/instance/status`, {
        headers: { token: inst.api_key },
      });
      const data = await res.json();
      const connected = data.status?.connected ? 'connected' : 'disconnected';
      setStatusMap((prev) => ({ ...prev, [inst.id]: connected }));
      // Sync DB if changed
      if (inst.status !== connected) {
        await supabase
          .from('whatsapp_instances' as any)
          .update({ status: connected })
          .eq('id', inst.id);
      }
    } catch {
      setStatusMap((prev) => ({ ...prev, [inst.id]: 'disconnected' }));
    }
  };

  const handleGenerateQR = async (inst: any) => {
    const url = inst.api_url || inst.webhook_url;
    if (!url || !inst.api_key) {
      toast({ title: 'Configure a URL da API e Token primeiro', variant: 'destructive' });
      return;
    }
    setLoadingId(inst.id);
    try {
      await fetch(`${url}/instance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: inst.api_key },
        body: JSON.stringify({}),
      });
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${url}/instance/status`, {
        headers: { token: inst.api_key },
      });
      const statusData = await statusRes.json();
      const qr = statusData.instance?.qrcode || statusData.qrcode;
      if (qr) {
        setQrMap((prev) => ({ ...prev, [inst.id]: qr }));
        toast({ title: 'QR Code gerado! Escaneie com o WhatsApp.' });
      } else {
        toast({ title: 'QR Code nao disponivel, tente novamente', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao gerar QR Code', variant: 'destructive' });
    } finally {
      setLoadingId(null);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (inst: any) => {
    setEditingId(inst.id);
    const prov: Provider = inst.provider === 'cloud_api' ? 'cloud_api' : 'uazapi';
    setForm({
      name: inst.name || inst.instance_name || '',
      provider: prov,
      phone_number_id: inst.phone_number_id || '',
      business_account_id: inst.business_account_id || '',
      api_key: inst.api_key || '',
      api_url: inst.api_url || 'https://graph.facebook.com/v22.0',
      verification_pin: inst.verification_pin || '',
      avatar_url: inst.avatar_url || '',
    });
    setIsModalOpen(true);
  };

  const validateCloudForm = (): string | null => {
    if (!form.name.trim()) return 'Nome é obrigatório';
    if (!form.phone_number_id.trim()) return 'Phone Number ID é obrigatório';
    if (!form.business_account_id.trim()) return 'WABA ID é obrigatório';
    if (!form.api_key.trim()) return 'Token permanente é obrigatório';
    if (form.api_key.length < 50) return 'Token parece curto demais — confira se colou o permanente (EAAS...)';
    return null;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      if (form.provider === 'cloud_api') {
        const err = validateCloudForm();
        if (err) {
          toast({ title: err, variant: 'destructive' });
          return;
        }
        if (editingId) {
          // Update direto na tabela (sem chamar setup-campaign-instance, que é UAZAPI-only)
          const { error } = await supabase
            .from('whatsapp_instances' as any)
            .update({
              instance_name: form.name,
              provider: 'cloud_api',
              purpose: 'campaign',
              phone_number_id: form.phone_number_id.trim(),
              business_account_id: form.business_account_id.trim(),
              api_key: form.api_key.trim(),
              api_url: form.api_url.trim() || 'https://graph.facebook.com/v22.0',
              verification_pin: form.verification_pin.trim() || null,
              avatar_url: form.avatar_url.trim() || null,
              status: 'connected',
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingId);
          if (error) throw error;
          toast({ title: 'Instância Cloud API atualizada!' });
        } else {
          const { error } = await supabase
            .from('whatsapp_instances' as any)
            .insert({
              instance_name: form.name,
              provider: 'cloud_api',
              purpose: 'campaign',
              phone_number_id: form.phone_number_id.trim(),
              business_account_id: form.business_account_id.trim(),
              api_key: form.api_key.trim(),
              api_url: form.api_url.trim() || 'https://graph.facebook.com/v22.0',
              verification_pin: form.verification_pin.trim() || null,
              avatar_url: form.avatar_url.trim() || null,
              status: 'connected',
              is_dedicated_blast: true,
            });
          if (error) throw error;
          toast({
            title: 'Cloud API conectada!',
            description: 'Agora sincronize os templates Meta para começar a disparar.',
          });
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['campaign-instances'] }),
          queryClient.invalidateQueries({ queryKey: ['whatsapp-instances-campaigns'] }),
        ]);
        setIsModalOpen(false);
        return;
      }

      // UAZAPI flow (existing)
      if (editingId) {
        await updateInstance.mutateAsync({ id: editingId, name: form.name });
        toast({ title: 'Instância atualizada!' });
      } else {
        await createInstance.mutateAsync({ name: form.name });
        toast({
          title: 'Instância criada com sucesso!',
          description: 'Clique em Conectar para gerar o QR Code.',
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast({ title: err?.message || 'Erro ao salvar instância', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instancia de campanha?')) return;
    try {
      await deleteInstance.mutateAsync(id);
      toast({ title: 'Instancia excluida!' });
    } catch {
      toast({ title: 'Erro ao excluir instancia', variant: 'destructive' });
    }
  };

  const isSaving = createInstance.isPending || updateInstance.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-5 w-5" />
                Instancias WhatsApp para Campanhas
              </CardTitle>
              <CardDescription>
                Instancias dedicadas para envio de campanhas em massa (separadas do inbox)
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Instancia
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma instancia de campanha cadastrada</p>
              <p className="text-xs mt-1">
                Crie instancias dedicadas para enviar campanhas sem afetar o inbox
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Criar Instancia
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((instance: any) => {
                const isCloud = instance.provider === 'cloud_api';
                const liveStatus = statusMap[instance.id] || instance.status;
                // Cloud API: status real depende de phone_number_id + api_key configurados (stateless gateway)
                const isConnected = isCloud
                  ? !!(instance.phone_number_id && instance.api_key)
                  : liveStatus === 'connected';
                const qr = qrMap[instance.id];
                const isLoadingThis = loadingId === instance.id;

                return (
                  <div key={instance.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={isConnected ? 'default' : 'secondary'}
                          className={cn(
                            'text-xs gap-1',
                            isConnected
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {isConnected ? (
                            <Wifi className="h-3 w-3" />
                          ) : (
                            <WifiOff className="h-3 w-3" />
                          )}
                          {isConnected ? 'Online' : 'Offline'}
                        </Badge>
                        <Badge variant="outline" className={cn('text-[10px] gap-1', isCloud ? 'border-blue-300 text-blue-700' : 'border-amber-300 text-amber-700')}>
                          {isCloud ? <Cloud className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                          {isCloud ? 'Meta Cloud' : 'UAZAPI'}
                        </Badge>
                        <span className="font-medium text-sm">{instance.name || instance.instance_name}</span>
                        {(instance.phone_number || instance.phone_number_id) && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {instance.phone_number || `phone_id: ${String(instance.phone_number_id).slice(-6)}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!isConnected && !isCloud && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleGenerateQR(instance)}
                            disabled={isLoadingThis}
                          >
                            {isLoadingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <QrCode className="h-3 w-3" />
                            )}
                            Conectar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => checkStatus(instance)}
                          title="Atualizar status"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(instance)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDelete(instance.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* QR Code display */}
                    {qr && !isConnected && (
                      <div className="flex flex-col items-center gap-2 py-3 bg-white rounded-lg border">
                        <p className="text-xs text-muted-foreground">
                          Escaneie o QR Code com o WhatsApp
                        </p>
                        <img
                          src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                          alt="QR Code"
                          className="w-48 h-48"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => checkStatus(instance)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Verificar conexao
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Instância' : 'Nova Instância de Campanha'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Atualize os dados da instância'
                : 'Escolha o provedor e configure os dados de envio.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={form.provider}
            onValueChange={(v) => setForm({ ...form, provider: v as Provider })}
            className="mt-2"
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="uazapi" className="gap-1.5" disabled={!!editingId && form.provider !== 'uazapi'}>
                <Smartphone className="h-3.5 w-3.5" />
                UAZAPI (não-oficial)
              </TabsTrigger>
              <TabsTrigger value="cloud_api" className="gap-1.5" disabled={!!editingId && form.provider !== 'cloud_api'}>
                <Cloud className="h-3.5 w-3.5" />
                Meta Cloud API
              </TabsTrigger>
            </TabsList>

            <TabsContent value="uazapi" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome da Instância *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Campanha Reativação"
                  autoFocus
                />
              </div>
              {!editingId && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>Atenção:</strong> Use números WhatsApp separados para campanhas. Disparos em massa
                    no número do inbox tomam ban (Carlos 17/05). Após criar, gere o QR e escaneie com o WhatsApp
                    do número dedicado.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="cloud_api" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label>Nome da Instância *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: + que Vencedores Oficial Meta"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number ID *</Label>
                <Input
                  value={form.phone_number_id}
                  onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                  placeholder="663196283535436"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  developers.facebook.com → seu App → WhatsApp → Configuração da API → seção "De"
                </p>
              </div>
              <div className="space-y-2">
                <Label>WABA ID *</Label>
                <Input
                  value={form.business_account_id}
                  onChange={(e) => setForm({ ...form, business_account_id: e.target.value })}
                  placeholder="542862978508028"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  business.facebook.com → Configurações da empresa → Contas do WhatsApp Business
                </p>
              </div>
              <div className="space-y-2">
                <Label>Token Permanente (System User) *</Label>
                <Input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder="EAAS..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Gerado em business.facebook.com → Usuários do sistema. Não usar token temporário (24h).
                </p>
              </div>
              <div className="space-y-2">
                <Label>PIN de Registro (6 dígitos)</Label>
                <Input
                  value={form.verification_pin}
                  onChange={(e) => setForm({ ...form, verification_pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="482610"
                  maxLength={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  PIN definido no POST /register da Meta. Guarda pra re-registrar / 2FA se precisar.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Foto / Logo da Instância</Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {form.avatar_url ? (
                      <>
                        <img
                          src={form.avatar_url}
                          alt="Avatar"
                          className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/40"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, avatar_url: '' })}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                          title="Remover foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-dashed border-blue-500/40 flex items-center justify-center text-blue-300 text-xs font-semibold">
                        META
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarUpload(file);
                          e.target.value = '';
                        }}
                        disabled={uploadingAvatar}
                      />
                      <div className={cn(
                        'inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors',
                        uploadingAvatar
                          ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                          : 'border-[#BAA05E] bg-[#BAA05E]/10 text-[#BAA05E] hover:bg-[#BAA05E]/20 cursor-pointer'
                      )}>
                        {uploadingAvatar ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5" /> Escolher do computador</>
                        )}
                      </div>
                    </label>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ou cole uma URL
                      </summary>
                      <Input
                        value={form.avatar_url}
                        onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                        placeholder="https://...logo.png"
                        className="mt-2 text-xs"
                      />
                    </details>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Aparece como ícone da instância no painel CRM. PNG/JPG/WEBP até 5MB. Deixe vazio pra usar o ícone META padrão.
                </p>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Avançado: API URL</summary>
                <div className="space-y-2 mt-2">
                  <Input
                    value={form.api_url}
                    onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                    placeholder="https://graph.facebook.com/v22.0"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">Default v22.0. Só altere se a Meta mudar versão.</p>
                </div>
              </details>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-1">
                <p className="text-sm text-blue-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  <strong>API oficial: sem risco de ban por volume.</strong>
                </p>
                <p className="text-xs text-blue-700">
                  Após salvar: sincronize os templates Meta na aba "Mensagens salvas" e configure o webhook
                  apontando pra <code className="bg-white/60 px-1 rounded">/functions/v1/wa-cloud-webhook</code>.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !form.name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
