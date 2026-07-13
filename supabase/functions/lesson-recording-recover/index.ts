// Recovery endpoint: when the LiveKit webhook didn't deliver (or isn't
// configured yet), this function queries LiveKit's Egress API directly to
// find the recording for a given room, updates the meeting with the final
// B2 URL, then kicks the lesson-publishing pipeline.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function createServiceToken(apiKey: string, apiSecret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey, sub: apiKey, nbf: now, exp: now + 600, iat: now,
    jti: crypto.randomUUID(),
    video: { roomAdmin: true, roomCreate: true, roomList: true, roomRecord: true },
  };
  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", enc.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${headerB64}.${payloadB64}`));
  return `${headerB64}.${payloadB64}.${base64url(new Uint8Array(sig))}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { meeting_id, room_name } = await req.json();
    if (!meeting_id && !room_name) throw new Error("meeting_id or room_name required");

    // Load meeting
    let meetingQuery = supabase.from("meetings").select("*");
    if (meeting_id) meetingQuery = meetingQuery.eq("id", meeting_id);
    else meetingQuery = meetingQuery.eq("livekit_room_name", room_name);
    const { data: meeting, error: mErr } = await meetingQuery.single();
    if (mErr || !meeting) throw new Error(`Meeting not found: ${mErr?.message}`);

    const roomName = meeting.livekit_room_name;
    if (!roomName) throw new Error("meeting has no livekit_room_name");

    const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
    const httpUrl = Deno.env.get("LIVEKIT_URL")!.replace("wss://", "https://");
    const s3PublicUrl = Deno.env.get("S3_PUBLIC_URL") || Deno.env.get("B2_PUBLIC_URL")!;

    const token = await createServiceToken(apiKey, apiSecret);

    // ListEgress for the room
    const listRes = await fetch(`${httpUrl}/twirp/livekit.Egress/ListEgress`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: roomName }),
    });
    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error(`LiveKit ListEgress failed (${listRes.status}): ${err}`);
    }
    const listData = await listRes.json();
    const egresses = (listData.items || []) as any[];

    if (egresses.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        status: "no_egress_found",
        message: "Nenhuma gravacao LiveKit encontrada para esta sala. Pode ser que o recording nao iniciou.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find the most recent completed egress
    // status: 0=EGRESS_STARTING 1=EGRESS_ACTIVE 2=EGRESS_ENDING 3=EGRESS_COMPLETE 4=EGRESS_FAILED 5=EGRESS_ABORTED 6=EGRESS_LIMIT_REACHED
    const completed = egresses
      .filter(e => e.status === 3 || e.status === "EGRESS_COMPLETE")
      .sort((a, b) => Number(b.ended_at || 0) - Number(a.ended_at || 0));

    const active = egresses
      .filter(e => e.status === 0 || e.status === 1 || e.status === 2 ||
        e.status === "EGRESS_STARTING" || e.status === "EGRESS_ACTIVE" || e.status === "EGRESS_ENDING");

    if (completed.length === 0) {
      // Still processing (or failed)
      const statusReport = egresses.map(e => ({ id: e.egress_id, status: e.status, error: e.error }));
      return new Response(JSON.stringify({
        success: false,
        status: "still_processing",
        active_count: active.length,
        all: statusReport,
        message: active.length
          ? "Gravacao ainda em andamento no LiveKit. Tente novamente em 30-60s."
          : "Gravacao nao completou com sucesso no LiveKit.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const egress = completed[0];
    const fileResults = egress.file_results || egress.fileResults || [];
    const file = fileResults[0] || egress.file || {};
    const filename = file.filename || file.filepath || "";
    const location = file.location;

    let recordingUrl = "";
    if (s3PublicUrl && filename) {
      // filename may already include the bucket prefix; strip if so
      const bucket = Deno.env.get("S3_BUCKET") || Deno.env.get("B2_BUCKET") || "";
      const cleanName = filename.startsWith(`${bucket}/`) ? filename.slice(bucket.length + 1) : filename;
      recordingUrl = `${s3PublicUrl.replace(/\/$/, "")}/${cleanName}`;
    } else if (location) {
      recordingUrl = location;
    }

    if (!recordingUrl) {
      throw new Error(`Egress completed but no file URL could be derived. filename=${filename} location=${location}`);
    }

    // Update meeting with recovered URL
    await supabase.from("meetings").update({
      recording_url: recordingUrl,
      recording_status: "completed",
    }).eq("id", meeting.id);

    console.log(`[RECOVER] Saved recording_url=${recordingUrl} for meeting ${meeting.id}`);

    // Kick the pipeline (idempotent)
    const procRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-lesson-recording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ meeting_id: meeting.id }),
    });
    const procText = await procRes.text();
    let procJson: any; try { procJson = JSON.parse(procText); } catch { procJson = { raw: procText }; }

    return new Response(JSON.stringify({
      success: true,
      recording_url: recordingUrl,
      egress_id: egress.egress_id,
      pipeline: procJson,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[RECOVER] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
