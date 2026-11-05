import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface TriggerBody {
  event: string;
  lead_id?: string;
  context?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: TriggerBody = await req.json();
    const { event, lead_id, context = {} } = body;

    if (!event) throw new Error("event obrigatório");
    if (!lead_id) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "no lead_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: automations } = await supabase
      .from("email_automations")
      .select("id, trigger_event, trigger_filter, flow_json")
      .eq("is_active", true)
      .eq("trigger_event", event);

    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ ok: true, triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let triggered = 0;
    for (const auto of automations) {
      const flow = auto.flow_json || {};
      const nodes = flow.nodes || [];
      const triggerNode = nodes.find((n: any) => n.type === "trigger");
      if (!triggerNode) continue;

      const filter = auto.trigger_filter || {};
      let matches = true;

      // Filtros por evento — ignora se o context não bate
      // lead_board_changed manda o quadro de destino em to_board (não em board_id)
      const boardDoEvento = context.board_id ?? context.to_board;
      if (filter.board_id && boardDoEvento !== filter.board_id) matches = false;
      if (filter.column_id) {
        const target = context.to_column || context.column_id;
        if (target !== filter.column_id) matches = false;
      }
      if (filter.source && context.source !== filter.source) matches = false;
      if (filter.tag && context.tag !== filter.tag) matches = false;

      // Score threshold: dispara só quando o novo score cruza o limiar (não toda alteração)
      if (event === 'lead_score_changed' && filter.score_threshold) {
        const t = Number(filter.score_threshold);
        const oldS = Number(context.old_score || 0);
        const newS = Number(context.new_score || 0);
        if (!(oldS < t && newS >= t)) matches = false;
      }

      // Engajamento email: opcionalmente filtra por campanha específica
      if ((event === 'email_opened' || event === 'email_clicked') && filter.campaign_id) {
        if (context.campaign_id !== filter.campaign_id) matches = false;
      }

      if (!matches) continue;

      const agora = new Date().toISOString();
      const { error } = await supabase
        .from("email_automation_runs")
        .insert({
          automation_id: auto.id,
          lead_id,
          current_node_id: triggerNode.id,
          scheduled_next_at: agora,
          status: "active",
          context: { trigger_event: event, ...context },
        });
      if (!error) {
        triggered++;
        continue;
      }

      // Um run por (automação, lead). Lead que dispara de novo (ex: preencheu a página outra vez)
      // recomeça do gatilho SEMPRE, mesmo no meio do fluxo: cada inscrição recebe o fluxo inteiro.
      // O started_at novo é o que libera o e-mail de novo (ver guard no email-automation-tick).
      if (error.code === "23505") {
        // Lead inativo: o cron diário manda o mesmo lead todo dia enquanto ele seguir parado.
        // Só recomeça depois de passar o prazo configurado (senão ele recebe o fluxo todo dia).
        if (event === "lead_inactive") {
          const dias = Math.max(1, Number(filter.days || 1));
          const { data: atual } = await supabase
            .from("email_automation_runs")
            .select("started_at")
            .eq("automation_id", auto.id)
            .eq("lead_id", lead_id)
            .maybeSingle();
          if (atual?.started_at && Date.now() - new Date(atual.started_at).getTime() < dias * 86400_000) continue;
        }
        const { data: reiniciado } = await supabase
          .from("email_automation_runs")
          .update({
            current_node_id: triggerNode.id,
            scheduled_next_at: agora,
            started_at: agora,
            completed_at: null,
            status: "active",
            context: { trigger_event: event, ...context, reinicio: true },
          })
          .eq("automation_id", auto.id)
          .eq("lead_id", lead_id)
          .select("id");
        if (reiniciado && reiniciado.length > 0) triggered++;
      }
    }

    return new Response(JSON.stringify({ ok: true, triggered, total_automations: automations.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
