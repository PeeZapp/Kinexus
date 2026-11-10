import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  ReadlistEdition,
  ReadlistEntry,
  ReadlistProgress,
  ReadlistReview,
  ReadStatus,
} from '@kinexus/domain';

import { Btn } from '@/src/features/household/ui';
import { loadBookWork } from '@/src/features/readlist/readlist-api';
import {
  authorLine,
  cardProgressPercent,
  progressCaption,
  progressFromSliderPercent,
  showProgressSlider,
} from '@/src/features/readlist/readlist-model';
import {
  EditionsMore,
  ProgressSlider,
  ScoreRail,
  StatusButtons,
  type ReadlistOtherListOption,
} from '@/src/features/readlist/ReadlistShared';
import { colors, space } from '@/src/features/shell/theme';
import { ListBackLink, StashPhoto } from '@/src/features/stash/StashShared';
import { confirmAction } from '@/src/lib/confirm';

export function BookPage({
  entry,
  editions,
  progress,
  review,
  otherLists,
  online,
  onBack,
  onStatus,
  onEdition,
  onProgress,
  onScore,
  onRemove,
  onAddToList,
}: {
  entry: ReadlistEntry;
  editions: readonly ReadlistEdition[];
  progress: ReadlistProgress | null;
  review: ReadlistReview | null;
  otherLists: readonly ReadlistOtherListOption[];
  online: boolean;
  onBack: () => void;
  onStatus: (status: ReadStatus) => Promise<void>;
  onEdition: (editionId: string | null) => Promise<void>;
  onProgress: (input: {
    percent: number;
    pagesRead: number | null;
    secondsListened: number | null;
    editionId: string | null;
  }) => Promise<void>;
  onScore: (score: number) => Promise<void>;
  onRemove: () => Promise<void>;
  onAddToList: (listId: string) => Promise<void>;
}) {
  const [blurb, setBlurb] = useState<string | null>(null);
  const [blurbOpen, setBlurbOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localPercent, setLocalPercent] = useState(0);

  const preferred = useMemo(
    () => editions.find((edition) => edition.id === entry.item.preferredEditionId) ?? null,
    [editions, entry.item.preferredEditionId],
  );

  useEffect(() => {
    const percent = cardProgressPercent(progress, preferred) ?? 0;
    setLocalPercent(percent);
  }, [preferred, progress, entry.item.id]);

  useEffect(() => {
    let cancelled = false;
    const catalogId = entry.work.olWorkId;
    if (!catalogId) {
      setBlurb(null);
      return;
    }
    void loadBookWork(catalogId)
      .then((work) => {
        if (!cancelled) setBlurb(work?.blurb?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setBlurb(null);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.work.olWorkId]);

  const caption = progressCaption({
    status: entry.item.status,
    progress: progress
      ? { ...progress, percent: localPercent }
      : { percent: localPercent, pagesRead: null, secondsListened: null },
    edition: preferred,
  });

  async function run(fn: () => Promise<void>) {
    if (busy || !online) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ListBackLink label="Readlist" onPress={onBack} />
      <View style={styles.hero}>
        <StashPhoto uri={entry.work.coverUrl} fallback="📖" size={140} />
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{entry.work.title}</Text>
          <Text style={styles.authors}>{authorLine(entry.work) || 'Unknown author'}</Text>
        </View>
      </View>

      {blurb ? (
        <Pressable onPress={() => setBlurbOpen((v) => !v)} accessibilityRole="button">
          <Text style={styles.blurb} numberOfLines={blurbOpen ? undefined : 3}>
            {blurb}
          </Text>
        </Pressable>
      ) : null}

      <StatusButtons
        value={entry.item.status}
        onChange={(status) => void run(() => onStatus(status))}
      />

      <View style={styles.block}>
        <Text style={styles.blockLabel}>Score</Text>
        <ScoreRail value={review?.score ?? null} onChange={(score) => void run(() => onScore(score))} />
      </View>

      {showProgressSlider(entry.item.status) ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Progress</Text>
          <ProgressSlider
            value={localPercent}
            caption={caption}
            onChange={setLocalPercent}
            onCommit={(percent) => {
              const payload = progressFromSliderPercent(percent, preferred);
              void run(() =>
                onProgress({
                  ...payload,
                  editionId: preferred?.id ?? null,
                }),
              );
            }}
          />
        </View>
      ) : null}

      <EditionsMore
        editions={editions}
        preferredEditionId={entry.item.preferredEditionId}
        onPick={(editionId) => void run(() => onEdition(editionId))}
        otherLists={otherLists}
        onAddToList={(listId) => void run(() => onAddToList(listId))}
      />

      <Btn
        label="Remove from list"
        variant="danger"
        disabled={!online || busy}
        onPress={() => {
          void (async () => {
            const ok = await confirmAction('Remove from readlist?', entry.work.title);
            if (!ok) return;
            await run(onRemove);
          })();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  hero: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  heroCopy: { flex: 1, minWidth: 0, gap: 6, paddingTop: 4 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  authors: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  blurb: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  block: { gap: 8 },
  blockLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
