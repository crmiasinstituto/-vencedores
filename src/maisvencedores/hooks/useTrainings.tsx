import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Training } from '@/maisvencedores/types/member';

/**
 * Os treinamentos que a pessoa logada pode ver.
 *
 * Não filtra por faixa aqui: quem filtra é o RLS, pela policy `treinamentos_por_faixa`
 * (current_faixa() >= faixa_minima). Repetir a regra no front seria uma segunda fonte da
 * verdade pra divergir da primeira — e a que vale é a do banco.
 *
 * Existe porque o /membros/treinamentos lia `mockTrainings`: 6 treinamentos inventados pelo
 * template da Lovable, que apareciam mesmo com o catálogo real vazio.
 */
export function useTrainings() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trainings')
      .select('id, title, description, thumbnail_url, video_url, duration, category_id, faixa_minima, training_categories(nome)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar treinamentos:', error);
      setTrainings([]);
    } else {
      setTrainings(
        (data || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          thumbnail: t.thumbnail_url || '',
          duration: t.duration || '',
          videoUrl: t.video_url || undefined,
          categoryId: t.category_id || undefined,
          categoryNome: t.training_categories?.nome || undefined,
          faixaMinima: t.faixa_minima,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { trainings, loading, refetch: carregar };
}
