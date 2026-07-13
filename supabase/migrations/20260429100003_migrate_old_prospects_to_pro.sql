-- ============================================================
-- MIGRACAO — prospects (antigo) → prospeccao_pro (novo)
-- ============================================================
-- Estratégia:
--  1. Cria UMA busca "legacy_import" que agrupa todos os prospects antigos
--  2. Cada prospects vira um prospeccao_leads_descobertos (audience='admin')
--  3. Se nota_geral existe, cria prospeccao_diagnosticos com scores convertidos
--     (0-10 escala antiga → 0-100 escala nova: nota * 10)
--  4. Preserva crm_lead_id (se já tinha "virado lead")
--  5. Após migrar com sucesso, dropa a tabela prospects
-- ============================================================

-- 1. Cria busca "legacy" agrupadora (só se houver prospects antigos)
DO $$
DECLARE
  v_legacy_busca_id UUID;
  v_count_prospects INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count_prospects FROM public.prospects;

  IF v_count_prospects = 0 THEN
    RAISE NOTICE 'Nenhum prospect antigo pra migrar. Pulando migração de dados.';
  ELSE
    -- Busca legacy
    INSERT INTO public.prospeccao_buscas (
      query, query_normalizada, nicho, cidade, status, total_resultados,
      audience, created_at
    ) VALUES (
      '[legacy_import] Prospects migrados do módulo antigo',
      'legacy_import',
      'misto',
      'misto',
      'completed',
      v_count_prospects,
      'admin',
      now()
    )
    RETURNING id INTO v_legacy_busca_id;

    RAISE NOTICE 'Busca legacy criada: %. Migrando % prospects...', v_legacy_busca_id, v_count_prospects;

    -- 2. Cada prospect → leads_descobertos
    INSERT INTO public.prospeccao_leads_descobertos (
      busca_id, nome, categoria, telefone, endereco, cidade,
      url_site, instagram_handle, nota_google, qtd_avaliacoes,
      status, lead_id, audience, raw_data, created_at
    )
    SELECT
      v_legacy_busca_id,
      p.empresa,
      p.nicho,
      p.telefone,
      p.endereco,
      p.cidade,
      p.site,
      CASE
        WHEN p.instagram IS NOT NULL THEN regexp_replace(p.instagram, '^@', '')
        ELSE NULL
      END,
      p.google_rating,
      p.google_reviews,
      CASE p.status
        WHEN 'novo' THEN 'descoberto'
        WHEN 'analisando' THEN 'descoberto'
        WHEN 'analisado' THEN 'analisado'
        WHEN 'abordado' THEN 'analisado'
        WHEN 'respondeu' THEN 'analisado'
        WHEN 'convertido' THEN 'virou_lead'
        WHEN 'descartado' THEN 'descartado'
        ELSE 'descoberto'
      END,
      p.crm_lead_id,
      'admin',
      jsonb_build_object(
        'legacy_prospect_id', p.id,
        'horario_funcionamento', p.horario_funcionamento,
        'observacoes', p.observacoes,
        'dm_enviada', p.dm_enviada,
        'dm_respondida', p.dm_respondida,
        'dm_texto', p.dm_texto,
        'pdf_path', p.pdf_path
      ),
      p.created_at
    FROM public.prospects p;

    -- 3. Se prospect tem nota_geral, cria diagnóstico
    INSERT INTO public.prospeccao_diagnosticos (
      lead_descoberto_id, busca_id, score_site, score_google_maps,
      score_instagram, score_geral, achados_site, achados_maps,
      achados_instagram, oportunidades, resumo_executivo,
      status, fontes_consultadas, audience, created_at
    )
    SELECT
      ld.id,
      v_legacy_busca_id,
      -- Escala antiga 0-10 → nova 0-100 (multiplica por 10)
      ROUND(((COALESCE(p.nota_site_seo, 0) + COALESCE(p.nota_site_conversao, 0)) / NULLIF(
        (CASE WHEN p.nota_site_seo IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN p.nota_site_conversao IS NOT NULL THEN 1 ELSE 0 END), 0
      )) * 10)::int,
      ROUND(p.nota_google_meu_negocio * 10)::int,
      ROUND(((COALESCE(p.nota_instagram_posicionamento, 0) + COALESCE(p.nota_instagram_engajamento, 0)) / NULLIF(
        (CASE WHEN p.nota_instagram_posicionamento IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN p.nota_instagram_engajamento IS NOT NULL THEN 1 ELSE 0 END), 0
      )) * 10)::int,
      p.nota_geral,
      p.analise_site,
      p.analise_gmb,
      p.analise_instagram,
      COALESCE(p.impacto, '[]'::jsonb),
      'Diagnóstico migrado do módulo antigo. Re-execute análise pra dados atualizados.',
      'completed',
      ARRAY['legacy_import']::text[],
      'admin',
      p.created_at
    FROM public.prospects p
    INNER JOIN public.prospeccao_leads_descobertos ld
      ON (ld.raw_data->>'legacy_prospect_id')::uuid = p.id
    WHERE p.nota_geral IS NOT NULL;

    RAISE NOTICE 'Migração concluída.';
  END IF;
END $$;

-- 4. Drop dependências e tabela antiga
-- (FK em prospects.crm_lead_id apontava pra crm_leads — só drop a prospects)
DROP TRIGGER IF EXISTS prospects_updated_at ON public.prospects;
DROP FUNCTION IF EXISTS public.update_prospects_updated_at();
DROP TABLE IF EXISTS public.prospects;

-- ============================================================
-- Função search-prospects vai parar de funcionar (não usa mais
-- a tabela). Será descontinuada na Fase 2 substituindo o front
-- por prospeccao-buscar (multi-canal).
-- ============================================================
