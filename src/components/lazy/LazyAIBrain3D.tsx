import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

// Lazy load the 3D component
const AIBrain3D = lazy(() => import('@/components/3d/AIBrain3D'));

interface LazyAIBrain3DProps {
  scale?: number;
}

const AIBrain3DFallback = () => (
  <div className="w-full h-96 flex items-center justify-center">
    <div className="relative">
      <Skeleton className="w-64 h-64 rounded-full animate-pulse" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-32 h-32 rounded-full bg-primary/20 animate-ping" />
      </div>
    </div>
  </div>
);

export default function LazyAIBrain3D({ scale }: LazyAIBrain3DProps) {
  const isMobile = useIsMobile();
  
  // On mobile, show a simpler fallback
  if (isMobile) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="relative">
          <div className="w-48 h-48 rounded-full bg-gradient-to-r from-primary/20 to-primary/40 animate-pulse flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/60 animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<AIBrain3DFallback />}>
      <AIBrain3D scale={scale} />
    </Suspense>
  );
}