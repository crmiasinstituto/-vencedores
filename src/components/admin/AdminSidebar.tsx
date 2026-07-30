import { useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { LogOut } from 'lucide-react';
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
import { AREAS_ADMIN, podeVer } from '@/lib/permissoes';
import { usePermissoesAdmin } from '@/hooks/usePermissoesAdmin';

interface AdminSidebarProps {
  onSignOut: () => void;
}

// Os itens vêm de @/lib/permissoes (mesma fonte da tela de colaboradores). O ícone chega como
// string pra aquele arquivo não precisar importar JSX; aqui resolvemos pro componente.
function Icone({ nome, className }: { nome: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nome];
  return C ? <C className={className} /> : <Icons.Circle className={className} />;
}

export function AdminSidebar({ onSignOut }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { permissoes, carregando } = usePermissoesAdmin();

  // Rotas que são raiz de uma seção precisam bater exato, senão o startsWith deixa o item
  // "Visão Geral" aceso o tempo todo enquanto se navega pelos filhos dela.
  const exatas = ['/admin', '/admin/maisvencedores'];

  const isActive = (url: string) => {
    if (exatas.includes(url)) return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  // Enquanto as permissões carregam não mostramos menu nenhum: exibir tudo e depois esconder
  // faria piscar áreas que o colaborador não pode ver.
  const grupos = carregando
    ? []
    : AREAS_ADMIN
        .map((g) => ({ ...g, itens: g.itens.filter((i) => podeVer(permissoes, i.url)) }))
        .filter((g) => g.itens.length > 0);

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
        {grupos.map((grupo) => (
          <SidebarGroup key={grupo.grupo}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {grupo.grupo}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {grupo.itens.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.url)}
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={grupo.grupo === 'Em breve' ? 'transition-colors opacity-70' : 'transition-colors'}
                    >
                      <Icone nome={item.icon} className="w-4 h-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
