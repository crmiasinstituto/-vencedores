import { lazy, Suspense, memo } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { SkeletonGrid } from '@/components/ui/SkeletonLoader';
import { useIsMobile } from '@/hooks/use-mobile';

interface LazySectionProps {
  children: React.ReactNode;
  threshold?: number;
  fallback?: React.ReactNode;
  enableOnMobile?: boolean;
}

export const LazySection = memo(({ 
  children, 
  threshold = 0.1, 
  fallback = <SkeletonGrid count={3} />,
  enableOnMobile = true 
}: LazySectionProps) => {
  const isMobile = useIsMobile();
  const { targetRef, isIntersecting, hasTriggered } = useIntersectionObserver({
    threshold,
    rootMargin: isMobile ? '50px' : '100px',
    triggerOnce: true
  });

  // Disable lazy loading on mobile if specified
  if (isMobile && !enableOnMobile) {
    return <div>{children}</div>;
  }

  return (
    <div ref={targetRef}>
      {(isIntersecting || hasTriggered) ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        <div className="min-h-[200px] flex items-center justify-center">
          {fallback}
        </div>
      )}
    </div>
  );
});

LazySection.displayName = 'LazySection';