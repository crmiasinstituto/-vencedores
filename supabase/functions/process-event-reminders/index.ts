// Sends pre-event reminders via WhatsApp (notification_rules).
// Runs every minute. For each event where start_at - reminder_minutes_before <= now()
// and reminder_sent_at IS NULL, fires the 'event_reminder' notification rules.

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

  const stats = { sent: 0, skipped: 0, failed: 0 };

  try {
    const nowIso = new Date().toISOString();
    // Window: events whose reminder time just hit (within the last 90s to catch any
    // minor cron drift). Only process those not yet sent.
    const { data: events } = await supabase.from("calendar_events")
      .select("id, title, start_at, end_at, location, meeting_url, reminder_minutes_before, reminder_whatsapp_phone, lead_id")
      .not("reminder_minutes_before", "is", null)
      .is("reminder_sent_at", null)
      .gte("start_at", nowIso)
      .lte("start_at", new Date(Date.now() + 6 * 3600_000).toISOString()) // horizon 6h forward
      .limit(100);

    for (const ev of (events || [])) {
      try {
        const eventStart = new Date(ev.start_at);
        const reminderAt = new Date(eventStart.getTime() - (ev.reminder_minutes_before || 15) * 60_000);
        if (reminderAt.getTime() > Date.now()) { stats.skipped++; continue; } // not yet time

        // Fetch target phone for the reminder
        let phones: { instance_id: string; phone: string }[] = [];
        if (ev.reminder_whatsapp_phone) {
          // If the lead has a linked WhatsApp, use that as target
          const { data: instance } = await supabase.from("whatsapp_instances")
            .select("id").eq("status", "connected").limit(1).maybeSingle();
          if (instance) phones.push({ instance_id: instance.id, phone: ev.reminder_whatsapp_phone });
        } else {
          const { data: rules } = await supabase.from("notification_rules").select("*")
            .eq("enabled", true).eq("trigger_event", "event_reminder");
          for (const r of (rules || [])) {
            if (r.action_channel === "whatsapp" && r.action_target_phone && r.action_instance_id) {
              phones.push({ instance_id: r.action_instance_id, phone: r.action_target_phone });
            }
          }
        }

        const minutesTo = Math.round((eventStart.getTime() - Date.now()) / 60_000);
        const whenStr = eventStart.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
        const msg = `⏰ LEMBRETE SQUAAD\n\n*${ev.title}*\nComeca em ${minutesTo}min (${whenStr})\n${ev.location ? `📍 ${ev.location}\n` : ""}${ev.meeting_url ? `🔗 ${ev.meeting_url}` : ""}`;

        for (const p of phones) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({
              action: "send_text", instance_id: p.instance_id, phone: p.phone,
              message: msg, sent_by: "event_reminder",
            }),
          }).catch(() => {});
        }

        await supabase.from("calendar_events").update({
          reminder_sent_at: new Date().toISOString(),
        }).eq("id", ev.id);
        stats.sent++;
      } catch (e: any) {
        console.error("[reminders] error:", ev.id, e);
        stats.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[reminders] fatal:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
