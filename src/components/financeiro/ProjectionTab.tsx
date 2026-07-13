import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Calendar, Users, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FinanceiroCard } from './FinanceiroCard';
import { EditableInput } from './EditableInput';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Area } from 'recharts';

interface ProjectionTabProps {
  data: {
    new_clients_per_month: number;
    setup_value: number;
    optimization_value: number;
    projection_months: number;
  };
  onUpdate: (field: string, value: number) => void;
}

export function ProjectionTab({ data, onUpdate }: ProjectionTabProps) {
  const projections = useMemo(() => {
    const rows = [];
    let accumulated = 0;
    let totalSetup = 0;
    let totalOptimization = 0;
    let totalRecurrent = 0;

    for (let month = 1; month <= data.projection_months; month++) {
      const newClients = data.new_clients_per_month;
      const accumulatedClients = month * newClients;
      const setup = newClients * data.setup_value;
      const optimization = newClients * data.optimization_value;
      const recurrent = accumulatedClients * data.optimization_value;
      const monthlyRevenue = setup + optimization + recurrent;
      accumulated += monthlyRevenue;

      totalSetup += setup;
      totalOptimization += optimization;
      totalRecurrent += recurrent;

      rows.push({
        month,
        newClients,
        accumulatedClients,
        setup,
        optimization,
        recurrent,
        monthlyRevenue,
        accumulated
      });
    }

    return {
      rows,
      totalSetup,
      totalOptimization,
      totalRecurrent,
      totalRevenue: totalSetup + totalOptimization + totalRecurrent,
      finalMRR: rows[rows.length - 1]?.recurrent || 0
    };
  }, [data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-primary" />
            Configurações de Projeção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <EditableInput
              label="Novos clientes/mês"
              value={data.new_clients_per_month}
              onChange={(v) => onUpdate('new_clients_per_month', v)}
              type="slider"
              min={1}
              max={20}
            />
            <EditableInput
              label="Valor do Setup"
              value={data.setup_value}
              onChange={(v) => onUpdate('setup_value', v)}
              type="currency"
              prefix="R$"
              min={0}
              max={50000}
              step={100}
            />
            <EditableInput
              label="Valor da Otimização"
              value={data.optimization_value}
              onChange={(v) => onUpdate('optimization_value', v)}
              type="currency"
              prefix="R$"
              min={0}
              max={10000}
              step={100}
            />
            <EditableInput
              label="Meses de projeção"
              value={data.projection_months}
              onChange={(v) => onUpdate('projection_months', v)}
              type="slider"
              min={6}
              max={36}
              suffix=" meses"
            />
          </div>
        </CardContent>
      </Card>

      {/* Result Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinanceiroCard
          title="Total Setup"
          value={projections.totalSetup}
          icon={DollarSign}
          trend="up"
          description={`${data.projection_months} meses`}
        />
        <FinanceiroCard
          title="Total Recorrência"
          value={projections.totalRecurrent}
          icon={Repeat}
          trend="up"
        />
        <FinanceiroCard
          title="Faturamento Total"
          value={projections.totalRevenue}
          icon={TrendingUp}
          trend="up"
        />
        <FinanceiroCard
          title="MRR Final"
          value={projections.finalMRR}
          icon={Users}
          trend="up"
          description="Receita recorrente mensal"
        />
      </div>

      {/* Chart */}
      <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
            Projeção de Faturamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projections.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="month" 
                  stroke="rgba(255,255,255,0.5)"
                  tickFormatter={(v) => `M${v}`}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Mês ${label}`}
                />
                <Legend />
                <Bar 
                  dataKey="monthlyRevenue" 
                  name="Receita Mensal" 
                  fill="hsl(var(--primary))" 
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="accumulated" 
                  name="Acumulado" 
                  stroke="#22c55e" 
                  strokeWidth={3}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-primary" />
            Projeção Detalhada
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur">
                <TableRow className="border-white/10">
                  <TableHead className="text-muted-foreground">Mês</TableHead>
                  <TableHead className="text-muted-foreground">Novos</TableHead>
                  <TableHead className="text-muted-foreground">Acumulado</TableHead>
                  <TableHead className="text-muted-foreground text-right">Setup</TableHead>
                  <TableHead className="text-muted-foreground text-right">Otimização</TableHead>
                  <TableHead className="text-muted-foreground text-right">Recorrente</TableHead>
                  <TableHead className="text-muted-foreground text-right">Mensal</TableHead>
                  <TableHead className="text-muted-foreground text-right">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projections.rows.map((row) => (
                  <TableRow key={row.month} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell>{row.newClients}</TableCell>
                    <TableCell>{row.accumulatedClients}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.setup)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.optimization)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.recurrent)}</TableCell>
                    <TableCell className="text-right text-primary font-medium">{formatCurrency(row.monthlyRevenue)}</TableCell>
                    <TableCell className="text-right text-green-400 font-medium">{formatCurrency(row.accumulated)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
