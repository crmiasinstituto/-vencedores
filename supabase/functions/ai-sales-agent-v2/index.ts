// SQUAAD AI Sales Agent v2
// Inspired by crm-ai-first-template 2.0 — adapted to the SQUAAD schema.
// Multi-provider (Anthropic / OpenAI / Gemini via Lovable), stateful via
// ai_agent_conversations, bot-detection + anti-ban rate limiting, and
// 11 tools that mutate the CRM directly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
};

// ==================== SAFETY HELPERS ====================

function sanitizeForJSON(obj: any): any {
  if (typeof obj === "string") {
    return obj.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
  }
  if (Array.isArray(obj)) return obj.map(sanitizeForJSON);
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj)) out[k] = sanitizeForJSON(obj[k]);
    return out;
  }
  return obj;
}

const INTERNAL_KEYWORDS = [
  "o lead ", "do lead ", "ao lead ", "pro lead",
  "desqualificação", "desqualificar", "qualificação do",
  "fluxo de ", "INTERNAL", "tool_call", "function_call",
  "qualify_bant", "change_stage", "update_lead", "notify_human",
  "lead_id", "pipeline_stage", "regra de negócio",
];

function stripInternalThinking(msg: string): string {
  if (!msg) return msg;
  const lower = msg.toLowerCase();
  if (INTERNAL_KEYWORDS.some((k) => lower.includes(k))) {
    console.error(`[v2] blocked internal message: "${msg.substring(0, 120)}"`);
    return "";
  }
  let cleaned = msg;
  const thinkPattern = /^(Analisand[oa]|Vou |Preciso |Pensand[oa]|Considerand[oa]|Observand[oa]|Verificand[oa]|Notei que|Percebi que|Olhando|Com base|Baseado)[^\n]*(\n[^\n]*)*?\n\n/i;
  const m = cleaned.match(thinkPattern);
  if (m) {
    const after = cleaned.substring(m[0].length).trim();
    if (after.length > 10) cleaned = after;
  }
  cleaned = cleaned.replace(/^\[[^\]]{10,}\]\s*\n*/g, "").trim();
  cleaned = cleaned.replace(/^(Resposta|Mensagem|Texto|Reply|Message)\s*:\s*/i, "").trim();
  return cleaned;
}

// ==================== PROVIDER DETECTION ====================

type Provider = "anthropic" | "openai" | "lovable-gemini";

function detectProvider(model: string, explicit?: string): Provider {
  if (explicit === "anthropic" || explicit === "openai" || explicit === "lovable-gemini") return explicit;
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gpt") || model.startsWith("o")) return "openai";
  return "lovable-gemini";
}

// ==================== TOOL SCHEMAS ====================

// Shape in canonical JSON Schema; we translate per-provider at call time.
interface ToolDef {
  name: string;
  description: string;
  parameters: any;
}

const TOOLS: ToolDef[] = [
  {
    name: "update_lead",
    description: "Atualiza informacoes de um lead no CRM (nome, empresa, notas, tags, score, valor potencial). Use quando obter dados novos durante a conversa.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        name: { type: "string" },
        company_name: { type: "string" },
        notes: { type: "string" },
        potential_value: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "change_stage",
    description: "Move o lead para outro estagio do Kanban (ex: avancar de Captacao para Qualificacao quando ele responde que quer saber mais).",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        stage_name: { type: "string", description: "Nome do estagio destino (ex: 'Qualificacao', 'Proposta', 'Fechado')" },
      },
      required: ["lead_id", "stage_name"],
    },
  },
  {
    name: "schedule_meeting",
    description: "Agenda uma reuniao com o lead. Use apos ele confirmar disponibilidade.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        title: { type: "string" },
        scheduled_at: { type: "string", description: "ISO 8601 datetime, ex: 2026-04-20T14:00:00-03:00" },
        duration_minutes: { type: "number", default: 45 },
      },
      required: ["lead_id", "title", "scheduled_at"],
    },
  },
  {
    name: "confirm_meeting",
    description: "Marca uma reuniao existente como confirmada pelo lead (D-1 ou momento da confirmacao).",
    parameters: {
      type: "object",
      properties: {
        meeting_id: { type: "string" },
      },
      required: ["meeting_id"],
    },
  },
  {
    name: "create_task",
    description: "Cria uma tarefa interna para o time (ex: 'Revisar proposta do lead X', 'Ligar amanha').",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        title: { type: "string" },
        due_at: { type: "string", description: "ISO 8601" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        notes: { type: "string" },
      },
      required: ["lead_id", "title"],
    },
  },
  {
    name: "send_followup",
    description: "Agenda um followup automatico no futuro (em N horas ou dias) com uma mensagem opcional.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        delay_hours: { type: "number" },
        message: { type: "string", description: "Mensagem a enviar. Se omitido, a IA gera no momento do envio." },
        reason: { type: "string" },
      },
      required: ["lead_id", "delay_hours"],
    },
  },
  {
    name: "transfer_to_human",
    description: "Pausa o agente e passa o atendimento para um humano. Use quando o lead pede um vendedor, ou quando a conversa esta fora do escopo do agente.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        reason: { type: "string" },
        pause_hours: { type: "number", default: 24 },
      },
      required: ["lead_id", "reason"],
    },
  },
  {
    name: "notify_human",
    description: "Alerta um humano via WhatsApp (usa notification_rules) sobre um evento crítico. Ex: 'lead_qualified', 'hot_deal', 'objection_raised'.",
    parameters: {
      type: "object",
      properties: {
        event: { type: "string" },
        lead_id: { type: "string" },
        message: { type: "string" },
      },
      required: ["event", "lead_id", "message"],
    },
  },
  {
    name: "qualify_bant",
    description: "Registra a qualificacao BANT do lead (Budget, Authority, Need, Timeline) e calcula o score.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        budget: { type: "string", enum: ["yes", "no", "unknown"] },
        authority: { type: "string", enum: ["yes", "no", "unknown"] },
        need: { type: "string", enum: ["yes", "no", "unknown"] },
        timeline: { type: "string", description: "Ex: 'imediato', '30d', '90d', 'sem pressa'" },
      },
      required: ["lead_id", "budget", "authority", "need", "timeline"],
    },
  },
  {
    name: "mark_lost",
    description: "Marca o lead como perdido (no_show, sem_interesse, orcamento, outro).",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        reason: { type: "string" },
      },
      required: ["lead_id", "reason"],
    },
  },
  {
    name: "query_data",
    description: "Consulta dados agregados do CRM para ajudar a responder o lead. Tipos: 'pipeline_summary' (status do funil), 'hot_leads' (leads mais quentes), 'tasks_pending' (tarefas pendentes do time), 'products' (catalogo ativo).",
    parameters: {
      type: "object",
      properties: {
        query_type: { type: "string", enum: ["pipeline_summary", "hot_leads", "tasks_pending", "products"] },
        limit: { type: "number", default: 5 },
      },
      required: ["query_type"],
    },
  },
  {
    name: "query_knowledge",
    description: "Consulta a base de conhecimento SQUAAD (FAQs, cases, metodologia, conceitos como AI FIRST, detalhes do Carlos, diferencas entre programas). USE SEMPRE QUE O LEAD PERGUNTAR algo especifico sobre a SQUAAD, o fundador, os programas, como funciona, cases, garantia, pagamento, tempo pra resultado. NAO invente - consulta aqui.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Palavras-chave do que o lead perguntou. Ex: 'ai first', 'programar nocode', 'cases agencia', 'parcelamento'." },
        limit: { type: "number", default: 3 },
      },
      required: ["query"],
    },
  },
  {
    name: "send_media",
    description: "Envia uma midia (PDF, imagem, audio, video) pro lead via WhatsApp. Use pra mandar PDF de programa, print de case, audio do Carlos explicando algo. A URL da midia deve vir da query_knowledge (campo media_url) ou ser um link publico conhecido.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        media_url: { type: "string", description: "URL publica da midia" },
        media_type: { type: "string", enum: ["image", "document", "audio", "video"] },
        caption: { type: "string", description: "Legenda curta opcional" },
      },
      required: ["media_url", "media_type"],
    },
  },
];

function toolsForOpenAI(enabled: Set<string>) {
  return TOOLS.filter((t) => enabled.has(t.name)).map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function toolsForAnthropic(enabled: Set<string>) {
  return TOOLS.filter((t) => enabled.has(t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

// ==================== LLM CALLS ====================

interface LLMResult {
  text: string;
  tool_calls: { id?: string; name: string; arguments: any }[];
  input_tokens?: number;
  output_tokens?: number;
  stop_reason?: string;
  raw?: any;
}

async function callAnthropic(opts: {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: any }[];
  temperature: number;
  maxTokens: number;
  tools?: any[];
}): Promise<LLMResult> {
  const apiKey = await getIntegrationKey("anthropic", "ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Ensure alternating user/assistant and first=user
  const msgs: any[] = [];
  for (const m of opts.messages) {
    const last = msgs[msgs.length - 1];
    if (last && last.role === m.role) {
      if (typeof last.content === "string" && typeof m.content === "string") {
        last.content += "\n" + m.content;
      } else {
        msgs.push({ ...m });
      }
    } else {
      msgs.push({ ...m });
    }
  }
  if (!msgs.length) msgs.push({ role: "user", content: "Continue a conversa." });
  if (msgs[0].role !== "user") msgs.unshift({ role: "user", content: "(continuacao)" });

  const body: any = {
    model: opts.model,
    system: opts.system,
    messages: msgs,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };
  if (opts.tools?.length) body.tools = opts.tools;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(sanitizeForJSON(body)),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const textParts: string[] = [];
  const tool_calls: LLMResult["tool_calls"] = [];
  for (const block of (data.content || [])) {
    if (block.type === "text") textParts.push(block.text);
    if (block.type === "tool_use") tool_calls.push({ id: block.id, name: block.name, arguments: block.input });
  }
  return {
    text: textParts.join("\n").trim(),
    tool_calls,
    input_tokens: data.usage?.input_tokens,
    output_tokens: data.usage?.output_tokens,
    stop_reason: data.stop_reason,
    raw: data,
  };
}

async function callOpenAI(opts: {
  model: string;
  system: string;
  messages: { role: string; content: any }[];
  temperature: number;
  maxTokens: number;
  tools?: any[];
}): Promise<LLMResult> {
  const apiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const body: any = {
    model: opts.model,
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };
  if (opts.tools?.length) body.tools = opts.tools;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(sanitizeForJSON(body)),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const choice = data.choices?.[0];
  const tool_calls: LLMResult["tool_calls"] = [];
  for (const tc of (choice?.message?.tool_calls || [])) {
    try {
      tool_calls.push({ id: tc.id, name: tc.function?.name, arguments: JSON.parse(tc.function?.arguments || "{}") });
    } catch { /* skip malformed */ }
  }
  return {
    text: choice?.message?.content || "",
    tool_calls,
    input_tokens: data.usage?.prompt_tokens,
    output_tokens: data.usage?.completion_tokens,
    stop_reason: choice?.finish_reason,
    raw: data,
  };
}

async function callLovableGemini(opts: {
  model: string;
  system: string;
  messages: { role: string; content: any }[];
  temperature: number;
  maxTokens: number;
  tools?: any[];
}): Promise<LLMResult> {
  const apiKey = await getIntegrationKey("lovable", "LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const body: any = {
    model: opts.model.startsWith("google/") ? opts.model : `google/${opts.model}`,
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };
  if (opts.tools?.length) body.tools = opts.tools;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(sanitizeForJSON(body)),
  });
  if (!res.ok) throw new Error(`Lovable/Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const choice = data.choices?.[0];
  const tool_calls: LLMResult["tool_calls"] = [];
  for (const tc of (choice?.message?.tool_calls || [])) {
    try {
      tool_calls.push({ id: tc.id, name: tc.function?.name, arguments: typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments || "{}") : tc.function?.arguments });
    } catch { /* skip */ }
  }
  return {
    text: choice?.message?.content || "",
    tool_calls,
    stop_reason: choice?.finish_reason,
    raw: data,
  };
}

async function callLLM(provider: Provider, opts: Parameters<typeof callAnthropic>[0]): Promise<LLMResult & { effective_provider: Provider }> {
  const order: Provider[] = provider === "anthropic"
    ? ["anthropic", "openai", "lovable-gemini"]
    : provider === "openai"
      ? ["openai", "anthropic", "lovable-gemini"]
      : ["lovable-gemini", "openai", "anthropic"];

  const fallbackModels: Record<Provider, string> = {
    anthropic: "claude-sonnet-4-6",
    openai: "gpt-4o-mini",
    "lovable-gemini": "gemini-2.5-flash",
  };

  let lastErr: any = null;
  for (const p of order) {
    // Skip providers without key configured (DB-first, env fallback)
    if (p === "anthropic" && !(await getIntegrationKey("anthropic", "ANTHROPIC_API_KEY"))) continue;
    if (p === "openai" && !(await getIntegrationKey("openai", "OPENAI_API_KEY"))) continue;
    if (p === "lovable-gemini" && !(await getIntegrationKey("lovable", "LOVABLE_API_KEY"))) continue;

    try {
      // Use the requested model only for the primary provider; otherwise use the provider's default
      const model = p === provider ? opts.model : fallbackModels[p];
      const mopts = { ...opts, model };
      if (p === "anthropic") {
        const r = await callAnthropic(mopts);
        return { ...r, effective_provider: p };
      } else if (p === "openai") {
        const r = await callOpenAI({ ...mopts, tools: opts.tools?.length ? toolsForOpenAI(new Set(opts.tools.map((t: any) => t.name))) : undefined });
        return { ...r, effective_provider: p };
      } else {
        const r = await callLovableGemini({ ...mopts, tools: opts.tools?.length ? toolsForOpenAI(new Set(opts.tools.map((t: any) => t.name))) : undefined });
        return { ...r, effective_provider: p };
      }
    } catch (e: any) {
      console.warn(`[v2] provider ${p} failed:`, e.message);
      lastErr = e;
      // Only fall back on specific errors (quota, auth, network). Other errors re-throw immediately.
      const msg = String(e.message || "").toLowerCase();
      const recoverable = msg.includes("credit") || msg.includes("quota") || msg.includes("rate") || msg.includes("not configured") || msg.includes("429") || msg.includes("401") || msg.includes("402") || msg.includes("503") || msg.includes("500");
      if (!recoverable) throw e;
    }
  }
  throw lastErr || new Error("no LLM provider available");
}

// ==================== BOT DETECTION ====================

async function detectBot(supabase: SupabaseClient, leadId: string, recentMessages: any[]): Promise<{ score: number; flags: string[] }> {
  const flags: string[] = [];
  let score = 0;

  const inbound = recentMessages.filter((m) => m.direction === "inbound" || m.sender !== "agent");
  if (inbound.length < 3) return { score: 0, flags: [] };

  // Signal 1: repetition of identical content
  const texts = inbound.map((m) => (m.content || m.text || "").trim().toLowerCase());
  const unique = new Set(texts);
  if (texts.length >= 4 && unique.size <= 2) { score += 0.3; flags.push("repeticao"); }

  // Signal 2: bot-like formulaic pattern
  const botPatterns = /^(ol[aá]|bom dia|obrigado pelo seu contato|aguarde um momento|em breve|pressione \d)/i;
  const botMatches = inbound.filter((m) => botPatterns.test(m.content || m.text || "")).length;
  if (botMatches >= 2) { score += 0.2; flags.push("padrao_bot"); }

  // Signal 3: very fast replies (<3s between inbound messages)
  let fastCount = 0;
  for (let i = 1; i < inbound.length; i++) {
    const t1 = new Date(inbound[i].created_at).getTime();
    const t0 = new Date(inbound[i - 1].created_at).getTime();
    if (t1 - t0 < 3000) fastCount++;
  }
  if (fastCount >= 3) { score += 0.2; flags.push("velocidade"); }

  // Signal 4: loop — the last 2 messages match 2 earlier messages
  if (inbound.length >= 6) {
    const tail = texts.slice(-2).join("|");
    const earlier = texts.slice(0, -2);
    for (let i = 0; i < earlier.length - 1; i++) {
      if (`${earlier[i]}|${earlier[i + 1]}` === tail) { score += 0.2; flags.push("loop"); break; }
    }
  }

  // Signal 5: high volume in short window
  const tenMinAgo = Date.now() - 10 * 60_000;
  const recentHigh = inbound.filter((m) => new Date(m.created_at).getTime() > tenMinAgo).length;
  if (recentHigh >= 8) { score += 0.2; flags.push("volume_alto"); }

  return { score: Math.min(1, score), flags };
}

// ==================== RATE LIMITING ====================

async function checkRateLimit(supabase: SupabaseClient, instanceId: string, bucket: string, windowType: "hour" | "day", limit: number): Promise<boolean> {
  const now = new Date();
  const windowStart = windowType === "hour"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { data } = await supabase.from("ai_agent_send_counts").select("message_count")
    .eq("instance_id", instanceId).eq("bucket", bucket).eq("window_type", windowType)
    .eq("window_start", windowStart.toISOString()).maybeSingle();

  return (data?.message_count || 0) < limit;
}

async function incrementRateLimit(supabase: SupabaseClient, instanceId: string, bucket: string, windowType: "hour" | "day"): Promise<void> {
  const now = new Date();
  const windowStart = windowType === "hour"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { data: existing } = await supabase.from("ai_agent_send_counts").select("id, message_count")
    .eq("instance_id", instanceId).eq("bucket", bucket).eq("window_type", windowType)
    .eq("window_start", windowStart.toISOString()).maybeSingle();
  if (existing) {
    await supabase.from("ai_agent_send_counts").update({ message_count: (existing.message_count || 0) + 1 }).eq("id", existing.id);
  } else {
    await supabase.from("ai_agent_send_counts").insert({ instance_id: instanceId, bucket, window_type: windowType, window_start: windowStart.toISOString(), message_count: 1 });
  }
}

// ==================== BUSINESS HOURS ====================

function isWithinBusinessHours(settings: any): boolean {
  const tz = settings.timezone || "America/Sao_Paulo";
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
  const parts = formatter.formatToParts(now);
  const hh = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const mm = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const weekdayStr = parts.find(p => p.type === "weekday")?.value || "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[weekdayStr] ?? 1;
  const days = settings.working_days || [1, 2, 3, 4, 5];
  if (!days.includes(weekday)) return false;
  const [startH, startM] = (settings.working_hours_start || "08:00").split(":").map(Number);
  const [endH, endM] = (settings.working_hours_end || "20:00").split(":").map(Number);
  const current = hh * 60 + mm;
  return current >= (startH * 60 + startM) && current <= (endH * 60 + endM);
}

// ==================== TOOL EXECUTORS ====================

async function executeTool(supabase: SupabaseClient, name: string, args: any, ctx: { lead_id: string; instance_id?: string; agent_id: string }): Promise<any> {
  try {
    switch (name) {
      case "update_lead": {
        const patch: any = {};
        if (args.name) patch.name = args.name;
        if (args.company_name) patch.company_name = args.company_name;
        if (args.notes) patch.notes = args.notes;
        if (args.potential_value) patch.potential_value = args.potential_value;
        if (Array.isArray(args.tags)) patch.tags = args.tags;
        patch.updated_at = new Date().toISOString();
        const { error } = await supabase.from("crm_leads").update(patch).eq("id", args.lead_id || ctx.lead_id);
        if (error) throw error;
        return { ok: true, updated: Object.keys(patch) };
      }
      case "change_stage": {
        // Resolve stage_name -> column_id for the lead's board
        const { data: lead } = await supabase.from("crm_leads").select("board_id").eq("id", args.lead_id || ctx.lead_id).single();
        if (!lead) throw new Error("lead not found");
        const { data: col } = await supabase.from("crm_columns").select("id, name")
          .eq("board_id", lead.board_id).ilike("name", `%${args.stage_name}%`).limit(1).maybeSingle();
        if (!col) return { ok: false, error: `stage "${args.stage_name}" not found` };
        const { error } = await supabase.from("crm_leads").update({ column_id: col.id, updated_at: new Date().toISOString() }).eq("id", args.lead_id || ctx.lead_id);
        if (error) throw error;
        return { ok: true, stage: col.name };
      }
      case "schedule_meeting": {
        const leadId = args.lead_id || ctx.lead_id;
        const duration = args.duration_minutes || 30;

        // Validate: scheduled_at must be in the future, within working window, no hard conflicts.
        const scheduledAt = new Date(args.scheduled_at);
        if (isNaN(scheduledAt.getTime())) return { ok: false, error: "invalid_datetime", tell_lead: "Nao consegui entender o horario. Me manda no formato 'quarta 14h' ou '20/04 14:00'?" };
        if (scheduledAt.getTime() < Date.now() + 15 * 60_000) return { ok: false, error: "past_or_too_soon", tell_lead: "Esse horario ja passou ou esta muito em cima. Bora marcar pra mais tarde?" };

        // Working hours: 8h-21h BRT, Mon-Sat (matches agent settings).
        const brt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", hour12: false }).formatToParts(scheduledAt);
        const wd = brt.find(p => p.type === "weekday")?.value || "";
        const hh = parseInt(brt.find(p => p.type === "hour")?.value || "0");
        if (wd === "Sun") return { ok: false, error: "weekend", tell_lead: "Domingo a gente nao rola call. Segunda em diante ta otimo, manda um horario." };
        if (hh < 8 || hh >= 21) return { ok: false, error: "outside_hours", tell_lead: "Nosso horario de call e 8h-21h. Qual horario nessa janela fica bom pra voce?" };

        // Conflict check across ALL agenda sources (meetings + tasks + personal events)
        const fromIso = new Date(scheduledAt.getTime() - 45 * 60_000).toISOString();
        const toIso = new Date(scheduledAt.getTime() + 45 * 60_000).toISOString();
        const { data: conflicts } = await supabase.from("calendar_events_all")
          .select("id, title, start_at, type")
          .gte("start_at", fromIso).lte("start_at", toIso)
          .neq("status", "completed").limit(3);
        if (conflicts && conflicts.length) {
          return { ok: false, error: "conflict", tell_lead: "Opa, ja tenho compromisso nesse horario. Podemos marcar 45min antes ou depois?" };
        }

        // Generate a unique LiveKit room for this meeting
        const roomName = `call-${leadId.slice(0, 8)}-${Date.now()}`;
        const meetBaseUrl = Deno.env.get("SQUAAD_MEET_BASE_URL") || "https://squaad.com.br/meet";
        const roomLink = `${meetBaseUrl}/${roomName}`;

        const { data: meeting, error } = await supabase.from("meetings").insert({
          lead_id: leadId,
          title: args.title,
          scheduled_at: args.scheduled_at,
          status: "scheduled",
          kind: "sales",
          livekit_room_name: roomName,
          meeting_url: roomLink,
          metadata: { scheduled_by_agent: ctx.agent_id, duration_minutes: args.duration_minutes || 30, room_link: roomLink },
        }).select().single();
        if (error) throw error;

        // Auto-enroll this meeting in the "meeting_reminder" cadence.
        // The cron will wake the agent to send D-1 and 2h reminders.
        const scheduledAtMs = new Date(args.scheduled_at).getTime();
        const dMinus1 = new Date(scheduledAtMs - 24 * 3600_000).toISOString();
        await supabase.from("ai_agent_cadence_enrollments").insert({
          lead_id: leadId,
          agent_id: ctx.agent_id,
          stage: "meeting_reminder",
          status: "active",
          next_action_at: dMinus1,
          metadata: { meeting_id: meeting.id, room_link: roomLink, scheduled_at: args.scheduled_at, reason: "meeting_reminder" },
        });

        // Notify humans (fires notification_rules for event=meeting_scheduled).
        const { data: rules } = await supabase.from("notification_rules")
          .select("*").eq("enabled", true).eq("trigger_event", "meeting_scheduled");
        for (const rule of (rules || [])) {
          if (rule.action_channel === "whatsapp" && rule.action_target_phone && rule.action_instance_id) {
            const msg = (rule.message_template || "Nova call agendada: {{title}} em {{when}} - {{room_link}}")
              .replace("{{title}}", args.title)
              .replace("{{when}}", new Date(args.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))
              .replace("{{room_link}}", roomLink)
              .replace("{{lead_id}}", leadId);
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ action: "send_text", instance_id: rule.action_instance_id, phone: rule.action_target_phone, message: msg }),
            }).catch(() => {});
          }
        }

        return {
          ok: true,
          meeting_id: meeting.id,
          scheduled_at: args.scheduled_at,
          room_link: roomLink,
          // The LLM should include this link in the user-facing reply:
          tell_lead: `Te agendei aqui ${new Date(args.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" })}. O link da nossa sala SQUAAD: ${roomLink}. Te mando um lembrete 2h antes.`,
        };
      }
      case "confirm_meeting": {
        const { error } = await supabase.from("meetings").update({
          status: "confirmed",
          metadata: { confirmed_at: new Date().toISOString() },
        }).eq("id", args.meeting_id);
        if (error) throw error;
        return { ok: true };
      }
      case "create_task": {
        const { error } = await supabase.from("tasks").insert({
          lead_id: args.lead_id || ctx.lead_id,
          title: args.title,
          description: args.notes || null,
          due_date: args.due_at || null,
          type: "task",
          status: "pending",
        });
        if (error) throw error;
        return { ok: true };
      }
      case "send_followup": {
        const dueAt = new Date(Date.now() + (args.delay_hours || 24) * 3600_000).toISOString();
        const { error } = await supabase.from("ai_agent_cadence_enrollments").insert({
          lead_id: args.lead_id || ctx.lead_id,
          agent_id: ctx.agent_id,
          stage: "followup",
          status: "active",
          next_action_at: dueAt,
          metadata: { message: args.message || null, reason: args.reason || null, type: "adhoc_followup" },
        });
        if (error) throw error;
        return { ok: true, scheduled_for: dueAt };
      }
      case "transfer_to_human": {
        const leadId = args.lead_id || ctx.lead_id;
        const pauseUntil = new Date(Date.now() + (args.pause_hours || 24) * 3600_000).toISOString();
        await supabase.from("ai_agent_conversations").update({
          status: "paused", paused_by: "agent:transfer_to_human", paused_at: new Date().toISOString(),
          pause_reason: args.reason, pause_until: pauseUntil,
        }).eq("lead_id", leadId);
        await supabase.from("crm_activities").insert({
          lead_id: leadId,
          activity_type: "handoff",
          description: `Transferido para humano: ${args.reason}`,
          metadata: { reason: args.reason, agent_id: ctx.agent_id },
        });
        // Fire agent_handoff notification rules
        const { data: rules } = await supabase.from("notification_rules").select("*").eq("enabled", true).eq("trigger_event", "agent_handoff");
        for (const rule of (rules || [])) {
          if (rule.action_channel === "whatsapp" && rule.action_target_phone && rule.action_instance_id) {
            const msg = (rule.message_template || "Handoff: {{message}}").replace("{{message}}", args.reason).replace("{{lead_id}}", leadId);
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ action: "send_text", instance_id: rule.action_instance_id, phone: rule.action_target_phone, message: msg }),
            }).catch(() => {});
          }
        }
        return { ok: true, paused_until: pauseUntil };
      }
      case "notify_human": {
        const { data: rules } = await supabase.from("notification_rules").select("*").eq("enabled", true).eq("trigger_event", args.event);
        let notified = 0;
        for (const rule of (rules || [])) {
          if (rule.action_channel === "whatsapp" && rule.action_target_phone && rule.action_instance_id) {
            await supabase.from("whatsapp_messages").insert({
              instance_id: rule.action_instance_id,
              direction: "outbound",
              recipient_phone: rule.action_target_phone,
              content: rule.message_template.replace("{{message}}", args.message).replace("{{lead_id}}", args.lead_id),
              status: "queued",
              metadata: { source: "notification_rule", rule_id: rule.id },
            });
            notified++;
          }
        }
        return { ok: true, notified };
      }
      case "qualify_bant": {
        const leadId = args.lead_id || ctx.lead_id;
        const yesCount = ["budget", "authority", "need"].filter((k) => args[k] === "yes").length;
        const score = yesCount * 25;
        const { error } = await supabase.from("crm_leads").update({
          lead_score: score,
          notes: `BANT — Budget:${args.budget} Auth:${args.authority} Need:${args.need} Timeline:${args.timeline}`,
          updated_at: new Date().toISOString(),
        }).eq("id", leadId);
        if (error) throw error;

        // Fire lead_qualified notification only when fully qualified (3 yes = 75)
        if (score >= 75) {
          const { data: lead } = await supabase.from("crm_leads").select("name, whatsapp").eq("id", leadId).maybeSingle();
          const { data: rules } = await supabase.from("notification_rules").select("*").eq("enabled", true).eq("trigger_event", "lead_qualified");
          for (const rule of (rules || [])) {
            if (rule.action_channel === "whatsapp" && rule.action_target_phone && rule.action_instance_id) {
              const summary = `${lead?.name || "Lead"} (${lead?.whatsapp || "sem wpp"}) — BANT score ${score}/100. Budget:${args.budget} Auth:${args.authority} Need:${args.need} Timeline:${args.timeline}`;
              const msg = (rule.message_template || "Lead qualificado: {{message}}").replace("{{message}}", summary).replace("{{lead_id}}", leadId);
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ action: "send_text", instance_id: rule.action_instance_id, phone: rule.action_target_phone, message: msg }),
              }).catch(() => {});
            }
          }
        }
        return { ok: true, score };
      }
      case "mark_lost": {
        const { error } = await supabase.from("crm_leads").update({
          lost_reason: args.reason,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", args.lead_id || ctx.lead_id);
        if (error) throw error;
        return { ok: true };
      }
      case "query_data": {
        switch (args.query_type) {
          case "pipeline_summary": {
            const { data } = await supabase.from("crm_leads").select("column_id").limit(500);
            const grouped: Record<string, number> = {};
            (data || []).forEach((l: any) => { grouped[l.column_id] = (grouped[l.column_id] || 0) + 1; });
            return { ok: true, pipeline: grouped };
          }
          case "hot_leads": {
            const { data } = await supabase.from("crm_leads").select("id, name, lead_score, updated_at")
              .order("lead_score", { ascending: false }).limit(args.limit || 5);
            return { ok: true, leads: data || [] };
          }
          case "tasks_pending": {
            const { data } = await supabase.from("lead_activities").select("id, lead_id, title, scheduled_at")
              .eq("type", "task").is("completed_at", null).limit(args.limit || 10);
            return { ok: true, tasks: data || [] };
          }
          case "products": {
            const { data } = await supabase.from("products")
              .select("slug, name, tagline, description, duration_label, ideal_for, features")
              .eq("is_active", true).order("sort_order");
            return { ok: true, products: data || [] };
          }
          default: return { ok: false, error: "unknown query_type" };
        }
      }
      case "query_knowledge": {
        const query = String(args.query || "").toLowerCase();
        const limit = args.limit || 3;
        // Extract keyword tokens (3+ chars, de-duped) from the query
        const tokens = Array.from(new Set(query.split(/[^a-z0-9çãáéíóúâêôà-]+/i).filter(t => t.length >= 3)));
        if (!tokens.length) return { ok: true, results: [] };

        // 1) Try keyword array overlap (GIN index). 2) Fallback to ILIKE title/content.
        let { data: hits } = await supabase.from("agent_knowledge")
          .select("id, title, category, content, media_url, keywords")
          .eq("agent_id", ctx.agent_id).eq("is_active", true)
          .overlaps("keywords", tokens).limit(limit);
        if (!hits || hits.length === 0) {
          const likes = tokens.slice(0, 3).map(t => `%${t}%`).join("|");
          const { data: fb } = await supabase.from("agent_knowledge")
            .select("id, title, category, content, media_url, keywords")
            .eq("agent_id", ctx.agent_id).eq("is_active", true)
            .or(tokens.slice(0, 3).map(t => `title.ilike.%${t}%,content.ilike.%${t}%`).join(","))
            .limit(limit);
          hits = fb || [];
        }
        // Usage tracking (fire-and-forget)
        if (hits?.length) {
          supabase.from("agent_knowledge")
            .update({ usage_count: (hits[0] as any).usage_count ? (hits[0] as any).usage_count + 1 : 1, last_used_at: new Date().toISOString() })
            .in("id", hits.map(h => h.id)).then(() => {}).catch(() => {});
        }
        return { ok: true, results: hits || [] };
      }
      case "send_media": {
        // Look up the lead's phone + instance to send via uazapi-proxy
        const { data: lead } = await supabase.from("crm_leads").select("whatsapp").eq("id", args.lead_id || ctx.lead_id).single();
        if (!lead?.whatsapp) return { ok: false, error: "lead has no whatsapp" };
        if (!ctx.instance_id) return { ok: false, error: "no instance_id in context" };

        try {
          const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({
              action: "send_media",
              instance_id: ctx.instance_id,
              phone: lead.whatsapp,
              media_url: args.media_url,
              media_type: args.media_type,
              caption: args.caption || "",
              lead_id: args.lead_id || ctx.lead_id,
            }),
          });
          const j = await res.json();
          return { ok: j?.success !== false, detail: j };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      }
      default: return { ok: false, error: `unknown tool ${name}` };
    }
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) };
  }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { lead_id, instance_id, message_text, message_id, agent_id: requestedAgentId, dry_run } = body;
    if (!lead_id || !message_text) throw new Error("lead_id and message_text required");

    // 1. Load agent — by explicit id, or by channel routing, fallback to default
    let agent: any;
    if (requestedAgentId) {
      const { data } = await supabase.from("ai_sales_agents").select("*").eq("id", requestedAgentId).single();
      agent = data;
    } else {
      // First try: lead's source → agent with matching channel
      let sourceChannel: string | null = null;
      if (body.source_channel) {
        sourceChannel = String(body.source_channel).toLowerCase();
      } else if (lead_id) {
        const { data: l } = await supabase.from("crm_leads").select("source").eq("id", lead_id).maybeSingle();
        if (l?.source) sourceChannel = String(l.source).toLowerCase();
      }
      const channelKey = sourceChannel?.includes("instagram") ? "instagram"
        : sourceChannel?.includes("landing") ? "landing-page"
        : "whatsapp";

      const { data: byChannel } = await supabase.from("ai_sales_agents")
        .select("*").eq("channel", channelKey).eq("is_active", true)
        .order("priority", { ascending: false }).limit(1).maybeSingle();
      if (byChannel) agent = byChannel;
      else {
        const { data: def } = await supabase.from("ai_sales_agents").select("*").eq("is_default", true).eq("is_active", true).maybeSingle();
        agent = def;
      }
    }
    if (!agent) throw new Error("no active agent configured");

    const settings = agent.settings || {};
    const provider = detectProvider(agent.model, agent.provider);

    // 2. Load lead
    const { data: lead, error: leadErr } = await supabase.from("crm_leads").select("*").eq("id", lead_id).single();
    if (leadErr || !lead) throw new Error("lead not found");

    // 3. Get/create conversation + lock
    let conversation: any;
    {
      const { data } = await supabase.from("ai_agent_conversations").select("*")
        .eq("lead_id", lead_id).eq("agent_id", agent.id).maybeSingle();
      if (data) {
        // Skip if paused
        const pausedUntil = data.pause_until ? new Date(data.pause_until).getTime() : 0;
        if (data.status === "paused" && pausedUntil > Date.now()) {
          await supabase.from("ai_agent_logs").insert({ conversation_id: data.id, lead_id, agent_id: agent.id, log_type: "skip", data: { reason: "paused" } });
          return new Response(JSON.stringify({ skipped: "paused", until: data.pause_until }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Acquire processing lock
        const lockAgeSec = 60;
        const now = Date.now();
        if (data.processing_lock && (now - new Date(data.processing_lock).getTime()) < lockAgeSec * 1000) {
          return new Response(JSON.stringify({ skipped: "already_processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await supabase.from("ai_agent_conversations").update({ processing_lock: new Date().toISOString() }).eq("id", data.id);
        conversation = data;
      } else {
        const { data: created } = await supabase.from("ai_agent_conversations").insert({
          lead_id, agent_id: agent.id, messages_history: [],
          processing_lock: new Date().toISOString(),
        }).select().single();
        conversation = created;
      }
    }

    // 3a. Keyword rules — ignore / pause / handoff / activation
    const rules = agent.keyword_rules || {};
    const normText = (message_text || "").toLowerCase().trim();
    const normWords = normText.replace(/[^a-z0-9çãáéíóúâêôà-\s]/gi, " ").trim();
    const hasAny = (list: string[]) => Array.isArray(list) && list.some((k: string) => {
      const kw = (k || "").toLowerCase().trim();
      if (!kw) return false;
      // match whole word (or the whole text if message is just the keyword)
      return normWords === kw || normWords.split(/\s+/).includes(kw) || normText.includes(` ${kw} `) || normText.startsWith(`${kw} `) || normText.endsWith(` ${kw}`);
    });

    // PAUSE keyword: lead wants the bot to stop
    if (hasAny(rules.pause_keywords)) {
      const pauseUntil = new Date(Date.now() + 24 * 3600_000).toISOString();
      await supabase.from("ai_agent_conversations").update({
        status: "paused", paused_by: "keyword_pause", paused_at: new Date().toISOString(),
        pause_reason: `Lead digitou keyword de pausa: "${message_text.substring(0, 60)}"`,
        pause_until: pauseUntil, processing_lock: null,
      }).eq("id", conversation.id);
      await supabase.from("ai_agent_logs").insert({
        conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "pause",
        data: { reason: "keyword_pause", keyword_hit: true, message: message_text.substring(0, 120) },
      });
      return new Response(JSON.stringify({ skipped: "keyword_pause", until: pauseUntil }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // HANDOFF keyword: lead wants a human — pause + notify humans
    if (hasAny(rules.handoff_keywords)) {
      const pauseUntil = new Date(Date.now() + 24 * 3600_000).toISOString();
      await supabase.from("ai_agent_conversations").update({
        status: "paused", paused_by: "keyword_handoff", paused_at: new Date().toISOString(),
        pause_reason: `Lead pediu humano: "${message_text.substring(0, 60)}"`,
        pause_until: pauseUntil, processing_lock: null,
      }).eq("id", conversation.id);
      // Fire agent_handoff notifications
      const { data: notif } = await supabase.from("notification_rules").select("*")
        .eq("enabled", true).eq("trigger_event", "agent_handoff");
      for (const rule of (notif || [])) {
        if (rule.action_channel === "whatsapp" && rule.action_target_phone && rule.action_instance_id) {
          const msg = (rule.message_template || "Handoff: {{message}}")
            .replace("{{message}}", `${lead.name || "Lead"} pediu humano — "${message_text.substring(0, 120)}"`)
            .replace("{{lead_id}}", lead_id);
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ action: "send_text", instance_id: rule.action_instance_id, phone: rule.action_target_phone, message: msg, sent_by: "notification" }),
          }).catch(() => {});
        }
      }
      await supabase.from("ai_agent_logs").insert({
        conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "pause",
        data: { reason: "keyword_handoff", notified: (notif || []).length, message: message_text.substring(0, 120) },
      });
      return new Response(JSON.stringify({ skipped: "keyword_handoff", until: pauseUntil }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // IGNORE keyword: message is just an ack, don't waste an LLM call
    if (hasAny(rules.ignore_keywords)) {
      await supabase.from("ai_agent_conversations").update({ processing_lock: null }).eq("id", conversation.id);
      await supabase.from("ai_agent_logs").insert({
        conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "skip",
        data: { reason: "ignore_keyword", message: message_text.substring(0, 80) },
      });
      return new Response(JSON.stringify({ skipped: "ignore_keyword" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTIVATION keyword: gate that prevents the agent from answering everything
    // Modes:
    //   - "always": agent always responds (current behavior, default)
    //   - "first_message_only": the first lead message must contain an activation keyword
    //   - "any_inbound": every inbound message must contain at least one keyword
    const activationKeywords = Array.isArray(rules.activation_keywords) ? rules.activation_keywords.filter((k: string) => (k || "").trim()) : [];
    if (activationKeywords.length > 0) {
      const mode = rules.activation_mode || "always";
      const history = Array.isArray(conversation.messages_history) ? conversation.messages_history : [];
      const isFirstMessage = history.length === 0;
      const shouldCheck = mode === "any_inbound" || (mode === "first_message_only" && isFirstMessage);
      if (shouldCheck && !hasAny(activationKeywords)) {
        await supabase.from("ai_agent_conversations").update({ processing_lock: null }).eq("id", conversation.id);
        await supabase.from("ai_agent_logs").insert({
          conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "skip",
          data: { reason: "no_activation_keyword", mode, message: message_text.substring(0, 80) },
        });
        return new Response(JSON.stringify({ skipped: "no_activation_keyword", mode }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 3b. Debounce: if the lead sent another message in the last N seconds,
    // wait for it and aggregate. The lock is released before we return, so the
    // webhook triggered by the newer message will pick up everything.
    const debounceSec = Math.min(Math.max(parseInt(String(settings.debounce_seconds || 10), 10), 3), 20);
    const sinceIso = new Date(Date.now() - debounceSec * 1000).toISOString();
    const { data: freshInbound } = await supabase.from("whatsapp_messages")
      .select("id, content, created_at")
      .eq("lead_id", lead_id).eq("direction", "inbound")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5);

    const newestAt = freshInbound?.[0]?.created_at ? new Date(freshInbound[0].created_at).getTime() : 0;
    if (freshInbound && freshInbound.length > 0 && newestAt) {
      const ageMs = Date.now() - newestAt;
      if (ageMs < debounceSec * 1000) {
        // Another message is still coming in — release and let the next trigger
        // pick it up. Helps avoid "robotic" double-replies.
        await supabase.from("ai_agent_conversations").update({ processing_lock: null }).eq("id", conversation.id);
        await supabase.from("ai_agent_logs").insert({
          conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "skip",
          data: { reason: "debounce", wait_ms: debounceSec * 1000 - ageMs },
        });
        return new Response(JSON.stringify({ skipped: "debounce", will_retrigger_in_ms: debounceSec * 1000 - ageMs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 3c. Aggregate recent inbound messages into a single "user turn"
    const aggregatedInbound = (freshInbound || []).reverse()
      .map((m: any) => m.content)
      .filter(Boolean)
      .join("\n");
    const effectiveMessage = aggregatedInbound.length > message_text.length ? aggregatedInbound : message_text;

    // 4. Business hours gate
    if (!isWithinBusinessHours(settings)) {
      await supabase.from("ai_agent_logs").insert({ conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "skip", data: { reason: "outside_business_hours" } });
      await supabase.from("ai_agent_conversations").update({ processing_lock: null }).eq("id", conversation.id);
      return new Response(JSON.stringify({ skipped: "outside_business_hours" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Rate limit
    if (instance_id) {
      const maxPerHour = settings.cadence_max_messages_per_hour || 20;
      const ok = await checkRateLimit(supabase, instance_id, "all", "hour", maxPerHour);
      if (!ok) {
        await supabase.from("ai_agent_logs").insert({ conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "rate_limit", data: { bucket: "all", window: "hour", limit: maxPerHour } });
        await supabase.from("ai_agent_conversations").update({ processing_lock: null }).eq("id", conversation.id);
        return new Response(JSON.stringify({ skipped: "rate_limit" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 6. Bot detection on recent inbound messages
    const { data: recentMsgs } = await supabase.from("whatsapp_messages").select("id, content, direction, created_at")
      .eq("lead_id", lead_id).order("created_at", { ascending: false }).limit(20);
    const bot = await detectBot(supabase, lead_id, (recentMsgs || []).reverse());
    if (bot.score >= 0.5) {
      // Auto-pause — likely talking to another bot
      const pauseUntil = new Date(Date.now() + 24 * 3600_000).toISOString();
      await supabase.from("ai_agent_conversations").update({
        status: "paused", paused_by: "bot_detection", paused_at: new Date().toISOString(),
        pause_reason: `Bot detectado (score ${bot.score.toFixed(2)}): ${bot.flags.join(",")}`,
        pause_until: pauseUntil,
        bot_detection_score: bot.score, bot_detection_flags: bot.flags,
        processing_lock: null,
      }).eq("id", conversation.id);
      await supabase.from("ai_agent_logs").insert({ conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "pause", data: { reason: "bot", score: bot.score, flags: bot.flags } });
      return new Response(JSON.stringify({ skipped: "bot_detected", score: bot.score, flags: bot.flags }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 7. Build context for LLM (using debounced aggregate message)
    const history = Array.isArray(conversation.messages_history) ? conversation.messages_history : [];
    history.push({ role: "user", content: effectiveMessage });

    // Detect source channel from the lead or the latest inbound message
    const sourceChannel = (lead.source || "").toLowerCase().includes("instagram") ? "Instagram"
      : (lead.source || "").toLowerCase().includes("whatsapp") ? "WhatsApp"
      : (lead.source || "").toLowerCase().includes("landing") ? "Landing Page"
      : body.source_channel || "WhatsApp";

    const nowBr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long",
      year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date());
    const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

    const systemPrompt = `${agent.system_prompt}

---
DATA/HORA ATUAL (America/Sao_Paulo): ${nowBr}
DATA DE HOJE em ISO: ${todayIso}
Quando o lead falar "amanha", "quarta", "semana que vem", SEMPRE calcule a partir desta data. NUNCA invente outro ano. Sempre use o ano atual (${todayIso.split("-")[0]}) ou o proximo quando apropriado.

---
CONTEXTO DO LEAD:
- Nome: ${lead.name || "(ainda nao informou)"}
- Empresa: ${lead.company_name || "(n/a)"}
- WhatsApp: ${lead.whatsapp || "(n/a)"}
- Score atual: ${lead.lead_score || 0}/100
- Valor potencial estimado: R$ ${lead.potential_value || 0}
- Notas internas: ${lead.notes || "(nenhuma)"}
- Tags: ${(lead.tags || []).join(", ") || "(nenhuma)"}
- Canal de origem: ${sourceChannel}
- Lead ID (uso interno, nunca mostrar ao lead): ${lead.id}

---
PLAYBOOK DE OBJECOES (calibrado SQUAAD):

OBJECAO: "Quanto custa?" / "Qual o preco?" / "Ta caro"
RESPOSTA: "Cara, o investimento varia conforme o programa que combina com teu
momento. Tem caminho de 3 meses, tem de 12 meses, tem sob medida. Pra eu te
apontar a rota certa sem perder teu tempo, bate uma call rapida com o time?"

OBJECAO: "Vou pensar" / "Preciso ver com meu socio"
RESPOSTA: "Fechou, faz todo sentido. So pra eu nao perder tua cabeca: o que
ainda ta na duvida? Se eu te mandar 1 material rapido ou um papo de 20min
com o time, ajuda voce a decidir com mais clareza?"

OBJECAO: "Nao tenho tempo agora"
RESPOSTA: "Saquei. Justamente por isso que a IA faz sentido: devolver tempo
pro empresario. Tem 20min de alguma manha ou fim de tarde na semana? Nao precisa
agora, pode ser daqui 1-2 semanas."

OBJECAO: "Ja tentei curso de IA, nao funcionou"
RESPOSTA: "Entendi, curso sozinho nao resolve mesmo. Por isso aqui nao e curso:
e um acompanhamento com a equipe construindo junto com voce. Quer ver como
funciona na pratica numa call?"

OBJECAO: "Voce e um robo/bot?"
RESPOSTA: "Opaaa, sou a Carol. Estou aqui justamente pra organizar teu caso
antes do time humano entrar. Qualquer coisa fora do comum eu te passo pra
alguem direto, beleza?"

OBJECAO: "Me manda material escrito antes"
RESPOSTA: "Cara, o conteudo solto pela frente sempre confunde. A gente ja
entendeu que funciona melhor conhecendo teu caso primeiro e indo direto no
ponto. 20min contigo e eu te mando depois tudo que fizer sentido, fechou?"

---
REGRAS RIGIDAS:
- Responda em portugues brasileiro, curto (max 3 frases por mensagem).
- Use tools quando apropriado. NUNCA invente dados do lead.
- NUNCA exponha IDs, lead_id, UUIDs, nem raciocinio interno.
- Se o lead esta numa objecao, use o Playbook acima como base (nao repita ele
  palavra-por-palavra, adapta pro contexto).
- Se o lead pedir um humano, disser que voce e bot de forma hostil, xingar, ou
  estiver off-topic, chame transfer_to_human.
- Quando agendar reuniao, a tool retorna tell_lead — use ESSA mensagem como base
  pra confirmar pro lead com o link da sala SQUAAD.
- Se a tool schedule_meeting retornar erro (outside_hours, conflict, weekend):
  pede outro horario de forma natural, usando a dica em tell_lead.`;

    const startTime = Date.now();
    const toolsEnabled = new Set<string>((agent.tools_enabled || []).length ? agent.tools_enabled : TOOLS.map(t => t.name));
    const anthropicTools = toolsForAnthropic(toolsEnabled);

    // 8. Call LLM (with up to 3 tool-use rounds)
    let finalText = "";
    const executedTools: any[] = [];
    const messages: any[] = history.map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content }));

    for (let round = 0; round < 3; round++) {
      const result = await callLLM(provider, {
        model: agent.model,
        system: systemPrompt,
        messages,
        temperature: agent.temperature || 0.6,
        maxTokens: agent.max_tokens || 1200,
        tools: provider === "anthropic" ? anthropicTools : TOOLS.filter(t => toolsEnabled.has(t.name)),
      });

      await supabase.from("ai_agent_logs").insert({
        conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "llm_response",
        tokens_input: result.input_tokens, tokens_output: result.output_tokens,
        duration_ms: Date.now() - startTime,
        data: { round, stop_reason: result.stop_reason, tool_calls_count: result.tool_calls.length },
      });

      if (!result.tool_calls.length) {
        finalText = result.text;
        break;
      }

      // Execute tools
      const toolResults: any[] = [];
      for (const tc of result.tool_calls) {
        const toolStart = Date.now();
        const res = await executeTool(supabase, tc.name, { ...tc.arguments, lead_id: tc.arguments?.lead_id || lead_id }, {
          lead_id, instance_id, agent_id: agent.id,
        });
        toolResults.push({ name: tc.name, id: tc.id, result: res });
        executedTools.push({ name: tc.name, args: tc.arguments, result: res, duration_ms: Date.now() - toolStart });
        await supabase.from("ai_agent_logs").insert({
          conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "tool_call",
          data: { name: tc.name, args: tc.arguments, result: res },
          duration_ms: Date.now() - toolStart,
        });
      }

      // Feed results back
      if (provider === "anthropic") {
        messages.push({ role: "assistant", content: result.raw?.content || [] });
        messages.push({ role: "user", content: toolResults.map(tr => ({ type: "tool_result", tool_use_id: tr.id, content: JSON.stringify(tr.result) })) });
      } else {
        messages.push({ role: "assistant", tool_calls: result.raw?.choices?.[0]?.message?.tool_calls });
        for (const tr of toolResults) {
          messages.push({ role: "tool", tool_call_id: tr.id, content: JSON.stringify(tr.result) });
        }
      }

      // If final round and still tool calls, take text if present
      if (round === 2 && result.text) finalText = result.text;
    }

    // 9. Sanitize output
    finalText = stripInternalThinking(finalText || "").trim();
    if (!finalText) {
      await supabase.from("ai_agent_logs").insert({ conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "error", data: { reason: "empty_response_after_strip" } });
      await supabase.from("ai_agent_conversations").update({ processing_lock: null }).eq("id", conversation.id);
      return new Response(JSON.stringify({ error: "empty_response" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 10. Update conversation history
    history.push({ role: "assistant", content: finalText });
    await supabase.from("ai_agent_conversations").update({
      messages_history: history,
      total_messages_sent: (conversation.total_messages_sent || 0) + 1,
      total_messages_received: (conversation.total_messages_received || 0) + 1,
      last_processed_at: new Date().toISOString(),
      last_message_id: message_id || null,
      processing_lock: null,
      bot_detection_score: bot.score,
      bot_detection_flags: bot.flags,
      updated_at: new Date().toISOString(),
    }).eq("id", conversation.id);

    if (instance_id) await incrementRateLimit(supabase, instance_id, "all", "hour");

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, response: finalText, tools: executedTools, dry_run: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 11. Send via WhatsApp through uazapi-proxy
    let sendResult: any = null;
    if (instance_id && lead.whatsapp) {
      try {
        const sendRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ action: "send_text", instance_id, phone: lead.whatsapp, message: finalText, lead_id }),
        });
        sendResult = await sendRes.json();
      } catch (e: any) {
        console.error("[v2] send failed:", e);
        await supabase.from("ai_agent_logs").insert({ conversation_id: conversation.id, lead_id, agent_id: agent.id, log_type: "error", data: { reason: "send_failed", error: e.message } });
      }
    }

    // 12. Log activity in CRM
    await supabase.from("crm_activities").insert({
      lead_id,
      type: "note",
      title: "Resposta do Agente IA v2",
      description: `Lead: "${message_text.substring(0, 100)}"\nAgente v2 (${provider}): "${finalText.substring(0, 300)}"${executedTools.length ? `\nTools: ${executedTools.map(t => t.name).join(", ")}` : ""}`,
      status: "completed",
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({
      ok: true, response: finalText, tools_executed: executedTools.length,
      conversation_id: conversation.id, provider, model: agent.model, send: sendResult?.success ? "sent" : "pending",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[ai-sales-agent-v2] error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
