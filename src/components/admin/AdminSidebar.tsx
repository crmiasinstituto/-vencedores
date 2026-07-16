import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Megaphone,
  ClipboardList,
  LogOut,
  ChevronLeft,
  BookOpen,
  Bot,
  Settings,
  UserCheck,
  GraduationCap,
  CalendarDays,
  TrendingDown,
  Sparkles,
  Brain,
  Mail,
  Send,
  Workflow,
  FileText,
  SlidersHorizontal,
  Smartphone,
  Target,
  BarChart3,
  Phone,
  Camera,
  CalendarHeart,
  HardDrive,
  Building2,
} from 'lucide-react';
import { UpcomingMeetingsWidget } from './UpcomingMeetingsWidget';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import logo from '@/assets/mais-que-vencedores-logo.svg';

const menuItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Agenda', url: '/admin/agenda', icon: CalendarDays },
  { title: 'CRM de Vendas', url: '/admin/crm', icon: Kanban },
  { title: 'Central 360', url: '/admin/clientes', icon: Users },
  { title: 'Vendas', url: '/admin/vendas', icon: ShoppingCart },
  { title: 'Funil', url: '/admin/funil', icon: TrendingDown },
  { title: 'Financeiro', url: '/admin/recebimentos', icon: DollarSign },
  { title: 'Projeções', url: '/admin/financeiro', icon: TrendingUp },
  { title: 'WhatsApp', url: '/admin/whatsapp', icon: MessageSquare },
  { title: 'Ligacoes', url: '/admin/ligacoes', icon: Phone },
  { title: 'Grupos WA', url: '/admin/grupos', icon: Users },
  { title: 'Playbooks', url: '/admin/playbooks', icon: BookOpen },
  { title: 'Agentes IA', url: '/admin/agentes', icon: Bot },
  { title: 'Equipe', url: '/admin/equipe', icon: Users },
  { title: 'Membros', url: '/admin/membros', icon: GraduationCap },
  { title: 'Acervo do Time', url: '/admin/acervo', icon: HardDrive },
  { title: 'Credenciamento', url: '/admin/credenciamento', icon: UserCheck },
];

// As apresentações eram os decks da SQUAAD (Masterclass IA, Reprograme 10x,
// Estruturar Evento). Os HTMLs saíram de public/apresentacoes e as páginas de
// configuração foram removidas — a seção inteira apontava pra lugar nenhum.

const secondaryItems = [
  { title: 'Marketing IA', url: '/admin/marketing-ia', icon: Brain },
  { title: 'Marketing', url: '/admin/marketing', icon: Megaphone },
  { title: 'Carrossel Viral', url: '/admin/carrossel-viral', icon: Sparkles },
  { title: 'Operações', url: '/admin/operacoes', icon: ClipboardList },
  { title: 'Recrutamento', url: '/admin/recrutamento', icon: UserCheck },
  { title: 'Configurações', url: '/admin/configuracoes', icon: Settings },
];

// Admin do netweaving (+ que Vencedores). Fica em grupo próprio porque os cadastros são
// outros: 'Empresas' aqui é a tabela profiles (quem faz parte da rede), enquanto o
// 'Membros' do grupo Principal é a tabela members (aluno do LMS). Mesmo nome, gente
// diferente — daí os rótulos serem distintos aqui.
const maisVencedoresItems = [
  { title: 'Visão Geral', url: '/admin/maisvencedores', icon: LayoutDashboard },
  { title: 'Membros do Ecossistema', url: '/admin/maisvencedores/membros', icon: Users },
  { title: 'Eventos', url: '/admin/maisvencedores/eventos', icon: CalendarDays },
  { title: 'Treinamentos', url: '/admin/maisvencedores/treinamentos', icon: GraduationCap },
];

const socialSellingItems = [
  { title: 'Social Selling IG', url: '/admin/social-selling', icon: Camera },
];

const marketingEmailItems = [
  { title: 'Visão Geral', url: '/admin/marketing/email', icon: LayoutDashboard },
  { title: 'Campanhas Email', url: '/admin/marketing/campanhas', icon: Mail },
  { title: 'Templates Email', url: '/admin/marketing/templates', icon: FileText },
  { title: 'Automações', url: '/admin/marketing/automacoes', icon: Workflow },
  { title: 'Templates WhatsApp', url: '/admin/marketing/wa-templates', icon: MessageSquare },
  { title: 'Campanhas WhatsApp', url: '/admin/marketing/wa-campanhas', icon: Send },
  { title: 'Instâncias WhatsApp', url: '/admin/marketing/instancias', icon: Smartphone },
  { title: 'Integração Meta Ads', url: '/admin/marketing/integracoes/meta', icon: Target },
  { title: 'Dashboard Mídia', url: '/admin/marketing/midia', icon: BarChart3 },
  { title: 'Lab de Criativos', url: '/admin/marketing/criativos/lab', icon: Sparkles },
  { title: 'Eventos Coletivos', url: '/admin/marketing/eventos-coletivos', icon: CalendarHeart },
  { title: 'Nova Campanha Meta', url: '/admin/marketing/midia/nova-campanha', icon: Megaphone },
  { title: 'Configurações', url: '/admin/marketing/configuracoes', icon: SlidersHorizontal },
];

interface AdminSidebarProps {
  onSignOut: () => void;
}

export function AdminSidebar({ onSignOut }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  // Rotas que são raiz de uma seção precisam bater exato, senão o startsWith deixa o item
  // "Visão Geral" aceso o tempo todo enquanto se navega pelos filhos dela.
  const exatas = ['/admin', '/admin/maisvencedores'];

  const isActive = (url: string) => {
    if (exatas.includes(url)) return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="+ que Vencedores"
            className="w-8 h-8 rounded-lg object-cover"
          />
          {!collapsed && (
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground">+ que Vencedores</h2>
              <p className="text-[10px] text-muted-foreground">Business OS</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            + que Vencedores
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {maisVencedoresItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Prospecção Instagram
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {socialSellingItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Marketing
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {marketingEmailItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Em breve
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="transition-colors opacity-70"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <UpcomingMeetingsWidget />
        <div className="p-3 pt-0">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            onClick={onSignOut}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
