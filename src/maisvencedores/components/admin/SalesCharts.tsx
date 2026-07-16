import { Faixa, FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface MonthlyData {
  month: string;
  revenue: number;
  deals: number;
}

interface PlanDistribution {
  name: string;
  value: number;
  color: string;
}

interface TopSeller {
  name: string;
  revenue: number;
}

interface MemberGrowth {
  month: string;
  members: number;
}

// A cor de cada faixa no gráfico. É a cor real da faixa, não a paleta da marca: num gráfico
// de distribuição por faixa, quem lê procura a cor que já conhece do tatame.
// A branca vira cinza-claro e a preta vira quase-preto — puro #fff e #000 somem no fundo.
const COR_DA_FAIXA: Record<Faixa, string> = {
  branco: '#E4E4E7',
  vermelho: '#EF4444',
  verde: '#10B981',
  roxo: '#8B5CF6',
  marrom: '#92400E',
  preta: '#18181B',
};

export function SalesCharts() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [memberGrowth, setMemberGrowth] = useState<MemberGrowth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      setLoading(true);

      // Fetch all deals
      const { data: deals } = await supabase
        .from('business_deals')
        .select('amount, deal_date, seller_profile_id')
        .order('deal_date', { ascending: true });

      // Perfis, pra distribuição por faixa e pros vendedores
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, owner_name, faixa, created_at')
        .eq('is_approved', true);

      // Fetch sales ranking for top sellers
      const { data: salesRanking } = await supabase
        .from('sales_ranking')
        .select('profile_id, total_sales')
        .order('total_sales', { ascending: false })
        .limit(5);

      if (deals) {
        // Process monthly data
        const monthlyMap = new Map<string, { revenue: number; deals: number }>();
        
        deals.forEach(deal => {
          const date = new Date(deal.deal_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const existing = monthlyMap.get(monthKey) || { revenue: 0, deals: 0 };
          monthlyMap.set(monthKey, {
            revenue: existing.revenue + Number(deal.amount),
            deals: existing.deals + 1,
          });
        });

        const months = Array.from(monthlyMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-6)
          .map(([month, data]) => ({
            month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
            revenue: data.revenue,
            deals: data.deals,
          }));

        setMonthlyData(months);
      }

      if (profiles) {
        // Distribuição por faixa
        const contagemPorFaixa = profiles.reduce((acc, p) => {
          acc[p.faixa] = (acc[p.faixa] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Percorre FAIXAS, não uma lista escrita à mão: assim a ordem do gráfico é a ordem da
        // progressão, e uma faixa nova aparece aqui sozinha.
        setPlanDistribution(
          FAIXAS.map((f) => ({
            name: `Faixa ${FAIXA_INFO[f].nome}`,
            value: contagemPorFaixa[f] || 0,
            color: COR_DA_FAIXA[f],
          })),
        );

        // Member growth
        const growthMap = new Map<string, number>();
        let cumulative = 0;
        
        profiles
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .forEach(p => {
            const date = new Date(p.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            cumulative++;
            growthMap.set(monthKey, cumulative);
          });

        const growth = Array.from(growthMap.entries())
          .slice(-6)
          .map(([month, members]) => ({
            month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
            members,
          }));

        setMemberGrowth(growth);
      }

      if (salesRanking && profiles) {
        // Top sellers
        const sellers = salesRanking.map(sr => {
          const profile = profiles.find(p => p.id === sr.profile_id);
          return {
            name: profile?.owner_name?.split(' ')[0] || 'Membro',
            revenue: Number(sr.total_sales),
          };
        });

        setTopSellers(sellers);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card border border-border rounded-xl p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Monthly Revenue */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Faturamento Mensal</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatCurrency} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Receita']}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Distribuição por faixa */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Distribuição por Faixa</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={planDistribution}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {planDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top Sellers */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Top 5 Vendedores</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={topSellers} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={formatCurrency} />
            <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={60} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Vendas']}
            />
            <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Member Growth */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Crescimento de Membros</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={memberGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="members"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.2)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
