
-- Create table to persist structured agent fields locally
CREATE TABLE public.agent_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uazapi_agent_id TEXT NOT NULL UNIQUE,
  instance_id UUID,
  description TEXT DEFAULT '',
  persona TEXT DEFAULT '',
  skills JSONB DEFAULT '[]'::jsonb,
  product_info TEXT DEFAULT '',
  restrictions TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;

-- Public access policies (matching existing pattern in this project)
CREATE POLICY "Allow public read agent_configs" ON public.agent_configs FOR SELECT USING (true);
CREATE POLICY "Allow public insert agent_configs" ON public.agent_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update agent_configs" ON public.agent_configs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete agent_configs" ON public.agent_configs FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_agent_configs_updated_at
  BEFORE UPDATE ON public.agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
