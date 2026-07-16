import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { ReferralLink } from '@/maisvencedores/components/members/ReferralLink';
import { ReferralStats } from '@/maisvencedores/components/members/ReferralStats';
import { RewardsProgress } from '@/maisvencedores/components/members/RewardsProgress';
import { RankingLeaderboard } from '@/maisvencedores/components/members/RankingLeaderboard';
import { ReferralList } from '@/maisvencedores/components/members/ReferralList';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { useReferrals } from '@/maisvencedores/hooks/useReferrals';
import { useNwPoints } from '@/maisvencedores/hooks/useNwPoints';
import { POINTS_PER_REFERRAL } from '@/maisvencedores/lib/netweaving';
import { Loader2 } from 'lucide-react';

export default function MembersReferrals() {
  const { profile, loading: profileLoading } = useProfile();
  const { referrals, stats, ranking, loading: referralsLoading } = useReferrals();
  const { seasonPoints, lifetimePoints, tierLabel, loading: pointsLoading } = useNwPoints();

  const isLoading = profileLoading || referralsLoading || pointsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Faça login para ver suas indicações.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <MembersHeader
        title="Indicações"
        subtitle={`Cada indicação que se cadastra vale ${POINTS_PER_REFERRAL} pontos. Convide e suba no ranking!`}
      />

      {/* Stats Grid */}
      <ReferralStats stats={stats} />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Link & Rewards */}
        <div className="lg:col-span-2 space-y-6">
          <ReferralLink referralCode={profile.referral_code} />
          <RewardsProgress
            seasonPoints={seasonPoints}
            lifetimePoints={lifetimePoints}
            tierLabel={tierLabel}
          />
          <ReferralList referrals={referrals} />
        </div>

        {/* Right Column - Ranking */}
        <div>
          <RankingLeaderboard ranking={ranking} currentProfileId={profile.id} />
        </div>
      </div>
    </div>
  );
}
