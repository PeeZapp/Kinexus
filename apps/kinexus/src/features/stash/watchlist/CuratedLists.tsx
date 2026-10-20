import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  mediaTypeLabel,
  tmdbImageUrl,
  watchlistTitleKey,
  type CuratedWatchlist,
  type CuratedWatchlistMatch,
  type CuratedWatchlistTitle,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { EmptyState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { ListBackLink } from '@/src/features/stash/StashShared';

export function curatedTitleHit(title: CuratedWatchlistTitle): WatchlistSearchHit {
  return {
    tmdbId: title.tmdbId,
    mediaType: title.mediaType,
    title: title.title,
    year: title.year,
    overview: null,
    posterPath: title.posterPath,
    backdropPath: null,
    imdbId: null,
  };
}

export function CuratedListSection({
  query,
  setQuery,
  matches,
  wide,
  onOpen,
}: {
  query: string;
  setQuery: (value: string) => void;
  matches: readonly CuratedWatchlistMatch[];
  wide?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.kicker}>Curated lists</Text>
        <Text style={styles.blurb}>
          Search a few lists of movies and shows, open one, and add a title to a watchlist you keep.
        </Text>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search lists or titles"
        placeholderTextColor={colors.textDim}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {matches.length === 0 ? (
        <EmptyState title="No lists match" body="Try a movie, a show, or a word from the description." />
      ) : (
        <View style={[styles.cards, wide && styles.cardsWide]}>
          {matches.map((match) => (
            <CuratedListCard key={match.list.id} match={match} wide={wide} onPress={() => onOpen(match.list.id)} />
          ))}
        </View>
      )}
    </View>
  );
}

function CuratedListCard({
  match,
  wide,
  onPress,
}: {
  match: CuratedWatchlistMatch;
  wide?: boolean;
  onPress: () => void;
}) {
  const posters = match.list.titles.slice(0, 4);
  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.cardWide]}>
      <View style={styles.strip}>
        {posters.map((title) => {
          const uri = tmdbImageUrl(title.posterPath, 'w185');
          return uri ? (
            <Image key={watchlistTitleKey(title.mediaType, title.tmdbId)} source={{ uri }} style={styles.stripPoster} />
          ) : (
            <View key={watchlistTitleKey(title.mediaType, title.tmdbId)} style={styles.stripPoster} />
          );
        })}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {match.list.name}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {match.list.titles.length} titles · {match.list.blurb}
        </Text>
        {match.matchedTitles.length > 0 ? (
          <Text style={styles.includes} numberOfLines={2}>
            Includes {match.matchedTitles.join(', ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function CuratedListDetail({
  list,
  onBack,
  onOpenTitle,
  savedKeys,
}: {
  list: CuratedWatchlist;
  onBack: () => void;
  onOpenTitle: (hit: WatchlistSearchHit) => void;
  savedKeys: ReadonlySet<string>;
}) {
  return (
    <View style={styles.detail}>
      <ListBackLink label="Watchlists" onPress={onBack} />
      <Text style={styles.detailTitle}>{list.name}</Text>
      <Text style={styles.blurb}>{list.blurb}</Text>
      <Text style={styles.cardMeta}>
        {list.titles.length} titles · Open one to read about it, then add it to a watchlist.
      </Text>
      <View style={styles.rows}>
        {list.titles.map((title) => {
          const key = watchlistTitleKey(title.mediaType, title.tmdbId);
          const saved = savedKeys.has(key);
          const poster = tmdbImageUrl(title.posterPath, 'w92');
          return (
            <Pressable key={key} onPress={() => onOpenTitle(curatedTitleHit(title))} style={styles.row}>
              {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {title.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {title.year} · {mediaTypeLabel(title.mediaType)}
                </Text>
              </View>
              <Text style={[styles.action, saved && styles.actionDone]}>{saved ? 'Saved' : 'Details'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 8 },
  heading: { gap: 4 },
  kicker: { color: colors.text, fontSize: 18, fontWeight: '800' },
  blurb: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  search: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  cards: { gap: space.md },
  cardsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minWidth: 0,
  },
  cardWide: { width: 320 },
  strip: { flexDirection: 'row', height: 132, backgroundColor: colors.bgHover },
  stripPoster: { flex: 1, height: '100%', backgroundColor: colors.bg },
  cardBody: { gap: 4, padding: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  includes: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  detail: { gap: 12 },
  detailTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  rows: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  poster: { width: 36, height: 52, borderRadius: 4, backgroundColor: colors.bg },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  action: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  actionDone: { color: colors.textDim },
});
