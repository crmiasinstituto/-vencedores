import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FAIXA_INFO } from '@/maisvencedores/types/member';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Referral } from '@/maisvencedores/hooks/useReferrals';

interface ReferralListProps {
  referrals: Referral[];
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  },
  approved: {
    label: 'Aprovada',
    icon: CheckCircle,
    className: 'bg-green-500/10 text-green-500 border-green-500/30',
  },
  rejected: {
    label: 'Rejeitada',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-500 border-red-500/30',
  },
  expired: {
    label: 'Expirada',
    icon: AlertCircle,
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function ReferralList({ referrals }: ReferralListProps) {
  if (referrals.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">
          Nenhuma indicação ainda. Compartilhe seu link para começar!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-display font-semibold">Suas Indicações</h3>
      </div>
      
      <div className="divide-y divide-border">
        {referrals.map((referral) => {
          const status = statusConfig[referral.status];
          const StatusIcon = status.icon;
          const faixaInfo = referral.referred_profile 
            ? FAIXA_INFO[referral.referred_profile.faixa]
            : FAIXA_INFO.branco;

          return (
            <div key={referral.id} className="p-4 flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={referral.referred_profile?.photo_url || undefined} />
                <AvatarFallback className={faixaInfo.fundo}>
                  <span className={faixaInfo.texto}>
                    {referral.referred_profile?.owner_name?.charAt(0) || '?'}
                  </span>
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {referral.referred_profile?.owner_name || 'Membro'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {referral.referred_profile?.company_name || 'Empresa'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(referral.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className={status.className}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
                <Badge variant="outline" className={faixaInfo.borda}>
                  <span className={faixaInfo.texto}>{faixaInfo.nome}</span>
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
