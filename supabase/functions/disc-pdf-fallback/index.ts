// disc-pdf-fallback
// Cron-triggered (a cada 10min na janela 10-23 UTC) que processa entradas
// status='queued' em disc_pdf_requests que nao foram disparadas pelo webhook
// (ou seja, o lead nao mandou a msg no WhatsApp). Anti-ban: max 2 por rodada,
// espacamento natural entre envios delegado ao disc-pdf-deliver (delays
// internos de 8-18s humano + throttle global + queue delay).
//
// Idade minima: 15 minutos. Da chance pro lead mandar a msg primeiro (caminho
// rapido via webhook). Se nao mandou, mandamos mesmo assim mas devagar.

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUEUE_MIN_AGE_MIN = 15;
const MAX_PER_RUN = 2;
const INTER_LEAD_DELAY_MIN_MS = 30_000;
const INTER_LEAD_DELAY_MAX_MS = 90_000;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - QUEUE_MIN_AGE_MIN * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("disc_pdf_requests")
    .select("id, lead_id, requested_at")
    .eq("status", "queued")
    .lt("requested_at", cutoff)
    .order("requested_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[disc-pdf-fallback] processando ${rows.length} queued antigos`);

  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/disc-pdf-deliver`;
  const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`;

  const worker = (async () => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        console.log(`[disc-pdf-fallback] disparando lead=${row.lead_id} (idle ${Math.floor((Date.now() - new Date(row.requested_at).getTime()) / 60000)}min)`);
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ lead_id: row.lead_id }),
        });
      } catch (e) {
        console.warn(`[disc-pdf-fallback] erro lead=${row.lead_id}:`, (e as Error).message);
      }
      // Espacamento natural entre leads (so se houver mais um pela frente)
      if (i < rows.length - 1) {
        const wait = randomBetween(INTER_LEAD_DELAY_MIN_MS, INTER_LEAD_DELAY_MAX_MS);
        console.log(`[disc-pdf-fallback] aguardando ${wait}ms antes do proximo lead`);
        await delay(wait);
      }
    }
  })();

  // Mantem o worker vivo apos retornar (Deno edge runtime)
  // @ts-ignore EdgeRuntime presente em runtime supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(worker);

  return new Response(JSON.stringify({ success: true, queued_for_processing: rows.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
