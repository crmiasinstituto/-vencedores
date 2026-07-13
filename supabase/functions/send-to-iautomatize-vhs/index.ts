import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VHSLeadData {
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
  mensagemMotivacional?: string;
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
    const leadData: VHSLeadData = await req.json();
    console.log('📥 Recebendo dados do lead VHS ao Prompt:', leadData.name, leadData.whatsapp);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar URL do webhook na tabela de configs
    let webhookUrl = 'https://app.iautomatize.me/api/iwh/8e10a4bf47804b27165478884c3afafe';

    const { data: config } = await supabase
      .from('webhook_configs')
      .select('webhook_url, is_active')
      .eq('page_slug', 'vhs_ao_prompt')
      .maybeSingle();

    if (config) {
      if (!config.is_active) {
        console.log('⚠️ Webhook VHS desativado nas configurações');
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook desativado', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      webhookUrl = config.webhook_url;
    }

    // Estruturar Instagram data de forma legível para o iAutomatize
    const instagramPerfil = leadData.instagram_data ? {
      bio: leadData.instagram_data.biography || '',
      seguidores: leadData.instagram_data.followers || 0,
      seguindo: leadData.instagram_data.following || 0,
      categoria: leadData.instagram_data.category || '',
      nome_completo: leadData.instagram_data.fullName || '',
      posts_recentes: (leadData.instagram_data.posts || []).slice(0, 5),
      destaques: leadData.instagram_data.highlights || [],
      foto_perfil_url: leadData.instagram_profile_pic_url || ''
    } : null;

    // Payload estruturado com WhatsApp já formatado (55DDXXXXXXXXX)
    const payload = {
      evento: "lead_vhs_ao_prompt",
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
        instagram_perfil: instagramPerfil,
        mensagem_personalizada: leadData.mensagem_personalizada || ''
      },
      fonte: leadData.source || 'vhs_ao_prompt',
      origem: 'imersao_vhs_prompt_2026'
    };

    console.log('📤 Enviando para iAutomatize VHS:', webhookUrl);
    console.log('📦 WhatsApp formatado:', leadData.whatsapp);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('❌ Erro ao enviar para iAutomatize:', response.status, response.statusText);
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ success: false, error: `Erro HTTP ${response.status}`, details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const responseData = await response.text();
    console.log('✅ Resposta do iAutomatize VHS:', responseData);

    // Marcar webhook_sent na tabela leads
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ webhook_sent: true, webhook_sent_at: new Date().toISOString() })
        .eq('whatsapp', leadData.whatsapp)
        .eq('source', 'vhs_ao_prompt')
        .order('created_at', { ascending: false })
        .limit(1);

      if (updateError) {
        console.warn('⚠️ Erro ao marcar webhook_sent:', updateError.message);
      } else {
        console.log('✅ webhook_sent marcado na tabela leads');
      }
    } catch (e) {
      console.warn('⚠️ Erro ao atualizar webhook_sent:', e.message);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook VHS enviado com sucesso', response: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na Edge Function VHS:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
