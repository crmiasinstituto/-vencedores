import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import {
  Smartphone, Plus, ShieldAlert, Cloud, Loader2, Save, ExternalLink, AlertTriangle,
  Pencil, Trash2, Upload, X, QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

async function uploadInstanceAvatar(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Arquivo maior que 5MB');
  const ext = file.name.split('.').pop() || 'png';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('whatsapp-instances')
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('whatsapp-instances').getPublicUrl(path);
  return data.publicUrl;
}

interface Instance {
  id: string;
  instance_name: string;
  provider: 'uazapi' | 'cloud_api' | null;
  status: string;
  phone_number: string | null;
  business_account_id: string | null;
  phone_number_id: string | null;
  api_url: string | null;
  api_key: string | null;
  is_dedicated_blast: boolean | null;
  notes: string | null;
  avatar_url: string | null;
  verification_pin: string | null;
  admin_token: string | null;
  instance_token: string | null;
  subdomain: string | null;
}

function useInstances() {
  return useQuery({
    queryKey: ['wa-instances-mkt'],
    queryFn: async (): Promise<Instance[]> => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        // Tokens saíram do browser. Para saber se a instância está configurada existe
        // `tem_credenciais`; para TROCAR a credencial, o campo é escrito (nunca lido).
        .select('id, instance_name, provider, status, phone_number, business_account_id, phone_number_id, api_url, tem_credenciais, is_dedicated_blast, notes, avatar_url, subdomain')
        .order('instance_name');
      if (error) throw error;
      return (data as unknown as Instance[]) || [];
    },
  });
}

function useUpdateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Instance> }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-instances-mkt'] }),
  });
}

function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Instance> & { api_key?: string; admin_token?: string; instance_token?: string; subdomain?: string }) => {
      const isCloud = data.provider === 'cloud_api';
      const { error } = await supabase
        .from('whatsapp_instances')
        .insert({
          instance_name: data.instance_name!,
          provider: data.provider || 'uazapi',
          // Cloud API e stateless: ja conta como connected assim que tem token + phone_number_id
          status: isCloud ? 'connected' : 'disconnected',
          purpose: isCloud ? 'campaign' : 'inbox',
          api_url: data.api_url || (isCloud ? 'https://graph.facebook.com/v22.0' : null),
          api_key: data.api_key || null,
          business_account_id: data.business_account_id || null,
          phone_number_id: data.phone_number_id || null,
          is_dedicated_blast: isCloud ? true : !!data.is_dedicated_blast,
          notes: data.notes || null,
          admin_token: data.admin_token || (isCloud ? null : 'pending'),
          instance_token: data.instance_token || null,
          subdomain: data.subdomain || 'squaad',
          avatar_url: data.avatar_url || null,
          verification_pin: data.verification_pin || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-instances-mkt'] }),
  });
}

function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_instances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-instances-mkt'] }),
  });
}

function NewInstanceDialog() {
  const create = useCreateInstance();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<'uazapi' | 'cloud_api'>('uazapi');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    instance_name: '',
    api_url: '',
    api_key: '',
    admin_token: '',
    instance_token: '',
    subdomain: 'squaad',
    business_account_id: '',
    phone_number_id: '',
    is_dedicated_blast: false,
    notes: '',
    avatar_url: '',
    verification_pin: '',
  });

  const reset = () => setForm({
    instance_name: '', api_url: '', api_key: '', admin_token: '', instance_token: '',
    subdomain: 'squaad', business_account_id: '', phone_number_id: '',
    is_dedicated_blast: false, notes: '', avatar_url: '', verification_pin: '',
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadInstanceAvatar(file);
      setForm(prev => ({ ...prev, avatar_url: url }));
      toast.success('Foto enviada');
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submit = async () => {
    if (!form.instance_name) { toast.error('Nome da instância obrigatório'); return; }
    if (provider === 'uazapi' && !form.api_url) { toast.error('URL da API UAZAPI obrigatória'); return; }
    if (provider === 'cloud_api') {
      if (!form.business_account_id || !form.phone_number_id || !form.api_key) {
        toast.error('WABA ID, phone_number_id e Meta token são obrigatórios para Cloud API');
        return;
      }
    }
    try {
      await create.mutateAsync({ ...form, provider });
      toast.success('Instância criada');
      reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#BAA05E] hover:bg-[#917D3D] text-white gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nova instância
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova instância WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Provider</Label>
            <RadioGroup value={provider} onValueChange={(v) => setProvider(v as any)} className="grid grid-cols-2 gap-3">
              <label className={cn(
                'flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer hover:bg-muted/30',
                provider === 'uazapi' ? 'border-[#BAA05E] bg-[#BAA05E]/5' : 'border-border',
              )}>
                <RadioGroupItem value="uazapi" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">UAZAPI</p>
                  <p className="text-xs text-muted-foreground">Não-oficial. Texto livre. Janela 24h.</p>
                </div>
              </label>
              <label className={cn(
                'flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer hover:bg-muted/30',
                provider === 'cloud_api' ? 'border-[#BAA05E] bg-[#BAA05E]/5' : 'border-border',
              )}>
                <RadioGroupItem value="cloud_api" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Meta Cloud API</p>
                  <p className="text-xs text-muted-foreground">Oficial. Templates aprovados.</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instance_name">Nome da instância *</Label>
            <Input
              id="instance_name"
              placeholder="Ex: + que Vencedores Blast"
              value={form.instance_name}
              onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
            />
          </div>

          {provider === 'uazapi' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="api_url">API URL *</Label>
                <Input
                  id="api_url"
                  placeholder="https://free.uazapi.com"
                  value={form.api_url}
                  onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="api_key">API Key (token)</Label>
                  <Input
                    id="api_key"
                    type="password"
                    placeholder="..."
                    value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin_token">Admin Token</Label>
                  <Input
                    id="admin_token"
                    type="password"
                    placeholder="..."
                    value={form.admin_token}
                    onChange={(e) => setForm({ ...form, admin_token: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="instance_token">Instance Token</Label>
                  <Input
                    id="instance_token"
                    placeholder="..."
                    value={form.instance_token}
                    onChange={(e) => setForm({ ...form, instance_token: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subdomain">Subdomain</Label>
                  <Input
                    id="subdomain"
                    placeholder="squaad"
                    value={form.subdomain}
                    onChange={(e) => setForm({ ...form, subdomain: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'cloud_api' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="business_account_id">WABA ID (Business Account) *</Label>
                <Input
                  id="business_account_id"
                  placeholder="123456789012345"
                  value={form.business_account_id}
                  onChange={(e) => setForm({ ...form, business_account_id: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone_number_id">Phone Number ID *</Label>
                <Input
                  id="phone_number_id"
                  placeholder="123456789012345"
                  value={form.phone_number_id}
                  onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api_key">Meta Permanent Token *</Label>
                <Input
                  id="api_key"
                  type="password"
                  placeholder="EAA..."
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Pega em{' '}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">
                    developers.facebook.com/apps <ExternalLink className="h-3 w-3" />
                  </a>
                  {' '}→ teu app → WhatsApp → API Setup → System User token (permanente).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="verification_pin">PIN de Registro (6 dígitos)</Label>
                <Input
                  id="verification_pin"
                  value={form.verification_pin}
                  onChange={(e) => setForm({ ...form, verification_pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="482610"
                  maxLength={6}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  PIN definido no POST /register da Meta. Guarda pra re-registrar ou 2FA.
                </p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Foto da instância</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                {form.avatar_url ? (
                  <>
                    <img
                      src={form.avatar_url}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover border-2 border-[#BAA05E]/40"
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
                  <div className="w-14 h-14 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-[10px] font-semibold">
                    {provider === 'cloud_api' ? 'META' : 'UAZ'}
                  </div>
                )}
              </div>
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
                  disabled={uploadingAvatar}
                />
                <div className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm',
                  uploadingAvatar
                    ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                    : 'border-[#BAA05E] bg-[#BAA05E]/10 text-[#BAA05E] hover:bg-[#BAA05E]/20 cursor-pointer',
                )}>
                  {uploadingAvatar
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                    : <><Upload className="w-3.5 h-3.5" /> Escolher do computador</>}
                </div>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Imagem mostrada no painel CRM. PNG/JPG/WEBP até 5MB.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input
              id="notes"
              placeholder="Ex: chip Vivo SP, separado da atenção ao cliente"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className={cn(
            'rounded-lg border-2 p-3 space-y-2',
            form.is_dedicated_blast ? 'border-amber-300 bg-amber-50' : 'border-border',
          )}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="is_dedicated_blast" className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  Instância dedicada para blast
                </Label>
                <p className="text-xs text-muted-foreground">
                  Só ative se este chip/número é EXCLUSIVO de blast. Nunca marque a instância principal de atendimento.
                </p>
              </div>
              <Switch
                id="is_dedicated_blast"
                checked={form.is_dedicated_blast}
                onCheckedChange={(v) => setForm({ ...form, is_dedicated_blast: v })}
              />
            </div>
            {form.is_dedicated_blast && (
              <p className="text-xs text-amber-800 flex items-start gap-1.5 mt-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                wa_campaigns SÓ pode usar esta instância. Trava anti-ban: você levou ban Meta em 17/05/2025 ao blastar pela instância principal.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending} className="bg-[#BAA05E] hover:bg-[#917D3D] text-white">
              {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Criar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BusinessProfile {
  about?: string;
  description?: string;
  address?: string;
  email?: string;
  vertical?: string;
  websites?: string[];
  profile_picture_url?: string;
}

const VERTICALS = [
  { value: 'UNDEFINED', label: 'Não definido' },
  { value: 'OTHER', label: 'Outro' },
  { value: 'AUTO', label: 'Automotivo' },
  { value: 'BEAUTY', label: 'Beleza' },
  { value: 'APPAREL', label: 'Moda' },
  { value: 'EDU', label: 'Educação' },
  { value: 'ENTERTAIN', label: 'Entretenimento' },
  { value: 'EVENT_PLAN', label: 'Eventos' },
  { value: 'FINANCE', label: 'Finanças' },
  { value: 'GROCERY', label: 'Mercado' },
  { value: 'GOVT', label: 'Governo' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'HEALTH', label: 'Saúde' },
  { value: 'NONPROFIT', label: 'ONG' },
  { value: 'PROF_SERVICES', label: 'Serviços profissionais' },
  { value: 'RETAIL', label: 'Varejo' },
  { value: 'TRAVEL', label: 'Turismo' },
  { value: 'RESTAURANT', label: 'Restaurante' },
];

function EditInstanceDialog({ instance, open, onClose }: { instance: Instance | null; open: boolean; onClose: () => void }) {
  const update = useUpdateInstance();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState<Partial<Instance>>({});

  // Perfil WhatsApp Business (visível pros leads quando abrem a conversa).
  // Separado do avatar_url (que é display interno do CRM).
  const [waProfile, setWaProfile] = useState<BusinessProfile | null>(null);
  const [waProfileOriginal, setWaProfileOriginal] = useState<BusinessProfile | null>(null);
  const [waProfileLoading, setWaProfileLoading] = useState(false);
  const [waProfileSaving, setWaProfileSaving] = useState(false);
  const [waPhotoSaving, setWaPhotoSaving] = useState(false);

  useEffect(() => {
    if (instance) setForm({ ...instance });
  }, [instance]);

  // Carrega perfil WA Business quando abre o modal pra instância Cloud API
  useEffect(() => {
    if (!open || !instance || instance.provider !== 'cloud_api') {
      setWaProfile(null);
      setWaProfileOriginal(null);
      return;
    }
    setWaProfileLoading(true);
    supabase.functions
      .invoke('wa-cloud-profile', { body: { instance_id: instance.id }, method: 'GET' as any })
      // fallback: alguns clientes não passam GET via invoke. usa fetch direto.
      .catch(() => null)
      .then(async (r) => {
        let profile: BusinessProfile | null = r?.data?.profile || null;
        if (!profile) {
          try {
            const { data: sess } = await supabase.auth.getSession();
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-cloud-profile?instance_id=${instance.id}`,
              { headers: { Authorization: `Bearer ${sess.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}` } },
            );
            const j = await res.json();
            if (j.success) profile = j.profile;
          } catch {/* */}
        }
        const p = profile || {};
        setWaProfile(p);
        setWaProfileOriginal(p);
      })
      .finally(() => setWaProfileLoading(false));
  }, [open, instance]);

  if (!instance) return null;
  const isCloud = (form.provider || instance.provider) === 'cloud_api';

  const waProfileDirty = waProfile && waProfileOriginal && JSON.stringify(waProfile) !== JSON.stringify(waProfileOriginal);

  // Sobe a foto da instância (CRM) pro perfil WhatsApp Business (Meta).
  // O lead vê essa foto quando abre conversa com o número.
  const uploadProfilePicture = async (imageUrl?: string) => {
    if (!instance) return;
    const url = imageUrl || form.avatar_url || instance.avatar_url;
    if (!url) {
      toast.error('Defina primeiro a "Foto da instância" (upload no topo do modal)');
      return;
    }
    setWaPhotoSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('wa-cloud-profile', {
        body: { instance_id: instance.id, action: 'upload_picture', image_url: url },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Foto do WhatsApp atualizada. Pode levar até 1 min pra propagar.');
      // Recarrega perfil pra refletir profile_picture_url
      const { data: r } = await supabase.functions.invoke('wa-cloud-profile', {
        body: { instance_id: instance.id }, method: 'GET' as any,
      });
      if (r?.profile) {
        setWaProfile(r.profile);
        setWaProfileOriginal(r.profile);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setWaPhotoSaving(false);
    }
  };

  const saveWaProfile = async () => {
    if (!waProfile || !instance) return;
    setWaProfileSaving(true);
    try {
      const fields: any = {};
      const keys: (keyof BusinessProfile)[] = ['about', 'description', 'address', 'email', 'vertical', 'websites'];
      for (const k of keys) {
        if (waProfile[k] !== waProfileOriginal?.[k]) {
          fields[k] = waProfile[k];
        }
      }
      if (Object.keys(fields).length === 0) {
        toast.info('Nenhuma alteração no perfil');
        setWaProfileSaving(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('wa-cloud-profile', {
        body: { instance_id: instance.id, fields },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Perfil WhatsApp Business atualizado');
      setWaProfileOriginal({ ...waProfile });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setWaProfileSaving(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadInstanceAvatar(file);
      setForm(prev => ({ ...prev, avatar_url: url }));
      toast.success('Foto enviada');
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submit = async () => {
    try {
      await update.mutateAsync({
        id: instance.id,
        updates: {
          instance_name: form.instance_name || instance.instance_name,
          avatar_url: form.avatar_url ?? null,
          notes: form.notes ?? null,
          verification_pin: form.verification_pin ?? null,
          api_key: form.api_key ?? instance.api_key,
          phone_number_id: form.phone_number_id ?? instance.phone_number_id,
          business_account_id: form.business_account_id ?? instance.business_account_id,
          api_url: form.api_url ?? instance.api_url,
        } as any,
      });
      toast.success('Instância atualizada');
      onClose();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar instância</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Foto da instância</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                {form.avatar_url ? (
                  <>
                    <img src={form.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-[#BAA05E]/40" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, avatar_url: null })}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-[10px] font-semibold">
                    {isCloud ? 'META' : 'UAZ'}
                  </div>
                )}
              </div>
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
                  disabled={uploadingAvatar}
                />
                <div className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm',
                  uploadingAvatar
                    ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                    : 'border-[#BAA05E] bg-[#BAA05E]/10 text-[#BAA05E] hover:bg-[#BAA05E]/20 cursor-pointer',
                )}>
                  {uploadingAvatar
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                    : <><Upload className="w-3.5 h-3.5" /> Trocar foto</>}
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da instância</Label>
            <Input
              value={form.instance_name || ''}
              onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
            />
          </div>

          {isCloud && (
            <>
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input value={form.phone_number_id || ''} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>WABA ID</Label>
                <Input value={form.business_account_id || ''} onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Meta Token (deixe vazio pra manter atual)</Label>
                <Input type="password" placeholder="Substituir token..." value={form.api_key !== instance.api_key ? (form.api_key || '') : ''} onChange={(e) => setForm({ ...form, api_key: e.target.value || instance.api_key })} />
              </div>
              <div className="space-y-1.5">
                <Label>PIN de Registro</Label>
                <Input
                  value={form.verification_pin || ''}
                  onChange={(e) => setForm({ ...form, verification_pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="482610"
                  maxLength={6}
                  className="font-mono"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* Perfil WhatsApp Business (visível pros leads) — só Cloud API */}
          {isCloud && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5" /> Perfil WhatsApp Business
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    O que os leads veem quando abrem conversa com seu número. Diferente da foto interna do CRM.
                  </p>
                </div>
                {waProfileLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {waProfile && !waProfileLoading && (
                <>
                  {/* Foto do perfil WA Business */}
                  <div className="rounded-md border border-blue-500/20 bg-background/50 p-3 flex items-center gap-3">
                    {waProfile.profile_picture_url ? (
                      <img
                        src={waProfile.profile_picture_url}
                        alt="Foto WhatsApp"
                        className="w-12 h-12 rounded-full object-cover border border-blue-500/40"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-dashed border-blue-500/30 flex items-center justify-center text-[10px] font-semibold text-blue-300">
                        SEM<br />FOTO
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">Foto que aparece pros leads</p>
                      <p className="text-[10px] text-muted-foreground">
                        Usa a "Foto da instância" do topo do modal. Recomendado 640x640.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 border-blue-500/40 text-blue-700 hover:bg-blue-500/10 whitespace-nowrap"
                      onClick={() => uploadProfilePicture()}
                      disabled={waPhotoSaving || (!form.avatar_url && !instance.avatar_url)}
                    >
                      {waPhotoSaving
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</>
                        : <><Upload className="h-3 w-3" /> Sincronizar foto</>}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Status (about) <span className="text-muted-foreground">· max 139</span></Label>
                    <Input
                      value={waProfile.about || ''}
                      onChange={(e) => setWaProfile({ ...waProfile, about: e.target.value.slice(0, 139) })}
                      placeholder="Ex: + que Vencedores · IA para Negócios · Atendimento oficial"
                      maxLength={139}
                      className="h-8 text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{(waProfile.about || '').length}/139</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrição <span className="text-muted-foreground">· max 512</span></Label>
                    <Textarea
                      value={waProfile.description || ''}
                      onChange={(e) => setWaProfile({ ...waProfile, description: e.target.value.slice(0, 512) })}
                      placeholder="Descrição do negócio"
                      maxLength={512}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={waProfile.email || ''}
                        onChange={(e) => setWaProfile({ ...waProfile, email: e.target.value.slice(0, 128) })}
                        placeholder="contato@squaad.com.br"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vertical</Label>
                      <select
                        value={waProfile.vertical || 'UNDEFINED'}
                        onChange={(e) => setWaProfile({ ...waProfile, vertical: e.target.value })}
                        className="h-8 text-sm w-full rounded-md border border-input bg-background px-2"
                      >
                        {VERTICALS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Endereço <span className="text-muted-foreground">· max 256</span></Label>
                    <Input
                      value={waProfile.address || ''}
                      onChange={(e) => setWaProfile({ ...waProfile, address: e.target.value.slice(0, 256) })}
                      placeholder="Rua, número, bairro, cidade"
                      maxLength={256}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Sites <span className="text-muted-foreground">· até 2 URLs</span></Label>
                    <Input
                      value={waProfile.websites?.[0] || ''}
                      onChange={(e) => {
                        const w = [...(waProfile.websites || [])];
                        w[0] = e.target.value;
                        setWaProfile({ ...waProfile, websites: w.filter(Boolean) });
                      }}
                      placeholder="https://squaad.com.br"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={waProfile.websites?.[1] || ''}
                      onChange={(e) => {
                        const w = [...(waProfile.websites || [])];
                        w[1] = e.target.value;
                        setWaProfile({ ...waProfile, websites: w.filter(Boolean) });
                      }}
                      placeholder="https://instagram.com/squaad (opcional)"
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-blue-500/40 text-blue-700 hover:bg-blue-500/10"
                      onClick={saveWaProfile}
                      disabled={!waProfileDirty || waProfileSaving}
                    >
                      {waProfileSaving
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Salvando</>
                        : <><Save className="h-3 w-3" /> Salvar perfil</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={submit} disabled={update.isPending} className="bg-[#BAA05E] hover:bg-[#917D3D] text-white">
              {update.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppInstances() {
  const { data: instances = [], isLoading } = useInstances();
  const update = useUpdateInstance();
  const deleteInstance = useDeleteInstance();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingInstance = instances.find(i => i.id === editingId) || null;

  const handleToggleDedicated = async (instance: Instance) => {
    try {
      await update.mutateAsync({
        id: instance.id,
        updates: { is_dedicated_blast: !instance.is_dedicated_blast } as any,
      });
      toast.success(instance.is_dedicated_blast
        ? 'Instância marcada como NÃO-dedicada (não pode mais ser usada em wa_campaigns)'
        : 'Instância marcada como dedicada para blast'
      );
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleDelete = async (instance: Instance) => {
    if (!confirm(`Excluir a instância "${instance.instance_name}"? Esta ação é irreversível.`)) return;
    try {
      await deleteInstance.mutateAsync(instance.id);
      toast.success('Instância removida');
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <header className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
            Marketing · Instâncias WhatsApp
          </span>
          <h1 className="text-2xl font-semibold mt-1 leading-tight tracking-tight">
            Instâncias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure instâncias UAZAPI ou Meta Cloud API para envio. Marque <strong>dedicated blast</strong>
            {' '}apenas em chips exclusivos para campanhas em massa.
          </p>
        </div>
        <NewInstanceDialog />
      </header>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Trava anti-ban ativa</p>
          <p className="text-amber-800/80">
            Campanhas WhatsApp (<code>wa_campaigns</code>) só processam em instância com <code>is_dedicated_blast=true</code>.
            Você levou ban Meta em 17/05/2025. Use chip separado.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando instâncias...
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma instância cadastrada ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {instances.map((inst) => {
            const isCloud = inst.provider === 'cloud_api';
            const isDisconnected = !isCloud && inst.status !== 'connected';
            return (
              <Card key={inst.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {inst.avatar_url ? (
                        <img
                          src={inst.avatar_url}
                          alt={inst.instance_name}
                          className={cn(
                            'w-12 h-12 rounded-full object-cover shrink-0 border-2',
                            isCloud ? 'border-blue-500/40' : 'border-green-500/40',
                          )}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2',
                          isCloud ? 'bg-blue-500/20 border-blue-500/40' : 'bg-green-500/20 border-green-500/40',
                        )}>
                          {isCloud
                            ? <Cloud className="h-5 w-5 text-blue-600" />
                            : <Smartphone className="h-5 w-5 text-green-600" />}
                        </div>
                      )}
                      <div className="space-y-1 min-w-0 flex-1">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {inst.instance_name}
                          <Badge variant="outline" className={cn(
                            'text-[10px] gap-1',
                            isCloud ? 'border-blue-300 text-blue-700' : 'border-amber-300 text-amber-700',
                          )}>
                            {isCloud ? <><Cloud className="h-2.5 w-2.5" /> API OFICIAL</> : <><Smartphone className="h-2.5 w-2.5" /> UAZAPI</>}
                          </Badge>
                          {inst.is_dedicated_blast && (
                            <Badge className="bg-amber-100 text-amber-800 border-0 gap-1 text-[10px]">
                              <ShieldAlert className="h-2.5 w-2.5" /> BLAST DEDICADO
                            </Badge>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {inst.phone_number || '—'} · Status:{' '}
                          <code className={cn(
                            inst.status === 'connected' ? 'text-green-600' : 'text-amber-600',
                          )}>{inst.status}</code>
                        </p>
                        {isCloud && (
                          <p className="text-xs text-muted-foreground">
                            WABA: <code>{inst.business_account_id || '—'}</code> · Phone ID: <code>{inst.phone_number_id || '—'}</code>
                          </p>
                        )}
                        {inst.notes && (
                          <p className="text-xs italic text-muted-foreground">{inst.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center gap-2 mr-2">
                        <Label htmlFor={`ded-${inst.id}`} className="text-xs whitespace-nowrap">Dedicada blast</Label>
                        <Switch
                          id={`ded-${inst.id}`}
                          checked={!!inst.is_dedicated_blast}
                          onCheckedChange={() => handleToggleDedicated(inst)}
                        />
                      </div>
                      {isDisconnected && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          title="Reconectar via QR Code (tela completa)"
                        >
                          <Link to="/admin/whatsapp">
                            <QrCode className="h-3.5 w-3.5" /> QR
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingId(inst.id)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleDelete(inst)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <EditInstanceDialog
        instance={editingInstance}
        open={!!editingId}
        onClose={() => setEditingId(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-blue-600" />
            Setup Meta Cloud API
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>Pra ativar envio de templates aprovados via API oficial Meta, você precisa:</p>
          <ol className="list-decimal pl-6 space-y-1">
            <li>App no <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline">developers.facebook.com</a> com WhatsApp Business</li>
            <li>WhatsApp Business Account (WABA) verificado no Business Manager</li>
            <li>Phone number adicionado à WABA</li>
            <li>System User Permanent Token (não temporário) com scope <code>whatsapp_business_messaging</code></li>
            <li>Cadastrar a instância aqui com WABA ID + Phone Number ID + Token</li>
            <li>Marcar <strong>Dedicated blast</strong> e ativar</li>
            <li>Sincronizar templates aprovados via edge <code>wa-sync-templates</code> (botão em Templates WhatsApp)</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
