import type { Faixa } from '@/maisvencedores/types/member';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referred_faixa: Faixa;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  approved_at: string | null;
  expires_at: string;
  referred_profile?: {
    company_name: string;
    owner_name: string;
    photo_url: string | null;
    faixa: Faixa;
  };
}

export interface ReferralStats {
  id: string;
  profile_id: string;
  total_referrals: number;
  bronze_referrals: number;
  prata_referrals: number;
  ouro_referrals: number;
  pending_referrals: number;
  rank_position: number | null;
}

export interface RankingEntry {
  profile_id: string;
  total_referrals: number;
  rank_position: number;
  profile: {
    company_name: string;
    owner_name: string;
    photo_url: string | null;
    faixa: Faixa;
  };
}

export function useReferrals() {
  const { profile } = useProfile();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;

    setLoading(true);

    // Fetch referrals
    const { data: referralsData } = await supabase
      .from('referrals')
      .select(`
        *,
        referred_profile:profiles!referrals_referred_id_fkey (
          company_name,
          owner_name,
          photo_url,
          plan
        )
      `)
      .eq('referrer_id', profile.id)
      .order('created_at', { ascending: false });

    if (referralsData) {
      setReferrals(referralsData as unknown as Referral[]);
    }

    // Fetch stats
    const { data: statsData } = await supabase
      .from('referral_stats')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (statsData) {
      setStats(statsData as ReferralStats);
    }

    // Fetch ranking (top 10)
    const { data: rankingData } = await supabase
      .from('referral_stats')
      .select(`
        profile_id,
        total_referrals,
        rank_position,
        profile:profiles!referral_stats_profile_id_fkey (
          company_name,
          owner_name,
          photo_url,
          plan
        )
      `)
      .gt('total_referrals', 0)
      .order('total_referrals', { ascending: false })
      .limit(10);

    if (rankingData) {
      setRanking(rankingData as unknown as RankingEntry[]);
    }

    setLoading(false);
  };

  // getUpgradeProgress() saiu daqui em 15/07/2026. Ela prometia "indique 15 pessoas e vire
  // Prata; mais 10 e vire Ouro" — mecânica de plano de assinatura. No modelo de FAIXA isso
  // está errado: faixa vem de fazer as formações (Reprograme-se, FPO/FPI, Master, Trainer),
  // não de indicar gente. Ninguém indica seu caminho até a Faixa Verde. Nada consumia a
  // função (a tela usa RewardsProgress, que conta pontos), então saiu inteira.

  return { 
    referrals, 
    stats, 
    ranking, 
    loading, 
    refetch: fetchData,
  };
}
