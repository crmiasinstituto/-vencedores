// One-shot: cria bucket publico 'module-thumbnails', recebe PNGs em base64
// via POST e atualiza thumbnail_url dos modulos. Resolve o problema de
// Netlify nao deployar /trilhas/*.png — passamos a servir pelo Storage.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UploadItem {
  name: string;       // ex: 'boas-vindas.png'
  base64: string;     // conteudo do PNG em base64
  module_match: string; // ILIKE pattern pra title
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { items } = await req.json() as { items: UploadItem[] };
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items array required");
    }

    const bucketName = "module-thumbnails";

    // 1. Garante bucket publico (idempotente)
    const { data: existing } = await supabase.storage.getBucket(bucketName);
    if (!existing) {
      const { error: createErr } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      });
      if (createErr && !createErr.message.includes("already exists")) {
        throw createErr;
      }
    } else if (!existing.public) {
      await supabase.storage.updateBucket(bucketName, { public: true });
    }

    const results: any[] = [];
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    for (const item of items) {
      // 2. Upload (upsert: substitui se existir)
      const bytes = Uint8Array.from(atob(item.base64), c => c.charCodeAt(0));
      const { error: upErr } = await supabase.storage
        .from(bucketName)
        .upload(item.name, bytes, {
          contentType: "image/png",
          upsert: true,
        });

      if (upErr) {
        results.push({ name: item.name, ok: false, error: upErr.message });
        continue;
      }

      // 3. URL publica
      const publicUrl = `${supaUrl}/storage/v1/object/public/${bucketName}/${item.name}`;

      // 4. Update do modulo
      const { data: updated, error: dbErr } = await supabase
        .from("member_modules")
        .update({ thumbnail_url: publicUrl })
        .ilike("title", item.module_match)
        .select("id, title");

      results.push({
        name: item.name,
        ok: !dbErr,
        size: bytes.length,
        public_url: publicUrl,
        updated_modules: updated?.map((m: any) => m.title) || [],
        db_error: dbErr?.message,
      });
    }

    return new Response(JSON.stringify({ ok: true, bucket: bucketName, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
