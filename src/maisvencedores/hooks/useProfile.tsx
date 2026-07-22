import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Faixa, faixaAlcanca } from '@/maisvencedores/types/member';

export interface Profile {
  id: string;
  user_id: string;
  nome_completo: string | null;
  telefone: string | null;
  profissao: string | null;
  photo_url: string | null;
  description: string | null;
  email: string | null;
  instagram: string | null;
  cidade: string | null;
  faixa: Faixa;
  /** Campos de empresa: opcionais, o onboarding não pergunta. Só o portfólio lê. */
  company_name: string;
  owner_name: string;
  title: string | null;
  segment: string | null;
  logo_url: string | null;
  website: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  services: string[];
  years_in_business: number;
  employee_count: string | null;
  is_new_member: boolean;
  onboarding_completed: boolean;
  is_approved: boolean;
  approved_at: string | null;
  referral_code: string;
  referred_by: string | null;
  investment_amount: number;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data as Profile | null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !profile) return { error: new Error('No user or profile') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const alcanca = (faixaMinima: Faixa): boolean => {
    if (!profile) return false;
    return faixaAlcanca(profile.faixa, faixaMinima);
  };

  return { profile, loading, error, updateProfile, alcanca, refetch: fetchProfile };
}
