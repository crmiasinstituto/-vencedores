// Gera notificações admin baseadas em eventos do CRM/agenda.
// Roda via cron a cada 10 min. Dedup: mesmo type+lead_id+meeting_id nas ultimas 12h nao recria.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function exists(supabase: any, dedupKey: string): Promise<boolean> {
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data } = await supabase.from("admin_notifications")
    .select("id").eq("metadata->>dedup_key", dedupKey).gte("created_at", since).limit(1);
  return (data || []).length > 0;
}

async function insertNotif(supabase: any, n: any) {
  if (await exists(supabase, n.metadata.dedup_key)) return false;
  await supabase.from("admin_notifications").insert(n);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { created: 0, skipped: 0 };
  const now = new Date();

  try {
    // 1) Novas reuniões agendadas (últimas 15min)
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60_000).toISOString();
    const { data: newMeetings } = await supabase.from("meetings")
      .select("id, title, scheduled_at, lead_id, metadata")
      .gte("created_at", fifteenMinAgo).eq("status", "scheduled");
    for (const m of (newMeetings || [])) {
      const created = await insertNotif(supabase, {
        type: "meeting_scheduled",
        title: `Nova call agendada: ${m.title}`,
        description: `${new Date(m.scheduled_at).toLocaleString("pt-BR")} — ${m.metadata?.scheduled_by_agent ? "pelo agente" : "manualmente"}`,
        link: m.lead_id ? `/admin/crm?lead=${m.lead_id}` : "/admin/agenda",
        severity: "success",
        lead_id: m.lead_id, meeting_id: m.id,
        metadata: { dedup_key: `meeting_scheduled_${m.id}` },
      });
      created ? stats.created++ : stats.skipped++;
    }

    // 2) Leads quentes parados (score>=70, sem update em 48h)
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400_000).toISOString();
    const { data: hotStuck } = await supabase.from("crm_leads")
      .select("id, name, lead_score, updated_at")
      .gte("lead_score", 70).is("closed_at", null).lte("updated_at", twoDaysAgo).limit(10);
    for (const l of (hotStuck || [])) {
      const created = await insertNotif(supabase, {
        type: "hot_lead_stuck",
        title: `🔥 ${l.name || "Lead"} quente parado`,
        description: `Score ${l.lead_score} sem movimento ha 2+ dias`,
        link: `/admin/crm?lead=${l.id}`,
        severity: "critical",
        lead_id: l.id,
        metadata: { dedup_key: `hot_stuck_${l.id}_${new Date().toISOString().slice(0, 10)}` },
      });
      created ? stats.created++ : stats.skipped++;
    }

    // 3) No-shows das últimas 2h
    const twoHAgo = new Date(now.getTime() - 2 * 3600_000).toISOString();
    const { data: noShows } = await supabase.from("meetings")
      .select("id, title, scheduled_at, lead_id")
      .lt("scheduled_at", now.toISOString()).gte("scheduled_at", twoHAgo).is("started_at", null);
    for (const m of (noShows || [])) {
      const created = await insertNotif(supabase, {
        type: "no_show",
        title: `No-show: ${m.title}`,
        description: "Lead nao compareceu. Reagende ou marque como perdido.",
        link: m.lead_id ? `/admin/crm?lead=${m.lead_id}` : "/admin/agenda",
        severity: "critical",
        lead_id: m.lead_id, meeting_id: m.id,
        metadata: { dedup_key: `noshow_${m.id}` },
      });
      created ? stats.created++ : stats.skipped++;
    }

    // 4) Tasks atrasadas (1x por dia por task)
    const { data: overdueTasks } = await supabase.from("tasks")
      .select("id, title, lead_id, due_date")
      .is("completed_at", null).lt("due_date", now.toISOString()).limit(20);
    for (const t of (overdueTasks || [])) {
      const daysLate = Math.floor((now.getTime() - new Date(t.due_date).getTime()) / 86400_000);
      const created = await insertNotif(supabase, {
        type: "overdue_task",
        title: `Tarefa atrasada: ${t.title}`,
        description: daysLate > 0 ? `${daysLate} dia(s) em atraso` : "Venceu hoje",
        link: t.lead_id ? `/admin/crm?lead=${t.lead_id}` : "/admin/agenda",
        severity: daysLate > 3 ? "critical" : "warn",
        lead_id: t.lead_id,
        metadata: { dedup_key: `overdue_task_${t.id}_${new Date().toISOString().slice(0, 10)}` },
      });
      created ? stats.created++ : stats.skipped++;
    }

    // 5) Lead qualificado pelo agente (últimas 15min, via ai_agent_logs)
    const { data: qualLogs } = await supabase.from("ai_agent_logs")
      .select("id, lead_id, data, created_at")
      .eq("log_type", "tool_call")
      .gte("created_at", fifteenMinAgo)
      .limit(50);
    for (const log of (qualLogs || [])) {
      if (log.data?.name !== "qualify_bant" || !log.data?.result?.ok) continue;
      if ((log.data?.result?.score || 0) < 75) continue;
      const { data: lead } = await supabase.from("crm_leads").select("name, whatsapp").eq("id", log.lead_id).maybeSingle();
      const created = await insertNotif(supabase, {
        type: "lead_qualified",
        title: `⭐ Lead qualificado: ${lead?.name || "s/nome"}`,
        description: `Score ${log.data.result.score}/100 — fale com ele logo`,
        link: `/admin/crm?lead=${log.lead_id}`,
        severity: "success",
        lead_id: log.lead_id,
        metadata: { dedup_key: `qualified_${log.lead_id}` },
      });
      created ? stats.created++ : stats.skipped++;
    }

    // 6) Handoffs do agente (lead pediu humano)
    const { data: handoffLogs } = await supabase.from("ai_agent_logs")
      .select("id, lead_id, data, created_at")
      .eq("log_type", "pause")
      .gte("created_at", fifteenMinAgo)
      .limit(20);
    for (const log of (handoffLogs || [])) {
      const reason = log.data?.reason;
      if (!["keyword_handoff", "bot"].includes(reason)) continue;
      const { data: lead } = await supabase.from("crm_leads").select("name").eq("id", log.lead_id).maybeSingle();
      const created = await insertNotif(supabase, {
        type: "agent_handoff",
        title: reason === "bot" ? `🤖 Bot detectado: ${lead?.name || "lead"}` : `🙋 Handoff: ${lead?.name || "lead"} pediu humano`,
        description: reason === "bot" ? "Carol pausou a conversa — provavelmente e um bot." : "Carol pausou e te passou o atendimento.",
        link: `/admin/crm?lead=${log.lead_id}`,
        severity: reason === "bot" ? "warn" : "critical",
        lead_id: log.lead_id,
        metadata: { dedup_key: `handoff_${log.lead_id}_${reason}` },
      });
      created ? stats.created++ : stats.skipped++;
    }

    return new Response(JSON.stringify({ ok: true, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[generate-notif] error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
