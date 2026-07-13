import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as LucideIcons from 'lucide-react';

interface CRMBoard {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  is_active?: boolean;
  sort_order?: number;
}

interface BoardTabsProps {
  boards: CRMBoard[];
  activeBoard: string;
  onBoardChange: (slug: string) => void;
  onAddBoard: () => void;
  onEditBoard: (board: CRMBoard) => void;
}

export const BoardTabs: React.FC<BoardTabsProps> = ({
  boards,
  activeBoard,
  onBoardChange,
  onAddBoard,
  onEditBoard
}) => {
  const getIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName.charAt(0).toUpperCase() + iconName.slice(1)] || LucideIcons.Briefcase;
    return IconComponent;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-primary/20">
      {boards.map((board) => {
        const Icon = getIcon(board.icon);
        const isActive = activeBoard === board.slug;
        
        return (
          <motion.div
            key={board.id}
            role="button"
            tabIndex={0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onBoardChange(board.slug)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onBoardChange(board.slug);
              }
            }}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200 whitespace-nowrap group cursor-pointer select-none
              ${isActive
                ? 'text-carbon shadow-lg'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
            style={isActive ? { backgroundColor: board.color } : undefined}
          >
            <Icon className="w-4 h-4" />
            {board.name}

            {/* Botão de configurações (visível no hover) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditBoard(board);
              }}
              className={`
                opacity-0 group-hover:opacity-100 transition-opacity
                ml-1 p-1 rounded hover:bg-black/10
                ${isActive ? 'text-carbon/70' : 'text-muted-foreground'}
              `}
            >
              <Settings className="w-3 h-3" />
            </button>
          </motion.div>
        );
      })}
      
      {/* Botão adicionar board */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddBoard}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:text-primary"
      >
        <Plus className="w-4 h-4" />
        Novo Quadro
      </Button>
    </div>
  );
};
