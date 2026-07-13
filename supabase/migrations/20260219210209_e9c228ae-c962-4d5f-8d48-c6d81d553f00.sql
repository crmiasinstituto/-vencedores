-- Create AI FIRST board for lead implantacao IA
INSERT INTO public.crm_boards (name, slug, description, color, icon, sort_order, is_active)
VALUES ('AI FIRST - Implantação IA', 'ai-first', 'Pipeline para leads interessados em implantar sistema de IA nas empresas', '#8B5CF6', 'brain', 10, true);

-- Create columns for this board
DO $$
DECLARE
  v_board_id UUID;
BEGIN
  SELECT id INTO v_board_id FROM public.crm_boards WHERE slug = 'ai-first' LIMIT 1;

  INSERT INTO public.crm_columns (board_id, name, color, sort_order, is_final_stage) VALUES
    (v_board_id, 'Captado',           '#6B7280', 0,  false),
    (v_board_id, 'Primeiro Contato',  '#3B82F6', 1,  false),
    (v_board_id, 'Qualificado',       '#8B5CF6', 2,  false),
    (v_board_id, 'Call Agendada',     '#F59E0B', 3,  false),
    (v_board_id, 'Proposta Enviada',  '#EC4899', 4,  false),
    (v_board_id, 'Negociação',        '#06B6D4', 5,  false),
    (v_board_id, 'Fechado',           '#10B981', 6,  false),
    (v_board_id, 'Onboarding',        '#6366F1', 7,  false),
    (v_board_id, 'Implementando',     '#F97316', 8,  false),
    (v_board_id, 'Concluído',         '#059669', 9,  true),
    (v_board_id, 'Perdido',           '#EF4444', 10, true);
END $$;