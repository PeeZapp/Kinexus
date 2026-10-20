import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  WATCHLIST_ITEM_STATUSES,
  groupWatchlistProviders,
  itemStatusLabel,
  mediaTypeLabel,
  streamingSummary,
  tmdbImageUrl,
  type WatchlistEntry,
  type WatchlistItemStatus,
  type WatchlistMediaType,
  type WatchlistProvider,
  type WatchlistProviderOption,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { Btn, Pill } from '@/src/features/household/ui';
import { FilterBar, FilterDropdown, useFilterMenus } from '@/src/features/shell/FilterMenu';
import { colors, radius, space } from '@/src/features/shell/theme';
import { StashPhoto } from '@/src/features/stash/StashShared';
import type { WatchlistPersonHit, WatchlistSearchHitWithRole } from '@/src/features/stash/watchlist-api';

export type WatchlistListCardModel = {
  id: string;
  name: string;
  coverUrl: string | null;
  itemCount: number;
  shareLabel: string;
};

function statusChipLabel(status: WatchlistItemStatus): string {
  if (status === 'want') return 'Want';
  if (status === 'watching') return 'Watching';
  return 'Watched';
}

function catalogKey(hit: WatchlistSearchHit): string {
  return `${hit.mediaType}-${hit.tmdbId}`;
}

export function WatchlistDetailToolbar({
  catalogQuery,
  setCatalogQuery,
  catalogHits,
  catalogSearching,
  catalogMessage,
  catalogPeople = [],
  catalogPersonId = null,
  catalogPersonName = null,
  onCatalogPersonId,
  addingKey,
  onListKeys,
  onPickHit,
  searchPlaceholder = 'Search movies, shows, or people',
  showStatus = true,
  addLabel = 'Add',
  onListLabel = 'On list',
  listQuery,
  setListQuery,
  findInList,
  onToggleFindInList,
  status,
  setStatus,
  mediaType,
  setMediaType,
  providerId,
  setProviderId,
  providerOptions,
  onSettings,
  online,
}: {
  catalogQuery: string;
  setCatalogQuery: (v: string) => void;
  catalogHits: readonly WatchlistSearchHitWithRole[];
  catalogSearching: boolean;
  catalogMessage: string | null;
  catalogPeople?: readonly WatchlistPersonHit[];
  catalogPersonId?: number | null;
  catalogPersonName?: string | null;
  onCatalogPersonId?: (id: number) => void;
  addingKey: string | null;
  onListKeys: ReadonlySet<string>;
  onPickHit: (hit: WatchlistSearchHit) => void;
  searchPlaceholder?: string;
  showStatus?: boolean;
  addLabel?: string;
  onListLabel?: string;
  listQuery: string;
  setListQuery: (v: string) => void;
  findInList: boolean;
  onToggleFindInList: () => void;
  status: WatchlistItemStatus | null;
  setStatus: (status: WatchlistItemStatus | null) => void;
  mediaType: WatchlistMediaType | null;
  setMediaType: (type: WatchlistMediaType | null) => void;
  providerId: number | null;
  setProviderId: (id: number | null) => void;
  providerOptions: WatchlistProviderOption[];
  onSettings?: () => void;
  online: boolean;
}) {
  const { openMenu, toggleMenu, pick } = useFilterMenus();
  const providerName =
    providerOptions.find((provider) => provider.providerId === providerId)?.providerName ?? 'Any';
  const showResults = catalogQuery.trim().length >= 2;

  return (
    <View style={styles.toolbar}>
      <View style={styles.toolbarRow}>
        <TextInput
          value={catalogQuery}
          onChangeText={setCatalogQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textDim}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          editable={online}
        />
        {onSettings ? (
          <Pressable onPress={onSettings} style={styles.toolbarBtn}>
            <Text style={styles.toolbarBtnLabel}>Settings</Text>
          </Pressable>
        ) : null}
      </View>

      {showResults ? (
        <View style={styles.results}>
          {catalogSearching && catalogHits.length === 0 ? (
            <Text style={styles.resultStatus}>Searching…</Text>
          ) : null}
          {!catalogSearching && catalogMessage ? <Text style={styles.resultStatus}>{catalogMessage}</Text> : null}
          {catalogPeople.length > 1 && onCatalogPersonId ? (
            <View style={styles.peoplePills}>
              {catalogPeople.map((person) => (
                <Pill
                  key={person.id}
                  label={person.name}
                  active={person.id === catalogPersonId}
                  onPress={() => onCatalogPersonId(person.id)}
                />
              ))}
            </View>
          ) : null}
          {catalogPersonName && catalogHits.length > 0 ? (
            <Text style={styles.resultStatus}>Movies with {catalogPersonName}</Text>
          ) : null}
          {catalogHits.map((hit) => {
            const key = catalogKey(hit);
            const onList = onListKeys.has(key);
            const adding = addingKey === key;
            const poster = tmdbImageUrl(hit.posterPath, 'w92');
            return (
              <Pressable
                key={key}
                onPress={() => onPickHit(hit)}
                disabled={!online || adding}
                style={styles.hit}>
                {poster ? <Image source={{ uri: poster }} style={styles.hitPoster} /> : <View style={styles.hitPoster} />}
                <View style={styles.hitCopy}>
                  <Text style={styles.hitName} numberOfLines={1}>
                    {hit.title}
                  </Text>
                  <Text style={styles.hitMeta} numberOfLines={1}>
                    {hit.year ? `${hit.year} · ` : ''}
                    {mediaTypeLabel(hit.mediaType)}
                    {hit.role ? ` · ${hit.role}` : ''}
                  </Text>
                </View>
                <Text style={[styles.hitAction, onList && styles.hitActionDone]}>
                  {adding ? 'Adding…' : onList ? onListLabel : addLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FilterBar>
        {showStatus ? (
        <FilterDropdown<WatchlistItemStatus | null>
          id="status"
          label="Status"
          value={status}
          valueLabel={status ? statusChipLabel(status) : 'All'}
          open={openMenu === 'status'}
          options={[
            { value: null, label: 'All' },
            ...WATCHLIST_ITEM_STATUSES.map((item) => ({ value: item, label: statusChipLabel(item) })),
          ]}
          onToggle={toggleMenu}
          onSelect={pick(setStatus)}
        />
        ) : null}
        <FilterDropdown<WatchlistMediaType | null>
          id="media"
          label="Type"
          value={mediaType}
          valueLabel={mediaType === 'movie' ? 'Movies' : mediaType === 'tv' ? 'Series' : 'All'}
          open={openMenu === 'media'}
          options={[
            { value: null, label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'Series' },
          ]}
          onToggle={toggleMenu}
          onSelect={pick(setMediaType)}
        />
        {providerOptions.length > 0 ? (
          <FilterDropdown<number | null>
            id="provider"
            label="Service"
            value={providerId}
            valueLabel={providerName}
            open={openMenu === 'provider'}
            options={[
              { value: null, label: 'Any' },
              ...providerOptions.map((provider) => ({
                value: provider.providerId,
                label: provider.providerName,
              })),
            ]}
            onToggle={toggleMenu}
            onSelect={pick(setProviderId)}
          />
        ) : null}
        <Pressable
          onPress={onToggleFindInList}
          style={[styles.findBtn, (findInList || listQuery.trim().length > 0) && styles.findBtnActive]}>
          <Text style={[styles.findBtnLabel, (findInList || listQuery.trim().length > 0) && styles.findBtnLabelActive]}>
            Find in list
          </Text>
        </Pressable>
      </FilterBar>

      {findInList ? (
        <TextInput
          value={listQuery}
          onChangeText={setListQuery}
          placeholder="Search titles in this list"
          placeholderTextColor={colors.textDim}
          style={styles.listSearch}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      ) : null}
    </View>
  );
}

export function WatchlistSectionTitle({ label }: { label: string }) {
  return <Text style={styles.listsLabel}>{label}</Text>;
}

export function WatchedHomeSection({
  cards,
  query,
  setQuery,
  hits,
  searching,
  message,
  people = [],
  personId = null,
  personName = null,
  onPersonId,
  onPick,
  onOpenList,
  online,
  wide,
}: {
  cards: readonly WatchlistListCardModel[];
  query: string;
  setQuery: (value: string) => void;
  hits: readonly WatchlistSearchHitWithRole[];
  searching: boolean;
  message: string | null;
  people?: readonly WatchlistPersonHit[];
  personId?: number | null;
  personName?: string | null;
  onPersonId?: (id: number) => void;
  onPick: (hit: WatchlistSearchHit) => void;
  onOpenList: (id: string) => void;
  online: boolean;
  wide?: boolean;
}) {
  const showResults = query.trim().length >= 2;
  return (
    <View style={styles.watched}>
      <View style={styles.watchedHead}>
        <Text style={styles.watchedTitle}>Watched</Text>
        <Text style={styles.watchedHint}>Private stays with you. Family is shared.</Text>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search a movie, show, or person you watched"
        placeholderTextColor={colors.textDim}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        editable={online}
      />
      {showResults ? (
        <View style={styles.results}>
          {searching && hits.length === 0 ? <Text style={styles.resultStatus}>Searching…</Text> : null}
          {!searching && message ? <Text style={styles.resultStatus}>{message}</Text> : null}
          {people.length > 1 && onPersonId ? (
            <View style={styles.peoplePills}>
              {people.map((person) => (
                <Pill
                  key={person.id}
                  label={person.name}
                  active={person.id === personId}
                  onPress={() => onPersonId(person.id)}
                />
              ))}
            </View>
          ) : null}
          {personName && hits.length > 0 ? (
            <Text style={styles.resultStatus}>Movies with {personName}</Text>
          ) : null}
          {hits.map((hit) => {
            const poster = tmdbImageUrl(hit.posterPath, 'w92');
            return (
              <Pressable
                key={`${hit.mediaType}-${hit.tmdbId}`}
                onPress={() => onPick(hit)}
                disabled={!online}
                style={styles.hit}>
                {poster ? <Image source={{ uri: poster }} style={styles.hitPoster} /> : <View style={styles.hitPoster} />}
                <View style={styles.hitCopy}>
                  <Text style={styles.hitName} numberOfLines={1}>
                    {hit.title}
                  </Text>
                  <Text style={styles.hitMeta} numberOfLines={1}>
                    {hit.year ? `${hit.year} · ` : ''}
                    {mediaTypeLabel(hit.mediaType)}
                    {hit.role ? ` · ${hit.role}` : ''}
                  </Text>
                </View>
                <Text style={styles.hitAction}>Add</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.watchedRow}>
        {cards.map((list) => (
          <View key={list.id} style={styles.watchedSlot}>
            <WatchlistListCard list={list} wide={wide} onPress={() => onOpenList(list.id)} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function WatchlistListCard({
  list,
  wide,
  onPress,
  onSettings,
}: {
  list: WatchlistListCardModel;
  wide?: boolean;
  onPress: () => void;
  onSettings?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.listCard, wide && styles.listCardWide]}>
      <View style={styles.listCover}>
        <StashPhoto uri={list.coverUrl} fallback="🎬" size="fill" />
        {list.shareLabel && list.shareLabel !== 'Household' ? (
          <View style={styles.listBadgeShare}>
            <Text style={styles.listBadgeShareText}>{list.shareLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.listCardBody}>
        <Text style={styles.listCardTitle} numberOfLines={2}>
          {list.name}
        </Text>
        <Text style={styles.listCardStats} numberOfLines={2}>
          {list.itemCount} title{list.itemCount === 1 ? '' : 's'}
        </Text>
        {onSettings ? (
          <View style={styles.listCardActions}>
            <Pill label="Settings" onPress={onSettings} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function WatchlistIdeaActions({
  onNext,
  onSurprise,
  onLike,
  onServices,
  servicesLabel,
  disabled,
}: {
  onNext: () => void;
  onSurprise: () => void;
  onLike: () => void;
  onServices: () => void;
  servicesLabel: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.ideaRow}>
      <Btn label="What next" variant="secondary" onPress={onNext} disabled={disabled} />
      <Btn label="Surprise me" variant="ghost" onPress={onSurprise} disabled={disabled} />
      <Btn label="Something like this" variant="ghost" onPress={onLike} disabled={disabled} />
      <Btn label={servicesLabel} variant="ghost" onPress={onServices} disabled={disabled} />
    </View>
  );
}

export type WatchlistCardReview = {
  id: string;
  name: string;
  score: number;
};

export function WatchlistCard({
  entry,
  reviews,
  scoreLine,
  wide,
  onPress,
}: {
  entry: WatchlistEntry;
  reviews?: readonly WatchlistCardReview[];
  scoreLine?: string | null;
  wide?: boolean;
  onPress: () => void;
}) {
  const poster = tmdbImageUrl(entry.title.posterPath, wide ? 'w185' : 'w92');
  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.cardWide]}>
      <StashPhoto uri={poster} fallback={entry.title.mediaType === 'tv' ? '📺' : '🎬'} size={wide ? 120 : 64} />
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
        {scoreLine ? (
          <Text style={styles.review} numberOfLines={1}>
            {scoreLine}
          </Text>
        ) : reviews && reviews.length > 0 ? (
          <Text style={styles.review} numberOfLines={2}>
            {reviews.map((review) => `${review.name} ${review.score}/10`).join(' · ')}
          </Text>
        ) : null}
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
  return <Text style={styles.attr}>Streaming for {country} via JustWatch / TMDB.</Text>;
}

const styles = StyleSheet.create({
  ideaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  watched: { gap: 12 },
  watchedHead: { gap: 2 },
  watchedTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  watchedHint: { color: colors.textMuted, fontSize: 13 },
  watchedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  watchedSlot: { flex: 1, minWidth: 160, maxWidth: 300 },
  listsLabel: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 8 },
  toolbar: { gap: 10 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: {
    flex: 1,
    minWidth: 0,
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
  toolbarBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  results: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    padding: 6,
  },
  resultStatus: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 8, paddingVertical: 6 },
  peoplePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 6, paddingVertical: 4 },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  hitPoster: { width: 36, height: 52, borderRadius: 4, backgroundColor: colors.bg },
  hitCopy: { flex: 1, minWidth: 0, gap: 2 },
  hitName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hitMeta: { color: colors.textMuted, fontSize: 12 },
  hitAction: { color: colors.accent, fontSize: 13, fontWeight: '800', paddingHorizontal: 8 },
  hitActionDone: { color: colors.textDim, fontWeight: '700' },
  findBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 7,
    paddingHorizontal: 12,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  findBtnLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  findBtnLabelActive: { color: colors.accent },
  listSearch: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.textMuted,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 34,
  },
  listCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minWidth: 0,
  },
  listCardWide: {
    width: 300,
  },
  listCover: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.bgHover,
    position: 'relative',
    overflow: 'hidden',
  },
  listBadgeShare: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listBadgeShareText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  listCardBody: { padding: space.md, gap: 6 },
  listCardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  listCardStats: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  listCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.sm,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  cardWide: {
    width: 220,
    flexDirection: 'column',
  },
  body: { flex: 1, gap: 3, minWidth: 0 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12 },
  stream: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  review: { color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 16 },
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
  attr: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
});
