import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { Faixa } from '@/maisvencedores/types/member';
import { FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';
import { SeletorDeFaixas } from '@/maisvencedores/components/admin/SeletorDeFaixas';
import { useTreinadores } from '@/maisvencedores/hooks/useCatalogo';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: 'presencial' | 'online';
  event_date: string;
  event_time: string | null;
  location: string | null;
  meeting_url: string | null;
  total_spots: number | null;
  spots_remaining: number | null;
  faixas_permitidas: Faixa[];
  treinador_id: string | null;
  is_active: boolean;
}

const emptyEvent = {
  title: '',
  description: '',
  event_type: 'online' as 'presencial' | 'online',
  event_date: '',
  event_time: '',
  location: '',
  meeting_url: '',
  total_spots: '',
  // Por padrão o evento abre pra todo mundo; o admin restringe se quiser.
  faixas_permitidas: [...FAIXAS] as Faixa[],
  treinador_id: ''
};

export default function AdminEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState(emptyEvent);
  const { treinadores } = useTreinadores();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      event_date: event.event_date.split('T')[0],
      event_time: event.event_time || '',
      location: event.location || '',
      meeting_url: event.meeting_url || '',
      total_spots: event.total_spots?.toString() || '',
      faixas_permitidas: event.faixas_permitidas || [...FAIXAS],
      treinador_id: event.treinador_id || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);

      const eventData = {
        title: formData.title,
        description: formData.description || null,
        event_type: formData.event_type,
        event_date: formData.event_date,
        event_time: formData.event_time || null,
        location: formData.event_type === 'presencial' ? formData.location : null,
        meeting_url: formData.event_type === 'online' ? formData.meeting_url : null,
        total_spots: formData.total_spots ? parseInt(formData.total_spots) : null,
        spots_remaining: formData.total_spots ? parseInt(formData.total_spots) : null,
        faixas_permitidas: formData.faixas_permitidas,
        treinador_id: formData.treinador_id || null
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id);
        if (error) throw error;
        toast.success('Evento atualizado!');
      } else {
        const { error } = await supabase.from('events').insert(eventData);
        if (error) throw error;
        toast.success('Evento criado!');
      }

      setDialogOpen(false);
      setEditingEvent(null);
      setFormData(emptyEvent);
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Erro ao salvar evento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      toast.success('Evento excluído');
      fetchEvents();
    } catch (error) {
      toast.error('Erro ao excluir evento');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: !isActive })
        .eq('id', id);
      if (error) throw error;
      fetchEvents();
    } catch (error) {
      toast.error('Erro ao atualizar evento');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Eventos</h1>
          <p className="text-muted-foreground">Gerenciar eventos e reuniões</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingEvent(null);
            setFormData(emptyEvent);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gold hover:bg-gold/90 text-black">
              <Plus className="mr-2 h-4 w-4" />
              Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? 'Editar Evento' : 'Novo Evento'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={formData.event_type}
                    onValueChange={(value: 'presencial' | 'online') =>
                      setFormData({ ...formData, event_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="presencial">Presencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Treinador que vai ministrar</Label>
                  <Select
                    value={formData.treinador_id || 'nenhum'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, treinador_id: value === 'nenhum' ? '' : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">A definir</SelectItem>
                      {treinadores.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={formData.event_time}
                    onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                  />
                </div>
              </div>
              {formData.event_type === 'presencial' ? (
                <div className="space-y-2">
                  <Label>Local</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Endereço do evento"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Link da Reunião</Label>
                  <Input
                    value={formData.meeting_url}
                    onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Vagas (deixe vazio para ilimitado)</Label>
                <Input
                  type="number"
                  value={formData.total_spots}
                  onChange={(e) => setFormData({ ...formData, total_spots: e.target.value })}
                  min="1"
                />
              </div>
              {/* Múltipla escolha, não faixa mínima: um evento pode ser só pra verde e roxo
                  sem ser pra todo mundo. Isto substituiu o Select de "Plano Mínimo" e o
                  switch "Evento VIP (somente Ouro)" — VIP agora é só marcar as faixas. */}
              <div className="space-y-2">
                <Label>Quem pode participar *</Label>
                <SeletorDeFaixas
                  selecionadas={formData.faixas_permitidas}
                  onChange={(faixas) => setFormData({ ...formData, faixas_permitidas: faixas })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-gold hover:bg-gold/90 text-black">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingEvent ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card/50 border-gold/20">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Vagas</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{event.title}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {event.event_type === 'online' ? 'Online' : 'Presencial'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(event.event_date).toLocaleDateString('pt-BR')}
                      {event.event_time && ` às ${event.event_time}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {event.faixas_permitidas?.length === FAIXAS.length
                          ? 'Todas as faixas'
                          : (event.faixas_permitidas || []).map((f) => FAIXA_INFO[f].nome).join(', ') || 'Ninguém'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {event.total_spots
                        ? `${event.spots_remaining}/${event.total_spots}`
                        : 'Ilimitado'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={event.is_active}
                        onCheckedChange={() => handleToggleActive(event.id, event.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(event)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
