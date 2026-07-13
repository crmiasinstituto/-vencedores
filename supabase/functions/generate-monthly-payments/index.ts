import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contract_id, months_count, start_value } = await req.json();

    if (!contract_id || !months_count) {
      throw new Error('contract_id e months_count são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Gerando ${months_count} meses de pagamentos para contrato ${contract_id}`);

    // Buscar contrato
    const { data: contract, error: contractError } = await supabase
      .from('client_contracts')
      .select('*')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      throw new Error('Contrato não encontrado');
    }

    // Buscar última parcela existente para continuar a sequência
    const { data: lastPayment } = await supabase
      .from('payments')
      .select('due_date, month_reference')
      .eq('contract_id', contract_id)
      .order('due_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Determinar data inicial
    let startDate: Date;
    if (lastPayment) {
      startDate = new Date(lastPayment.due_date);
      startDate.setMonth(startDate.getMonth() + 1);
    } else {
      // Começar no próximo mês baseado na data do contrato
      startDate = new Date(contract.contract_date);
      startDate.setDate(contract.due_day);
      if (startDate <= new Date()) {
        startDate.setMonth(startDate.getMonth() + 1);
      }
    }

    // Valor a usar (start_value passado ou valor mensal do contrato)
    const paymentValue = start_value || contract.monthly_value;

    const paymentsToCreate = [];

    for (let i = 0; i < months_count; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      // Garantir que o dia de vencimento está correto
      dueDate.setDate(contract.due_day);

      const monthRef = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;

      paymentsToCreate.push({
        contract_id: contract_id,
        value: paymentValue,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
        month_reference: monthRef,
        webhook_sent: false
      });
    }

    console.log(`Criando ${paymentsToCreate.length} parcelas:`, JSON.stringify(paymentsToCreate, null, 2));

    // Inserir todas as parcelas
    const { data: createdPayments, error: insertError } = await supabase
      .from('payments')
      .insert(paymentsToCreate)
      .select();

    if (insertError) {
      console.error('Erro ao criar parcelas:', insertError);
      throw insertError;
    }

    console.log(`Parcelas criadas com sucesso: ${createdPayments?.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: createdPayments?.length || 0,
        payments: createdPayments 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
