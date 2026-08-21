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
    let bodyBruto = "";
    try {
      bodyBruto = await req.text();
      body = JSON.parse(bodyBruto);
    } catch {
      // Eduzz pode mandar vazio em teste — ou form-encoded, que o req.json() rejeitava
      // silenciosamente. Aqui aproveitamos o texto já lido pra tentar o formato de formulário
      // antes de desistir: era um caminho em que produto e valor sumiam sem deixar rastro.
      if (bodyBruto.includes("=")) {
        try {
          body = Object.fromEntries(new URLSearchParams(bodyBruto));
        } catch { /* segue com body vazio */ }
      }
    }

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

    // Registra o que chegou, reconhecido ou não. Em 03/08 quatro vendas entraram com valor
    // R$ 0 e produto "Compra Eduzz" (o fallback) e não havia como saber quais campos a Eduzz
    // tinha mandado, porque nada guardava o corpo da requisição.
    try {
      await supabase.from("webhook_event_log").insert({
        provider: "eduzz",
        event_type: "recebido",
        raw_payload: bodyBruto ? { texto: bodyBruto.slice(0, 8000), parsed: body } : { parsed: body },
      });
    } catch (e) { console.error("falha logando payload eduzz:", e); }

    // --- só processa venda PAGA ---
    const status = String(
      pick(body, ["event", "data.status", "trans_status", "status", "trans_paid"]) ?? "",
    ).toLowerCase();
    if (status && !PAGO.some((p) => status.includes(p))) {
      // Não é venda — mas é intenção de compra, que é o lead mais quente que existe: a pessoa
      // já decidiu e travou no pagamento. Antes esses eventos eram descartados sem deixar
      // rastro; agora viram lead marcado com o estágio, pra alimentar recuperação.
      //
      // Nunca vira sales_events: faturamento só conta pagamento confirmado.
      const evento = String(pick(body, ["event"]) ?? "").toLowerCase();
      const metodo = String(pick(body, [
        "data.invoice.payment.method", "data.payment.method", "payment.method",
      ]) ?? "").toLowerCase();
      const motivo = pick(body, [
        "data.invoice.failReasonMessage", "data.invoice.failReason",
      ]);

      // Nos eventos não pagos a Eduzz manda `data.customer`; no pago manda `data.buyer`.
      const cEmail = pick(body, ["data.customer.email", "customer.email", "data.buyer.email", "buyer.email"]);
      const cNome = pick(body, ["data.customer.name", "customer.name", "data.buyer.name", "buyer.name"]);
      const cTel = pick(body, [
        "data.customer.cellphone", "customer.cellphone", "data.buyer.cellphone", "buyer.cellphone",
        "data.customer.phone", "customer.phone",
      ]);

      let tag = "checkout-abandonado";
      if (evento.includes("card_attempted") || metodo.includes("card")) tag = "cartao-recusado";
      else if (metodo.includes("boleto") || metodo.includes("ticket")) tag = "boleto-gerado";
      else if (metodo.includes("pix")) tag = "pix-gerado";

      if (!cEmail && !cTel) {
        return json({ ok: true, ignorado: `evento '${status}' sem e-mail nem telefone` });
      }

      try {
        const { data: leadId, error: leadErr } = await supabase.rpc("eduzz_registrar_intencao", {
          p_email: cEmail ? String(cEmail) : null,
          p_telefone: cTel ? String(cTel) : null,
          p_nome: cNome ? String(cNome) : null,
          p_tag: tag,
          p_motivo: motivo ? String(motivo) : null,
        });
        if (leadErr) console.error("eduzz_registrar_intencao falhou:", leadErr);
        return json({ ok: true, intencao: tag, lead_id: leadId ?? null, motivo: motivo ?? null });
      } catch (e) {
        console.error("erro registrando intenção:", e);
        return json({ ok: true, ignorado: `status '${status}' não é venda paga` });
      }
    }

    // --- extrai os campos, tentando os nomes comuns da Eduzz ---
    const email = pick(body, ["data.buyer.email", "buyer.email", "cliente_email", "customer.email", "email"]);
    const telefone = pick(body, ["data.buyer.cellphone", "buyer.phone", "cliente_cel", "customer.phone_number", "phone"]);
    // Caminhos confirmados no payload real (myeduzz.invoice_paid, capturado em 03/08/2026):
    //   produto -> data.items[0].name          (NÃO existe data.product.name)
    //   valor   -> data.price.value            (NÃO existe data.amount nem trans_value)
    // Os nomes antigos ficam no fim da lista como reserva, mas nunca casaram — por isso as
    // vendas entravam com produto "Compra Eduzz" e valor R$ 0,00.
    const produto = pick(body, [
      "data.items.0.name", "items.0.name",
      "data.product.name", "product.name", "produto_nome", "item_name", "product",
    ]) ?? "Compra Eduzz";

    // data.price.value é o preço da oferta (97). data.price.paid.value inclui os juros do
    // parcelamento (120,36) — o que a Eduzz cobrou, não o que a venda vale. Para faturamento
    // o número certo é o da oferta.
    const valorRaw = pick(body, [
      "data.price.value", "price.value",
      "data.items.0.price.value",
      "data.amount", "amount", "trans_value", "trans_valor", "value", "price",
    ]);
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
