import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Treinador, TrainingCategory } from '@/maisvencedores/types/member';

/**
 * Treinadores e categorias — as duas listas que o admin escolhe ao criar evento/treinamento.
 *
 * Ambas vêm do banco, não do código. A categoria era um enum do Postgres (vendas, marketing,
 * financeiro...) e enum só muda por migration; o Carlos quer cadastrar categoria nova pela
 * tela, então virou tabela. Mesma coisa pros treinadores.
 */

export function useTreinadores() {
  const [treinadores, setTreinadores] = useState<Treinador[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('treinadores')
      .select('id, nome, foto_url, bio')
      .eq('ativo', true)
      .order('ordem');

    if (error) {
      console.error('Erro ao carregar treinadores:', error);
      setTreinadores([]);
    } else {
      setTreinadores(
        (data || []).map((t) => ({
          id: t.id,
          nome: t.nome,
          fotoUrl: t.foto_url || undefined,
          bio: t.bio || undefined,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { treinadores, loading, refetch: carregar };
}

export function useCategorias() {
  const [categorias, setCategorias] = useState<TrainingCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('training_categories')
      .select('id, nome, slug, grupo')
      .eq('ativo', true)
      .order('ordem');

    if (error) {
      console.error('Erro ao carregar categorias:', error);
      setCategorias([]);
    } else {
      setCategorias(
        (data || []).map((c) => ({
          id: c.id,
          nome: c.nome,
          slug: c.slug,
          grupo: c.grupo || undefined,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Cria categoria na hora, de dentro do formulário — o Carlos pediu pra poder adicionar
   * pelo frontend sem precisar de migration.
   */
  const criarCategoria = async (nome: string): Promise<TrainingCategory | null> => {
    const limpo = nome.trim();
    if (!limpo) return null;

    const slug = limpo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // tira acento: "Espiritualidade" -> "espiritualidade"
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data, error } = await supabase
      .from('training_categories')
      .insert({ nome: limpo, slug, grupo: 'Outras', ordem: 99 })
      .select('id, nome, slug, grupo')
      .single();

    if (error) {
      console.error('Erro ao criar categoria:', error);
      return null;
    }

    const nova: TrainingCategory = {
      id: data.id,
      nome: data.nome,
      slug: data.slug,
      grupo: data.grupo || undefined,
    };
    setCategorias((c) => [...c, nova]);
    return nova;
  };

  return { categorias, loading, criarCategoria, refetch: carregar };
}
