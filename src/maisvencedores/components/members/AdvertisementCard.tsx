import { Advertisement } from '@/maisvencedores/types/member';
import { cn } from '@/lib/utils';
import { ExternalLink, Eye, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdvertisementCardProps {
  ad: Advertisement;
}

export function AdvertisementCard({ ad }: AdvertisementCardProps) {
  return (
    <div className={cn(
      'group relative rounded-xl overflow-hidden bg-card/50 border transition-all duration-300',
      ad.isPremium 
        ? 'border-gold/50 shadow-[0_0_20px_rgba(212,175,55,0.1)]' 
        : 'border-border/50 hover:border-gold/30'
    )}>
      {/* Premium Badge */}
      {ad.isPremium && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-gold text-navy-deep text-xs font-bold px-2 py-1 rounded-full">
          <Crown className="w-3 h-3" />
          DESTAQUE
        </div>
      )}

      {/* Image */}
      <div className="relative aspect-[2/1] overflow-hidden">
        <img 
          src={ad.imageUrl} 
          alt={ad.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Advertiser */}
        <p className="text-xs text-gold font-medium">
          {ad.memberName}
        </p>

        {/* Title */}
        <h3 className="font-semibold text-foreground group-hover:text-gold transition-colors line-clamp-2">
          {ad.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {ad.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            {ad.views.toLocaleString()} visualizações
          </span>
          
          <Button 
            variant={ad.isPremium ? 'gold' : 'outline'} 
            size="sm"
            onClick={() => window.open(ad.linkUrl, '_blank')}
          >
            Saiba Mais
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
