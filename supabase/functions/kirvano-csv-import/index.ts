// kirvano-csv-import
// Importa vendas do CSV de relatório da Kirvano para o CRM Masterclass IA.
// Idempotente: usa dedupe_key (SALE_APPROVED:<codigo>) — pode rodar de novo sem duplicar.
// NÃO dispara WhatsApp (evitar ban — Carlos tomou ban 17/05 com blast).
//
// Body aceito (POST):
//   - multipart/form-data com campo "file" (preferido)
//   - application/json com { csv_base64: string } (encoding Latin1)
//   - text/plain com o CSV direto no body (assume UTF-8)

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOARD_SLUG = "masterclass-ia";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
function normalizePhone(phone: string): string {
  let n = String(phone || "").replace(/\D/g, "");
  if (!n) return "";
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

function parseBRL(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// "17/05/2026 17:39" → "2026-05-17T17:39:00-03:00" (BRT, sem horário de verão)
function parseDate(s: string): string | null {
  const m = (s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00-03:00`;
}

// CSV parser que respeita aspas e ponto-e-vírgula (formato Kirvano).
function parseCSV(text: string): Record<string, string>[] {
  // Remove BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ";") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.length > 1 || cur[0] !== "") lines.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.length > 1 || cur[0] !== "") lines.push(cur);
  }

  if (lines.length === 0) return [];
  const header = lines[0];
  return lines.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (row[idx] ?? "").trim();
    });
    return obj;
  });
}

async function decodeCsvBody(req: Request): Promise<string> {
  const ct = req.headers.get("content-type") || "";

  if (ct.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Campo 'file' ausente no multipart");
    const buf = new Uint8Array(await file.arrayBuffer());
    // Tenta latin1 primeiro (formato Kirvano nativo); se vier UTF-8 com BOM, o parser remove o BOM
    return new TextDecoder("windows-1252").decode(buf);
  }

  if (ct.includes("application/json")) {
    const body = await req.json();
    if (typeof body.csv_base64 === "string") {
      const bin = Uint8Array.from(atob(body.csv_base64), (c) => c.charCodeAt(0));
      return new TextDecoder("windows-1252").decode(bin);
    }
    if (typeof body.csv_text === "string") return body.csv_text;
    throw new Error("JSON sem campo csv_base64 ou csv_text");
  }

  // fallback: corpo bruto
  return await req.text();
}

const PAYMENT_MAP: Record<string, string> = {
  "PIX": "pix",
  "Cartão de Crédito": "credit_card",
  "Cartao de Credito": "credit_card",
  "Apple Pay": "apple_pay",
  "Boleto": "boleto",
  "PicPay": "picpay",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let csvText = "";
  try {
    csvText = await decodeCsvBody(req);
  } catch (e) {
    return jsonResponse({ success: false, error: `CSV body inválido: ${(e as Error).message}` }, 400);
  }

  if (!csvText || csvText.length < 50) {
    return jsonResponse({ success: false, error: "CSV vazio ou muito curto" }, 400);
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    return jsonResponse({ success: false, error: "CSV sem linhas de dados" }, 400);
  }

  // === BOARD + COLUNAS ===
  const { data: board, error: boardErr } = await supabase
    .from("crm_boards").select("id").eq("slug", BOARD_SLUG).maybeSingle();
  if (boardErr || !board) {
    return jsonResponse({ success: false, error: `Board ${BOARD_SLUG} não encontrado` }, 500);
  }
  const { data: columns } = await supabase
    .from("crm_columns").select("id, name").eq("board_id", board.id);
  const colComprou = columns?.find((c) => c.name === "Comprou");
  if (!colComprou) {
    return jsonResponse({ success: false, error: "Coluna 'Comprou' não encontrada no board" }, 500);
  }

  const summary = {
    total_rows: rows.length,
    approved_in_csv: 0,
    inserted: 0,
    skipped_duplicate: 0,
    skipped_not_approved: 0,
    errors: [] as Array<{ codigo: string; nome: string; reason: string }>,
  };

  for (const r of rows) {
    const status = (r["Status"] || "").trim();
    if (status !== "Aprovada") {
      summary.skipped_not_approved++;
      continue;
    }
    summary.approved_in_csv++;

    const codigo = (r["Código"] || r["Codigo"] || "").trim();
    const nome = (r["Cliente (Nome)"] || "Sem nome").trim();
    const email = ((r["Cliente (E-mail)"] || "").trim().toLowerCase()) || null;
    const phone = normalizePhone(r["Cliente (Telefone)"] || "");
    const amount = parseBRL(r["Total"] || r["Valor Pago"] || "0");
    const metodoRaw = (r["Método de Pagamento"] || r["Metodo de Pagamento"] || "").trim();
    const metodo = PAYMENT_MAP[metodoRaw] || metodoRaw.toLowerCase() || null;
    const dt = parseDate(r["Finalizada em"] || "") || parseDate(r["Iniciada em"] || "") || new Date().toISOString();
    const produto = (r["Produto"] || "Masterclass IA").trim();

    if (!codigo) { summary.errors.push({ codigo: "?", nome, reason: "sem codigo" }); continue; }
    if (!phone) { summary.errors.push({ codigo, nome, reason: "sem telefone" }); continue; }

    const dedupeKey = `SALE_APPROVED:${codigo}`;

    // === ENRIQUECIMENTO IG ===
    // Procura dados de Instagram em fontes anteriores (DISC reprograme-se-10x,
    // popup Masterclass, popup VHS). Match por whatsapp normalizado.
    // Isso garante que o lead chegue completo no CRM mesmo se a Kirvano nao
    // tiver mandado IG (Kirvano nao coleta IG no checkout).
    let igHandle: string | null = null;
    let igPicUrl: string | null = null;
    try {
      const { data: enrich } = await supabase
        .from("crm_leads")
        .select("instagram, instagram_profile_pic_url, created_at, crm_boards!inner(slug)")
        .eq("whatsapp", phone)
        .not("instagram", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (enrich) {
        igHandle = (enrich as any).instagram || null;
        igPicUrl = (enrich as any).instagram_profile_pic_url || null;
      }
      // Fallback: tabela leads (popup VHS / popup masterclass)
      if (!igHandle) {
        const { data: l2 } = await supabase
          .from("leads")
          .select("instagram, instagram_profile_pic_url")
          .eq("whatsapp", phone)
          .not("instagram", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (l2) {
          igHandle = l2.instagram || null;
          igPicUrl = l2.instagram_profile_pic_url || null;
        }
      }
    } catch (e) {
      console.warn("[kirvano-csv-import] enriquecimento IG falhou:", (e as Error).message);
    }

    // === Dedupe ===
    const { data: existingSale } = await supabase
      .from("sales_events")
      .select("id").eq("source", "kirvano").eq("dedupe_key", dedupeKey).limit(1).maybeSingle();
    if (existingSale) {
      summary.skipped_duplicate++;
      continue;
    }

    // === Upsert lead ===
    let leadId: string | null = null;
    const { data: existingLead } = await supabase
      .from("crm_leads")
      .select("id, column_id, tags").eq("board_id", board.id).eq("whatsapp", phone).maybeSingle();

    const tags = Array.from(new Set([
      ...(existingLead?.tags || []),
      "Masterclass IA", "Aluno Masterclass IA", "Comprador",
    ]));

    if (existingLead) {
      await supabase.from("crm_leads")
        .update({
          column_id: colComprou.id,
          closed_at: dt,
          tags,
          // só preenche IG se ainda não tiver
          ...(igHandle ? { instagram: igHandle } : {}),
          ...(igPicUrl ? { instagram_profile_pic_url: igPicUrl } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLead.id);
      leadId = existingLead.id;
    } else {
      const { data: newLead, error: insErr } = await supabase
        .from("crm_leads")
        .insert({
          board_id: board.id,
          column_id: colComprou.id,
          name: nome,
          whatsapp: phone,
          email,
          instagram: igHandle,
          instagram_profile_pic_url: igPicUrl,
          source: "kirvano",
          tags,
          closed_at: dt,
          created_at: dt,
        })
        .select("id").single();
      if (insErr || !newLead) {
        summary.errors.push({ codigo, nome, reason: `insert lead: ${insErr?.message ?? "fail"}` });
        continue;
      }
      leadId = newLead.id;

      await supabase.from("crm_activities").insert({
        lead_id: leadId,
        board_id: board.id,
        activity_type: "lead_created",
        description: `${nome} — importado via CSV Kirvano (${codigo})`,
        to_column_name: "Comprou",
        metadata: { source: "csv_import_kirvano", sale_id: codigo, amount },
      });
    }

    // === sales_events ===
    const { error: seErr } = await supabase.from("sales_events").insert({
      name: nome,
      email,
      whatsapp: phone,
      instagram: igHandle,
      instagram_profile_pic_url: igPicUrl,
      product_name: produto,
      amount,
      currency: "BRL",
      payment_method: metodo,
      transaction_id: codigo,
      crm_lead_id: leadId,
      crm_board_id: board.id,
      source: "kirvano",
      dedupe_key: dedupeKey,
      raw_payload: {
        event: "SALE_APPROVED",
        sale_id: codigo,
        transaction_id: codigo,
        customer: { name: nome, email, phone_number: phone },
        products: [{ name: produto }],
        total_price: `R$ ${amount.toFixed(2).replace(".", ",")}`,
        payment_method: metodo,
        utm: {
          source: r["UTM Source"] || null,
          medium: r["UTM Medium"] || null,
          campaign: r["UTM Campaign"] || null,
          content: r["UTM Content"] || null,
        },
        _imported_via: "csv_admin_upload",
        _imported_at: new Date().toISOString(),
      },
      created_at: dt,
    });
    if (seErr) {
      summary.errors.push({ codigo, nome, reason: `insert sales_events: ${seErr.message}` });
      continue;
    }

    summary.inserted++;
  }

  console.log(`[kirvano-csv-import] ${JSON.stringify(summary)}`);
  return jsonResponse({ success: true, ...summary });
});
