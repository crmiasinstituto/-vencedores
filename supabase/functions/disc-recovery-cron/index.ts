// disc-recovery-cron
// Chamada por pg_cron a cada 5 minutos. Envia a imagem da Masterclass via
// WhatsApp pros leads que:
//   - fizeram DISC há 20+ min (evento = 'reprograme-se-10x')
//   - têm whatsapp
//   - ainda não receberam o recovery
//   - não têm SALE_APPROVED da Kirvano (não compraram)
//
// Boas práticas anti-bloqueio (UAZAPI):
//   - horário comercial: 09h–21h America/Sao_Paulo
//   - segunda-feira a sábado (pula domingo)
//   - máximo MAX_PER_RUN msgs por execução (= ~96/h se cron roda a cada 5 min)
//   - delay aleatório de 8–22s entre msgs do mesmo run
//   - marca masterclass_recovery_sent_at imediatamente pra evitar race com a
//     próxima execução do cron
//
// Privado: chamado só pelo cron interno (verify_jwt = false, mas exige header
// secreto X-Recovery-Secret pra não ser invocável publicamente).

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECOVERY_SECRET = Deno.env.get("RECOVERY_SECRET") || "";
const PUBLIC_BASE_URL = Deno.env.get("PUBLIC_BASE_URL") || "https://squaad-reprograme-10x.netlify.app";
const RECOVERY_INSTANCE_ID = Deno.env.get("RECOVERY_INSTANCE_ID") || "e93f6f6e-f045-4cf5-af0d-fe5a35911225";

const IMAGE_URL = `${PUBLIC_BASE_URL}/apresentacoes/assets/masterclass_recovery.png`;
// Volume aleatório por run (evita padrão "exatamente 8 toda vez" que algoritmo
// anti-spam detecta). Cada execução do cron envia entre MIN e MAX msgs.
const MIN_PER_RUN = 4;
const MAX_PER_RUN = 8;
// Delay aleatório entre msgs (segundos). Janela 12-35s simula tempo de digitação
// + leitura humano, e quebra qualquer cadência regular.
const DELAY_MIN_MS = 12_000;
const DELAY_MAX_MS = 35_000;
// Janela conservadora — não envia mensagem perto do "fim do expediente"
// (pessoas se incomodam com WhatsApp tarde da noite e podem reportar spam)
const BUSINESS_HOURS = { startHour: 9, endHour: 20 }; // America/Sao_Paulo

function nowInSaoPaulo(): { hour: number; weekday: number } {
  // weekday: 0=Sunday, 1=Monday, ..., 6=Saturday
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const hr = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const wmap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour: hr, weekday: wmap[wd] ?? 1 };
}

function inBusinessHours(): boolean {
  const { hour, weekday } = nowInSaoPaulo();
  if (weekday === 0) return false; // domingo não envia
  return hour >= BUSINESS_HOURS.startHour && hour < BUSINESS_HOURS.endHour;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Sanitiza primeiro nome (evita lead "asdf" ou ""). Capitaliza primeira letra.
function safeName(raw: string): string {
  const fn = (raw || "").trim().split(/\s+/)[0] || "";
  if (!fn || fn.length < 2 || /[0-9@#]/.test(fn)) return ""; // não usa nome se estranho
  return fn.charAt(0).toUpperCase() + fn.slice(1).toLowerCase();
}

function buildCaption(firstName: string, discProfile: string | null): string {
  const fn = safeName(firstName);
  const greet = fn ? `${fn}, ` : "Olá, ";
  const oi = fn ? `Oi ${fn}` : "Oi";
  const ei = fn ? `Ei ${fn}` : "Ei";
  // Menciona perfil DISC quando disponível pra dar sensação de personalização real
  const discRef = discProfile ? `Vi que seu perfil DISC deu **${discProfile}** — ` : "";

  // 7 variações de copy, cada uma com tom levemente diferente:
  // 1) acolhedora  2) direta-curta  3) escassez (vagas)  4) urgência (preço)
  // 5) autoridade (método)  6) primeira pessoa (Carlos)  7) reflexiva
  const variants = [
    // 1) acolhedora — tom de "te separei algo"
    `${oi}, separei isso pra você 👇

${discRef}achei que ia te interessar de verdade. Fiz uma Masterclass curta mostrando o método que uso pra faturar de R$ 5k a 15k/mês com IA pra Negócios.

Hoje tá R$ 47. Amanhã sobe pra R$ 97. Sem pressão — só dá uma olhada quando puder.`,

    // 2) direta-curta — sem rodeio
    `${greet}vi seu DISC e to deixando isso aqui.

Masterclass prática de IA pra Negócios — R$ 47 só hoje (amanhã R$ 97). Se fizer sentido pra você, é só apontar a câmera no QR.`,

    // 3) escassez — gatilho vagas
    `${greet}quem fez o DISC tem prioridade nas 100 vagas da Masterclass 🙏

${discRef}achei que combinava com você. R$ 47 só hoje. Os 100 lugares somem rápido — se quiser garantir, é a hora.`,

    // 4) urgência preço — virada amanhã
    `${oi}!

Aviso amigo: a Masterclass ainda tá R$ 47 hoje. Amanhã vira R$ 97 e fica assim. Se o seu DISC bateu com o que você sente no negócio, vale demais dar uma olhada.`,

    // 5) autoridade — método
    `${greet}o que mostro nessa Masterclass é o mesmo método que aplico nos meus negócios e nas empresas que atendo.

Sem teoria, sem hype. Sai R$ 47 hoje (R$ 97 a partir de amanhã). Te deixo a info — decisão é sua.`,

    // 6) primeira pessoa — Carlos falando
    `${ei}, Carlos aqui.

Vi seu DISC e fiquei pensando que talvez você curtisse essa Masterclass. É curta, prática e custa R$ 47 hoje. Tô deixando aqui caso queira aproveitar antes de subir o preço.`,

    // 7) reflexiva — cutuca dor
    `${greet}uma pergunta rápida: o seu negócio hoje cresce do mesmo jeito que crescia ano passado?

${discRef}se a resposta for "mais ou menos", a Masterclass de IA pra Negócios pode mudar isso. R$ 47 só hoje.`,
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

Deno.serve(async (req) => {
  // Trava de segurança: aceita só requisições com o header secreto OU vindas do
  // pg_cron com a service_role no Authorization. Evita invocação pública.
  const authHeader = req.headers.get("authorization") || "";
  const recoverySecret = req.headers.get("x-recovery-secret") || "";
  const callerIsServiceRole = authHeader.includes(SERVICE_ROLE);
  const callerHasSecret = RECOVERY_SECRET && recoverySecret === RECOVERY_SECRET;
  if (!callerIsServiceRole && !callerHasSecret) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  if (!inBusinessHours()) {
    return new Response(JSON.stringify({ skipped: "outside_business_hours" }), { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // SAFEGUARD anti-bloqueio Meta: gate por instância antes de processar
  const { data: gate } = await (supabase as any).rpc("wa_can_send_now", { p_instance_id: RECOVERY_INSTANCE_ID });
  if (!gate?.can) {
    return new Response(
      JSON.stringify({ skipped: "rate_limit_or_frozen", gate }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Volume aleatório nessa execução (evita padrão fixo "8 sempre")
  const targetThisRun = rand(MIN_PER_RUN, MAX_PER_RUN);

  // 1) Pesca candidatos: lead R10X, 20+ min, COMPLETOU O DISC, sem recovery,
  // sem compra Kirvano. Filtro `disc_profile IS NOT NULL` garante que só recebe
  // quem REALMENTE terminou o quiz — evita spam pra quem só preencheu o form
  // de captura mas abandonou no quiz.
  const { data: candidates, error } = await supabase
    .from("crm_leads")
    .select("id, name, whatsapp, disc_profile, created_at")
    .eq("evento", "reprograme-se-10x")
    .not("disc_profile", "is", null)
    .lt("created_at", new Date(Date.now() - 20 * 60_000).toISOString())
    .is("masterclass_recovery_sent_at", null)
    .not("whatsapp", "is", null)
    .order("created_at", { ascending: true })
    .limit(targetThisRun * 4); // pega mais pra filtrar comprou_kirvano em memória

  if (error) {
    console.error("[disc-recovery] query error", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ sent: 0, candidates: 0 }), { status: 200 });
  }

  // 2) Filtra quem JÁ comprou via Kirvano (SALE_APPROVED no log)
  const phones = candidates
    .map((c) => String(c.whatsapp || "").replace(/\D/g, ""))
    .filter((p) => p.length >= 10);

  const { data: buyers } = await supabase
    .from("webhook_event_log")
    .select("customer_phone")
    .eq("provider", "kirvano")
    .eq("event_type", "SALE_APPROVED")
    .in("customer_phone", phones);

  const buyerPhonesNorm = new Set(
    (buyers || []).map((b) => String(b.customer_phone || "").replace(/\D/g, "")),
  );

  const toSend = candidates
    .filter((c) => {
      const norm = String(c.whatsapp || "").replace(/\D/g, "");
      return norm.length >= 10 && !buyerPhonesNorm.has(norm);
    })
    .slice(0, targetThisRun);

  if (toSend.length === 0) {
    return new Response(JSON.stringify({ sent: 0, candidates: candidates.length, buyers_skipped: buyerPhonesNorm.size }), { status: 200 });
  }

  // 3) Loop com delay aleatório entre msgs (anti-block UAZAPI)
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < toSend.length; i++) {
    const lead = toSend[i];
    const phone = String(lead.whatsapp || "").replace(/\D/g, "");
    const caption = buildCaption(lead.name || "", lead.disc_profile || null);

    // Marca ANTES de enviar pra evitar race com próxima execução do cron.
    // Se o envio falhar, tudo bem — não bombardear é melhor que dobrar.
    const { error: markErr } = await supabase
      .from("crm_leads")
      .update({ masterclass_recovery_sent_at: new Date().toISOString() })
      .eq("id", lead.id)
      .is("masterclass_recovery_sent_at", null); // só marca se ainda não foi
    if (markErr) {
      console.error("[disc-recovery] mark error", lead.id, markErr);
      results.push({ id: lead.id, ok: false, error: "mark_failed" });
      continue;
    }

    try {
      const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/uazapi-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          action: "send_media",
          instance_id: RECOVERY_INSTANCE_ID,
          params: {
            number: phone,
            media_type: "image",
            file: IMAGE_URL,
            caption,
            lead_id: lead.id,
            sent_by: "disc-recovery-cron",
          },
        }),
      });
      const proxyJson = await proxyRes.json().catch(() => ({}));
      if (!proxyRes.ok) {
        console.error("[disc-recovery] uazapi-proxy fail", lead.id, proxyJson);
        results.push({ id: lead.id, ok: false, error: JSON.stringify(proxyJson) });
      } else {
        results.push({ id: lead.id, ok: true });
      }
    } catch (e) {
      console.error("[disc-recovery] send exception", lead.id, e);
      results.push({ id: lead.id, ok: false, error: String(e) });
    }

    // Delay aleatório antes da próxima msg (humaniza)
    if (i < toSend.length - 1) {
      await sleep(rand(DELAY_MIN_MS, DELAY_MAX_MS));
    }
  }

  return new Response(
    JSON.stringify({
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      candidates: candidates.length,
      buyers_skipped: buyerPhonesNorm.size,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
