
-- Tabela wavoip_devices
CREATE TABLE public.wavoip_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  name TEXT DEFAULT 'Dispositivo WaVoIP',
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wavoip_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read wavoip_devices" ON public.wavoip_devices FOR SELECT USING (true);
CREATE POLICY "Allow public insert wavoip_devices" ON public.wavoip_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update wavoip_devices" ON public.wavoip_devices FOR UPDATE USING (true);
CREATE POLICY "Allow public delete wavoip_devices" ON public.wavoip_devices FOR DELETE USING (true);

CREATE TRIGGER update_wavoip_devices_updated_at
  BEFORE UPDATE ON public.wavoip_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela call_history
CREATE TABLE public.call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wavoip_device_id UUID REFERENCES public.wavoip_devices(id),
  wavoip_call_id TEXT,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES public.crm_leads(id),
  direction TEXT NOT NULL,
  status TEXT DEFAULT 'CALLING',
  peer_phone TEXT NOT NULL,
  peer_name TEXT,
  duration_seconds INTEGER DEFAULT 0,
  transcription TEXT,
  transcriptions JSONB DEFAULT '[]',
  ai_summary TEXT,
  ai_sentiment TEXT,
  ai_key_points JSONB DEFAULT '[]',
  ai_suggested_tasks JSONB DEFAULT '[]',
  ai_processed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read call_history" ON public.call_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert call_history" ON public.call_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update call_history" ON public.call_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete call_history" ON public.call_history FOR DELETE USING (true);

-- RPC find_lead_by_phone_crm
CREATE OR REPLACE FUNCTION public.find_lead_by_phone_crm(p_phone TEXT)
RETURNS UUID AS $$
DECLARE
  v_lead_id UUID;
  v_clean_phone TEXT;
BEGIN
  v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

  SELECT id INTO v_lead_id FROM public.crm_leads
  WHERE regexp_replace(whatsapp, '[^0-9]', '', 'g') = v_clean_phone
  LIMIT 1;

  IF v_lead_id IS NULL AND length(v_clean_phone) > 10 THEN
    SELECT id INTO v_lead_id FROM public.crm_leads
    WHERE regexp_replace(whatsapp, '[^0-9]', '', 'g') LIKE '%' || right(v_clean_phone, 11)
    LIMIT 1;
  END IF;

  -- Try with/without the 9 digit
  IF v_lead_id IS NULL AND v_clean_phone LIKE '55%' AND length(v_clean_phone) = 13 THEN
    SELECT id INTO v_lead_id FROM public.crm_leads
    WHERE regexp_replace(whatsapp, '[^0-9]', '', 'g') = left(v_clean_phone, 4) || right(v_clean_phone, 8)
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL AND v_clean_phone LIKE '55%' AND length(v_clean_phone) = 12 THEN
    SELECT id INTO v_lead_id FROM public.crm_leads
    WHERE regexp_replace(whatsapp, '[^0-9]', '', 'g') = left(v_clean_phone, 4) || '9' || right(v_clean_phone, 8)
    LIMIT 1;
  END IF;

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
