import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { BookSearchHit, ReadlistEdition, ReadStatus } from '@kinexus/domain';
import { READ_STATUSES } from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import {
  authorLine,
  formatLabel,
  progressCaption,
  SHELF_ORDER,
  shelfTabLabel,
  type ShelfKey,
} from '@/src/features/readlist/readlist-model';
import { colors, radius, space } from '@/src/features/shell/theme';
import { StashPhoto } from '@/src/features/stash/StashShared';

const REVIEW_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type ReadlistCardModel = {
  itemId: string;
  workId: string;
  title: string;
  authors: string;
  coverUrl: string | null;
  status: ReadStatus;
  progress: number | null;
  progressLabel: string | null;
};

export type ReadlistListCardModel = {
  id: string;
  name: string;
  coverUrl: string | null;
  itemCount: number;
  shareLabel: string;
};

export type ReadlistOtherListOption = {
  id: string;
  name: string;
  alreadyOn: boolean;
};

export function ShelfTabs({
  value,
  counts,
  onChange,
}: {
  value: ShelfKey;
  counts: Record<ShelfKey, number>;
  onChange: (shelf: ShelfKey) => void;
}) {
  return (
    <View style={styles.tabs}>
      {SHELF_ORDER.map((shelf) => {
        const on = value === shelf;
        return (
          <Pressable
            key={shelf}
            onPress={() => onChange(shelf)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.tab, on && styles.tabOn]}>
            <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>
              {shelfTabLabel(shelf)}
              {counts[shelf] > 0 ? ` · ${counts[shelf]}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReadlistSearch({
  query,
  setQuery,
  hits,
  searching,
  message,
  hitOnList,
  addingWorkId,
  onPick,
  online,
}: {
  query: string;
  setQuery: (value: string) => void;
  hits: readonly BookSearchHit[];
  searching: boolean;
  message: string | null;
  hitOnList: (hit: BookSearchHit) => boolean;
  addingWorkId: string | null;
  onPick: (hit: BookSearchHit) => void;
  online: boolean;
}) {
  const showResults = query.trim().length >= 2 || hits.length > 0;
  return (
    <View style={styles.searchBlock}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search books, ISBN, or paste a link"
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
          {hits.map((hit) => {
            const onList = hitOnList(hit);
            const adding = addingWorkId === hit.workId;
            return (
              <Pressable
                key={hit.workId}
                onPress={() => onPick(hit)}
                disabled={!online || adding}
                style={styles.hit}>
                <StashPhoto uri={hit.coverUrl} fallback="📖" size={48} />
                <View style={styles.hitCopy}>
                  <Text style={styles.hitTitle} numberOfLines={1}>
                    {hit.title}
                  </Text>
                  <Text style={styles.hitMeta} numberOfLines={1}>
                    {[hit.authors.join(', '), hit.firstPublishedYear].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={[styles.hitAction, onList && styles.hitActionDone]}>
                  {adding ? 'Adding…' : onList ? 'Open' : 'Add'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function BookCard({
  card,
  wide,
  onPress,
}: {
  card: ReadlistCardModel;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, wide && styles.cardWide]}>
      <StashPhoto uri={card.coverUrl} fallback="📖" size={wide ? 96 : 64} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {card.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {card.authors || 'Unknown author'}
        </Text>
        {card.status === 'reading' ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, card.progress ?? 0))}%` }]} />
            </View>
            {card.progressLabel ? <Text style={styles.progressLabel}>{card.progressLabel}</Text> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function StatusButtons({
  value,
  onChange,
}: {
  value: ReadStatus;
  onChange: (status: ReadStatus) => void;
}) {
  return (
    <View style={styles.segment}>
      {READ_STATUSES.map((status) => {
        const on = value === status;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            accessibilityRole="button"
            accessibilityLabel={shelfTabLabel(status)}
            accessibilityState={{ selected: on }}
            style={[styles.segmentItem, on && styles.segmentOn]}>
            <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>{shelfTabLabel(status)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ScoreRail({ value, onChange }: { value: number | null; onChange: (score: number) => void }) {
  return (
    <View style={styles.rail}>
      {REVIEW_SCORES.map((score) => {
        const on = value === score;
        return (
          <Pressable
            key={score}
            onPress={() => onChange(score)}
            accessibilityRole="button"
            accessibilityLabel={`Score ${score}`}
            accessibilityState={{ selected: on }}
            style={[styles.railCell, on && styles.railCellOn]}>
            <Text style={[styles.railLabel, on && styles.railLabelOn]}>{score}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressSlider({
  value,
  caption,
  onChange,
  onCommit,
}: {
  value: number;
  caption: string | null;
  onChange: (percent: number) => void;
  onCommit?: (percent: number) => void;
}) {
  const track = useRef(1);
  const latest = useRef(value);
  function setFromX(x: number) {
    const ratio = Math.min(1, Math.max(0, x / track.current));
    const next = Math.round(ratio * 1000) / 10;
    latest.current = next;
    onChange(next);
  }
  return (
    <View style={styles.sliderBlock}>
      <View
        onLayout={(event) => {
          track.current = Math.max(1, event.nativeEvent.layout.width);
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => setFromX(event.nativeEvent.locationX)}
        onResponderMove={(event) => setFromX(event.nativeEvent.locationX)}
        onResponderRelease={() => onCommit?.(latest.current)}
        onResponderTerminate={() => onCommit?.(latest.current)}
        style={styles.sliderHit}>
        <View style={styles.sliderTrack}>
          <View style={styles.sliderGroove} />
          <View style={[styles.sliderFill, { width: `${value}%` }]} />
          <View style={[styles.sliderThumb, { left: `${value}%` }]} />
        </View>
      </View>
      <Text style={styles.sliderCaption}>{caption ?? `${Math.round(value)}%`}</Text>
    </View>
  );
}

export function ReadlistListCard({
  list,
  wide,
  onPress,
  onSettings,
}: {
  list: ReadlistListCardModel;
  wide?: boolean;
  onPress: () => void;
  onSettings?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.listCard, wide && styles.listCardWide]}>
      <View style={styles.listCover}>
        <StashPhoto uri={list.coverUrl} fallback="📖" size="fill" />
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
          {list.itemCount} book{list.itemCount === 1 ? '' : 's'}
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

export function EditionsMore({
  editions,
  preferredEditionId,
  onPick,
  otherLists,
  onAddToList,
}: {
  editions: readonly ReadlistEdition[];
  preferredEditionId: string | null;
  onPick: (editionId: string | null) => void;
  otherLists?: readonly ReadlistOtherListOption[];
  onAddToList?: (listId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const preferred = editions.find((edition) => edition.id === preferredEditionId) ?? null;
  const addTargets = (otherLists ?? []).filter((list) => !list.alreadyOn);
  return (
    <View style={styles.more}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.moreToggle} accessibilityRole="button">
        <Text style={styles.moreLabel}>More</Text>
        <Text style={styles.moreMeta}>
          {preferred ? formatLabel(preferred.format) : 'No edition'} · {open ? 'Hide' : 'Show'}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.editionList}>
          <Pressable onPress={() => onPick(null)} style={styles.editionRow}>
            <Text style={[styles.editionName, preferredEditionId == null && styles.editionOn]}>None</Text>
          </Pressable>
          {editions.map((edition) => (
            <Pressable key={edition.id} onPress={() => onPick(edition.id)} style={styles.editionRow}>
              <Text style={[styles.editionName, preferredEditionId === edition.id && styles.editionOn]}>
                {formatLabel(edition.format)}
                {edition.pages ? ` · ${edition.pages}p` : ''}
                {edition.durationSeconds ? ` · ${Math.round(edition.durationSeconds / 60)}m` : ''}
                {edition.publisher ? ` · ${edition.publisher}` : ''}
              </Text>
            </Pressable>
          ))}
          {addTargets.length > 0 && onAddToList ? (
            <View style={styles.addListBlock}>
              <Text style={styles.addListLabel}>Add to another list</Text>
              {addTargets.map((list) => (
                <Pressable key={list.id} onPress={() => onAddToList(list.id)} style={styles.editionRow}>
                  <Text style={styles.editionName}>{list.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export { authorLine, progressCaption };

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabOn: { backgroundColor: colors.accentSoft },
  tabLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  tabLabelOn: { color: colors.accent },
  searchBlock: { gap: 8 },
  search: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  results: { gap: 6 },
  resultStatus: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  hitCopy: { flex: 1, minWidth: 0, gap: 2 },
  hitTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hitMeta: { color: colors.textMuted, fontSize: 13 },
  hitAction: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  hitActionDone: { color: colors.textMuted },
  card: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cardWide: { paddingVertical: 10 },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 13 },
  progressBlock: { gap: 4, marginTop: 2 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: colors.accent },
  progressLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentOn: { backgroundColor: colors.accentSoft },
  segmentLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  segmentLabelOn: { color: colors.accent },
  rail: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  railCell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  railCellOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  railLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  railLabelOn: { color: colors.bg },
  sliderBlock: { gap: 6 },
  sliderHit: { height: 32, justifyContent: 'center' },
  sliderTrack: { height: 18, justifyContent: 'center', position: 'relative' },
  sliderGroove: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 7,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 7,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  sliderThumb: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  sliderCaption: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  more: { gap: 8 },
  moreToggle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  moreLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  moreMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  editionList: { gap: 2 },
  editionRow: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  editionName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  editionOn: { color: colors.accent },
  addListBlock: { gap: 2, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  addListLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', paddingHorizontal: 4, marginBottom: 2 },
  listCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minWidth: 0,
  },
  listCardWide: { flex: 1 },
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
});
