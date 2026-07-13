import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { key, contentType, expiresIn } = await req.json();
    if (!key) throw new Error("key required");

    const endpoint = Deno.env.get("S3_ENDPOINT") || Deno.env.get("B2_ENDPOINT")!;
    const bucket = Deno.env.get("S3_BUCKET") || Deno.env.get("B2_BUCKET")!;
    const accessKey = Deno.env.get("S3_ACCESS_KEY") || Deno.env.get("B2_ACCESS_KEY")!;
    const secretKey = Deno.env.get("S3_SECRET_KEY") || Deno.env.get("B2_SECRET_KEY")!;
    const publicUrl = Deno.env.get("S3_PUBLIC_URL") || Deno.env.get("B2_PUBLIC_URL")!;
    const region = Deno.env.get("S3_REGION") || Deno.env.get("B2_REGION") || "us-east-005";

    const cleanKey = String(key).replace(/^\/+/, "");
    const expires = Math.min(Math.max(parseInt(expiresIn || "3600", 10), 60), 7200);

    const client = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      service: "s3",
      region,
    });

    const rawUrl = `${endpoint.replace(/\/$/, "")}/${bucket}/${cleanKey}`;

    // Presign a PUT request
    const signed = await client.sign(new Request(rawUrl, {
      method: "PUT",
      headers: contentType ? { "Content-Type": String(contentType) } : {},
    }), {
      aws: { signQuery: true },
      expiresIn: expires,
    });

    const uploadUrl = signed.url;
    const finalPublicUrl = `${publicUrl.replace(/\/$/, "")}/${cleanKey}`;

    return new Response(JSON.stringify({
      success: true,
      upload_url: uploadUrl,
      public_url: finalPublicUrl,
      key: cleanKey,
      expires_in: expires,
      headers: contentType ? { "Content-Type": String(contentType) } : {},
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[B2-SIGN] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
