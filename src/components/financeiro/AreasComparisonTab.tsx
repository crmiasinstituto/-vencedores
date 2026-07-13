import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Trash2, PieChart as PieChartIcon, DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FinanceiroCard } from './FinanceiroCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Area {
  name: string;
  employee_count: number;
  salary: number;
}

interface AreasComparisonTabProps {
  data: {
    areas_comparison: Area[];
    employee_tax_rate: number;
    agent_monthly_cost: number;
  };
  onUpdate: (field: string, value: any) => void;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export function AreasComparisonTab({ data, onUpdate }: AreasComparisonTabProps) {
  const [newAreaName, setNewAreaName] = useState('');

  const calculations = useMemo(() => {
    const areasWithCosts = data.areas_comparison.map((area, index) => {
      const employeeMonthlyCost = area.employee_count * area.salary * (1 + data.employee_tax_rate);
      const agentMonthlyCost = data.agent_monthly_cost;
      const monthlySavings = employeeMonthlyCost - agentMonthlyCost;
      const annualSavings = monthlySavings * 12;

      return {
        ...area,
        employeeMonthlyCost,
        employeeAnnualCost: employeeMonthlyCost * 12,
        agentMonthlyCost,
        agentAnnualCost: agentMonthlyCost * 12,
        monthlySavings,
        annualSavings,
        color: COLORS[index % COLORS.length]
      };
    });

    const totals = areasWithCosts.reduce((acc, area) => ({
      totalEmployees: acc.totalEmployees + area.employee_count,
      totalEmployeeMonthlyCost: acc.totalEmployeeMonthlyCost + area.employeeMonthlyCost,
      totalAgentMonthlyCost: acc.totalAgentMonthlyCost + area.agentMonthlyCost,
      totalMonthlySavings: acc.totalMonthlySavings + area.monthlySavings,
      totalAnnualSavings: acc.totalAnnualSavings + area.annualSavings
    }), {
      totalEmployees: 0,
      totalEmployeeMonthlyCost: 0,
      totalAgentMonthlyCost: 0,
      totalMonthlySavings: 0,
      totalAnnualSavings: 0
    });

    const roi = ((totals.totalMonthlySavings) / totals.totalAgentMonthlyCost) * 100;

    const pieData = areasWithCosts.map(area => ({
      name: area.name,
      value: area.annualSavings,
      color: area.color
    }));

    return {
      areasWithCosts,
      ...totals,
      roi,
      pieData
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

  const handleAddArea = () => {
    if (!newAreaName.trim()) return;
    const newAreas = [...data.areas_comparison, { name: newAreaName, employee_count: 1, salary: 2500 }];
    onUpdate('areas_comparison', newAreas);
    setNewAreaName('');
  };

  const handleRemoveArea = (index: number) => {
    const newAreas = data.areas_comparison.filter((_, i) => i !== index);
    onUpdate('areas_comparison', newAreas);
  };

  const handleUpdateArea = (index: number, field: keyof Area, value: string | number) => {
    const newAreas = [...data.areas_comparison];
    newAreas[index] = { ...newAreas[index], [field]: value };
    onUpdate('areas_comparison', newAreas);
  };

  return (
    <div className="space-y-6">
      {/* Result Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinanceiroCard
          title="Total Funcionários"
          value={calculations.totalEmployees}
          prefix=""
          icon={Building2}
          trend="neutral"
        />
        <FinanceiroCard
          title="Custo Total Mensal"
          value={calculations.totalEmployeeMonthlyCost}
          icon={DollarSign}
          trend="down"
          description="Com funcionários tradicionais"
        />
        <FinanceiroCard
          title="Economia Mensal Total"
          value={calculations.totalMonthlySavings}
          icon={TrendingUp}
          trend="up"
        />
        <FinanceiroCard
          title="Economia Anual Total"
          value={calculations.totalAnnualSavings}
          icon={TrendingUp}
          trend="up"
        />
      </div>

      {/* Editable Areas Table */}
      <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5 text-primary" />
              Áreas da Empresa
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome da nova área"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-48 bg-white/5 border-white/10"
                onKeyDown={(e) => e.key === 'Enter' && handleAddArea()}
              />
              <Button onClick={handleAddArea} size="sm" className="gap-1">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-muted-foreground">Área</TableHead>
                <TableHead className="text-muted-foreground text-center">Funcionários</TableHead>
                <TableHead className="text-muted-foreground text-center">Salário</TableHead>
                <TableHead className="text-muted-foreground text-right">Custo Mensal</TableHead>
                <TableHead className="text-muted-foreground text-right">Custo Anual</TableHead>
                <TableHead className="text-muted-foreground text-right">Economia Mensal</TableHead>
                <TableHead className="text-muted-foreground text-right">Economia Anual</TableHead>
                <TableHead className="text-muted-foreground w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.areasWithCosts.map((area, index) => (
                <TableRow key={index} className="border-white/5 hover:bg-white/5">
                  <TableCell>
                    <Input
                      value={area.name}
                      onChange={(e) => handleUpdateArea(index, 'name', e.target.value)}
                      className="bg-transparent border-none p-0 h-auto font-medium"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={area.employee_count}
                      onChange={(e) => handleUpdateArea(index, 'employee_count', Number(e.target.value))}
                      className="bg-white/5 border-white/10 w-20 text-center mx-auto"
                      min={1}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={area.salary}
                      onChange={(e) => handleUpdateArea(index, 'salary', Number(e.target.value))}
                      className="bg-white/5 border-white/10 w-28 text-center mx-auto"
                      min={1000}
                      step={100}
                    />
                  </TableCell>
                  <TableCell className="text-right text-red-400">{formatCurrency(area.employeeMonthlyCost)}</TableCell>
                  <TableCell className="text-right text-red-400">{formatCurrency(area.employeeAnnualCost)}</TableCell>
                  <TableCell className="text-right text-green-400 font-medium">{formatCurrency(area.monthlySavings)}</TableCell>
                  <TableCell className="text-right text-green-400 font-bold">{formatCurrency(area.annualSavings)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveArea(index)}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="border-white/10 bg-white/5 font-bold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-center">{calculations.totalEmployees}</TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-right text-red-400">{formatCurrency(calculations.totalEmployeeMonthlyCost)}</TableCell>
                <TableCell className="text-right text-red-400">{formatCurrency(calculations.totalEmployeeMonthlyCost * 12)}</TableCell>
                <TableCell className="text-right text-green-400">{formatCurrency(calculations.totalMonthlySavings)}</TableCell>
                <TableCell className="text-right text-green-400">{formatCurrency(calculations.totalAnnualSavings)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="w-5 h-5 text-primary" />
              Distribuição da Economia por Área
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={calculations.pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {calculations.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
              Economia Anual por Área
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calculations.areasWithCosts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.5)" width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="annualSavings" name="Economia Anual" radius={[0, 4, 4, 0]}>
                    {calculations.areasWithCosts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROI Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 border border-green-500/20 p-8 text-center"
      >
        <h3 className="text-2xl font-bold text-white mb-2">
          ROI Total: <span className="text-green-400">{calculations.roi.toFixed(0)}%</span>
        </h3>
        <p className="text-muted-foreground">
          Retorno sobre investimento ao substituir funcionários tradicionais por Agentes de IA
        </p>
      </motion.div>
    </div>
  );
}
