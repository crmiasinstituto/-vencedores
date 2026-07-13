import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  severity: 'info' | 'warn' | 'critical' | 'success';
  metadata: any;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

const SEV_COLOR: Record<string, string> = {
  info: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  warn: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  critical: 'bg-red-500/15 text-red-500 border-red-500/30',
  success: 'bg-green-500/15 text-green-500 border-green-500/30',
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min atras`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atras`;
  const d = Math.floor(h / 24);
  return `${d}d atras`;
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const { data } = await db.from('admin_notifications')
      .select('*').is('dismissed_at', null)
      .order('created_at', { ascending: false }).limit(30);
    setItems(data || []);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 45_000);
    // Realtime subscription
    const ch = supabase.channel('admin-notif')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications' }, () => {
        load();
      }).subscribe();
    return () => { clearInterval(i); supabase.removeChannel(ch); };
  }, [load]);

  const unread = items.filter(n => !n.read_at).length;

  const markRead = async (id: string) => {
    await db.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const markAllRead = async () => {
    const ids = items.filter(n => !n.read_at).map(n => n.id);
    if (!ids.length) return;
    await db.from('admin_notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    load();
    toast.success(`${ids.length} notificacao(oes) marcada(s) como lida(s)`);
  };

  const dismiss = async (id: string) => {
    await db.from('admin_notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.filter(n => n.id !== id));
  };

  const dismissAll = async () => {
    const ids = items.map(n => n.id);
    if (!ids.length) return;
    await db.from('admin_notifications').update({ dismissed_at: new Date().toISOString() }).in('id', ids);
    setItems([]);
  };

  const openItem = async (n: Notification) => {
    if (!n.read_at) await markRead(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notificacoes">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="text-sm font-bold">Notificacoes {unread > 0 && <span className="text-muted-foreground">({unread})</span>}</p>
          <div className="flex gap-1">
            {unread > 0 && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={markAllRead} title="Marcar todas como lidas">
                <CheckCheck className="w-3.5 h-3.5" />
              </Button>
            )}
            {items.length > 0 && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={dismissAll} title="Limpar todas">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhuma notificacao</p>
            </div>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                onClick={() => openItem(n)}
                className={`group p-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors relative ${!n.read_at ? 'bg-primary/5' : ''}`}
              >
                {!n.read_at && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />}
                <div className="flex items-start justify-between gap-2 pl-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className={`text-[9px] uppercase ${SEV_COLOR[n.severity] || ''}`}>
                        {n.severity}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{relTime(n.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    {n.description && <p className="text-[11px] text-muted-foreground mt-0.5">{n.description}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 flex-shrink-0"
                    title="Dispensar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
