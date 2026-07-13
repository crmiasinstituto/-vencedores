import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = "https://app.iautomatize.me/api/iwh/92f805b473fba94929c9b73ad72f0843";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log(`Verificando vencimentos para: ${today}`);

    // Buscar pagamentos pendentes que vencem hoje ou já venceram
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        *,
        contract:client_contracts(
          *,
          client:clients(*)
        )
      `)
      .eq('status', 'pending')
      .lte('due_date', today)
      .eq('webhook_sent', false);

    if (paymentsError) {
      console.error('Erro ao buscar pagamentos:', paymentsError);
      throw paymentsError;
    }

    console.log(`Encontrados ${payments?.length || 0} pagamentos para processar`);

    const results = [];

    for (const payment of payments || []) {
      // Atualizar status para overdue se passou da data
      const dueDate = new Date(payment.due_date);
      const todayDate = new Date(today);
      const isOverdue = dueDate < todayDate;

      if (isOverdue && payment.status !== 'overdue') {
        await supabase
          .from('payments')
          .update({ status: 'overdue' })
          .eq('id', payment.id);
      }

      // Preparar payload do webhook
      const payload = {
        evento: "vencimento_parcela",
        timestamp: new Date().toISOString(),
        contrato: {
          id: payment.contract?.id,
          servico: payment.contract?.service_name,
          valor_mensalidade: payment.contract?.monthly_value
        },
        cliente: {
          nome: payment.contract?.client?.company_name,
          responsavel: payment.contract?.client?.responsible_name,
          whatsapp: "" // Pode ser adicionado se tiver na tabela clients
        },
        parcela: {
          id: payment.id,
          valor: payment.value,
          vencimento: payment.due_date,
          referencia: payment.month_reference,
          status: isOverdue ? 'overdue' : payment.status
        }
      };

      console.log(`Enviando webhook para parcela ${payment.id}:`, JSON.stringify(payload, null, 2));

      // Disparar webhook
      try {
        const webhookResponse = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const webhookResult = await webhookResponse.text();
        console.log(`Resposta do webhook:`, webhookResult);

        // Marcar webhook como enviado
        await supabase
          .from('payments')
          .update({ 
            webhook_sent: true, 
            webhook_sent_at: new Date().toISOString(),
            status: isOverdue ? 'overdue' : payment.status
          })
          .eq('id', payment.id);

        results.push({ 
          payment_id: payment.id, 
          success: true, 
          webhook_response: webhookResult 
        });
      } catch (webhookError) {
        console.error(`Erro ao enviar webhook para parcela ${payment.id}:`, webhookError);
        results.push({ 
          payment_id: payment.id, 
          success: false, 
          error: webhookError.message 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
