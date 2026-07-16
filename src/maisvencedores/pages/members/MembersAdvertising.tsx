import { useState } from 'react';
import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { AdvertisementCard } from '@/maisvencedores/components/members/AdvertisementCard';
import { useAdvertisements } from '@/maisvencedores/hooks/useAdvertisements';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/maisvencedores/components/shared/ImageUpload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Lock, Loader2, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MembersAdvertising() {
  const { profile, alcanca } = useProfile();
  const {
    myAds,
    approvedAds,
    loading,
    canCreateAd,
    getAdLimit,
    getMonthlyAdCount,
    createAd,
    deleteAd,
  } = useAdvertisements();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: null as string | null,
    linkUrl: '',
  });

  const hasAccess = alcanca('verde');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.linkUrl) return;

    setCreating(true);
    const success = await createAd(formData);
    if (success) {
      setDialogOpen(false);
      setFormData({ title: '', description: '', imageUrl: null, linkUrl: '' });
    }
    setCreating(false);
  };

  const handleDelete = async (adId: string) => {
    if (confirm('Tem certeza que deseja excluir este anúncio?')) {
      await deleteAd(adId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  // Map approvedAds to the format expected by AdvertisementCard
  const mappedApprovedAds = approvedAds.map((ad) => ({
    id: ad.id,
    memberId: ad.profileId,
    memberName: ad.memberName || 'Membro',
    title: ad.title,
    description: ad.description || '',
    imageUrl: ad.imageUrl || '',
    linkUrl: ad.linkUrl || '',
    isPremium: ad.isPremium,
    views: ad.views,
    startDate: ad.startDate,
    endDate: ad.endDate,
  }));

  if (!hasAccess) {
    return (
      <div className="min-h-screen">
        <MembersHeader title="Publicidade" subtitle="Anuncie para a comunidade" />
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Exclusivo para Membros</h2>
            <p className="text-muted-foreground mb-6">Faça login para anunciar seus produtos e serviços</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MembersHeader title="Publicidade" subtitle="Anuncie para a comunidade" />
      
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="p-6 space-y-8">
          {/* Stats and Create Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-card/50 border border-border/50 rounded-lg px-4 py-2">
                <span className="text-sm text-muted-foreground">Plano: </span>
                <span className="font-semibold text-gold capitalize">{profile?.faixa || 'Bronze'}</span>
              </div>
              <div className="bg-card/50 border border-border/50 rounded-lg px-4 py-2">
                <span className="text-sm text-muted-foreground">Anúncios este mês: </span>
                <span className="font-semibold text-foreground">
                  {getMonthlyAdCount()}/{getAdLimit()}
                </span>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="gold" 
                  disabled={!canCreateAd()}
                  className="disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Anúncio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Criar Novo Anúncio</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ex: Consultoria Empresarial"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva seu produto ou serviço..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem</Label>
                    <ImageUpload
                      value={formData.imageUrl}
                      onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                      folder="advertisements"
                      placeholder="Imagem do anúncio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link *</Label>
                    <Input
                      value={formData.linkUrl}
                      onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                      placeholder="https://seusite.com.br"
                      type="url"
                      required
                    />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                    <p>⏳ Seu anúncio será revisado por um administrador antes de ser publicado.</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={creating} variant="gold">
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enviar para Aprovação
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* My Ads */}
          {myAds.length > 0 && (
            <Card className="bg-card/50 border-gold/20">
              <CardHeader>
                <CardTitle className="text-lg">Meus Anúncios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {myAds.map((ad) => (
                    <div
                      key={ad.id}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-lg border',
                        ad.status === 'approved' && 'border-green-500/30 bg-green-500/5',
                        ad.status === 'rejected' && 'border-red-500/30 bg-red-500/5',
                        ad.status === 'pending' && 'border-yellow-500/30 bg-yellow-500/5'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {ad.imageUrl && (
                          <img
                            src={ad.imageUrl}
                            alt={ad.title}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{ad.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {ad.views} visualizações
                          </p>
                          {ad.status === 'rejected' && ad.rejectedReason && (
                            <p className="text-xs text-red-400 mt-1">
                              Motivo: {ad.rejectedReason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(ad.status)}
                        {ad.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(ad.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved Ads from Community */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Anúncios da Comunidade</h2>
            {mappedApprovedAds.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-xl border border-border/50">
                Nenhum anúncio ativo no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mappedApprovedAds.map((ad) => (
                  <AdvertisementCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
