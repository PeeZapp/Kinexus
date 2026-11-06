import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import type { BuiltExport } from '@kinexus/domain';

export type PickedListFile = {
  fileName: string;
  mimeType: string | null;
  text: string | null;
  bytes: Uint8Array | null;
};

const ACCEPT = [
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.csv',
  '.tsv',
  '.txt',
  '.json',
  '.xlsx',
  '.xls',
  '.docx',
  '.zip',
];

function base64ToBytes(base64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(binary, 'binary').toString('base64');
}

function isBinaryName(fileName: string): boolean {
  return /\.(xlsx|xls|docx|zip)$/i.test(fileName);
}

export async function pickListFile(): Promise<PickedListFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPT,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const fileName = asset.name || 'import';
  const mimeType = asset.mimeType ?? null;

  if (Platform.OS === 'web' && asset.file) {
    if (isBinaryName(fileName)) {
      const buffer = await asset.file.arrayBuffer();
      return { fileName, mimeType, text: null, bytes: new Uint8Array(buffer) };
    }
    const text = await asset.file.text();
    return { fileName, mimeType, text, bytes: null };
  }

  if (isBinaryName(fileName)) {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    return { fileName, mimeType, text: null, bytes: base64ToBytes(base64) };
  }
  const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  return { fileName, mimeType, text, bytes: null };
}

export async function readListFileUri(uri: string, fileName: string, mimeType?: string | null): Promise<PickedListFile> {
  if (isBinaryName(fileName)) {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return { fileName, mimeType: mimeType ?? null, text: null, bytes: base64ToBytes(base64) };
  }
  const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  return { fileName, mimeType: mimeType ?? null, text, bytes: null };
}

export async function shareOrDownloadExport(built: BuiltExport): Promise<void> {
  if (Platform.OS === 'web') {
    const blob =
      built.bytes != null
        ? new Blob([Uint8Array.from(built.bytes)], { type: built.mimeType })
        : new Blob([built.text ?? ''], { type: built.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = built.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory');
  const uri = `${dir}${built.fileName}`;
  if (built.bytes) {
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(built.bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    await FileSystem.writeAsStringAsync(uri, built.text ?? '', {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: built.mimeType, dialogTitle: built.fileName });
    return;
  }
  if (built.text) {
    await Share.share({ message: built.text, title: built.fileName });
  }
}
