// ============================================================
// prospeccao-virar-lead (SQUAAD CRM — auth dual)
//
// Recebe um array de prospeccao_leads_descobertos.id e cria os
// leads correspondentes:
//
//   - audience='admin'   → INSERT em `crm_leads` (schema SQUAAD:
//       whatsapp, board_id/column_id, instagram, etc)
//   - audience='member'  → INSERT em `prospeccao_member_leads`
//       (lista pessoal do membro Método Squaad)
//
// Body comum:
//   {
//     lead_descoberto_ids: string[],
//     phone_override?: string,
//     tags?: string[],
//     attach_diagnosis_link?: boolean,
//     user_id?: string,
//     member_id?: string,
//   }
//
// Body adicional para admin:
//   { board_id: string, column_id: string, assigned_to?: string }
//
// verify_jwt: false
// ============================================================

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveActor, assertActorOwnsLead } from "../_prospeccao-shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
// So prefixa 55 quando ha DDD (10-11 digitos); numero sem DDD fica curto e cai na
// validacao de "min 10 digitos" abaixo.
function waCanon(raw?: string | null): string {
  let n = String(raw || "").replace(/\D/g, "");
  if (!n) return "";
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

interface Input {
  lead_descoberto_ids: string[];
  phone_override?: string;
  tags?: string[];
  notes?: string;
  attach_diagnosis_link?: boolean;
  user_id?: string;
  member_id?: string;
  // Admin-only
  board_id?: string;
  column_id?: string;
  assigned_to?: string;
}

interface CreateResult {
  lead_descoberto_id: string;
  lead_id?: string;       // crm_leads.id (admin) ou prospeccao_member_leads.id (member)
  ok: boolean;
  erro?: string;
  audience?: "admin" | "member";
}

// deno-lint-ignore no-explicit-any
type Supa = any;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Input = await req.json();
    const {
      lead_descoberto_ids,
      phone_override,
      tags = [],
      notes,
      attach_diagnosis_link = true,
      user_id,
      member_id,
      board_id,
      column_id,
      assigned_to,
    } = body;

    if (!Array.isArray(lead_descoberto_ids) || lead_descoberto_ids.length === 0) {
      return json({ error: "lead_descoberto_ids é obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const actor = resolveActor({ user_id, member_id });

    // Admin precisa board+column (kanban CRM SQUAAD)
    if (actor.audience === "admin" && (!board_id || !column_id)) {
      return json({ error: "Admin precisa de board_id e column_id" }, 400);
    }

    const results: CreateResult[] = [];

    for (const ldId of lead_descoberto_ids) {
      try {
        // Posse + leitura do lead descoberto
        const ownership = await assertActorOwnsLead(supabase, actor, ldId);
        if (!ownership.ok) {
          results.push({ lead_descoberto_id: ldId, ok: false, erro: ownership.reason });
          continue;
        }

        const { data: ld, error: errLd } = await supabase
          .from("prospeccao_leads_descobertos")
          .select("*")
          .eq("id", ldId)
          .single();

        if (errLd || !ld) {
          results.push({ lead_descoberto_id: ldId, ok: false, erro: "Lead descoberto não encontrado" });
          continue;
        }

        // Já virou lead (admin ou membro): retorna existente
        if (actor.audience === "admin" && ld.lead_id) {
          results.push({ lead_descoberto_id: ldId, lead_id: ld.lead_id, ok: true, erro: "já era lead", audience: "admin" });
          continue;
        }
        if (actor.audience === "member" && ld.member_lead_id) {
          results.push({ lead_descoberto_id: ldId, lead_id: ld.member_lead_id, ok: true, erro: "já era lead", audience: "member" });
          continue;
        }

        // Telefone (whatsapp): obrigatório no admin (NOT NULL em crm_leads.whatsapp); opcional no membro
        const phoneRaw = (phone_override && phone_override.trim()) || ld.telefone || "";
        const phone = waCanon(phoneRaw);

        if (actor.audience === "admin" && (!phone || phone.length < 10)) {
          results.push({
            lead_descoberto_id: ldId,
            ok: false,
            erro: "WhatsApp obrigatório (mín 10 dígitos com DDD). Edite no modal antes de virar lead.",
          });
          continue;
        }

        // Atualiza prospeccao_leads_descobertos com telefone (se veio do override)
        if (phone_override && phone && !ld.telefone) {
          await supabase
            .from("prospeccao_leads_descobertos")
            .update({ telefone: phone })
            .eq("id", ldId);
        }

        // Diagnóstico mais recente
        const { data: diag } = await supabase
          .from("prospeccao_diagnosticos")
          .select("*")
          .eq("lead_descoberto_id", ldId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const r = actor.audience === "admin"
          ? await criarLeadAdmin(supabase, ld, diag, {
              phone, tags, notes, board_id: board_id!, column_id: column_id!, assigned_to,
              attach_diagnosis_link,
            })
          : await criarLeadMembro(supabase, ld, diag, actor.member_id!, {
              phone, tags, notes, attach_diagnosis_link,
            });

        results.push(r);
      } catch (e) {
        results.push({ lead_descoberto_id: ldId, ok: false, erro: String(e) });
      }
    }

    return json({ results });
  } catch (err) {
    console.error("[virar-lead] Erro fatal:", err);
    return json({ error: String(err) }, 500);
  }
});

// ============================================================
// Admin: insere em crm_leads (schema SQUAAD)
// ============================================================
async function criarLeadAdmin(
  supabase: Supa,
  ld: Record<string, unknown>,
  diag: Record<string, unknown> | null,
  opts: {
    phone: string;
    tags: string[];
    notes?: string;
    board_id: string;
    column_id: string;
    assigned_to?: string;
    attach_diagnosis_link: boolean;
  }
): Promise<CreateResult> {
  const { phone, tags, notes, board_id, column_id, assigned_to, attach_diagnosis_link } = opts;

  // Monta notes: nota do user + summary do diagnóstico
  const notesParts: string[] = [];
  if (notes) notesParts.push(notes);
  if (diag) {
    notesParts.push(`📊 Diagnóstico Prospecção — Score Geral ${diag.score_geral ?? "—"}/10`);
    if (diag.resumo_executivo) notesParts.push(String(diag.resumo_executivo));
    if (Array.isArray(diag.oportunidades) && diag.oportunidades.length > 0) {
      notesParts.push("\n🎯 Oportunidades de IA:");
      (diag.oportunidades as Array<Record<string, unknown>>).forEach((op, i) => {
        notesParts.push(`${i + 1}. ${op.titulo} — ${op.impacto_estimado || ""}`);
      });
    }
  }

  const tagsFinal = [...new Set([...(tags || []), "prospeccao", "ia-diagnostico"])];

  const leadInsert: Record<string, unknown> = {
    board_id,
    column_id,
    name: ld.nome,
    whatsapp: phone,
    instagram: ld.instagram_handle || null,
    company_name: ld.nome,
    notes: notesParts.join("\n") || null,
    tags: tagsFinal.length > 0 ? tagsFinal : null,
    source: "prospeccao_pro",
    assigned_to: assigned_to || null,
    priority: "medium",
  };

  const { data: leadCreated, error: errLead } = await supabase
    .from("crm_leads")
    .insert(leadInsert)
    .select("id")
    .single();

  if (errLead || !leadCreated) {
    return {
      lead_descoberto_id: String(ld.id),
      ok: false,
      erro: `Erro ao criar lead: ${errLead?.message}`,
      audience: "admin",
    };
  }

  // Atualiza prospeccao_leads_descobertos
  await supabase
    .from("prospeccao_leads_descobertos")
    .update({
      status: "virou_lead",
      virou_lead_em: new Date().toISOString(),
      lead_id: leadCreated.id,
    })
    .eq("id", ld.id);

  return {
    lead_descoberto_id: String(ld.id),
    lead_id: leadCreated.id,
    ok: true,
    audience: "admin",
  };
}

// ============================================================
// Membro: insere em prospeccao_member_leads (lista pessoal)
// ============================================================
async function criarLeadMembro(
  supabase: Supa,
  ld: Record<string, unknown>,
  diag: Record<string, unknown> | null,
  member_id: string,
  opts: {
    phone: string;
    tags: string[];
    notes?: string;
    attach_diagnosis_link: boolean;
  }
): Promise<CreateResult> {
  const { phone, tags, notes } = opts;

  // Notes do membro: dele + resumo do diagnóstico
  const notesParts: string[] = [];
  if (notes) notesParts.push(notes);
  if (diag?.resumo_executivo) {
    notesParts.push(`\n📊 Diagnóstico (Score ${diag.score_geral ?? "—"}/10):`);
    notesParts.push(String(diag.resumo_executivo));
  }

  const memberLead: Record<string, unknown> = {
    member_id,
    nome: ld.nome,
    whatsapp: phone || null,
    instagram: ld.instagram_handle || null,
    site: ld.url_site || null,
    cidade: ld.cidade || null,
    uf: ld.uf || null,
    categoria: ld.categoria || null,
    status: "novo",
    prospeccao_lead_descoberto_id: ld.id,
    prospeccao_diagnostico_id: diag?.id || null,
    origem: "prospeccao_pro",
    notes: notesParts.join("\n") || null,
    tags: tags && tags.length > 0 ? tags : null,
    metadata: {
      score_geral: diag?.score_geral ?? null,
      url_maps: ld.url_maps || null,
      facebook_url: ld.facebook_url || null,
      linkedin_url: ld.linkedin_url || null,
      youtube_url: ld.youtube_url || null,
      tiktok_handle: ld.tiktok_handle || null,
      nota_google: ld.nota_google ?? null,
      qtd_avaliacoes_google: ld.qtd_avaliacoes ?? null,
    },
  };

  const { data: leadCreated, error: errLead } = await supabase
    .from("prospeccao_member_leads")
    .insert(memberLead)
    .select("id")
    .single();

  if (errLead || !leadCreated) {
    return {
      lead_descoberto_id: String(ld.id),
      ok: false,
      erro: `Erro ao salvar lead: ${errLead?.message}`,
      audience: "member",
    };
  }

  await supabase
    .from("prospeccao_leads_descobertos")
    .update({
      status: "virou_lead",
      virou_lead_em: new Date().toISOString(),
      member_lead_id: leadCreated.id,
    })
    .eq("id", ld.id);

  return {
    lead_descoberto_id: String(ld.id),
    lead_id: leadCreated.id,
    ok: true,
    audience: "member",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
