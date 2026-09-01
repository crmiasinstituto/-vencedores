import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VideoUpload } from '@/maisvencedores/components/shared/VideoUpload';
import { ImageUpload } from '@/maisvencedores/components/shared/ImageUpload';
import type { Faixa } from '@/maisvencedores/types/member';
import { FAIXAS, FAIXA_INFO } from '@/maisvencedores/types/member';
import { useCategorias } from '@/maisvencedores/hooks/useCatalogo';

export interface TrainingFormValues {
  id?: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  duration: string;
  category_id: string;
  faixa_minima: Faixa;
}

export const treinamentoVazio: TrainingFormValues = {
  title: '',
  description: '',
  thumbnail_url: '',
  video_url: '',
  duration: '',
  category_id: '',
  faixa_minima: 'branco',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preenchido = edição; null = criação. */
  training: TrainingFormValues | null;
  onSaved: () => void;
  /**
   * 'admin' libera criar categoria na hora. 'membro' não: com 22 pessoas publicando,
   * categoria criada no impulso vira catálogo duplicado ("Vendas", "vendas", "Venda").
   */
  modo?: 'admin' | 'membro';
}

export function TrainingFormDialog({
  open, onOpenChange, training, onSaved, modo = 'admin',
}: Props) {
  const { categorias, criarCategoria } = useCategorias();
  const [formData, setFormData] = useState<TrainingFormValues>(treinamentoVazio);
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'upload'>('url');
  const [saving, setSaving] = useState(false);

  const editando = Boolean(training?.id);
  const ehMembro = modo === 'membro';

  // Agrupa preservando a ordem que veio do banco (ordem da coluna `ordem`), então "Áreas da
  // vida" aparece antes de "Formações" e "Negócios".
  const gruposDeCategoria = Array.from(
    categorias.reduce((mapa, c) => {
      const g = c.grupo || 'Outras';
      mapa.set(g, [...(mapa.get(g) || []), c]);
      return mapa;
    }, new Map<string, typeof categorias>()),
  );

  useEffect(() => {
    if (!open) return;
    const base = training || treinamentoVazio;
    setFormData(base);
    const url = base.video_url || '';
    setVideoInputMode(url.includes('supabase') || url.includes('storage') ? 'upload' : 'url');
  }, [open, training]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id) {
      toast.error('Escolha uma categoria');
      return;
    }
    try {
      setSaving(true);

      const payload = {
        title: formData.title,
        description: formData.description || null,
        thumbnail_url: formData.thumbnail_url || null,
        video_url: formData.video_url || null,
        duration: formData.duration || null,
        category_id: formData.category_id || null,
        faixa_minima: formData.faixa_minima,
      };

      if (training?.id) {
        const { error } = await supabase.from('trainings').update(payload).eq('id', training.id);
        if (error) throw error;
        toast.success('Treinamento atualizado!');
      } else {
        // created_by tem default auth.uid() no banco, e a policy de INSERT exige que ele
        // seja o próprio usuário — mandar explícito evita depender do default.
        // O cast é porque a coluna é nova e o types.ts gerado ainda não a conhece.
        const { data: sessao } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from('trainings')
          .insert({ ...payload, created_by: sessao.user?.id });
        if (error) throw error;
        toast.success(ehMembro ? 'Treinamento publicado!' : 'Treinamento criado!');
      }

      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      console.error('Erro ao salvar treinamento:', error);
      // 42501 = RLS barrou. Acontece quando a faixa não alcança marrom.
      if (error?.code === '42501') {
        toast.error('Sua faixa ainda não permite publicar treinamentos.');
      } else {
        toast.error(error?.message || 'Erro ao salvar treinamento');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar Treinamento' : 'Novo Treinamento'}</DialogTitle>
          {ehMembro && !editando && (
            <DialogDescription>
              Fica visível para todo mundo da faixa que você escolher, para cima.
            </DialogDescription>
          )}
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
                  Postgres com 6 valores e enum só muda por migration. Hoje são 18. */}
              <Select
                value={formData.category_id || (ehMembro ? '' : 'nova')}
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
                  {!ehMembro && (
                    <SelectGroup>
                      <SelectItem value="nova">+ Criar nova categoria…</SelectItem>
                    </SelectGroup>
                  )}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-gold hover:bg-gold/90 text-black">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editando ? 'Salvar' : ehMembro ? 'Publicar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
