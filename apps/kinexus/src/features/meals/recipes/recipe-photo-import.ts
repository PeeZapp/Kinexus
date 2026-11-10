import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/src/lib/supabase';

const BUCKET = 'recipe-images';
const MAX_BYTES = 5_242_880;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type RecipePhotoFile = {
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileName: string;
  previewUrl: string;
};

function contentTypeFor(name: string, mime: string | null | undefined): RecipePhotoFile['contentType'] | null {
  const lower = (mime || '').toLowerCase();
  if (ALLOWED.has(lower)) return lower as RecipePhotoFile['contentType'];
  const file = name.toLowerCase();
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function revokePreview(url: string | null | undefined) {
  if (!url || Platform.OS !== 'web' || typeof URL === 'undefined') return;
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function releaseRecipePhotoPreview(file: RecipePhotoFile | null | undefined) {
  revokePreview(file?.previewUrl);
}

async function fromWebFile(file: File): Promise<RecipePhotoFile> {
  const contentType = contentTypeFor(file.name, file.type);
  if (!contentType) throw new Error('Use a JPEG, PNG, or WebP photo');
  if (file.size > MAX_BYTES) throw new Error('Image must be under 5 MB');
  const buffer = await file.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    contentType,
    fileName: file.name || `recipe.${contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'}`,
    previewUrl: URL.createObjectURL(file),
  };
}

export function pickRecipePhoto(): Promise<RecipePhotoFile | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        void fromWebFile(file).then(resolve).catch(reject);
      };
      input.click();
    });
  }

  return (async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const fileName = asset.name || 'recipe.jpg';
    const contentType = contentTypeFor(fileName, asset.mimeType);
    if (!contentType) throw new Error('Use a JPEG, PNG, or WebP photo');
    if (asset.size != null && asset.size > MAX_BYTES) throw new Error('Image must be under 5 MB');
    if (Platform.OS === 'web' && asset.file) return fromWebFile(asset.file);
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64ToBytes(base64);
    if (bytes.byteLength > MAX_BYTES) throw new Error('Image must be under 5 MB');
    return {
      bytes,
      contentType,
      fileName,
      previewUrl: asset.uri,
    };
  })();
}

export async function uploadRecipePhoto(householdId: string, file: RecipePhotoFile): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const ext = file.contentType === 'image/png' ? 'png' : file.contentType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${householdId}/pending/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file.bytes, {
    contentType: file.contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data.publicUrl.startsWith('https://')) throw new Error('Public URL was not https');
  return data.publicUrl;
}
