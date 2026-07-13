import jsPDF from 'jspdf';
import squaadLogo from '@/assets/squaad-logo.jpeg';

// PDF no padrao + que Vencedores (preto + dourado #3B82F6): capa + painel do Instagram + documento.
type RGB = [number, number, number];
const GOLD: RGB = [250, 200, 0];
const BG: RGB = [12, 12, 14];
const PANEL: RGB = [24, 24, 28];
const WHITE: RGB = [238, 238, 240];
const GRAY: RGB = [150, 150, 158];

export type IgData = {
  handle: string; fullName: string; biography: string; bioLink: string;
  verified: boolean; professional: boolean; avatar: string;
  followers: number; following: number; postsTotal: number; highlights: number;
  posts30d: number; engagementPct: number; lastPostDays: number;
  mix: { foto: number; reel: number; carousel: number };
  posts: { type: string; caption: string; date: string; likes: number; comments: number }[];
  score: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const fmtN = (n: number) => String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// jsPDF (Helvetica) so renderiza Latin-1. Converte letras estilizadas (unicode
// matematico) pra ASCII e remove emojis, mantendo acentos do portugues.
const clean = (s: string) => String(s || '').normalize('NFKD').normalize('NFC').replace(/[^\x00-\xFF]/g, '').replace(/[ \t]+/g, ' ');

export async function generateEventPDF(eventName: string, markdown: string, ig?: IgData | null) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = 595, H = 842, M = 50;
  const maxW = W - M * 2;
  const BOTTOM = H - 68;
  let y = 0, page = 1;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const txt = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const paintBg = () => { fill(BG); doc.rect(0, 0, W, H, 'F'); fill(GOLD); doc.rect(W - 7, 0, 7, H, 'F'); };
  const footer = (n: number) => {
    stroke(GOLD); doc.setLineWidth(0.5); doc.line(M, H - 40, W - M - 12, H - 40);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); txt(GRAY);
    doc.text('Metodo + que Vencedores', M, H - 26); doc.text(String(n), W - M - 12, H - 26, { align: 'right' });
  };
  const newPage = () => { doc.addPage(); page++; paintBg(); footer(page); y = M + 8; };
  const ensure = (need: number) => { if (y + need > BOTTOM) newPage(); };

  // ---------- CAPA ----------
  paintBg();
  let logo: HTMLImageElement | null = null;
  try { logo = await loadImage(squaadLogo); } catch (_) { /* segue */ }
  if (logo) doc.addImage(logo, 'JPEG', M, 70, 150, 150 * (logo.naturalHeight / logo.naturalWidth));
  doc.setFont('helvetica', 'bold'); txt(GOLD); doc.setFontSize(10);
  doc.text('ESTRUTURA ESTRATEGICA DE EVENTO', M, 205);
  txt(WHITE); doc.setFontSize(32);
  const titleLines = doc.splitTextToSize(eventName || 'Meu Evento', maxW - 12);
  doc.text(titleLines, M, 250);
  const afterTitle = 250 + titleLines.length * 34;
  stroke(GOLD); doc.setLineWidth(4); doc.line(M, afterTitle, M + 80, afterTitle);
  doc.setFont('helvetica', 'normal'); txt(GRAY); doc.setFontSize(12);
  doc.text('Documento estrategico gerado pelo metodo dos Eventos ISCA', M, afterTitle + 34);
  doc.text('Captura, retem e converte audiencia em cliente.', M, afterTitle + 52);
  fill(GOLD); doc.rect(0, H - 70, W, 44, 'F');
  txt(BG); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('metodo squaad', M, H - 43);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('eventos que transformam audiencia em cliente', W - M - 12, H - 43, { align: 'right' });

  // ---------- PAINEL DO INSTAGRAM ----------
  if (ig && (ig.followers || ig.posts.length)) {
    newPage();
    // header
    doc.setFont('helvetica', 'bold'); txt(GOLD); doc.setFontSize(9);
    doc.text('RAIO-X DO PALESTRANTE', M, y + 6);
    txt(WHITE); doc.setFontSize(18); doc.text('Seu Instagram no palco', M, y + 30);
    stroke(GOLD); doc.setLineWidth(2); doc.line(M, y + 40, M + 60, y + 40);
    y += 60;

    // painel de perfil
    const ph = 118;
    fill(PANEL); stroke([60, 55, 20]); doc.setLineWidth(1);
    doc.roundedRect(M, y, maxW, ph, 8, 8, 'FD');
    // avatar
    if (ig.avatar) {
      try { doc.addImage(ig.avatar, 'JPEG', M + 16, y + 16, 72, 72); } catch (_) { /* sem foto */ }
      stroke(GOLD); doc.setLineWidth(1.5); doc.roundedRect(M + 16, y + 16, 72, 72, 6, 6, 'S');
    }
    const x0 = M + 16 + 72 + 16;
    txt(GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('@' + ig.handle, x0, y + 30);
    // badges
    let bx = x0;
    const pill = (label: string) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      const w = doc.getTextWidth(label) + 14;
      stroke(GOLD); fill([40, 34, 6]); doc.roundedRect(bx, y + 38, w, 14, 3, 3, 'FD');
      txt(GOLD); doc.text(label, bx + 7, y + 47.5); bx += w + 6;
    };
    if (ig.verified) pill('VERIFICADO');
    if (ig.professional) pill('PROFISSIONAL');
    txt(WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(doc.splitTextToSize(clean(ig.fullName), maxW - 210)[0] || '', x0, y + 68);
    txt(GRAY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.splitTextToSize(clean(ig.biography), maxW - 220).slice(0, 2).forEach((l: string, i: number) => doc.text(l, x0, y + 82 + i * 11));
    if (ig.bioLink) { txt(GOLD); doc.setFontSize(8); doc.text('link: ' + ig.bioLink.replace(/^https?:\/\//, '').slice(0, 40), x0, y + 106); }
    // score badge
    const sb = 56, sx = M + maxW - sb - 14, sy = y + 16;
    fill(GOLD); doc.roundedRect(sx, sy, sb, sb, 8, 8, 'F');
    txt(BG); doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.text(String(ig.score), sx + sb / 2, sy + 34, { align: 'center' });
    doc.setFontSize(9); doc.text('/10', sx + sb / 2, sy + 47, { align: 'center' });
    y += ph + 16;

    // grid de stats (3 col x 2)
    const gap = 10, cw = (maxW - gap * 2) / 3, ch = 48;
    const ultimo = ig.lastPostDays < 0 ? 'n/d' : ig.lastPostDays === 0 ? 'hoje' : `ha ${ig.lastPostDays}d`;
    const cards: [string, string, RGB][] = [
      ['Seguidores', fmtN(ig.followers), WHITE],
      ['Posts totais', fmtN(ig.postsTotal), WHITE],
      ['Posts ult. 30d', String(ig.posts30d), WHITE],
      ['Engajamento', String(ig.engagementPct).replace('.', ',') + '%', ig.engagementPct >= 1 ? [34, 197, 94] : GOLD],
      ['Highlights', String(ig.highlights), WHITE],
      ['Ultimo post', ultimo, WHITE],
    ];
    cards.forEach((c, i) => {
      const cx = M + (i % 3) * (cw + gap), cy = y + Math.floor(i / 3) * (ch + gap);
      fill(PANEL); doc.roundedRect(cx, cy, cw, ch, 5, 5, 'F');
      txt(GRAY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(c[0].toUpperCase(), cx + 10, cy + 16);
      txt(c[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(c[1], cx + 10, cy + 37);
    });
    y += ch * 2 + gap + 20;

    // mix de conteudo
    txt(GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Mix de conteudo', M, y); y += 16;
    const bars: [string, number][] = [['Reels', ig.mix.reel], ['Carrossel', ig.mix.carousel], ['Foto', ig.mix.foto]];
    const trackX = M + 90, trackW = maxW - 90 - 50;
    bars.forEach(([label, pctv]) => {
      txt(WHITE); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(label, M, y + 8);
      fill([40, 40, 46]); doc.roundedRect(trackX, y, trackW, 9, 4, 4, 'F');
      if (pctv > 0) { fill(GOLD); doc.roundedRect(trackX, y, Math.max(6, trackW * pctv / 100), 9, 4, 4, 'F'); }
      txt(GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(pctv + '%', M + maxW, y + 8, { align: 'right' });
      y += 20;
    });
    y += 10;

    // ultimos posts
    if (ig.posts.length) {
      txt(GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Ultimos posts analisados', M, y); y += 16;
      ig.posts.slice(0, 4).forEach((p) => {
        ensure(30);
        txt(GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.text(p.type.toUpperCase(), M, y + 8);
        txt(GRAY); doc.setFont('helvetica', 'normal'); doc.text(`${p.date}  ${p.likes} likes ${p.comments} com.`, M + 60, y + 8);
        txt(WHITE); doc.setFontSize(9);
        const cap = doc.splitTextToSize(clean(p.caption) || '(sem legenda)', maxW)[0];
        doc.text(cap, M, y + 20); y += 30;
      });
    }
  }

  // ---------- CONTEUDO ----------
  newPage();
  for (const raw of markdown.split('\n')) {
    const l = clean(raw.replace(/\t/g, '  ')).trimEnd();
    if (/^#\s+/.test(l)) continue;
    if (/^\s*\|/.test(l)) {
      if (/^\s*\|[\s:|-]+\|?\s*$/.test(l)) continue;
      const cells = l.split('|').map((c) => c.trim()).filter(Boolean).join('   |   ').replace(/\*\*/g, '');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); txt(WHITE);
      for (const tl of doc.splitTextToSize(cells, maxW)) { ensure(13); doc.text(tl, M, y); y += 13; }
      continue;
    }
    if (/^##\s+/.test(l)) {
      const t = l.replace(/^##\s+/, '').replace(/\*\*/g, '');
      ensure(48); y += 14;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); txt(GOLD);
      for (const tl of doc.splitTextToSize(t, maxW)) { ensure(20); doc.text(tl, M, y); y += 20; }
      stroke(GOLD); doc.setLineWidth(1.5); doc.line(M, y - 8, M + 40, y - 8); y += 8;
      continue;
    }
    if (/^###\s+/.test(l)) {
      const t = l.replace(/^###\s+/, '').replace(/\*\*/g, '');
      ensure(28); y += 8;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); txt(WHITE);
      for (const tl of doc.splitTextToSize(t, maxW)) { ensure(16); doc.text(tl, M, y); y += 16; }
      y += 3; continue;
    }
    if (/^[-*]\s+/.test(l)) {
      const t = l.replace(/^[-*]\s+/, '').replace(/\*\*/g, '');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(t, maxW - 16);
      wrapped.forEach((w: string, i: number) => { ensure(13); if (i === 0) { txt(GOLD); doc.text('-', M, y); } txt(WHITE); doc.text(w, M + 14, y); y += 13; });
      y += 2; continue;
    }
    if (l.trim() === '' || /^---+$/.test(l.trim())) { y += 6; continue; }
    doc.setFontSize(10);
    const bold = l.match(/^\*\*(.+?)\*\*[:：]?\s*(.*)$/);
    if (bold) {
      const label = bold[1].replace(/\*\*/g, '') + ':';
      ensure(14); doc.setFont('helvetica', 'bold'); txt(GOLD); doc.text(label, M, y);
      const lw = doc.getTextWidth(label + ' ');
      doc.setFont('helvetica', 'normal'); txt(WHITE);
      const rest = bold[2].replace(/\*\*/g, '');
      const first = doc.splitTextToSize(rest, maxW - lw);
      if (first.length) doc.text(first[0], M + lw, y);
      y += 14;
      for (let i = 1; i < first.length; i++) { ensure(13); doc.text(first[i], M, y); y += 13; }
      y += 3; continue;
    }
    doc.setFont('helvetica', 'normal'); txt(WHITE);
    const wrapped = doc.splitTextToSize(l.replace(/\*\*/g, ''), maxW);
    for (const tl of wrapped) { ensure(13); doc.text(tl, M, y); y += 13; }
    y += 3;
  }

  doc.save(`${(eventName || 'evento').replace(/\s+/g, '-').toLowerCase()}-squaad.pdf`);
}
