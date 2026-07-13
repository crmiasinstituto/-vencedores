// Upload pro Backblaze B2 via presigned URL (mesma infra das aulas/aceleradores).
// Aguenta arquivos grandes (video bruto, ZIP) sem o limite/egress do Supabase
// Storage. A edge create-b2-upload-url assina o PUT; o browser faz o PUT direto
// no bucket e recebemos a URL publica final.
import { supabase } from '@/integrations/supabase/client';

export function fileTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xlsx';
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'slide';
  if (['zip', 'rar', '7z'].includes(ext)) return 'zip';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext)) return 'audio';
  return ext || 'file';
}

export function humanFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export interface B2UploadResult {
  public_url: string;
  key: string;
}

// Sobe um arquivo pro B2 sob o prefixo informado. Retorna URL publica + key,
// ou null em erro (o chamador exibe o toast).
export async function uploadToB2(
  file: File,
  prefix: string,
  onProgress?: (pct: number) => void
): Promise<B2UploadResult | null> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${prefix.replace(/\/+$/, '')}/${Date.now()}-${safe}`;
  const contentType = file.type || 'application/octet-stream';

  const { data: sign, error: signErr } = await supabase.functions.invoke(
    'create-b2-upload-url',
    { body: { key, contentType, expiresIn: '7200' } }
  );
  if (signErr || !sign?.upload_url) {
    throw new Error(sign?.error || signErr?.message || 'Falha ao assinar upload');
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sign.upload_url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error('erro de rede'));
    xhr.send(file);
  });

  return { public_url: sign.public_url as string, key: sign.key as string };
}
