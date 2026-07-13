import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';

interface FinanceiroCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  className?: string;
}

export function FinanceiroCard({
  title,
  value,
  prefix = 'R$',
  suffix,
  icon: Icon,
  trend = 'neutral',
  description,
  className = ''
}: FinanceiroCardProps) {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-primary'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6 ${className}`}
    >
      {/* Glow effect */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-lg bg-primary/20">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        
        <div className={`text-2xl font-bold ${trendColors[trend]}`}>
          <AnimatedCounter 
            from={0} 
            to={value} 
            prefix={prefix ? `${prefix} ` : ''} 
            suffix={suffix ? ` ${suffix}` : ''} 
            duration={1.5}
          />
        </div>
        
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </div>
    </motion.div>
  );
}
