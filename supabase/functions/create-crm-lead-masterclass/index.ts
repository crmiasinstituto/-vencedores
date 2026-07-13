import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
function waCanon(raw?: string | null): string {
  let n = String(raw || "").replace(/\D/g, "");
  if (!n) return "";
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      name,
      whatsapp: whatsappRaw,
      instagram,
      instagram_profile_pic_url,
      profissao,
      ddd,
      cidade,
      estado,
      diagnostico,
      instagram_data,
      source_lead_id,
    } = body;
    const whatsapp = waCanon(whatsappRaw);

    console.log("📝 Creating Masterclass CRM lead:", { name, whatsapp, profissao });

    const { data: board, error: boardError } = await supabase
      .from("crm_boards")
      .select("id, name")
      .eq("slug", "masterclass-ia")
      .single();

    if (boardError || !board) {
      console.error("❌ Board masterclass-ia not found:", boardError);
      return new Response(
        JSON.stringify({ success: false, error: "Board masterclass-ia not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const { data: firstColumn, error: columnError } = await supabase
      .from("crm_columns")
      .select("id, name")
      .eq("board_id", board.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .single();

    if (columnError || !firstColumn) {
      console.error("❌ Column not found:", columnError);
      return new Response(
        JSON.stringify({ success: false, error: "Column not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const { data: existingLead } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("board_id", board.id)
      .eq("whatsapp", whatsapp)
      .maybeSingle();

    if (existingLead) {
      console.log("⚠️ Masterclass lead already exists:", existingLead.id);

      await supabase
        .from("crm_leads")
        .update({
          notes: buildNotes({ profissao, cidade, estado, diagnostico, instagram_data }),
          tags: dedupeTags(["Masterclass IA", profissao].filter(Boolean) as string[]),
        })
        .eq("id", existingLead.id);

      return new Response(
        JSON.stringify({ success: true, lead_id: existingLead.id, message: "Lead updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tags = dedupeTags(
      ["Masterclass IA", profissao, cidade].filter(Boolean) as string[]
    );

    const leadScore =
      (instagram ? 10 : 0) +
      (profissao ? 15 : 0) +
      (instagram_data?.summary?.is_business ? 10 : 0) +
      ((instagram_data?.summary?.followers ?? 0) > 1000 ? 10 : 0);

    const notes = buildNotes({ profissao, cidade, estado, diagnostico, instagram_data });

    const { data: lead, error: leadError } = await supabase
      .from("crm_leads")
      .insert({
        board_id: board.id,
        column_id: firstColumn.id,
        name,
        whatsapp,
        instagram: instagram || null,
        instagram_profile_pic_url: instagram_profile_pic_url || null,
        source: "masterclass_popup",
        source_lead_id: source_lead_id || null,
        tags,
        lead_score: leadScore,
        notes,
      })
      .select()
      .single();

    if (leadError) {
      console.error("❌ Error creating masterclass lead:", leadError);
      return new Response(
        JSON.stringify({ success: false, error: leadError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("✅ Masterclass CRM Lead created:", lead.id);

    await supabase.from("crm_activities").insert({
      lead_id: lead.id,
      board_id: board.id,
      activity_type: "lead_created",
      description: `Lead ${name} (${profissao ?? "-"}) capturado via Masterclass IA`,
      board_name: board.name,
      to_column_name: firstColumn.name,
      metadata: {
        source: "masterclass_popup",
        profissao,
        ddd,
        cidade,
        estado,
        instagram,
        diagnostico,
        instagram_summary: instagram_data?.summary ?? null,
      },
    });

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ create-crm-lead-masterclass error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function dedupeTags(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function buildNotes(opts: {
  profissao?: string;
  cidade?: string;
  estado?: string;
  diagnostico?: Record<string, unknown> | null;
  instagram_data?: { summary?: Record<string, unknown> } | null;
}): string {
  const lines: string[] = [];
  if (opts.profissao) lines.push(`Profissao: ${opts.profissao}`);
  if (opts.cidade || opts.estado) lines.push(`Local: ${opts.cidade ?? "?"} / ${opts.estado ?? "?"}`);

  const ig = opts.instagram_data?.summary;
  if (ig) {
    lines.push("");
    lines.push("--- Instagram (ScrapCreator) ---");
    if (ig.followers) lines.push(`Seguidores: ${ig.followers}`);
    if (ig.posts_count) lines.push(`Posts: ${ig.posts_count}`);
    if (ig.category) lines.push(`Categoria: ${ig.category}`);
    if (ig.is_business) lines.push("Conta business");
    if (ig.bio) lines.push(`Bio: ${String(ig.bio).slice(0, 200)}`);
    if (Array.isArray(ig.recent_captions) && ig.recent_captions.length) {
      lines.push("Posts recentes:");
      ig.recent_captions.forEach((c: string, i: number) => lines.push(`  ${i + 1}. ${c.slice(0, 120)}`));
    }
  }

  if (opts.diagnostico) {
    const d = opts.diagnostico as Record<string, unknown>;
    lines.push("");
    lines.push("--- Diagnostico IA ---");
    if (d.headline) lines.push(`${d.headline}`);
    if (d.gap) lines.push(`Gap: ${d.gap}`);
    const proj = d.primeiro_projeto as Record<string, unknown> | undefined;
    if (proj) {
      lines.push(`Projeto: ${proj.titulo} - ${proj.ticket_sugerido} (potencial: ${proj.receita_mensal_potencial})`);
    }
  }

  return lines.join("\n");
}
