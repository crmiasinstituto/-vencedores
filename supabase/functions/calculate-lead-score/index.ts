import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { leadId } = await req.json();
    if (!leadId) throw new Error('leadId required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch lead
    const { data: lead } = await supabase.from('crm_leads').select('*').eq('id', leadId).single();
    if (!lead) throw new Error('Lead not found');

    // Fetch all scoring signals in parallel
    const [activitiesRes, callsRes, meetingsRes, salesRes, participantRes] = await Promise.all([
      supabase.from('crm_activities').select('activity_type, created_at').eq('lead_id', leadId),
      supabase.from('call_history').select('id, duration_seconds, status, ai_sentiment').eq('lead_id', leadId),
      supabase.from('meetings').select('id, status, duration_seconds').eq('lead_id', leadId),
      supabase.from('sales_events').select('id, amount, created_at').eq('crm_lead_id', leadId),
      supabase.from('vhs_participants').select('onboarding_step, created_at')
        .or(`whatsapp.eq.${lead.whatsapp},whatsapp.eq.55${lead.whatsapp.replace(/\D/g, '')}`)
        .limit(1).maybeSingle(),
    ]);

    let score = 0;
    const breakdown: Record<string, number> = {};

    // 1. Has instagram data (+5)
    if (lead.instagram_profile_pic_url) { score += 5; breakdown.instagram = 5; }

    // 2. Has email (+5)
    if (lead.email) { score += 5; breakdown.email = 5; }

    // 3. Activities count (up to +15)
    const activities = activitiesRes.data || [];
    const activityScore = Math.min(activities.length * 2, 15);
    score += activityScore;
    breakdown.activities = activityScore;

    // 4. Calls made/received (up to +20)
    const calls = callsRes.data || [];
    const completedCalls = calls.filter(c => c.status === 'ENDED');
    const callScore = Math.min(completedCalls.length * 5, 20);
    score += callScore;
    breakdown.calls = callScore;

    // 5. Positive sentiment from calls (+5 each, up to 10)
    const positiveCalls = calls.filter(c => c.ai_sentiment?.toLowerCase().includes('positiv'));
    const sentimentScore = Math.min(positiveCalls.length * 5, 10);
    score += sentimentScore;
    breakdown.sentiment = sentimentScore;

    // 6. Meetings (up to +15)
    const meetings = meetingsRes.data || [];
    const completedMeetings = meetings.filter((m: any) => m.status === 'completed');
    const meetingScore = Math.min(completedMeetings.length * 10, 15);
    score += meetingScore;
    breakdown.meetings = meetingScore;

    // 7. Onboarding progress (up to +15)
    const participant = participantRes.data;
    if (participant) {
      const onboardingScore = Math.min(Math.round((participant.onboarding_step / 6) * 15), 15);
      score += onboardingScore;
      breakdown.onboarding = onboardingScore;
    }

    // 8. Purchase made (+15)
    const sales = salesRes.data || [];
    if (sales.length > 0) {
      score += 15;
      breakdown.purchase = 15;
    }

    // 9. Speed: time from creation to first activity (fast = bonus, up to +10)
    if (lead.created_at && activities.length > 0) {
      const createdAt = new Date(lead.created_at).getTime();
      const firstActivity = activities.reduce((min: any, a: any) => {
        const t = new Date(a.created_at).getTime();
        return t < min ? t : min;
      }, Date.now());
      const hoursToFirst = (firstActivity - createdAt) / (1000 * 60 * 60);
      const speedScore = hoursToFirst < 1 ? 10 : hoursToFirst < 24 ? 7 : hoursToFirst < 72 ? 4 : 0;
      score += speedScore;
      breakdown.speed = speedScore;
    }

    // Cap at 100
    score = Math.min(score, 100);

    // Update lead score
    await supabase.from('crm_leads').update({ lead_score: score }).eq('id', leadId);

    return new Response(
      JSON.stringify({ score, breakdown, leadId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Score calculation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
