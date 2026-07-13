import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Megaphone, X, ChevronUp, ChevronDown, Calendar, Clock,
  AlertCircle, CheckCircle2, Loader2, ExternalLink, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Initiative = {
  id: string;
  nome: string;
  data_evento: string | null;
  budget: number | null;
  ticket: number | null;
  status: string;
};

type ChecklistItem = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  deadline: string | null;
  prioridade: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'em_andamento' | 'feito' | 'bloqueado';
  responsavel: string | null;
};

const STATUS_CONFIG: Record<ChecklistItem['status'], { label: string; cls: string; Icon: any }> = {
  pendente: { label: 'Pendente', cls: 'text-muted-foreground', Icon: Clock },
  em_andamento: { label: 'Em andamento', cls: 'text-blue-600', Icon: Loader2 },
  feito: { label: 'Feito', cls: 'text-green-600', Icon: CheckCircle2 },
  bloqueado: { label: 'Bloqueado', cls: 'text-red-600', Icon: AlertCircle },
};

const PRIO_CONFIG = {
  alta: 'bg-red-50 text-red-700 border-red-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  baixa: 'bg-muted text-muted-foreground border-border',
};

export function ActiveInitiativeWidget() {
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: initData } = await supabase
        .from('marketing_initiatives')
        .select('id, nome, data_evento, budget, ticket, status')
        .eq('status', 'ativa')
        .order('data_evento', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (!initData) {
        setInitiative(null);
        setItems([]);
        return;
      }
      setInitiative(initData as Initiative);

      const { data: checklistData } = await supabase
        .from('marketing_initiative_checklist')
        .select('id, ordem, titulo, descricao, deadline, prioridade, status, responsavel')
        .eq('initiative_id', initData.id)
        .order('ordem');
      setItems((checklistData ?? []) as ChecklistItem[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Persistir dismissal por sessao
    if (sessionStorage.getItem('initiative_widget_dismissed') === '1') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('initiative_widget_dismissed', '1');
  };

  const toggleStatus = async (item: ChecklistItem) => {
    const nextStatus = item.status === 'feito' ? 'pendente' : 'feito';
    setUpdating(item.id);
    try {
      const { error } = await supabase
        .from('marketing_initiative_checklist')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      if (error) {
        toast.error('Erro: ' + error.message);
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)));
    } finally {
      setUpdating(null);
    }
  };

  if (dismissed || loading || !initiative) return null;

  const totalDone = items.filter((i) => i.status === 'feito').length;
  const totalItems = items.length;
  const progress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

  const daysToEvent = initiative.data_evento
    ? Math.max(0, Math.ceil((new Date(initiative.data_evento).getTime() - Date.now()) / 86400000))
    : null;

  const upcomingItems = items
    .filter((i) => i.status !== 'feito')
    .slice(0, 3);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-lg border-2 border-primary/40 bg-background shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 px-4 py-3 flex items-start gap-3">
          <Megaphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{initiative.nome}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {daysToEvent !== null && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {daysToEvent === 0 ? 'HOJE' : `${daysToEvent} dias`}
                </span>
              )}
              <span>{progress}% concluido</span>
              <span>{totalDone}/{totalItems} itens</span>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)} className="h-7 w-7 p-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        {expanded ? (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Budget R$ {initiative.budget?.toLocaleString('pt-BR')} · Meta {initiative.ticket} vendas
              </span>
              <Button size="sm" variant="ghost" onClick={load} className="h-6 px-2">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <div className="divide-y">
              {items.map((item) => {
                const cfg = STATUS_CONFIG[item.status];
                const Icon = cfg.Icon;
                const deadlineDate = item.deadline ? new Date(item.deadline) : null;
                const isPastDue = deadlineDate && deadlineDate < new Date() && item.status !== 'feito';
                return (
                  <div key={item.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleStatus(item)}
                        disabled={updating === item.id}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {updating === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Icon className={cn('h-4 w-4', cfg.cls)} />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn(
                            'text-sm font-medium',
                            item.status === 'feito' && 'line-through text-muted-foreground',
                          )}>
                            {item.ordem}. {item.titulo}
                          </p>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', PRIO_CONFIG[item.prioridade])}>
                            {item.prioridade}
                          </Badge>
                        </div>
                        {item.descricao && (
                          <p className="text-xs text-muted-foreground mt-1">{item.descricao}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                          {deadlineDate && (
                            <span className={cn(
                              'flex items-center gap-1',
                              isPastDue ? 'text-red-600 font-medium' : 'text-muted-foreground',
                            )}>
                              <Calendar className="h-3 w-3" />
                              {deadlineDate.toLocaleDateString('pt-BR')}
                              {isPastDue && ' · atrasado'}
                            </span>
                          )}
                          {item.responsavel && (
                            <span className="text-muted-foreground">· {item.responsavel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t bg-muted/20">
              <Button size="sm" variant="ghost" asChild className="w-full text-xs">
                <a
                  href={`docs/campanha-masterclass-09-06.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver doc completo da estrategia <ExternalLink className="h-3 w-3 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Proximas acoes:</p>
            {upcomingItems.length === 0 ? (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Tudo concluido
              </p>
            ) : (
              upcomingItems.map((item) => (
                <div key={item.id} className="text-xs flex items-start gap-2">
                  <span className="text-muted-foreground font-mono">#{item.ordem}</span>
                  <div className="flex-1">
                    <p className="font-medium">{item.titulo}</p>
                    {item.deadline && (
                      <p className="text-muted-foreground">
                        ate {new Date(item.deadline).toLocaleDateString('pt-BR')} · {item.responsavel}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
