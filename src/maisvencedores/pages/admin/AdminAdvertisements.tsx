import { Faixa, FAIXA_INFO } from '@/maisvencedores/types/member';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, Loader2, Eye, Star, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Advertisement {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  is_premium: boolean;
  views: number;
  start_date: string;
  end_date: string;
  status: string;
  rejected_reason: string | null;
  is_active: boolean;
  created_at: string;
  profiles?: {
    owner_name: string;
    company_name: string;
    faixa: Faixa;
  };
}

export default function AdminAdvertisements() {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  useEffect(() => {
    fetchAdvertisements();
  }, []);

  const fetchAdvertisements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('advertisements')
        .select(`
          *,
          profiles:profile_id (
            owner_name,
            company_name,
            faixa
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdvertisements(data || []);
    } catch (error) {
      console.error('Error fetching advertisements:', error);
      toast.error('Erro ao carregar anúncios');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (ad: Advertisement) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('advertisements')
        .update({
          status: 'approved',
          is_active: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', ad.id);

      if (error) throw error;
      toast.success('Anúncio aprovado!');
      fetchAdvertisements();
    } catch (error) {
      toast.error('Erro ao aprovar anúncio');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAd) return;

    try {
      setProcessing(true);
      const { error } = await supabase
        .from('advertisements')
        .update({
          status: 'rejected',
          is_active: false,
          rejected_reason: rejectReason || 'Não atende aos critérios',
        })
        .eq('id', selectedAd.id);

      if (error) throw error;
      toast.success('Anúncio rejeitado');
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedAd(null);
      fetchAdvertisements();
    } catch (error) {
      toast.error('Erro ao rejeitar anúncio');
    } finally {
      setProcessing(false);
    }
  };

  const handleTogglePremium = async (ad: Advertisement) => {
    try {
      const { error } = await supabase
        .from('advertisements')
        .update({ is_premium: !ad.is_premium })
        .eq('id', ad.id);

      if (error) throw error;
      toast.success(ad.is_premium ? 'Destaque removido' : 'Anúncio em destaque!');
      fetchAdvertisements();
    } catch (error) {
      toast.error('Erro ao atualizar anúncio');
    }
  };

  const handleToggleActive = async (ad: Advertisement) => {
    try {
      const { error } = await supabase
        .from('advertisements')
        .update({ is_active: !ad.is_active })
        .eq('id', ad.id);

      if (error) throw error;
      fetchAdvertisements();
    } catch (error) {
      toast.error('Erro ao atualizar anúncio');
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

  const pendingAds = advertisements.filter((a) => a.status === 'pending');
  const approvedAds = advertisements.filter((a) => a.status === 'approved');
  const rejectedAds = advertisements.filter((a) => a.status === 'rejected');

  const renderAdsTable = (ads: Advertisement[], showActions: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Anúncio</TableHead>
          <TableHead>Membro</TableHead>
          <TableHead>Plano</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Destaque</TableHead>
          <TableHead>Views</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ads.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              Nenhum anúncio encontrado.
            </TableCell>
          </TableRow>
        ) : (
          ads.map((ad) => (
            <TableRow key={ad.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {ad.image_url && (
                    <img
                      src={ad.image_url}
                      alt={ad.title}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div>
                    <p className="font-medium">{ad.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ad.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <p className="font-medium">{ad.profiles?.owner_name}</p>
                <p className="text-xs text-muted-foreground">{ad.profiles?.company_name}</p>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {ad.profiles?.faixa && FAIXA_INFO[ad.profiles.faixa].nome}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(ad.status)}</TableCell>
              <TableCell>
                {ad.status === 'approved' && (
                  <Switch
                    checked={ad.is_premium}
                    onCheckedChange={() => handleTogglePremium(ad)}
                  />
                )}
              </TableCell>
              <TableCell>{ad.views}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedAd(ad);
                      setViewDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {ad.link_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(ad.link_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  {showActions && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleApprove(ad)}
                        disabled={processing}
                      >
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedAd(ad);
                          setRejectDialogOpen(true);
                        }}
                        disabled={processing}
                      >
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  )}
                  {ad.status === 'approved' && (
                    <Switch
                      checked={ad.is_active}
                      onCheckedChange={() => handleToggleActive(ad)}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Anúncios</h1>
        <p className="text-muted-foreground">Aprovar e gerenciar anúncios dos membros</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-400">{pendingAds.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Aprovados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-400">{approvedAds.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gold/10 border-gold/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gold flex items-center gap-2">
              <Star className="h-4 w-4" />
              Em Destaque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gold">
              {advertisements.filter((a) => a.is_premium).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="bg-card/50 border-gold/20">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList className="w-full justify-start border-b rounded-none px-4">
                <TabsTrigger value="pending" className="relative">
                  Pendentes
                  {pendingAds.length > 0 && (
                    <span className="ml-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full">
                      {pendingAds.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved">Aprovados</TabsTrigger>
                <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="m-0">
                {renderAdsTable(pendingAds, true)}
              </TabsContent>
              <TabsContent value="approved" className="m-0">
                {renderAdsTable(approvedAds)}
              </TabsContent>
              <TabsContent value="rejected" className="m-0">
                {renderAdsTable(rejectedAds)}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Anúncio</DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="space-y-4">
              {selectedAd.image_url && (
                <img
                  src={selectedAd.image_url}
                  alt={selectedAd.title}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              <div>
                <h3 className="font-semibold text-lg">{selectedAd.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedAd.description || 'Sem descrição'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Membro:</span>
                  <p className="font-medium">{selectedAd.profiles?.owner_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Empresa:</span>
                  <p className="font-medium">{selectedAd.profiles?.company_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Plano:</span>
                  <p className="font-medium">{selectedAd.profiles?.faixa && `Faixa ${FAIXA_INFO[selectedAd.profiles.faixa].nome}`}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Visualizações:</span>
                  <p className="font-medium">{selectedAd.views}</p>
                </div>
              </div>
              {selectedAd.link_url && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => window.open(selectedAd.link_url!, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir Link
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Anúncio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da rejeição (será enviado ao membro):
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Imagem com baixa qualidade, descrição inadequada..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processing}
              >
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
