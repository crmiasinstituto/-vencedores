import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
function normalizePhone(phone: string): string {
  let n = String(phone || '').replace(/\D/g, '');
  if (!n) return '';
  if (!n.startsWith('55') && n.length >= 10 && n.length <= 11) n = '55' + n;
  if (n.startsWith('55') && n.length === 12) n = n.slice(0, 4) + '9' + n.slice(4);
  return n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { name, whatsapp, email } = body;

    if (!name || !whatsapp) {
      return new Response(
        JSON.stringify({ error: "Nome e WhatsApp são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanWhatsapp = normalizePhone(whatsapp);

    // Check for existing participant (deduplication)
    const variants = [cleanWhatsapp];
    if (cleanWhatsapp.startsWith('55')) variants.push(cleanWhatsapp.slice(2));

    const { data: existing } = await supabase
      .from('vhs_participants')
      .select('id, onboarding_token, onboarding_step')
      .in('whatsapp', variants)
      .order('onboarding_step', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Already exists - return existing data
      const onboardingUrl = `https://squaad.lovable.app/vhs/onboarding?token=${existing.onboarding_token}`;
      console.log(`Participant already exists: ${existing.id}, returning existing token`);
      return new Response(
        JSON.stringify({
          success: true,
          participant_id: existing.id,
          onboarding_token: existing.onboarding_token,
          onboarding_url: onboardingUrl,
          already_existed: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to find the original lead by WhatsApp
    const { data: leadData } = await supabase
      .from('leads')
      .select('id, created_at')
      .or(`whatsapp.eq.${cleanWhatsapp},whatsapp.ilike.%${cleanWhatsapp.slice(-11)}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const onboardingToken = generateToken();

    const participantData: Record<string, any> = {
      name,
      whatsapp: cleanWhatsapp,
      email: email || null,
      onboarding_token: onboardingToken,
      payment_confirmed_at: new Date().toISOString(),
    };

    if (leadData) {
      participantData.lead_id = leadData.id;
      participantData.landing_accessed_at = leadData.created_at;
      participantData.popup_filled_at = leadData.created_at;
    }

    const { data: participant, error: insertError } = await supabase
      .from('vhs_participants')
      .insert(participantData)
      .select('id, onboarding_token')
      .single();

    if (insertError) {
      console.error('Error creating participant:', insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar participante", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const onboardingUrl = `https://squaad.lovable.app/vhs/onboarding?token=${onboardingToken}`;
    console.log(`Participant created: ${participant.id} with token: ${onboardingToken}`);

    return new Response(
      JSON.stringify({
        success: true,
        participant_id: participant.id,
        onboarding_token: onboardingToken,
        onboarding_url: onboardingUrl
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
