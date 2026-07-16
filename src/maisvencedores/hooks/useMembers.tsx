import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Faixa } from '@/maisvencedores/types/member';

export interface Member {
  id: string;
  userId: string;
  nomeCompleto: string;
  profissao: string | null;
  telefone: string | null;
  companyName: string;
  segment: string | null;
  description: string | null;
  logoUrl: string | null;
  photoUrl: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null;
  linkedin: string | null;
  services: string[];
  faixa: Faixa;
  isNewMember: boolean;
  createdAt: Date;
}

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: Member[] = (data || []).map((p) => ({
        id: p.id,
        userId: p.user_id,
        nomeCompleto: p.nome_completo || p.owner_name || '',
        profissao: p.profissao,
        telefone: p.telefone || p.whatsapp,
        companyName: p.company_name,
        segment: p.segment,
        description: p.description,
        logoUrl: p.logo_url,
        photoUrl: p.photo_url,
        website: p.website,
        instagram: p.instagram,
        email: p.email,
        linkedin: p.linkedin,
        services: p.services || [],
        faixa: p.faixa,
        isNewMember: p.is_new_member || false,
        createdAt: new Date(p.created_at || ''),
      }));

      setMembers(mapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  return { members, loading, error, refetch: fetchMembers };
}
