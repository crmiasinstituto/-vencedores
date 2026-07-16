import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/maisvencedores/components/shared/StatCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, TrendingUp, Loader2, Download, Calendar } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  buyer_name: string | null;
  amount: number;
  deal_date: string;
  status: string;
  created_at: string;
  seller_profile: {
    company_name: string;
    owner_name: string;
  } | null;
}

export default function AdminDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalDeals: 0,
    avgDealValue: 0,
    thisMonthRevenue: 0
  });

  useEffect(() => {
    fetchDeals();
  }, [startDate, endDate]);

  const fetchDeals = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('business_deals')
        .select(`
          *,
          seller_profile:profiles!seller_profile_id(company_name, owner_name)
        `)
        .order('deal_date', { ascending: false });

      if (startDate) {
        query = query.gte('deal_date', startDate);
      }
      if (endDate) {
        query = query.lte('deal_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      const dealsData = data || [];
      setDeals(dealsData);

      // Calculate stats
      const totalRevenue = dealsData.reduce((sum, deal) => sum + Number(deal.amount), 0);
      const totalDeals = dealsData.length;
      const avgDealValue = totalDeals > 0 ? totalRevenue / totalDeals : 0;

      // This month revenue
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthDeals = dealsData.filter(
        (deal) => new Date(deal.deal_date) >= firstDayOfMonth
      );
      const thisMonthRevenue = thisMonthDeals.reduce(
        (sum, deal) => sum + Number(deal.amount),
        0
      );

      setStats({
        totalRevenue,
        totalDeals,
        avgDealValue,
        thisMonthRevenue
      });
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const exportCSV = () => {
    const headers = ['Data', 'Vendedor', 'Título', 'Cliente', 'Valor', 'Status'];
    const rows = deals.map((deal) => [
      new Date(deal.deal_date).toLocaleDateString('pt-BR'),
      deal.seller_profile?.company_name || 'N/A',
      deal.title,
      deal.buyer_name || 'N/A',
      deal.amount.toString(),
      deal.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatório de Vendas</h1>
          <p className="text-muted-foreground">Acompanhe o faturamento gerado pelo + que Vencedores</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Faturamento Total"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
        />
        <StatCard
          title="Negócios Fechados"
          value={stats.totalDeals}
          icon={TrendingUp}
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(stats.avgDealValue)}
          icon={DollarSign}
        />
        <StatCard
          title="Este Mês"
          value={formatCurrency(stats.thisMonthRevenue)}
          icon={Calendar}
        />
      </div>

      {/* Filters */}
      <Card className="bg-card/50 border-gold/20">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deals Table */}
      <Card className="bg-card/50 border-gold/20">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum negócio registrado no período selecionado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      {new Date(deal.deal_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {deal.seller_profile?.company_name || 'N/A'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {deal.seller_profile?.owner_name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{deal.title}</p>
                        {deal.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {deal.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{deal.buyer_name || '-'}</TableCell>
                    <TableCell className="text-right font-semibold text-gold">
                      {formatCurrency(Number(deal.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          deal.status === 'completed'
                            ? 'text-green-500 border-green-500'
                            : 'text-yellow-500 border-yellow-500'
                        }
                      >
                        {deal.status === 'completed' ? 'Concluído' : deal.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
