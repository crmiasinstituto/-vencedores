import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Save, Zap, Info, Kanban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Trigger } from '@/hooks/useUazapiAgents';

interface Props {
  items: Trigger[];
  agentId: string;
  loading: boolean;
  onSave: (item: Partial<Trigger>, id?: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onRefresh: () => void;
}

const OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'starts_with', label: 'Começa com' },
];

const emptyTrigger: Partial<Trigger> = {
  active: true, type: 'agent', ignoreGroups: true, priority: 1,
  wordsToStart: '', responseDelay_seconds: 5,
  lead_field: '', lead_operator: 'equals', lead_value: '',
};

export function AgentTriggersTab({ items, agentId, loading, onSave, onDelete, onRefresh }: Props) {
  const [editing, setEditing] = useState<Partial<Trigger> | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [crmColumns, setCrmColumns] = useState<{ id: string; name: string; boardName: string }[]>([]);

  useEffect(() => {
    supabase.from('crm_columns').select('id, name, board_id, crm_boards(name)').then(({ data }) => {
      if (data) setCrmColumns(data.map((c: any) => ({ id: c.id, name: c.name, boardName: c.crm_boards?.name || '' })));
    });
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    await onSave({ ...editing, agent_id: agentId }, editId || undefined);
    setEditing(null);
    setEditId(null);
    onRefresh();
  };

  const startEdit = (item?: Trigger) => {
    setEditing(item ? { ...item } : { ...emptyTrigger, agent_id: agentId });
    setEditId(item?.id || null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4" /> Gatilhos</h3>
        <Button size="sm" variant="outline" onClick={() => startEdit()}>
          <Plus className="w-4 h-4 mr-1" /> Novo Gatilho
        </Button>
      </div>

      {editing && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
                <Label className="text-sm">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.ignoreGroups} onCheckedChange={v => setEditing({ ...editing, ignoreGroups: v })} />
                <Label className="text-sm">Ignorar Grupos</Label>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <Label className="text-sm">Palavras-chave de ativação</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-[200px] text-xs">Separe por | (pipe). Ex: oi|olá|quero saber mais</TooltipContent>
                </Tooltip>
              </div>
              <Input className="mt-1" value={editing.wordsToStart || ''} onChange={e => setEditing({ ...editing, wordsToStart: e.target.value })} placeholder="oi|olá|quero saber mais" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Prioridade</Label>
                <Input type="number" className="mt-1" value={editing.priority} onChange={e => setEditing({ ...editing, priority: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-sm">Delay de Resposta (s)</Label>
                <Input type="number" className="mt-1" value={editing.responseDelay_seconds} onChange={e => setEditing({ ...editing, responseDelay_seconds: Number(e.target.value) })} />
              </div>
            </div>

            {/* Lead field filter */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Filtro por campo do Lead (opcional)</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Campo</Label>
                  <Input className="mt-0.5 h-8 text-xs" value={editing.lead_field || ''} onChange={e => setEditing({ ...editing, lead_field: e.target.value })} placeholder="lead_status" />
                </div>
                <div>
                  <Label className="text-[10px]">Operador</Label>
                  <Select value={editing.lead_operator || 'equals'} onValueChange={v => setEditing({ ...editing, lead_operator: v })}>
                    <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Valor</Label>
                  <Input className="mt-0.5 h-8 text-xs" value={editing.lead_value || ''} onChange={e => setEditing({ ...editing, lead_value: e.target.value })} placeholder="novo" />
                </div>
              </div>
            </div>

            {/* CRM Kanban column trigger */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Kanban className="w-3 h-3" /> Ativar por coluna do CRM</p>
              <Select value={(editing as any).crm_column_id || 'none'} onValueChange={v => setEditing({ ...editing, lead_field: 'crm_column_id', lead_operator: 'equals', lead_value: v === 'none' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione uma coluna..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {crmColumns.map(c => <SelectItem key={c.id} value={c.id}>{c.boardName} → {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <Card key={item.id} className="group cursor-pointer" onClick={() => startEdit(item)}>
            <CardContent className="py-3 flex items-center gap-3">
              <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.wordsToStart || 'Sem palavras-chave'}</p>
                <p className="text-xs text-muted-foreground">
                  Prioridade: {item.priority} • Delay: {item.responseDelay_seconds}s
                  {item.lead_field && ` • ${item.lead_field} ${item.lead_operator} ${item.lead_value}`}
                </p>
              </div>
              <Badge variant={item.active ? 'default' : 'secondary'} className="text-[10px]">{item.active ? 'Ativo' : 'Inativo'}</Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onDelete(item.id).then(onRefresh); }}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && !editing && (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum gatilho configurado. Defina quando o agente deve ser ativado.</p>
        )}
      </div>
    </div>
  );
}
