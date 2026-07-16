import type { Faixa } from '@/maisvencedores/types/member';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

export interface Advertisement {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  isPremium: boolean;
  views: number;
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  rejectedReason: string | null;
  isActive: boolean;
  createdAt: Date;
  memberName?: string;
}

// Quantos anúncios por mês cada faixa pode publicar. Antes era por plano pago
// (bronze:1, prata:2, ouro:4); agora acompanha a progressão — quem avançou mais no
// ecossistema tem mais espaço.
const LIMITE_ANUNCIOS: Record<Faixa, number> = {
  branco: 0,
  vermelho: 1,
  verde: 2,
  roxo: 3,
  marrom: 4,
  preta: 4,
};

export function useAdvertisements() {
  const { profile } = useProfile();
  const [myAds, setMyAds] = useState<Advertisement[]>([]);
  const [approvedAds, setApprovedAds] = useState<Advertisement[]>([]);
  const [allAds, setAllAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvertisements = async () => {
    try {
      setLoading(true);

      // Fetch all accessible ads
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: Advertisement[] = (data || []).map((a) => ({
        id: a.id,
        profileId: a.profile_id,
        title: a.title,
        description: a.description,
        imageUrl: a.image_url,
        linkUrl: a.link_url,
        isPremium: a.is_premium || false,
        views: a.views || 0,
        startDate: new Date(a.start_date),
        endDate: new Date(a.end_date),
        status: (a.status || 'pending') as Advertisement['status'],
        rejectedReason: a.rejected_reason,
        isActive: a.is_active || false,
        createdAt: new Date(a.created_at || ''),
      }));

      setAllAds(mapped);

      // Filter my ads
      if (profile?.id) {
        setMyAds(mapped.filter((a) => a.profileId === profile.id));
      }

      // Filter approved ads
      setApprovedAds(mapped.filter((a) => a.status === 'approved' && a.isActive));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyAdCount = () => {
    if (!profile?.id) return 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return myAds.filter((a) => a.createdAt >= startOfMonth).length;
  };

  const canCreateAd = () => {
    if (!profile?.faixa) return false;
    const limit = LIMITE_ANUNCIOS[profile.faixa as Faixa];
    return getMonthlyAdCount() < limit;
  };

  const getAdLimit = () => {
    if (!profile?.faixa) return 0;
    return LIMITE_ANUNCIOS[profile.faixa as Faixa];
  };

  const createAd = async (ad: {
    title: string;
    description: string;
    imageUrl: string | null;
    linkUrl: string;
  }) => {
    if (!profile?.id) {
      toast.error('Perfil não encontrado');
      return false;
    }

    if (!canCreateAd()) {
      toast.error(`Limite de ${getAdLimit()} anúncios por mês atingido`);
      return false;
    }

    try {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);

      const { error } = await supabase.from('advertisements').insert({
        profile_id: profile.id,
        title: ad.title,
        description: ad.description,
        image_url: ad.imageUrl,
        link_url: ad.linkUrl,
        start_date: now.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'pending',
        is_active: false,
      });

      if (error) throw error;

      toast.success('Anúncio enviado para aprovação!');
      await fetchAdvertisements();
      return true;
    } catch (err: any) {
      toast.error('Erro ao criar anúncio: ' + err.message);
      return false;
    }
  };

  const deleteAd = async (adId: string) => {
    try {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', adId);

      if (error) throw error;

      toast.success('Anúncio removido');
      await fetchAdvertisements();
      return true;
    } catch (err: any) {
      toast.error('Erro ao remover anúncio: ' + err.message);
      return false;
    }
  };

  useEffect(() => {
    fetchAdvertisements();
  }, [profile?.id]);

  return {
    myAds,
    approvedAds,
    allAds,
    loading,
    error,
    canCreateAd,
    getAdLimit,
    getMonthlyAdCount,
    createAd,
    deleteAd,
    refetch: fetchAdvertisements,
  };
}
