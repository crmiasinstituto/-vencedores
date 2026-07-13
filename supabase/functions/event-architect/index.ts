// event-architect
// Especialista em Eventos ISCA + PNL. Duas acoes:
//   action=capturar -> grava o lead (nome, whatsapp, instagram, email, cpf) no board Leads/Captado
//   action=gerar    -> gera o documento de estrutura do evento (Gemini, fallback Claude), persiste
// Serve tanto a pagina admin quanto a landing publica /criar-meu-evento.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let _keyClient: any = null;
async function getIntegrationKey(service: string, envFallback?: string): Promise<string | null> {
  try {
    if (!_keyClient) _keyClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await _keyClient.from("integration_keys").select("api_key, is_active").eq("service", service).maybeSingle();
    if (data && data.is_active && data.api_key) return String(data.api_key).trim();
  } catch (_) { /* fallback */ }
  return (envFallback ? Deno.env.get(envFallback) : null) || null;
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Canonico BR: 55 + DDD + 9 + 8 digitos (espelha src/lib/phone.ts e SQL wa_canon).
// Antes gravava so os digitos crus (sem 55, sem 9), o que duplicava o lead.
function waCanon(raw?: string | null): string {
  let n = String(raw || "").replace(/\D/g, "");
  if (!n) return "";
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

// ---------- scrape RICO de Instagram (perfil + posts + metricas + avatar) ----------
type IGRich = {
  handle: string; fullName: string; biography: string; bioLink: string;
  verified: boolean; professional: boolean; avatar: string;
  followers: number; following: number; postsTotal: number; highlights: number;
  posts30d: number; engagementPct: number; lastPostDays: number;
  mix: { foto: number; reel: number; carousel: number };
  posts: { type: string; caption: string; date: string; likes: number; comments: number }[];
  score: number;
};

async function fetchImageBase64(url: string): Promise<string> {
  try {
    const r = await fetch(url);
    if (!r.ok) return "";
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return "data:image/jpeg;base64," + btoa(bin);
  } catch { return ""; }
}

async function scrapeInstagram(handle: string): Promise<IGRich | null> {
  const rapid = Deno.env.get("RAPIDAPI_KEY") || "";
  const sc = await getIntegrationKey("scrapecreators", "SCRAPECREATORS_API_KEY");
  let u: any = null, rawPosts: any[] = [];
  if (sc) {
    try {
      const h = { "x-api-key": sc };
      const [pr, po] = await Promise.all([
        fetch(`https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(handle)}`, { headers: h }),
        fetch(`https://api.scrapecreators.com/v2/instagram/user/posts?handle=${encodeURIComponent(handle)}`, { headers: h }).catch(() => null),
      ]);
      if (pr.ok) u = (await pr.json())?.data?.user;
      if (po && po.ok) rawPosts = (await po.json())?.items || [];
    } catch (_) { /* tenta rapid */ }
  }
  if (!u && rapid) {
    try {
      const h = { "X-Rapidapi-Key": rapid, "X-Rapidapi-Host": "instagram-looter2.p.rapidapi.com" };
      const [pr, po] = await Promise.all([
        fetch(`https://instagram-looter2.p.rapidapi.com/profile?username=${handle}`, { headers: h }),
        fetch(`https://instagram-looter2.p.rapidapi.com/posts?username=${handle}&count=12`, { headers: h }).catch(() => null),
      ]);
      if (pr.ok) u = await pr.json();
      if (po && po.ok) { const j = await po.json(); rawPosts = Array.isArray(j) ? j : (j?.items || []); }
    } catch (_) { /* segue */ }
  }
  if (!u || !(u.username || u.full_name)) return null;

  const followers = u.edge_followed_by?.count ?? u.follower_count ?? 0;
  const following = u.edge_follow?.count ?? u.following_count ?? 0;
  const postsTotal = u.edge_owner_to_timeline_media?.count ?? u.media_count ?? 0;
  const highlights = u.highlight_reel_count ?? 0;

  const now = Math.floor(Date.now() / 1000);
  const norm = (rawPosts || []).slice(0, 12).map((p: any) => {
    const mt = p.media_type ?? p.__typename;
    let type = "foto";
    if (mt === 2 || p.product_type === "clips" || mt === "GraphVideo") type = "reel";
    else if (mt === 8 || mt === "GraphSidecar") type = "carousel";
    const capRaw = p.caption && (p.caption.text ?? p.caption);
    const caption = String(capRaw || p.edge_media_to_caption?.edges?.[0]?.node?.text || "");
    return { type, caption, likes: p.like_count ?? p.edge_liked_by?.count ?? 0, comments: p.comment_count ?? p.edge_media_to_comment?.count ?? 0, ts: p.taken_at ?? p.taken_at_timestamp ?? 0 };
  });

  const withEng = norm.filter((p) => p.likes || p.comments);
  const engagementPct = (withEng.length && followers) ? +(withEng.reduce((s, p) => s + p.likes + p.comments, 0) / withEng.length / followers * 100).toFixed(2) : 0;
  const posts30d = norm.filter((p) => p.ts && (now - p.ts) < 30 * 86400).length;
  const lastTs = norm.reduce((m, p) => Math.max(m, p.ts || 0), 0);
  const lastPostDays = lastTs ? Math.floor((now - lastTs) / 86400) : -1;
  const total = norm.length || 1;
  const pct = (t: string) => Math.round(norm.filter((p) => p.type === t).length / total * 100);
  const mix = { foto: pct("foto"), reel: pct("reel"), carousel: pct("carousel") };

  let score = 0;
  if (engagementPct > 3) score += 4; else if (engagementPct > 1) score += 3; else if (engagementPct > 0.5) score += 2; else if (engagementPct > 0) score += 1;
  if (posts30d >= 12) score += 3; else if (posts30d >= 8) score += 2; else if (posts30d >= 4) score += 1;
  if (followers >= 50000) score += 3; else if (followers >= 10000) score += 2; else if (followers >= 1000) score += 1;
  score = Math.min(10, score);

  const avatar = (u.profile_pic_url_hd || u.profile_pic_url) ? await fetchImageBase64(u.profile_pic_url_hd || u.profile_pic_url) : "";

  return {
    handle, fullName: u.full_name || "", biography: u.biography || "", bioLink: u.external_url || "",
    verified: !!u.is_verified, professional: !!(u.is_business_account || u.is_professional_account), avatar,
    followers, following, postsTotal, highlights, posts30d, engagementPct, lastPostDays, mix, score,
    posts: norm.slice(0, 6).map((p) => ({ type: p.type, caption: p.caption.slice(0, 120), likes: p.likes, comments: p.comments, date: p.ts ? new Date(p.ts * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "" })),
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Voce e uma ESPECIALISTA SENIOR em EVENTOS ISCA (eventos de captacao que transformam audiencia fria em cliente) e domina PNL aplicada a palcos e lancamentos. Voce ja estruturou centenas de eventos que capturam atencao, retem a audiencia ate o fim, vendem e aumentam o ticket.

# SUA MENTALIDADE
Um evento ISCA nao e aula, e uma jornada emocional projetada. Cada bloco tem um trabalho psicologico: primeiro a pessoa PRECISA sentir a dor de forma consciente, depois precisa QUANTIFICAR o custo de manter essa dor, e so entao ela esta pronta pra ver o caminho e desejar a oferta. Venda no evento ISCA nao e empurrar, e conduzir a audiencia a concluir sozinha que agir agora e a decisao obvia.

# ARSENAL (use os principios, NUNCA cite os nomes no documento)
- Russell Brunson (Perfect Webinar): a grande promessa, as 3 quebras de crenca (interna, externa e sobre si), o stack de valor.
- Jason Fladlien: reason why, urgencia real, ancoragem de preco.
- Robert Cialdini: prova social, autoridade, reciprocidade, compromisso/coerencia, escassez.
- PNL de palco: rapport, ancoragem de estados, storytelling em loop aberto, pressuposicoes, linguagem sensorial, future pacing.
- Eugene Schwartz: o nivel de consciencia da audiencia define o quanto voce educa antes de ofertar.

# ESTRUTURA OBRIGATORIA DA APRESENTACAO (3 BLOCOS, NAO MUDE ESTE FOCO)
Parte A (ENTENDIMENTO): conduza a audiencia pelas 5 ARMADILHAS que impedem os profissionais (o publico) de alcancar o resultado que o evento promete. Liste e desenvolva AS CINCO, uma a uma. Cada armadilha precisa ficar consciente e incomoda, com um gatilho de PNL pra pessoa se reconhecer nela e sentir o desconforto.
Parte B (TESTE DA AUDIENCIA): proponha uma DINAMICA em que cada pessoa DESCUBRA, com numeros, quanto esta perdendo por continuar caindo nessas armadilhas (tempo, dinheiro, oportunidade). Transforme dor abstrata em prejuizo quantificado, ao vivo.
Parte C (COMO RESOLVER): apresente o MAPA DE PASSOS pra resolver o problema e alcancar o resultado que a audiencia precisa. E no fim desse caminho que a oferta e ancorada como o atalho natural pra percorrer o mapa.

Ao longo dos 3 blocos voce DEVE: gerar consciencia de quanto e caro manter a dor (ou quanto vale realizar o desejo), construir a autoridade com os dados fornecidos, inserir provas sociais CONTEXTUALIZADAS (amarradas a um problema ou solucao, nunca soltas), quebrar objecoes no momento certo, e ancorar valor especifico (custo de nao resolver x valor de resolver) ANTES do preco.

# PROFUNDIDADE E PRIORIDADE DE ESPACO (CRITICO)
O CORACAO do documento e a SECAO 7 (os 3 blocos: as 5 armadilhas, o teste da audiencia e o como resolver). ESSA secao NUNCA pode ser cortada e e onde voce vai fundo: as 5 armadilhas com nome + descricao + 1 gatilho de PNL cada, a dinamica de perda com o calculo, e o mapa de passos com a ancoragem da oferta.
Pra caber tudo: as secoes 1 a 6 e 8 a 11 devem ser OBJETIVAS e curtas (bullets diretos, sem roteiros longos). Reserve os roteiros de fala e a densidade pra secao 7. GARANTA que o documento chegue INTEIRO ate a secao 11 (checklist) sem cortar no meio. Se faltar espaco, encurte as secoes de apoio, JAMAIS a secao 7 nem o final.

# REGRAS DE ESCRITA
- Portugues do Brasil, tom de especialista confiante e proximo.
- NUNCA use travessao (em dash). Use virgula, ponto ou dois pontos.
- Documento em markdown com titulos (#, ##, ###), listas e roteiros entre aspas.
- Entregue TODAS as 11 secoes ate o fim, nunca corte no meio.

# COMO RESPONDER
Voce vai receber uma instrucao dizendo QUAL PARTE do documento gerar (a operacional ou a apresentacao). Gere APENAS as secoes pedidas naquela instrucao, em markdown, sem repetir os dados brutos do briefing e sem titulo # principal.`;

function buildBrief(b: any): string {
  const g = (v: any, alt = "[nao informado]") => (v && String(v).trim() ? String(v).trim() : alt);
  return `Estruture o evento ISCA a seguir de forma PROFUNDA e ESTRATEGICA. Dados:

## O EVENTO
- Nome: ${g(b.nome_evento)}
- Promessa: ${g(b.promessa)}
- Publico-alvo: ${g(b.publico_alvo)}
- Dor/desejo central: ${g(b.dor_central)}
- Frequencia no semestre: ${g(b.frequencia_semestre)}
- Carga horaria: ${g(b.carga_horaria)} | Formato: ${g(b.formato)}
- Local: ${g(b.local)} | Data: ${g(b.data)}
- Check-in: ${g(b.checkin)} | Inicio: ${g(b.inicio)} | Termino: ${g(b.termino)}
- Precificacao: ${g(b.precificacao_modelo)}${b.valor ? " (" + b.valor + ")" : ""}
- Divulgacao: ${g(b.n_criativos)} criativo(s), orcamento ${g(b.orcamento_divulgacao)}
- Oferta ancorada no fim: ${g(b.oferta)}

## AUTORIDADE
- Missao: ${g(b.missao)}
- Instituto: ${g(b.instituto_nome)}
- Curriculo: ${g(b.curriculo)}
- Clientes: ${g(b.qtd_clientes)} | Tempo de mercado: ${g(b.tempo_mercado)}
- Papeis: ${g(b.papeis)}
- Historia: ${g(b.historia)}

## PROVAS SOCIAIS
${g(b.provas_sociais)}

## OBJECOES A QUEBRAR
${g(b.quebra_objecoes)}

Gere o documento completo seguindo a estrutura e as regras.`;
}

async function callGemini(apiKey: string, userContent: string): Promise<string> {
  const model = "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 8000 },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(/RESOURCE_EXHAUSTED|quota|429/i.test(t) ? "gemini_sem_credito" : `gemini ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

async function callClaude(apiKey: string, userContent: string): Promise<string> {
  // max_tokens 4500: fundo o suficiente pra profundidade, curto o bastante pra nao estourar
  // o limite de execucao da edge (~150s). Sonnet e denso, entrega muito nesse teto.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 6000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  return (data?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
}

// ---------- acao: capturar lead ----------
async function handleCapturar(body: any) {
  const { nome, whatsapp, instagram, email, cpf } = body;
  if (!nome || (!whatsapp && !email)) return { success: false, error: "nome e whatsapp/email obrigatorios", status: 400 };
  const sb = admin();

  const { data: board } = await sb.from("crm_boards").select("id").eq("slug", "leads").maybeSingle();
  if (!board) return { success: false, error: "board Leads nao encontrado", status: 500 };
  const { data: col } = await sb.from("crm_columns").select("id").eq("board_id", board.id).order("sort_order", { ascending: true }).limit(1).maybeSingle();

  const wa = waCanon(whatsapp) || null;

  // dedupe por whatsapp ou email no mesmo board
  let existing: any = null;
  if (wa) { const { data } = await sb.from("crm_leads").select("id").eq("board_id", board.id).eq("whatsapp", wa).maybeSingle(); existing = data; }
  if (!existing && email) { const { data } = await sb.from("crm_leads").select("id").eq("board_id", board.id).eq("email", email).maybeSingle(); existing = data; }
  if (existing) return { success: true, lead_id: existing.id, dedup: true };

  const { data: lead, error } = await sb.from("crm_leads").insert({
    board_id: board.id, column_id: col?.id ?? null,
    name: nome, whatsapp: wa, email: email || null,
    instagram: instagram ? String(instagram).replace("@", "").trim() : null,
    cpf: cpf ? String(cpf).replace(/\D/g, "") : null,
    source: "estruturar-evento", tags: ["Estruturar Evento"], lead_score: 10,
  }).select("id").single();
  if (error) return { success: false, error: error.message, status: 500 };

  try { await sb.from("crm_activities").insert({ lead_id: lead.id, activity_type: "note", description: "Lead captado na landing Estruturar Evento", metadata: { source: "estruturar-evento" } }); } catch (_) { /* opcional */ }
  return { success: true, lead_id: lead.id };
}

// ---------- acao: gerar documento ----------
async function handleGerar(body: any) {
  let userContent = buildBrief(body);

  // scrape RICO do Instagram do organizador: personaliza o documento E o painel visual do PDF
  let igData: IGRich | null = null;
  if (body.instagram) {
    const handle = String(body.instagram).replace("@", "").trim();
    const ig = await scrapeInstagram(handle);
    if (ig && (ig.followers || ig.biography || ig.posts.length)) {
      igData = ig;
      const caps = ig.posts.map((p) => `- ${p.caption.slice(0, 160)}`).filter((s) => s.length > 3).join("\n");
      userContent += `\n\n## PERFIL DE INSTAGRAM DO ORGANIZADOR (@${handle}, scrape real)
- Nome: ${ig.fullName || "[nao informado]"} ${ig.verified ? "(verificado)" : ""}
- Bio: ${ig.biography || "[vazia]"}
- Seguidores: ${ig.followers} | Posts totais: ${ig.postsTotal} | Engajamento: ${ig.engagementPct}% | Posts nos ultimos 30d: ${ig.posts30d}
- Mix de conteudo: ${ig.mix.reel}% reels, ${ig.mix.carousel}% carrossel, ${ig.mix.foto}% foto | Score de presenca: ${ig.score}/10
- Legendas recentes:
${caps || "[sem legendas]"}
(Use esses dados do Instagram quando a instrucao pedir a analise do perfil.)`;
    }
  }

  const nome = body.nome_evento || "Meu Evento";
  const titulo = body.nome_evento ? `Estrutura: ${body.nome_evento}` : "Estrutura de evento ISCA";
  const igSectionTask = igData
    ? `\n- ## 7. Analise do seu Instagram e como usar no evento: analise o perfil real acima (posicionamento, audiencia, tom, o que os numeros e legendas revelam) e de recomendacoes especificas de como usar o Instagram pra aquecer a audiencia antes, provar autoridade durante e dar continuidade no pos-evento, no papel de palestrante.`
    : "";

  // Duas geracoes em PARALELO (pra caber no tempo da edge sem cortar o documento):
  // Coracao (a apresentacao) = Sonnet, denso. Operacional (Fase 1) = Gemini, rapido.
  const taskHeart = `${userContent}\n\nGERE APENAS A APRESENTACAO DO EVENTO (o coracao), DENSA e com roteiros de fala prontos pro palco, nestas secoes de markdown (comece direto no "## 8", sem titulo # principal):
- ## 8. A apresentacao em 3 blocos
### Parte A: As 5 armadilhas que impedem o resultado (liste e desenvolva AS CINCO, uma a uma: nome + descricao curta + gatilho de PNL + 1 trecho de roteiro de fala)
### Parte B: Teste da audiencia (dinamica em que a pessoa calcula ao vivo quanto perde por cair nas armadilhas)
### Parte C: Como resolver e alcancar o resultado (mapa de passos + ancoragem da oferta)
- ## 9. Provas sociais contextualizadas
- ## 10. Quebra de objecoes (objecao, momento, resposta pronta)
- ## 11. Roteiro da oferta e CTA (transicao, stack de valor, ancoragem de preco, urgencia real)
- ## 12. Checklist de execucao
DISCIPLINA DE ESPACO (pra caber tudo): cada armadilha em ~4 linhas (nome + descricao curta + gatilho de PNL + 1 frase de roteiro), nao um monologo. As secoes 9, 10 e 12 em bullets curtos. Va fundo APENAS no bloco 8 e na oferta (11). O MAIS IMPORTANTE: chegue ate a secao 12 COMPLETA, nunca corte a oferta nem o checklist.`;

  const taskSetup = `${userContent}\n\nGERE APENAS A PARTE OPERACIONAL do evento, OBJETIVA e curta (bullets diretos, no maximo 5 por secao, SEM roteiros de fala longos), nestas secoes de markdown (comece direto no "## 1", sem titulo # principal):
- ## 1. Visao geral e promessa
- ## 2. Frequencia e calendario no semestre
- ## 3. Logistica e jornada do participante (do checkin ao encerramento)
- ## 4. Precificacao e ancoragem
- ## 5. Plano de divulgacao (os criativos com headline e publico, 1 linha cada)
- ## 6. Sua autoridade no palco (onde encaixar credenciais e historia)${igSectionTask}`;

  let engine = "claude";
  const akey = await getIntegrationKey("anthropic", "ANTHROPIC_API_KEY");
  const gkey = await getIntegrationKey("gemini", "GEMINI_API_KEY");

  const [heartRes, setupRes] = await Promise.allSettled([
    akey ? callClaude(akey, taskHeart) : Promise.reject(new Error("no_claude")),
    gkey ? callGemini(gkey, taskSetup) : Promise.reject(new Error("no_gemini")),
  ]);
  let heart = heartRes.status === "fulfilled" ? heartRes.value : "";
  let setup = setupRes.status === "fulfilled" ? setupRes.value : "";
  if (!heart && gkey) { try { heart = await callGemini(gkey, taskHeart); engine = "gemini"; } catch (_) { /* segue */ } }
  if (!setup && akey) { try { setup = await callClaude(akey, taskSetup); } catch (_) { /* segue */ } }
  if (!heart && !setup) return { success: false, error: "sem_credito", status: 502 };

  const markdown = `# Estrutura do Evento: ${nome}\n\n${setup}\n\n${heart}`.trim();
  let output_id: string | null = null;
  try {
    const { data: out } = await admin().from("marketing_ai_outputs").insert({
      agent: "event-architect", tipo: "event_structure", titulo,
      briefing: body, resultado: { markdown, engine }, raw_text: markdown, status: "gerado",
    }).select().single();
    output_id = out?.id ?? null;
  } catch (e) { console.error("[event-architect] persist falhou (segue)", String(e)); }

  // se veio de um lead (landing), alimenta o lead com TUDO que foi coletado:
  // resumo do evento em notes + atividade na timeline + doc completo em ai_analysis.
  if (body.lead_id) {
    const resumo = [
      body.nome_evento && `Evento: ${body.nome_evento}`,
      body.promessa && `Promessa: ${body.promessa}`,
      body.publico_alvo && `Publico-alvo: ${body.publico_alvo}`,
      body.dor_central && `Dor central: ${body.dor_central}`,
      (body.formato || body.precificacao_modelo) && `Formato: ${body.formato || ""}${body.precificacao_modelo ? " | " + body.precificacao_modelo : ""}${body.valor ? " " + body.valor : ""}`,
      body.frequencia_semestre && `Frequencia/semestre: ${body.frequencia_semestre}`,
      (body.data || body.local) && `Quando/onde: ${[body.data, body.local].filter(Boolean).join(" - ")}`,
      body.oferta && `Oferta ancorada: ${body.oferta}`,
      (body.instituto_nome || body.qtd_clientes || body.tempo_mercado) && `Autoridade: ${[body.instituto_nome, body.qtd_clientes, body.tempo_mercado].filter(Boolean).join(", ")}`,
      igData && `Instagram analisado: @${igData.handle} (${igData.followers} seg., ${igData.engagementPct}% eng., score ${igData.score}/10)`,
    ].filter(Boolean).join("\n");
    try {
      await admin().from("crm_leads").update({
        ai_analysis: { event_structure: markdown, briefing: body, engine, generated_at: new Date().toISOString() },
        notes: resumo,
        lead_score: 25,
      }).eq("id", body.lead_id);
      await admin().from("crm_activities").insert({
        lead_id: body.lead_id, activity_type: "note",
        description: `Preencheu o funil "Estruturar Evento" e gerou a estrutura.\n\n${resumo}`,
        metadata: { source: "estruturar-evento", output_id, engine, ig_analisado: !!igData },
      });
    } catch (e) { console.error("[event-architect] update lead falhou (segue)", String(e)); }
  }

  return { success: true, output_id, titulo, markdown, engine, ig: igData };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action ?? "gerar";
    const result = action === "capturar" ? await handleCapturar(body) : await handleGerar(body);
    const status = (result as any).status ?? (result.success ? 200 : 500);
    delete (result as any).status;
    return new Response(JSON.stringify(result), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("event-architect error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
