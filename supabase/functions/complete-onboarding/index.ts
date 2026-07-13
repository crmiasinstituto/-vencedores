import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    console.log('🎉 Completando onboarding para token:', token);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client by token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(`
        *,
        client_audience (*),
        client_products (*),
        client_branding (*),
        client_operations (*),
        client_policies (*),
        client_goals (*),
        client_materials (*),
        client_technical (*),
        client_expansion (*)
      `)
      .eq('onboarding_token', token)
      .single();

    if (clientError || !client) {
      console.error('❌ Cliente não encontrado:', clientError);
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as completed
    const { error: updateError } = await supabase
      .from('clients')
      .update({ status: 'completed', onboarding_step: 12 })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao completar onboarding' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate summary
    const summary = {
      company: client.company_name,
      responsible: client.responsible_name,
      completed_at: new Date().toISOString(),
      sections_completed: 12,
      ai_name: client.client_branding?.[0]?.ai_name || 'Assistente Virtual',
      ai_tone: client.client_branding?.[0]?.brand_tone || 'Profissional',
    };

    console.log('✅ Onboarding completado:', summary);

    // Here you could send a webhook notification to your team
    // Example: notify Slack, email, etc.

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Onboarding concluído com sucesso!',
        summary,
        client_data: client
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na edge function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
