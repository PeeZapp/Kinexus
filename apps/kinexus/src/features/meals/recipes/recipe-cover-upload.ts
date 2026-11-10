import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

const BUCKET = 'recipe-images';
const MAX_BYTES = 5_242_880;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function pickRecipeCoverFile(): Promise<File | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export async function uploadRecipeCover(householdId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const contentType = ALLOWED.has(file.type)
    ? file.type
    : file.name.toLowerCase().endsWith('.png')
      ? 'image/png'
      : file.name.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
  if (!ALLOWED.has(contentType)) throw new Error('Use a JPEG, PNG, or WebP photo');
  if (file.size > MAX_BYTES) throw new Error('Image must be under 5 MB');
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${householdId}/pending/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data.publicUrl.startsWith('https://')) throw new Error('Public URL was not https');
  return data.publicUrl;
}
