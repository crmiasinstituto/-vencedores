import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ContributorsWall, { type Contributor } from '@/components/ui/contributors-wall';

/**
 * A parede de rostos de quem já faz parte, na seção das 34 mil vidas.
 *
 * O dado é REAL: vem da RPC mural_de_membros(), que devolve só primeiro nome + foto de quem
 * está aprovado. A landing é pública e o RLS de profiles é `to authenticated`, então essa RPC
 * (SECURITY DEFINER) é a única porta — e de propósito ela não expõe email, telefone nem
 * sobrenome.
 *
 * NÃO use i.pravatar.cc nem foto de banco de imagem aqui, como fazia o demo do componente.
 * Numa página que afirma "34.000+ vidas impactadas", rosto inventado posando de membro é
 * fabricar comunidade — o mesmo problema dos depoimentos falsos que saíram desta landing.
 *
 * Enquanto não houver membro com foto, a seção simplesmente não aparece: uma parede vazia (ou
 * pior, uma parede de estranhos) diz menos que silêncio.
 */
export function MuralDeMembros() {
  const [membros, setMembros] = useState<Contributor[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    (async () => {
      const [mural, contagem] = await Promise.all([
        supabase.rpc('mural_de_membros', { p_limit: 180 }),
        supabase.rpc('total_de_membros'),
      ]);

      if (!ativo) return;

      if (mural.error) {
        console.error('Erro ao carregar o mural de membros:', mural.error);
      } else {
        setMembros(
          (mural.data || []).map((m: { nome: string; foto_url: string }) => ({
            username: m.nome,
            avatarUrl: m.foto_url,
          })),
        );
      }

      if (!contagem.error) setTotal((contagem.data as number) || 0);
      setCarregando(false);
    })();

    return () => {
      ativo = false;
    };
  }, []);

  // 16 colunas com menos de 16 rostos vira uma fileira solitária e triste. Abaixo disso a
  // parede não se sustenta como parede.
  if (carregando || membros.length < 16) return null;

  return (
    <ContributorsWall
      title="Quem já faz parte"
      subtitle={
        <>
          Uma comunidade de{' '}
          <span className="font-semibold text-zinc-900/80 dark:text-white/70">{total}</span>{' '}
          {total === 1 ? 'pessoa' : 'pessoas'} que decidiram viver com propósito.
        </>
      }
      contributors={membros}
      totalCount={total}
      columns={16}
      height={300}
      // O --wall-bg do componente é #0a0a0a; aqui ele tem que ser o mesmo navy da seção,
      // senão aparece um retângulo mais escuro no meio do ato da noite.
      className="!bg-transparent [--wall-bg:#0b111c]"
    />
  );
}

export default MuralDeMembros;
