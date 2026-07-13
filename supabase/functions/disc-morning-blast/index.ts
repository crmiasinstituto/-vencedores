// disc-morning-blast
// Disparo único pós-evento R10X: bom dia humanizado pra leads do DISC.
// Audiências:
//   A) NÃO compraram → mensagem com link Kirvano + venda Masterclass 09/jun
//   B) COMPRARAM    → pedido de indicação
//
// Implementação:
//   - UAZAPI direto (não pelo uazapi-proxy que tava com formato incompatível)
//   - Busca instância conectada no DB (status='connected')
//   - Marca lead como enviado SÓ APÓS sucesso (se falhar, próxima run tenta de novo)
//   - Marca campo disc_morning_blast_failed_at depois de N tentativas
//   - Batch pequeno (2 por run) pra caber dentro do timeout do pg_net + Edge
//   - Cron rodando 2min cobre os 112 em ~1h50
//
// Anti-spam Meta:
//   - delays 22-55s entre msgs (longos)
//   - 1-2 msgs por run (volume baixo)
//   - 6 variantes de copy pra cada audiência (sorteia)
//   - Window 07:30-13:00 BRT (5h30 pra escoar com folga)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BLAST_SECRET = Deno.env.get("MORNING_BLAST_SECRET") || "";
const UAZAPI_BASE = "https://squaad.uazapi.com";

// Provider switch: 'uazapi' (default, atual) | 'cloud_api' (Meta oficial, exige templates aprovados).
// Quando 'cloud_api', envia via wa-send-cloud usando os templates configurados abaixo.
// Cada template deve ter {{1}} = primeiro nome (param obrigatório). Outras vars vão via *_PARAMS (JSON array).
const BLAST_PROVIDER = (Deno.env.get("DISC_BLAST_PROVIDER") || "uazapi").toLowerCase();
const TEMPLATE_LEAD = Deno.env.get("DISC_BLAST_TEMPLATE_LEAD") || "";
const TEMPLATE_BUYER = Deno.env.get("DISC_BLAST_TEMPLATE_BUYER") || "";
const TEMPLATE_LANGUAGE = Deno.env.get("DISC_BLAST_TEMPLATE_LANGUAGE") || "pt_BR";

const KIRVANO_LINK = "https://pay.kirvano.com/68b23d83-95fa-449e-a4b5-f7beee00fce4";
const EVENTO_LOCAL = "Auditório do Salvador Trade Center";
const EVENTO_DATA = "09 de junho";

const MIN_PER_RUN = 1;
const MAX_PER_RUN = 2;
const DELAY_MIN_MS = 22_000;
const DELAY_MAX_MS = 55_000;
const MAX_FAILURES = 3; // após 3 falhas, marca como failed pra não tentar mais

const WINDOW = { startHour: 7, startMin: 30, endHour: 17, endMin: 0 };

function nowInSaoPaulo(): { hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const hr = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const mn = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const wmap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour: hr, minute: mn, weekday: wmap[wd] ?? 1 };
}

function inWindow(): boolean {
  const { hour, minute } = nowInSaoPaulo();
  const now = hour * 60 + minute;
  const start = WINDOW.startHour * 60 + WINDOW.startMin;
  const end = WINDOW.endHour * 60 + WINDOW.endMin;
  return now >= start && now < end;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function safeName(raw: string): string {
  const fn = (raw || "").trim().split(/\s+/)[0] || "";
  if (!fn || fn.length < 2 || /[0-9@#]/.test(fn)) return "";
  return fn.charAt(0).toUpperCase() + fn.slice(1).toLowerCase();
}



// Greeting dinâmico baseado no horário BRT
function greetingNow(): string {
  const { hour } = nowInSaoPaulo();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function normPhone(raw: string): string {
  let n = (raw || "").replace(/\D/g, "");
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

function buildCaptionLead(firstName: string, discProfile: string | null): string {
  const fn = safeName(firstName);
  const gn = greetingNow();
  const greet = fn ? `${gn}, ${fn}!` : `${gn}!`;
  const discLine = discProfile ? `Seu perfil DISC deu **${discProfile}** — combina com o tipo de empresário que mais cresce com IA aplicada com método. ` : "";
  const variants = [
    `${greet} ☀️\n\nOntem foi histórico. Você fez parte de um momento que muita gente vai lembrar pra sempre.\n${discLine}E olha, o que você viveu lá foi só a **ponta do iceberg** do que vou desenrolar na Masterclass IA para Negócios.\n\n📍 ${EVENTO_DATA} · ${EVENTO_LOCAL} (presencial)\n\nLiberei o acesso por aqui (ainda no preço de pré-venda): ${KIRVANO_LINK}\n\nConta comigo!`,

    `${greet}\n\nAcordei pensando em você (sério). ${discLine}Quem topou estar lá ontem mostrou um tipo de coragem que poucos têm — e é exatamente esse tipo de pessoa que vai dominar IA pros próximos 12 meses.\n\nTô abrindo a Masterclass IA para Negócios — **${EVENTO_DATA}**, presencial em Salvador (Trade Center). É onde vou destilar o método sem filtro.\n\nLink da pré-venda: ${KIRVANO_LINK}`,

    `${fn || "Olá"}, ${greetingNow().toLowerCase()}!\n\nA energia de ontem ficou comigo. Foi tipo um aperitivo do que vem na Masterclass IA para Negócios.\n\n📅 ${EVENTO_DATA} · presencial · ${EVENTO_LOCAL}\n🔗 Reserva sua vaga: ${KIRVANO_LINK}\n\nOs primeiros confirmados pegam o preço antigo. Se faz sentido pra você, segura essa.`,

    `${greet}\n\nPergunta sincera: do que você viu ontem, o que mais te tocou? ${discLine}Se sua resposta foi "tudo, mas eu queria aprofundar isso de verdade" — a Masterclass IA para Negócios foi pensada exatamente pra esse momento.\n\n${EVENTO_DATA}, presencial em Salvador (Trade Center). Link: ${KIRVANO_LINK}\n\nTe espero lá.`,

    `${greetingNow()}${fn ? ", " + fn : ""}! 🌅\n\nResumo do que rolou ontem: foi a abertura. A **Masterclass IA para Negócios** dia ${EVENTO_DATA} (presencial em Salvador) é onde a gente vai fundo.\n\n${KIRVANO_LINK}\n\nSe quiser estar nessa, é por aqui.`,

    `${greet} Carlos aqui.\n\nHonestamente, ${fn || "te"} ver ali ontem fez sentido pra mim. ${discLine}A Masterclass IA para Negócios é onde vou entregar tudo que ficou de fora do palco — pré-venda aberta:\n\n📍 ${EVENTO_DATA} · ${EVENTO_LOCAL}\n👉 ${KIRVANO_LINK}\n\nBora?`,
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

function buildCaptionBuyer(firstName: string): string {
  const fn = safeName(firstName);
  const gn = greetingNow();
  const greet = fn ? `${gn}, ${fn}!` : `${gn}!`;
  const variants = [
    `${greet} ☀️\n\nJá te agradeci ontem mas vou repetir: obrigado por confiar. Sério.\n\nUma pergunta: quando você assistiu minha palestra ontem, você pensou em alguém que ia **amar** conhecer mais sobre IA para Negócios?\n\nSe sim, tô disponibilizando esse link só pra você passar pra quem você acha que merece estar lá com você na Masterclass dia ${EVENTO_DATA}:\n\n🔗 ${KIRVANO_LINK}\n\nBeleza?`,

    `${greetingNow()}${fn ? ", " + fn : ""}!\n\nTá entre os que decidiram ontem 🙏 obrigado por estar comigo nessa.\n\nTe chamei porque sei que você conhece gente que tá no momento exato pra aprender IA pra negócios. Se vier alguém à cabeça, eu te confio esse link pra passar pra ela:\n\n${KIRVANO_LINK}\n\nSó pra quem você sente que merece, belê?`,

    `${greet}\n\nVocê fez parte de um dia incrível ontem. Decidir foi o passo certo.\n\nUma coisa que me ajudaria MUITO: tem alguém na sua cabeça que precisa ver o que você viu? Se sim, passa esse link só pra essa pessoa:\n\n🔗 ${KIRVANO_LINK}\n\nQuero a Masterclass cheia de gente que merece estar lá — e quem melhor que você pra escolher?`,

    `${greetingNow()}${fn ? ", " + fn : ""}! Obrigado de novo pela ontem 🙏\n\nRápido: quem você pensa que ia AMAR essa Masterclass? Esse link é só pra ela:\n\n${KIRVANO_LINK}\n\nConfio em você.`,

    `${greet} Carlos aqui.\n\nQuando vi seu nome confirmado ontem, fiquei feliz mesmo. Vou te esperar na ${EVENTO_DATA} pessoalmente.\n\nPosso pedir uma coisa? Pensa em alguém da sua confiança que ia se transformar com a Masterclass. Esse link é pra essa pessoa:\n\n🔗 ${KIRVANO_LINK}\n\nSó pra quem você indica de coração.`,

    `${greet}\n\nQuem decidiu ontem mostrou um nível de visão diferente. Você foi um deles.\n\nTô pedindo pra você fazer uma coisa: lembra de uma pessoa específica que devia estar nessa Masterclass com você? Manda esse link pra ela:\n\n${KIRVANO_LINK}\n\nQuanto mais gente certa, mais a sala fica forte.`,
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

interface BlastInstance {
  id: string;
  provider: "uazapi" | "cloud_api";
  instance_token: string | null; // UAZAPI
  phone_number_id?: string | null; // Cloud API
}

async function getConnectedInstance(supabase: any, provider: string): Promise<BlastInstance | null> {
  if (provider === "cloud_api") {
    // Cloud API: pega primeira instance cloud (não tem "status=connected" obrigatório
    // porque o gateway é stateless — basta ter phone_number_id e api_key).
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id, provider, phone_number_id, api_key")
      .eq("provider", "cloud_api")
      .not("phone_number_id", "is", null)
      .not("api_key", "is", null)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return { id: data.id, provider: data.provider, instance_token: null, phone_number_id: data.phone_number_id };
  }
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_token, status, provider")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, provider: data.provider || "uazapi", instance_token: data.instance_token };
}

async function uaSendText(instanceToken: string, number: string, text: string): Promise<any> {
  const res = await fetch(`${UAZAPI_BASE}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: instanceToken },
    body: JSON.stringify({ number, text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`UAZAPI send/text ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// Cloud API: envia via edge function wa-send-cloud com template aprovado.
// Espera params posicionais [{{1}}, {{2}}...] — {{1}} é convenção: primeiro nome.
async function cloudSendTemplate(
  instanceId: string,
  number: string,
  templateName: string,
  params: string[],
  leadId: string,
  audience: string,
): Promise<{ message_id: string | null; raw: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wa-send-cloud`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({
      action: "send_template",
      instance_id: instanceId,
      phone: number,
      template_name: templateName,
      template_language: TEMPLATE_LANGUAGE,
      template_params: params,
      lead_id: leadId,
      sent_by: `disc-morning-blast-${audience}`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(`wa-send-cloud ${res.status}: ${data?.error || JSON.stringify(data).slice(0, 200)}`);
  }
  return { message_id: data?.message_id || null, raw: data };
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization") || "";
  const blastSecret = req.headers.get("x-blast-secret") || "";
  const callerIsServiceRole = authHeader.includes(SERVICE_ROLE);
  const callerHasSecret = BLAST_SECRET && blastSecret === BLAST_SECRET;
  if (!callerIsServiceRole && !callerHasSecret) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  if (!inWindow()) {
    return new Response(JSON.stringify({ skipped: "outside_window" }), { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const instance = await getConnectedInstance(supabase, BLAST_PROVIDER);
  if (!instance) {
    return new Response(JSON.stringify({ error: "no_connected_instance", provider: BLAST_PROVIDER }), { status: 503 });
  }
  // Cloud API exige templates configurados via env (mensagem livre não é permitida fora janela 24h)
  if (BLAST_PROVIDER === "cloud_api" && (!TEMPLATE_LEAD || !TEMPLATE_BUYER)) {
    return new Response(
      JSON.stringify({
        error: "missing_cloud_templates",
        hint: "Defina envs DISC_BLAST_TEMPLATE_LEAD e DISC_BLAST_TEMPLATE_BUYER com nomes de templates aprovados pela Meta.",
      }),
      { status: 500 },
    );
  }

  // SAFEGUARD anti-bloqueio Meta: gate antes do lote
  const { data: gate } = await (supabase as any).rpc("wa_can_send_now", { p_instance_id: instance.id });
  if (!gate?.can) {
    return new Response(
      JSON.stringify({ skipped: "rate_limit_or_frozen", gate }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const targetThisRun = rand(MIN_PER_RUN, MAX_PER_RUN);

  // Filtra: DISC concluído, sem envio anterior, sem falha definitiva,
  // attempts < MAX_FAILURES
  const { data: candidates, error } = await supabase
    .from("crm_leads")
    .select("id, name, whatsapp, disc_profile, tags, post_sale_stage, created_at")
    .eq("evento", "reprograme-se-10x")
    .not("disc_profile", "is", null)
    .not("whatsapp", "is", null)
    .is("disc_morning_blast_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(targetThisRun * 5);

  if (error) {
    console.error("[blast] query error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ sent: 0, candidates: 0 }), { status: 200 });
  }

  // Decide buyer vs lead via sales_events.whatsapp last8
  const { data: salesRows } = await supabase
    .from("sales_events")
    .select("whatsapp")
    .ilike("product_slug", "%masterclass%");
  const buyersLast8 = new Set<string>();
  for (const s of salesRows || []) {
    const p = String(s.whatsapp || "").replace(/\D/g, "");
    if (p.length >= 8) buyersLast8.add(p.slice(-8));
  }

  // Pula leads que já falharam MAX_FAILURES vezes
  const filtered = [];
  for (const lead of candidates) {
    const { count: failures } = await supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .like("metadata->>sent_by", "disc-morning-blast%failed%");
    if ((failures ?? 0) >= MAX_FAILURES) continue;
    filtered.push(lead);
    if (filtered.length >= targetThisRun) break;
  }

  if (filtered.length === 0) {
    return new Response(JSON.stringify({ sent: 0, candidates: candidates.length, skipped: "all_max_failures" }), { status: 200 });
  }

  const results: any[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const lead = filtered[i];
    const phone = normPhone(lead.whatsapp || "");
    if (phone.length < 12) {
      results.push({ id: lead.id, ok: false, reason: "phone_too_short", phone });
      // Marca como failed pra não tentar mais
      await supabase
        .from("crm_leads")
        .update({ disc_morning_blast_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
      continue;
    }

    const last8 = phone.slice(-8);
    const tagsArr = (lead.tags || []) as string[];
    const isBuyer = buyersLast8.has(last8) || tagsArr.some((t) => t === "Kirvano" || t === "Comprou");
    const audience = isBuyer ? "buyer" : "lead";
    const firstName = safeName(lead.name || "");

    // Conteúdo enviado depende do provider:
    //  - UAZAPI: copy livre com 6 variantes humanizadas (legado)
    //  - Cloud API: template aprovado pela Meta (1 por audiência) com {{1}}=primeiro_nome
    const uazapiMessage = isBuyer
      ? buildCaptionBuyer(lead.name || "")
      : buildCaptionLead(lead.name || "", lead.disc_profile || null);

    try {
      let sentMessageId: string | null = null;
      let logContent: string;
      let logType: "text" | "template";
      let logMetadata: Record<string, any>;

      if (BLAST_PROVIDER === "cloud_api") {
        const templateName = isBuyer ? TEMPLATE_BUYER : TEMPLATE_LEAD;
        // {{1}}=primeiro_nome (ou "amigo(a)" fallback). Outros params do template não suportados aqui ainda.
        const params = [firstName || "amigo(a)"];
        const r = await cloudSendTemplate(instance.id, phone, templateName, params, lead.id, audience);
        sentMessageId = r.message_id;
        logContent = `[template:${templateName}] params=${JSON.stringify(params)}`;
        logType = "template";
        logMetadata = {
          provider: "cloud_api",
          template_name: templateName,
          template_params: params,
          raw: r.raw,
          sent_by: `disc-morning-blast-${audience}`,
        };
        // wa-send-cloud já grava em whatsapp_messages — não duplico aqui.
        await supabase
          .from("crm_leads")
          .update({ disc_morning_blast_sent_at: new Date().toISOString() })
          .eq("id", lead.id);
      } else {
        const data = await uaSendText(instance.instance_token!, phone, uazapiMessage);
        sentMessageId = data.key?.id || data.messageId || null;
        logContent = uazapiMessage;
        logType = "text";
        logMetadata = { ...data, provider: "uazapi", sent_by: `disc-morning-blast-${audience}` };
        await supabase
          .from("crm_leads")
          .update({ disc_morning_blast_sent_at: new Date().toISOString() })
          .eq("id", lead.id);
        await supabase.from("whatsapp_messages").insert({
          instance_id: instance.id,
          lead_id: lead.id,
          remote_phone: phone,
          direction: "outbound",
          message_type: logType,
          content: logContent,
          whatsapp_message_id: sentMessageId,
          status: "sent",
          metadata: logMetadata,
        });
      }

      results.push({ id: lead.id, ok: true, audience, provider: BLAST_PROVIDER, message_id: sentMessageId });
    } catch (e: any) {
      const errMsg = String(e?.message || e).slice(0, 300);
      console.error(`[blast] send fail lead=${lead.id} provider=${BLAST_PROVIDER} ${errMsg}`);
      // Grava falha em whatsapp_messages pra contagem de retries (caminho UAZAPI; Cloud API já loga internamente)
      if (BLAST_PROVIDER !== "cloud_api") {
        await supabase.from("whatsapp_messages").insert({
          instance_id: instance.id,
          lead_id: lead.id,
          remote_phone: phone,
          direction: "outbound",
          message_type: "text",
          content: uazapiMessage,
          status: "failed",
          metadata: { error: errMsg, sent_by: `disc-morning-blast-${audience}-failed`, provider: "uazapi" },
        });
      } else {
        // Cloud API: loga só metadata mínima (mensagem real já foi logada por wa-send-cloud se chegou lá)
        await supabase.from("whatsapp_messages").insert({
          instance_id: instance.id,
          lead_id: lead.id,
          remote_phone: phone,
          direction: "outbound",
          message_type: "template",
          content: `[failed template:${isBuyer ? TEMPLATE_BUYER : TEMPLATE_LEAD}]`,
          status: "failed",
          metadata: { error: errMsg, sent_by: `disc-morning-blast-${audience}-failed`, provider: "cloud_api" },
        });
      }
      results.push({ id: lead.id, ok: false, audience, provider: BLAST_PROVIDER, error: errMsg });
    }

    if (i < filtered.length - 1) await sleep(rand(DELAY_MIN_MS, DELAY_MAX_MS));
  }

  return new Response(
    JSON.stringify({
      provider: BLAST_PROVIDER,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      buyers_sent: results.filter((r) => r.ok && r.audience === "buyer").length,
      leads_sent: results.filter((r) => r.ok && r.audience === "lead").length,
      candidates: candidates.length,
      tried: filtered.length,
      instance_id: instance.id,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
