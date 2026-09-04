import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Recipe } from '@kinexus/domain';

import { Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';

export function CatalogPhotoEditor({
  recipe,
  online,
  onReview,
}: {
  recipe: Recipe;
  online: boolean;
  onReview: (action: 'flag' | 'unflag' | 'set_url' | 'clear', imageUrl?: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(recipe.imageUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUrl(recipe.imageUrl ?? '');
  }, [recipe.imageUrl]);

  async function run(action: 'flag' | 'unflag' | 'set_url' | 'clear') {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await onReview(action, action === 'set_url' ? url.trim() : undefined);
      if (action === 'clear') setUrl('');
      setSaved(action === 'set_url' || action === 'unflag');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update photo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>Catalog photo</Text>
      <Text style={styles.hint}>
        Only you see this. Flag a bad match, paste a better https image URL, or clear it back to the emoji.
      </Text>
      {recipe.imageFlagged ? (
        <View style={styles.flag}>
          <Text style={styles.flagText}>Flagged as wrong</Text>
        </View>
      ) : null}
      <Field
        label="Image URL"
        value={url}
        onChangeText={setUrl}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.row}>
        <Btn
          label="Save URL"
          disabled={!online || !url.trim()}
          busy={busy}
          onPress={() => void run('set_url')}
        />
        {recipe.imageFlagged ? (
          <Btn label="Looks fine" variant="secondary" disabled={!online} busy={busy} onPress={() => void run('unflag')} />
        ) : (
          <Btn label="Photo is wrong" variant="secondary" disabled={!online} busy={busy} onPress={() => void run('flag')} />
        )}
        <Btn label="Clear photo" variant="ghost" disabled={!online} busy={busy} onPress={() => void run('clear')} />
      </View>
      <ErrorText message={error} />
      {saved ? <Text style={styles.saved}>Saved</Text> : null}
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
