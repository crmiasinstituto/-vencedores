/**
 * Catálogo único de áreas do /admin.
 *
 * É a mesma lista que monta o menu lateral e que aparece como checkbox na tela de
 * colaboradores. Ficam juntas de propósito: se as duas listas fossem separadas, criar uma tela
 * nova geraria um item de menu sem permissão correspondente — e ele apareceria pra todo mundo.
 *
 * A chave de permissão É a url. Assim a guarda de rota consegue decidir só olhando o pathname,
 * sem precisar de um mapa de-para.
 *
 * '*' na lista de permissões significa acesso total (é o que todo admin que já existia tem).
 */

export const ACESSO_TOTAL = '*';

export interface AreaAdmin {
  title: string;
  url: string;
  /** Nome do ícone em lucide-react. Resolvido no componente pra este arquivo não importar JSX. */
  icon: string;
}

export interface GrupoAreas {
  grupo: string;
  itens: AreaAdmin[];
}

export const AREAS_ADMIN: GrupoAreas[] = [
  {
    grupo: 'Principal',
    itens: [
      { title: 'Dashboard', url: '/admin', icon: 'LayoutDashboard' },
      { title: 'Agenda', url: '/admin/agenda', icon: 'CalendarDays' },
      { title: 'CRM de Vendas', url: '/admin/crm', icon: 'Kanban' },
      { title: 'Central 360', url: '/admin/clientes', icon: 'Users' },
      { title: 'Vendas', url: '/admin/vendas', icon: 'ShoppingCart' },
      { title: 'Vendas — Formações', url: '/admin/vendas-formacoes', icon: 'DollarSign' },
      { title: 'Funil', url: '/admin/funil', icon: 'TrendingDown' },
      { title: 'Financeiro', url: '/admin/recebimentos', icon: 'DollarSign' },
      { title: 'WhatsApp', url: '/admin/whatsapp', icon: 'MessageSquare' },
      { title: 'Ligacoes', url: '/admin/ligacoes', icon: 'Phone' },
      { title: 'Grupos WA', url: '/admin/grupos', icon: 'Users' },
      { title: 'Playbooks', url: '/admin/playbooks', icon: 'BookOpen' },
      { title: 'Agentes IA', url: '/admin/agentes', icon: 'Bot' },
      { title: 'Membros', url: '/admin/membros', icon: 'GraduationCap' },
      { title: 'Credenciamento', url: '/admin/credenciamento', icon: 'UserCheck' },
    ],
  },
  {
    grupo: '+ que Vencedores',
    itens: [
      { title: 'Visão Geral', url: '/admin/maisvencedores', icon: 'LayoutDashboard' },
      { title: 'Membros do Ecossistema', url: '/admin/maisvencedores/membros', icon: 'Users' },
      { title: 'Eventos', url: '/admin/maisvencedores/eventos', icon: 'CalendarDays' },
      { title: 'Treinamentos', url: '/admin/maisvencedores/treinamentos', icon: 'GraduationCap' },
      { title: 'Avisos da Comunidade', url: '/admin/maisvencedores/avisos', icon: 'Megaphone' },
      { title: 'Gerador de Templates', url: '/admin/maisvencedores/templates', icon: 'Sparkles' },
    ],
  },
  {
    grupo: 'Prospecção Instagram',
    itens: [
      { title: 'Social Selling IG', url: '/admin/social-selling', icon: 'Camera' },
    ],
  },
  {
    grupo: 'Marketing',
    itens: [
      { title: 'Visão Geral', url: '/admin/marketing/email', icon: 'LayoutDashboard' },
      { title: 'Campanhas Email', url: '/admin/marketing/campanhas', icon: 'Mail' },
      { title: 'Templates Email', url: '/admin/marketing/templates', icon: 'FileText' },
      { title: 'Automações', url: '/admin/marketing/automacoes', icon: 'Workflow' },
      { title: 'Templates WhatsApp', url: '/admin/marketing/wa-templates', icon: 'MessageSquare' },
      { title: 'Campanhas WhatsApp', url: '/admin/marketing/wa-campanhas', icon: 'Send' },
      { title: 'Instâncias WhatsApp', url: '/admin/marketing/instancias', icon: 'Smartphone' },
      { title: 'Integração Meta Ads', url: '/admin/marketing/integracoes/meta', icon: 'Target' },
      { title: 'Dashboard Mídia', url: '/admin/marketing/midia', icon: 'BarChart3' },
      { title: 'Lab de Criativos', url: '/admin/marketing/criativos/lab', icon: 'Sparkles' },
      { title: 'Eventos Coletivos', url: '/admin/marketing/eventos-coletivos', icon: 'CalendarHeart' },
      { title: 'Nova Campanha Meta', url: '/admin/marketing/midia/nova-campanha', icon: 'Megaphone' },
      { title: 'Configurações', url: '/admin/marketing/configuracoes', icon: 'SlidersHorizontal' },
    ],
  },
  {
    grupo: 'Em breve',
    itens: [
      { title: 'Marketing IA', url: '/admin/marketing-ia', icon: 'Brain' },
      { title: 'Marketing', url: '/admin/marketing', icon: 'Megaphone' },
      { title: 'Carrossel Viral', url: '/admin/carrossel-viral', icon: 'Sparkles' },
      { title: 'Operações', url: '/admin/operacoes', icon: 'ClipboardList' },
      { title: 'Recrutamento', url: '/admin/recrutamento', icon: 'UserCheck' },
      { title: 'Configurações', url: '/admin/configuracoes', icon: 'Settings' },
      { title: 'Credenciais', url: '/admin/credenciais', icon: 'KeyRound' },
    ],
  },
];

export const TODAS_AS_AREAS: AreaAdmin[] = AREAS_ADMIN.flatMap((g) => g.itens);

export function temAcessoTotal(permissoes: string[] | null | undefined): boolean {
  return !!permissoes?.includes(ACESSO_TOTAL);
}

export function podeVer(permissoes: string[] | null | undefined, url: string): boolean {
  if (temAcessoTotal(permissoes)) return true;
  return !!permissoes?.includes(url);
}

/**
 * Decide se um pathname qualquer está liberado. Casa pela área mais específica que prefixa a
 * rota — `/admin/crm?lead=x` e `/admin/marketing/campanhas/123` precisam herdar a permissão da
 * área-mãe, senão a navegação interna da própria tela seria bloqueada.
 *
 * `/admin` é exato de propósito: como prefixo ele casaria com o app inteiro.
 */
export function podeAcessarRota(permissoes: string[] | null | undefined, pathname: string): boolean {
  if (temAcessoTotal(permissoes)) return true;
  if (!permissoes?.length) return false;
  if (pathname === '/admin') return permissoes.includes('/admin');

  const candidatas = TODAS_AS_AREAS
    .filter((a) => a.url !== '/admin' && (pathname === a.url || pathname.startsWith(a.url + '/')))
    .sort((a, b) => b.url.length - a.url.length);

  if (candidatas.length === 0) return true; // rota sem área declarada (ex: /admin/credenciar/:id)
  return permissoes.includes(candidatas[0].url);
}
