// Processes due cadence enrollments. Run via cron every minute (or 5 min).
// For each enrollment with next_action_at <= now() and status = 'active':
//   - Deliver the metadata.message via ai-sales-agent-v2 OR direct WhatsApp
//   - Advance current_step
//   - Schedule next step or mark completed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { processed: 0, sent: 0, failed: 0, completed: 0 };

  try {
    const { data: due } = await supabase.from("ai_agent_cadence_enrollments")
      .select("*, ai_sales_agents(id, name, system_prompt, instance_id, model, provider)")
      .eq("status", "active")
      .lte("next_action_at", new Date().toISOString())
      .order("next_action_at", { ascending: true })
      .limit(50);

    for (const enrollment of (due || [])) {
      stats.processed++;
      try {
        const agent = enrollment.ai_sales_agents;
        const steps = agent?.cadence_steps?.[enrollment.stage] || [];
        const currentStep = steps[enrollment.current_step];

        // adhoc_followup: one-shot message stored in metadata
        if (enrollment.metadata?.type === "adhoc_followup") {
          const { data: lead } = await supabase.from("crm_leads").select("id, whatsapp, name, board_id").eq("id", enrollment.lead_id).maybeSingle();
          if (!lead || !lead.whatsapp) {
            await supabase.from("ai_agent_cadence_enrollments").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", enrollment.id);
            stats.failed++;
            continue;
          }

          const messageText = enrollment.metadata?.message?.trim();
          if (messageText) {
            // Direct send (pre-written message)
            const instanceId = agent?.instance_id;
            if (instanceId) {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ action: "send_text", instance_id: instanceId, phone: lead.whatsapp, message: messageText, lead_id: lead.id }),
              });
              stats.sent++;
            }
          } else {
            // Let the agent generate a followup live
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-sales-agent-v2`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({
                lead_id: lead.id,
                instance_id: agent?.instance_id,
                message_text: `[followup][${enrollment.metadata?.reason || "cadencia"}] Retome a conversa de forma natural, sem mencionar que e um followup automatizado.`,
                agent_id: agent?.id,
              }),
            });
            stats.sent++;
          }

          await supabase.from("ai_agent_cadence_enrollments").update({
            status: "completed",
            completed_at: new Date().toISOString(),
            last_step_at: new Date().toISOString(),
          }).eq("id", enrollment.id);
          stats.completed++;
          continue;
        }

        // Multi-step cadence (configured in agent.cadence_steps[stage])
        if (!currentStep) {
          await supabase.from("ai_agent_cadence_enrollments").update({
            status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", enrollment.id);
          stats.completed++;
          continue;
        }

        const { data: lead } = await supabase.from("crm_leads").select("id, whatsapp, name").eq("id", enrollment.lead_id).maybeSingle();
        if (!lead || !lead.whatsapp) {
          await supabase.from("ai_agent_cadence_enrollments").update({ status: "failed" }).eq("id", enrollment.id);
          stats.failed++;
          continue;
        }

        // Execute step
        if (currentStep.type === "text" && agent?.instance_id) {
          const msg = (currentStep.message || "").replace("{{name}}", lead.name || "").replace("{{first_name}}", (lead.name || "").split(" ")[0] || "");
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ action: "send_text", instance_id: agent.instance_id, phone: lead.whatsapp, message: msg, lead_id: lead.id }),
          });
          stats.sent++;
        } else if (currentStep.type === "ai_message") {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-sales-agent-v2`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({
              lead_id: lead.id,
              instance_id: agent?.instance_id,
              message_text: currentStep.prompt || "[cadencia] Gere a proxima mensagem natural para este lead.",
              agent_id: agent?.id,
            }),
          });
          stats.sent++;
        }

        // Advance
        const nextIdx = enrollment.current_step + 1;
        const nextStep = steps[nextIdx];
        if (!nextStep) {
          await supabase.from("ai_agent_cadence_enrollments").update({
            status: "completed", completed_at: new Date().toISOString(), current_step: nextIdx, last_step_at: new Date().toISOString(),
          }).eq("id", enrollment.id);
          stats.completed++;
        } else {
          const delayH = nextStep.delay_hours || 24;
          await supabase.from("ai_agent_cadence_enrollments").update({
            current_step: nextIdx,
            next_action_at: new Date(Date.now() + delayH * 3600_000).toISOString(),
            last_step_at: new Date().toISOString(),
          }).eq("id", enrollment.id);
        }
      } catch (e: any) {
        console.error("[cadences] error processing enrollment", enrollment.id, e);
        await supabase.from("ai_agent_logs").insert({ agent_id: enrollment.agent_id, lead_id: enrollment.lead_id, log_type: "error", data: { where: "cadence", error: e.message } });
        stats.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[cadences] fatal:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
