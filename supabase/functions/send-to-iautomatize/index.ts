import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadData {
  name: string;
  whatsapp: string;
  instagram?: string;
  ddd?: string;
  estado?: string;
  cidade?: string;
  region?: string;
  emoji?: string;
  cor?: string;
  mensagem?: string;
  source?: string;
  instagram_data?: any;
  instagram_profile_pic_url?: string;
  mensagem_personalizada?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const leadData: LeadData = await req.json();
    console.log('Recebendo dados do lead:', leadData);

    // Try to get webhook URL from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let webhookUrl = 'https://app.iautomatize.me/api/iwh/8e10a4bf47804b27165478884c3afafe';

    const { data: config } = await supabase
      .from('webhook_configs')
      .select('webhook_url, is_active')
      .eq('page_slug', 'landing_page')
      .maybeSingle();

    if (config) {
      if (!config.is_active) {
        console.log('⚠️ Webhook landing page desativado');
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook desativado', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      webhookUrl = config.webhook_url;
    }

    const payload = {
      evento: "novo_lead",
      timestamp: new Date().toISOString(),
      lead: {
        nome: leadData.name,
        whatsapp: leadData.whatsapp,
        instagram: leadData.instagram || '',
        ddd: leadData.ddd || '',
        regiao: {
          estado: leadData.estado || '',
          cidade: leadData.cidade || '',
          mensagem: leadData.mensagem || '',
          emoji: leadData.emoji || '',
          cor: leadData.cor || ''
        },
        instagram_dados: leadData.instagram_data || null,
        foto_perfil_url: leadData.instagram_profile_pic_url || '',
        mensagem_personalizada: leadData.mensagem_personalizada || ''
      },
      fonte: leadData.source || 'popup_ddd',
      origem: 'squaad_empresarial'
    };

    console.log('Enviando para iAutomatize:', webhookUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Erro ao enviar para iAutomatize:', response.status, response.statusText);
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ success: false, error: `Erro HTTP ${response.status}`, details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const responseData = await response.text();
    console.log('Resposta do iAutomatize:', responseData);

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook enviado com sucesso', response: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
