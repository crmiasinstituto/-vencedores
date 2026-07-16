import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  description?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  description,
  trend,
  className = ''
}: StatCardProps) {
  return (
    <Card className={`bg-card/50 border-gold/20 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {description && (
              <div className="text-xs text-muted-foreground mt-1">{description}</div>
            )}
            {trend && (
              <p className={`text-xs mt-1 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}% vs mês anterior
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center">
            <Icon className={cn("h-6 w-6", iconColor || "text-gold")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
