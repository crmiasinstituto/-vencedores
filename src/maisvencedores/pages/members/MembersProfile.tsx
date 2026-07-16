import { useState } from 'react';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/maisvencedores/components/shared/ImageUpload';
import { DealForm } from '@/maisvencedores/components/shared/DealForm';
import { FaixaBadge } from '@/maisvencedores/components/members/FaixaBadge';
import { Faixa } from '@/maisvencedores/types/member';
import { ReferralLink } from '@/maisvencedores/components/members/ReferralLink';
import { Loader2, Save, Globe, Instagram, Linkedin, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function MembersProfile() {
  const { profile, loading, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    owner_name: '',
    title: '',
    segment: '',
    description: '',
    website: '',
    instagram: '',
    linkedin: '',
    whatsapp: '',
    email: '',
    photo_url: '',
    logo_url: ''
  });

  const startEditing = () => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        owner_name: profile.owner_name || '',
        title: profile.title || '',
        segment: profile.segment || '',
        description: profile.description || '',
        website: profile.website || '',
        instagram: profile.instagram || '',
        linkedin: profile.linkedin || '',
        whatsapp: profile.whatsapp || '',
        email: profile.email || '',
        photo_url: profile.photo_url || '',
        logo_url: profile.logo_url || ''
      });
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await updateProfile(formData);
      if (error) throw error;
      toast.success('Perfil atualizado!');
      setIsEditing(false);
    } catch (error) {
      toast.error('Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Perfil não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações</p>
        </div>
        <div className="flex gap-2">
          <DealForm />
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-black">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </>
          ) : (
            <Button onClick={startEditing} variant="outline">Editar Perfil</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Card */}
        <Card className="lg:col-span-2 bg-card/50 border-gold/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Photo */}
              <div className="flex flex-col items-center gap-4">
                {isEditing ? (
                  <ImageUpload
                    value={formData.photo_url}
                    onChange={(url) => setFormData({ ...formData, photo_url: url || '' })}
                    folder="photos"
                    placeholder="Foto"
                  />
                ) : (
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.photo_url || undefined} />
                    <AvatarFallback className="text-2xl">{profile.owner_name?.charAt(0) || 'M'}</AvatarFallback>
                  </Avatar>
                )}
                <FaixaBadge faixa={(profile.faixa as Faixa) || 'branco'} size="lg" />
              </div>

              {/* Info */}
              <div className="flex-1 space-y-4">
                {isEditing ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Empresa</Label>
                        <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Seu Nome</Label>
                        <Input value={formData.owner_name} onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cargo</Label>
                        <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Segmento</Label>
                        <Input value={formData.segment} onChange={(e) => setFormData({ ...formData, segment: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h2 className="text-2xl font-bold">{profile.company_name || 'Empresa não informada'}</h2>
                      <p className="text-muted-foreground">{profile.owner_name} • {profile.title || 'Cargo não informado'}</p>
                    </div>
                    {profile.segment && <Badge variant="outline">{profile.segment}</Badge>}
                    <p className="text-muted-foreground">{profile.description || 'Sem descrição'}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Card */}
        <Card className="bg-card/50 border-gold/20">
          <CardHeader>
            <CardTitle className="text-lg">Código de Indicação</CardTitle>
          </CardHeader>
          <CardContent>
            <ReferralLink referralCode={profile.referral_code} />
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="lg:col-span-3 bg-card/50 border-gold/20">
          <CardHeader>
            <CardTitle className="text-lg">Contato</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://" />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={formData.instagram} onChange={(e) => setFormData({ ...formData, instagram: e.target.value })} placeholder="@usuario" />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input value={formData.linkedin} onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })} placeholder="URL do perfil" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@empresa.com" />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Globe className="h-4 w-4" /> {profile.website}
                  </a>
                )}
                {profile.instagram && (
                  <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Instagram className="h-4 w-4" /> {profile.instagram}
                  </a>
                )}
                {profile.linkedin && (
                  <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                )}
                {profile.whatsapp && (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {profile.whatsapp}
                  </span>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Mail className="h-4 w-4" /> {profile.email}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
