import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Faixa } from '@/maisvencedores/types/member';

const db = supabase as any;

/**
 * Se a pessoa logada pode publicar treinamento.
 *
 * Pergunta ao banco (`pode_publicar_treinamento`) em vez de comparar a faixa aqui: a regra
 * é configurável e quem manda é a policy. Repetir a comparação no front criaria uma segunda
 * fonte da verdade — e seria ela a divergir no dia em que o admin mudasse a faixa mínima.
 */
export function usePodePublicarTreinamento() {
  const [pode, setPode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await db.rpc('pode_publicar_treinamento');
      if (!vivo) return;
      if (error) {
        console.error('Erro ao checar permissão de publicar treinamento:', error);
        setPode(false);
      } else {
        setPode(Boolean(data));
      }
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return { pode, loading };
}

/** A faixa mínima configurada, e como alterá-la (admin). */
export function useFaixaMinimaPublicar() {
  const [faixa, setFaixa] = useState<Faixa | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from('comunidade_config')
      .select('value')
      .eq('key', 'treinamento_faixa_minima_publicar')
      .maybeSingle();
    if (error) console.error('Erro ao ler config da comunidade:', error);
    setFaixa((data?.value as Faixa) ?? 'marrom');
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = useCallback(
    async (nova: Faixa) => {
      setSalvando(true);
      const { error } = await db.rpc('set_comunidade_config', {
        p_key: 'treinamento_faixa_minima_publicar',
        p_value: nova,
      });
      setSalvando(false);
      if (error) {
        toast.error(error.message || 'Não consegui salvar');
        return false;
      }
      setFaixa(nova);
      toast.success('Configuração salva');
      return true;
    },
    [],
  );

  return { faixa, loading, salvando, salvar, refetch: carregar };
}

/** Se a comunidade exige aprovação antes do treinamento do membro ir ao ar. */
export function useExigeAprovacao() {
  const [exige, setExige] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await db
      .from('comunidade_config')
      .select('value')
      .eq('key', 'treinamento_exige_aprovacao')
      .maybeSingle();
    setExige(data?.value === true);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = useCallback(async (novo: boolean) => {
    setSalvando(true);
    const { error } = await db.rpc('set_comunidade_config', {
      p_key: 'treinamento_exige_aprovacao',
      p_value: novo,
    });
    setSalvando(false);
    if (error) {
      toast.error(error.message || 'Não consegui salvar');
      return false;
    }
    setExige(novo);
    toast.success(novo ? 'Aprovação prévia ligada' : 'Aprovação prévia desligada');
    return true;
  }, []);

  return { exige, salvando, salvar };
}
