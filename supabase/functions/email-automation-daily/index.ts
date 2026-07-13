/**
 * email-automation-daily — Cron diário (12h UTC = 9h Brasil)
 *
 * Para cada lead:
 *  - Se birthday == hoje → dispara evento `lead_birthday`
 *  - Se last_interaction_at >= N dias (filter de automações ativas) → dispara `lead_inactive`
 *
 * Não envia email direto. Chama email-automation-trigger pra criar runs.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function triggerEvent(event: string, leadId: string, context: any = {}) {
  await fetch(`${SUPABASE_URL}/functions/v1/email-automation-trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ event, lead_id: leadId, context }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date();
  const todayBR = new Date(today.getTime() - 3 * 60 * 60 * 1000); // UTC-3
  const mmdd = `${String(todayBR.getUTCMonth() + 1).padStart(2, "0")}-${String(todayBR.getUTCDate()).padStart(2, "0")}`;

  let triggered = 0;

  try {
    // ===== 1) BIRTHDAY =====
    const { data: birthdayLeads } = await supabase
      .from("crm_leads")
      .select("id, birthday")
      .not("birthday", "is", null);

    for (const lead of (birthdayLeads || []) as any[]) {
      if (!lead.birthday) continue;
      const lmmdd = String(lead.birthday).slice(5, 10); // YYYY-MM-DD → MM-DD
      if (lmmdd === mmdd) {
        await triggerEvent("lead_birthday", lead.id, { birthday: lead.birthday });
        triggered++;
      }
    }

    // ===== 2) INACTIVE =====
    // Para cada automation ativa com trigger_event='lead_inactive', pega o threshold de dias
    // do filter e dispara pros leads que match.
    const { data: inactiveAutos } = await supabase
      .from("email_automations")
      .select("id, trigger_filter")
      .eq("is_active", true)
      .eq("trigger_event", "lead_inactive");

    const thresholds = new Set<number>();
    for (const a of (inactiveAutos || []) as any[]) {
      const d = Number(a.trigger_filter?.days || 0);
      if (d > 0) thresholds.add(d);
    }

    for (const days of thresholds) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data: inactives } = await supabase
        .from("crm_leads")
        .select("id, last_interaction_at, created_at")
        .or(`last_interaction_at.lte.${cutoff},and(last_interaction_at.is.null,created_at.lte.${cutoff})`)
        .limit(500);

      for (const lead of (inactives || []) as any[]) {
        await triggerEvent("lead_inactive", lead.id, { days, last_interaction_at: lead.last_interaction_at });
        triggered++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: mmdd, triggered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[email-automation-daily]", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
