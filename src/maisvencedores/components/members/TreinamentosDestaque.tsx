import { CardStack, type CardStackItem } from '@/components/ui/card-stack';
import { FAIXA_INFO, type Training } from '@/maisvencedores/types/member';

/**
 * Leque de treinamentos em destaque no topo da tela de Treinamentos.
 *
 * Componente pedido pelo Carlos ("card-stack em leque nos treinamentos"). Mostra os primeiros
 * treinamentos como um leque navegável (arrasta, setas, dots), e a grade completa fica abaixo.
 *
 * SEM IMAGEM FALSA: o demo do card-stack enchia com fotos de banco de imagem. Aqui, se o
 * treinamento tem thumbnail própria usa ela; senão, um card de marca com o título e a faixa
 * mínima. Nada inventado.
 */
export function TreinamentosDestaque({ trainings }: { trainings: Training[] }) {
  const destaques = trainings.slice(0, 6);
  if (destaques.length === 0) return null;

  const items: (CardStackItem & { training: Training })[] = destaques.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    imageSrc: t.thumbnail || undefined,
    tag: t.categoryNome,
    training: t,
  }));

  return (
    <div className="mb-4">
      <CardStack
        items={items}
        autoAdvance
        intervalMs={4200}
        pauseOnHover
        cardWidth={360}
        cardHeight={230}
        maxVisible={5}
        renderCard={(item) => {
          const t = (item as CardStackItem & { training: Training }).training;
          const faixa = FAIXA_INFO[t.faixaMinima];
          return (
            <div className="relative h-full w-full bg-card">
              {t.thumbnail ? (
                <img src={t.thumbnail} alt={t.title} className="h-full w-full object-cover" draggable={false} loading="eager" />
              ) : (
                // Card de marca quando não há thumbnail: gradiente + título. Honesto e no tom.
                <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-primary/20 via-card to-card p-5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t.categoryNome || 'Treinamento'}
                  </span>
                  <span className="font-display text-2xl font-bold leading-tight text-foreground">
                    {t.title}
                  </span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{t.title}</p>
                  {t.duration && <p className="text-xs text-white/70">{t.duration}</p>}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${faixa.fundo} ${faixa.texto} ${faixa.borda}`}>
                  {faixa.nome}
                </span>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

export default TreinamentosDestaque;
