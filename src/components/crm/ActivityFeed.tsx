import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, Edit, Phone, MessageSquare, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface ActivityFeedProps {
  activities: CRMActivity[];
  isLoading?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, isLoading }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'column_change': return ArrowRight;
      case 'lead_created': return Plus;
      case 'lead_edited': return Edit;
      case 'call_scheduled': return Phone;
      case 'note_added': return MessageSquare;
      default: return Clock;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'column_change': return 'text-blue-400 bg-blue-500/20';
      case 'lead_created': return 'text-green-400 bg-green-500/20';
      case 'lead_edited': return 'text-yellow-400 bg-yellow-500/20';
      case 'call_scheduled': return 'text-purple-400 bg-purple-500/20';
      case 'note_added': return 'text-pink-400 bg-pink-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Atividades Recentes
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        Atividades Recentes
      </h3>
      
      <ScrollArea className="h-64">
        <div className="space-y-3 pr-4">
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nenhuma atividade ainda
            </p>
          ) : (
            activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.activity_type);
              const colorClass = getActivityColor(activity.activity_type);
              
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-3 text-sm"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">
                      {activity.description}
                      {activity.activity_type === 'column_change' && activity.from_column_name && activity.to_column_name && (
                        <span className="text-muted-foreground">
                          {' '}de <span className="text-foreground font-medium">{activity.from_column_name}</span>
                          {' '}para <span className="text-foreground font-medium">{activity.to_column_name}</span>
                        </span>
                      )}
                    </p>
                    {activity.board_name && (
                      <span className="text-xs text-primary/70">
                        em {activity.board_name}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(activity.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
