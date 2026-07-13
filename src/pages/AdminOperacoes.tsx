import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ClipboardList,
  Users,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  Video,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  working_hours: Record<string, string> | null;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  assigned_to: string | null;
  lead_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  name: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  attendant: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  attendant: 'Atendente',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task: <ClipboardList className="w-4 h-4" />,
  call: <Phone className="w-4 h-4" />,
  meeting: <Video className="w-4 h-4" />,
  follow_up: <UserCheck className="w-4 h-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  task: 'Tarefa',
  call: 'Ligacao',
  meeting: 'Reuniao',
  follow_up: 'Follow-up',
};

const TYPE_COLORS: Record<string, string> = {
  task: 'bg-blue-500/20 text-blue-400',
  call: 'bg-yellow-500/20 text-yellow-400',
  meeting: 'bg-purple-500/20 text-purple-400',
  follow_up: 'bg-green-500/20 text-green-400',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getDueDateBadge(dueDate: string | null) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (dueDay < today) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Atrasada</Badge>;
  }
  if (dueDay.getTime() === today.getTime()) {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Hoje</Badge>;
  }
  return <Badge className="bg-muted text-muted-foreground text-xs">{due.toLocaleDateString('pt-BR')}</Badge>;
}

function getWeekDates(offset: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1 + offset * 7); // Monday
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminOperacoes() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Team dialog
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', phone: '', role: 'attendant' });

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', type: 'task', assigned_to: '', lead_id: '', due_date: '' });

  // Task filters
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  // Calendar
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarMember, setCalendarMember] = useState('all');

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [membersRes, tasksRes, leadsRes] = await Promise.all([
      (supabase as any).from('team_members').select('*').order('created_at', { ascending: true }),
      (supabase as any).from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('crm_leads').select('id, name').limit(200),
    ]);
    if (membersRes.data) setMembers(membersRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Team handlers ──────────────────────────────────────────────────────

  const openAddMember = () => {
    setEditingMember(null);
    setMemberForm({ name: '', email: '', phone: '', role: 'attendant' });
    setMemberDialogOpen(true);
  };

  const openEditMember = (m: TeamMember) => {
    setEditingMember(m);
    setMemberForm({ name: m.name, email: m.email || '', phone: m.phone || '', role: m.role });
    setMemberDialogOpen(true);
  };

  const saveMember = async () => {
    if (!memberForm.name.trim()) {
      toast.error('Nome e obrigatorio');
      return;
    }
    if (editingMember) {
      const { error } = await (supabase as any)
        .from('team_members')
        .update({ name: memberForm.name, email: memberForm.email || null, phone: memberForm.phone || null, role: memberForm.role })
        .eq('id', editingMember.id);
      if (error) { toast.error('Erro ao atualizar membro'); return; }
      toast.success('Membro atualizado!');
    } else {
      const { error } = await (supabase as any)
        .from('team_members')
        .insert({ name: memberForm.name, email: memberForm.email || null, phone: memberForm.phone || null, role: memberForm.role });
      if (error) { toast.error('Erro ao criar membro'); return; }
      toast.success('Membro adicionado!');
    }
    setMemberDialogOpen(false);
    fetchAll();
  };

  const toggleMemberActive = async (m: TeamMember) => {
    await (supabase as any).from('team_members').update({ is_active: !m.is_active }).eq('id', m.id);
    toast.success(m.is_active ? 'Membro desativado' : 'Membro ativado');
    fetchAll();
  };

  const deleteMember = async (id: string) => {
    await (supabase as any).from('team_members').delete().eq('id', id);
    toast.success('Membro removido');
    setDeleteConfirm(null);
    fetchAll();
  };

  // ─── Task handlers ──────────────────────────────────────────────────────

  const openAddTask = () => {
    setTaskForm({ title: '', description: '', type: 'task', assigned_to: '', lead_id: '', due_date: '' });
    setTaskDialogOpen(true);
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error('Titulo e obrigatorio');
      return;
    }
    const payload: any = {
      title: taskForm.title,
      description: taskForm.description || null,
      type: taskForm.type,
      assigned_to: taskForm.assigned_to || null,
      lead_id: taskForm.lead_id || null,
      due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
    };
    const { error } = await (supabase as any).from('tasks').insert(payload);
    if (error) { toast.error('Erro ao criar tarefa'); return; }
    toast.success('Tarefa criada!');
    setTaskDialogOpen(false);
    fetchAll();
  };

  const markTaskDone = async (t: Task) => {
    const newStatus = t.status === 'done' ? 'pending' : 'done';
    await (supabase as any)
      .from('tasks')
      .update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', t.id);
    toast.success(newStatus === 'done' ? 'Tarefa concluida!' : 'Tarefa reaberta');
    fetchAll();
  };

  const deleteTask = async (id: string) => {
    await (supabase as any).from('tasks').delete().eq('id', id);
    toast.success('Tarefa removida');
    fetchAll();
  };

  // ─── Computed ───────────────────────────────────────────────────────────

  const activeMembers = members.filter((m) => m.is_active);
  const membersByRole = {
    admin: members.filter((m) => m.role === 'admin').length,
    manager: members.filter((m) => m.role === 'manager').length,
    attendant: members.filter((m) => m.role === 'attendant').length,
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterAssignee !== 'all' && t.assigned_to !== filterAssignee) return false;
      return true;
    });
  }, [tasks, filterType, filterStatus, filterAssignee]);

  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const completedToday = tasks.filter((t) => t.status === 'done' && t.completed_at && t.completed_at.startsWith(todayStr)).length;
  const overdueTasks = tasks.filter((t) => {
    if (t.status !== 'pending' || !t.due_date) return false;
    return new Date(t.due_date) < new Date(new Date().toISOString().split('T')[0]);
  }).length;

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const calendarTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.due_date) return false;
      if (calendarMember !== 'all' && t.assigned_to !== calendarMember) return false;
      const d = new Date(t.due_date);
      return d >= weekDates[0] && d <= new Date(weekDates[6].getTime() + 86400000);
    });
  }, [tasks, weekDates, calendarMember]);

  const getMemberName = (id: string | null) => {
    if (!id) return 'Sem responsavel';
    return members.find((m) => m.id === id)?.name || 'Desconhecido';
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Operacoes & Time
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie equipe, tarefas e agenda</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="equipe" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="equipe" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Equipe
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Tarefas
          </TabsTrigger>
          <TabsTrigger value="calendario" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Calendario
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════ EQUIPE TAB ══════════════════════════ */}
        <TabsContent value="equipe" className="mt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{members.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            {(['admin', 'manager', 'attendant'] as const).map((role) => (
              <Card key={role} className="border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{membersByRole[role]}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}s</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add button */}
          <div className="flex justify-end">
            <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddMember}>
                  <Plus className="w-4 h-4 mr-2" /> Novo Membro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingMember ? 'Editar Membro' : 'Novo Membro'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
                    <Input value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                    <Input value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Telefone</label>
                    <Input value={memberForm.phone} onChange={(e) => setMemberForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Cargo</label>
                    <Select value={memberForm.role} onValueChange={(v) => setMemberForm((f) => ({ ...f, role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="attendant">Atendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={saveMember}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Members grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {members.map((m) => (
              <Card key={m.id} className={`border-border ${!m.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        getInitials(m.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{m.name}</p>
                        <Badge className={`text-xs ${ROLE_COLORS[m.role] || ROLE_COLORS.attendant}`}>
                          {ROLE_LABELS[m.role] || m.role}
                        </Badge>
                      </div>
                      {m.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Mail className="w-3 h-3" /> {m.email}
                        </p>
                      )}
                      {m.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {m.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Switch checked={m.is_active} onCheckedChange={() => toggleMemberActive(m)} />
                      <span className="text-xs text-muted-foreground">{m.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMember(m)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Dialog open={deleteConfirm === m.id} onOpenChange={(open) => setDeleteConfirm(open ? m.id : null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirmar exclusao</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground py-2">Tem certeza que deseja remover <strong>{m.name}</strong>?</p>
                          <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                            <Button variant="destructive" onClick={() => deleteMember(m.id)}>Remover</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {members.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Nenhum membro cadastrado. Clique em "Novo Membro" para comecar.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════ TAREFAS TAB ═════════════════════════ */}
        <TabsContent value="tarefas" className="mt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-xl font-bold text-foreground">{pendingTasks}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-xl font-bold text-foreground">{completedToday}</p>
                  <p className="text-xs text-muted-foreground">Concluidas hoje</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-xl font-bold text-foreground">{overdueTasks}</p>
                  <p className="text-xs text-muted-foreground">Atrasadas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters + Add */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="task">Tarefa</SelectItem>
                <SelectItem value="call">Ligacao</SelectItem>
                <SelectItem value="meeting">Reuniao</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="done">Concluida</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Responsavel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {activeMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddTask}>
                    <Plus className="w-4 h-4 mr-2" /> Nova Tarefa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Tarefa</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Titulo *</label>
                      <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titulo da tarefa" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Descricao</label>
                      <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descricao..." rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Tipo</label>
                        <Select value={taskForm.type} onValueChange={(v) => setTaskForm((f) => ({ ...f, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="task">Tarefa</SelectItem>
                            <SelectItem value="call">Ligacao</SelectItem>
                            <SelectItem value="meeting">Reuniao</SelectItem>
                            <SelectItem value="follow_up">Follow-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Responsavel</label>
                        <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm((f) => ({ ...f, assigned_to: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {activeMembers.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Lead (opcional)</label>
                        <Select value={taskForm.lead_id} onValueChange={(v) => setTaskForm((f) => ({ ...f, lead_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {leads.map((l) => (
                              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Data limite</label>
                        <Input type="datetime-local" value={taskForm.due_date} onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button onClick={saveTask}>Criar Tarefa</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Task list */}
          <div className="space-y-2">
            {filteredTasks.map((t) => (
              <Card key={t.id} className={`border-border ${t.status === 'done' ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 flex-shrink-0 ${t.status === 'done' ? 'text-green-400' : 'text-muted-foreground'}`}
                    onClick={() => markTaskDone(t)}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium text-foreground ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</p>
                      <Badge className={`text-xs ${TYPE_COLORS[t.type] || ''}`}>
                        <span className="flex items-center gap-1">{TYPE_ICONS[t.type]} {TYPE_LABELS[t.type] || t.type}</span>
                      </Badge>
                      {getDueDateBadge(t.due_date)}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {getMemberName(t.assigned_to)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0" onClick={() => deleteTask(t.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma tarefa encontrada.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════════════ CALENDARIO TAB ══════════════════════ */}
        <TabsContent value="calendario" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                {weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - {weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <Select value={calendarMember} onValueChange={setCalendarMember}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar membro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos membros</SelectItem>
                {activeMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {weekDates.map((day) => {
              const dayStr = day.toISOString().split('T')[0];
              const dayTasks = calendarTasks.filter((t) => t.due_date && t.due_date.startsWith(dayStr));
              const isToday = dayStr === todayStr;
              return (
                <Card key={dayStr} className={`border-border ${isToday ? 'border-primary/40 bg-primary/5' : ''}`}>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className={`font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {DAY_NAMES[day.getDay()]}
                      </span>
                      <span className="text-muted-foreground font-normal">
                        {day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      {isToday && <Badge className="bg-primary/20 text-primary text-xs">Hoje</Badge>}
                      {dayTasks.length > 0 && (
                        <Badge variant="secondary" className="text-xs ml-auto">{dayTasks.length}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {dayTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem tarefas</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              t.type === 'meeting' ? 'bg-purple-400' :
                              t.type === 'call' ? 'bg-yellow-400' :
                              t.type === 'follow_up' ? 'bg-green-400' :
                              'bg-blue-400'
                            }`} />
                            <span className="text-sm text-foreground flex-1 truncate">{t.title}</span>
                            <span className="text-xs text-muted-foreground">{getMemberName(t.assigned_to)}</span>
                            <Badge className={`text-xs ${TYPE_COLORS[t.type] || ''}`}>
                              {TYPE_LABELS[t.type] || t.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
