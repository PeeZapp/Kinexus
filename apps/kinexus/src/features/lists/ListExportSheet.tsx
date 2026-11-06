import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  buildListExport,
  type ExportListInput,
  type ListExportFormat,
} from '@kinexus/domain';

import { Btn, Pill } from '@/src/features/household/ui';
import { shareOrDownloadExport } from '@/src/features/lists/list-file-io';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

const FORMATS: { value: ListExportFormat; label: string }[] = [
  { value: 'json', label: 'Kinexus JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'text', label: 'Plain text' },
];

export function ListExportSheet({
  visible,
  input,
  onClose,
}: {
  visible: boolean;
  input: ExportListInput | null;
  onClose: () => void;
}) {
  useExperienceMode();
  const [format, setFormat] = useState<ListExportFormat>('json');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFormat('json');
    setBusy(false);
    setError(null);
  }, [visible]);

  async function exportNow() {
    if (!input || busy) return;
    setBusy(true);
    setError(null);
    try {
      const built = buildListExport(input, format);
      await shareOrDownloadExport(built);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title={input ? `Export ${input.listName}` : 'Export'} onClose={onClose}>
      <View style={styles.stack}>
        <Text style={styles.hint}>Choose a format</Text>
        <View style={styles.wrap}>
          {FORMATS.map((item) => (
            <Pill key={item.value} label={item.label} active={format === item.value} onPress={() => setFormat(item.value)} />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn label={busy ? 'Exporting…' : 'Export'} onPress={() => void exportNow()} busy={busy} disabled={!input} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
});
