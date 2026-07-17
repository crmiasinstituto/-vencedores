// eduzz-webhook — recebe a venda da Eduzz e pontua quem indicou.
//
// Chama a RPC public.atribuir_indicacao (idempotente por origem+origem_id), que credita os
// pontos ao padrinho. Aceita qualquer formato de payload da Eduzz porque tenta vários caminhos
// de campo (a Eduzz tem formatos diferentes por versão).
//
// AUTENTICAÇÃO: token compartilhado. Aceita em ?secret=, header x-eduzz-secret, ou body.secret.
// O valor confere contra app_credentials['eduzz_webhook_secret'] (o Carlos define no cofre).
// Sem isso, qualquer um postaria vendas falsas e farmaria pontos.
//
// verify_jwt: false (a Eduzz não manda JWT).

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-eduzz-secret",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Procura um valor em vários caminhos possíveis do payload (case-insensitive nas chaves top).
function pick(obj: any, paths: string[]): any {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const part of path.split(".")) {
      if (cur && typeof cur === "object" && part in cur) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return null;
}

// Status que contam como venda paga, entre os vários rótulos da Eduzz.
const PAGO = ["paid", "pago", "3", "approved", "aprovado", "invoice_paid", "myeduzz.invoice_paid", "completed"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* eduzz pode mandar vazio em teste */ }

    // --- valida o segredo ---
    const secretRecebido =
      url.searchParams.get("secret") ||
      req.headers.get("x-eduzz-secret") ||
      body?.secret || body?.token || null;

    const { data: cred } = await supabase
      .from("app_credentials").select("valor").eq("slug", "eduzz_webhook_secret").maybeSingle();
    const secretEsperado = cred?.valor || null;

    if (!secretEsperado) {
      return json({ ok: false, error: "eduzz_webhook_secret não configurado no cofre (Admin > Credenciais)" }, 503);
    }
    if (secretRecebido !== secretEsperado) {
      return json({ ok: false, error: "segredo inválido" }, 401);
    }

    // --- só processa venda PAGA ---
    const status = String(
      pick(body, ["event", "data.status", "trans_status", "status", "trans_paid"]) ?? "",
    ).toLowerCase();
    if (status && !PAGO.some((p) => status.includes(p))) {
      return json({ ok: true, ignorado: `status '${status}' não é venda paga` });
    }

    // --- extrai os campos, tentando os nomes comuns da Eduzz ---
    const email = pick(body, ["data.buyer.email", "buyer.email", "cliente_email", "customer.email", "email"]);
    const telefone = pick(body, ["data.buyer.cellphone", "buyer.phone", "cliente_cel", "customer.phone_number", "phone"]);
    const produto = pick(body, ["data.product.name", "product.name", "produto_nome", "item_name", "product"]) ?? "Compra Eduzz";
    const valorRaw = pick(body, ["data.amount", "amount", "trans_value", "trans_valor", "value", "price"]);
    const valor = Number(String(valorRaw ?? "0").replace(",", ".")) || 0;
    const transId = String(pick(body, ["data.id", "trans_cod", "transaction_id", "invoice_id", "id"]) ?? "");
    // O código de indicação volta no parâmetro de rastreio que colocamos no checkout.
    const codigo = pick(body, [
      "data.trackers.utm_source", "trackers.utm_source", "utm_source",
      "trans_origin", "origin", "data.origin", "src", "coupon",
    ]);

    if (!email && !codigo) {
      return json({ ok: true, ignorado: "sem email nem código — nada a atribuir" });
    }

    const { data: convId, error } = await supabase.rpc("atribuir_indicacao", {
      p_produto: String(produto),
      p_valor: valor,
      p_origem: "eduzz",
      p_email: email ? String(email) : null,
      p_telefone: telefone ? String(telefone) : null,
      p_codigo: codigo ? String(codigo) : null,
      p_origem_id: transId || null,
    });

    if (error) return json({ ok: false, error: error.message }, 500);

    return json({ ok: true, pontuou: convId != null, conversao_id: convId });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
