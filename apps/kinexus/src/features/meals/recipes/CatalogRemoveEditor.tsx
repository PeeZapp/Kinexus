import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Recipe } from '@kinexus/domain';

import { Btn, Card, ErrorText } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';

export function CatalogRemoveEditor({
  recipe,
  online,
  onReview,
}: {
  recipe: Recipe;
  online: boolean;
  onReview: (action: 'remove' | 'restore') => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<'remove' | 'restore' | null>(null);

  async function run(action: 'remove' | 'restore') {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await onReview(action);
      setSaved(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update recipe');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>Catalog recipe</Text>
      <Text style={styles.hint}>
        Only you see this. Remove junk, duplicates, or recipes that should not be in the library. Restore brings it back
        for everyone.
      </Text>
      {recipe.removed ? (
        <View style={styles.flag}>
          <Text style={styles.flagText}>Removed from library</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        {recipe.removed ? (
          <Btn label="Restore recipe" variant="secondary" disabled={!online} busy={busy} onPress={() => void run('restore')} />
        ) : (
          <Btn label="Remove from catalog" variant="danger" disabled={!online} busy={busy} onPress={() => void run('remove')} />
        )}
      </View>
      <ErrorText message={error} />
      {saved ? <Text style={styles.saved}>{saved === 'remove' ? 'Removed' : 'Restored'}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  flag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentMuted,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  flagText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saved: { color: colors.accent, fontWeight: '700' },
});
