import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

// Lazy load the 3D component
const DDD3DElement = lazy(() => import('@/components/lead/DDD3DElement'));

interface RegionData {
  estado: string;
  cidade: string;
  emoji: string;
  cor: string;
  mensagem: string;
  region: string;
}

interface LazyDDD3DElementProps {
  region?: RegionData;
}

const DDD3DFallback = () => (
  <div className="w-full h-48 flex items-center justify-center">
    <Skeleton className="w-32 h-32 rounded-lg animate-pulse" />
  </div>
);

export default function LazyDDD3DElement({ region }: LazyDDD3DElementProps) {
  const isMobile = useIsMobile();
  
  // On mobile, show a simpler static representation
  if (isMobile && region) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-bounce">{region.emoji}</div>
          <div className="text-sm text-muted-foreground">{region.cidade}, {region.estado}</div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<DDD3DFallback />}>
      <DDD3DElement region={region} />
    </Suspense>
  );
}