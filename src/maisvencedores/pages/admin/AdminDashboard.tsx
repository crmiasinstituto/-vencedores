import { Faixa, FAIXA_INFO } from '@/maisvencedores/types/member';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/maisvencedores/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Calendar, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { SalesCharts } from '@/maisvencedores/components/admin/SalesCharts';
import { SpotlightManager } from '@/maisvencedores/components/admin/SpotlightManager';

interface PendingMember {
  id: string;
  company_name: string;
  owner_name: string;
  photo_url: string | null;
  segment: string | null;
  faixa: Faixa;
  created_at: string;
}

interface Stats {
  totalMembers: number;
  pendingMembers: number;
  totalEvents: number;
  totalDeals: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    pendingMembers: 0,
    totalEvents: 0,
    totalDeals: 0,
    totalRevenue: 0
  });
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch stats
      const [
        { count: totalMembers },
        { count: pendingCount },
        { count: totalEvents },
        { data: dealsData }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('business_deals').select('amount')
      ]);

      const totalRevenue = dealsData?.reduce((sum, deal) => sum + Number(deal.amount), 0) || 0;

      setStats({
        totalMembers: totalMembers || 0,
        pendingMembers: pendingCount || 0,
        totalEvents: totalEvents || 0,
        totalDeals: dealsData?.length || 0,
        totalRevenue
      });

      // Fetch pending members
      const { data: pending } = await supabase
        .from('profiles')
        .select('id, company_name, owner_name, photo_url, segment, faixa, created_at')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })
        .limit(5);

      setPendingMembers(pending || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true, approved_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) throw error;
      toast.success('Membro aprovado com sucesso!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao aprovar membro');
    }
  };

  const handleReject = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      toast.success('Membro rejeitado');
      fetchData();
    } catch (error) {
      toast.error('Erro ao rejeitar membro');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground">Visão geral da plataforma + que Vencedores</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Membros Ativos"
          value={stats.totalMembers}
          icon={Users}
        />
        <StatCard
          title="Pendentes de Aprovação"
          value={stats.pendingMembers}
          icon={Clock}
        />
        <StatCard
          title="Eventos Ativos"
          value={stats.totalEvents}
          icon={Calendar}
        />
        <StatCard
          title="Faturamento Total"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          description={`${stats.totalDeals} negócios registrados`}
        />
      </div>


      {/* Charts */}
      <SalesCharts />

      {/* Spotlight Manager */}
      <SpotlightManager />

      {/* Pending Members */}
      <Card className="bg-card/50 border-gold/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membros Pendentes de Aprovação</CardTitle>
          <Link to="/admin/maisvencedores/membros">
            <Button variant="outline" size="sm">Ver Todos</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pendingMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum membro pendente de aprovação
            </p>
          ) : (
            <div className="space-y-4">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={member.photo_url || undefined} />
                      <AvatarFallback>
                        {member.owner_name?.charAt(0) || 'M'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.company_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{member.owner_name}</p>
                    </div>
                    <Badge variant="outline">Faixa {FAIXA_INFO[member.faixa].nome}</Badge>
                    {member.segment && (
                      <Badge variant="secondary">{member.segment}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(member.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(member.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
