import { memo, useCallback, useMemo, ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PerformanceOptimizedProps {
  children: ReactNode;
  condition?: boolean;
  fallback?: ReactNode;
}

// High-performance wrapper that prevents unnecessary re-renders
export const PerformanceOptimizer = memo(({ 
  children, 
  condition = true, 
  fallback = null 
}: PerformanceOptimizedProps) => {
  const isMobile = useIsMobile();
  
  // On mobile, use simplified version if available
  if (isMobile && fallback && !condition) {
    return <>{fallback}</>;
  }
  
  return condition ? <>{children}</> : <>{fallback}</>;
});

PerformanceOptimizer.displayName = 'PerformanceOptimizer';

// Optimized section wrapper with viewport detection
interface OptimizedSectionProps {
  children: ReactNode;
  className?: string;
  enableAnimations?: boolean;
}

export const OptimizedSection = memo(({ 
  children, 
  className = '', 
  enableAnimations = true 
}: OptimizedSectionProps) => {
  const isMobile = useIsMobile();
  
  const sectionClassName = useMemo(() => {
    let classes = className;
    
    // Disable complex animations on mobile
    if (isMobile && !enableAnimations) {
      classes = classes.replace(/animate-\S+/g, '');
      classes = classes.replace(/transform/g, '');
    }
    
    return classes;
  }, [className, isMobile, enableAnimations]);
  
  return (
    <section className={sectionClassName}>
      {children}
    </section>
  );
});

OptimizedSection.displayName = 'OptimizedSection';

// Debounced component updates for heavy components
export const useDebouncedRender = (value: any, delay: number = 300) => {
  const debouncedValue = useMemo(() => {
    const timeout = setTimeout(() => value, delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  
  return debouncedValue;
};

// Optimized list renderer
interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  chunkSize?: number;
}

export function OptimizedList<T>({ 
  items, 
  renderItem, 
  keyExtractor, 
  chunkSize = 10 
}: OptimizedListProps<T>) {
  const isMobile = useIsMobile();
  const effectiveChunkSize = isMobile ? chunkSize / 2 : chunkSize;
  
  const chunks = useMemo(() => {
    const result = [];
    for (let i = 0; i < items.length; i += effectiveChunkSize) {
      result.push(items.slice(i, i + effectiveChunkSize));
    }
    return result;
  }, [items, effectiveChunkSize]);
  
  return (
    <>
      {chunks.map((chunk, chunkIndex) => (
        <div key={`chunk-${chunkIndex}`}>
          {chunk.map((item, itemIndex) => (
            <div key={keyExtractor(item, itemIndex)}>
              {renderItem(item, itemIndex)}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}