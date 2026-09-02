/**
 * O modelo do ecossistema + que Vencedores.
 *
 * Aqui não existe "plano". Existe FAIXA — e a diferença não é de nome, é de conceito:
 * plano é o que você compra e fica; faixa é onde você chegou. Cada faixa SOBREPÕE a anterior,
 * então a pessoa está sempre em uma só.
 *
 * A ORDEM do array FAIXAS é a progressão, e é a mesma ordem do enum `faixa` no banco. É por
 * isso que comparar faixa é comparar índice, e não existe tabela de/para em lugar nenhum.
 */

export type Faixa = 'branco' | 'vermelho' | 'verde' | 'roxo' | 'marrom' | 'preta';

/** A progressão, na ordem. Igual à ordem do enum no Postgres — não reordene sem migration. */
export const FAIXAS: readonly Faixa[] = ['branco', 'vermelho', 'verde', 'roxo', 'marrom', 'preta'] as const;

interface FaixaInfo {
  nome: string;
  /** O que a pessoa fez pra chegar aqui. Texto de tela — fala com o membro, não com o dev. */
  descricao: string;
  /** Classes Tailwind. Calibradas pro fundo escuro: a cor da faixa tem que ler sem virar borrão. */
  texto: string;
  fundo: string;
  borda: string;
  /** A pastilha da faixa, na cor real dela. */
  pastilha: string;
}

export const FAIXA_INFO: Record<Faixa, FaixaInfo> = {
  branco: {
    nome: 'Branca',
    descricao: 'Inscrito. Esteve em evento simples ou beneficente e ainda não avançou.',
    texto: 'text-zinc-200',
    fundo: 'bg-zinc-400/10',
    borda: 'border-zinc-400/40',
    pastilha: 'bg-zinc-100',
  },
  vermelho: {
    nome: 'Vermelha',
    descricao: 'Fez o Reprograme-se 10X.',
    texto: 'text-red-300',
    fundo: 'bg-red-500/10',
    borda: 'border-red-500/40',
    pastilha: 'bg-red-500',
  },
  verde: {
    nome: 'Verde',
    descricao: 'Fez a FPO (Palestrantes e Oradores) e a FPI (Practitioner).',
    texto: 'text-emerald-300',
    fundo: 'bg-emerald-500/10',
    borda: 'border-emerald-500/40',
    pastilha: 'bg-emerald-500',
  },
  roxo: {
    nome: 'Roxa',
    descricao: 'Fez a formação Master.',
    texto: 'text-violet-300',
    fundo: 'bg-violet-500/10',
    borda: 'border-violet-500/40',
    pastilha: 'bg-violet-500',
  },
  marrom: {
    nome: 'Marrom',
    descricao: 'Fez a formação Trainer.',
    // Marrom no escuro vira lama. O âmbar queimado é o que mais lê como marrom sem sumir.
    texto: 'text-amber-600',
    fundo: 'bg-amber-800/15',
    borda: 'border-amber-700/45',
    pastilha: 'bg-amber-800',
  },
  preta: {
    nome: 'Preta',
    descricao: 'Forma treinadores.',
    // Preto sobre fundo preto não existe. A faixa preta se mostra pelo anel claro — é o topo
    // da progressão e tem que parecer.
    texto: 'text-zinc-100',
    fundo: 'bg-zinc-950',
    borda: 'border-zinc-300/60',
    pastilha: 'bg-zinc-950 ring-1 ring-zinc-300/70',
  },
};

/** Onde a faixa está na progressão. -1 se não for faixa válida. */
export function nivelDaFaixa(f: Faixa | null | undefined): number {
  return f ? FAIXAS.indexOf(f) : -1;
}

/** A pessoa alcança o que exige `minima`? Compara posição na progressão. */
export function faixaAlcanca(minha: Faixa | null | undefined, minima: Faixa): boolean {
  return nivelDaFaixa(minha) >= nivelDaFaixa(minima);
}

/** Treinador é quem chegou na marrom ou na preta. */
export function ehTreinador(f: Faixa | null | undefined): boolean {
  return f === 'marrom' || f === 'preta';
}

export interface MemberProfile {
  id: string;
  userId: string;
  nomeCompleto: string;
  profissao?: string;
  telefone?: string;
  email?: string;
  instagram?: string;
  photo?: string;
  description?: string;
  faixa: Faixa;
  isNewMember: boolean;
  joinedAt: Date;
  onboardingCompleted: boolean;
  /** Campos de empresa. O ecossistema é sobre pessoas — isto é opcional e o onboarding nem
   *  pergunta. Fica porque o portfólio ainda mostra, pra quem quiser preencher. */
  companyName?: string;
  segment?: string;
  website?: string;
  linkedin?: string;
  services?: string[];
}

export interface TrainingCategory {
  id: string;
  nome: string;
  slug: string;
  grupo?: string;
}

export interface Training {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  categoryId?: string;
  categoryNome?: string;
  faixaMinima: Faixa;
  videoUrl?: string;
  progress?: number;
  /** Quem publicou. Vazio = veio da equipe. */
  createdBy?: string | null;
  isActive?: boolean;
  /** pendente | aprovado | rejeitado — moderação prévia do conteúdo de membro. */
  moderacaoStatus?: 'pendente' | 'aprovado' | 'rejeitado';
  motivoRejeicao?: string | null;
}

export interface Treinador {
  id: string;
  nome: string;
  fotoUrl?: string;
  bio?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  /** Último dia, quando o evento dura mais de um. Null/ausente = evento de um dia. */
  endDate?: Date | null;
  time: string;
  type: 'presencial' | 'online';
  location?: string;
  meetingUrl?: string;
  /** Destino do botão "Garantir Vaga" (inscrição/pagamento). */
  paymentUrl?: string;
  /** Banner exibido no topo do card. */
  imageUrl?: string;
  spots?: number;
  spotsRemaining?: number;
  /** Múltiplas: um evento pode abrir pra verde E roxo sem abrir pra todo mundo. */
  faixasPermitidas: Faixa[];
  treinadorId?: string;
  treinadorNome?: string;
}

export interface Advertisement {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  isPremium: boolean;
  views: number;
  startDate: Date;
  endDate: Date;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'new-member';
  createdAt: Date;
  memberName?: string;
  memberPhoto?: string;
}

/** Profissões só como sugestão de autocomplete — o campo é livre. Gente não cabe em lista. */
export const PROFISSOES_SUGERIDAS = [
  'Empresário',
  'Autônomo',
  'Consultor',
  'Coach',
  'Palestrante',
  'Professor',
  'Advogado',
  'Médico',
  'Psicólogo',
  'Contador',
  'Arquiteto',
  'Engenheiro',
  'Designer',
  'Vendedor',
  'Estudante',
  'Aposentado',
];
