import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  GraduationCap,
  DollarSign,
  ArrowLeft,
  Settings,
  Megaphone
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/maisvencedores' },
  { icon: Users, label: 'Membros', path: '/admin/maisvencedores/membros' },
  { icon: Calendar, label: 'Eventos', path: '/admin/maisvencedores/eventos' },
  { icon: GraduationCap, label: 'Treinamentos', path: '/admin/maisvencedores/treinamentos' },
  { icon: DollarSign, label: 'Vendas', path: '/admin/maisvencedores/vendas' },
  { icon: Megaphone, label: 'Anúncios', path: '/admin/maisvencedores/anuncios' },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gold">Admin Panel</h1>
        <p className="text-xs text-muted-foreground">Gerenciamento + que Vencedores</p>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-gold/10 text-gold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 pt-4 border-t border-border">
        <Link
          to="/maisvencedores/membros/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Voltar à Área de Membros</span>
        </Link>
      </div>
    </aside>
  );
}
