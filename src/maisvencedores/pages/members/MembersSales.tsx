import { useSalesRanking } from '@/maisvencedores/hooks/useSalesRanking';
import { SalesStats } from '@/maisvencedores/components/members/SalesStats';
import { SalesLeaderboard } from '@/maisvencedores/components/members/SalesLeaderboard';
import { DealForm } from '@/maisvencedores/components/shared/DealForm';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MembersSales() {
  const { profile } = useProfile();
  const { ranking, myStats, myDeals, loading, refetch, getMyRankPosition } = useSalesRanking();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-primary" />
              Negócios da rede
            </h1>
            <p className="text-muted-foreground mt-1">
              Os negócios que nasceram das conexões do + que Vencedores. Registrar é opcional —
              serve pra celebrar o que a rede gerou, não pra bater meta.
            </p>
          </div>

          <DealForm
            onSuccess={refetch}
            trigger={
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Registrar negócio
              </Button>
            }
          />
        </div>

        {/* Stats */}
        {myStats && (
          <SalesStats stats={myStats} rankPosition={getMyRankPosition()} />
        )}

        {/* A "Meta de Vendas" (SalesProgress) e o "Ranking Anual" com prêmios (passagens
            aéreas, mentoria — tudo chumbado no código, nunca acordado) saíram a pedido do
            Carlos em 16/07: o ecossistema não é sobre ganho direto nem meta comercial, é sobre
            conexão e crescimento. A moeda é ponto, não faturamento. Os componentes seguem no
            repo caso o modelo mude. */}

        {/* Grid: Ranking + Deals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Leaderboard */}
          <SalesLeaderboard ranking={ranking} currentProfileId={profile?.id} />

          {/* My Deals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Negócios registrados
              </CardTitle>
              <Badge variant="secondary">{myDeals.length}</Badge>
            </CardHeader>
            <CardContent>
              {myDeals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum negócio registrado ainda.</p>
                  <p className="text-sm">Fechou algo através de uma conexão da rede? Registre aqui.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myDeals.slice(0, 5).map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium">
                            {deal.title}
                            {deal.buyer_name && (
                              <span className="text-xs text-muted-foreground block">
                                Comprador: {deal.buyer_name}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-green-500 font-semibold">
                            {formatCurrency(Number(deal.amount))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(deal.deal_date), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {myDeals.length > 5 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      +{myDeals.length - 5} outros negócios
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
