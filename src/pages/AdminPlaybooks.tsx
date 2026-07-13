import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, GripVertical, BookOpen, Save, ChevronDown, ChevronUp, Star, StarOff, Edit2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { PlaybookPhase, Playbook } from '@/hooks/useSalesCoach';

interface EditablePhase extends PlaybookPhase {
  isExpanded?: boolean;
}

interface PlaybookForm {
  name: string;
  description: string;
  phases: EditablePhase[];
  is_default: boolean;
}

const emptyPhase = (order: number): EditablePhase => ({
  id: `fase_${Date.now()}_${order}`,
  name: '',
  order,
  checklist: [''],
  rules: [''],
  isExpanded: true,
});

const emptyForm: PlaybookForm = {
  name: '',
  description: '',
  phases: [emptyPhase(1)],
  is_default: false,
};

export default function AdminPlaybooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PlaybookForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadPlaybooks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales_playbooks')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) {
      setPlaybooks(data.map(p => ({
        ...p,
        phases: (p.phases as any as PlaybookPhase[]) || [],
      })));
    }
    setLoading(false);
  };

  useEffect(() => { loadPlaybooks(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (pb: Playbook) => {
    setEditingId(pb.id);
    setForm({
      name: pb.name,
      description: pb.description || '',
      phases: pb.phases.map(p => ({ ...p, isExpanded: false })),
      is_default: pb.is_default,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (form.phases.length === 0) { toast.error('Adicione pelo menos uma fase'); return; }

    setSaving(true);
    const phasesClean = form.phases.map(({ isExpanded, ...p }) => ({
      ...p,
      checklist: p.checklist.filter(c => c.trim()),
      rules: p.rules.filter(r => r.trim()),
    }));

    // If setting as default, unset others
    if (form.is_default) {
      await supabase.from('sales_playbooks').update({ is_default: false }).neq('id', editingId || '');
    }

    if (editingId) {
      const { error } = await supabase.from('sales_playbooks').update({
        name: form.name,
        description: form.description || null,
        phases: phasesClean as any,
        is_default: form.is_default,
      }).eq('id', editingId);
      if (error) toast.error('Erro ao salvar'); else toast.success('Playbook atualizado!');
    } else {
      const { error } = await supabase.from('sales_playbooks').insert({
        name: form.name,
        description: form.description || null,
        phases: phasesClean as any,
        is_default: form.is_default,
      });
      if (error) toast.error('Erro ao criar'); else toast.success('Playbook criado!');
    }

    setSaving(false);
    setShowForm(false);
    loadPlaybooks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este playbook?')) return;
    await supabase.from('sales_playbooks').delete().eq('id', id);
    toast.success('Playbook excluído');
    loadPlaybooks();
  };

  // Phase helpers
  const addPhase = () => {
    setForm(prev => ({
      ...prev,
      phases: [...prev.phases, emptyPhase(prev.phases.length + 1)],
    }));
  };

  const removePhase = (idx: number) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i + 1 })),
    }));
  };

  const updatePhase = (idx: number, updates: Partial<EditablePhase>) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === idx ? { ...p, ...updates } : p),
    }));
  };

  const addChecklistItem = (phaseIdx: number) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === phaseIdx ? { ...p, checklist: [...p.checklist, ''] } : p),
    }));
  };

  const updateChecklistItem = (phaseIdx: number, itemIdx: number, value: string) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === phaseIdx ? {
        ...p,
        checklist: p.checklist.map((c, j) => j === itemIdx ? value : c),
      } : p),
    }));
  };

  const removeChecklistItem = (phaseIdx: number, itemIdx: number) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === phaseIdx ? {
        ...p,
        checklist: p.checklist.filter((_, j) => j !== itemIdx),
      } : p),
    }));
  };

  const addRule = (phaseIdx: number) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === phaseIdx ? { ...p, rules: [...p.rules, ''] } : p),
    }));
  };

  const updateRule = (phaseIdx: number, ruleIdx: number, value: string) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === phaseIdx ? {
        ...p,
        rules: p.rules.map((r, j) => j === ruleIdx ? value : r),
      } : p),
    }));
  };

  const removeRule = (phaseIdx: number, ruleIdx: number) => {
    setForm(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === phaseIdx ? {
        ...p,
        rules: p.rules.filter((_, j) => j !== ruleIdx),
      } : p),
    }));
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Playbooks de Vendas</h1>
          <p className="text-sm text-muted-foreground">Configure scripts e fases para o Sales Coach em tempo real</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Playbook
        </Button>
      </div>

      {/* Playbook List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : playbooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum playbook configurado</p>
            <p className="text-xs mt-1">Crie seu primeiro playbook de vendas para usar o Sales Coach</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {playbooks.map(pb => (
            <Card key={pb.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{pb.name}</h3>
                      {pb.is_default && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                    </div>
                    {pb.description && <p className="text-sm text-muted-foreground mb-2">{pb.description}</p>}
                    <div className="flex gap-2 flex-wrap">
                      {pb.phases.map(phase => (
                        <Badge key={phase.id} variant="outline" className="text-xs gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {phase.name} ({phase.checklist.length} items)
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(pb)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(pb.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Playbook' : 'Novo Playbook'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <Input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Cold Call B2B"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição breve..."
                  />
                </div>
                <Button
                  variant={form.is_default ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setForm(prev => ({ ...prev, is_default: !prev.is_default }))}
                  title="Definir como padrão"
                >
                  {form.is_default ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Phases */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fases do Playbook</label>
                <Button size="sm" variant="outline" onClick={addPhase} className="text-xs gap-1">
                  <Plus className="w-3 h-3" /> Fase
                </Button>
              </div>

              <div className="space-y-3">
                {form.phases.map((phase, pi) => (
                  <Card key={phase.id} className="border-border/50">
                    <CardHeader className="py-2 px-3 cursor-pointer" onClick={() => updatePhase(pi, { isExpanded: !phase.isExpanded })}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Fase {pi + 1}</span>
                          {phase.name && <span className="text-sm font-medium">{phase.name}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{phase.checklist.filter(c => c.trim()).length} checks</Badge>
                          <Badge variant="outline" className="text-[10px]">{phase.rules.filter(r => r.trim()).length} regras</Badge>
                          {form.phases.length > 1 && (
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); removePhase(pi); }}>
                              <X className="w-3 h-3 text-destructive" />
                            </Button>
                          )}
                          {phase.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </CardHeader>
                    {phase.isExpanded && (
                      <CardContent className="pt-0 px-3 pb-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Nome da Fase *</label>
                            <Input
                              value={phase.name}
                              onChange={e => updatePhase(pi, { name: e.target.value })}
                              placeholder="Ex: Abertura"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">ID (slug)</label>
                            <Input
                              value={phase.id}
                              onChange={e => updatePhase(pi, { id: e.target.value })}
                              placeholder="Ex: abertura"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Checklist */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Checklist
                            </label>
                            <Button size="sm" variant="ghost" onClick={() => addChecklistItem(pi)} className="h-5 text-[10px] px-1">
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {phase.checklist.map((item, ci) => (
                              <div key={ci} className="flex gap-1">
                                <Input
                                  value={item}
                                  onChange={e => updateChecklistItem(pi, ci, e.target.value)}
                                  placeholder="Ex: Chamar o lead pelo nome"
                                  className="h-7 text-xs"
                                />
                                {phase.checklist.length > 1 && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeChecklistItem(pi, ci)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Rules */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-400" /> Regras (violações geram alerta)
                            </label>
                            <Button size="sm" variant="ghost" onClick={() => addRule(pi)} className="h-5 text-[10px] px-1">
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {phase.rules.map((rule, ri) => (
                              <div key={ri} className="flex gap-1">
                                <Input
                                  value={rule}
                                  onChange={e => updateRule(pi, ri, e.target.value)}
                                  placeholder="Ex: NÃO falar de preço nesta fase"
                                  className="h-7 text-xs border-red-500/20"
                                />
                                {phase.rules.length > 1 && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeRule(pi, ri)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Playbook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
