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
    const { token, step, data } = await req.json();

    console.log('📝 Salvando step do onboarding:', { token, step, dataKeys: Object.keys(data) });

    if (!token || !step || !data) {
      return new Response(
        JSON.stringify({ error: 'Token, step e data são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client by token
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('onboarding_token', token)
      .single();

    if (clientError || !client) {
      console.error('❌ Cliente não encontrado:', clientError);
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine table based on step
    const stepTables: Record<number, string> = {
      1: 'clients',
      2: 'client_audience',
      3: 'client_products',
      4: 'client_products',
      5: 'client_branding',
      6: 'client_branding',
      7: 'client_operations',
      8: 'client_operations',
      9: 'client_policies',
      10: 'client_goals',
      11: 'client_materials',
      12: 'client_expansion',
    };

    const tableName = stepTables[step];
    if (!tableName) {
      return new Response(
        JSON.stringify({ error: 'Step inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    if (tableName === 'clients') {
      // Update clients table directly
      result = await supabase
        .from('clients')
        .update(data)
        .eq('id', client.id);
    } else {
      // Check if record exists
      const { data: existing } = await supabase
        .from(tableName)
        .select('id')
        .eq('client_id', client.id)
        .maybeSingle();

      if (existing) {
        result = await supabase
          .from(tableName)
          .update(data)
          .eq('client_id', client.id);
      } else {
        result = await supabase
          .from(tableName)
          .insert({ ...data, client_id: client.id });
      }
    }

    if (result.error) {
      console.error('❌ Erro ao salvar dados:', result.error);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar dados', details: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update onboarding step if moving forward
    const updateStepResult = await supabase
      .from('clients')
      .update({ onboarding_step: Math.max(step, 1), status: 'in_progress' })
      .eq('id', client.id)
      .lt('onboarding_step', step + 1);

    console.log('✅ Dados salvos com sucesso');

    return new Response(
      JSON.stringify({ success: true, step, table: tableName }),
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
