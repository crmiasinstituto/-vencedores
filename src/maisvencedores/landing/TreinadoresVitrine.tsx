import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Marquee } from '@/components/ui/marquee';

/**
 * Vitrine dos treinadores na dobra "Quem está por trás" — carrossel de rostos que rola sozinho.
 *
 * Componente pedido pelo Carlos. Adaptado do demo (que usava fotos de banco de imagem e um
 * depoimento inventado): aqui os dados vêm da tabela `treinadores` via RPC pública, e nada é
 * fabricado. O depoimento falso do demo NÃO entrou — mesma regra dos que já removi.
 *
 * ENQUANTO NÃO HÁ FOTO: o card mostra as iniciais num círculo. Assim que o Carlos subir a foto
 * de cada treinador (foto_url na tabela), ela aparece no lugar — sem mexer aqui.
 *
 * next/Image do original virou <img> nativo; a página é Vite, não Next.
 */

type Treinador = { nome: string; foto_url: string | null; papel: string };

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function Card({ t }: { t: Treinador }) {
  return (
    <figure className="group flex w-56 shrink-0 flex-col">
      <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-[#dfe4ec]">
        {t.foto_url ? (
          <img
            src={t.foto_url}
            alt={t.nome}
            loading="lazy"
            className="h-full w-full object-cover grayscale transition-all duration-300 group-hover:grayscale-0"
          />
        ) : (
          // Sem foto: iniciais grandes. Não usar banco de imagem pra pessoa real.
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1b3fd1]/10 to-[#dfe4ec] font-display text-5xl font-bold text-[#1b3fd1]">
            {iniciais(t.nome)}
          </div>
        )}
        <figcaption className="absolute bottom-0 w-full bg-white/85 p-3 backdrop-blur-sm">
          <p className="font-semibold text-[#080b12] leading-tight">{t.nome}</p>
          <p className="text-sm text-[#4a5262]">{t.papel}</p>
        </figcaption>
      </div>
    </figure>
  );
}

export function TreinadoresVitrine() {
  const [treinadores, setTreinadores] = useState<Treinador[]>([]);

  useEffect(() => {
    let ativo = true;
    supabase.rpc('treinadores_publicos').then(({ data, error }) => {
      if (!ativo) return;
      if (error) {
        console.error('Erro ao carregar treinadores:', error);
      } else {
        setTreinadores((data as Treinador[]) || []);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (treinadores.length === 0) return null;

  return (
    <div className="relative w-full">
      {/* Máscaras nas bordas pra o carrossel desaparecer suave em vez de cortar seco. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--day)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--day)] to-transparent" />
      <Marquee pauseOnHover className="[--duration:35s]">
        {treinadores.map((t) => (
          <Card key={t.nome} t={t} />
        ))}
      </Marquee>
    </div>
  );
}

export default TreinadoresVitrine;
