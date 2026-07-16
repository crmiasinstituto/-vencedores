import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DollarSign, Loader2 } from 'lucide-react';

interface DealFormProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function DealForm({ onSuccess, trigger }: DealFormProps) {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    buyer_name: '',
    amount: '',
    deal_date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setLoading(true);

      const { error } = await supabase.from('business_deals').insert({
        seller_profile_id: profile.id,
        title: formData.title,
        description: formData.description || null,
        buyer_name: formData.buyer_name || null,
        amount: parseFloat(formData.amount),
        deal_date: formData.deal_date
      });

      if (error) throw error;

      toast.success('Negócio registrado com sucesso!');
      setOpen(false);
      setFormData({
        title: '',
        description: '',
        buyer_name: '',
        amount: '',
        deal_date: new Date().toISOString().split('T')[0]
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error creating deal:', error);
      toast.error('Erro ao registrar negócio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gold hover:bg-gold/90 text-black">
            <DollarSign className="mr-2 h-4 w-4" />
            Declarar Negócio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Declarar Novo Negócio</DialogTitle>
          <DialogDescription>
            Registre uma venda ou negócio fechado através do + que Vencedores
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título do Negócio *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Consultoria de Marketing"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer_name">Nome do Cliente</Label>
              <Input
                id="buyer_name"
                value={formData.buyer_name}
                onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                placeholder="Nome da empresa ou pessoa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal_date">Data do Negócio</Label>
              <Input
                id="deal_date"
                type="date"
                value={formData.deal_date}
                onChange={(e) => setFormData({ ...formData, deal_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes do negócio..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gold hover:bg-gold/90 text-black">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
