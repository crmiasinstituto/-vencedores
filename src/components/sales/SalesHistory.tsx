import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, Save, X, ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Sale {
  id: string;
  name: string;
  whatsapp: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  product_name: string;
  amount: number;
  payment_method?: string;
  created_at: string;
}

interface SalesHistoryProps {
  sales: Sale[];
  onSaleUpdated?: () => void;
  onSaleDeleted?: (id: string) => void;
}

export function SalesHistory({ sales, onSaleUpdated, onSaleDeleted }: SalesHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Sale>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startEdit = (sale: Sale) => {
    setEditingId(sale.id);
    setEditData({
      name: sale.name,
      whatsapp: sale.whatsapp,
      instagram: sale.instagram || '',
      product_name: sale.product_name,
      amount: sale.amount,
      payment_method: sale.payment_method || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('sales_events')
        .update({
          name: editData.name,
          whatsapp: editData.whatsapp,
          instagram: editData.instagram || null,
          product_name: editData.product_name,
          amount: editData.amount,
          payment_method: editData.payment_method || null
        })
        .eq('id', editingId);

      if (error) throw error;

      toast.success('Venda atualizada!');
      setEditingId(null);
      setEditData({});
      onSaleUpdated?.();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar venda');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('sales_events')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast.success('Venda removida!');
      onSaleDeleted?.(deleteId);
      setDeleteId(null);
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao remover venda');
    } finally {
      setIsLoading(false);
    }
  };

  const openWhatsApp = (whatsapp: string, name: string) => {
    const cleanNumber = whatsapp.replace(/\D/g, '');
    const number = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
    window.open(`https://wa.me/${number}?text=Olá ${name}!`, '_blank');
  };

  const openInstagram = (instagram: string) => {
    const username = instagram.replace('@', '');
    window.open(`https://instagram.com/${username}`, '_blank');
  };

  if (sales.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhuma venda registrada ainda hoje.</p>
        <p className="text-sm">Quando uma venda for concluída, aparecerá aqui em tempo real!</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data e hora</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-sm whitespace-nowrap">
                  {/* Só a hora não dizia de que dia era a venda — com o filtro em "Todos",
                      a lista cobre meses e 13:38:16 podia ser de agosto. */}
                  <div>{format(new Date(sale.created_at), 'dd/MM/yy', { locale: ptBR })}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(sale.created_at), 'HH:mm:ss', { locale: ptBR })}
                  </div>
                </TableCell>
                <TableCell>
                  {editingId === sale.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editData.name || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Nome"
                        className="h-8"
                      />
                      <Input
                        value={editData.whatsapp || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, whatsapp: e.target.value }))}
                        placeholder="WhatsApp"
                        className="h-8"
                      />
                      <Input
                        value={editData.instagram || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, instagram: e.target.value }))}
                        placeholder="Instagram"
                        className="h-8"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar className="w-10 h-10 border-2 border-yellow/30">
                        <AvatarImage src={sale.instagram_profile_pic_url} />
                        <AvatarFallback className="bg-yellow/20 text-yellow text-xs">
                          {sale.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{sale.name}</p>
                        <div className="flex items-center gap-2">
                          {sale.instagram && (
                            <button
                              onClick={() => openInstagram(sale.instagram!)}
                              className="text-xs text-muted-foreground hover:text-yellow flex items-center gap-1"
                            >
                              @{sale.instagram.replace('@', '')}
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => openWhatsApp(sale.whatsapp, sale.name)}
                            className="text-xs text-green-500 hover:text-green-400"
                          >
                            WhatsApp
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === sale.id ? (
                    <Input
                      value={editData.product_name || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, product_name: e.target.value }))}
                      className="h-8"
                    />
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {sale.product_name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {editingId === sale.id ? (
                    <Input
                      value={editData.payment_method || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, payment_method: e.target.value }))}
                      placeholder="Forma de pagamento"
                      className="h-8"
                    />
                  ) : (
                    sale.payment_method || 'N/A'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === sale.id ? (
                    <Input
                      type="number"
                      value={editData.amount || 0}
                      onChange={(e) => setEditData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                      className="h-8 w-24 ml-auto"
                    />
                  ) : (
                    <span className="font-bold text-green-500">
                      R$ {sale.amount.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {editingId === sale.id ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={saveEdit}
                          disabled={isLoading}
                          className="h-8 w-8 text-green-500 hover:text-green-400"
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEdit}
                          className="h-8 w-8"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(sale)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(sale.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta venda do histórico? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
