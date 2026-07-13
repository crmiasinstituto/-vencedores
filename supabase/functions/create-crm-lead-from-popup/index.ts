import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
function waCanon(raw?: string | null): string {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return '';
  if (!n.startsWith('55') && n.length >= 10 && n.length <= 11) n = '55' + n;
  if (n.startsWith('55') && n.length === 12) n = n.slice(0, 4) + '9' + n.slice(4);
  return n;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { name, whatsapp: whatsappRaw, instagram, instagram_profile_pic_url, source_lead_id } = await req.json();
    const whatsapp = waCanon(whatsappRaw);

    console.log('📝 Creating CRM lead from popup:', { name, whatsapp, instagram });

    // Busca board "vhs-imersao"
    const { data: board, error: boardError } = await supabase
      .from('crm_boards')
      .select('id, name')
      .eq('slug', 'vhs-imersao')
      .single();

    if (boardError || !board) {
      console.error('❌ Board not found:', boardError);
      return new Response(
        JSON.stringify({ success: false, error: 'Board not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Busca primeira coluna (Captado)
    const { data: firstColumn, error: columnError } = await supabase
      .from('crm_columns')
      .select('id, name')
      .eq('board_id', board.id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single();

    if (columnError || !firstColumn) {
      console.error('❌ Column not found:', columnError);
      return new Response(
        JSON.stringify({ success: false, error: 'Column not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verifica se lead já existe (mesmo whatsapp no mesmo board)
    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id')
      .eq('board_id', board.id)
      .eq('whatsapp', whatsapp)
      .maybeSingle();

    if (existingLead) {
      console.log('⚠️ Lead already exists in CRM:', existingLead.id);
      return new Response(
        JSON.stringify({ success: true, lead_id: existingLead.id, message: 'Lead already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cria lead no CRM
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .insert({
        board_id: board.id,
        column_id: firstColumn.id,
        name,
        whatsapp,
        instagram: instagram || null,
        instagram_profile_pic_url: instagram_profile_pic_url || null,
        source: 'vhs_popup',
        source_lead_id: source_lead_id || null,
        tags: ['VHS Popup'],
        lead_score: instagram ? 10 : 0
      })
      .select()
      .single();

    if (leadError) {
      console.error('❌ Error creating lead:', leadError);
      return new Response(
        JSON.stringify({ success: false, error: leadError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ CRM Lead created:', lead.id);

    // Registra atividade
    const { error: activityError } = await supabase
      .from('crm_activities')
      .insert({
        lead_id: lead.id,
        board_id: board.id,
        activity_type: 'lead_created',
        description: `Lead ${name} capturado via popup VHS`,
        board_name: board.name,
        to_column_name: firstColumn.name,
        metadata: { source: 'vhs_popup', instagram }
      });

    if (activityError) {
      console.warn('⚠️ Error creating activity:', activityError);
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
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
