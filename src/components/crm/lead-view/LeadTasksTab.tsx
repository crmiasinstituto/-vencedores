import React, { useState, useEffect } from 'react';
import { Plus, Check, Clock, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadTasksTabProps {
  leadId: string;
  leadName: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

export const LeadTasksTab: React.FC<LeadTasksTabProps> = ({ leadId, leadName }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [leadId]);

  const loadTasks = async () => {
    setIsLoading(true);
    // Use crm_activities as task storage with activity_type = 'task'
    const { data } = await supabase
      .from('crm_activities')
      .select('id, description, activity_type, metadata, created_at')
      .eq('lead_id', leadId)
      .eq('activity_type', 'task')
      .order('created_at', { ascending: false });

    if (data) {
      setTasks(data.map(d => ({
        id: d.id,
        title: d.description,
        completed: (d.metadata as any)?.completed === true,
        created_at: d.created_at || '',
      })));
    }
    setIsLoading(false);
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const { error } = await supabase.from('crm_activities').insert({
      lead_id: leadId,
      activity_type: 'task',
      description: newTask.trim(),
      metadata: { completed: false },
    });
    if (!error) {
      setNewTask('');
      loadTasks();
      toast.success('Tarefa adicionada!');
    }
  };

  const toggleTask = async (task: Task) => {
    await supabase.from('crm_activities').update({
      metadata: { completed: !task.completed },
    }).eq('id', task.id);
    loadTasks();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from('crm_activities').delete().eq('id', taskId);
    loadTasks();
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const doneTasks = tasks.filter(t => t.completed);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Add task */}
      <div className="flex gap-2">
        <Input
          placeholder="Nova tarefa..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          className="flex-1"
        />
        <Button size="sm" onClick={addTask} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>

      <ScrollArea className="h-[50vh]">
        <div className="space-y-1.5 pr-2">
          {pendingTasks.length === 0 && doneTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma tarefa</p>
            </div>
          )}

          {pendingTasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors group">
              <button
                onClick={() => toggleTask(task)}
                className="w-5 h-5 rounded border-2 border-muted-foreground/30 hover:border-primary flex items-center justify-center transition-colors flex-shrink-0"
              />
              <span className="text-sm flex-1">{task.title}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: ptBR })}
              </span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => deleteTask(task.id)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}

          {doneTasks.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground font-medium mt-4 mb-1">Concluídas ({doneTasks.length})</p>
              {doneTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 opacity-50 group">
                  <button
                    onClick={() => toggleTask(task)}
                    className="w-5 h-5 rounded bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center flex-shrink-0"
                  >
                    <Check className="w-3 h-3 text-green-500" />
                  </button>
                  <span className="text-sm flex-1 line-through">{task.title}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => deleteTask(task.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
