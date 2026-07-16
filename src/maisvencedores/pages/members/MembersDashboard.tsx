import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';
import { mockMembers, mockEvents, mockAnnouncements, mockTrainings } from '@/maisvencedores/data/mockMembers';
import { MemberCard } from '@/maisvencedores/components/members/MemberCard';
import { EventCard } from '@/maisvencedores/components/members/EventCard';
import { TrainingCard } from '@/maisvencedores/components/members/TrainingCard';
import { FaixaBadge } from '@/maisvencedores/components/members/FaixaBadge';
import { FAIXAS, FAIXA_INFO, nivelDaFaixa } from '@/maisvencedores/types/member';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, GraduationCap, Calendar, TrendingUp, Sparkles, Gift, Trophy, Ticket, Video, MapPin, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/maisvencedores/hooks/useProfile';
import { useNwPoints } from '@/maisvencedores/hooks/useNwPoints';
import { RPX10X_URL, RPX10X_LABEL } from '@/maisvencedores/lib/netweaving';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function MembersDashboard() {
  const { currentMember, faixa, isOnboardingComplete } = useMembership();
  // undefined na preta: é o topo, não tem próxima.
  const proximaFaixa = FAIXAS[nivelDaFaixa(faixa) + 1];
  const { profile } = useProfile();
  const { seasonPoints, lifetimePoints, tierLabel } = useNwPoints();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const referralUrl = profile?.referral_code
    ? `${window.location.origin}/i/${profile.referral_code}`
    : '';

  const copyReferral = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast({ title: 'Link de indicação copiado!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const newMembers = mockMembers.filter(m => m.isNewMember).slice(0, 3);
  const upcomingEvents = mockEvents.slice(0, 2);
  const featuredTrainings = mockTrainings.slice(0, 3);

  return (
    <div className="min-h-screen">
      <MembersHeader 
        title={`Olá, ${currentMember?.owner_name?.split(' ')[0] || 'Membro'}`}
        subtitle="Bem-vindo à sua comunidade de negócios"
      />

      <div className="p-6 space-y-8">
        {/* Onboarding Banner */}
        {!isOnboardingComplete && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gold/20 via-gold-light/10 to-gold/20 border border-gold/30 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">Complete seu Portfólio</h3>
                  <p className="text-muted-foreground">Configure seu perfil para aparecer na vitrine de membros</p>
                </div>
              </div>
              <Button variant="gold" asChild>
                <Link to="/maisvencedores/membros/onboarding">
                  Começar Agora
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Pontos + Links rápidos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pontos */}
          <div className="lg:col-span-2 bg-card/50 border border-border/50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-gold" />
              <h3 className="font-display text-lg font-bold text-foreground">Seus Pontos</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gold/10 border border-gold/20 p-4">
                <p className="text-xs text-muted-foreground mb-1">Temporada atual</p>
                <p className="text-3xl font-bold text-gold">{seasonPoints}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Vitalícios</p>
                <p className="text-3xl font-bold text-foreground">{lifetimePoints}</p>
              </div>
            </div>
            {tierLabel && (
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-gold" />
                Nível atual: <span className="font-semibold text-foreground">{tierLabel}</span>
              </p>
            )}
            <Button variant="gold-outline" size="sm" className="mt-4" asChild>
              <Link to="/maisvencedores/membros/indicacoes">
                Ver recompensas e ranking <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>

          {/* Links rápidos */}
          <div className="bg-card/50 border border-border/50 rounded-xl p-6 space-y-3">
            <h3 className="font-display text-lg font-bold text-foreground mb-2">Links Rápidos</h3>
            <button
              onClick={copyReferral}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gold/10 hover:bg-gold/20 border border-gold/20 transition-colors text-left"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gold" />}
              <span className="text-sm text-foreground flex-1">Meu link de indicação</span>
            </button>
            <a
              href={RPX10X_URL}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <Ticket className="w-4 h-4 text-gold" />
              <span className="text-sm text-foreground">{RPX10X_LABEL}</span>
            </a>
            <Link
              to="/maisvencedores/membros/eventos"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <Video className="w-4 h-4 text-electric" />
              <span className="text-sm text-foreground">Eventos online</span>
            </Link>
            <Link
              to="/maisvencedores/membros/eventos"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <MapPin className="w-4 h-4 text-platinum" />
              <span className="text-sm text-foreground">Eventos presenciais</span>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: 'Membros Ativos', value: mockMembers.length, color: 'text-gold' },
            { icon: GraduationCap, label: 'Treinamentos', value: mockTrainings.length, color: 'text-electric' },
            { icon: Calendar, label: 'Eventos este Mês', value: mockEvents.length, color: 'text-platinum' },
            { icon: TrendingUp, label: 'Conexões Feitas', value: '47', color: 'text-green-500' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-card/50 border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* A faixa da pessoa.
            Este bloco era "Seu Plano Atual", com "Renovação em 15 de Janeiro, 2026" (data
            chumbada, inventada pelo template) e um botão "Fazer Upgrade". Nada disso existe
            aqui: faixa não se renova nem se compra — se avança fazendo formação. Por isso o
            que aparece é onde a pessoa está e o que falta pra próxima. */}
        <div className="bg-card/50 border border-border/50 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <FaixaBadge faixa={faixa} size="lg" />
              <div>
                <h3 className="font-semibold text-foreground">Sua faixa</h3>
                <p className="text-sm text-muted-foreground">{FAIXA_INFO[faixa].descricao}</p>
              </div>
            </div>
            {proximaFaixa && (
              <p className="text-sm text-muted-foreground">
                Próxima:{' '}
                <span className="text-foreground font-medium">
                  Faixa {FAIXA_INFO[proximaFaixa].nome}
                </span>{' '}
                — {FAIXA_INFO[proximaFaixa].descricao}
              </p>
            )}
          </div>
        </div>

        {/* New Members */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold text-foreground">Novos Membros</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/maisvencedores/membros/portfolio">Ver Todos <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {newMembers.map(member => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </section>

        {/* Upcoming Events */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold text-foreground">Próximos Eventos</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/maisvencedores/membros/eventos">Ver Todos <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcomingEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>

        {/* Featured Trainings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold text-foreground">Treinamentos em Destaque</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/maisvencedores/membros/treinamentos">Ver Todos <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredTrainings.map(training => (
              <TrainingCard key={training.id} training={training} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
