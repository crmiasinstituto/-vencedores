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
  UserPlus,
  BookOpen,
  Bot,
  Settings,
  Crosshair,
  UserCheck,
  GraduationCap,
  CalendarDays,
  TrendingDown,
  Dumbbell,
  Sparkles,
  Brain,
  Presentation,
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
import squaadLogo from '@/assets/squaad-logo.jpeg';

const menuItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Agenda', url: '/admin/agenda', icon: CalendarDays },
  { title: 'CRM de Vendas', url: '/admin/crm', icon: Kanban },
  { title: 'Central 360', url: '/admin/clientes', icon: Users },
  { title: 'Onboarding', url: '/admin/onboarding', icon: UserPlus },
  { title: 'Vendas', url: '/admin/vendas', icon: ShoppingCart },
  { title: 'Funil', url: '/admin/funil', icon: TrendingDown },
  { title: 'Financeiro', url: '/admin/recebimentos', icon: DollarSign },
  { title: 'Projeções', url: '/admin/financeiro', icon: TrendingUp },
  { title: 'WhatsApp', url: '/admin/whatsapp', icon: MessageSquare },
  { title: 'Ligacoes', url: '/admin/ligacoes', icon: Phone },
  { title: 'Grupos WA', url: '/admin/grupos', icon: Users },
  { title: 'Playbooks', url: '/admin/playbooks', icon: BookOpen },
  { title: 'Agentes IA', url: '/admin/agentes', icon: Bot },
  { title: 'Roleplay', url: '/admin/roleplay', icon: Dumbbell },
  { title: 'Equipe', url: '/admin/equipe', icon: Users },
  { title: 'Prospecao', url: '/admin/prospeccao', icon: Crosshair },
  { title: 'Membros', url: '/admin/membros', icon: GraduationCap },
  { title: 'Acervo do Time', url: '/admin/acervo', icon: HardDrive },
  { title: 'Credenciamento', url: '/admin/credenciamento', icon: UserCheck },
];

const presentationItems = [
  {
    title: 'Masterclass IA',
    url: '/apresentacoes/masterclass-ia-negocios',
    icon: Presentation,
    external: true,
  },
  {
    title: 'Reprograme 10x',
    url: '/apresentacoes/reprograme-10x.html',
    icon: Presentation,
    external: true,
  },
  {
    title: 'Reprograme · Configurações',
    url: '/admin/apresentacoes/reprograme-10x',
    icon: Settings,
    external: false,
  },
  {
    title: 'Como estruturar um evento',
    url: '/admin/apresentacoes/estruturar-evento',
    icon: CalendarHeart,
    external: false,
  },
];

const secondaryItems = [
  { title: 'Marketing IA', url: '/admin/marketing-ia', icon: Brain },
  { title: 'Marketing', url: '/admin/marketing', icon: Megaphone },
  { title: 'Carrossel Viral', url: '/admin/carrossel-viral', icon: Sparkles },
  { title: 'Operações', url: '/admin/operacoes', icon: ClipboardList },
  { title: 'Recrutamento', url: '/admin/recrutamento', icon: UserCheck },
  { title: 'Configurações', url: '/admin/configuracoes', icon: Settings },
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

  const isActive = (url: string) => {
    if (url === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={squaadLogo}
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
            Palestras / Apresentação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {presentationItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    onClick={() => item.external
                      ? window.open(item.url, '_blank', 'noopener,noreferrer')
                      : navigate(item.url)}
                    isActive={!item.external && isActive(item.url)}
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
