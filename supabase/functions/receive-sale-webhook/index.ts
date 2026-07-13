import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SaleWebhookPayload {
  evento?: string;
  comprador: {
    nome: string;
    email?: string;
    whatsapp: string;
    instagram?: string;
    instagram_profile_pic_url?: string;
  };
  venda: {
    produto: string;
    produto_slug?: string;
    valor: number;
    forma_pagamento?: string;
    transaction_id?: string;
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
// Sem isso, numeros sem o 9 nao casavam no dedup e duplicavam o lead.
function normalizePhone(phone: string): string {
  let n = String(phone || "").replace(/\D/g, "");
  if (!n) return "";
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

async function fetchInstagramProfilePic(instagram: string): Promise<string | null> {
  const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
  if (!RAPIDAPI_KEY || !instagram) return null;
  const username = instagram.replace("@", "").trim();
  if (!username) return null;
  try {
    const response = await fetch(
      `https://instagram-looter2.p.rapidapi.com/profile?username=${username}`,
      { headers: { "x-rapidapi-host": "instagram-looter2.p.rapidapi.com", "x-rapidapi-key": RAPIDAPI_KEY } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.profile_pic_url_hd || data?.profile_pic_url || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = (await req.json()) as SaleWebhookPayload;
    console.log("🛒 Webhook de venda recebido:", JSON.stringify(payload, null, 2));

    if (!payload?.comprador?.nome || !payload?.comprador?.whatsapp || !payload?.venda?.produto) {
      return jsonResponse({ success: false, error: "Payload inválido. Campos obrigatórios: comprador.nome, comprador.whatsapp, venda.produto" }, 400);
    }

    const cleanWhatsapp = normalizePhone(payload.comprador.whatsapp);
    
    // === DEDUPLICATION: Check if sale already exists in last 5 minutes ===
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentSale } = await supabase
      .from("sales_events")
      .select("id")
      .eq("whatsapp", cleanWhatsapp)
      .eq("product_name", payload.venda.produto)
      .gte("created_at", fiveMinAgo)
      .limit(1)
      .maybeSingle();

    if (recentSale) {
      console.log("⚠️ Venda duplicada detectada, ignorando:", recentSale.id);
      return jsonResponse({ success: true, message: "Venda já registrada recentemente", sale_id: recentSale.id, deduplicated: true });
    }

    // Determinar foto do Instagram
    let instagramProfilePicUrl: string | null = payload.comprador.instagram_profile_pic_url || null;
    const instagramUsername = payload.comprador.instagram?.replace("@", "") || null;

    if (!instagramProfilePicUrl && instagramUsername) {
      const { data: existingLead } = await supabase.from("leads").select("instagram_profile_pic_url")
        .or(`instagram.eq.${instagramUsername},instagram.eq.@${instagramUsername}`)
        .not("instagram_profile_pic_url", "is", null).limit(1).maybeSingle();

      if (existingLead?.instagram_profile_pic_url) {
        instagramProfilePicUrl = existingLead.instagram_profile_pic_url;
      } else {
        const { data: existingCrmLead } = await supabase.from("crm_leads").select("instagram_profile_pic_url")
          .or(`instagram.eq.${instagramUsername},instagram.eq.@${instagramUsername}`)
          .not("instagram_profile_pic_url", "is", null).limit(1).maybeSingle();
        instagramProfilePicUrl = existingCrmLead?.instagram_profile_pic_url || await fetchInstagramProfilePic(instagramUsername);
      }
    }

    // 1) Buscar board "vhs-imersao"
    const { data: board } = await supabase.from("crm_boards").select("id, name").eq("slug", "vhs-imersao").maybeSingle();

    let crmLeadId: string | null = null;
    const crmBoardId: string | null = board?.id ?? null;

    if (board?.id) {
      const { data: fechadoColumn } = await supabase.from("crm_columns").select("id, name")
        .eq("board_id", board.id).eq("name", "Fechado").maybeSingle();

      if (fechadoColumn?.id) {
        // Use find_lead_by_phone_crm for fuzzy phone matching
        const { data: foundLeadId } = await supabase.rpc('find_lead_by_phone_crm', { p_phone: cleanWhatsapp });
        
        // Also try direct match on this board
        const { data: existingLead } = await supabase.from("crm_leads").select("id, column_id, instagram_profile_pic_url, board_id")
          .eq("board_id", board.id).eq("whatsapp", cleanWhatsapp).maybeSingle();

        const nowIso = new Date().toISOString();

        if (existingLead?.id) {
          const { data: fromColumn } = await supabase.from("crm_columns").select("name").eq("id", existingLead.column_id).maybeSingle();

          await supabase.from("crm_leads").update({
            column_id: fechadoColumn.id, closed_at: nowIso, updated_at: nowIso,
            instagram_profile_pic_url: instagramProfilePicUrl || existingLead.instagram_profile_pic_url,
          }).eq("id", existingLead.id);

          crmLeadId = existingLead.id;

          await supabase.from("crm_activities").insert({
            lead_id: existingLead.id, board_id: board.id, activity_type: "column_change",
            description: `${payload.comprador.nome} movido para Fechado (VENDA!)`,
            from_column_name: fromColumn?.name ?? null, to_column_name: "Fechado",
            metadata: { reason: "sale_completed", amount: payload.venda.valor },
          });
        } else {
          const { data: newLead } = await supabase.from("crm_leads").insert({
            board_id: board.id, column_id: fechadoColumn.id,
            name: payload.comprador.nome, whatsapp: cleanWhatsapp,
            email: payload.comprador.email ?? null, instagram: instagramUsername ?? null,
            instagram_profile_pic_url: instagramProfilePicUrl ?? null,
            source: "checkout_vhs", closed_at: nowIso, tags: ["Comprador", "VHS Imersão"],
          }).select("id").single();

          if (newLead?.id) {
            crmLeadId = newLead.id;
            await supabase.from("crm_activities").insert({
              lead_id: newLead.id, board_id: board.id, activity_type: "lead_created",
              description: `${payload.comprador.nome} - NOVA VENDA! Criado diretamente em Fechado`,
              to_column_name: "Fechado", metadata: { source: "checkout", amount: payload.venda.valor },
            });
          }
        }
      }
    }

    // 4) Inserir evento de venda
    const { data: saleEvent, error: saleError } = await supabase.from("sales_events").insert({
      name: payload.comprador.nome, email: payload.comprador.email ?? null,
      whatsapp: cleanWhatsapp, instagram: instagramUsername ?? null,
      instagram_profile_pic_url: instagramProfilePicUrl ?? null,
      product_name: payload.venda.produto, product_slug: payload.venda.produto_slug ?? null,
      amount: payload.venda.valor ?? 0, payment_method: payload.venda.forma_pagamento ?? null,
      transaction_id: payload.venda.transaction_id ?? null,
      crm_lead_id: crmLeadId, crm_board_id: crmBoardId,
      source: "iautomatize", raw_payload: payload,
    }).select("id").single();

    if (saleError) {
      console.error("❌ Erro ao inserir sale_event:", saleError);
      return jsonResponse({ success: false, error: saleError.message }, 500);
    }

    // 5) Auto-create VHS participant for onboarding
    try {
      const participantPhone = cleanWhatsapp;
      const variants = [participantPhone];
      if (participantPhone.startsWith('55')) variants.push(participantPhone.slice(2));

      const { data: existingParticipant } = await supabase.from("vhs_participants")
        .select("id").in("whatsapp", variants).limit(1).maybeSingle();

      if (!existingParticipant) {
        console.log("🎓 Auto-creating VHS participant for onboarding...");
        // Call create-vhs-participant internally
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let token = '';
        for (let i = 0; i < 12; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

        await supabase.from("vhs_participants").insert({
          name: payload.comprador.nome,
          whatsapp: participantPhone,
          email: payload.comprador.email ?? null,
          onboarding_token: token,
          payment_confirmed_at: new Date().toISOString(),
        });
        console.log(`✅ VHS participant created with token: ${token}`);
      }
    } catch (e) {
      console.warn("⚠️ Error auto-creating VHS participant:", e);
    }

    console.log("🎉 Venda registrada com sucesso:", saleEvent?.id);
    return jsonResponse({
      success: true, message: "Venda registrada com sucesso!",
      sale_id: saleEvent?.id, crm_lead_id: crmLeadId, instagram_pic_found: !!instagramProfilePicUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Erro no webhook:", error);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
