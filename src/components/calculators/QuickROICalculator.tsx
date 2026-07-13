import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, TrendingUp, Users, DollarSign, Zap } from 'lucide-react';

interface QuickROICalculatorProps {
  onLeadCapture?: (data: { 
    name: string; 
    company: string; 
    whatsapp: string; 
    savings: number; 
    roi: number; 
  }) => void;
}

const sectorPresets = {
  'tecnologia': { avgSalary: 8000, taxRate: 48 },
  'servicos': { avgSalary: 5000, taxRate: 48 },
  'comercio': { avgSalary: 3500, taxRate: 48 },
  'industria': { avgSalary: 4500, taxRate: 48 },
  'saude': { avgSalary: 6000, taxRate: 48 },
  'educacao': { avgSalary: 4000, taxRate: 48 },
};

export const QuickROICalculator: React.FC<QuickROICalculatorProps> = ({ onLeadCapture }) => {
  const [employees, setEmployees] = useState<number>(5);
  const [avgSalary, setAvgSalary] = useState<number>(5000);
  const [sector, setSector] = useState<string>('servicos');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [showLeadForm, setShowLeadForm] = useState<boolean>(false);

  // Lead form states
  const [name, setName] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');

  const calculations = useMemo(() => {
    const monthlyEmployeeCost = avgSalary * (1 + 0.48); // 48% taxes
    const totalMonthlyCost = monthlyEmployeeCost * employees;
    const annualEmployeeCost = totalMonthlyCost * 12;

    const aiAgentCost = 2500; // R$ 2,500 per AI agent monthly
    const agentsNeeded = Math.ceil(employees / 3); // 1 AI agent = 3 employees capacity
    const monthlyAICost = agentsNeeded * aiAgentCost;
    const annualAICost = monthlyAICost * 12;

    const annualSavings = annualEmployeeCost - annualAICost;
    const monthlySavings = annualSavings / 12;
    const roi = ((annualSavings / annualAICost) * 100);
    const paybackMonths = annualAICost / monthlySavings;

    return {
      annualEmployeeCost,
      annualAICost,
      annualSavings,
      monthlySavings,
      roi,
      paybackMonths,
      agentsNeeded
    };
  }, [employees, avgSalary]);

  const handleSectorChange = (newSector: string) => {
    setSector(newSector);
    if (sectorPresets[newSector as keyof typeof sectorPresets]) {
      setAvgSalary(sectorPresets[newSector as keyof typeof sectorPresets].avgSalary);
    }
  };

  const handleCalculate = () => {
    setShowResults(true);
    if (calculations.roi > 100) {
      setTimeout(() => setShowLeadForm(true), 2000);
    }
  };

  const handleLeadCapture = () => {
    if (onLeadCapture) {
      onLeadCapture({
        name,
        company,
        whatsapp,
        savings: calculations.annualSavings,
        roi: calculations.roi
      });
    }

    // Generate WhatsApp message
    const message = `🤖 *Resultado da Calculadora ROI - IA Militia*\n\n` +
      `👋 Olá! Sou ${name} da empresa ${company}.\n\n` +
      `📊 *Calculei minha economia com Agentes IA:*\n` +
      `💰 Economia anual: R$ ${calculations.annualSavings.toLocaleString('pt-BR')}\n` +
      `📈 ROI: ${calculations.roi.toFixed(0)}%\n` +
      `⚡ Agentes necessários: ${calculations.agentsNeeded}\n\n` +
      `🎯 Gostaria de receber uma análise detalhada e agendar uma apresentação personalizada!`;

    const whatsappUrl = `https://wa.me/5575998261542?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-container">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Slider
                value={[employees]}
                onValueChange={(value) => setEmployees(value[0])}
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">{employees}</span>
                <p className="text-xs text-muted-foreground">funcionários</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-container">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Salário Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Input
                type="number"
                value={avgSalary}
                onChange={(e) => setAvgSalary(Number(e.target.value))}
                className="text-center font-medium"
              />
              <div className="flex gap-1">
                {[3000, 5000, 8000].map((salary) => (
                  <Button
                    key={salary}
                    variant="outline"
                    size="sm"
                    onClick={() => setAvgSalary(salary)}
                    className="text-xs flex-1"
                  >
                    R$ {salary.toLocaleString('pt-BR')}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-container">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={sector} onValueChange={handleSectorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tecnologia">Tecnologia</SelectItem>
                <SelectItem value="servicos">Serviços</SelectItem>
                <SelectItem value="comercio">Comércio</SelectItem>
                <SelectItem value="industria">Indústria</SelectItem>
                <SelectItem value="saude">Saúde</SelectItem>
                <SelectItem value="educacao">Educação</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Calculate Button */}
      <div className="text-center">
        <Button 
          onClick={handleCalculate}
          size="lg"
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <Calculator className="w-5 h-5 mr-2" />
          Calcular Economia Agora
        </Button>
      </div>

      {/* Results Section */}
      {showResults && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-container border-green-500/20 bg-green-50/10">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">
                  R$ {calculations.annualSavings.toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground">Economia Anual</p>
              </CardContent>
            </Card>

            <Card className="glass-container border-blue-500/20 bg-blue-50/10">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {calculations.roi.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground">ROI</p>
              </CardContent>
            </Card>

            <Card className="glass-container border-purple-500/20 bg-purple-50/10">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {calculations.paybackMonths.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">Meses Payback</p>
              </CardContent>
            </Card>

            <Card className="glass-container border-orange-500/20 bg-orange-50/10">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {calculations.agentsNeeded}
                </div>
                <p className="text-xs text-muted-foreground">Agentes IA</p>
              </CardContent>
            </Card>
          </div>

          {calculations.roi > 100 && (
            <Card className="glass-container border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5">
              <CardContent className="p-6 text-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <span className="text-primary font-semibold">Excelente Potencial de Economia!</span>
                  </div>
                  <p className="text-muted-foreground">
                    Sua empresa pode economizar <strong>R$ {calculations.monthlySavings.toLocaleString('pt-BR')}/mês</strong> com nossa solução.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Lead Capture Form */}
      {showLeadForm && (
        <Card className="glass-container border-primary/30 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-center text-primary">
              🎯 Receba Análise Detalhada Gratuita
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <Button 
              onClick={handleLeadCapture}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              disabled={!name || !company || !whatsapp}
            >
              📱 Receber Análise via WhatsApp
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Sem compromisso • Resposta em até 2 horas • 100% gratuito
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};