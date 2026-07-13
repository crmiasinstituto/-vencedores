import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  instagram: string | null;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate method
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Método não permitido. Use GET.' 
        }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get query parameters
    const url = new URL(req.url);
    const whatsapp = url.searchParams.get('whatsapp');
    const name = url.searchParams.get('name');
    const leadId = url.searchParams.get('lead_id');

    // Validate that at least one parameter is provided
    if (!whatsapp && !name && !leadId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Parâmetro obrigatório: whatsapp, name ou lead_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabase
      .from('leads')
      .select('id, name, whatsapp, instagram, created_at');

    // Build query based on provided parameters
    if (leadId) {
      query = query.eq('id', leadId);
      console.log(`Buscando lead por ID: ${leadId}`);
    } else if (whatsapp) {
      // Normalize WhatsApp number (remove spaces and special characters)
      const normalizedWhatsapp = whatsapp.replace(/[\s\-\(\)]/g, '');
      query = query.eq('whatsapp', normalizedWhatsapp);
      console.log(`Buscando lead por WhatsApp: ${normalizedWhatsapp}`);
    } else if (name) {
      // Case insensitive search by name
      query = query.ilike('name', `%${name}%`);
      console.log(`Buscando lead por nome: ${name}`);
    }

    // Execute query
    const { data: leads, error } = await query;

    if (error) {
      console.error('Erro na consulta:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro interno do servidor' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if any leads were found
    if (!leads || leads.length === 0) {
      const searchParam = leadId ? `ID: ${leadId}` : whatsapp ? `WhatsApp: ${whatsapp}` : `Nome: ${name}`;
      console.log(`Nenhum lead encontrado para ${searchParam}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Lead não encontrado',
          searched_by: searchParam
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If searching by name, return multiple results if found
    if (name && leads.length > 1) {
      console.log(`Encontrados ${leads.length} leads para o nome: ${name}`);
      
      const leadsData = leads.map(lead => ({
        id: lead.id,
        name: lead.name,
        whatsapp: lead.whatsapp,
        instagram: lead.instagram,
        created_at: lead.created_at
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          multiple_results: true,
          count: leads.length,
          leads: leadsData
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return single result
    const lead = leads[0] as Lead;
    console.log(`Lead encontrado: ${lead.name} - Instagram: ${lead.instagram || 'não informado'}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead: {
          id: lead.id,
          name: lead.name,
          whatsapp: lead.whatsapp,
          instagram: lead.instagram,
          created_at: lead.created_at
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro não tratado:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})