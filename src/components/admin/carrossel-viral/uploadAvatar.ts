// Upload de avatar/logo pra bucket carousel-images.
// Retorna URL pública pronta pra usar nos templates (sem CORS porque mesma origem).
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'carousel-images';

function randomId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^(png|jpg|jpeg|webp|gif)$/.test(fromName)) return fromName;
  if (file.type.includes('png')) return 'png';
  if (file.type.includes('webp')) return 'webp';
  return 'jpg';
}

export async function uploadCarouselAsset(
  file: File,
  prefix: 'avatars' | 'logos',
): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Arquivo muito grande (max 5MB)');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Apenas imagens são aceitas');
  }

  const path = `${prefix}/${randomId()}-${Date.now()}.${extFromFile(file)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
