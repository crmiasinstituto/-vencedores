import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Check, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { FAIXA_INFO, type Faixa } from '@/maisvencedores/types/member';

interface EligibleMember {
  profile_id: string;
  total_sales: number;
  contribution_amount: number;
  profile: {
    owner_name: string;
    company_name: string;
    photo_url: string | null;
    faixa: Faixa;
  };
  hasPresentation: boolean;
}

export function SpotlightManager() {
  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEligibleMembers();
  }, []);

  const fetchEligibleMembers = async () => {
    try {
      setLoading(true);

      // Fetch eligible members from sales_ranking
      const { data: rankingData } = await supabase
        .from('sales_ranking')
        .select('profile_id, total_sales, contribution_amount')
        .eq('eligible_for_spotlight', true)
        .order('contribution_amount', { ascending: false });

      if (!rankingData || rankingData.length === 0) {
        setEligibleMembers([]);
        return;
      }

      // Fetch profiles
      const profileIds = rankingData.map(r => r.profile_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, owner_name, company_name, photo_url, faixa')
        .in('id', profileIds);

      // Fetch presentations this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: presentations } = await supabase
        .from('spotlight_presentations')
        .select('profile_id')
        .gte('event_date', startOfMonth.toISOString().split('T')[0]);

      const presentationProfileIds = new Set(presentations?.map(p => p.profile_id) || []);

      // Combine data
      const members = rankingData.map(r => {
        const profile = profiles?.find(p => p.id === r.profile_id);
        return {
          ...r,
          profile: profile || {
            owner_name: 'Membro',
            company_name: '',
            photo_url: null,
            faixa: 'branco' as Faixa,
          },
          hasPresentation: presentationProfileIds.has(r.profile_id),
        };
      });

      setEligibleMembers(members);
    } catch (error) {
      console.error('Error fetching eligible members:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsPresented = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('spotlight_presentations')
        .insert({
          profile_id: profileId,
          event_date: new Date().toISOString().split('T')[0],
          presentation_type: 'weekly',
        });

      if (error) throw error;

      toast.success('Apresentação registrada com sucesso!');
      fetchEligibleMembers();
    } catch (error) {
      console.error('Error marking presentation:', error);
      toast.error('Erro ao registrar apresentação');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-gold" />
          <h3 className="font-display text-lg font-semibold">Elegíveis para Inserção</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {eligibleMembers.filter(m => !m.hasPresentation).length} disponíveis
        </span>
      </div>

      {eligibleMembers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum membro elegível para inserção no momento.</p>
          <p className="text-sm">Membros precisam superar a meta de investimento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eligibleMembers.map((member) => {
            const faixaInfo = FAIXA_INFO[member.profile.faixa];
            
            return (
              <div
                key={member.profile_id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  member.hasPresentation ? 'bg-muted/50 opacity-60' : 'bg-background/50'
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.profile.photo_url || undefined} />
                  <AvatarFallback className={faixaInfo.fundo}>
                    <span className={faixaInfo.texto}>
                      {member.profile.owner_name.charAt(0)}
                    </span>
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.profile.owner_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.profile.company_name}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <p className="font-semibold text-green-500">
                    {formatCurrency(Number(member.total_sales))}
                  </p>
                  <p className="text-xs text-gold">
                    5%: {formatCurrency(Number(member.contribution_amount))}
                  </p>
                </div>

                {member.hasPresentation ? (
                  <div className="flex items-center gap-1 text-green-500 text-sm">
                    <Check className="w-4 h-4" />
                    <span>Apresentou</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsPresented(member.profile_id)}
                    className="gap-1"
                  >
                    <Calendar className="w-4 h-4" />
                    Marcar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
