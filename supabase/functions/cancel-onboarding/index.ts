// ============================================================
// cancel-onboarding
//
// Cancela um onboarding Método SQUAAD pra parar mensagens automáticas.
// Marca status='cancelled' + cancelled_at + cancelled_reason.
// O cron billing-reminders ignora 'cancelled', então não dispara mais.
//
// Body: { enrollment_id: string, reason?: string }
// verify_jwt: false (admin via UI)
// ============================================================

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Input {
  enrollment_id: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body: Input = await req.json();
    if (!body.enrollment_id) return json({ error: "enrollment_id é obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Marca como cancelled (não deleta — preserva histórico/auditoria)
    const { data, error } = await supabase
      .from("metodo_squaad_enrollments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_reason: body.reason || null,
      })
      .eq("id", body.enrollment_id)
      .select("id, name, crm_lead_id")
      .single();

    if (error) {
      console.error("[cancel-onboarding]", error);
      return json({ error: error.message }, 500);
    }

    // Loga atividade no CRM
    if (data?.crm_lead_id) {
      await supabase.from("crm_activities").insert({
        lead_id: data.crm_lead_id,
        activity_type: "onboarding_cancelled",
        description: `Onboarding Método SQUAAD cancelado${body.reason ? `: ${body.reason}` : ""}`,
        metadata: { enrollment_id: body.enrollment_id },
      });
    }

    return json({ ok: true, enrollment: data });
  } catch (e) {
    console.error("[cancel-onboarding] fatal:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
