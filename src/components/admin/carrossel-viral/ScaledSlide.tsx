// Wrapper que renderiza um slide 1080x1350 escalado pra largura real do container.
// Usa ResizeObserver pra recalcular sempre que o container muda (responsivo).
import { useEffect, useRef, useState, type ReactNode } from 'react';

const SLIDE_W = 1080;
const SLIDE_H = 1350;

interface ScaledSlideProps {
  children: ReactNode;
  /** Click handler — passa pra div externa pra ser clickavel */
  onClick?: () => void;
  className?: string;
  /** Ativa cursor pointer e hover ring */
  interactive?: boolean;
}

export function ScaledSlide({ children, onClick, className = '', interactive }: ScaledSlideProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.28); // valor inicial seguro

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / SLIDE_W);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      onClick={onClick}
      className={`relative bg-background border border-border rounded-lg overflow-hidden ${
        interactive ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all' : ''
      } ${className}`}
      style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}
    >
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
