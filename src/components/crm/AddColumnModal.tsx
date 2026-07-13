import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CRMColumn {
  id?: string;
  name: string;
  color: string;
  is_final_stage: boolean;
  sort_order?: number;
}

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  column?: CRMColumn | null;
  onSave: (column: Partial<CRMColumn>) => Promise<void>;
  mode: 'add' | 'edit';
}

const COLORS = [
  '#6B7280', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', 
  '#14B8A6', '#10B981', '#EF4444', '#6366F1', '#84CC16'
];

export const AddColumnModal: React.FC<AddColumnModalProps> = ({
  isOpen,
  onClose,
  column,
  onSave,
  mode
}) => {
  const [formData, setFormData] = useState<Partial<CRMColumn>>({
    name: '',
    color: COLORS[0],
    is_final_stage: false
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && column) {
      setFormData(column);
    } else {
      setFormData({
        name: '',
        color: COLORS[0],
        is_final_stage: false
      });
    }
  }, [column, mode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      toast.success(mode === 'add' ? 'Coluna criada!' : 'Coluna atualizada!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Nova Coluna' : 'Editar Coluna'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <Label htmlFor="name">Nome da Coluna *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Qualificado"
            />
          </div>

          {/* Cor */}
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full transition-all ${
                    formData.color === color 
                      ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Estágio Final */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <Label htmlFor="final_stage">Estágio Final</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marque se esta é uma coluna de conclusão (Fechado, Perdido, etc.)
              </p>
            </div>
            <Switch
              id="final_stage"
              checked={formData.is_final_stage}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_final_stage: checked }))}
            />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: formData.color }}
            />
            <span className="font-medium">{formData.name || 'Nome da coluna'}</span>
            {formData.is_final_stage && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Final</span>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Salvando...' : mode === 'add' ? 'Criar Coluna' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
