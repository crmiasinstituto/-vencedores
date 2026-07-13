// Google Calendar 2-way sync for SQUAAD Agenda.
// Supports two operations:
//   action=oauth_url     → returns the Google consent URL to open
//   action=exchange_code → swap the auth code for tokens, stores in google_oauth_tokens
//   action=push          → pushes new/updated calendar_events to Google
//   action=pull          → pulls recent events from the user's primary calendar
// Requires these secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events";

async function getGoogleCreds(supabase: any): Promise<{ client_id: string; client_secret: string; redirect_uri: string } | null> {
  // Prefer DB-stored credentials (configured via UI)
  const { data } = await supabase.from("integration_keys")
    .select("api_key, api_secret, metadata").eq("service", "google-oauth").eq("is_active", true).maybeSingle();
  if (data?.api_key && data?.api_secret) {
    return {
      client_id: data.api_key,
      client_secret: data.api_secret,
      redirect_uri: data.metadata?.redirect_uri || "https://squaad.com.br/admin/agenda",
    };
  }
  // Fallback to env vars (older deploys)
  const envId = Deno.env.get("GOOGLE_CLIENT_ID");
  const envSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (envId && envSecret) {
    return {
      client_id: envId,
      client_secret: envSecret,
      redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI") || "https://squaad.com.br/admin/agenda",
    };
  }
  return null;
}

async function refreshTokenIfNeeded(supabase: any, tokenRow: any, creds: { client_id: string; client_secret: string }) {
  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() > Date.now() + 60_000) return tokenRow.access_token;
  const params = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: tokenRow.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: params });
  if (!res.ok) throw new Error(`refresh token: ${await res.text()}`);
  const j = await res.json();
  const newExpiresAt = new Date(Date.now() + (j.expires_in * 1000)).toISOString();
  await supabase.from("google_oauth_tokens").update({
    access_token: j.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString(),
  }).eq("id", tokenRow.id);
  return j.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { action, code, event_id, since, owner_id = "default", client_id: incomingClientId, client_secret: incomingSecret, redirect_uri: incomingRedirect } = await req.json();

    // Config management
    if (action === "get_config") {
      const { data } = await supabase.from("integration_keys")
        .select("api_key, metadata, is_active").eq("service", "google-oauth").maybeSingle();
      return new Response(JSON.stringify({
        ok: true,
        configured: !!data?.api_key,
        client_id: data?.api_key || null,
        redirect_uri: data?.metadata?.redirect_uri || "https://squaad.com.br/admin/agenda",
        is_active: !!data?.is_active,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "save_config") {
      if (!incomingClientId || !incomingSecret) throw new Error("client_id and client_secret required");
      const redirect = incomingRedirect || "https://squaad.com.br/admin/agenda";
      const { data: exists } = await supabase.from("integration_keys").select("id").eq("service", "google-oauth").maybeSingle();
      const payload = {
        service: "google-oauth",
        api_key: incomingClientId,
        api_secret: incomingSecret,
        is_active: true,
        metadata: { redirect_uri: redirect },
        updated_at: new Date().toISOString(),
      };
      if (exists) await supabase.from("integration_keys").update(payload).eq("id", exists.id);
      else await supabase.from("integration_keys").insert(payload);
      return new Response(JSON.stringify({ ok: true, saved: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "connection_status") {
      const { data: tok } = await supabase.from("google_oauth_tokens").select("owner_id, calendar_id, expires_at, updated_at").eq("owner_id", owner_id).maybeSingle();
      return new Response(JSON.stringify({ ok: true, connected: !!tok, token: tok || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "disconnect") {
      await supabase.from("google_oauth_tokens").delete().eq("owner_id", owner_id);
      return new Response(JSON.stringify({ ok: true, disconnected: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const creds = await getGoogleCreds(supabase);
    if (!creds) {
      return new Response(JSON.stringify({
        ok: false, error: "not_configured",
        message: "Configure client_id e client_secret via action=save_config",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "oauth_url") {
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.searchParams.set("client_id", creds.client_id);
      u.searchParams.set("redirect_uri", creds.redirect_uri);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", GOOGLE_SCOPES);
      u.searchParams.set("access_type", "offline");
      u.searchParams.set("prompt", "consent");
      u.searchParams.set("state", owner_id);
      return new Response(JSON.stringify({ ok: true, url: u.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange_code") {
      if (!code) throw new Error("code required");
      const params = new URLSearchParams({
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        code,
        redirect_uri: creds.redirect_uri,
        grant_type: "authorization_code",
      });
      const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: params });
      const j = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(j));
      const expiresAt = new Date(Date.now() + (j.expires_in * 1000)).toISOString();
      await supabase.from("google_oauth_tokens").upsert({
        owner_id,
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_at: expiresAt,
        scope: j.scope,
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_id" });
      return new Response(JSON.stringify({ ok: true, connected: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // For push/pull we need a valid token
    const { data: tok } = await supabase.from("google_oauth_tokens").select("*").eq("owner_id", owner_id).maybeSingle();
    if (!tok) return new Response(JSON.stringify({ ok: false, error: "not_connected" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const accessToken = await refreshTokenIfNeeded(supabase, tok, creds);
    const calendarId = tok.calendar_id || "primary";

    if (action === "push") {
      let query = supabase.from("calendar_events").select("*").limit(100);
      if (event_id) query = query.eq("id", event_id);
      else query = query.is("google_event_id", null).gte("start_at", new Date(Date.now() - 24 * 3600_000).toISOString());
      const { data: events } = await query;

      let pushed = 0;
      for (const ev of (events || [])) {
        const body = {
          summary: ev.title,
          description: ev.description,
          location: ev.location,
          start: { dateTime: ev.start_at, timeZone: "America/Sao_Paulo" },
          end: { dateTime: ev.end_at || new Date(new Date(ev.start_at).getTime() + 30 * 60_000).toISOString(), timeZone: "America/Sao_Paulo" },
          conferenceData: ev.meeting_url ? { entryPoints: [{ entryPointType: "video", uri: ev.meeting_url }] } : undefined,
        };
        const url = ev.google_event_id
          ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${ev.google_event_id}`
          : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
        const method = ev.google_event_id ? "PATCH" : "POST";
        const res = await fetch(url, {
          method, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const j = await res.json();
          await supabase.from("calendar_events").update({
            google_event_id: j.id, google_calendar_id: calendarId, sync_status: "synced",
          }).eq("id", ev.id);
          pushed++;
        }
      }
      return new Response(JSON.stringify({ ok: true, pushed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "pull") {
      const timeMin = since || new Date(Date.now() - 7 * 86400000).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=250`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(j));

      let pulled = 0;
      for (const item of (j.items || [])) {
        if (!item.start?.dateTime) continue;
        const payload: any = {
          title: item.summary || "(sem titulo)",
          description: item.description || null,
          location: item.location || null,
          start_at: item.start.dateTime,
          end_at: item.end?.dateTime,
          type: "personal",
          color: "#4285F4", // Google blue
          google_event_id: item.id,
          google_calendar_id: calendarId,
          sync_status: "synced",
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabase.from("calendar_events").select("id").eq("google_event_id", item.id).maybeSingle();
        if (existing) await supabase.from("calendar_events").update(payload).eq("id", existing.id);
        else await supabase.from("calendar_events").insert(payload);
        pulled++;
      }
      return new Response(JSON.stringify({ ok: true, pulled }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`unknown action ${action}`);
  } catch (e: any) {
    console.error("[sync-google-calendar] error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
