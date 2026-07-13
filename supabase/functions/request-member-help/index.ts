// ============================================================
// request-member-help (verify_jwt: false)
//
// Botoes "Falar com CS" e "Suporte Tecnico" da area de membros.
// Resolve membro via x-member-token, busca contato configurado em
// integration_keys (services: cs_contact / tech_support — phone no
// campo account_id), e dispara WhatsApp via uazapi-proxy.
//
// Body: { contact_type: 'cs' | 'support', reason?, lesson_id? }
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LABELS = {
  cs: { emoji: "🙋", label: "CS", who: "Simone (Customer Success)" },
  support: { emoji: "🛠️", label: "Suporte Tecnico", who: "Luiz (Suporte Tecnico)" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as any));
    const { contact_type, reason, lesson_id } = body || {};
    if (contact_type !== "cs" && contact_type !== "support") {
      return json({ error: "contact_type invalido (cs|support)" }, 400);
    }

    const memberToken = req.headers.get("x-member-token") || body?.member_token;
    if (!memberToken || typeof memberToken !== "string" || memberToken.length < 16) {
      return json({ error: "x-member-token obrigatorio" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Resolve member
    const { data: member } = await supabase
      .from("members")
      .select("id, name, phone, email, status")
      .eq("session_token", memberToken)
      .maybeSingle();
    if (!member || member.status !== "active") {
      return json({ error: "Sessao invalida" }, 401);
    }

    // 2) Resolve contato (account_id = telefone do agente humano)
    const serviceKey = contact_type === "cs" ? "cs_contact" : "tech_support";
    const { data: contact } = await supabase
      .from("integration_keys")
      .select("account_id, is_active, metadata")
      .eq("service", serviceKey)
      .maybeSingle();

    if (!contact?.account_id || !contact.is_active) {
      console.warn(`[request-member-help] contact ${serviceKey} nao configurado`);
      return json({
        error: `Contato ${LABELS[contact_type].label} nao configurado. Admin deve setar em /admin/configuracoes/integracoes (service=${serviceKey}, campo Account ID = telefone com DDD).`,
      }, 503);
    }
    const targetPhone = String(contact.account_id).replace(/\D/g, "");
    if (targetPhone.length < 10) {
      return json({ error: "Telefone do contato invalido" }, 503);
    }
    // Nome configurado pelo admin (ex: "Falar com Carlos Eduardo"), usado no
    // toast de sucesso e no rodape da mensagem. Cai pro label padrao se vazio.
    const displayLabel = (contact.metadata as any)?.display_label || LABELS[contact_type].who;

    // 3) Lesson context (opcional)
    let lessonTitle = "";
    if (lesson_id) {
      const { data: l } = await supabase
        .from("member_lessons")
        .select("title")
        .eq("id", lesson_id)
        .maybeSingle();
      lessonTitle = l?.title || "";
    }

    // 4) Pega instancia WhatsApp 1-to-1: SO uazapi e NUNCA a dedicada de blast
    // nem a cloud_api (uazapi-proxy nao envia por cloud_api -> dava 502).
    // Mesma blindagem dos outros envios 1-to-1 do CRM.
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("status", "connected")
      .eq("provider", "uazapi")
      .eq("is_dedicated_blast", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!instance?.id) {
      return json({ error: "Nenhuma instancia WhatsApp conectada" }, 503);
    }

    // 5) Monta mensagem
    const info = LABELS[contact_type];
    const lines = [
      `${info.emoji} *Pedido de ajuda, Area de Membros SQUAAD*`,
      "",
      `*Aluno:* ${member.name}`,
      `*Telefone:* ${member.phone || "nao informado"}`,
      `*Email:* ${member.email || "nao informado"}`,
    ];
    if (lessonTitle) lines.push(`*Aula:* ${lessonTitle}`);
    if (reason && typeof reason === "string" && reason.trim().length > 0) {
      lines.push(`*Motivo:* ${reason.trim().slice(0, 500)}`);
    }
    lines.push("", `_Mensagem automatica enviada pelo botao ${info.label} da plataforma._`);
    const message = lines.join("\n");

    // 6) Dispara via uazapi-proxy (service_role bypassa o admin check de la)
    const proxyRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        action: "send_text",
        instance_id: instance.id,
        phone: targetPhone,
        message,
        sent_by: `member-help-${contact_type}`,
      }),
    });

    const proxyJson = await proxyRes.json().catch(() => ({} as any));
    if (!proxyRes.ok || proxyJson?.error) {
      console.error("[request-member-help] uazapi-proxy fail:", proxyRes.status, proxyJson);
      return json({ error: "Falha ao enviar mensagem WhatsApp" }, 502);
    }

    return json({
      ok: true,
      contacted: displayLabel,
      message: `Mensagem enviada. ${displayLabel} vai te contactar em breve no WhatsApp.`,
    });
  } catch (e) {
    console.error("[request-member-help] fatal:", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
