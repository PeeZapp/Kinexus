import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { pickRecipeCoverFile, uploadRecipeCover } from '@/src/features/meals/recipes/recipe-cover-upload';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';

export function RecipeCoverPicker({
  imageUrl,
  imageCandidates,
  emoji,
  onSelect,
}: {
  imageUrl: string;
  imageCandidates: string[];
  emoji?: string;
  onSelect: (url: string) => void;
}) {
  const { activeHousehold } = useHousehold();
  const householdId = activeHousehold?.id ?? null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = uniqueUrls([imageUrl, ...imageCandidates].filter(Boolean));

  async function onUpload() {
    if (!householdId) {
      setError('Pick a household first');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const file = await pickRecipeCoverFile();
      if (!file) return;
      const url = await uploadRecipeCover(householdId, file);
      onSelect(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (!imageUrl && !candidates.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <RecipePhoto uri={imageUrl || undefined} emoji={emoji} size="fill" radius={0} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((current) => !current)}
        style={styles.change}>
        <Text style={styles.changeLabel}>{open ? 'Hide photos' : 'Change photo'}</Text>
      </Pressable>
      {open ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {candidates.map((url) => {
            const active = url === imageUrl;
            return (
              <Pressable
                key={url}
                accessibilityRole="button"
                onPress={() => onSelect(url)}
                style={[styles.tile, active && styles.tileActive]}>
                <RecipePhoto uri={url} size="fill" radius={0} />
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void onUpload()}
            style={[styles.tile, styles.uploadTile]}>
            <Text style={styles.uploadLabel}>{busy ? '…' : 'Upload your own'}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
  },
  change: { alignSelf: 'flex-start' },
  changeLabel: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  strip: { gap: 8, paddingVertical: 2 },
  tile: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bgHover,
  },
  tileActive: { borderColor: colors.accent },
  uploadTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.xs,
  },
  uploadLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  error: { color: colors.danger, fontSize: 12 },
});
