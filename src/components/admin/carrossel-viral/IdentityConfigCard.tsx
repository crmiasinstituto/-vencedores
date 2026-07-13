// Card premium de identidade visual: avatar circular com upload, inputs em grid, badge de status
import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Settings2, ChevronDown, Save, Upload, Camera, CheckCircle2, Loader2, Trash2, ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CarouselConfig } from './templates';
import { uploadCarouselAsset } from './uploadAvatar';

interface IdentityConfigCardProps {
  config: CarouselConfig;
  onChange: (config: CarouselConfig) => void;
  defaultOpen?: boolean;
}

export function IdentityConfigCard({ config, onChange, defaultOpen }: IdentityConfigCardProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [draft, setDraft] = useState<CarouselConfig>(config);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isConfigured = !!(config.handle || config.authorName || config.avatarUrl);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  async function handleAvatarUpload(file?: File) {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadCarouselAsset(file, 'avatars');
      setDraft({ ...draft, avatarUrl: url });
      toast.success('Foto de perfil enviada');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function handleLogoUpload(file?: File) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadCarouselAsset(file, 'logos');
      setDraft({ ...draft, logoUrl: url });
      toast.success('Logo enviado');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  function handleSave() {
    setSaving(true);
    onChange(draft);
    setTimeout(() => {
      setSaving(false);
      toast.success('Identidade salva');
    }, 300);
  }

  function handleReset() {
    setDraft(config);
  }

  const initials = (draft.authorName || draft.handle || '?')
    .replace(/^@/, '')
    .split(/[\s.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Settings2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold flex items-center gap-2">
                  Identidade visual
                  {isConfigured ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400 gap-1"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {config.handle || 'configurado'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/30 text-amber-400">
                      pendente
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Personalize avatar, @ e logo que aparecem nos slides
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border bg-background/40 p-5 space-y-5">
            {/* ════════════ Avatar circular grande + upload ════════════ */}
            <div className="flex items-start gap-5">
              <div className="relative group flex-shrink-0">
                {draft.avatarUrl ? (
                  <img
                    src={draft.avatarUrl}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-4 border-primary/30"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border-4 border-border flex items-center justify-center text-2xl font-black text-primary">
                    {initials || <Camera className="w-8 h-8 opacity-60" />}
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Trocar
                    </>
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                />
              </div>

              <div className="flex-1 space-y-2">
                <Label className="text-xs font-medium">Foto de perfil</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="gap-2"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {draft.avatarUrl ? 'Trocar foto' : 'Enviar foto'}
                  </Button>
                  {draft.avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraft({ ...draft, avatarUrl: '' })}
                      className="gap-2 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  PNG, JPG ou WebP até 5MB. Foto vai para Supabase Storage (sem problema de CORS).
                </p>
              </div>
            </div>

            {/* ════════════ Inputs em grid ════════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nome de exibição</Label>
                <Input
                  placeholder="Ex: Carlos Eduardo"
                  value={draft.authorName || ''}
                  onChange={(e) => setDraft({ ...draft, authorName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Handle / @</Label>
                <Input
                  placeholder="@seu_perfil"
                  value={draft.handle || ''}
                  onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                />
              </div>
            </div>

            {/* ════════════ Logo (compacto) ════════════ */}
            <div className="border border-border rounded-lg p-3 bg-card/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {draft.logoUrl ? (
                    <img src={draft.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">Logo (template + que Vencedores)</div>
                  <div className="text-[10px] text-muted-foreground">
                    Imagem quadrada que aparece no header dos slides
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="gap-2"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {draft.logoUrl ? 'Trocar' : 'Enviar'}
                </Button>
                {draft.logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft({ ...draft, logoUrl: '' })}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                />
              </div>
            </div>

            {/* ════════════ Footer com Salvar ════════════ */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                {dirty ? 'Alterações pendentes' : 'Tudo salvo'}
              </span>
              <div className="flex gap-2">
                {dirty && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Descartar
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
