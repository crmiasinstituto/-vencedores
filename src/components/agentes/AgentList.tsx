import { Bot, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Agent } from '@/hooks/useUazapiAgents';

const providerColors: Record<string, string> = {
  openai: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  anthropic: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  gemini: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  deepseek: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
};

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google',
  deepseek: 'DeepSeek',
};

interface AgentListProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggleActive?: (id: string, currentActive: boolean) => void;
}

export function AgentList({ agents, selectedId, onSelect, onAdd, onDelete, onToggleActive }: AgentListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <Button onClick={onAdd} className="w-full gap-2" size="sm">
          <Plus className="w-4 h-4" /> Novo Agente
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {agents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum agente configurado.<br />Clique em "Novo Agente" para começar.
            </p>
          )}
          {agents.map((agent) => {
            const isActive = agent.active !== false;
            return (
              <button
                key={agent.id}
                onClick={() => onSelect(agent.id)}
                className={cn(
                  'w-full text-left rounded-lg p-3 border transition-all group',
                  'bg-gradient-to-br',
                  isActive
                    ? (providerColors[agent.provider] || 'from-muted/50 to-muted/30 border-border')
                    : 'from-muted/20 to-muted/10 border-border/50 opacity-60',
                  selectedId === agent.id && 'ring-2 ring-primary shadow-md',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="w-4 h-4 shrink-0 text-foreground/70" />
                    <span className="text-sm font-medium truncate">{agent.name || 'Sem nome'}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {onToggleActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); onToggleActive(agent.id, isActive); }}
                        title={isActive ? 'Desativar agente' : 'Ativar agente'}
                      >
                        {isActive ? <Power className="w-3 h-3 text-green-500" /> : <PowerOff className="w-3 h-3 text-destructive" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {providerLabels[agent.provider] || agent.provider}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{agent.model}</span>
                  <div className={cn('w-2 h-2 rounded-full ml-auto', isActive ? 'bg-green-500' : 'bg-destructive/60')} />
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
