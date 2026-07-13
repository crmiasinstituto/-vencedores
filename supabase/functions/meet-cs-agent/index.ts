import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// === resolver de chave de integracao (fonte unica = tabela integration_keys, /admin/configuracoes) ===
// Le do banco primeiro; cai no env var como fallback retrocompat. Suporta instancia-por-cliente.
let _keyClient: any = null;
async function getIntegrationKey(service: string, envFallback?: string): Promise<string | null> {
  try {
    if (!_keyClient) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      _keyClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    }
    const { data } = await _keyClient
      .from("integration_keys")
      .select("api_key, is_active")
      .eq("service", service)
      .maybeSingle();
    if (data && data.is_active && data.api_key) return String(data.api_key).trim();
  } catch (_) { /* cai no fallback */ }
  return (envFallback ? Deno.env.get(envFallback) : null) || null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Agente CS que responde no chat da reuniao SE PASSANDO PELO CARLOS.
// Recebe a mensagem de um participante + contexto recente do chat, cruza com
// crm_leads (uso SUTIL, nunca expoe), e devolve um comentario curto e afiado.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, senderName, recentMessages, intent } = await req.json();
    if (!message || !senderName) {
      return new Response(JSON.stringify({ skip: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Config/persona (singleton)
    const { data: cfg } = await supabase.from("cs_agent_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg) {
      return new Response(JSON.stringify({ error: "cs_agent_config ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Contexto SUTIL do lead: tenta casar pelo nome. Nunca e exposto no chat,
    // so calibra o tom (a regra de privacidade esta na persona).
    let leadContext = "";
    try {
      const clean = String(senderName).trim().split("(")[0].trim();
      if (clean.length >= 3) {
        const { data: lead } = await supabase
          .from("crm_leads")
          .select("name, company_name, faturamento_faixa, perfil_profissional, notes")
          .ilike("name", `%${clean}%`)
          .limit(1)
          .maybeSingle();
        if (lead) {
          const bits: string[] = [];
          if (lead.company_name) bits.push(`empresa: ${lead.company_name}`);
          if (lead.faturamento_faixa) bits.push(`faixa de faturamento: ${lead.faturamento_faixa}`);
          if (lead.perfil_profissional) bits.push(`perfil: ${String(lead.perfil_profissional).slice(0, 220)}`);
          if (lead.notes) bits.push(`notas internas: ${String(lead.notes).slice(0, 220)}`);
          if (bits.length) {
            leadContext = `\n\nCONTEXTO INTERNO sobre ${clean} (USO SUTIL, NUNCA EXPONHA NO CHAT): ${bits.join("; ")}.`;
          }
        }
      }
    } catch (_) { /* segue sem contexto */ }

    const recent = Array.isArray(recentMessages)
      ? recentMessages.slice(-8).map((m: any) => `${m.name}: ${m.text}`).join("\n")
      : "";

    // Herda a VOZ e o MODELO da Carol (agente SDR padrao em ai_sales_agents).
    // Assim o chat ao vivo fala com a mesma personalidade do WhatsApp.
    const { data: carol } = await supabase
      .from("ai_sales_agents")
      .select("system_prompt, model")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    const basePersona = carol?.system_prompt || cfg.persona;
    const model = carol?.model || cfg.model || "claude-haiku-4-5-20251001";

    // Carol e SDR de WhatsApp; aqui o contexto e OUTRO (chat ao vivo em grupo).
    // O adendo (cfg.rules) reescreve o comportamento pro momento da reuniao.
    const knowledge = cfg.knowledge ? `\n\n${cfg.knowledge}` : "";
    const system = `${basePersona}\n\n${cfg.rules}${knowledge}${leadContext}` +
      (intent ? `\n\nDIRECAO ATUAL PARA O MOMENTO: ${intent}` : "");

    const userContent =
      `Conversa recente no chat:\n${recent || "(inicio)"}\n\n` +
      `Responda especificamente a esta mensagem de "${senderName}":\n"${message}"\n\n` +
      `Escreva APENAS a resposta do Carlos no chat (sem aspas, sem prefixo de nome). ` +
      `Se nao merecer resposta, escreva apenas SKIP.`;

    const apiKey = await getIntegrationKey("anthropic", "ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 320,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[meet-cs-agent] anthropic error", res.status, t);
      const lowCredit = /credit balance is too low/i.test(t);
      return new Response(JSON.stringify({ error: lowCredit ? "sem_credito" : `anthropic ${res.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    let reply = (data?.content?.[0]?.text || "").trim();

    // Modelo decidiu nao responder
    if (!reply || /^skip\.?$/i.test(reply)) {
      return new Response(JSON.stringify({ skip: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trava de tamanho + remove travessao por seguranca
    reply = reply.replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim();
    const max = cfg.reply_max_chars || 420;
    if (reply.length > max) {
      let cut = reply.slice(0, max);
      const sp = cut.lastIndexOf(" ");
      if (sp > max * 0.6) cut = cut.slice(0, sp);
      reply = cut.trim();
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[meet-cs-agent] error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
