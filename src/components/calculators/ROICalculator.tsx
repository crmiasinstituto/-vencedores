import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, DollarSign, Users, Clock, Zap, ArrowRight, MessageCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface ROICalculatorProps {
  onLeadCapture?: (data: any) => void;
}

export const ROICalculator: React.FC<ROICalculatorProps> = ({ onLeadCapture }) => {
  const [employees, setEmployees] = useState(5);
  const [avgSalary, setAvgSalary] = useState(5000);
  const [workHours, setWorkHours] = useState(160);
  const [aiCapacity, setAiCapacity] = useState([2]);
  const [showResults, setShowResults] = useState(false);

  const calculations = useMemo(() => {
    const taxRate = 0.48; // 48% impostos
    const aiAgentCost = 500; // Custo por agente IA
    const hoursPerMonth = 160; // Horas padrão por mês

    // Custos funcionários
    const monthlySalaryWithTaxes = avgSalary * (1 + taxRate);
    const totalEmployeeCost = employees * monthlySalaryWithTaxes;
    const annualEmployeeCost = totalEmployeeCost * 12;
    const costPerHour = monthlySalaryWithTaxes / workHours;

    // Custos agentes IA
    const aiAgentsNeeded = Math.ceil(employees / aiCapacity[0]);
    const monthlyAiCost = aiAgentsNeeded * aiAgentCost;
    const annualAiCost = monthlyAiCost * 12;

    // Economia
    const monthlySavings = totalEmployeeCost - monthlyAiCost;
    const annualSavings = annualEmployeeCost - annualAiCost;
    const roi = ((annualSavings / annualAiCost) * 100);
    const paybackMonths = annualAiCost / monthlySavings;

    return {
      employees: {
        monthly: totalEmployeeCost,
        annual: annualEmployeeCost,
        costPerHour
      },
      ai: {
        agents: aiAgentsNeeded,
        monthly: monthlyAiCost,
        annual: annualAiCost,
        capacity: aiCapacity[0]
      },
      savings: {
        monthly: monthlySavings,
        annual: annualSavings,
        roi: roi,
        payback: paybackMonths
      }
    };
  }, [employees, avgSalary, workHours, aiCapacity]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map(month => ({
      month: `Mês ${month}`,
      funcionarios: calculations.employees.monthly * month,
      agentesIA: calculations.ai.monthly * month,
      economia: calculations.savings.monthly * month
    }));
  }, [calculations]);

  const comparisonData = [
    {
      metric: "Custo Mensal",
      funcionarios: calculations.employees.monthly,
      agentesIA: calculations.ai.monthly,
      economia: calculations.savings.monthly
    },
    {
      metric: "Custo Anual",
      funcionarios: calculations.employees.annual,
      agentesIA: calculations.ai.annual,
      economia: calculations.savings.annual
    }
  ];

  const handleCalculate = () => {
    setShowResults(true);
  };

  const handleLeadCapture = () => {
    const message = `🤖 *Calculadora ROI - IA Militia*

📊 *Seus Resultados:*
👥 Funcionários: ${employees}
💰 Economia Anual: R$ ${calculations.savings.annual.toLocaleString('pt-BR')}
📈 ROI: ${calculations.savings.roi.toFixed(1)}%
⏱️ Payback: ${calculations.savings.payback.toFixed(1)} meses

🚀 Quero uma apresentação personalizada!`;

    const whatsappUrl = `https://wa.me/5575998261542?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Inputs Section */}
      <Card className="glass-container border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Calculator className="w-6 h-6 text-primary" />
            Configurações do seu Negócio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quantidade de Funcionários</Label>
              <Input
                type="number"
                value={employees}
                onChange={(e) => setEmployees(Number(e.target.value))}
                min="1"
                max="100"
                className="text-lg"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Salário Médio Mensal (R$)</Label>
              <Input
                type="number"
                value={avgSalary}
                onChange={(e) => setAvgSalary(Number(e.target.value))}
                min="1000"
                max="50000"
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Horas Trabalhadas/Mês</Label>
              <Input
                type="number"
                value={workHours}
                onChange={(e) => setWorkHours(Number(e.target.value))}
                min="80"
                max="220"
                className="text-lg"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Capacidade do Agente IA: {aiCapacity[0]}x funcionário
              </Label>
              <Slider
                value={aiCapacity}
                onValueChange={setAiCapacity}
                max={5}
                min={1}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1x</span>
                <span>2.5x</span>
                <span>5x</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button onClick={handleCalculate} className="btn-cta pulse-glow text-lg px-8 py-3">
              <Calculator className="w-5 h-5 mr-2" />
              Calcular ROI
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {showResults && (
        <div className="space-y-6 animate-fade-in">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="glass-container border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 text-center">
                <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-500">
                  R$ {calculations.savings.annual.toLocaleString('pt-BR')}
                </div>
                <div className="text-sm text-muted-foreground">Economia Anual</div>
              </CardContent>
            </Card>

            <Card className="glass-container border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-500">
                  {calculations.savings.roi.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">ROI</div>
              </CardContent>
            </Card>

            <Card className="glass-container border-purple-500/30 bg-purple-500/5">
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-500">
                  {calculations.savings.payback.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Meses Payback</div>
              </CardContent>
            </Card>

            <Card className="glass-container border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-4 text-center">
                <Zap className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-500">
                  {calculations.ai.agents}
                </div>
                <div className="text-sm text-muted-foreground">Agentes IA</div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Chart */}
          <Card className="glass-container">
            <CardHeader>
              <CardTitle className="text-xl">Economia Acumulada (12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="funcionarios" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Funcionários"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="agentesIA" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Agentes IA"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="economia" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      name="Economia"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card className="glass-container">
            <CardHeader>
              <CardTitle className="text-xl">Comparação Detalhada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Métrica</th>
                      <th className="text-right py-2">Funcionários</th>
                      <th className="text-right py-2">Agentes IA</th>
                      <th className="text-right py-2 text-green-500">Economia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 font-medium">{row.metric}</td>
                        <td className="text-right py-3 text-red-500">
                          R$ {row.funcionarios.toLocaleString('pt-BR')}
                        </td>
                        <td className="text-right py-3 text-blue-500">
                          R$ {row.agentesIA.toLocaleString('pt-BR')}
                        </td>
                        <td className="text-right py-3 text-green-500 font-bold">
                          R$ {row.economia.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          {calculations.savings.roi > 100 && (
            <Card className="glass-container border-primary/50 bg-primary/5">
              <CardContent className="text-center p-8">
                <div className="mb-4">
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-lg px-4 py-2">
                    🎉 ROI Excelente: {calculations.savings.roi.toFixed(1)}%
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  Você pode economizar R$ {calculations.savings.annual.toLocaleString('pt-BR')} por ano!
                </h3>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Com um ROI de {calculations.savings.roi.toFixed(1)}% e payback em apenas {calculations.savings.payback.toFixed(1)} meses, 
                  nossa solução se paga rapidamente e gera economia significativa.
                </p>
                <Button onClick={handleLeadCapture} className="btn-cta pulse-glow text-lg px-8 py-3">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Quero uma Apresentação Personalizada
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};