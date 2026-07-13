import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// weekly-group-report
// Resumo semanal enviado no grupo da mentoria toda sexta 17:30 BRT (cron).
// 4 secoes: Agenda da proxima semana + Destaques do grupo (IA) + Mais ativos + Recado fixo.
// Body opcional: { group_jid?: string, dry_run?: boolean }
//   dry_run=true  -> monta e RETORNA a mensagem, NAO envia (pra testar).
// ============================================================

// Grupo alvo padrao: MentorIA - SQUAAD (remote_phone e o jid sem @g.us).
const DEFAULT_GROUP_JID = "120363407700316960";
const TZ = "America/Sao_Paulo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RECADO_FIXO =
  "Continue acessando a area de membros durante a semana para assistir as gravacoes e revisar os materiais. Qualquer duvida, e so trazer aqui no grupo. Bora pra cima!";

function fmtBR(ts: string): string {
  try {
    const d = new Date(ts);
    const dia = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
    return `${dia} ${hora}`;
  } catch { return ts; }
}

async function getAnthropicKey(sb: any): Promise<string | null> {
  try {
    const { data } = await sb.from("integration_keys").select("api_key, is_active").eq("service", "anthropic").maybeSingle();
    if (data && data.is_active && data.api_key) return String(data.api_key).trim();
  } catch (_) { /* fallback */ }
  return Deno.env.get("ANTHROPIC_API_KEY") || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* cron manda {} */ }
    const groupJid: string = String(body.group_jid || DEFAULT_GROUP_JID).replace("@g.us", "");
    const dryRun: boolean = body.dry_run === true;

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    // ---- 1. Mensagens da semana (pra digest + ranking) ----
    const { data: msgs } = await sb
      .from("whatsapp_messages")
      .select("content, direction, metadata, created_at")
      .eq("remote_phone", groupJid)
      .eq("direction", "inbound")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(500);
    const messages = (msgs || []).filter((m: any) => (m.content || "").trim().length > 0);

    // ---- 2. Ranking de engajamento ----
    const counts: Record<string, number> = {};
    for (const m of messages) {
      const name = (m.metadata?.senderName || "").trim();
      if (name) counts[name] = (counts[name] || 0) + 1;
    }
    const ranking = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // ---- 3. Agenda da proxima semana (meetings + collective_events) ----
    const agenda: { when: string; title: string }[] = [];
    try {
      const { data: mts } = await sb
        .from("meetings")
        .select("title, scheduled_at, members_scheduled_at, members_visible, kind")
        .gte("scheduled_at", new Date().toISOString())
        .lte("scheduled_at", until)
        .order("scheduled_at", { ascending: true });
      for (const m of mts || []) {
        if (m.members_visible || ["live-session", "lesson"].includes(m.kind)) {
          agenda.push({ when: fmtBR(m.members_scheduled_at || m.scheduled_at), title: m.title || "Encontro" });
        }
      }
    } catch (_) { /* segue */ }
    try {
      const { data: evs } = await sb
        .from("collective_events")
        .select("title, scheduled_at, status")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .lte("scheduled_at", until)
        .order("scheduled_at", { ascending: true });
      for (const e of evs || []) agenda.push({ when: fmtBR(e.scheduled_at), title: e.title || "Evento" });
    } catch (_) { /* segue */ }
    agenda.sort((a, b) => a.when.localeCompare(b.when));

    // ---- 4. Destaques do grupo (IA) ----
    let destaques = "";
    if (messages.length >= 5) {
      const apiKey = await getAnthropicKey(sb);
      if (apiKey) {
        const convo = messages.slice(-200)
          .map((m: any) => `${(m.metadata?.senderName || "aluno")}: ${m.content}`)
          .join("\n").slice(0, 9000);
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 400,
              system:
                "Voce resume a semana de um grupo de WhatsApp de uma mentoria de IA para negocios. " +
                "Gere de 2 a 4 topicos curtos com os principais assuntos e duvidas discutidos na semana. " +
                "Comece cada topico com um hifen. Escreva em portugues, tom proximo, SEM emojis, SEM inventar nada " +
                "que nao esteja nas mensagens. Se a semana teve pouca conversa, diga em uma linha que foi uma semana mais calma.",
              messages: [{ role: "user", content: `Mensagens da semana no grupo:\n\n${convo}` }],
            }),
          });
          if (res.ok) {
            const j = await res.json();
            destaques = (j?.content?.[0]?.text || "").trim();
          } else {
            console.error("[weekly-group-report] anthropic", res.status, (await res.text()).slice(0, 200));
          }
        } catch (e) { console.error("[weekly-group-report] anthropic exc", String(e)); }
      }
    }

    // ---- 5. Monta a mensagem ----
    const parts: string[] = ["*Resumo da Semana - Mentoria*"];

    parts.push("\n*Agenda da proxima semana*");
    if (agenda.length) parts.push(agenda.map((a) => `- ${a.when}: ${a.title}`).join("\n"));
    else parts.push("- Nada agendado por enquanto. Fique de olho aqui no grupo.");

    if (destaques) { parts.push("\n*Destaques do grupo*"); parts.push(destaques); }

    if (ranking.length) {
      parts.push("\n*Mais ativos da semana*");
      parts.push(ranking.map(([name, n], i) => `${i + 1}. ${name} (${n} msgs)`).join("\n"));
    }

    parts.push("\n" + RECADO_FIXO);
    const message = parts.join("\n");

    // ---- 6. Envio (ou dry_run) ----
    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, stats: { messages: messages.length, agenda: agenda.length, ranking: ranking.length, has_ai: !!destaques }, message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Instancia: a vinculada ao grupo; fallback = 1a uazapi conectada nao-blast.
    let inst: any = null;
    const { data: grp } = await sb.from("whatsapp_groups").select("instance_id").eq("group_jid", groupJid).maybeSingle();
    if (grp?.instance_id) {
      const { data } = await sb.from("whatsapp_instances").select("instance_token, subdomain, status").eq("id", grp.instance_id).maybeSingle();
      if (data && data.status === "connected") inst = data;
    }
    if (!inst) {
      const { data } = await sb.from("whatsapp_instances")
        .select("instance_token, subdomain, status")
        .eq("provider", "uazapi").eq("status", "connected").eq("is_dedicated_blast", false)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      inst = data;
    }
    if (!inst?.instance_token || !inst?.subdomain) {
      return new Response(JSON.stringify({ ok: false, error: "sem instancia uazapi conectada", message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendRes = await fetch(`https://${inst.subdomain}.uazapi.com/send/text`, {
      method: "POST",
      headers: { token: inst.instance_token, "Content-Type": "application/json" },
      body: JSON.stringify({ number: `${groupJid}@g.us`, text: message }),
    });
    const sendJson = await sendRes.json().catch(() => ({}));
    const sent = !!(sendJson?.id || sendJson?.messageid || sendJson?.key);

    return new Response(JSON.stringify({ ok: sent, sent, stats: { messages: messages.length, agenda: agenda.length, ranking: ranking.length, has_ai: !!destaques }, detail: sendJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[weekly-group-report]", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
