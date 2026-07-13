import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, DollarSign, TrendingUp, Maximize2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { SalesHistory } from '@/components/sales/SalesHistory';
import { ManualControls } from '@/components/sales/ManualControls';
import { playSalesBell, playSalesF1 } from '@/lib/sales-sounds';
import { showSaleToast } from '@/lib/sale-toast';

interface Sale {
  id: string;
  name: string;
  email?: string;
  whatsapp: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  product_name: string;
  amount: number;
  payment_method?: string;
  created_at: string;
}

type PeriodFilter = 'hoje' | 'semana' | 'quinzena' | 'mes' | 'todos';
type PaymentFilter = 'todos' | 'pago' | 'free';

function getDateStart(period: PeriodFilter): Date | null {
  if (period === 'todos') return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (period === 'hoje') return now;
  if (period === 'semana') { now.setDate(now.getDate() - 7); return now; }
  if (period === 'quinzena') { now.setDate(now.getDate() - 15); return now; }
  now.setDate(now.getDate() - 30);
  return now;
}

export default function SalesDashboard() {
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [autoPlay, setAutoPlay] = useState(true);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('todos');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');


  // Filter sales
  const filteredSales = useMemo(() => {
    let result = allSales;

    // Period filter
    const dateStart = getDateStart(periodFilter);
    if (dateStart) {
      result = result.filter(s => new Date(s.created_at) >= dateStart);
    }

    // Payment filter
    if (paymentFilter === 'pago') {
      result = result.filter(s => s.payment_method && s.payment_method !== 'free');
    } else if (paymentFilter === 'free') {
      result = result.filter(s => s.payment_method === 'free' || !s.payment_method);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.whatsapp.includes(q) ||
        (s.instagram && s.instagram.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allSales, periodFilter, paymentFilter, searchQuery]);

  const totalSales = filteredSales.length;
  const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);

  const playBell = useCallback(() => { playSalesBell({ volume }); }, [volume]);
  const playF1 = useCallback(() => { playSalesF1({ volume }); }, [volume]);

  // Fetch ALL sales (not just today)
  const fetchAllSales = async () => {
    const { data, error } = await supabase
      .from('sales_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { console.error('Erro ao buscar vendas:', error); return; }
    setAllSales(data || []);
  };

  useEffect(() => { fetchAllSales(); }, []);

  const handleSaleDeleted = (id: string) => {
    setAllSales(prev => prev.filter(sale => sale.id !== id));
  };

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('sales_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales_events' }, (payload) => {
        const newSale = payload.new as Sale;
        setAllSales(prev => [newSale, ...prev]);
        if (autoPlay) {
          showSaleToast(newSale, { volume });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [autoPlay, volume]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const periodLabels: Record<PeriodFilter, string> = {
    hoje: 'Hoje', semana: 'Semana', quinzena: 'Quinzena', mes: 'Mês', todos: 'Todos'
  };

  return (
    <div className={`space-y-6 ${isFullscreen ? 'p-8' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-primary">🏆 Vendas em Tempo Real</h1>
        <Button variant="outline" onClick={toggleFullscreen}>
          <Maximize2 className="w-4 h-4 mr-2" />
          {isFullscreen ? 'Sair Fullscreen' : 'Fullscreen'}
        </Button>
      </div>

      {/* Period Filter */}
      <Tabs value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
        <TabsList className="w-full grid grid-cols-5">
          {(Object.keys(periodLabels) as PeriodFilter[]).map(key => (
            <TabsTrigger key={key} value={key}>{periodLabels[key]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Payment Filter + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {(['todos', 'pago', 'free'] as PaymentFilter[]).map(f => (
            <Badge
              key={f}
              variant={paymentFilter === f ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1.5 text-sm"
              onClick={() => setPaymentFilter(f)}
            >
              {f === 'todos' ? '📊 Todos' : f === 'pago' ? '💳 Pago' : '🆓 Free'}
            </Badge>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou WhatsApp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow/20 to-yellow/5 border-yellow/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas</CardTitle>
            <ShoppingCart className="w-4 h-4 text-yellow" />
          </CardHeader>
          <CardContent><div className="text-4xl font-bold text-yellow">{totalSales}</div></CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendido</CardTitle>
            <DollarSign className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-500">R$ {totalAmount.toFixed(2).replace('.', ',')}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-500">
              R$ {totalSales > 0 ? (totalAmount / totalSales).toFixed(2).replace('.', ',') : '0,00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Controls */}
      <ManualControls 
        onPlayBell={playBell} onPlayF1={playF1}
        volume={volume} onVolumeChange={setVolume}
        autoPlay={autoPlay} onAutoPlayChange={setAutoPlay}
      />

      {/* Sales History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vendas ({periodLabels[periodFilter]})</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesHistory sales={filteredSales} onSaleUpdated={fetchAllSales} onSaleDeleted={handleSaleDeleted} />
        </CardContent>
      </Card>

      {/* Endpoint Info */}
      <div className="mt-6 p-4 bg-card/50 rounded-lg border border-border">
        <h3 className="font-semibold mb-2 text-foreground">📡 Endpoint para iAutomatize:</h3>
        <code className="block p-3 bg-carbon rounded text-yellow text-sm break-all">
          POST https://iymlwsawrmghhbawiavz.supabase.co/functions/v1/receive-sale-webhook
        </code>
      </div>
    </div>
  );
}
