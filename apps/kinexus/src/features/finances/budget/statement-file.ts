import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export const MAX_STATEMENT_CHARS = 2_000_000;

const STATEMENT_ACCEPT =
  '.csv,.ofx,.qfx,.qif,.txt,text/csv,text/plain,application/x-ofx,application/vnd.intu.qfx,application/x-qif';

/** Web file input used by BudgetImportSheet; behaviour preserved. */
export function pickStatementFile(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = STATEMENT_ACCEPT;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

/** Paste clipboard text for statement / transaction import. */
export async function pasteStatementText(): Promise<string | null> {
  const next = await Clipboard.getStringAsync();
  return next.trim() ? next : null;
}

/** Native-friendly statement pick for Add transactions (CSV/OFX/QIF/text). */
export async function pickStatementText(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return pickStatementFile();
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/*', 'text/csv', 'application/octet-stream', 'application/x-ofx', 'application/vnd.intu.qfx'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return FileSystem.readAsStringAsync(asset.uri);
}
