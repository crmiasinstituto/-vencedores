import React, { useState, useEffect } from 'react';
import { Briefcase, Rocket, Users, Bot, Zap, Target, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CRMBoard {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  sort_order?: number;
  is_active?: boolean;
}

interface AddBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  board?: CRMBoard | null;
  onSave: (board: Partial<CRMBoard>) => Promise<void>;
  mode: 'add' | 'edit';
}

const COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', 
  '#3B82F6', '#EC4899', '#14B8A6', '#6366F1', '#84CC16'
];

const ICONS = [
  { name: 'briefcase', icon: Briefcase },
  { name: 'rocket', icon: Rocket },
  { name: 'users', icon: Users },
  { name: 'bot', icon: Bot },
  { name: 'zap', icon: Zap },
  { name: 'target', icon: Target },
  { name: 'star', icon: Star },
];

export const AddBoardModal: React.FC<AddBoardModalProps> = ({
  isOpen,
  onClose,
  board,
  onSave,
  mode
}) => {
  const [formData, setFormData] = useState<Partial<CRMBoard>>({
    name: '',
    description: '',
    color: COLORS[0],
    icon: 'briefcase'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && board) {
      setFormData(board);
    } else {
      setFormData({
        name: '',
        description: '',
        color: COLORS[0],
        icon: 'briefcase'
      });
    }
  }, [board, mode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      // Gerar slug a partir do nome
      const slug = formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      await onSave({
        ...formData,
        slug
      });
      toast.success(mode === 'add' ? 'Quadro criado!' : 'Quadro atualizado!');
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
            {mode === 'add' ? 'Novo Quadro' : 'Editar Quadro'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <Label htmlFor="name">Nome do Quadro *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Imersão VHS"
            />
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição opcional..."
              rows={2}
            />
          </div>

          {/* Cor */}
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-2">
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

          {/* Ícone */}
          <div>
            <Label>Ícone</Label>
            <div className="flex gap-2 mt-2">
              {ICONS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, icon: name }))}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    formData.icon === name 
                      ? 'bg-primary text-primary-foreground ring-2 ring-offset-2 ring-primary' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-carbon font-medium"
              style={{ backgroundColor: formData.color }}
            >
              {ICONS.find(i => i.name === formData.icon)?.icon && 
                React.createElement(ICONS.find(i => i.name === formData.icon)!.icon, { className: 'w-4 h-4' })
              }
              {formData.name || 'Nome do Quadro'}
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Salvando...' : mode === 'add' ? 'Criar Quadro' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
