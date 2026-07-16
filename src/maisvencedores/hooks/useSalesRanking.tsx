import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import type { Faixa } from '@/maisvencedores/types/member';

export interface SalesRankingEntry {
  id: string;
  profile_id: string;
  total_sales: number;
  total_deals: number;
  contribution_amount: number;
  contribution_paid: boolean;
  eligible_for_spotlight: boolean;
  rank_position: number | null;
  updated_at: string;
  profile: {
    owner_name: string;
    company_name: string;
    photo_url: string | null;
    faixa: Faixa;
    investment_amount: number;
  };
}

export interface SalesStats {
  totalSales: number;
  totalDeals: number;
  investmentAmount: number;
  contributionAmount: number;
  eligibleForSpotlight: boolean;
  contributionPaid: boolean;
  progressPercentage: number;
}

export interface Deal {
  id: string;
  title: string;
  amount: number;
  deal_date: string;
  buyer_name: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

// INVESTMENT_BY_PLAN saiu: ele inferia quanto a pessoa investiu a partir do plano pago
// (bronze=500, prata=1500, ouro=3000). Faixa não é preço — é onde a pessoa chegou —, então
// esse chute não existe mais. O valor sai de profiles.investment_amount, que é o dado real;
// sem ele, zero, que é honesto.

export function useSalesRanking() {
  const { profile } = useProfile();
  const [ranking, setRanking] = useState<SalesRankingEntry[]>([]);
  const [myStats, setMyStats] = useState<SalesStats | null>(null);
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      // Fetch ranking - separate queries to avoid join issues
      const { data: simpleRanking } = await supabase
        .from('sales_ranking')
        .select('*')
        .order('total_sales', { ascending: false })
        .limit(10);
      
      if (simpleRanking && simpleRanking.length > 0) {
        const profileIds = simpleRanking.map(r => r.profile_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, owner_name, company_name, photo_url, faixa, investment_amount')
          .in('id', profileIds);
        
        const enrichedRanking = simpleRanking.map(r => ({
          ...r,
          profile: profiles?.find(p => p.id === r.profile_id) || {
            owner_name: 'Membro',
            company_name: '',
            photo_url: null,
            faixa: 'branco' as Faixa,
            investment_amount: 500
          }
        }));
        setRanking(enrichedRanking as SalesRankingEntry[]);
      } else {
        setRanking([]);
      }

      // Fetch my stats
      const { data: myRankingData } = await supabase
        .from('sales_ranking')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      const investmentAmount = profile.investment_amount || 0;

      if (myRankingData) {
        const totalSales = Number(myRankingData.total_sales) || 0;
        setMyStats({
          totalSales,
          totalDeals: myRankingData.total_deals || 0,
          investmentAmount,
          contributionAmount: Number(myRankingData.contribution_amount) || 0,
          eligibleForSpotlight: myRankingData.eligible_for_spotlight || false,
          contributionPaid: myRankingData.contribution_paid || false,
          progressPercentage: investmentAmount > 0 ? (totalSales / investmentAmount) * 100 : 0,
        });
      } else {
        setMyStats({
          totalSales: 0,
          totalDeals: 0,
          investmentAmount,
          contributionAmount: 0,
          eligibleForSpotlight: false,
          contributionPaid: false,
          progressPercentage: 0,
        });
      }

      // Fetch my deals
      const { data: dealsData } = await supabase
        .from('business_deals')
        .select('*')
        .eq('seller_profile_id', profile.id)
        .order('deal_date', { ascending: false });

      setMyDeals((dealsData || []) as Deal[]);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMyRankPosition = (): number | null => {
    if (!profile) return null;
    const idx = ranking.findIndex(r => r.profile_id === profile.id);
    return idx >= 0 ? idx + 1 : null;
  };

  return {
    ranking,
    myStats,
    myDeals,
    loading,
    refetch: fetchData,
    getMyRankPosition,
  };
}
