// Regras de negócio do + que Vencedores (método de netweaving do Instituto Isaac Santos)

// Cada indicação que se cadastra vale este número de pontos.
export const POINTS_PER_REFERRAL = 10;

// Plano único de entrada
export const SEMENTE_PLAN = {
  name: 'Semente',
  freeMonths: 12,
  priceCash: 997,
  installments: 12,
  installmentValue: 99.7,
};

export interface RewardTier {
  points: number;
  title: string;
  perks: string[];
}

// Recompensas por pontos acumulados na temporada
export const REWARD_TIERS: RewardTier[] = [
  {
    points: 100,
    title: 'Renovação grátis',
    perks: ['Renovação da anuidade grátis'],
  },
  {
    points: 200,
    title: 'Renovação grátis + 2 ingressos RPX10X Diamond',
    perks: ['Renovação da anuidade grátis', '2 ingressos RPX10X Diamond'],
  },
  {
    points: 500,
    title: 'Renovação grátis + 10 ingressos RPX10X Diamond',
    perks: ['Renovação da anuidade grátis', '10 ingressos RPX10X Diamond'],
  },
];

// Prêmios do ranking anual (fim do ciclo)
export const ANNUAL_RANKING_PRIZES = [
  {
    position: 3,
    label: '3º lugar',
    perks: [
      'Todas as recompensas por pontos',
      'Mentoria individual com Isaac Santos (90 dias)',
    ],
  },
  {
    position: 2,
    label: '2º lugar',
    perks: [
      'Tudo do 3º lugar',
      'Experiência internacional com o IAS',
    ],
  },
  {
    position: 1,
    label: '1º lugar',
    perks: [
      'Tudo do 2º lugar',
      'Experiência internacional com o IAS',
      'Passagens aéreas inclusas',
    ],
  },
];

// Links úteis do membro. RPX10X ainda sem URL definitiva (placeholder).
export const RPX10X_URL = '#';
export const RPX10X_LABEL = 'RPX10X - Reprograme-se 10x';

// Dado um total de pontos, retorna o próximo nível de recompensa e o progresso.
export function getRewardProgress(points: number) {
  const nextTier = REWARD_TIERS.find((t) => points < t.points);
  const currentTier = [...REWARD_TIERS].reverse().find((t) => points >= t.points) || null;

  if (!nextTier) {
    // Já atingiu o topo
    const top = REWARD_TIERS[REWARD_TIERS.length - 1];
    return {
      currentTier,
      nextTier: null as RewardTier | null,
      percentage: 100,
      remaining: 0,
      target: top.points,
    };
  }

  const base = currentTier?.points ?? 0;
  const span = nextTier.points - base;
  const progressed = points - base;
  const percentage = span > 0 ? Math.min((progressed / span) * 100, 100) : 0;

  return {
    currentTier,
    nextTier,
    percentage,
    remaining: nextTier.points - points,
    target: nextTier.points,
  };
}
