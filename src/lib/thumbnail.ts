// Gera miniatura (JPEG ~480px) no proprio browser pra fotos e videos, pra
// identificacao visual rapida no acervo sem carregar o arquivo cheio (um
// video/foto bruto pode ter dezenas de MB).
//
// Dois caminhos:
//  - generateThumbnail(File): a partir do arquivo local, no momento do upload
//    (nao depende de CORS).
//  - generateThumbnailFromUrl(url): a partir do arquivo ja no B2 (backfill dos
//    antigos). Usa crossOrigin=anonymous; o bucket libera GET pro nosso origin
//    (ver b2-setup-cors), entao o canvas nao fica "tainted".
//
// Sempre best-effort: retorna null pra tipos sem preview (pdf, zip) ou se a
// decodificacao/CORS falhar. O chamador cai no icone do tipo.

const MAX = 480;

function scaleDims(w: number, h: number): { w: number; h: number } {
  if (!w || !h) return { w: MAX, h: MAX };
  const ratio = Math.min(1, MAX / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * ratio)), h: Math.max(1, Math.round(h * ratio)) };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.82));
}

// Desenha um elemento decodificado (ImageBitmap/HTMLImageElement/HTMLVideoElement)
// num canvas reduzido e devolve o JPEG. Retorna null se o canvas estiver tainted.
function drawToBlob(el: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  try {
    const { w: dw, h: dh } = scaleDims(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = dw; canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(el, 0, 0, dw, dh);
    return canvasToBlob(canvas);
  } catch {
    return Promise.resolve(null);
  }
}

async function imageThumbFromFile(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const blob = await drawToBlob(bitmap, bitmap.width, bitmap.height);
    bitmap.close?.();
    return blob;
  } catch {
    return null;
  }
}

function imageThumbFromUrl(url: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => drawToBlob(img, img.naturalWidth, img.naturalHeight).then(resolve);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Captura um frame um pouco a frente (evita o preto do comeco) de um video,
// seja a partir de um File (objectURL) ou de uma URL ja no B2.
function videoThumb(src: { file?: File; url?: string }): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const objectUrl = src.file ? URL.createObjectURL(src.file) : null;
    const finish = (b: Blob | null) => {
      if (settled) return;
      settled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(b);
    };
    const video = document.createElement('video');
    if (src.url) video.crossOrigin = 'anonymous';
    video.muted = true;
    (video as any).playsInline = true;
    video.preload = 'metadata';

    const grab = () => {
      drawToBlob(video, video.videoWidth, video.videoHeight).then(finish);
    };
    video.onloadeddata = () => {
      try { video.currentTime = Math.min(1, (video.duration || 2) / 2); }
      catch { grab(); }
    };
    video.onseeked = grab;
    video.onerror = () => finish(null);
    // failsafe: codec que o browser nao decodifica
    setTimeout(() => finish(null), 15000);

    video.src = objectUrl || src.url!;
  });
}

export async function generateThumbnail(file: File): Promise<Blob | null> {
  const type = file.type || '';
  if (type.startsWith('image/')) return imageThumbFromFile(file);
  if (type.startsWith('video/')) return videoThumb({ file });
  return null;
}

export async function generateThumbnailFromUrl(url: string, fileType: string | null): Promise<Blob | null> {
  if (fileType === 'image') return imageThumbFromUrl(url);
  if (fileType === 'video') return videoThumb({ url });
  return null;
}
