import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { useMembership } from '@/maisvencedores/contexts/MembershipContext';
import { useMembers } from '@/maisvencedores/hooks/useMembers';
import { useEvents } from '@/maisvencedores/hooks/useEvents';
import { useTrainings } from '@/maisvencedores/hooks/useTrainings';
import { MemberCard } from '@/maisvencedores/components/members/MemberCard';
import { GlowCard } from '@/components/ui/spotlight-card';
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
import { copiarTexto } from '@/maisvencedores/lib/copiar';
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
    if (!referralUrl) {
      // Antes isto era `if (!referralUrl) return;` — um clique que não fazia NADA: sem toast,
      // sem erro, a tela imóvel. Quem não tem perfil ainda (admin que nunca fez o onboarding,
      // por exemplo) não tem referral_code, e o botão simplesmente morria em silêncio. Falhar
      // calado é pior que falhar: a pessoa acha que o sistema está quebrado.
      toast({
        title: 'Complete seu perfil primeiro',
        description: 'Seu link de indicação é criado junto com o seu cadastro de membro.',
        variant: 'destructive',
      });
      return;
    }
    const ok = await copiarTexto(referralUrl);
    if (ok) {
      setCopied(true);
      toast({ title: 'Link de indicação copiado!' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: 'Não consegui copiar',
        description: 'Selecione o link e copie manualmente.',
        variant: 'destructive',
      });
    }
  };

  // Dado real. Isto lia mockMembers/mockEvents/mockTrainings — 8 membros, 4 eventos e 6
  // treinamentos INVENTADOS pelo template da Lovable, que apareciam mesmo com o banco vazio.
  // O dashboard dizia "8 Membros Ativos" enquanto a tela de Portfólios, que lê o banco, dizia
  // "Nenhum membro aprovado ainda". Um dos dois estava mentindo.
  const { members, loading: carregandoMembros } = useMembers();
  const { events, loading: carregandoEventos } = useEvents();
  const { trainings, loading: carregandoTreinos } = useTrainings();

  // Só mostra novos membros QUE JÁ TÊM foto — card de iniciais fica feio na vitrine.
  const novosMembros = members.filter((m) => m.isNewMember && m.photoUrl).slice(0, 3);
  // Só os que ainda vão acontecer: "Próximos Eventos" com evento do mês passado é pior que
  // seção vazia.
  const proximosEventos = events
    .filter((e) => e.date >= new Date(new Date().setHours(0, 0, 0, 0)))
    .slice(0, 2);
  const treinamentosDestaque = trainings.slice(0, 3);

  const eventosDoMes = events.filter((e) => {
    const hoje = new Date();
    return e.date.getMonth() === hoje.getMonth() && e.date.getFullYear() === hoje.getFullYear();
  }).length;

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
            { icon: Users, label: 'Membros Ativos', value: members.length, color: 'text-gold' },
            { icon: GraduationCap, label: 'Treinamentos', value: trainings.length, color: 'text-electric' },
            { icon: Calendar, label: 'Eventos este Mês', value: eventosDoMes, color: 'text-platinum' },
            // "Conexões Feitas: 47" era chumbado no código — número inventado que não vinha de
            // lugar nenhum. Trocado pelos pontos, que existem de verdade e são o que a pessoa
            // acumula por trazer gente.
            { icon: TrendingUp, label: 'Seus pontos', value: lifetimePoints, color: 'text-green-500' },
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
          {carregandoMembros ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : novosMembros.length === 0 ? (
            // Dizer que não há é honesto; encher com dado falso, não.
            <p className="text-sm text-muted-foreground">
              Nenhum membro novo por enquanto.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {novosMembros.map((member) => (
                // useMembers devolve Member (a linha do banco); o MemberCard pede MemberProfile.
                // Os dois descrevem a mesma pessoa e divergem só no que o card nao usa
                // (joinedAt/onboardingCompleted), entao completa aqui em vez de arrastar dois
                // tipos quase iguais pelo app inteiro.
                //
                // GlowCard: borda spotlight (azul da marca) que acende seguindo o cursor.
                // customSize + !block + !p-0 = usa só como moldura de borda, sem mexer no card.
                // !touch-auto restaura a rolagem por toque (o componente vem com touch-action:none).
                <GlowCard
                  key={member.id}
                  glowColor="blue"
                  customSize
                  className="!block w-full !gap-0 !p-0 !rounded-xl !shadow-none !backdrop-blur-none !touch-auto"
                >
                  <MemberCard
                    member={{ ...member, joinedAt: member.createdAt, onboardingCompleted: true }}
                  />
                </GlowCard>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Events */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold text-foreground">Próximos Eventos</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/maisvencedores/membros/eventos">Ver Todos <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
          {carregandoEventos ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : proximosEventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento agendado ainda.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {proximosEventos.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {/* Featured Trainings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold text-foreground">Treinamentos em Destaque</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/maisvencedores/membros/treinamentos">Ver Todos <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
          {carregandoTreinos ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : treinamentosDestaque.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum treinamento disponível para a sua faixa ainda.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {treinamentosDestaque.map((training) => (
                <TrainingCard key={training.id} training={training} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
