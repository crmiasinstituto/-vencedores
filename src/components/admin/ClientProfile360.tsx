import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Phone, Instagram, Star, AlertTriangle, TrendingUp, GraduationCap } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  instagram?: string;
  stage: 'prospect' | 'lead_qualificado' | 'aluno' | 'elite';
  source: string;
  education_level?: string;
  onboarding_completed?: boolean;
  onboarding_step?: number;
  last_interaction?: string;
  has_overdue?: boolean;
  products?: string[];
  raw: any;
}

interface ClientProfile360Props {
  contact: Contact;
  onClose: () => void;
}

export function ClientProfile360({ contact, onClose }: ClientProfile360Props) {
  const daysSinceInteraction = contact.last_interaction
    ? Math.floor((Date.now() - new Date(contact.last_interaction).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const stageBadge = () => {
    const config = {
      prospect: { label: 'Prospect', className: 'bg-muted text-muted-foreground' },
      lead_qualificado: { label: 'Lead Qualificado', className: 'bg-blue-500/20 text-blue-400' },
      aluno: { label: 'Aluno', className: 'bg-green-500/20 text-green-400' },
      elite: { label: 'Elite', className: 'bg-purple-500/20 text-purple-400' },
    };
    const c = config[contact.stage];
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-foreground">{contact.name}</span>
            {stageBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Contact Info */}
          <div className="flex flex-wrap gap-3 text-sm">
            {contact.whatsapp && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Phone className="w-3 h-3" /> {contact.whatsapp}
              </span>
            )}
            {contact.email && (
              <span className="text-muted-foreground">{contact.email}</span>
            )}
            {contact.instagram && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Instagram className="w-3 h-3" /> {contact.instagram}
              </span>
            )}
          </div>

          {/* Alerts */}
          <div className="flex flex-wrap gap-2">
            {contact.education_level === 'avancado' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs">
                <Star className="w-3 h-3" /> Oportunidade MBAI
              </div>
            )}
            {daysSinceInteraction !== null && daysSinceInteraction > 10 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                <AlertTriangle className="w-3 h-3" /> Sem interação há {daysSinceInteraction}d
              </div>
            )}
            {contact.has_overdue && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                <AlertTriangle className="w-3 h-3" /> Inadimplente
              </div>
            )}
            {contact.onboarding_completed && contact.education_level === 'avancado' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                <TrendingUp className="w-3 h-3" /> Pronto para Upsell
              </div>
            )}
          </div>

          {/* Onboarding Progress */}
          {contact.onboarding_step !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Progresso do Onboarding</p>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${((contact.onboarding_step || 0) / 6) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{contact.onboarding_step}/6 etapas</p>
            </div>
          )}

          {/* Products */}
          {contact.products && contact.products.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Produtos Adquiridos</p>
              <div className="flex flex-wrap gap-2">
                {contact.products.map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <GraduationCap className="w-3 h-3 mr-1" /> {p}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Raw Data Summary */}
          <div className="text-xs text-muted-foreground">
            Origem: {contact.source} • ID: {contact.id.slice(0, 8)}...
          </div>

          {/* Action */}
          {contact.whatsapp && (
            <Button
              className="w-full gap-2"
              onClick={() => window.open(`https://wa.me/55${contact.whatsapp.replace(/\D/g, '')}`, '_blank')}
            >
              <MessageSquare className="w-4 h-4" />
              Abrir Conversa WhatsApp
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
