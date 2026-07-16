import { Training, FAIXA_INFO } from '@/maisvencedores/types/member';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';
import { cn } from '@/lib/utils';
import { Lock, Play, Clock, CheckCircle } from 'lucide-react';
import { FaixaBadge } from './FaixaBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface TrainingCardProps {
  training: Training;
}

export function TrainingCard({ training }: TrainingCardProps) {
  const { alcanca } = useMembership();
  // Treinamento é degrau: quem passou da faixa mínima continua tendo acesso.
  const hasAccess = alcanca(training.faixaMinima);
  const isCompleted = training.progress === 100;

  return (
    <div className={cn(
      'group relative rounded-xl overflow-hidden bg-card/50 border transition-all duration-300',
      hasAccess 
        ? 'border-border/50 hover:border-gold/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)]' 
        : 'border-border/30 opacity-75'
    )}>
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={training.thumbnail} 
          alt={training.title}
          className={cn(
            'w-full h-full object-cover transition-transform duration-300',
            hasAccess && 'group-hover:scale-105'
          )}
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Lock/Play Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {!hasAccess ? (
            <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
          ) : (
            <div className={cn(
              'w-14 h-14 rounded-full bg-gold/90 flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-300',
              'shadow-[0_0_20px_rgba(212,175,55,0.5)]'
            )}>
              <Play className="w-6 h-6 text-navy-deep ml-1" />
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-white/90 bg-black/60 px-2 py-1 rounded">
          <Clock className="w-3 h-3" />
          {training.duration}
        </div>

        {/* Completed Badge */}
        {isCompleted && (
          <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-electric bg-electric/20 backdrop-blur px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Concluído
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Categoria e faixa mínima */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {training.categoryNome}
          </span>
          {/* Faixa branca é a porta de entrada: marcar "exige branca" não diz nada. */}
          {training.faixaMinima !== 'branco' && (
            <FaixaBadge faixa={training.faixaMinima} size="sm" />
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-gold transition-colors">
          {training.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {training.description}
        </p>

        {/* Progress or CTA */}
        {hasAccess ? (
          training.progress !== undefined && training.progress > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className="text-gold font-medium">{training.progress}%</span>
              </div>
              <Progress value={training.progress} className="h-1.5" />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full mt-2">
              Começar Agora
            </Button>
          )
        ) : (
          // Faixa não se compra, se conquista — então aqui não cabe CTA de upgrade. O que
          // ajuda é dizer o que falta fazer, e isso é a descrição da faixa mínima.
          <div className="text-center py-2 space-y-1">
            <p className="text-xs text-muted-foreground">
              A partir da faixa {FAIXA_INFO[training.faixaMinima].nome}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {FAIXA_INFO[training.faixaMinima].descricao}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
