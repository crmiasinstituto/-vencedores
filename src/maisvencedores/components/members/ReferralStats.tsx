import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { ReferralStats as Stats } from '@/maisvencedores/hooks/useReferrals';

interface ReferralStatsProps {
  stats: Stats | null;
}

export function ReferralStats({ stats }: ReferralStatsProps) {
  const items = [
    {
      icon: Users,
      label: 'Total Aprovadas',
      value: stats?.total_referrals ?? 0,
      color: 'text-gold',
      bgColor: 'bg-gold/10',
    },
    {
      icon: Clock,
      label: 'Pendentes',
      value: stats?.pending_referrals ?? 0,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: CheckCircle,
      label: 'Bronze',
      value: stats?.bronze_referrals ?? 0,
      color: 'text-amber-600',
      bgColor: 'bg-amber-600/10',
    },
    {
      icon: CheckCircle,
      label: 'Prata',
      value: stats?.prata_referrals ?? 0,
      color: 'text-platinum',
      bgColor: 'bg-platinum/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card border border-border rounded-xl p-4">
          <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center mb-3`}>
            <item.icon className={`w-5 h-5 ${item.color}`} />
          </div>
          <p className="text-2xl font-bold">{item.value}</p>
          <p className="text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
