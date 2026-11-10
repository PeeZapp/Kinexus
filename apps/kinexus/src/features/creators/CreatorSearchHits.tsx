import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import type { CreatorSearchHit } from '@kinexus/domain';

import { ProfileAvatar } from '@/src/features/shell/ProfileAvatar';
import { colors, radius, space } from '@/src/features/shell/theme';
import { creatorProfileHref, searchCreators } from '@/src/features/creators/creators-api';

const DEBOUNCE_MS = 300;

/** Compact “Creators” row for existing search boxes (max 3, query ≥ 2). */
export function CreatorSearchHits({ query }: { query: string }) {
  const router = useRouter();
  const [hits, setHits] = useState<CreatorSearchHit[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits((current) => (current.length === 0 ? current : []));
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchCreators(trimmed, 3)
        .then((next) => {
          if (!cancelled) setHits(next);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (hits.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Creators</Text>
      <View style={styles.row}>
        {hits.map((hit) => (
          <Pressable
            key={hit.permanentId}
            onPress={() => router.push(creatorProfileHref(hit.handle) as Href)}
            accessibilityRole="link"
            accessibilityLabel={`@${hit.handle}`}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <ProfileAvatar avatarUrl={hit.avatarPreset} size={28} />
            <Text style={styles.handle} numberOfLines={1}>
              @{hit.handle}
            </Text>
            {hit.isVerified ? <Text style={styles.badge}>✓</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  pressed: { backgroundColor: colors.bgHover },
  handle: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  badge: { color: colors.accent, fontSize: 12, fontWeight: '800' },
});
