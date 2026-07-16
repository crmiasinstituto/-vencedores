import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

export interface NwPoints {
  seasonPoints: number;
  lifetimePoints: number;
  tierLabel: string | null;
}

// Busca pontos do membro (temporada + vitalício) e o nível de recompensa via RPCs nw_*.
export function useNwPoints() {
  const { profile } = useProfile();
  const [points, setPoints] = useState<NwPoints>({
    seasonPoints: 0,
    lifetimePoints: 0,
    tierLabel: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    fetchPoints(profile.id);
  }, [profile?.id]);

  const fetchPoints = async (profileId: string) => {
    setLoading(true);
    try {
      const [seasonRes, lifetimeRes] = await Promise.all([
        supabase.rpc('nw_season_points', { p_profile: profileId }),
        supabase.rpc('nw_lifetime_points', { p_profile: profileId }),
      ]);

      const seasonPoints = Number(seasonRes.data) || 0;
      const lifetimePoints = Number(lifetimeRes.data) || 0;

      let tierLabel: string | null = null;
      const tierRes = await supabase.rpc('nw_reward_tier', { p_points: seasonPoints });
      if (!tierRes.error && tierRes.data) {
        tierLabel = tierRes.data as unknown as string;
      }

      setPoints({ seasonPoints, lifetimePoints, tierLabel });
    } catch (err) {
      console.error('Erro ao buscar pontos:', err);
    } finally {
      setLoading(false);
    }
  };

  return { ...points, loading, refetch: () => profile && fetchPoints(profile.id) };
}
