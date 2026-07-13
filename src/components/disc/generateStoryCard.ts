// Gera o card "EU FUI · Reprograme-se 10X" em PNG 1080x1920 (formato Stories).
// Layout premium centralizado com foto do lead, perfil DISC e logo + que Vencedores.
// Usa Canvas API nativa, sem dependência extra.

const DISC_COLORS: Record<string, string> = {
  D: "#EF4444",
  I: "#F59E0B",
  S: "#10B981",
  C: "#3B82F6",
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

function profileLabel(profile: string): string {
  if (profile.includes("-")) {
    const [a, b] = profile.split("-").map((s) => s.toUpperCase());
    return `${DISC_LABELS[a] || a} · ${DISC_LABELS[b] || b}`;
  }
  return DISC_LABELS[profile.toUpperCase()] || profile;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "?";
}

export interface StoryCardData {
  nome: string;
  profile: string;
  profilePicUrl: string | null;
  instagramHandle: string;
}

export async function generateStoryCard(data: StoryCardData): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context indisponível");

  const letter = dominantLetter(data.profile);
  const color = DISC_COLORS[letter] || "#3B82F6";
  const label = profileLabel(data.profile).toUpperCase();
  const cx = W / 2;

  // === 1. Fundo gradiente ===
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#09090b");
  bg.addColorStop(0.55, "#18181b");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow dourado central
  const glow = ctx.createRadialGradient(cx, H * 0.5, 30, cx, H * 0.5, 900);
  glow.addColorStop(0, "rgba(250,200,0,0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // === 2. Header: logo + que Vencedores ===
  const logo = await loadImage("/squaad-logo.png");
  const logoTopY = 140;
  const logoMaxH = 90;
  if (logo) {
    const ratio = logo.width / logo.height;
    const lh = logoMaxH;
    const lw = lh * ratio;
    ctx.drawImage(logo, cx - lw / 2, logoTopY, lw, lh);
  } else {
    // fallback texto
    ctx.fillStyle = "#3B82F6";
    ctx.font = "900 56px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("+ que Vencedores", cx, logoTopY + 70);
  }

  // Linha decorativa dourada
  const lineY = logoTopY + logoMaxH + 55;
  ctx.fillStyle = "rgba(250,200,0,0.5)";
  ctx.fillRect(cx - 60, lineY, 120, 2);

  // === 3. Selo "EU FUI" ===
  ctx.fillStyle = "#3B82F6";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 28px 'Inter', system-ui, sans-serif";
  // tracking simulado: desenhar letra a letra
  const euFuiText = "EU FUI AO";
  ctx.letterSpacing = "10px";
  ctx.fillText(euFuiText, cx, lineY + 70);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 88px 'Inter', system-ui, sans-serif";
  ctx.fillText("REPROGRAME-SE", cx, lineY + 175);
  ctx.fillStyle = color;
  ctx.font = "900 200px 'Inter', system-ui, sans-serif";
  ctx.fillText("10X", cx, lineY + 365);

  // === 4. Foto do lead (centralizada) ===
  const photoCenterY = H * 0.68;
  const photoRadius = 230;

  // Glow circular atrás da foto
  const photoGlow = ctx.createRadialGradient(cx, photoCenterY, photoRadius * 0.8, cx, photoCenterY, photoRadius * 1.8);
  photoGlow.addColorStop(0, `${color}40`);
  photoGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = photoGlow;
  ctx.fillRect(0, 0, W, H);

  // Foto em círculo
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, photoCenterY, photoRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  let img: HTMLImageElement | null = null;
  if (data.profilePicUrl) img = await loadImage(data.profilePicUrl);
  if (img) {
    ctx.drawImage(img, cx - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(cx - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 180px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(data.nome), cx, photoCenterY);
  }
  ctx.restore();

  // Anel duplo ao redor da foto
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, photoCenterY, photoRadius + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, photoCenterY, photoRadius + 22, 0, Math.PI * 2);
  ctx.stroke();

  // === 5. Badge DISC fixo no canto da foto ===
  const badgeCx = cx + photoRadius * 0.78;
  const badgeCy = photoCenterY + photoRadius * 0.78;
  // sombra
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, 78, 0, Math.PI * 2);
  ctx.stroke();
  // letra
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 86px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, badgeCx, badgeCy + 4);

  // === 6. Label do perfil (abaixo da foto) ===
  const labelY = photoCenterY + photoRadius + 100;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 22px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "6px";
  ctx.fillText("MEU PERFIL DISC", cx, labelY);

  ctx.fillStyle = color;
  ctx.font = "800 56px 'Inter', system-ui, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText(label, cx, labelY + 70);

  // === 7. Rodapé: handle + hashtag ===
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 28px 'Inter', system-ui, sans-serif";
  ctx.fillText(`@${data.instagramHandle}`, cx, H - 130);

  ctx.fillStyle = "#3B82F6";
  ctx.font = "700 32px 'Inter', system-ui, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("#REPROGRAME10X", cx, H - 75);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha ao gerar PNG"));
    }, "image/png", 0.95);
  });
}

export async function shareStoryCard(data: StoryCardData): Promise<"shared" | "downloaded" | "error"> {
  try {
    const blob = await generateStoryCard(data);
    const file = new File([blob], "eu-fui-reprograme10x.png", { type: "image/png" });

    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({
        files: [file],
        title: "EU FUI · Reprograme-se 10X",
        text: `Acabei de descobrir meu perfil DISC no Reprograme-se 10X! #Reprograme10X`,
      });
      return "shared";
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eu-fui-reprograme10x.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "downloaded";
  } catch (e) {
    console.error("[story-card]", e);
    return "error";
  }
}
