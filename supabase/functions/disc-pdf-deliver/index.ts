// disc-pdf-deliver
// Recebe { lead_id } e entrega ao lead, via WhatsApp (UAZAPI):
//   1. Texto de boas-vindas personalizado (1 de 8 variações)
//   2. (pausa 3-5s)
//   3. PDF do diagnóstico DISC
// Anti-block:
//   - Aguarda 6-14s aleatório antes de iniciar (parece humano)
//   - Throttle global: máx 8 envios por minuto agregados
//   - Variações de texto evitam spam classifier
//   - Personaliza com nome, perfil, nicho do lead

import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_MINUTE = 8;

// ============================================================
// VARIAÇÕES DE MENSAGEM (anti-spam classifier)
// ============================================================
const GREETING_TEMPLATES = [
  (n: string) => `Opa ${n}, tudo bem? 👋\nQue massa ter você AGORA no Reprograme-se 10X! Aqui é a SQUAAD, falando direto do evento.`,
  (n: string) => `E aí, ${n}! Curtindo a palestra?\nVi seu DISC chegar aqui agora mesmo. Bora conferir o diagnóstico completo logo abaixo 👇`,
  (n: string) => `${n}! 🙌\nQue energia esse Reprograme-se 10X tá tendo, hein? Aqui ó teu diagnóstico em PDF, separado com carinho ainda fresquinho.`,
  (n: string) => `Fala ${n}!\nObrigado por mergulhar na análise enquanto o evento tá rolando. Aqui vai seu material completo pra revisar com calma depois.`,
  (n: string) => `Opa ${n}! ✨\nAcabei de receber teu pedido aqui do evento. Bora te entregar o diagnóstico bonito pra tu salvar, mostrar pra equipe e executar.`,
  (n: string) => `${n}, beleza?\nReprograme-se 10X tá pegando fogo, né? Aqui ó, teu DISC + diagnóstico em PDF, pronto pra ação assim que tu sair.`,
  (n: string) => `Fala fala ${n}! 👊\nDo evento pra ti em tempo real: guardei sua análise aqui. PDF chegando agora — abre com calma quando puder.`,
  (n: string) => `${n}! Aqui é o pessoal da SQUAAD 🚀\nObrigado por estar com a gente no Reprograme-se 10X. Segue teu material completo logo abaixo.`,
];

const INSIGHT_TEMPLATES = [
  (perfil: string, nicho: string) =>
    `Perfil ${perfil} aplicado a ${nicho} é uma combinação que tem muito espaço pra crescer com IA. Dá uma olhada nos 3 pontos que destaquei no PDF.`,
  (perfil: string, nicho: string) =>
    `O cruzamento ${perfil} + ${nicho} mostrou pontos bem específicos que dá pra atacar essa semana mesmo. Tudo no PDF.`,
  (perfil: string, nicho: string) =>
    `Pessoas ${perfil} em ${nicho} costumam travar nos mesmos 2 ou 3 lugares. Mapeei os teus no diagnóstico.`,
  (perfil: string, nicho: string) =>
    `Tua combinação (${perfil} × ${nicho}) tem um padrão que poucos exploram. Mostro como aproveitar no PDF.`,
  (perfil: string, nicho: string) =>
    `Perfil ${perfil} em ${nicho}: identifiquei 3 ajustes que destravam venda. Tudo detalhado no documento.`,
];

const CLOSING_TEMPLATES = [
  `Aproveita o resto do evento. Quando o palco acabar, abre o PDF e me chama. 🤝`,
  `Curte a palestra. Depois, se quiser bater um papo sobre como aplicar isso, tô por aqui.`,
  `Salva o material agora e abre com calma quando o evento terminar. Qualquer coisa, manda mensagem.`,
  `Bora colocar em prática logo após o evento. Se travar em algo, me chama.`,
  `Tá aí teu diagnóstico. Quando o palco encerrar, aplicação > teoria. Bora?`,
  `Qualquer ponto do PDF que ficar em dúvida quando você revisar, me responde aqui que a gente conversa.`,
];

function pickRandom<T>(arr: T[]): { item: T; index: number } {
  const idx = Math.floor(Math.random() * arr.length);
  return { item: arr[idx], index: idx };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

// ============================================================
// THROTTLE GLOBAL — máx 8 envios/minuto
// ============================================================
async function checkAndReserveSlot(supabase: any): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("disc_pdf_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", oneMinuteAgo);
  return (count ?? 0) < MAX_PER_MINUTE;
}

// ============================================================
// PDF GENERATOR (jsPDF puro, sem precisar de Chrome)
// ============================================================
const DISC_COLORS: Record<string, [number, number, number]> = {
  D: [239, 68, 68],
  I: [245, 158, 11],
  S: [16, 185, 129],
  C: [59, 130, 246],
};
const DISC_LABELS: Record<string, string> = {
  D: "Dominante",
  I: "Influente",
  S: "Estável",
  C: "Cauteloso",
};

function dominantLetter(profile: string): string {
  return (profile.split("-")[0] || profile).toUpperCase();
}

function fmtProfile(profile: string): string {
  if (profile.includes("-")) {
    const [a, b] = profile.split("-").map((s) => s.toUpperCase());
    return `${DISC_LABELS[a] || a} · ${DISC_LABELS[b] || b}`;
  }
  return DISC_LABELS[profile.toUpperCase()] || profile;
}

interface PdfInput {
  nome: string;
  instagram: string;
  profile: string;
  analysis: any;
  profilePicUrl: string | null;
}

async function fetchImageAsDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const ct = res.headers.get("content-type") || "image/jpeg";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

// Paleta SQUAAD
const COLORS = {
  bg: [10, 10, 12] as [number, number, number],
  bgPanel: [22, 22, 26] as [number, number, number],
  bgPanel2: [28, 28, 32] as [number, number, number],
  gold: [250, 200, 0] as [number, number, number],
  goldDim: [180, 140, 0] as [number, number, number],
  textMain: [255, 255, 255] as [number, number, number],
  textMuted: [170, 170, 175] as [number, number, number],
  textSubtle: [110, 110, 115] as [number, number, number],
  border: [55, 55, 60] as [number, number, number],
};

function paintBg(doc: any, W: number, H: number) {
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, W, H, "F");
}

function drawSquaadHeader(doc: any, W: number, page: number, total: number) {
  // Tag dourada no topo esquerdo
  doc.setTextColor(...COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SQUAAD", 40, 28);
  doc.setTextColor(...COLORS.textSubtle);
  doc.setFont("helvetica", "normal");
  doc.text("·  REPROGRAME-SE 10X  ·  2026", 75, 28);
  // Página
  doc.setTextColor(...COLORS.textSubtle);
  doc.setFontSize(8);
  doc.text(`${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, W - 40, 28, { align: "right" });
  // Linha sutil
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.line(40, 38, W - 40, 38);
}

function drawSquaadFooter(doc: any, W: number, H: number) {
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.line(40, H - 38, W - 40, H - 38);
  doc.setTextColor(...COLORS.textSubtle);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Diagnóstico gerado pela IA da SQUAAD · estratégia + posicionamento + IA aplicada a negócios", W / 2, H - 24, { align: "center" });
}

function sectionTitle(doc: any, x: number, y: number, label: string, accent: [number, number, number] = COLORS.gold) {
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), x, y);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(x, y + 6, x + 28, y + 6);
}

async function generatePdf(input: PdfInput): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 595
  const H = doc.internal.pageSize.getHeight();  // 842
  const letter = dominantLetter(input.profile);
  const color = DISC_COLORS[letter] || [250, 200, 0];
  const TOTAL_PAGES = 4;

  // ════════════════════════════════════════════════════
  // PÁGINA 1: CAPA
  // ════════════════════════════════════════════════════
  paintBg(doc, W, H);
  drawSquaadHeader(doc, W, 1, TOTAL_PAGES);

  // Selo título
  doc.setTextColor(...COLORS.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DIAGNÓSTICO PERSONALIZADO", W / 2, 110, { align: "center" });
  // Linha dourada decorativa
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 30, 122, W / 2 + 30, 122);

  // Título principal (multi-linha)
  doc.setTextColor(...COLORS.textMain);
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text("DISC", W / 2, 175, { align: "center" });
  doc.setTextColor(...COLORS.gold);
  doc.setFontSize(20);
  doc.text("+ IA APLICADA", W / 2, 202, { align: "center" });

  // Foto + anel
  const photoY = 250;
  const photoSize = 130;
  const photoX = W / 2 - photoSize / 2;
  if (input.profilePicUrl) {
    const dataUrl = await fetchImageAsDataURL(input.profilePicUrl);
    if (dataUrl) {
      try { doc.addImage(dataUrl, "JPEG", photoX, photoY, photoSize, photoSize); } catch {}
    }
  }
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(3.5);
  doc.roundedRect(photoX - 5, photoY - 5, photoSize + 10, photoSize + 10, 6, 6, "S");

  // Nome
  doc.setTextColor(...COLORS.textMain);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(input.nome, W / 2, photoY + photoSize + 42, { align: "center" });
  doc.setTextColor(...COLORS.textMuted);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`@${input.instagram}`, W / 2, photoY + photoSize + 62, { align: "center" });

  // Badge DISC
  const badgeY = photoY + photoSize + 100;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(W / 2 - 55, badgeY, 110, 110, 12, 12, "F");
  doc.setTextColor(...COLORS.textMain);
  doc.setFontSize(64);
  doc.setFont("helvetica", "bold");
  doc.text(letter, W / 2, badgeY + 80, { align: "center" });

  // Label do perfil
  doc.setTextColor(...COLORS.textSubtle);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("SEU PERFIL", W / 2, badgeY + 138, { align: "center" });
  doc.setTextColor(...COLORS.textMain);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(fmtProfile(input.profile).toUpperCase(), W / 2, badgeY + 158, { align: "center" });

  drawSquaadFooter(doc, W, H);

  // ════════════════════════════════════════════════════
  // PÁGINA 2: O QUE VI + PONTOS DE MELHORIA
  // ════════════════════════════════════════════════════
  doc.addPage();
  paintBg(doc, W, H);
  drawSquaadHeader(doc, W, 2, TOTAL_PAGES);

  let y = 65;
  sectionTitle(doc, 40, y, "O que vi no seu Instagram");
  y += 22;

  // Elogio em destaque
  const elogio = input.analysis?.elogio_personalizado || "Diagnóstico personalizado SQUAAD.";
  doc.setTextColor(...COLORS.textMain);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const elogioLines = doc.splitTextToSize(elogio, W - 80);
  doc.text(elogioLines, 40, y);
  y += elogioLines.length * 14 + 22;

  // Tabela de info
  const infoH = 90;
  doc.setFillColor(...COLORS.bgPanel);
  doc.roundedRect(40, y, W - 80, infoH, 8, 8, "F");
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(40, y, W - 80, infoH, 8, 8, "S");

  const rowY = [y + 24, y + 48, y + 72];
  const labels = ["PROFISSÃO", "NICHO", "FREQUÊNCIA"];
  const values = [
    input.analysis?.profissao_inferida || "—",
    input.analysis?.nicho || "—",
    input.analysis?.frequencia || "—",
  ];
  for (let i = 0; i < 3; i++) {
    doc.setTextColor(...COLORS.textSubtle);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(labels[i], 56, rowY[i]);
    doc.setTextColor(...COLORS.textMain);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const valLines = doc.splitTextToSize(String(values[i]), W - 240);
    doc.text(valLines[0] || "", 175, rowY[i]);
  }
  y += infoH + 26;

  // Onde está deixando dinheiro na mesa
  sectionTitle(doc, 40, y, "Onde você está deixando dinheiro na mesa");
  y += 22;
  doc.setTextColor(...COLORS.textMuted);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("3 ajustes específicos identificados no seu posicionamento.", 40, y);
  y += 18;

  const pontos = (input.analysis?.pontos_melhoria || []) as { titulo: string; descricao: string }[];
  pontos.slice(0, 3).forEach((p, i) => {
    // Estima altura
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(p.titulo, W - 180);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(p.descricao, W - 180);
    const cardH = 22 + titleLines.length * 13 + descLines.length * 12 + 18;

    // Page break preventivo
    if (y + cardH > H - 60) {
      drawSquaadFooter(doc, W, H);
      doc.addPage();
      paintBg(doc, W, H);
      drawSquaadHeader(doc, W, 2, TOTAL_PAGES);
      y = 65;
      sectionTitle(doc, 40, y, "Onde você está deixando dinheiro na mesa (cont.)");
      y += 30;
    }

    // Card panel
    doc.setFillColor(...COLORS.bgPanel);
    doc.roundedRect(40, y, W - 80, cardH, 8, 8, "F");
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(40, y, W - 80, cardH, 8, 8, "S");

    // Número dourado
    doc.setFillColor(...COLORS.gold);
    doc.circle(62, y + 22, 11, "F");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(String(i + 1), 62, y + 26, { align: "center" });

    // Título
    doc.setTextColor(...COLORS.textMain);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.text(titleLines, 86, y + 22);

    // Descrição
    doc.setTextColor(...COLORS.textMuted);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.text(descLines, 86, y + 22 + titleLines.length * 13 + 8);

    y += cardH + 10;
  });

  drawSquaadFooter(doc, W, H);

  // ════════════════════════════════════════════════════
  // PÁGINA 3: PLANO DE AÇÃO 30 DIAS
  // ════════════════════════════════════════════════════
  doc.addPage();
  paintBg(doc, W, H);
  drawSquaadHeader(doc, W, 3, TOTAL_PAGES);

  y = 65;
  sectionTitle(doc, 40, y, "Plano de Ação · 30 Dias");
  y += 22;
  doc.setTextColor(...COLORS.textMuted);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("Sequência prática semanal pra colocar a estratégia no chão.", 40, y);
  y += 24;

  const plano = (input.analysis?.plano_acao || []) as { semana: string; acao: string }[];
  if (plano.length === 0) {
    doc.setTextColor(...COLORS.textMuted);
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("Plano detalhado disponível na consultoria estratégica.", 40, y + 10);
    y += 40;
  } else {
    plano.slice(0, 4).forEach((p, i) => {
      doc.setFontSize(10);
      const linesA = doc.splitTextToSize(p.acao, W - 180);
      const cardH = 26 + linesA.length * 13 + 14;

      // Page break
      if (y + cardH > H - 80) {
        drawSquaadFooter(doc, W, H);
        doc.addPage();
        paintBg(doc, W, H);
        drawSquaadHeader(doc, W, 3, TOTAL_PAGES);
        y = 65;
        sectionTitle(doc, 40, y, "Plano de Ação · 30 Dias (cont.)");
        y += 30;
      }

      // Card escuro
      doc.setFillColor(...COLORS.bgPanel);
      doc.roundedRect(40, y, W - 80, cardH, 8, 8, "F");
      doc.setDrawColor(...COLORS.gold);
      doc.setLineWidth(0.5);
      // borda esquerda destacada
      doc.line(40, y + 8, 40, y + cardH - 8);

      // Semana
      doc.setTextColor(...COLORS.gold);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(p.semana.toUpperCase(), 60, y + 22);

      // Ação
      doc.setTextColor(...COLORS.textMain);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(linesA, 60, y + 38);

      y += cardH + 10;
    });
  }

  drawSquaadFooter(doc, W, H);

  // ════════════════════════════════════════════════════
  // PÁGINA 4: DISC × IA + CASO PRÁTICO + CTA
  // ════════════════════════════════════════════════════
  doc.addPage();
  paintBg(doc, W, H);
  drawSquaadHeader(doc, W, 4, TOTAL_PAGES);

  y = 65;
  sectionTitle(doc, 40, y, "DISC × IA × Negócio", color);
  y += 22;

  const insights: Record<string, string> = {
    D: "Pessoas Dominantes que atuam em alta exigência travam em delegar tarefas repetitivas. A IA assume esses gargalos e libera você pra decisão estratégica, onde você é insubstituível.",
    I: "Influentes brilham em conexão mas perdem horas em conversas que não convertem. Agentes de IA qualificam o lead 24/7 e entregam só quem está pronto pra fechar.",
    S: "Estáveis valorizam processo. O risco é morrer na consistência sem escalar. A IA mantém a qualidade do seu atendimento idêntica 24/7 enquanto você dorme.",
    C: "Cautelosos exigem dados pra agir. A IA cruza informação que humano não consegue e entrega relatório pronto. Sua decisão vira mais rápida sem perder rigor.",
  };
  const insightText = insights[letter] || insights.D;
  doc.setTextColor(...COLORS.textMain);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const insightLines = doc.splitTextToSize(insightText, W - 80);
  doc.text(insightLines, 40, y);
  y += insightLines.length * 14 + 24;

  // Caso prático
  sectionTitle(doc, 40, y, "Caso prático pro seu negócio");
  y += 22;
  const caso = input.analysis?.caso_pratico_ia || "Aplicação de IA pra automatizar qualificação de lead 24/7 via WhatsApp.";
  doc.setFillColor(...COLORS.bgPanel);
  const casoLines = doc.splitTextToSize(caso, W - 100);
  const casoH = casoLines.length * 14 + 32;
  doc.roundedRect(40, y, W - 80, casoH, 8, 8, "F");
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(40, y, W - 80, casoH, 8, 8, "S");
  doc.setTextColor(...COLORS.textMain);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(casoLines, 56, y + 22);
  y += casoH + 30;

  // CTA grande dourado
  const ctaH = 110;
  if (y + ctaH > H - 80) y = H - 80 - ctaH;
  doc.setFillColor(...COLORS.gold);
  doc.roundedRect(40, y, W - 80, ctaH, 14, 14, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PRÓXIMO PASSO", W / 2, y + 26, { align: "center" });
  doc.setFontSize(18);
  doc.text("Bora colocar isso pra rodar?", W / 2, y + 52, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Responde aqui no WhatsApp pra a gente conversar sobre os 3 pontos.", W / 2, y + 74, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("SQUAAD · IA aplicada a negócios", W / 2, y + 94, { align: "center" });

  drawSquaadFooter(doc, W, H);

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}

// ============================================================
// UAZAPI helpers
// ============================================================
async function getConnectedInstance(supabase: any): Promise<{ id: string; instance_token: string } | null> {
  // Filtra explicitamente UAZAPI com instance_token preenchido. Sem isso,
  // pode pegar a instancia Cloud API (sem instance_token) e estourar 401.
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_token, status")
    .eq("status", "connected")
    .eq("provider", "uazapi")
    .not("instance_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

// Normaliza WhatsApp BR pro formato canônico 55+DDD+9+8 = 13 dígitos.
// Defesa em profundidade: mesmo que o lead.whatsapp tenha sido salvo errado,
// o número é consertado antes de chegar na UAZAPI.
function normPhoneBR(raw: string): string {
  let n = (raw || "").replace(/\D/g, "");
  if (!n.startsWith("55") && n.length >= 10 && n.length <= 11) n = "55" + n;
  if (n.startsWith("55") && n.length === 12) n = n.slice(0, 4) + "9" + n.slice(4);
  return n;
}

async function uaSendText(instance_token: string, number: string, text: string) {
  const cleanNumber = normPhoneBR(number);
  const res = await fetch("https://squaad.uazapi.com/send/text", {
    method: "POST",
    headers: { "Content-Type": "application/json", token: instance_token },
    body: JSON.stringify({ number: cleanNumber, text }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`UAZAPI send/text ${res.status}: ${t.slice(0, 120)}`);
  }
  return res.json();
}

async function uaSendDocument(
  instance_token: string,
  number: string,
  pdfBytes: Uint8Array,
  docName: string,
  caption?: string,
) {
  // UAZAPI aceita base64 no campo `file`
  let bin = "";
  for (let i = 0; i < pdfBytes.byteLength; i++) bin += String.fromCharCode(pdfBytes[i]);
  const b64 = btoa(bin);

  const cleanNumber = normPhoneBR(number);
  const res = await fetch("https://squaad.uazapi.com/send/media", {
    method: "POST",
    headers: { "Content-Type": "application/json", token: instance_token },
    body: JSON.stringify({
      number: cleanNumber,
      type: "document",
      file: `data:application/pdf;base64,${b64}`,
      docName,
      text: caption || "",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`UAZAPI send/media ${res.status}: ${t.slice(0, 120)}`);
  }
  return res.json();
}

// ============================================================
// MAIN
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const leadId = String(body.lead_id || "");
    const forceRetry = body.retry === true;
    // queue_only=true: so registra como 'queued', sem disparar worker.
    // Usado pelo frontend quando o lead clica "Receber Diagnostico" pra que
    // o PDF seja entregue depois (via webhook auto-trigger quando ele mandar
    // a msg, ou via fallback cron se ele nao mandar em 15+ min). Anti-ban.
    const queueOnly = body.queue_only === true;
    if (!leadId) {
      return new Response(JSON.stringify({ success: false, error: "lead_id_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca request (upsert: se já existe pending/processing/sent, retorna)
    // Exceto se retry=true (reenvio manual via painel LeadDetailModal) — aí força.
    const { data: existing } = await (supabase as any)
      .from("disc_pdf_requests")
      .select("status, sent_at")
      .eq("lead_id", leadId)
      .maybeSingle();

    if (!forceRetry && existing && (existing.status === "sent" || existing.status === "processing")) {
      return new Response(JSON.stringify({
        success: true,
        already: existing.status,
        sent_at: existing.sent_at,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // queue_only: so registra/atualiza pra 'queued' e retorna. Nao starta worker.
    if (queueOnly) {
      if (existing) {
        // So move pra queued se ainda nao estiver pending/processing/sent
        if (existing.status !== "pending" && existing.status !== "processing" && existing.status !== "sent") {
          await (supabase as any)
            .from("disc_pdf_requests")
            .update({ status: "queued", updated_at: new Date().toISOString() })
            .eq("lead_id", leadId);
        }
      } else {
        await (supabase as any)
          .from("disc_pdf_requests")
          .insert({ lead_id: leadId, status: "queued" });
      }
      return new Response(JSON.stringify({ success: true, queued: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existing) {
      await (supabase as any)
        .from("disc_pdf_requests")
        .update({ status: "pending", attempts: 0, error_msg: null, updated_at: new Date().toISOString() })
        .eq("lead_id", leadId);
    } else {
      await (supabase as any)
        .from("disc_pdf_requests")
        .insert({ lead_id: leadId, status: "pending" });
    }

    // Dispara o worker async (fire-and-forget, mas a edge function PRECISA esperar
    // pra Deno não matar o handler — usamos EdgeRuntime.waitUntil quando disponível)
    const worker = (async () => {
      const log = (m: string) => console.log(`[pdf-deliver lead=${leadId}]`, m);
      try {
        // Marca processing
        await (supabase as any)
          .from("disc_pdf_requests")
          .update({ status: "processing", attempts: 1, updated_at: new Date().toISOString() })
          .eq("lead_id", leadId);

        // Throttle global: espera vaga
        for (let i = 0; i < 60; i++) {
          if (await checkAndReserveSlot(supabase)) break;
          await delay(5000);
        }

        // Queue position delay: espaca envios em eventos ao vivo
        const { count: queueAhead } = await (supabase as any)
          .from("disc_pdf_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "processing")
          .lt("requested_at", new Date().toISOString());
        const queueDelay = Math.min((queueAhead ?? 0) * 12000, 180000);
        if (queueDelay > 0) {
          log(`fila: ${queueAhead} na frente, delay extra ${queueDelay}ms`);
          await delay(queueDelay);
        }

        // Delay humano inicial
        const initialDelay = randomBetween(8000, 18000);
        log(`humano delay ${initialDelay}ms`);
        await delay(initialDelay);

        // Busca lead
        const { data: lead, error: leadErr } = await (supabase as any)
          .from("crm_leads")
          .select("id, name, whatsapp, instagram, instagram_profile_pic_url, disc_profile, ai_analysis")
          .eq("id", leadId)
          .maybeSingle();
        if (leadErr || !lead) throw new Error("lead_not_found");
        if (!lead.disc_profile) throw new Error("disc_not_completed");

        // Instância WhatsApp
        const instance = await getConnectedInstance(supabase);
        if (!instance) throw new Error("no_connected_whatsapp_instance");

        // SAFEGUARD anti-bloqueio Meta: gate por instância antes do envio
        const { data: gate } = await (supabase as any).rpc("wa_can_send_now", { p_instance_id: instance.id });
        if (!gate?.can) {
          log(`pulando envio: rate limit/frozen — ${JSON.stringify(gate)}`);
          await (supabase as any)
            .from("disc_pdf_requests")
            .update({ status: "pending", error_msg: `gate_blocked: ${gate?.reason}`, updated_at: new Date().toISOString() })
            .eq("lead_id", leadId);
          return; // sai do worker, próximo run pode tentar
        }

        const primeiroNome = (lead.name || "").split(" ")[0] || "amigo(a)";
        const nicho = lead.ai_analysis?.nicho || "seu nicho";
        const profileFmt = fmtProfile(lead.disc_profile);

        // Compõe mensagem variada
        const g = pickRandom(GREETING_TEMPLATES);
        const ins = pickRandom(INSIGHT_TEMPLATES);
        const c = pickRandom(CLOSING_TEMPLATES);

        const messageText =
          `${g.item(primeiroNome)}\n\n` +
          `${ins.item(profileFmt, nicho)}\n\n` +
          `${c.item}`;

        log(`enviando texto (g=${g.index} ins=${ins.index} c=${c.index})`);
        await uaSendText(instance.instance_token, lead.whatsapp, messageText);

        // Salva qual variante usou (telemetria)
        await (supabase as any)
          .from("disc_pdf_requests")
          .update({ message_variant: g.index })
          .eq("lead_id", leadId);

        // Pausa humana entre texto e PDF
        await delay(randomBetween(3000, 5500));

        // Gera PDF
        log("gerando PDF");
        const pdfBytes = await generatePdf({
          nome: lead.name,
          instagram: lead.instagram || "",
          profile: lead.disc_profile,
          analysis: lead.ai_analysis,
          profilePicUrl: lead.instagram_profile_pic_url,
        });
        log(`PDF gerado: ${pdfBytes.length} bytes`);

        await uaSendDocument(
          instance.instance_token,
          lead.whatsapp,
          pdfBytes,
          `Diagnostico-DISC-${primeiroNome}.pdf`,
          `Teu diagnóstico, ${primeiroNome} 📄`,
        );

        await (supabase as any)
          .from("disc_pdf_requests")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("lead_id", leadId);
        log("entregue com sucesso");
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[pdf-deliver lead=${leadId}] failed:`, msg);
        await (supabase as any)
          .from("disc_pdf_requests")
          .update({
            status: "failed",
            error_msg: msg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("lead_id", leadId);
      }
    })();

    // Deno edge: waitUntil mantém worker rodando após o response
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      (EdgeRuntime as any).waitUntil(worker);
    } else {
      // fallback: aguarda mesmo (não ideal pq cliente espera, mas garante execução)
      // não awaitar mata o handler em alguns ambientes
      worker.catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, queued: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[disc-pdf-deliver] fatal:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
