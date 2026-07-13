import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Bot, Clock, TrendingDown, Zap, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FinanceiroCard } from './FinanceiroCard';
import { EditableInput } from './EditableInput';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ComposedChart, Area } from 'recharts';

interface EmployeeComparisonTabProps {
  data: {
    employee_count: number;
    employee_salary: number;
    employee_tax_rate: number;
    agent_count: number;
    agent_monthly_cost: number;
    employee_hours_monthly: number;
    agent_hours_monthly: number;
  };
  onUpdate: (field: string, value: number) => void;
}

export function EmployeeComparisonTab({ data, onUpdate }: EmployeeComparisonTabProps) {
  const calculations = useMemo(() => {
    const employeeMonthlyCost = data.employee_count * data.employee_salary * (1 + data.employee_tax_rate);
    const agentMonthlyCost = data.agent_count * data.agent_monthly_cost;
    
    const employeeHourlyCost = employeeMonthlyCost / data.employee_hours_monthly;
    const agentHourlyCost = agentMonthlyCost / data.agent_hours_monthly;
    
    const monthlySavings = employeeMonthlyCost - agentMonthlyCost;
    const annualSavings = monthlySavings * 12;
    
    const savingsPercentage = ((employeeMonthlyCost - agentMonthlyCost) / employeeMonthlyCost) * 100;
    
    // Projeção mensal de economia
    const monthlyProjection = [];
    let accumulated = 0;
    for (let month = 1; month <= 12; month++) {
      accumulated += monthlySavings;
      monthlyProjection.push({
        month,
        employee: employeeMonthlyCost,
        agent: agentMonthlyCost,
        savings: monthlySavings,
        accumulated
      });
    }

    return {
      employeeMonthlyCost,
      agentMonthlyCost,
      employeeHourlyCost,
      agentHourlyCost,
      monthlySavings,
      annualSavings,
      savingsPercentage,
      monthlyProjection,
      employeeAnnualCost: employeeMonthlyCost * 12,
      agentAnnualCost: agentMonthlyCost * 12
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

  const comparisonData = [
    { name: 'Mensal', funcionario: calculations.employeeMonthlyCost, agente: calculations.agentMonthlyCost },
    { name: 'Anual', funcionario: calculations.employeeAnnualCost, agente: calculations.agentAnnualCost }
  ];

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Configurações de Comparação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EditableInput
              label="Quantidade de funcionários"
              value={data.employee_count}
              onChange={(v) => onUpdate('employee_count', v)}
              type="slider"
              min={1}
              max={20}
            />
            <EditableInput
              label="Salário médio"
              value={data.employee_salary}
              onChange={(v) => onUpdate('employee_salary', v)}
              prefix="R$"
              min={1500}
              max={15000}
              step={100}
            />
            <EditableInput
              label="Taxa de impostos"
              value={Math.round(data.employee_tax_rate * 100)}
              onChange={(v) => onUpdate('employee_tax_rate', v / 100)}
              suffix="%"
              min={0}
              max={100}
              step={1}
            />
            <EditableInput
              label="Quantidade de agentes"
              value={data.agent_count}
              onChange={(v) => onUpdate('agent_count', v)}
              type="slider"
              min={1}
              max={20}
            />
            <EditableInput
              label="Custo mensal por agente"
              value={data.agent_monthly_cost}
              onChange={(v) => onUpdate('agent_monthly_cost', v)}
              prefix="R$"
              min={500}
              max={10000}
              step={100}
            />
            <EditableInput
              label="Horas/mês funcionário"
              value={data.employee_hours_monthly}
              onChange={(v) => onUpdate('employee_hours_monthly', v)}
              suffix="h"
              min={100}
              max={400}
              step={10}
            />
            <EditableInput
              label="Horas/mês agente IA"
              value={data.agent_hours_monthly}
              onChange={(v) => onUpdate('agent_hours_monthly', v)}
              suffix="h"
              min={400}
              max={744}
              step={10}
            />
          </div>
        </CardContent>
      </Card>

      {/* Epic Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 border border-white/10 p-6"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
        <div className="relative flex items-center gap-4">
          <div className="p-4 rounded-xl bg-primary/20">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              Agente de IA não recebe 13º, não tira férias, não dorme e nem processa a empresa! 🤖
            </h3>
            <p className="text-muted-foreground">
              Economia de <span className="text-green-400 font-bold">{calculations.savingsPercentage.toFixed(0)}%</span> comparado a funcionários tradicionais
            </p>
          </div>
        </div>
      </motion.div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinanceiroCard
          title="Custo Funcionário/mês"
          value={calculations.employeeMonthlyCost}
          icon={Users}
          trend="down"
        />
        <FinanceiroCard
          title="Custo Agente IA/mês"
          value={calculations.agentMonthlyCost}
          icon={Bot}
          trend="up"
        />
        <FinanceiroCard
          title="Economia Mensal"
          value={calculations.monthlySavings}
          icon={TrendingDown}
          trend="up"
        />
        <FinanceiroCard
          title="Economia Anual"
          value={calculations.annualSavings}
          icon={DollarSign}
          trend="up"
        />
      </div>

      {/* Comparison Table */}
      <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg">Comparativo Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-muted-foreground">Métrica</TableHead>
                <TableHead className="text-muted-foreground text-right">Funcionário</TableHead>
                <TableHead className="text-muted-foreground text-right">Agente IA</TableHead>
                <TableHead className="text-muted-foreground text-right">Economia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-white/5">
                <TableCell className="font-medium">Custo Mensal</TableCell>
                <TableCell className="text-right text-red-400">{formatCurrency(calculations.employeeMonthlyCost)}</TableCell>
                <TableCell className="text-right text-primary">{formatCurrency(calculations.agentMonthlyCost)}</TableCell>
                <TableCell className="text-right text-green-400 font-bold">{formatCurrency(calculations.monthlySavings)}</TableCell>
              </TableRow>
              <TableRow className="border-white/5">
                <TableCell className="font-medium">Custo por Hora</TableCell>
                <TableCell className="text-right text-red-400">{formatCurrency(calculations.employeeHourlyCost)}</TableCell>
                <TableCell className="text-right text-primary">{formatCurrency(calculations.agentHourlyCost)}</TableCell>
                <TableCell className="text-right text-green-400 font-bold">{formatCurrency(calculations.employeeHourlyCost - calculations.agentHourlyCost)}</TableCell>
              </TableRow>
              <TableRow className="border-white/5">
                <TableCell className="font-medium">Custo Anual</TableCell>
                <TableCell className="text-right text-red-400">{formatCurrency(calculations.employeeAnnualCost)}</TableCell>
                <TableCell className="text-right text-primary">{formatCurrency(calculations.agentAnnualCost)}</TableCell>
                <TableCell className="text-right text-green-400 font-bold">{formatCurrency(calculations.annualSavings)}</TableCell>
              </TableRow>
              <TableRow className="border-white/5">
                <TableCell className="font-medium">Horas Disponíveis/mês</TableCell>
                <TableCell className="text-right text-muted-foreground">{data.employee_hours_monthly}h</TableCell>
                <TableCell className="text-right text-primary">{data.agent_hours_monthly}h</TableCell>
                <TableCell className="text-right text-green-400 font-bold">+{data.agent_hours_monthly - data.employee_hours_monthly}h</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Comparativo de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="funcionario" name="Funcionário" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="agente" name="Agente IA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Savings Projection Chart */}
        <Card className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Economia Acumulada (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={calculations.monthlyProjection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" tickFormatter={(v) => `M${v}`} />
                  <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
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
                  <Area 
                    type="monotone" 
                    dataKey="accumulated" 
                    name="Economia Acumulada" 
                    fill="rgba(34, 197, 94, 0.2)"
                    stroke="#22c55e" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="savings" 
                    name="Economia Mensal" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
