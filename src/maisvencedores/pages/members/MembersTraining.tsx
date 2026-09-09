import { useMemo, useState } from 'react';
import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { TrainingCard } from '@/maisvencedores/components/members/TrainingCard';
import { TreinamentosDestaque } from '@/maisvencedores/components/members/TreinamentosDestaque';
import { useTrainings } from '@/maisvencedores/hooks/useTrainings';
import { useAuth } from '@/maisvencedores/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePodePublicarTreinamento } from '@/maisvencedores/hooks/useComunidadeConfig';
import {
  TrainingFormDialog,
  type TrainingFormValues,
} from '@/maisvencedores/components/shared/TrainingFormDialog';

const TODOS = 'todos';
const MEUS = 'meus';

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
 *
 * Quem pode publicar é configurável em /admin/maisvencedores/configuracoes (faixa mínima,
 * marrom por padrão). O front pergunta ao banco (`pode_publicar_treinamento`) em vez de
 * comparar a faixa aqui: a policy é quem decide, e uma segunda cópia da regra no front seria
 * a primeira a divergir quando o admin mudasse a configuração.
 */
export default function MembersTraining() {
  const { trainings, loading, refetch } = useTrainings();
  const { user } = useAuth();
  const [aba, setAba] = useState(TODOS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<TrainingFormValues | null>(null);

  const { pode: podePublicar } = usePodePublicarTreinamento();
  const meus = useMemo(
    () => (user ? trainings.filter((t) => t.createdBy === user.id) : []),
    [trainings, user],
  );

  const categorias = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const t of trainings) {
      if (t.categoryId && t.categoryNome) vistas.set(t.categoryId, t.categoryNome);
    }
    return Array.from(vistas, ([id, nome]) => ({ id, nome }));
  }, [trainings]);

  const filtrados =
    aba === TODOS ? trainings : aba === MEUS ? meus : trainings.filter((t) => t.categoryId === aba);

  const abrirNovo = () => {
    setEditando(null);
    setDialogOpen(true);
  };

  const abrirEdicao = (t: (typeof trainings)[number]) => {
    setEditando({
      id: t.id,
      title: t.title,
      description: t.description || '',
      thumbnail_url: t.thumbnail || '',
      video_url: t.videoUrl || '',
      duration: t.duration || '',
      category_id: t.categoryId || '',
      faixa_minima: t.faixaMinima,
    });
    setDialogOpen(true);
  };

  const excluir = async (id: string, titulo: string) => {
    if (!confirm(`Remover "${titulo}"? Isso apaga o treinamento para todo mundo.`)) return;
    const { error } = await supabase.from('trainings').delete().eq('id', id);
    if (error) {
      toast.error('Não consegui remover');
      return;
    }
    toast.success('Treinamento removido');
    refetch();
  };

  return (
    <div className="min-h-screen">
      <MembersHeader
        title="Treinamentos"
        subtitle="Sete áreas da vida, tratadas com a mesma seriedade"
      />
      <div className="p-6">
        {podePublicar && (
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap rounded-xl border border-gold/20 bg-card/50 p-4">
            <div>
              <p className="font-medium text-foreground">Você pode publicar treinamentos</p>
              <p className="text-sm text-muted-foreground">
                Sua faixa dá acesso a subir conteúdo, e ele entra no ar na hora.
              </p>
            </div>
            <Button onClick={abrirNovo} className="bg-gold hover:bg-gold/90 text-black">
              <Plus className="mr-2 h-4 w-4" />
              Publicar treinamento
            </Button>
          </div>
        )}

        <TrainingFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          training={editando}
          onSaved={refetch}
          modo="membro"
        />

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
              {meus.length > 0 && (
                <TabsTrigger value={MEUS}>
                  Meus treinamentos
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {meus.length}
                  </Badge>
                </TabsTrigger>
              )}
              {categorias.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.nome}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={aba}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtrados.map((training) => (
                  <div key={training.id} className="relative group">
                    <TrainingCard training={training} />

                    {/* Despublicado pelo admin: só o autor vê o card, e precisa saber por que
                        ele não aparece para mais ninguém. */}
                    {training.isActive === false && (
                      <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] gap-1">
                        <EyeOff className="h-3 w-3" /> despublicado
                      </Badge>
                    )}

                    {training.createdBy && training.createdBy === user?.id && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7"
                          onClick={() => abrirEdicao(training)}
                          aria-label={`Editar ${training.title}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7"
                          onClick={() => excluir(training.id, training.title)}
                          aria-label={`Remover ${training.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    )}

                  </div>
                ))}
              </div>

              {aba === MEUS && meus.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Você ainda não publicou nenhum treinamento.
                </p>
              )}

            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
