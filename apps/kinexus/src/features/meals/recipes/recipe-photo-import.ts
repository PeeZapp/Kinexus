import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/src/lib/supabase';

const BUCKET = 'recipe-images';
const MAX_BYTES = 5_242_880;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BANK_LONG_EDGE = 1600;
const BANK_JPEG_QUALITY = 0.7;

export type RecipePhotoFile = {
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileName: string;
  previewUrl: string;
};

export type BankScreenshotPayload = {
  mime: 'image/jpeg';
  base64: string;
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

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
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

async function fromPickerAsset(asset: DocumentPicker.DocumentPickerAsset): Promise<RecipePhotoFile> {
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
    return fromPickerAsset(result.assets[0]);
  })();
}

/** Multi-select image picker (up to `maxCount`) for bank screenshots and similar flows. */
export function pickRecipePhotos(maxCount = 6): Promise<RecipePhotoFile[]> {
  const limit = Math.max(1, Math.min(6, maxCount));
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
      input.multiple = true;
      input.onchange = () => {
        const files = [...(input.files ?? [])].slice(0, limit);
        if (files.length === 0) {
          resolve([]);
          return;
        }
        void Promise.all(files.map((file) => fromWebFile(file)))
          .then(resolve)
          .catch(reject);
      };
      input.click();
    });
  }

  return (async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled || !result.assets?.length) return [];
    const assets = result.assets.slice(0, limit);
    return Promise.all(assets.map((asset) => fromPickerAsset(asset)));
  })();
}

async function resizeBankScreenshotWeb(file: RecipePhotoFile): Promise<BankScreenshotPayload> {
  const blob = new Blob([Uint8Array.from(file.bytes)], { type: file.contentType });
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, BANK_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not resize that screenshot');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', BANK_JPEG_QUALITY);
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  return { mime: 'image/jpeg', base64 };
}

async function resizeBankScreenshotNative(file: RecipePhotoFile): Promise<BankScreenshotPayload> {
  const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!cacheDir) throw new Error('Could not resize that screenshot');
  const tempUri = `${cacheDir}bank-shot-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`;
  const sourceBase64 = bytesToBase64(file.bytes);
  await FileSystem.writeAsStringAsync(tempUri, sourceBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  try {
    const sized = await ImageManipulator.manipulateAsync(tempUri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const longEdge = Math.max(sized.width, sized.height);
    const actions =
      longEdge > BANK_LONG_EDGE
        ? [
            {
              resize:
                sized.width >= sized.height ? { width: BANK_LONG_EDGE } : { height: BANK_LONG_EDGE },
            },
          ]
        : [];
    const manipulated = await ImageManipulator.manipulateAsync(sized.uri, actions, {
      compress: BANK_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!manipulated.base64) throw new Error('Could not resize that screenshot');
    return { mime: 'image/jpeg', base64: manipulated.base64 };
  } finally {
    void FileSystem.deleteAsync(tempUri, { idempotent: true });
  }
}

/** Resize each screenshot (long edge ≤1600, JPEG ~0.7) for inline base64 POST. Never uploads. */
export async function prepareBankScreenshots(files: readonly RecipePhotoFile[]): Promise<BankScreenshotPayload[]> {
  const out: BankScreenshotPayload[] = [];
  for (const file of files) {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      out.push(await resizeBankScreenshotWeb(file));
    } else {
      out.push(await resizeBankScreenshotNative(file));
    }
  }
  return out;
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
