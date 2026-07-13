import React from 'react';
import { Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { normalizePhoneBR, isValidPhoneBR, formatPhonePretty } from '@/lib/phone';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CRMBoard {
  id: string;
  name: string;
  slug: string;
}

interface LeadFormProps {
  formData: Partial<any>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<any>>>;
  columns: { id: string; name: string }[];
  newTag: string;
  setNewTag: (v: string) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isLoading: boolean;
  mode: 'edit' | 'add';
  boards?: CRMBoard[];
  onBoardChange?: (boardId: string) => void;
}

export const LeadForm: React.FC<LeadFormProps> = ({
  formData, setFormData, columns, newTag, setNewTag, addTag, removeTag, onSubmit, onClose, isLoading, mode, boards, onBoardChange
}) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" value={formData.name || ''} onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="Nome completo" />
      </div>
      <div>
        <Label htmlFor="whatsapp">WhatsApp *</Label>
        <Input
          id="whatsapp"
          value={formData.whatsapp || ''}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, whatsapp: e.target.value }))}
          onBlur={(e) => {
            const normalized = normalizePhoneBR(e.target.value);
            if (normalized && normalized !== e.target.value.replace(/\D/g, '')) {
              setFormData((prev: any) => ({ ...prev, whatsapp: normalized }));
            }
          }}
          placeholder="71999999999 (auto-formata pra 55+DDD+9+8 digitos)"
          className={
            formData.whatsapp && !isValidPhoneBR(formData.whatsapp)
              ? 'border-amber-500/40 focus-visible:ring-amber-500/30'
              : ''
          }
        />
        {formData.whatsapp && (
          <p className={`text-[11px] mt-1 flex items-center gap-1 ${
            isValidPhoneBR(formData.whatsapp) ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {isValidPhoneBR(formData.whatsapp) ? (
              <><CheckCircle2 className="w-3 h-3" /> {formatPhonePretty(formData.whatsapp)}</>
            ) : (
              <><AlertCircle className="w-3 h-3" /> Formato esperado: 55+DDD+9+8 digitos (13 ao total). Sai do campo pra auto-formatar.</>
            )}
          </p>
        )}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={formData.email || ''} onChange={(e) => setFormData((prev: any) => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" />
      </div>
      <div>
        <Label htmlFor="instagram">Instagram</Label>
        <Input id="instagram" value={formData.instagram || ''} onChange={(e) => setFormData((prev: any) => ({ ...prev, instagram: e.target.value }))} placeholder="@usuario" />
      </div>
    </div>

    <div>
      <Label htmlFor="company_name">Empresa</Label>
      <Input id="company_name" value={formData.company_name || ''} onChange={(e) => setFormData((prev: any) => ({ ...prev, company_name: e.target.value }))} placeholder="Nome da empresa" />
    </div>

    {boards && boards.length > 1 && (
      <div>
        <Label>Quadro (Kanban)</Label>
        <Select value={formData.board_id || ''} onValueChange={(value) => onBoardChange?.(value)}>
          <SelectTrigger><SelectValue placeholder="Selecione o quadro..." /></SelectTrigger>
          <SelectContent>
            {boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Etapa do Funil</Label>
        <Select value={formData.column_id} onValueChange={(value) => setFormData((prev: any) => ({ ...prev, column_id: value }))}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Prioridade</Label>
        <Select value={formData.priority} onValueChange={(value) => setFormData((prev: any) => ({ ...prev, priority: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente 🔥</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="scheduled_call_at">Call Agendada</Label>
        <Input id="scheduled_call_at" type="datetime-local" value={formData.scheduled_call_at || ''} onChange={(e) => setFormData((prev: any) => ({ ...prev, scheduled_call_at: e.target.value }))} />
      </div>
      <div>
        <Label htmlFor="potential_value">Valor Potencial (R$)</Label>
        <Input id="potential_value" type="number" value={formData.potential_value || ''} onChange={(e) => setFormData((prev: any) => ({ ...prev, potential_value: parseFloat(e.target.value) || undefined }))} placeholder="0,00" />
      </div>
    </div>

    <div>
      <Label>Tags</Label>
      <div className="flex gap-2 mb-2">
        <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nova tag..." onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
        <Button type="button" variant="outline" onClick={addTag}><Tag className="w-4 h-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {formData.tags?.map((tag: string, i: number) => (
          <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>{tag} ×</Badge>
        ))}
      </div>
    </div>

    <div>
      <Label htmlFor="lead_score">Lead Score</Label>
      <Input id="lead_score" type="number" min="0" max="100" value={formData.lead_score || 0} onChange={(e) => setFormData((prev: any) => ({ ...prev, lead_score: parseInt(e.target.value) || 0 }))} />
    </div>

    <div>
      <Label htmlFor="notes">Notas</Label>
      <Textarea id="notes" value={formData.notes || ''} onChange={(e) => setFormData((prev: any) => ({ ...prev, notes: e.target.value }))} placeholder="Observações sobre o lead..." rows={3} />
    </div>

    <div className="flex gap-3 pt-4">
      <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
      <Button type="submit" disabled={isLoading} className="flex-1">
        {isLoading ? 'Salvando...' : mode === 'add' ? 'Criar Lead' : 'Salvar'}
      </Button>
    </div>
  </form>
);
