import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  groupWatchlistProviders,
  itemStatusLabel,
  mediaTypeLabel,
  streamingSummary,
  tmdbImageUrl,
  type WatchlistEntry,
  type WatchlistProvider,
} from '@kinexus/domain';

import { colors, radius, space } from '@/src/features/shell/theme';
import { StashPhoto } from '@/src/features/stash/StashShared';

export function WatchlistCard({
  entry,
  wide,
  onPress,
}: {
  entry: WatchlistEntry;
  wide?: boolean;
  onPress: () => void;
}) {
  const poster = tmdbImageUrl(entry.title.posterPath, wide ? 'w342' : 'w185');
  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.cardWide]}>
      <StashPhoto uri={poster} fallback={entry.title.mediaType === 'tv' ? '📺' : '🎬'} size={wide ? 160 : 72} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {entry.title.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {entry.title.year ? `${entry.title.year} · ` : ''}
          {mediaTypeLabel(entry.title.mediaType)} · {itemStatusLabel(entry.item.status)}
        </Text>
        <Text style={styles.stream} numberOfLines={1}>
          {streamingSummary(entry.title.providers)}
        </Text>
      </View>
    </Pressable>
  );
}

export function ProviderChips({ providers }: { providers: readonly WatchlistProvider[] }) {
  const groups = groupWatchlistProviders(providers);
  if (groups.length === 0) {
    return <Text style={styles.emptyProviders}>No streaming listed for this country yet.</Text>;
  }
  return (
    <View style={styles.groups}>
      {groups.map((group) => (
        <View key={group.offerType} style={styles.group}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.wrap}>
            {group.providers.map((provider) => {
              const logo = tmdbImageUrl(provider.logoPath, 'w45');
              return (
                <View key={`${group.offerType}-${provider.providerId}`} style={styles.chip}>
                  {logo ? <Image source={{ uri: logo }} style={styles.logo} /> : null}
                  <Text style={styles.chipLabel}>{provider.providerName}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

export function openExternal(url: string | null | undefined) {
  if (!url) return;
  void Linking.openURL(url);
}

export function WatchlistAttribution({ country }: { country: string }) {
  return (
    <Text style={styles.attr}>
      Streaming for {country} via JustWatch / TMDB. This product uses the TMDB API but is not endorsed or certified by
      TMDB.
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.sm,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  cardWide: {
    width: 280,
    flexDirection: 'column',
  },
  body: { flex: 1, gap: 4, minWidth: 0 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  stream: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  groups: { gap: 12 },
  group: { gap: 8 },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  logo: { width: 18, height: 18, borderRadius: 4, backgroundColor: colors.bg },
  chipLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  emptyProviders: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  attr: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
});
