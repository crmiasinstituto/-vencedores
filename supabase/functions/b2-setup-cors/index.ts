// Aplica CORS rules no bucket B2/S3 via S3 API (PutBucketCors).
// Chame uma vez e pronto — CORS fica permanente no bucket.
//
// Uso:
//   curl -X POST https://<proj>.supabase.co/functions/v1/b2-setup-cors \
//        -H "apikey: <anon-or-service>" \
//        -H "Authorization: Bearer <anon-or-service>"

import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CORS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://squaad.com.br</AllowedOrigin>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedOrigin>http://localhost:8080</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-version-id</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const endpoint = Deno.env.get("S3_ENDPOINT") || Deno.env.get("B2_ENDPOINT")!;
    const bucket = Deno.env.get("S3_BUCKET") || Deno.env.get("B2_BUCKET")!;
    const accessKey = Deno.env.get("S3_ACCESS_KEY") || Deno.env.get("B2_ACCESS_KEY")!;
    const secretKey = Deno.env.get("S3_SECRET_KEY") || Deno.env.get("B2_SECRET_KEY")!;
    const region = Deno.env.get("S3_REGION") || Deno.env.get("B2_REGION") || "us-east-005";

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      throw new Error("Credenciais B2 nao configuradas (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY)");
    }

    const client = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      service: "s3",
      region,
    });

    // Calcula MD5 do XML (S3 exige Content-MD5 no PutBucketCors)
    const xmlBytes = new TextEncoder().encode(CORS_XML);
    const md5Buffer = await crypto.subtle.digest(
      "MD5",
      xmlBytes,
    ).catch(() => null);

    // SubtleCrypto nao tem MD5 em Deno — usamos um fallback via node:crypto import
    let md5Base64 = "";
    if (md5Buffer) {
      md5Base64 = btoa(String.fromCharCode(...new Uint8Array(md5Buffer)));
    } else {
      // Fallback: import MD5 via node:crypto (Deno nativo)
      const { createHash } = await import("node:crypto");
      const h = createHash("md5");
      h.update(xmlBytes);
      const hex = h.digest("hex") as string;
      const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
      md5Base64 = btoa(String.fromCharCode(...bytes));
    }

    const url = `${endpoint.replace(/\/$/, "")}/${bucket}?cors`;

    const resp = await client.fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/xml",
        "Content-MD5": md5Base64,
      },
      body: CORS_XML,
    });

    const text = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({
        success: false,
        status: resp.status,
        body: text,
        applied_xml: CORS_XML,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verifica lendo de volta
    const verifyResp = await client.fetch(url, { method: "GET" });
    const verifyText = await verifyResp.text();

    return new Response(JSON.stringify({
      success: true,
      message: "CORS aplicado no bucket " + bucket,
      applied_xml: CORS_XML,
      verification: verifyText,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[b2-setup-cors] error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
