import { useMemo, useState } from 'react';
import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { TrainingCard } from '@/maisvencedores/components/members/TrainingCard';
import { TreinamentosDestaque } from '@/maisvencedores/components/members/TreinamentosDestaque';
import { useTrainings } from '@/maisvencedores/hooks/useTrainings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TODOS = 'todos';

/**
 * O catálogo de treinamentos do membro.
 *
 * O que mudou aqui:
 *  - lia `mockTrainings` (6 treinamentos inventados pelo template), agora lê o banco;
 *  - as abas eram a lista chumbada 'networking/vendas/marketing/financeiro/lideranca' — as 6
 *    categorias antigas. Hoje são 18 e vêm de tabela;
 *  - o filtro comparava `t.categoryId === cat`, ou seja, UUID contra slug: nunca casava.
 *
 * As abas mostram só categorias QUE TÊM treinamento. Com 18 categorias, listar todas daria 18
 * abas e a maioria vazia — aba serve pra navegar no que existe, não pra anunciar o que falta.
 *
 * Não filtra por faixa: quem filtra é o RLS (treinamentos_por_faixa). O que chega aqui já é o
 * que a pessoa pode ver.
 */
export default function MembersTraining() {
  const { trainings, loading } = useTrainings();
  const [aba, setAba] = useState(TODOS);

  const categorias = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const t of trainings) {
      if (t.categoryId && t.categoryNome) vistas.set(t.categoryId, t.categoryNome);
    }
    return Array.from(vistas, ([id, nome]) => ({ id, nome }));
  }, [trainings]);

  const filtrados = aba === TODOS ? trainings : trainings.filter((t) => t.categoryId === aba);

  return (
    <div className="min-h-screen">
      <MembersHeader
        title="Treinamentos"
        subtitle="Sete áreas da vida, tratadas com a mesma seriedade"
      />
      <div className="p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : trainings.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center">
            <p className="text-foreground font-medium">Nenhum treinamento disponível ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Assim que houver conteúdo liberado para a sua faixa, ele aparece aqui.
            </p>
          </div>
        ) : (
          <Tabs value={aba} onValueChange={setAba}>
            {/* Leque de destaques no topo (só na aba "Todos", pra não competir com o filtro). */}
            {aba === TODOS && <TreinamentosDestaque trainings={trainings} />}

            <TabsList className="mb-6 bg-card/50 flex-wrap h-auto">
              <TabsTrigger value={TODOS}>Todos</TabsTrigger>
              {categorias.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.nome}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={aba}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtrados.map((training) => (
                  <TrainingCard key={training.id} training={training} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
