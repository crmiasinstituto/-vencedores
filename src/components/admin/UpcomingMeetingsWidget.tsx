import { useState, useEffect } from 'react';
import { Video, Clock, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/components/ui/sidebar';

interface UpcomingMeeting {
  id: string;
  title: string;
  scheduled_at: string;
  meeting_url: string | null;
  lead_name: string | null;
}

function getMeetingCategory(title: string): { color: string; border: string; bg: string; label: string } {
  const t = title.toLowerCase();
  if (t.includes('implanta')) return { color: 'text-blue-400', border: 'border-l-blue-500', bg: 'bg-blue-500/10', label: '🔧 Implantação' };
  if (t.includes('comercial') || t.includes('venda') || t.includes('sales')) return { color: 'text-green-400', border: 'border-l-green-500', bg: 'bg-green-500/10', label: '💰 Comercial' };
  if (t.includes('suporte') || t.includes('support')) return { color: 'text-purple-400', border: 'border-l-purple-500', bg: 'bg-purple-500/10', label: '🛠 Suporte' };
  if (t.includes('onboarding')) return { color: 'text-cyan-400', border: 'border-l-cyan-500', bg: 'bg-cyan-500/10', label: '🚀 Onboarding' };
  return { color: 'text-amber-400', border: 'border-l-amber-500', bg: 'bg-amber-500/10', label: '📅 Reunião' };
}

function MiniCountdown({ target }: { target: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const diff = differenceInSeconds(new Date(target), now);
  if (diff <= 0) return <span className="text-destructive text-xs font-bold animate-pulse">🔴 AGORA</span>;

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  // Urgency colors
  const urgent = diff < 600; // < 10 min
  const soon = diff < 3600; // < 1 hour

  return (
    <span className={`text-xs font-mono font-bold ${urgent ? 'text-red-400 animate-pulse' : soon ? 'text-amber-400' : 'text-muted-foreground'}`}>
      {h > 0 && `${h}h `}{m}m {String(s).padStart(2, '0')}s
    </span>
  );
}

export function UpcomingMeetingsWidget() {
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([]);
  const [expanded, setExpanded] = useState(true);
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('meetings' as any)
        .select('id, title, scheduled_at, meeting_url, lead_id')
        .eq('status', 'scheduled')
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(5);

      if (data) {
        const leadIds = (data as any[]).map((m: any) => m.lead_id).filter(Boolean);
        let leadMap: Record<string, string> = {};
        if (leadIds.length > 0) {
          const { data: leads } = await supabase
            .from('crm_leads')
            .select('id, name')
            .in('id', leadIds);
          if (leads) {
            leadMap = Object.fromEntries(leads.map(l => [l.id, l.name]));
          }
        }

        setMeetings((data as any[]).map((m: any) => ({
          id: m.id,
          title: m.title,
          scheduled_at: m.scheduled_at,
          meeting_url: m.meeting_url,
          lead_name: leadMap[m.lead_id] || null,
        })));
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (meetings.length === 0 || collapsed) return null;

  return (
    <div className="mx-2 mb-2 rounded-xl border border-border bg-card/90 backdrop-blur-sm overflow-hidden shadow-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/15">
            <Video className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Reuniões</span>
          <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-primary/10 text-primary">
            {meetings.length}
          </Badge>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {meetings.map(m => {
            const cat = getMeetingCategory(m.title);
            return (
              <div
                key={m.id}
                className={`relative rounded-lg ${cat.bg} border border-border/50 border-l-[3px] ${cat.border} overflow-hidden transition-all hover:shadow-md`}
              >
                <div className="p-3">
                  {/* Category badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${cat.color}`}>
                      {cat.label}
                    </span>
                    <MiniCountdown target={m.scheduled_at} />
                  </div>

                  {/* Title */}
                  <p className="text-sm font-medium text-foreground leading-tight mb-1">{m.title}</p>

                  {/* Lead + Time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {m.lead_name && (
                        <span className="text-xs text-muted-foreground">👤 {m.lead_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(m.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {/* Join button */}
                  {m.meeting_url && (
                    <a
                      href={m.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Entrar na Reunião
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}