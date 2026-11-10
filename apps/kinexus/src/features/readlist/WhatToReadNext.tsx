import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BookSearchHit } from '@kinexus/domain';
import { emptyBookExternalIds } from '@kinexus/domain';

import {
  loadReadlistRecommendations,
  type ReadlistRecommendation,
} from '@/src/features/readlist/readlist-api';
import {
  dismissRecommendation,
  loadDismissedRecommendations,
} from '@/src/features/readlist/recommend-dismiss';
import { LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';

function hitFromRecommendation(row: ReadlistRecommendation): BookSearchHit {
  return {
    workId: row.workId,
    title: row.title,
    authors: row.authors,
    firstPublishedYear: row.firstPublishedYear,
    coverUrl: row.coverUrl,
    editionCount: 0,
    ids: {
      ...emptyBookExternalIds(),
      openLibraryWorkId: row.workId,
    },
  };
}

export function WhatToReadNextSection({
  wide,
  online,
  householdId,
  userId,
  savedWorkIds,
  addingWorkId,
  onOpen,
  onAdd,
}: {
  wide?: boolean;
  online: boolean;
  householdId: string | null;
  userId: string | null;
  savedWorkIds: ReadonlySet<string>;
  addingWorkId: string | null;
  onOpen: (hit: BookSearchHit) => void;
  onAdd: (hit: BookSearchHit) => void;
}) {
  const [rows, setRows] = useState<ReadlistRecommendation[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setDismissed([]);
      return;
    }
    let cancelled = false;
    void loadDismissedRecommendations(userId).then((ids) => {
      if (!cancelled) setDismissed(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!online || !householdId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadReadlistRecommendations(householdId)
      .then((payload) => {
        if (cancelled) return;
        setRows(payload.results);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [householdId, online]);

  const visible = useMemo(() => {
    const hidden = new Set(dismissed.map((id) => id.toUpperCase()));
    return rows.filter((row) => !hidden.has(row.workId.toUpperCase()));
  }, [dismissed, rows]);

  async function onDismiss(workId: string) {
    if (!userId) {
      setDismissed((prev) => [...new Set([...prev, workId])]);
      return;
    }
    const next = await dismissRecommendation(userId, workId);
    setDismissed(next);
  }

  if (!online || !householdId) return null;
  if (loading && rows.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.kicker}>What to read next</Text>
        <LoadingState label="Loading suggestions…" />
      </View>
    );
  }

  if (visible.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.kicker}>What to read next</Text>
        <Text style={styles.nudge}>Rate a few finished books to get suggestions</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.kicker}>What to read next</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, wide && styles.rowWide]}>
        {visible.map((row) => {
          const hit = hitFromRecommendation(row);
          const saved = savedWorkIds.has(row.workId);
          const adding = addingWorkId === row.workId;
          return (
            <Pressable
              key={row.workId}
              onPress={() => onOpen(hit)}
              style={[styles.card, wide && styles.cardWide]}>
              <View style={styles.strip}>
                {row.coverUrl ? (
                  <Image source={{ uri: row.coverUrl }} style={styles.cover} />
                ) : (
                  <View style={styles.cover} />
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {row.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {row.reason}
                </Text>
                <View style={styles.actions}>
                  {saved ? (
                    <Text style={[styles.action, styles.actionDone]}>Added</Text>
                  ) : (
                    <Pressable
                      onPress={() => onAdd(hit)}
                      disabled={adding}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${row.title}`}>
                      <Text style={styles.action}>{adding ? '…' : '+'}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => void onDismiss(row.workId)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Dismiss ${row.title}`}>
                    <Text style={styles.dismiss}>×</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 8 },
  kicker: { color: colors.text, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  nudge: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  row: { gap: space.md, paddingRight: space.md },
  rowWide: { paddingRight: 0 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    width: 220,
  },
  cardWide: { width: 260 },
  strip: { height: 132, backgroundColor: colors.bgHover },
  cover: { width: '100%', height: '100%', backgroundColor: colors.bg },
  cardBody: { gap: 4, padding: 12 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  actions: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  action: { color: colors.accent, fontSize: 22, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  actionDone: { color: colors.textDim, fontSize: 13 },
  dismiss: { color: colors.textMuted, fontSize: 22, fontWeight: '700', minWidth: 28, textAlign: 'center' },
});
