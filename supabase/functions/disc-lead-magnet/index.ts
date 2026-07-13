// disc-lead-magnet
// Captura lead na rota pública /r10x. Faz scrape Instagram + elogio IA,
// cria lead no board "reprograme-se-10x" e notifica o Carlos via UAZAPI.
// Reaproveita o padrão de analyze-instagram-profile (RapidAPI + OpenAI) que já roda em produção.

import { createClient } from "npm:@supabase/supabase-js@2";

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

const EVENTO_SLUG = "reprograme-se-10x";
const BOARD_SLUG = "reprograme-se-10x";
const TAG = "reprograme-se-10X";

interface PostData {
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
}

interface InstagramData {
  followers: number;
  following: number;
  biography: string;
  category: string;
  fullName: string;
  posts: PostData[];
  profilePicUrl: string;
}

interface PontoMelhoria {
  titulo: string;
  descricao: string;
}

interface AcaoPlano {
  semana: string;       // ex: "Semana 1"
  acao: string;         // ex: "Criar destaque 'Cases' com..."
}

interface AiAnalysis {
  profissao_inferida: string;
  nicho: string;
  tom_conteudo: string;
  frequencia: string;
  pontos_fortes: string[];
  pontos_melhoria: PontoMelhoria[];
  plano_acao: AcaoPlano[];        // 4 semanas de ações
  caso_pratico_ia: string;        // exemplo prático de IA pro nicho dele
  elogio_personalizado: string;
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + "|squaad-disc-salt");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Lê o setting `disc_rate_limit_disabled` (kill-switch ativável no painel
// /admin/reprograma durante o evento, quando todos os leads vêm do mesmo IP
// — WiFi do auditório). Auto-religa quando `disc_rate_limit_disabled_until`
// expira (timestamp ISO). Em caso de erro, default = false (rate limit ativo).
async function isRateLimitDisabled(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("r10x_settings")
      .select("key, value")
      .in("key", ["disc_rate_limit_disabled", "disc_rate_limit_disabled_until"]);
    const map = new Map((data || []).map((r: any) => [r.key, r.value]));
    if (map.get("disc_rate_limit_disabled") !== true) return false;
    const until = map.get("disc_rate_limit_disabled_until");
    if (!until) return true; // sem expiração = desligado indefinidamente (não ideal, mas válido)
    return new Date(String(until)).getTime() > Date.now();
  } catch {
    return false;
  }
}

async function checkRateLimit(supabase: any, ipHash: string): Promise<boolean> {
  // Kill-switch: se admin desligou, deixa passar tudo (ainda registra pra audit)
  if (await isRateLimitDisabled(supabase)) {
    await supabase.from("disc_rate_limits").insert({ ip_hash: ipHash }).catch(() => {});
    return true;
  }
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("disc_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneMinuteAgo);
  if ((count ?? 0) >= 5) return false;
  await supabase.from("disc_rate_limits").insert({ ip_hash: ipHash });
  return true;
}

async function fetchInstagramRapidApi(handle: string, rapidApiKey: string): Promise<InstagramData | null> {
  try {
    const headers = {
      "X-Rapidapi-Key": rapidApiKey,
      "X-Rapidapi-Host": "instagram-looter2.p.rapidapi.com",
    };
    const [profileRes, postsRes] = await Promise.all([
      fetch(`https://instagram-looter2.p.rapidapi.com/profile?username=${handle}`, { headers }),
      fetch(`https://instagram-looter2.p.rapidapi.com/posts?username=${handle}&count=6`, { headers })
        .catch(() => null),
    ]);
    if (!profileRes.ok) {
      console.warn(`[disc] RapidAPI profile HTTP ${profileRes.status} for ${handle}`);
      return null;
    }
    const igData = await profileRes.json();

    let posts: PostData[] = [];
    if (postsRes && postsRes.ok) {
      const postsJson = await postsRes.json();
      if (Array.isArray(postsJson)) {
        posts = postsJson.slice(0, 6).map((p: any) => ({
          caption: p.edge_media_to_caption?.edges?.[0]?.node?.text || p.caption || p.text || "",
          likes: p.edge_liked_by?.count || p.like_count || 0,
          comments: p.edge_media_to_comment?.count || p.comment_count || 0,
          timestamp: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : "",
        })).filter((p: PostData) => p.caption);
      }
    }
    if (posts.length === 0 && igData.edge_owner_to_timeline_media?.edges) {
      posts = igData.edge_owner_to_timeline_media.edges.slice(0, 6).map((edge: any) => ({
        caption: edge.node?.edge_media_to_caption?.edges?.[0]?.node?.text || "",
        likes: edge.node?.edge_liked_by?.count || 0,
        comments: edge.node?.edge_media_to_comment?.count || 0,
        timestamp: edge.node?.taken_at_timestamp ? new Date(edge.node.taken_at_timestamp * 1000).toISOString() : "",
      })).filter((p: PostData) => p.caption);
    }

    return {
      followers: igData.edge_followed_by?.count || 0,
      following: igData.edge_follow?.count || 0,
      biography: igData.biography || "",
      category: igData.category_name || "",
      fullName: igData.full_name || "",
      posts,
      profilePicUrl: igData.profile_pic_url_hd || igData.profile_pic_url || "",
    };
  } catch (e) {
    console.error("[disc] RapidAPI Instagram fetch error:", e);
    return null;
  }
}

// Fallback: Scrape Creators (api.scrapecreators.com) — usado quando RapidAPI
// retorna 429 (quota mensal estourada) ou erro. Mesmo formato de saída pra
// não quebrar o resto do pipeline. Já é usado pelas funções de prospeccao.
async function fetchInstagramScrapeCreators(handle: string, scKey: string): Promise<InstagramData | null> {
  try {
    const SC_BASE = "https://api.scrapecreators.com";
    const headers = { "x-api-key": scKey };
    const [profRes, postsRes] = await Promise.all([
      fetch(`${SC_BASE}/v1/instagram/profile?handle=${encodeURIComponent(handle)}`, { headers }),
      fetch(`${SC_BASE}/v2/instagram/user/posts?handle=${encodeURIComponent(handle)}`, { headers })
        .catch(() => null),
    ]);
    if (!profRes.ok) {
      console.warn(`[disc] Scrape Creators profile HTTP ${profRes.status} for ${handle}`);
      return null;
    }
    const profJson = await profRes.json();
    const user = profJson?.data?.user;
    if (!user || !user.username) {
      console.warn(`[disc] Scrape Creators retornou perfil vazio pra ${handle}`);
      return null;
    }

    let posts: PostData[] = [];
    if (postsRes && postsRes.ok) {
      const j = await postsRes.json();
      const items = (j?.items || []).slice(0, 6);
      posts = items.map((p: any) => ({
        caption:
          p.caption?.text ||
          p.caption ||
          p.edge_media_to_caption?.edges?.[0]?.node?.text ||
          "",
        likes: p.like_count || p.edge_liked_by?.count || 0,
        comments: p.comment_count || p.edge_media_to_comment?.count || 0,
        timestamp: p.taken_at
          ? new Date(p.taken_at * 1000).toISOString()
          : (p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : ""),
      })).filter((p: PostData) => p.caption);
    }
    if (posts.length === 0 && user.edge_owner_to_timeline_media?.edges) {
      posts = user.edge_owner_to_timeline_media.edges.slice(0, 6).map((edge: any) => ({
        caption: edge.node?.edge_media_to_caption?.edges?.[0]?.node?.text || "",
        likes: edge.node?.edge_liked_by?.count || 0,
        comments: edge.node?.edge_media_to_comment?.count || 0,
        timestamp: edge.node?.taken_at_timestamp ? new Date(edge.node.taken_at_timestamp * 1000).toISOString() : "",
      })).filter((p: PostData) => p.caption);
    }

    return {
      followers: user.edge_followed_by?.count || 0,
      following: user.edge_follow?.count || 0,
      biography: user.biography || "",
      category: user.category_name || user.business_category_name || "",
      fullName: user.full_name || "",
      posts,
      profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || "",
    };
  } catch (e) {
    console.error("[disc] Scrape Creators Instagram fetch error:", e);
    return null;
  }
}

// Wrapper: tenta RapidAPI primeiro, cai pra Scrape Creators se falhar.
// Resiliente a quota mensal estourada (RapidAPI Basic = 150/mês).
async function fetchInstagram(handle: string, rapidApiKey: string, scKey: string): Promise<InstagramData | null> {
  if (rapidApiKey) {
    const r = await fetchInstagramRapidApi(handle, rapidApiKey);
    if (r) return r;
    console.log(`[disc] RapidAPI falhou pra ${handle}, tentando Scrape Creators…`);
  }
  if (scKey) {
    const sc = await fetchInstagramScrapeCreators(handle, scKey);
    if (sc) return sc;
  }
  return null;
}

async function cacheProfilePic(
  supabase: any,
  url: string,
  handle: string
): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buf = await res.arrayBuffer();
    const path = `r10x/${handle}_${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("instagram-profiles")
      .upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (error) return url;
    const { data } = supabase.storage.from("instagram-profiles").getPublicUrl(path);
    return data?.publicUrl || url;
  } catch {
    return url;
  }
}

async function callGemini(prompt: string, geminiKey: string, log: (m: string) => void): Promise<string | null> {
  try {
    log("[disc] calling Gemini 2.5 Flash");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 6500,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      log(`[disc] Gemini HTTP ${res.status}: ${errBody.slice(0, 180)}`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    if (text) log(`[disc] Gemini raw len=${text.length}`);
    return text;
  } catch (e) {
    log(`[disc] Gemini exception: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function callClaude(prompt: string, anthropicKey: string, log: (m: string) => void): Promise<string | null> {
  try {
    log("[disc] calling Claude Haiku 4.5");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      log(`[disc] Claude HTTP ${res.status}: ${errBody.slice(0, 180)}`);
      return null;
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim() || null;
    if (text) log(`[disc] Claude raw: ${text.slice(0, 150)}`);
    return text;
  } catch (e) {
    log(`[disc] Claude exception: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function callOpenAi(prompt: string, openAiKey: string, log: (m: string) => void): Promise<string | null> {
  try {
    log("[disc] calling OpenAI gpt-4o-mini (fallback)");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      log(`[disc] OpenAI HTTP ${res.status}: ${errBody.slice(0, 180)}`);
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    log(`[disc] OpenAI exception: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function extractJson(raw: string): any | null {
  // Claude às vezes envolve em ```json ... ```; OpenAI com response_format já vem limpo.
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  // tenta extrair primeiro JSON object da string
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  try { return JSON.parse(s); } catch { return null; }
}

async function generateAnalysis(
  ig: InstagramData,
  nome: string,
  openAiKey: string,
  debug?: { trace: string[] },
): Promise<AiAnalysis> {
  const log = (m: string) => { console.log(m); if (debug) debug.trace.push(m); };
  const fallback: AiAnalysis = {
    profissao_inferida: ig.category || "Empreendedor(a)",
    nicho: ig.category || "Negócio próprio",
    tom_conteudo: "Direto",
    frequencia: ig.posts.length >= 4 ? "alta" : ig.posts.length >= 2 ? "média" : "baixa",
    pontos_fortes: ["Presença digital ativa"],
    pontos_melhoria: [],
    plano_acao: [],
    caso_pratico_ia: "Aplique automação de qualificação de leads no WhatsApp pra triar contatos antes da sua agenda.",
    elogio_personalizado: `${nome.split(" ")[0]}, dá pra ver que você leva sua presença digital a sério — isso já te coloca na frente da maioria.`,
  };

  const geminiKey = (await getIntegrationKey("gemini", "GEMINI_API_KEY")) || Deno.env.get("GOOGLE_AI_KEY") || "";
  const anthropicKey = (await getIntegrationKey("anthropic", "ANTHROPIC_API_KEY")) || "";
  const hasAnyKey = geminiKey || anthropicKey || openAiKey;
  if (!hasAnyKey) {
    log("[disc] no LLM key configured, using fallback");
    return fallback;
  }

  const hasContent = Boolean(ig.biography) || ig.posts.length > 0;
  if (!hasContent) {
    log("[disc] no content in IG, using fallback");
    return fallback;
  }
  log(`[disc] LLM step, bio=${ig.biography.length} posts=${ig.posts.length}`);

  const postsText = ig.posts.slice(0, 6).map((p, i) =>
    `${i + 1}. "${(p.caption || "").substring(0, 240)}" (${p.likes} likes, ${p.comments} comentários)`
  ).join("\n") || "Sem posts visíveis";

  const avgLikes = ig.posts.length > 0
    ? Math.round(ig.posts.reduce((s, p) => s + (p.likes || 0), 0) / ig.posts.length)
    : 0;
  const engagementRate = ig.followers > 0
    ? ((avgLikes / ig.followers) * 100).toFixed(2)
    : "0";

  const prompt = `Você é Carlos da SQUAAD, especialista em IA aplicada a marketing e posicionamento digital. Você atua como CONSULTOR DE POSICIONAMENTO sênior. Tom: direto, informal brasileiro, sem frufru, energia de quem saiu do chão de fábrica pra dono. NUNCA generalize — cada ponto precisa citar algo CONCRETO do Instagram analisado (bio, posts, engajamento, profissão).

Sua missão: analisar o perfil abaixo e gerar um diagnóstico PROFUNDO de posicionamento. NÃO copie minhas instruções, NÃO use frases genéricas tipo "diversifique conteúdo", "use mais hashtags", "poste mais". Tem que ser específico ao QUE essa pessoa faz e ao QUE foi visto nos posts.

Devolva APENAS um JSON válido (sem markdown, sem comentários, sem texto antes ou depois) com EXATAMENTE estes campos:
{
  "profissao_inferida": "string específica baseada em bio e posts",
  "nicho": "string específica, não genérica",
  "tom_conteudo": "string descrevendo o estilo dos posts",
  "frequencia": "alta" | "média" | "baixa",
  "pontos_fortes": ["string específica", "string específica"],
  "pontos_melhoria": [
    { "titulo": "Título curto (máx 6 palavras) específico", "descricao": "1-2 frases dizendo EXATAMENTE o que está deixando dinheiro na mesa COM BASE no que foi visto nos posts/bio. Cite elementos concretos. Foque em conversão, autoridade ou clareza de oferta. Termine com solução acionável." },
    { ... },
    { ... }
  ],
  "plano_acao": [
    { "semana": "Semana 1", "acao": "1-2 frases descrevendo a ação concreta. Cite o que ela vai fazer ESPECÍFICO ao negócio dela. Não fale 'comece a postar mais' — diga 'crie um destaque chamado X com Y, Z'." },
    { "semana": "Semana 2", "acao": "..." },
    { "semana": "Semana 3", "acao": "..." },
    { "semana": "Semana 4", "acao": "..." }
  ],
  "caso_pratico_ia": "string de 3-4 linhas mostrando UM caso prático ESPECÍFICO de como aplicar IA no negócio dela. Cite ferramenta (CRM AI FIRST, agente WhatsApp 24/7 etc), o que ele faz, e que resultado entrega. Foque no nicho real dela.",
  "elogio_personalizado": "string de 2-3 linhas ESPECÍFICO, citando algo concreto da bio ou posts. Trate por ${nome.split(" ")[0]}."
}

REGRAS dos pontos_melhoria (3 itens obrigatórios):
- Cada ponto deve referenciar algo REAL do scrap (um post específico, a estrutura da bio, o tipo de engajamento, o uso ou ausência de CTA, a falta de prova social etc).
- PROIBIDO frases tipo "poste mais conteúdo", "use mais stories", "interaja com seguidores", "diversifique formatos". São genéricas.
- PERMITIDO citar: "Seus posts educam sobre X mas não fecham nenhum CTA pra agendar consulta", "A bio não diz pra quem é o seu serviço, fica abstrata", "Você mostra resultado em [post tal] mas não capitaliza isso virando case fixo nos destaques".
- Pense como consultor que cobra R$5k pra revisar posicionamento. Aponte o que VOCÊ veria.

REGRAS do plano_acao (4 semanas obrigatórias):
- Cada semana = UMA ação executável em 7 dias, conectada ao nicho real dela.
- Sequência lógica: semana 1 = ajuste imediato (bio/destaques), semana 2 = conteúdo, semana 3 = oferta/CTA, semana 4 = automação/IA.
- PROIBIDO ações vagas. EXEMPLO RUIM: "Crie mais conteúdo". EXEMPLO BOM: "Refaça os destaques com 3 cases reais: 'Antes/Depois', 'Como funciona', 'Resultados em 30 dias'."

REGRAS do caso_pratico_ia:
- Específico ao NICHO dela. Se é clínica → automação de agendamento + lembrete. Se é loja → recuperação de carrinho via WhatsApp. Se é prestador de serviço → qualificação de lead 24/7.
- Mencionar ferramenta concreta (CRM AI FIRST da SQUAAD, agente WhatsApp, etc) e o impacto numérico (ex: "30% menos no-show", "agenda cheia em 2 semanas").

Dados do Instagram (scrap real):
Nome do dono: ${nome}
Nome completo no IG: ${ig.fullName}
Bio: "${ig.biography}"
Categoria IG: ${ig.category || "n/a"}
Seguidores: ${ig.followers}
Seguindo: ${ig.following}
Total de posts visíveis: ${ig.posts.length}
Engajamento médio: ${avgLikes} likes/post (${engagementRate}% da base)
Posts recentes (caption + likes + comentários):
${postsText}`;

  // 1) Gemini (primário — tem free tier robusto)
  let raw: string | null = null;
  if (geminiKey) {
    raw = await callGemini(prompt, geminiKey, log);
  }
  // 2) Fallback Claude
  if (!raw && anthropicKey) {
    raw = await callClaude(prompt, anthropicKey, log);
  }
  // 3) Fallback OpenAI
  if (!raw && openAiKey) {
    raw = await callOpenAi(prompt, openAiKey, log);
  }
  if (!raw) {
    log("[disc] all LLMs failed, using fallback");
    return fallback;
  }

  const parsed = extractJson(raw);
  if (!parsed) {
    log(`[disc] JSON parse failed (len=${raw.length}): ${raw.slice(0, 600)}`);
    return fallback;
  }
  log(`[disc] LLM parse OK`);

  const pontosMelhoria: PontoMelhoria[] = Array.isArray(parsed.pontos_melhoria)
    ? parsed.pontos_melhoria
        .filter((p: any) => p && typeof p === "object" && p.titulo && p.descricao)
        .slice(0, 3)
        .map((p: any) => ({
          titulo: String(p.titulo).slice(0, 80),
          descricao: String(p.descricao).slice(0, 500),
        }))
    : [];

  const planoAcao: AcaoPlano[] = Array.isArray(parsed.plano_acao)
    ? parsed.plano_acao
        .filter((p: any) => p && typeof p === "object" && p.semana && p.acao)
        .slice(0, 4)
        .map((p: any) => ({
          semana: String(p.semana).slice(0, 30),
          acao: String(p.acao).slice(0, 360),
        }))
    : [];

  return {
    profissao_inferida: String(parsed.profissao_inferida || fallback.profissao_inferida),
    nicho: String(parsed.nicho || fallback.nicho),
    tom_conteudo: String(parsed.tom_conteudo || fallback.tom_conteudo),
    frequencia: String(parsed.frequencia || fallback.frequencia),
    pontos_fortes: Array.isArray(parsed.pontos_fortes) ? parsed.pontos_fortes.slice(0, 3) : fallback.pontos_fortes,
    pontos_melhoria: pontosMelhoria,
    plano_acao: planoAcao,
    caso_pratico_ia: String(parsed.caso_pratico_ia || fallback.caso_pratico_ia).slice(0, 500),
    elogio_personalizado: String(parsed.elogio_personalizado || fallback.elogio_personalizado),
  };
}

function normalizeWhatsapp(raw: string): string {
  let n = raw.replace(/\D/g, "");
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

// Checa se o número existe no WhatsApp via UAZAPI.
// Retorna `true` se existe, `false` se não existe, `null` se não conseguiu checar.
async function whatsappExists(
  supabase: any,
  number: string,
  log: (m: string) => void,
): Promise<boolean | null> {
  try {
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_token")
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();
    if (!instance) {
      log("[whatsapp_exists] no connected instance, skipping check");
      return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch("https://squaad.uazapi.com/chat/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instance.instance_token },
      body: JSON.stringify({ numbers: [number] }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      log(`[whatsapp_exists] HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    // Formato esperado: { numbers: [{ query: "55...", exists: true/false }] } OR array direto
    const list = Array.isArray(data) ? data : (data?.numbers || data?.result || []);
    if (!Array.isArray(list) || list.length === 0) return null;
    const first = list[0];
    if (typeof first?.exists === "boolean") return first.exists;
    if (typeof first?.isWhatsapp === "boolean") return first.isWhatsapp;
    if (typeof first?.is_whatsapp === "boolean") return first.is_whatsapp;
    return null;
  } catch (e) {
    log(`[whatsapp_exists] error: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const debugMode = new URL(req.url).searchParams.get("debug") === "1";
    const debug = debugMode ? { trace: [] as string[] } : undefined;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
    const ipHash = await hashIp(ip);
    const allowed = await checkRateLimit(supabase, ipHash);
    if (!allowed) {
      return new Response(
        JSON.stringify({ success: false, error: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const nome = String(body.nome || "").trim();
    const whatsappRaw = String(body.whatsapp || "").trim();
    const instagram = String(body.instagram || "").replace(/^@/, "").trim().toLowerCase();
    const authorizedMural = Boolean(body.authorized_mural);
    const utm = body.utm || null;

    if (!nome || nome.split(/\s+/).length < 2) {
      return new Response(JSON.stringify({ success: false, error: "nome_invalido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const whatsapp = normalizeWhatsapp(whatsappRaw);
    if (whatsapp.length < 12) {
      return new Response(JSON.stringify({ success: false, error: "whatsapp_invalido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(instagram)) {
      return new Response(JSON.stringify({ success: false, error: "instagram_invalido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida que o WhatsApp REALMENTE existe (evita lead inválido + frustração no PDF).
    // Se a UAZAPI falhar (sem instância, timeout), prossegue (não bloqueia).
    const exists = await whatsappExists(supabase, whatsapp, (m) => console.log(m));
    if (exists === false) {
      return new Response(JSON.stringify({
        success: false,
        error: "whatsapp_nao_existe",
        message: "Esse número não está no WhatsApp. Confere o WhatsApp e tenta de novo.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca board e primeira coluna
    const { data: board } = await supabase
      .from("crm_boards")
      .select("id, name")
      .eq("slug", BOARD_SLUG)
      .maybeSingle();
    if (!board) {
      return new Response(JSON.stringify({ success: false, error: "board_not_found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: firstColumn } = await supabase
      .from("crm_columns")
      .select("id, name")
      .eq("board_id", board.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Dedup: mesmo whatsapp no mesmo evento nas últimas 24h.
    // Retorna a análise gravada pra não dar tela vazia se o lead tentar de novo.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await (supabase as any)
      .from("crm_leads")
      .select("id, ai_analysis, instagram_profile_pic_url")
      .eq("board_id", board.id)
      .eq("whatsapp", whatsapp)
      .gte("created_at", dayAgo)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          lead_id: existing.id,
          deduped: true,
          analysis: existing.ai_analysis || null,
          profile_pic_url: existing.instagram_profile_pic_url || null,
          instagram_available: !!existing.instagram_profile_pic_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Instagram: RapidAPI primeiro, Scrape Creators como fallback (resiliente
    // a quota mensal estourada — Plano Basic do RapidAPI = 150/mês só)
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY") || "";
    const scKey = Deno.env.get("SCRAPECREATORS_API_KEY") || "";
    const openAiKey = await getIntegrationKey("openai", "OPENAI_API_KEY");
    let ig: InstagramData | null = null;
    if (rapidApiKey || scKey) ig = await fetchInstagram(instagram, rapidApiKey, scKey);

    // Cachear foto de perfil em storage (evita CORS/expiração no mural)
    let cachedPic = "";
    if (ig?.profilePicUrl) {
      cachedPic = await cacheProfilePic(supabase, ig.profilePicUrl, instagram);
    }

    // Análise IA (com fallback)
    const analysis = ig
      ? await generateAnalysis(ig, nome, openAiKey || "", debug)
      : {
          profissao_inferida: "Empreendedor(a)",
          nicho: "Negócio próprio",
          tom_conteudo: "Direto",
          frequencia: "média",
          pontos_fortes: ["Foco em crescer"],
          elogio_personalizado:
            `${nome.split(" ")[0]}, vamos analisar pelo seu perfil DISC já que seu Instagram tá privado ou indisponível — fica tranquilo, o resultado continua poderoso.`,
        };

    // Cria lead
    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .insert({
        board_id: board.id,
        column_id: firstColumn?.id || null,
        name: nome,
        whatsapp,
        instagram,
        instagram_profile_pic_url: cachedPic || ig?.profilePicUrl || null,
        instagram_raw: ig || null,
        ai_analysis: analysis,
        evento: EVENTO_SLUG,
        authorized_mural: authorizedMural,
        source: "reprograme10x_landing",
        tags: [TAG, "Rio de Janeiro 31/05"],
        lead_score: ig ? 15 : 5,
        notes: utm ? `UTM: ${JSON.stringify(utm)}` : null,
      })
      .select("id, name, instagram, instagram_profile_pic_url")
      .single();

    if (leadErr) {
      console.error("[disc] insert lead error:", leadErr);
      return new Response(JSON.stringify({ success: false, error: leadErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Activity log (não bloqueia se falhar)
    await supabase.from("crm_activities").insert({
      lead_id: lead.id,
      board_id: board.id,
      activity_type: "lead_created",
      description: `Lead capturado via landing Reprograme-se 10X`,
      board_name: board.name,
      to_column_name: firstColumn?.name || null,
      metadata: { source: "reprograme10x_landing", instagram, authorized_mural: authorizedMural },
    });

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        analysis,
        profile_pic_url: lead.instagram_profile_pic_url,
        instagram_available: !!ig,
        ...(debug ? { debug_trace: debug.trace } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[disc-lead-magnet] fatal:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
