import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  Building2, 
  LogOut, 
  Plus, 
  Copy, 
  Trash2,
  Save,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/integrations/supabase/client';
import { ProjectionTab } from '@/components/financeiro/ProjectionTab';
import { EmployeeComparisonTab } from '@/components/financeiro/EmployeeComparisonTab';
import { AreasComparisonTab } from '@/components/financeiro/AreasComparisonTab';

interface FinancialProjection {
  id: string;
  name: string;
  is_active: boolean;
  new_clients_per_month: number;
  setup_value: number;
  optimization_value: number;
  projection_months: number;
  employee_count: number;
  employee_salary: number;
  employee_tax_rate: number;
  agent_count: number;
  agent_monthly_cost: number;
  agent_capacity_factor: number;
  employee_hours_monthly: number;
  agent_hours_monthly: number;
  areas_comparison: Array<{ name: string; employee_count: number; salary: number }>;
}

const defaultProjection: Omit<FinancialProjection, 'id'> = {
  name: 'Novo Cenário',
  is_active: false,
  new_clients_per_month: 2,
  setup_value: 3000,
  optimization_value: 1600,
  projection_months: 18,
  employee_count: 2,
  employee_salary: 2500,
  employee_tax_rate: 0.48,
  agent_count: 1,
  agent_monthly_cost: 1899,
  agent_capacity_factor: 1,
  employee_hours_monthly: 264,
  agent_hours_monthly: 720,
  areas_comparison: [
    { name: 'Atendimento ao Cliente', employee_count: 2, salary: 2500 },
    { name: 'Vendas', employee_count: 3, salary: 3000 },
    { name: 'Suporte Técnico', employee_count: 2, salary: 3500 },
    { name: 'Marketing', employee_count: 1, salary: 4000 },
    { name: 'Financeiro', employee_count: 1, salary: 3500 }
  ]
};

export default function AdminFinanceiro() {
  const { user, loading, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [scenarios, setScenarios] = useState<FinancialProjection[]>([]);
  const [activeScenario, setActiveScenario] = useState<FinancialProjection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch scenarios
  useEffect(() => {
    if (!user) return;
    
    async function fetchScenarios() {
      const { data, error } = await supabase
        .from('financial_projections')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching scenarios:', error);
        toast({ title: 'Erro ao carregar cenários', variant: 'destructive' });
        return;
      }

      if (data && data.length > 0) {
        const typedData = data.map(d => ({
          ...d,
          areas_comparison: d.areas_comparison as Array<{ name: string; employee_count: number; salary: number }>
        }));
        setScenarios(typedData);
        const active = typedData.find(s => s.is_active) || typedData[0];
        setActiveScenario(active);
      }
    }

    fetchScenarios();
  }, [user, toast]);

  // Auto-save with debounce
  const saveScenario = useCallback(async (scenario: FinancialProjection) => {
    if (!scenario.id) return;
    
    setIsSaving(true);
    
    const { error } = await supabase
      .from('financial_projections')
      .update({
        name: scenario.name,
        new_clients_per_month: scenario.new_clients_per_month,
        setup_value: scenario.setup_value,
        optimization_value: scenario.optimization_value,
        projection_months: scenario.projection_months,
        employee_count: scenario.employee_count,
        employee_salary: scenario.employee_salary,
        employee_tax_rate: scenario.employee_tax_rate,
        agent_monthly_cost: scenario.agent_monthly_cost,
        agent_capacity_factor: scenario.agent_capacity_factor,
        employee_hours_monthly: scenario.employee_hours_monthly,
        agent_hours_monthly: scenario.agent_hours_monthly,
        areas_comparison: scenario.areas_comparison
      })
      .eq('id', scenario.id);

    setIsSaving(false);

    if (error) {
      console.error('Error saving:', error);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  }, [toast]);

  const handleUpdate = useCallback((field: string, value: any) => {
    if (!activeScenario) return;

    const updated = { ...activeScenario, [field]: value };
    setActiveScenario(updated);
    setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));

    // Debounce save
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(() => saveScenario(updated), 500);
    setSaveTimeout(timeout);
  }, [activeScenario, saveScenario, saveTimeout]);

  const handleCreateScenario = async () => {
    const { data, error } = await supabase
      .from('financial_projections')
      .insert([defaultProjection])
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar cenário', variant: 'destructive' });
      return;
    }

    if (data) {
      const typedData = {
        ...data,
        areas_comparison: data.areas_comparison as Array<{ name: string; employee_count: number; salary: number }>
      };
      setScenarios(prev => [...prev, typedData]);
      setActiveScenario(typedData);
      toast({ title: 'Cenário criado!' });
    }
  };

  const handleDuplicateScenario = async () => {
    if (!activeScenario) return;

    const { id, ...rest } = activeScenario;
    const duplicate = { ...rest, name: `${activeScenario.name} (cópia)`, is_active: false };

    const { data, error } = await supabase
      .from('financial_projections')
      .insert([duplicate])
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao duplicar cenário', variant: 'destructive' });
      return;
    }

    if (data) {
      const typedData = {
        ...data,
        areas_comparison: data.areas_comparison as Array<{ name: string; employee_count: number; salary: number }>
      };
      setScenarios(prev => [...prev, typedData]);
      setActiveScenario(typedData);
      toast({ title: 'Cenário duplicado!' });
    }
  };

  const handleDeleteScenario = async () => {
    if (!activeScenario || scenarios.length <= 1) {
      toast({ title: 'Não é possível excluir o único cenário', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('financial_projections')
      .delete()
      .eq('id', activeScenario.id);

    if (error) {
      toast({ title: 'Erro ao excluir cenário', variant: 'destructive' });
      return;
    }

    const remaining = scenarios.filter(s => s.id !== activeScenario.id);
    setScenarios(remaining);
    setActiveScenario(remaining[0]);
    toast({ title: 'Cenário excluído!' });
  };

  const handleSelectScenario = (scenario: FinancialProjection) => {
    setActiveScenario(scenario);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            📊 Projeções Financeiras
          </h1>
          
          {/* Scenario Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-card border-border">
                <FileSpreadsheet className="w-4 h-4" />
                {activeScenario?.name || 'Selecionar cenário'}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {scenarios.map(scenario => (
                <DropdownMenuItem 
                  key={scenario.id}
                  onClick={() => handleSelectScenario(scenario)}
                  className={scenario.id === activeScenario?.id ? 'bg-primary/20' : ''}
                >
                  {scenario.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCreateScenario}>
                <Plus className="w-4 h-4 mr-2" />
                Novo cenário
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicateScenario}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicar cenário
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteScenario} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir cenário
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="w-3 h-3 animate-pulse" />
              Salvando...
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div>
        {activeScenario ? (
          <Tabs defaultValue="projections" className="space-y-6">
            <TabsList className="bg-white/5 border border-white/10 p-1">
              <TabsTrigger value="projections" className="gap-2 data-[state=active]:bg-primary/20">
                <TrendingUp className="w-4 h-4" />
                Projeções de Faturamento
              </TabsTrigger>
              <TabsTrigger value="comparison" className="gap-2 data-[state=active]:bg-primary/20">
                <Users className="w-4 h-4" />
                Funcionário x Agente IA
              </TabsTrigger>
              <TabsTrigger value="areas" className="gap-2 data-[state=active]:bg-primary/20">
                <Building2 className="w-4 h-4" />
                Comparativo por Áreas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projections">
              <ProjectionTab 
                data={{
                  new_clients_per_month: activeScenario.new_clients_per_month,
                  setup_value: activeScenario.setup_value,
                  optimization_value: activeScenario.optimization_value,
                  projection_months: activeScenario.projection_months
                }}
                onUpdate={handleUpdate}
              />
            </TabsContent>

            <TabsContent value="comparison">
              <EmployeeComparisonTab
                data={{
                  employee_count: activeScenario.employee_count,
                  employee_salary: activeScenario.employee_salary,
                  employee_tax_rate: activeScenario.employee_tax_rate,
                  agent_count: activeScenario.agent_count,
                  agent_monthly_cost: activeScenario.agent_monthly_cost,
                  employee_hours_monthly: activeScenario.employee_hours_monthly,
                  agent_hours_monthly: activeScenario.agent_hours_monthly
                }}
                onUpdate={handleUpdate}
              />
            </TabsContent>

            <TabsContent value="areas">
              <AreasComparisonTab
                data={{
                  areas_comparison: activeScenario.areas_comparison,
                  employee_tax_rate: activeScenario.employee_tax_rate,
                  agent_monthly_cost: activeScenario.agent_monthly_cost
                }}
                onUpdate={handleUpdate}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Nenhum cenário encontrado</p>
            <Button onClick={handleCreateScenario}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro cenário
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
