import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, TrendingUp, Calendar, Target, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardTabs } from '@/components/crm/BoardTabs';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { ActivityFeed } from '@/components/crm/ActivityFeed';
import { CallReminderAlert } from '@/components/crm/CallReminderAlert';
import { AddBoardModal } from '@/components/crm/AddBoardModal';
import { LeadDetailModal } from '@/components/crm/LeadDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CRMBoard {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  sort_order?: number;
  is_active?: boolean;
}

interface CRMColumn {
  id: string;
  name: string;
}

interface CRMActivity {
  id: string;
  lead_id: string;
  board_id: string;
  activity_type: string;
  description: string;
  from_column_name?: string;
  to_column_name?: string;
  board_name?: string;
  metadata?: any;
  created_at: string;
}

interface BoardStats {
  total: number;
  captados: number;
  emContato: number;
  agendados: number;
  fechados: number;
}

const statCards = [
  { key: 'total' as const, label: 'Total Leads', icon: Users, gradient: 'from-primary/20 to-primary/5', iconBg: 'bg-primary/15', iconColor: 'text-primary', valueColor: 'text-primary' },
  { key: 'captados' as const, label: 'Captados', icon: Target, gradient: 'from-blue-500/20 to-blue-500/5', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-400', valueColor: 'text-blue-400' },
  { key: 'agendados' as const, label: 'Calls Agendadas', icon: Calendar, gradient: 'from-amber-500/20 to-amber-500/5', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-400', valueColor: 'text-amber-400' },
  { key: 'fechados' as const, label: 'Fechados', icon: TrendingUp, gradient: 'from-green-500/20 to-green-500/5', iconBg: 'bg-green-500/15', iconColor: 'text-green-400', valueColor: 'text-green-400' },
];

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const duration = 800;
    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(start + (value - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{display}</>;
}

const AdminCRM: React.FC = () => {
  const [boards, setBoards] = useState<CRMBoard[]>([]);
  const [activeBoard, setActiveBoard] = useState<string>('');
  const [activeBoardData, setActiveBoardData] = useState<CRMBoard | null>(null);
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [stats, setStats] = useState<BoardStats>({ total: 0, captados: 0, emContato: 0, agendados: 0, fechados: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [boardModalMode, setBoardModalMode] = useState<'add' | 'edit'>('add');
  const [selectedBoard, setSelectedBoard] = useState<CRMBoard | null>(null);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [autoOpenLead, setAutoOpenLead] = useState<any>(null);

  // Auto-open lead from URL params (e.g., after meeting ends)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openLeadId = params.get('openLead');
    if (openLeadId) {
      (async () => {
        const { data } = await supabase.from('crm_leads').select('*').eq('id', openLeadId).single();
        if (data) {
          setAutoOpenLead(data);
        }
      })();
      // Clean URL
      window.history.replaceState({}, '', '/admin/crm');
    }
  }, []);

  // Carregar boards
  const loadBoards = useCallback(async () => {
    const { data, error } = await supabase
      .from('crm_boards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Erro ao carregar boards:', error);
      toast.error('Erro ao carregar quadros');
      return;
    }

    setBoards(data || []);
    
    if (data && data.length > 0 && !activeBoard) {
      setActiveBoard(data[0].slug);
      setActiveBoardData(data[0]);
    }
  }, [activeBoard]);

  // Carregar colunas do board ativo
  const loadColumns = useCallback(async (boardId: string) => {
    const { data, error } = await supabase
      .from('crm_columns')
      .select('id, name')
      .eq('board_id', boardId)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setColumns(data);
    }
  }, []);

  // Carregar atividades recentes
  const loadActivities = useCallback(async (boardId?: string) => {
    let query = supabase
      .from('crm_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (boardId) {
      query = query.eq('board_id', boardId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setActivities(data);
    }
  }, []);

  // Carregar estatísticas
  const loadStats = useCallback(async (boardId: string) => {
    const { data: leads, error } = await supabase
      .from('crm_leads')
      .select('column_id, scheduled_call_at, crm_columns!inner(name, is_final_stage)')
      .eq('board_id', boardId);

    if (error || !leads) return;

    const statsData: BoardStats = {
      total: leads.length,
      captados: 0,
      emContato: 0,
      agendados: 0,
      fechados: 0
    };

    leads.forEach((lead: any) => {
      const columnName = lead.crm_columns?.name?.toLowerCase() || '';
      
      if (columnName.includes('captado')) statsData.captados++;
      else if (columnName.includes('contato')) statsData.emContato++;
      else if (columnName.includes('fechado')) statsData.fechados++;
      
      if (lead.scheduled_call_at && new Date(lead.scheduled_call_at) > new Date()) {
        statsData.agendados++;
      }
    });

    setStats(statsData);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadBoards();
      setIsLoading(false);
    };
    init();
  }, [loadBoards]);

  // Atualizar quando board muda
  useEffect(() => {
    if (activeBoard) {
      const board = boards.find(b => b.slug === activeBoard);
      if (board) {
        setActiveBoardData(board);
        loadColumns(board.id);
        loadActivities(board.id);
        loadStats(board.id);
      }
    }
  }, [activeBoard, boards, loadColumns, loadActivities, loadStats]);

  // Handlers
  const handleBoardChange = (slug: string) => {
    setActiveBoard(slug);
  };

  const handleAddBoard = () => {
    setSelectedBoard(null);
    setBoardModalMode('add');
    setBoardModalOpen(true);
  };

  const handleEditBoard = (board: CRMBoard) => {
    setSelectedBoard(board);
    setBoardModalMode('edit');
    setBoardModalOpen(true);
  };

  const handleSaveBoard = async (boardData: Partial<CRMBoard>) => {
    if (boardModalMode === 'add') {
      const maxSortOrder = Math.max(...boards.map(b => (b as any).sort_order || 0), 0);
      
      const { data, error } = await supabase
        .from('crm_boards')
        .insert({
          name: boardData.name,
          slug: boardData.slug,
          description: boardData.description,
          color: boardData.color,
          icon: boardData.icon,
          sort_order: maxSortOrder + 1,
          is_active: true
        } as any)
        .select()
        .single();

      if (error) throw error;

      const defaultColumns = [
        { name: 'Captado', color: '#6B7280', sort_order: 1, is_final_stage: false },
        { name: 'Primeiro Contato', color: '#3B82F6', sort_order: 2, is_final_stage: false },
        { name: 'Qualificado', color: '#8B5CF6', sort_order: 3, is_final_stage: false },
        { name: 'Call Agendada', color: '#F59E0B', sort_order: 4, is_final_stage: false },
        { name: 'Proposta Enviada', color: '#EC4899', sort_order: 5, is_final_stage: false },
        { name: 'Negociação', color: '#14B8A6', sort_order: 6, is_final_stage: false },
        { name: 'Fechado', color: '#10B981', sort_order: 7, is_final_stage: true },
        { name: 'Perdido', color: '#EF4444', sort_order: 8, is_final_stage: true },
      ];

      await supabase.from('crm_columns').insert(
        defaultColumns.map(col => ({
          ...col,
          board_id: data.id
        })) as any
      );

      setBoards(prev => [...prev, data]);
      setActiveBoard(data.slug);
    } else if (selectedBoard) {
      const { error } = await supabase
        .from('crm_boards')
        .update(boardData)
        .eq('id', selectedBoard.id);

      if (error) throw error;

      setBoards(prev => prev.map(b => 
        b.id === selectedBoard.id ? { ...b, ...boardData } : b
      ));
    }
  };

  const handleQuickAddLead = async (leadData: any) => {
    if (!activeBoardData) return;

    // Respect the board_id from leadData if explicitly set (user chose a different board)
    const targetBoardId = leadData.board_id || activeBoardData.id;
    const isDifferentBoard = targetBoardId !== activeBoardData.id;

    let targetColumnId = leadData.column_id;
    let targetColumnName: string | undefined;
    let targetBoardName = activeBoardData.name;

    if (isDifferentBoard) {
      // Fetch the first column of the target board
      const { data: targetColumns, error: colError } = await supabase
        .from('crm_columns')
        .select('id, name')
        .eq('board_id', targetBoardId)
        .order('sort_order', { ascending: true })
        .limit(1);

      if (colError || !targetColumns || targetColumns.length === 0) {
        toast.error('Nenhuma coluna encontrada no board de destino');
        return;
      }

      targetColumnId = targetColumns[0].id;
      targetColumnName = targetColumns[0].name;

      // Get the target board name for activity logging
      const targetBoard = boards.find(b => b.id === targetBoardId);
      if (targetBoard) {
        targetBoardName = targetBoard.name;
      }
    } else {
      // Same board: use the column_id from leadData or default to first column
      targetColumnId = leadData.column_id || columns[0]?.id;
      const targetColumn = columns.find(c => c.id === targetColumnId) || columns[0];
      if (!targetColumn) {
        toast.error('Nenhuma coluna encontrada');
        return;
      }
      targetColumnId = targetColumn.id;
      targetColumnName = targetColumn.name;
    }

    const { data, error } = await supabase
      .from('crm_leads')
      .insert({
        ...leadData,
        board_id: targetBoardId,
        column_id: targetColumnId
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('crm_activities').insert({
      lead_id: data.id,
      board_id: targetBoardId,
      activity_type: 'lead_created',
      description: `Lead ${leadData.name} criado manualmente`,
      to_column_name: targetColumnName,
      board_name: targetBoardName
    });

    toast.success('Lead adicionado!');
    loadStats(activeBoardData.id);
    loadActivities(activeBoardData.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">+ que Vencedores CRM</h1>
          <p className="text-sm text-muted-foreground">Gestão Comercial Kanban</p>
        </div>
        <Button onClick={() => setQuickAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      <div>
        {/* Board Tabs */}
        <div className="mb-6">
          <BoardTabs
            boards={boards}
            activeBoard={activeBoard}
            onBoardChange={handleBoardChange}
            onAddBoard={handleAddBoard}
            onEditBoard={handleEditBoard}
          />
        </div>

        {/* Stats Cards - Premium */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${stat.gradient} p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.valueColor} mt-1`}>
                    <AnimatedNumber value={stats[stat.key]} />
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
              {/* Subtle decorative element */}
              <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full ${stat.iconBg} opacity-30`} />
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {activeBoardData && (
              <KanbanBoard
                boardId={activeBoardData.id}
                boardName={activeBoardData.name}
                allBoards={boards.map(b => ({ id: b.id, name: b.name }))}
              />
            )}
          </div>
          <div className="lg:col-span-1">
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </div>

      <CallReminderAlert />

      <AddBoardModal
        isOpen={boardModalOpen}
        onClose={() => setBoardModalOpen(false)}
        board={selectedBoard}
        onSave={handleSaveBoard}
        mode={boardModalMode}
      />

      <LeadDetailModal
        isOpen={quickAddModalOpen}
        onClose={() => setQuickAddModalOpen(false)}
        lead={null}
        columns={columns}
        onSave={handleQuickAddLead}
        mode="add"
        defaultColumnId={columns[0]?.id}
        boards={boards}
        activeBoardId={activeBoardData?.id}
      />

      {/* Auto-open lead (e.g., after meeting ends) */}
      {autoOpenLead && (
        <LeadDetailModal
          isOpen={true}
          onClose={() => setAutoOpenLead(null)}
          lead={autoOpenLead}
          columns={columns}
          onSave={async () => {}}
          mode="edit"
        />
      )}
    </div>
  );
};

export default AdminCRM;
