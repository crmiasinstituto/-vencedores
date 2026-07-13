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
      if (filter.board_id && context.board_id !== filter.board_id) matches = false;
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

      const { error } = await supabase
        .from("email_automation_runs")
        .insert({
          automation_id: auto.id,
          lead_id,
          current_node_id: triggerNode.id,
          scheduled_next_at: new Date().toISOString(),
          status: "active",
          context: { trigger_event: event, ...context },
        });
      if (!error) triggered++;
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
