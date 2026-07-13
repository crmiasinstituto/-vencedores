import { useEffect, useRef, useState } from 'react';
import { Video, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StartMeetingModal } from './StartMeetingModal';

interface UpcomingMeeting {
  id: string;
  title: string;
  scheduled_at: string;
  meeting_url: string | null;
  lead_id: string | null;
  lead_name?: string;
  metadata: any;
}

export const MeetingReminderAlert = () => {
  const notifiedIds = useRef<Set<string>>(new Set());
  const notifiedNowIds = useRef<Set<string>>(new Set());
  const [activeMeeting, setActiveMeeting] = useState<UpcomingMeeting | null>(null);

  useEffect(() => {
    const checkMeetings = async () => {
      const now = new Date();
      const in16min = new Date(now.getTime() + 16 * 60 * 1000);

      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, scheduled_at, meeting_url, lead_id, metadata')
        .eq('status', 'scheduled')
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', in16min.toISOString());

      if (error || !data) return;

      for (const meeting of data) {
        const scheduledAt = new Date(meeting.scheduled_at!);
        const diffMin = (scheduledAt.getTime() - now.getTime()) / 60000;

        // Fetch lead name
        let leadName = '';
        if (meeting.lead_id) {
          const { data: lead } = await supabase
            .from('crm_leads')
            .select('name')
            .eq('id', meeting.lead_id)
            .single();
          leadName = lead?.name || '';
        }

        const key15 = `15-${meeting.id}`;
        const keyNow = `now-${meeting.id}`;

        // Alert at 15 min
        if (diffMin <= 15 && diffMin > 1 && !notifiedIds.current.has(key15)) {
          notifiedIds.current.add(key15);
          const mins = Math.round(diffMin);
          toast(`📅 Reunião em ${mins} min`, {
            description: `${meeting.title}${leadName ? ` com ${leadName}` : ''}`,
            duration: 30000,
            action: {
              label: 'Iniciar',
              onClick: () => setActiveMeeting({ ...meeting, lead_name: leadName } as UpcomingMeeting),
            },
          });
        }

        // Alert NOW
        if (diffMin <= 1 && !notifiedNowIds.current.has(keyNow)) {
          notifiedNowIds.current.add(keyNow);
          toast.warning('🔴 Reunião AGORA!', {
            description: `${meeting.title}${leadName ? ` com ${leadName}` : ''}`,
            duration: 60000,
            action: {
              label: 'Iniciar',
              onClick: () => setActiveMeeting({ ...meeting, lead_name: leadName } as UpcomingMeeting),
            },
          });
        }
      }
    };

    checkMeetings();
    const interval = setInterval(checkMeetings, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!activeMeeting) return null;

  return (
    <StartMeetingModal
      isOpen={!!activeMeeting}
      onClose={() => setActiveMeeting(null)}
      meetingId={activeMeeting.id}
      meetingUrl={activeMeeting.meeting_url || undefined}
      meetingTitle={activeMeeting.title}
      leadId={activeMeeting.lead_id || undefined}
      onCompleted={() => setActiveMeeting(null)}
    />
  );
};
