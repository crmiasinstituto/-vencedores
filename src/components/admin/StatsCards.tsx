import { motion } from 'framer-motion';
import { Users, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface StatsCardsProps {
  totalLeads: number;
  totalClients: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export function StatsCards({ totalLeads, totalClients, completed, inProgress, pending }: StatsCardsProps) {
  const stats = [
    {
      label: 'Total de Leads',
      value: totalLeads,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Onboardings Criados',
      value: totalClients,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Concluídos',
      value: completed,
      icon: CheckCircle2,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Em Andamento',
      value: inProgress,
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Pendentes',
      value: pending,
      icon: AlertCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`${stat.bgColor} rounded-xl p-4 border border-border`}
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
