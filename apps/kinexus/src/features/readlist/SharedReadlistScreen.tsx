import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { readStatusLabel } from '@kinexus/domain';

import { creatorProfileHref } from '@/src/features/creators/creators-api';
import { addReadlistItem, ensureDefaultReadlist } from '@/src/features/readlist/readlist-api';
import { authorLine } from '@/src/features/readlist/readlist-model';
import { fetchSharedReadlist, type SharedReadlistResponse } from '@/src/features/share/share-api';
import { StashPhoto } from '@/src/features/stash/StashShared';
import { Btn } from '@/src/features/household/ui';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { supabase } from '@/src/lib/supabase';

export function SharedReadlistScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const router = useRouter();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const [data, setData] = useState<SharedReadlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const signedIn = Boolean(user && !user.isDevBypass && activeHousehold && supabase);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token.trim()) {
        setError('Missing share link');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = await fetchSharedReadlist(token);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function addToMine() {
    if (!data || !signedIn || !activeHousehold || busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const listId = await ensureDefaultReadlist(activeHousehold.id);
      const { data: existing, error: existingError } = await supabase!
        .from('readlist_items')
        .select('work_id')
        .eq('list_id', listId);
      if (existingError) throw existingError;
      const have = new Set((existing ?? []).map((row) => row.work_id));
      let added = 0;
      for (const book of data.books) {
        if (have.has(book.workId)) continue;
        await addReadlistItem({ listId, workId: book.workId, status: 'want_to_read' });
        have.add(book.workId);
        added += 1;
      }
      setStatus(added === 0 ? 'Already on your Readlist' : 'Added to your Readlist');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to your Readlist');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading shared list" />;
  if (error && !data) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <Text style={styles.brand}>Kinexus</Text>
          <ErrorBanner message={error} />
          <EmptyState title="List not found" body="This share link is invalid or the list is no longer shared." />
        </View>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <EmptyState title="List not found" body="This share link is invalid or the list is no longer shared." />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Kinexus</Text>
      <Text style={styles.title}>{data.name}</Text>
      <Text style={styles.meta}>
        {data.ownerUsername ? (
          <>
            <Text
              onPress={() => router.push(creatorProfileHref(data.ownerUsername!) as Href)}
              style={styles.ownerLink}
              accessibilityRole="link">
              @{data.ownerUsername}
            </Text>
            {' · '}
          </>
        ) : null}
        {data.books.length} book{data.books.length === 1 ? '' : 's'}
      </Text>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <ErrorBanner message={error} />
      {signedIn ? <Btn label="Add to my Readlist" onPress={() => void addToMine()} busy={busy} /> : null}

      {data.books.length === 0 ? (
        <EmptyState title="This list is empty" body="Nothing has been added yet." />
      ) : (
        <View style={styles.stack}>
          {data.books.map((book) => (
            <View key={book.workId} style={styles.card}>
              <StashPhoto uri={book.coverUrl} fallback="📚" size={88} />
              <View style={styles.cardBody}>
                <Text style={styles.type}>{readStatusLabel(book.status)}</Text>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {book.title}
                </Text>
                <Text style={styles.authors} numberOfLines={1}>
                  {authorLine({ authors: book.authors.map((name) => ({ name, openLibraryAuthorId: null })) })}
                </Text>
                {book.year ? <Text style={styles.year}>{book.year}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: 14, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 15 },
  ownerLink: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  status: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    gap: 14,
  },
  cardBody: { flex: 1, gap: 4, minWidth: 0 },
  type: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  authors: { color: colors.textMuted, fontSize: 13 },
  year: { color: colors.textMuted, fontSize: 13 },
});
