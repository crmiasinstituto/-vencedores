import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-member-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ||
      ((await req.json().catch(() => ({}))) as any).token;
    if (!token) {
      return new Response(JSON.stringify({ error: "token missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: subscriber } = await supabase
      .from("email_subscribers")
      .select("id, email, lead_id")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (!subscriber) {
      return new Response(JSON.stringify({ error: "token inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    await supabase
      .from("email_subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: now })
      .eq("id", subscriber.id);

    // Tabela hard-list pra RPC de audiência
    await supabase
      .from("email_unsubscribes")
      .upsert({ email: subscriber.email, unsubscribed_at: now, reason: "user_request" }, { onConflict: "email" });

    // Marca crm_leads.email_opted_out=true
    if (subscriber.lead_id) {
      await supabase
        .from("crm_leads")
        .update({ email_opted_out: true, email_opted_out_at: now })
        .eq("id", subscriber.lead_id);
    }

    return new Response(JSON.stringify({ success: true, email: subscriber.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
