-- ===========================================
-- BOARD: Masterclass IA para Negócios
-- Captura via /masterclass-ia
-- ===========================================

INSERT INTO public.crm_boards (name, slug, color, icon, sort_order)
VALUES ('Masterclass IA para Negócios', 'masterclass-ia', '#FAC800', 'sparkles', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.crm_columns (board_id, name, color, sort_order, is_final_stage)
SELECT b.id, c.name, c.color, c.sort_order, c.is_final_stage
FROM public.crm_boards b
CROSS JOIN (VALUES
  ('Lead Capturado',    '#6B7280', 1, false),
  ('Diagnóstico Visto', '#3B82F6', 2, false),
  ('Checkout Aberto',   '#F59E0B', 3, false),
  ('Comprou',           '#10B981', 4, true),
  ('Não Comprou',       '#EF4444', 5, true)
) AS c(name, color, sort_order, is_final_stage)
WHERE b.slug = 'masterclass-ia'
  AND NOT EXISTS (
    SELECT 1 FROM public.crm_columns
    WHERE board_id = b.id AND name = c.name
  );
