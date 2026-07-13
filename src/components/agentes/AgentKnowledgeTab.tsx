import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, BookOpen, Save, FileText, Link as LinkIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Knowledge } from '@/hooks/useUazapiAgents';

interface Props {
  items: Knowledge[];
  loading: boolean;
  onSave: (item: Partial<Knowledge>, id?: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onRefresh: () => void;
}

const emptyKnowledge: Partial<Knowledge> = { active: true, tittle: '', content: '', fileType: '' };

export function AgentKnowledgeTab({ items, loading, onSave, onDelete, onRefresh }: Props) {
  const [editing, setEditing] = useState<Partial<Knowledge> | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editing) return;
    await onSave(editing, editId || undefined);
    setEditing(null);
    setEditId(null);
    onRefresh();
  };

  const handleEdit = (item: Knowledge) => {
    setEditing({ active: item.active, tittle: item.tittle, content: item.content, fileType: item.fileType });
    setEditId(item.id);
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium flex items-center gap-2"><BookOpen className="w-4 h-4" /> Base de Conhecimento</h3>
        <Button size="sm" variant="outline" onClick={() => { setEditing({ ...emptyKnowledge }); setEditId(null); }}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {editing && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label className="text-sm">Título</Label>
              <Input className="mt-1" value={editing.tittle || ''} onChange={e => setEditing({ ...editing, tittle: e.target.value })} placeholder="Ex: FAQ do produto" />
            </div>
            <div>
              <Label className="text-sm">Conteúdo (texto, URL ou base64)</Label>
              <Textarea className="mt-1 font-mono text-xs" rows={8} value={editing.content || ''} onChange={e => setEditing({ ...editing, content: e.target.value })} placeholder="Cole o texto, URL ou conteúdo base64..." />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-sm">Tipo de arquivo (opcional)</Label>
                <Select value={editing.fileType || 'auto'} onValueChange={v => setEditing({ ...editing, fileType: v === 'auto' ? '' : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Auto-detectar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detectar</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="txt">TXT</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
                <Label className="text-sm">Ativo</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={loading}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setEditId(null); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.id} className="group">
            <CardContent className="py-3 flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.tittle || 'Sem título'}</p>
                <p className="text-xs text-muted-foreground truncate">{(item.content || '').slice(0, 80)}</p>
              </div>
              <Badge variant={item.active ? 'default' : 'secondary'} className="text-[10px]">
                {item.active ? 'Ativo' : 'Inativo'}
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                <FileText className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && !editing && (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum conhecimento cadastrado. Adicione textos, URLs ou documentos para o agente consultar.</p>
        )}
      </div>
    </div>
  );
}
