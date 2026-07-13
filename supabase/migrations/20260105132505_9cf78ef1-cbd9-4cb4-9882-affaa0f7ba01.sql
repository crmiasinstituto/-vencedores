-- Create table for financial projections/scenarios
CREATE TABLE public.financial_projections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Scenario metadata
  name TEXT NOT NULL DEFAULT 'Cenário Padrão',
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Projection settings
  new_clients_per_month INTEGER NOT NULL DEFAULT 2,
  setup_value NUMERIC NOT NULL DEFAULT 3000,
  optimization_value NUMERIC NOT NULL DEFAULT 1600,
  projection_months INTEGER NOT NULL DEFAULT 18,
  
  -- Employee vs Agent comparison
  employee_count INTEGER NOT NULL DEFAULT 2,
  employee_salary NUMERIC NOT NULL DEFAULT 2500,
  employee_tax_rate NUMERIC NOT NULL DEFAULT 0.48,
  agent_monthly_cost NUMERIC NOT NULL DEFAULT 1899,
  agent_capacity_factor INTEGER NOT NULL DEFAULT 1,
  employee_hours_monthly INTEGER NOT NULL DEFAULT 264,
  agent_hours_monthly INTEGER NOT NULL DEFAULT 720,
  
  -- Areas comparison (JSONB for flexibility)
  areas_comparison JSONB NOT NULL DEFAULT '[
    {"name": "Atendimento ao Cliente", "employee_count": 2, "salary": 2500},
    {"name": "Vendas", "employee_count": 3, "salary": 3000},
    {"name": "Suporte Técnico", "employee_count": 2, "salary": 3500},
    {"name": "Marketing", "employee_count": 1, "salary": 4000},
    {"name": "Financeiro", "employee_count": 1, "salary": 3500}
  ]'::jsonb
);

-- Enable RLS
ALTER TABLE public.financial_projections ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (admin access)
CREATE POLICY "Authenticated users can view financial projections"
ON public.financial_projections
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create financial projections"
ON public.financial_projections
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update financial projections"
ON public.financial_projections
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete financial projections"
ON public.financial_projections
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_financial_projections_updated_at
BEFORE UPDATE ON public.financial_projections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default scenario
INSERT INTO public.financial_projections (name, is_active) 
VALUES ('Cenário Base', true);