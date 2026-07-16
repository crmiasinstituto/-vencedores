import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VideoUpload } from '@/maisvencedores/components/shared/VideoUpload';
import { ImageUpload } from '@/maisvencedores/components/shared/ImageUpload';
import type { Faixa } from '@/maisvencedores/types/member';
import { FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';
import { useCategorias } from '@/maisvencedores/hooks/useCatalogo';


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
}

const emptyTraining = {
  title: '',
  description: '',
  thumbnail_url: '',
  video_url: '',
  duration: '',
  category_id: '',
  faixa_minima: 'branco' as Faixa
};

export default function AdminTrainings() {
  const { categorias, criarCategoria } = useCategorias();

  // Agrupa preservando a ordem que veio do banco (ordem da coluna `ordem`), então "Áreas da
  // vida" aparece antes de "Formações" e "Negócios" — que é a ordem em que o ecossistema
  // pensa sobre si mesmo.
  const gruposDeCategoria = Array.from(
    categorias.reduce((mapa, c) => {
      const g = c.grupo || 'Outras';
      mapa.set(g, [...(mapa.get(g) || []), c]);
      return mapa;
    }, new Map<string, typeof categorias>()),
  );

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [formData, setFormData] = useState(emptyTraining);
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'upload'>('url');

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
      
      // Map to our interface
      const mapped: Training[] = (data || []).map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        thumbnail_url: t.thumbnail_url,
        video_url: t.video_url,
        duration: t.duration,
        category_id: t.category_id,
        faixa_minima: t.faixa_minima,
        is_active: t.is_active,
      }));
      
      setTrainings(mapped);
    } catch (error) {
      console.error('Error fetching trainings:', error);
      toast.error('Erro ao carregar treinamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (training: Training) => {
    setEditingTraining(training);
    setFormData({
      title: training.title,
      description: training.description || '',
      thumbnail_url: training.thumbnail_url || '',
      video_url: training.video_url || '',
      duration: training.duration || '',
      category_id: training.category_id || '',
      faixa_minima: training.faixa_minima
    });
    // Detect if it's an uploaded video or URL
    if (training.video_url?.includes('supabase') || training.video_url?.includes('storage')) {
      setVideoInputMode('upload');
    } else {
      setVideoInputMode('url');
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);

      const trainingData = {
        title: formData.title,
        description: formData.description || null,
        thumbnail_url: formData.thumbnail_url || null,
        video_url: formData.video_url || null,
        duration: formData.duration || null,
        category_id: formData.category_id || null,
        faixa_minima: formData.faixa_minima
      };

      if (editingTraining) {
        const { error } = await supabase
          .from('trainings')
          .update(trainingData)
          .eq('id', editingTraining.id);
        if (error) throw error;
        toast.success('Treinamento atualizado!');
      } else {
        const { error } = await supabase.from('trainings').insert(trainingData);
        if (error) throw error;
        toast.success('Treinamento criado!');
      }

      setDialogOpen(false);
      setEditingTraining(null);
      setFormData(emptyTraining);
      fetchTrainings();
    } catch (error) {
      console.error('Error saving training:', error);
      toast.error('Erro ao salvar treinamento');
    } finally {
      setSaving(false);
    }
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
          <p className="text-muted-foreground">Gerenciar cursos e treinamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTraining(null);
            setFormData(emptyTraining);
            setVideoInputMode('url');
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gold hover:bg-gold/90 text-black">
              <Plus className="mr-2 h-4 w-4" />
              Novo Treinamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTraining ? 'Editar Treinamento' : 'Novo Treinamento'}
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
                  <Label>Categoria *</Label>
                  {/* Vem da tabela training_categories, não de lista no código: era um enum do
                      Postgres com 6 valores e enum só muda por migration. Agora são 18 e dá
                      pra criar mais aqui mesmo. As categorias são agrupadas (Áreas da vida /
                      Formações / Negócios) porque 18 numa lista solta vira rolagem cega. */}
                  <Select
                    value={formData.category_id || 'nova'}
                    onValueChange={async (value) => {
                      if (value === 'nova') {
                        const nome = window.prompt('Nome da nova categoria');
                        if (!nome) return;
                        const criada = await criarCategoria(nome);
                        if (criada) {
                          setFormData({ ...formData, category_id: criada.id });
                          toast.success(`Categoria "${criada.nome}" criada`);
                        } else {
                          toast.error('Não foi possível criar a categoria');
                        }
                        return;
                      }
                      setFormData({ ...formData, category_id: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {gruposDeCategoria.map(([grupo, itens]) => (
                        <SelectGroup key={grupo}>
                          <SelectLabel>{grupo}</SelectLabel>
                          {itens.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                      <SelectGroup>
                        <SelectItem value="nova">+ Criar nova categoria…</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Faixa mínima *</Label>
                  {/* Aqui é NÍVEL (da faixa X pra cima), diferente do evento, que é lista de
                      faixas permitidas. Treinamento de Master não deve sumir pra quem chegou
                      na Trainer. */}
                  <Select
                    value={formData.faixa_minima}
                    onValueChange={(value: Faixa) => setFormData({ ...formData, faixa_minima: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FAIXAS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FAIXA_INFO[f].nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Video Input - Toggle between URL and Upload */}
              <div className="space-y-2">
                <Label>Vídeo</Label>
                <Tabs value={videoInputMode} onValueChange={(v) => setVideoInputMode(v as 'url' | 'upload')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url">URL Externa</TabsTrigger>
                    <TabsTrigger value="upload">Fazer Upload</TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="mt-2">
                    <Input
                      value={formData.video_url}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2">
                    <VideoUpload
                      value={formData.video_url}
                      onChange={(url) => setFormData({ ...formData, video_url: url })}
                      folder="trainings"
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Thumbnail */}
              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <ImageUpload
                  value={formData.thumbnail_url}
                  onChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
                  folder="trainings"
                  placeholder="Thumbnail do treinamento"
                />
              </div>

              <div className="space-y-2">
                <Label>Duração</Label>
                <Input
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="Ex: 45 min"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="bg-gold hover:bg-gold/90 text-black">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTraining ? 'Salvar' : 'Criar'}
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
                  <TableHead>Treinamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Plano</TableHead>
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
                        {categorias.find((c) => c.id === training.category_id)?.nome || 'Sem categoria'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{FAIXA_INFO[training.faixa_minima]?.nome || training.faixa_minima}</Badge>
                    </TableCell>
                    <TableCell>{training.duration || '-'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={training.is_active}
                        onCheckedChange={() => handleToggleActive(training.id, training.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(training)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(training.id)}
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
