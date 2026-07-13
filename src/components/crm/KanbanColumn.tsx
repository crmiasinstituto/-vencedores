import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Plus, MoreVertical, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KanbanCard } from './KanbanCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CRMColumn {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_final_stage: boolean;
}

interface CRMLead {
  id: string;
  name: string;
  whatsapp: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  notes?: string;
  tags?: string[];
  lead_score: number;
  scheduled_call_at?: string;
  priority: string;
  created_at: string;
  first_contact_at?: string;
  column_id: string;
}

interface CRMBoard {
  id: string;
  name: string;
}

interface KanbanColumnProps {
  column: CRMColumn;
  leads: CRMLead[];
  onAddLead: (columnId: string) => void;
  onEditLead: (lead: CRMLead) => void;
  onDeleteLead: (lead: CRMLead) => void;
  onEditColumn: (column: CRMColumn) => void;
  onDeleteColumn: (column: CRMColumn) => void;
  onMoveToBoard?: (lead: CRMLead, targetBoard: CRMBoard) => void;
  availableBoards?: CRMBoard[];
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  leads,
  onAddLead,
  onEditLead,
  onDeleteLead,
  onEditColumn,
  onDeleteColumn,
  onMoveToBoard,
  availableBoards
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const columnLeads = leads.filter(lead => lead.column_id === column.id);
  const leadIds = columnLeads.map(lead => lead.id);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-shrink-0 w-72"
    >
      <div
        ref={setNodeRef}
        className={`
          bg-muted/50 rounded-xl p-3 min-h-[500px] flex flex-col
          transition-all duration-200
          ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : ''}
        `}
      >
        {/* Header da coluna */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: column.color }}
            />
            <h3 className="font-semibold text-foreground text-sm">
              {column.name}
            </h3>
            <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
              {columnLeads.length}
            </span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditColumn(column)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar Coluna
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDeleteColumn(column)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Cards da coluna */}
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
          <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
            {columnLeads.map((lead) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                onEdit={onEditLead}
                onDelete={onDeleteLead}
                onMoveToBoard={onMoveToBoard}
                availableBoards={availableBoards}
              />
            ))}
          </SortableContext>
        </div>

        {/* Botão adicionar lead */}
        <Button
          variant="ghost"
          className="w-full mt-3 border-2 border-dashed border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
          onClick={() => onAddLead(column.id)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Lead
        </Button>
      </div>
    </motion.div>
  );
};
