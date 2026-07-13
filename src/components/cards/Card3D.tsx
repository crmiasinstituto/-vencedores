import { ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

interface Card3DProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  variant?: 'default' | 'highlight';
}

export default function Card3D({
  title,
  description,
  children,
  className = "",
  icon,
  variant = 'default'
}: Card3DProps) {
  const isMobile = useIsMobile();
  const isHighlight = variant === 'highlight';
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, {
    stiffness: 500,
    damping: isMobile ? 35 : 100
  });
  const mouseYSpring = useSpring(y, {
    stiffness: 500,
    damping: isMobile ? 35 : 100
  });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], 
    isMobile ? ["5deg", "-5deg"] : ["17.5deg", "-17.5deg"]
  );
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], 
    isMobile ? ["-5deg", "5deg"] : ["-17.5deg", "17.5deg"]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };
  
  const handleMouseLeave = () => {
    if (isMobile) return;
    x.set(0);
    y.set(0);
  };

  // Styles based on variant
  const cardStyles = isHighlight 
    ? "solution-card relative overflow-hidden border-primary bg-primary backdrop-blur-lg"
    : "solution-card relative overflow-hidden border-primary/20 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-lg";

  const iconBoxStyles = isHighlight
    ? "w-12 h-12 rounded-lg bg-white flex items-center justify-center text-background mx-auto"
    : "w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mx-auto";

  const titleStyles = isHighlight
    ? "text-xl font-bold text-background"
    : "text-xl font-bold text-gradient";

  const descriptionStyles = isHighlight
    ? "text-background/80 mt-2"
    : "text-muted-foreground mt-2";

  const glowStyles = isHighlight
    ? "absolute inset-0.5 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg blur-sm opacity-50 pointer-events-none z-0"
    : "absolute inset-0.5 bg-gradient-to-r from-primary/5 via-primary/5 to-primary/5 rounded-lg blur-sm opacity-50 pointer-events-none z-0";

  return (
    <motion.div 
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave} 
      style={{
        rotateY: isMobile ? 0 : rotateY,
        rotateX: isMobile ? 0 : rotateX,
        transformStyle: isMobile ? "flat" : "preserve-3d"
      }} 
      className={`perspective-1000 ${className}`} 
      whileHover={{
        scale: isMobile ? 1.01 : 1.05
      }} 
      initial={{
        opacity: 0,
        y: isMobile ? 20 : 50
      }} 
      whileInView={{
        opacity: 1,
        y: 0
      }} 
      viewport={{
        once: true
      }} 
      transition={{
        duration: isMobile ? 0.3 : 0.6,
        ease: "easeOut"
      }}
    >
      <Card className={cardStyles}>
        {/* Subtle glow effect - contained within card */}
        <div className={glowStyles} />
        
        <div className="relative z-10">
          <CardHeader className="space-y-4">
            {icon && (
              <motion.div 
                whileHover={{
                  rotate: isMobile ? 180 : 360
                }} 
                transition={{
                  duration: isMobile ? 0.3 : 0.6
                }} 
                className={iconBoxStyles}
              >
                {icon}
              </motion.div>
            )}
            <div>
              <CardTitle className={titleStyles}>
                {title}
              </CardTitle>
              <CardDescription className={descriptionStyles}>
                {description}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className={isHighlight ? "text-white" : ""}>
            {children}
          </CardContent>
        </div>

        {/* Animated background elements - reduced on mobile */}
        {!isMobile && (
          <>
            <div className={`absolute top-0 right-0 w-32 h-32 ${isHighlight ? 'bg-gradient-to-br from-background/10' : 'bg-gradient-to-br from-primary/5'} to-transparent rounded-full blur-2xl pointer-events-none z-0`} />
            <div className={`absolute bottom-0 left-0 w-24 h-24 ${isHighlight ? 'bg-gradient-to-tr from-background/10' : 'bg-gradient-to-tr from-primary/5'} to-transparent rounded-full blur-xl pointer-events-none z-0`} />
          </>
        )}
      </Card>
    </motion.div>
  );
}