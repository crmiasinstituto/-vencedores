// Envia mensagem para um grupo WhatsApp via uazapi.
// Body: { group_id: uuid, message: string, media_url?, media_type? }

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

  try {
    const { group_id, group_jid, message, media_url, media_type } = await req.json();
    if (!message || message.length < 2) throw new Error("message required");

    // Resolve group
    let group: any = null;
    if (group_id) {
      const { data } = await supabase.from("whatsapp_groups").select("*").eq("id", group_id).single();
      group = data;
    } else if (group_jid) {
      const { data } = await supabase.from("whatsapp_groups").select("*").eq("group_jid", group_jid).single();
      group = data;
    }
    if (!group) throw new Error("grupo nao encontrado");
    if (!group.is_broadcast_enabled) throw new Error("broadcast desabilitado nesse grupo (ative nas configuracoes)");
    if (!group.instance_id) throw new Error("grupo sem instancia WhatsApp vinculada");

    // Target: group_jid sempre com @g.us
    const target = group.group_jid.includes("@") ? group.group_jid : `${group.group_jid}@g.us`;

    // Send via uazapi-proxy
    const action = media_url ? "send_media" : "send_text";
    const body: any = {
      action,
      instance_id: group.instance_id,
      phone: target,
      message,
      sent_by: "group_broadcast",
    };
    if (media_url) { body.media_url = media_url; body.media_type = media_type || "image"; body.caption = message; }

    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify(body),
    });
    const j = await res.json();

    return new Response(JSON.stringify({ ok: j?.success !== false, group: group.name, sent: message.substring(0, 80), detail: j }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-group-message]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
