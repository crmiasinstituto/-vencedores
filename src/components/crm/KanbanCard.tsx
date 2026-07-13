import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Phone, Clock, Edit, Trash2, Instagram, MessageSquare, User, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WhatsAppChat } from './WhatsAppChat';
import { CallButton } from '@/components/calls/CallButton';
import { ProfilePic } from './ProfilePic';

interface CRMBoard {
  id: string;
  name: string;
}

interface CRMLead {
  id: string;
  name: string;
  whatsapp: string;
  instagram?: string;
  instagram_profile_pic_url?: string;
  whatsapp_profile_pic_url?: string;
  notes?: string;
  tags?: string[];
  lead_score: number;
  scheduled_call_at?: string;
  priority: string;
  created_at: string;
  first_contact_at?: string;
  source?: string;
  board_id?: string;
  onboarding_completed_at?: string | null;
  // Flags de engagement (vem via view crm_leads_engagement, populada no KanbanBoard)
  last_email_opened_at?: string | null;
  last_email_clicked_at?: string | null;
  email_open_count?: number | null;
  email_click_count?: number | null;
  // Onboarding em andamento (lead tem token mas não terminou — derivado)
  perfil_profissional?: string | null;
  maturidade_ia?: string | null;
  expectativa_mc?: string | null;
}

interface KanbanCardProps {
  lead: CRMLead;
  onEdit: (lead: CRMLead) => void;
  onDelete: (lead: CRMLead) => void;
  onMoveToBoard?: (lead: CRMLead, targetBoard: CRMBoard) => void;
  availableBoards?: CRMBoard[];
}

const priorityConfig: Record<string, { gradient: string; border: string; badge: string; glow: string }> = {
  urgent: {
    gradient: 'from-red-500/5 to-transparent',
    border: 'border-l-red-500',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    glow: 'hover:shadow-red-500/10',
  },
  high: {
    gradient: 'from-orange-500/5 to-transparent',
    border: 'border-l-orange-500',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    glow: 'hover:shadow-orange-500/10',
  },
  medium: {
    gradient: 'from-yellow-500/5 to-transparent',
    border: 'border-l-amber-500',
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    glow: 'hover:shadow-yellow-500/10',
  },
  low: {
    gradient: 'from-muted/5 to-transparent',
    border: 'border-l-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
    glow: 'hover:shadow-muted/10',
  },
};

export const KanbanCard: React.FC<KanbanCardProps> = ({ lead, onEdit, onDelete, onMoveToBoard, availableBoards }) => {
  const [showChat, setShowChat] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasScheduledCall = lead.scheduled_call_at && 
    new Date(lead.scheduled_call_at) > new Date();

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const config = priorityConfig[lead.priority] || priorityConfig.low;
  const scorePercent = Math.min(lead.lead_score, 100);

  // Lead Temperature calculation
  const getLeadTemperature = (): { icon: string; label: string; color: string } => {
    const hasRecentActivity = (() => {
      const created = new Date(lead.created_at);
      const daysSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation < 7;
    })();
    const isHighPriority = lead.priority === 'urgent' || lead.priority === 'high';
    const isMediumPriority = lead.priority === 'medium';

    if (lead.lead_score >= 70 || (isHighPriority && hasScheduledCall && hasRecentActivity)) {
      return { icon: '\uD83D\uDD25', label: 'Hot', color: 'bg-red-500/15 text-red-400 border-red-500/30' };
    }
    if (lead.lead_score >= 40 || (isMediumPriority && hasRecentActivity)) {
      return { icon: '\uD83D\uDFE1', label: 'Warm', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' };
    }
    return { icon: '\uD83D\uDD35', label: 'Cold', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  };

  const temperature = getLeadTemperature();

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      className={`
        bg-gradient-to-br ${config.gradient} bg-card rounded-lg p-3 shadow-md 
        border border-border border-l-[3px] ${config.border}
        cursor-grab active:cursor-grabbing
        hover:shadow-lg ${config.glow} hover:border-primary/30 transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-2xl ring-2 ring-primary' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
      <ProfilePic
            src={lead.instagram_profile_pic_url || lead.whatsapp_profile_pic_url}
            name={lead.name}
            size={10}
          />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-foreground text-sm truncate">{lead.name}</h4>
            <span className="flex-shrink-0 text-xs" title={`${temperature.label} lead`}>{temperature.icon}</span>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-green-500 hover:text-green-400 hover:underline flex items-center gap-1 text-xs"
            >
              <Phone className="w-3 h-3" /> {formatPhone(lead.whatsapp)}
            </a>
            <span className="text-[10px] text-muted-foreground" title={lead.first_contact_at && lead.first_contact_at !== lead.created_at ? `Primeiro contato: ${formatDistanceToNow(new Date(lead.first_contact_at), { addSuffix: true, locale: ptBR })}` : undefined}>
              {formatDistanceToNow(new Date(lead.first_contact_at || lead.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Instagram */}
      {lead.instagram && (
        <a
          href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 mb-2"
        >
          <Instagram className="w-3 h-3" />
          @{lead.instagram.replace('@', '')}
        </a>
      )}

      {/* Engagement badges: email aberto, clicou, onboarding em andamento, concluído */}
      {(lead.onboarding_completed_at || lead.last_email_clicked_at || lead.last_email_opened_at ||
        (!lead.onboarding_completed_at && (lead.perfil_profissional || lead.maturidade_ia || lead.expectativa_mc))) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.onboarding_completed_at ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              title={`Onboarding concluído ${formatDistanceToNow(new Date(lead.onboarding_completed_at), { addSuffix: true, locale: ptBR })}`}
            >
              ✓ Onboarding
            </Badge>
          ) : (lead.perfil_profissional || lead.maturidade_ia || lead.expectativa_mc) ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-amber-500/40 bg-amber-500/10 text-amber-300"
              title="Lead começou o onboarding mas não terminou"
            >
              ⏳ Onboarding
            </Badge>
          ) : null}
          {lead.last_email_clicked_at && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
              title={`Clicou em link ${formatDistanceToNow(new Date(lead.last_email_clicked_at), { addSuffix: true, locale: ptBR })} (${lead.email_click_count || 1}x)`}
            >
              🖱 Clicou
            </Badge>
          )}
          {lead.last_email_opened_at && !lead.last_email_clicked_at && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-blue-500/40 bg-blue-500/10 text-blue-300"
              title={`Email aberto ${formatDistanceToNow(new Date(lead.last_email_opened_at), { addSuffix: true, locale: ptBR })} (${lead.email_open_count || 1}x)`}
            >
              📬 Abriu
            </Badge>
          )}
        </div>
      )}

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.slice(0, 2).map((tag, i) => (
            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {lead.tags.length > 2 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{lead.tags.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Call agendada */}
      {hasScheduledCall && (
        <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-md">
          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-medium">
            <Clock className="w-3 h-3 animate-pulse" />
            Call: {format(new Date(lead.scheduled_call_at!), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
      )}

      {/* Notas */}
      {lead.notes && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2">
          <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <p className="line-clamp-2">{lead.notes}</p>
        </div>
      )}

      {/* Source badge */}
      {lead.source && (
        <div className="mb-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-muted-foreground">
            {lead.source === 'vhs_popup' ? '📣 VHS Popup' : lead.source === 'checkout_vhs' ? '💳 Checkout' : lead.source === 'manual' ? '✍️ Manual' : lead.source === 'webhook' ? '🔗 Webhook' : lead.source}
          </Badge>
        </div>
      )}

      {/* Lead Score Bar */}
      {lead.lead_score > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-muted-foreground">Score</span>
            <span className="text-[10px] font-bold text-primary">⭐ {lead.lead_score}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <Badge className={`text-[10px] ${config.badge}`}>
          {lead.priority === 'urgent' ? '🔥' : lead.priority === 'high' ? '⚡' : ''}
          {lead.priority}
        </Badge>
        <div className="flex gap-1">
          <CallButton phoneNumber={lead.whatsapp} leadId={lead.id} size="icon" />
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6 hover:bg-green-500/10 text-green-500"
            onClick={(e) => {
              e.stopPropagation();
              setShowChat(true);
            }}
          >
            <MessageSquare className="w-3 h-3" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6 hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(lead);
            }}
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-destructive/10 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(lead);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
          {onMoveToBoard && availableBoards && availableBoards.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 hover:bg-blue-500/10 text-blue-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {availableBoards.map((board) => (
                  <DropdownMenuItem
                    key={board.id}
                    onClick={() => onMoveToBoard(lead, board)}
                  >
                    Mover para {board.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {showChat && (
        <WhatsAppChat
          leadId={lead.id}
          leadName={lead.name}
          leadPhone={lead.whatsapp}
          leadProfilePic={lead.instagram_profile_pic_url}
          onClose={() => setShowChat(false)}
        />
      )}
    </motion.div>
  );
};