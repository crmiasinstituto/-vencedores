import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Link as LinkIcon, Wrench, FileText, Video } from 'lucide-react';

export interface SupportMaterial {
  type: 'link' | 'tool' | 'doc' | 'video';
  title: string;
  url: string;
  description?: string;
}

interface Props {
  description: string;
  materials: SupportMaterial[];
  onDescriptionChange: (value: string) => void;
  onMaterialsChange: (value: SupportMaterial[]) => void;
}

const TYPE_ICONS: Record<string, any> = {
  link: LinkIcon, tool: Wrench, doc: FileText, video: Video,
};

const TYPE_LABELS: Record<string, string> = {
  link: 'Link', tool: 'Ferramenta', doc: 'Documento', video: 'Video',
};

export default function SupportMaterialsEditor({
  description, materials, onDescriptionChange, onMaterialsChange,
}: Props) {
  const update = (i: number, patch: Partial<SupportMaterial>) => {
    onMaterialsChange(materials.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  };
  const remove = (i: number) => onMaterialsChange(materials.filter((_, idx) => idx !== i));
  const add = () => onMaterialsChange([...materials, { type: 'link', title: '', url: '' }]);

  return (
    <div className="space-y-4 border-t border-border pt-4 mt-2">
      <div>
        <Label className="text-sm font-semibold">Descritivo de apoio</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Aparece na pagina da aula/reuniao como contexto pros alunos.
        </p>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="O que o aluno vai aprender, como se preparar, etc."
          className="min-h-[80px]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <Label className="text-sm font-semibold">Materiais de apoio</Label>
            <p className="text-xs text-muted-foreground">
              Links, ferramentas, documentos - tudo que ajuda o aluno.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>

        {materials.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-muted-foreground/20 rounded-lg">
            Nenhum material adicionado
          </div>
        ) : (
          <div className="space-y-2">
            {materials.map((m, i) => {
              const Icon = TYPE_ICONS[m.type] || LinkIcon;
              return (
                <div key={i} className="flex gap-2 items-start bg-muted/30 p-3 rounded-lg">
                  <div className="flex-shrink-0 pt-1">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-[120px_1fr] gap-2">
                      <Select value={m.type} onValueChange={(v) => update(i, { type: v as any })}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={m.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                        placeholder="Nome (ex: N8N, ChatGPT, PDF do slide)"
                        className="h-9"
                      />
                    </div>
                    <Input
                      value={m.url}
                      onChange={(e) => update(i, { url: e.target.value })}
                      placeholder="https://..."
                      className="h-9 text-xs"
                    />
                    <Input
                      value={m.description || ''}
                      onChange={(e) => update(i, { description: e.target.value })}
                      placeholder="Descricao curta (opcional)"
                      className="h-9 text-xs"
                    />
                  </div>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="text-red-400 h-9 px-2"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
