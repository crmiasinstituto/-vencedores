import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { minutes_ahead = 5 } = await req.json().catch(() => ({}));

    const now = new Date();
    const futureTime = new Date(now.getTime() + minutes_ahead * 60000);

    console.log('🔔 Checking calls between', now.toISOString(), 'and', futureTime.toISOString());

    // Busca leads com calls agendadas nos próximos X minutos
    const { data: upcomingCalls, error } = await supabase
      .from('crm_leads')
      .select(`
        id,
        name,
        whatsapp,
        instagram,
        instagram_profile_pic_url,
        scheduled_call_at,
        call_reminder_sent,
        board_id,
        crm_boards!inner(name, color)
      `)
      .not('scheduled_call_at', 'is', null)
      .gte('scheduled_call_at', now.toISOString())
      .lte('scheduled_call_at', futureTime.toISOString())
      .eq('call_reminder_sent', false);

    if (error) {
      console.error('❌ Error fetching calls:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`✅ Found ${upcomingCalls?.length || 0} upcoming calls`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        calls: upcomingCalls || [],
        checked_at: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
