// disc-complete
// Recebe { lead_id, answers: ["D"|"I"|"S"|"C", ...] } do frontend.
// Calcula perfil DISC, faz UPDATE em crm_leads, dispara WhatsApp opcional pro lead.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Dim = "D" | "I" | "S" | "C";
type Scores = Record<Dim, number>;

function calcProfile(answers: Dim[]): { profile: string; scores: Scores } {
  const scores: Scores = { D: 0, I: 0, S: 0, C: 0 };
  for (const a of answers) {
    if (a === "D" || a === "I" || a === "S" || a === "C") scores[a]++;
  }
  const sorted = (Object.entries(scores) as [Dim, number][])
    .sort((a, b) => b[1] - a[1]);
  const [top, second] = sorted;
  if (!top || top[1] === 0) return { profile: "equilibrado", scores };
  if (second && top[1] - second[1] <= 1) {
    return { profile: `${top[0]}-${second[0]}`, scores };
  }
  return { profile: top[0], scores };
}

const PROFILE_LABELS: Record<string, string> = {
  D: "Dominante",
  I: "Influente",
  S: "Estável",
  C: "Cauteloso",
};

function profileLabel(profile: string): string {
  if (profile.includes("-")) {
    const [a, b] = profile.split("-");
    return `${PROFILE_LABELS[a] || a} / ${PROFILE_LABELS[b] || b}`;
  }
  return PROFILE_LABELS[profile] || profile;
}

async function sendLeadFollowup(
  supabase: any,
  lead: { id: string; name: string; whatsapp: string; ai_analysis: any },
  profile: string,
) {
  if ((Deno.env.get("WHATSAPP_AUTOMSG_ENABLED") || "false").toLowerCase() !== "true") return;

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  if (!instance) return;

  const primeiro = (lead.name || "").split(" ")[0] || "amigo(a)";
  const nicho = lead.ai_analysis?.nicho || "seu nicho";
  const text =
    `Opa ${primeiro}! Aqui é o Carlos da SQUAAD 👋\n` +
    `Vi seu perfil — perfil ${profileLabel(profile)} com Instagram focado em ${nicho} é uma combinação poderosa pra escalar com IA.\n` +
    `Posso te mostrar 1 caso prático que se aplica ao seu negócio?`;

  try {
    await supabase.functions.invoke("uazapi-proxy", {
      body: {
        action: "send_text",
        instance_id: instance.id,
        number: lead.whatsapp,
        text,
        lead_id: lead.id,
        sent_by: "system-disc-followup",
      },
    });
  } catch (e) {
    console.error("[disc-complete] followup send failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const leadId = String(body.lead_id || "");
    const answers = Array.isArray(body.answers) ? body.answers as Dim[] : [];

    if (!leadId) {
      return new Response(JSON.stringify({ success: false, error: "lead_id_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (answers.length < 4) {
      return new Response(JSON.stringify({ success: false, error: "answers_incomplete" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profile, scores } = calcProfile(answers);

    const { data: lead, error: fetchErr } = await supabase
      .from("crm_leads")
      .select("id, name, whatsapp, board_id, ai_analysis")
      .eq("id", leadId)
      .maybeSingle();
    if (fetchErr || !lead) {
      return new Response(JSON.stringify({ success: false, error: "lead_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Move pra coluna "DISC Concluído" se existir
    const { data: doneCol } = await supabase
      .from("crm_columns")
      .select("id, name")
      .eq("board_id", lead.board_id)
      .eq("name", "DISC Concluído")
      .maybeSingle();

    const update: any = {
      disc_profile: profile,
      disc_scores: scores,
    };
    if (doneCol?.id) update.column_id = doneCol.id;

    const { error: updateErr } = await supabase
      .from("crm_leads")
      .update(update)
      .eq("id", leadId);
    if (updateErr) {
      return new Response(JSON.stringify({ success: false, error: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("crm_activities").insert({
      lead_id: lead.id,
      board_id: lead.board_id,
      activity_type: "disc_completed",
      description: `Perfil DISC ${profileLabel(profile)} (${profile})`,
      to_column_name: doneCol?.name || null,
      metadata: { profile, scores },
    });

    // Followup async (não bloqueia)
    sendLeadFollowup(supabase, lead, profile).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        profile_label: profileLabel(profile),
        scores,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[disc-complete] fatal:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
