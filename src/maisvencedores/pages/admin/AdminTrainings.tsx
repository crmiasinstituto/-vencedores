import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Faixa } from '@/maisvencedores/types/member';
import { FAIXA_INFO } from '@/maisvencedores/types/member';
import { useCategorias } from '@/maisvencedores/hooks/useCatalogo';
import {
  TrainingFormDialog,
  type TrainingFormValues,
} from '@/maisvencedores/components/shared/TrainingFormDialog';

interface Training {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration: string | null;
  category_id: string | null;
  faixa_minima: Faixa;
  is_active: boolean;
  created_by: string | null;
}

export default function AdminTrainings() {
  const { categorias } = useCategorias();

  const [trainings, setTrainings] = useState<Training[]>([]);
  /** user_id -> nome de quem publicou. Vem por RPC: profiles não é legível pelo join. */
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<TrainingFormValues | null>(null);

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTrainings(
        (data || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          thumbnail_url: t.thumbnail_url,
          video_url: t.video_url,
          duration: t.duration,
          category_id: t.category_id,
          faixa_minima: t.faixa_minima,
          is_active: t.is_active,
          created_by: t.created_by ?? null,
        })),
      );

      const { data: comAutor } = await (supabase as any).rpc('trainings_com_autor');
      if (comAutor) {
        const mapa: Record<string, string> = {};
        for (const linha of comAutor as any[]) {
          if (linha.created_by && linha.autor_nome) mapa[linha.created_by] = linha.autor_nome;
        }
        setAutores(mapa);
      }
    } catch (error) {
      console.error('Error fetching trainings:', error);
      toast.error('Erro ao carregar treinamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (training: Training) => {
    setEditingTraining({
      id: training.id,
      title: training.title,
      description: training.description || '',
      thumbnail_url: training.thumbnail_url || '',
      video_url: training.video_url || '',
      duration: training.duration || '',
      category_id: training.category_id || '',
      faixa_minima: training.faixa_minima,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este treinamento?')) return;
    try {
      const { error } = await supabase.from('trainings').delete().eq('id', id);
      if (error) throw error;
      toast.success('Treinamento excluído');
      fetchTrainings();
    } catch (error) {
      toast.error('Erro ao excluir treinamento');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('trainings')
        .update({ is_active: !isActive })
        .eq('id', id);
      if (error) throw error;
      fetchTrainings();
    } catch (error) {
      toast.error('Erro ao atualizar treinamento');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Treinamentos</h1>
          <p className="text-muted-foreground">
            Gerenciar cursos e treinamentos — inclusive os publicados por membros faixa marrom
            ou preta
          </p>
        </div>
        <Button
          className="bg-gold hover:bg-gold/90 text-black"
          onClick={() => {
            setEditingTraining(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Treinamento
        </Button>
      </div>

      <TrainingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        training={editingTraining}
        onSaved={fetchTrainings}
        modo="admin"
      />

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
                  <TableHead>Treinamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Publicado por</TableHead>
                  <TableHead>Faixa mínima</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainings.map((training) => (
                  <TableRow key={training.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {training.thumbnail_url && (
                          <img
                            src={training.thumbnail_url}
                            alt={training.title}
                            className="w-16 h-10 object-cover rounded"
                          />
                        )}
                        <p className="font-medium">{training.title}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categorias.find((c) => c.id === training.category_id)?.nome ||
                          'Sem categoria'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {/* Sem created_by = publicado pela equipe, antes da coluna existir. */}
                      {training.created_by ? (
                        <span className="text-sm">
                          {autores[training.created_by] || 'Membro'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Equipe</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {FAIXA_INFO[training.faixa_minima]?.nome || training.faixa_minima}
                      </Badge>
                    </TableCell>
                    <TableCell>{training.duration || '-'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={training.is_active}
                        onCheckedChange={() => handleToggleActive(training.id, training.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(training)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(training.id)}>
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
