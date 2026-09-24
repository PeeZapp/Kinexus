import { useState } from 'react';
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
} from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { StashPhoto } from '@/src/features/stash/StashShared';

export type WatchlistListCardModel = {
  id: string;
  name: string;
  coverUrl: string | null;
  itemCount: number;
  shareLabel: string;
};

type FilterMenuId = 'status' | 'media' | 'provider';

type FilterOption<T> = {
  value: T;
  label: string;
};

function statusChipLabel(status: WatchlistItemStatus): string {
  if (status === 'want') return 'Want';
  if (status === 'watching') return 'Watching';
  return 'Watched';
}

function FilterDropdown<T extends string | number | null>({
  id,
  label,
  value,
  valueLabel,
  open,
  options,
  onToggle,
  onSelect,
}: {
  id: FilterMenuId;
  label: string;
  value: T;
  valueLabel: string;
  open: boolean;
  options: FilterOption<T>[];
  onToggle: (id: FilterMenuId) => void;
  onSelect: (value: T) => void;
}) {
  const active = value != null;
  return (
    <View style={[styles.dropdown, open && styles.dropdownOpen]}>
      <Pressable
        onPress={() => onToggle(id)}
        style={[styles.dropdownTrigger, (active || open) && styles.dropdownTriggerActive]}>
        <Text style={styles.dropdownKind}>{label}</Text>
        <Text style={[styles.dropdownValue, active && styles.dropdownValueActive]} numberOfLines={1}>
          {valueLabel}
        </Text>
        <Text style={styles.dropdownChevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdownMenu}>
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={`${id}-${String(option.value)}`}
                onPress={() => onSelect(option.value)}
                style={[
                  styles.dropdownItem,
                  index > 0 && styles.dropdownItemBorder,
                  selected && styles.dropdownItemActive,
                ]}>
                <Text style={[styles.dropdownItemLabel, selected && styles.dropdownItemLabelActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function WatchlistDetailToolbar({
  query,
  setQuery,
  status,
  setStatus,
  mediaType,
  setMediaType,
  providerId,
  setProviderId,
  providerOptions,
  onAddTitle,
  onSettings,
  online,
}: {
  query: string;
  setQuery: (v: string) => void;
  status: WatchlistItemStatus | null;
  setStatus: (status: WatchlistItemStatus | null) => void;
  mediaType: WatchlistMediaType | null;
  setMediaType: (type: WatchlistMediaType | null) => void;
  providerId: number | null;
  setProviderId: (id: number | null) => void;
  providerOptions: WatchlistProviderOption[];
  onAddTitle: () => void;
  onSettings?: () => void;
  online: boolean;
}) {
  const [openMenu, setOpenMenu] = useState<FilterMenuId | null>(null);
  const providerName =
    providerOptions.find((provider) => provider.providerId === providerId)?.providerName ?? 'Any';

  function toggleMenu(id: FilterMenuId) {
    setOpenMenu((current) => (current === id ? null : id));
  }

  function pick<T>(apply: (value: T) => void) {
    return (value: T) => {
      apply(value);
      setOpenMenu(null);
    };
  }

  return (
    <View style={styles.toolbar}>
      <View style={styles.toolbarRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles"
          placeholderTextColor={colors.textDim}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={onAddTitle}
          disabled={!online}
          style={[styles.toolbarBtn, styles.toolbarBtnPrimary, !online && styles.toolbarBtnDisabled]}>
          <Text style={styles.toolbarBtnPrimaryLabel}>Add</Text>
        </Pressable>
        {onSettings ? (
          <Pressable onPress={onSettings} style={styles.toolbarBtn}>
            <Text style={styles.toolbarBtnLabel}>Settings</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
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

export function WatchlistCard({
  entry,
  wide,
  onPress,
}: {
  entry: WatchlistEntry;
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
  toolbarBtnPrimary: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
  },
  toolbarBtnDisabled: { opacity: 0.5 },
  toolbarBtnLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  toolbarBtnPrimaryLabel: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 2,
  },
  dropdown: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 120,
    maxWidth: 220,
    position: 'relative',
    zIndex: 1,
  },
  dropdownOpen: { zIndex: 30 },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 7,
    paddingHorizontal: 10,
    minHeight: 34,
  },
  dropdownTriggerActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  dropdownKind: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dropdownValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  dropdownValueActive: { color: colors.accent },
  dropdownChevron: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  dropdownMenu: {
    marginTop: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  dropdownItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dropdownItemActive: { backgroundColor: colors.accentSoft },
  dropdownItemLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  dropdownItemLabelActive: { color: colors.accent, fontWeight: '700' },
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
