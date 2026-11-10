import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import type { ProfileItem, ProfileItemKind, PublicProfile } from '@kinexus/domain';

import {
  blockCreatorProfile,
  fetchPublicCreatorProfile,
  reportCreatorProfile,
} from '@/src/features/creators/creators-api';
import { Btn, Field } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { ProfileAvatar } from '@/src/features/shell/ProfileAvatar';
import { EmptyState, ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { SETTINGS_HREF } from '@/src/features/shell/modules';
import { useAuth } from '@/src/lib/auth';
import { confirmAction } from '@/src/lib/confirm';

const KIND_TABS: { kind: ProfileItemKind; label: string }[] = [
  { kind: 'recipe', label: 'Recipes' },
  { kind: 'workout', label: 'Workouts' },
  { kind: 'plan', label: 'Plans' },
  { kind: 'watchlist', label: 'Watchlists' },
];

const PAGE_SIZE = 20;

function itemHref(item: ProfileItem): Href {
  switch (item.kind) {
    case 'recipe':
      return `/recipes/${encodeURIComponent(item.id)}` as Href;
    case 'workout':
      return `/train/${encodeURIComponent(item.id)}` as Href;
    case 'plan':
      return '/train/plan' as Href;
    case 'watchlist':
      return '/stash/watchlist' as Href;
  }
}

export function PublicCreatorProfileScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const key = typeof params.key === 'string' ? params.key : Array.isArray(params.key) ? params.key[0] : '';
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindPresence, setKindPresence] = useState<Partial<Record<ProfileItemKind, boolean>>>({});
  const [activeKind, setActiveKind] = useState<ProfileItemKind>('recipe');
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwn = Boolean(user && !user.isDevBypass && profile && user.id === profile.permanentId);
  const visibleTabs = useMemo(
    () => KIND_TABS.filter((tab) => kindPresence[tab.kind]),
    [kindPresence],
  );

  const load = useCallback(async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    setActionError(null);
    try {
      const probes = await Promise.all(
        KIND_TABS.map(async (tab) => {
          try {
            const res = await fetchPublicCreatorProfile(trimmed, { kind: tab.kind, limit: 1 });
            return { tab: tab.kind, profile: res.profile, hasItems: res.items.length > 0 };
          } catch (err) {
            const message = err instanceof Error ? err.message : '';
            if (/not found|404|hidden|blocked|isn't available/i.test(message)) {
              return { tab: tab.kind, profile: null, hasItems: false, unavailable: true as const };
            }
            throw err;
          }
        }),
      );
      const firstUnavailable = probes.find((row) => 'unavailable' in row && row.unavailable);
      const found = probes.find((row) => row.profile);
      if (!found?.profile || firstUnavailable) {
        setProfile(null);
        setUnavailable(true);
        setItems([]);
        setKindPresence({});
        return;
      }
      const presence: Partial<Record<ProfileItemKind, boolean>> = {};
      for (const row of probes) {
        if (row.profile) presence[row.tab] = row.hasItems;
      }
      // Always keep a tab that currently has content; fall back to first present kind.
      const initialKind =
        KIND_TABS.find((tab) => presence[tab.kind])?.kind ??
        KIND_TABS[0]!.kind;
      const page = await fetchPublicCreatorProfile(trimmed, { kind: initialKind, limit: PAGE_SIZE });
      setProfile(page.profile);
      setKindPresence(presence);
      setActiveKind(initialKind);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load profile';
      if (/not found|404/i.test(message)) {
        setUnavailable(true);
        setProfile(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectKind(kind: ProfileItemKind) {
    if (!key.trim() || kind === activeKind) return;
    setActiveKind(kind);
    setLoadingMore(false);
    setError(null);
    try {
      const page = await fetchPublicCreatorProfile(key.trim(), { kind, limit: PAGE_SIZE });
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setProfile(page.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load items');
    }
  }

  async function loadMore() {
    if (!key.trim() || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPublicCreatorProfile(key.trim(), {
        kind: activeKind,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }

  async function onReport() {
    const reason = reportReason.trim();
    if (!reason || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await reportCreatorProfile(key.trim(), reason);
      setReportOpen(false);
      setReportReason('');
      setMenuOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not report');
    } finally {
      setActionBusy(false);
    }
  }

  async function onBlock() {
    if (actionBusy) return;
    const ok = await confirmAction('Block this profile?', 'You won’t see their public profile or content.');
    if (!ok) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await blockCreatorProfile(key.trim());
      setMenuOpen(false);
      setUnavailable(true);
      setProfile(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not block');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <LoadingState label="Loading profile" />
        </View>
      </View>
    );
  }

  if (unavailable || !profile) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <Text style={styles.brand}>Kinexus</Text>
          <EmptyState title="This profile isn't available" body="It may be private, blocked, or no longer exist." />
          {error ? <ErrorBanner message={error} /> : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Kinexus</Text>

      <View style={styles.header}>
        <ProfileAvatar avatarUrl={profile.avatarPreset} size={72} />
        <View style={styles.headerText}>
          <View style={styles.handleRow}>
            <Text style={styles.handle}>@{profile.handle}</Text>
            {profile.isVerified ? (
              <Text style={styles.verified} accessibilityLabel="Verified">
                ✓
              </Text>
            ) : null}
          </View>
          {isOwn ? (
            <Btn label="Edit profile" variant="secondary" onPress={() => router.push(SETTINGS_HREF)} />
          ) : user && !user.isDevBypass ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Profile actions"
              hitSlop={8}
              style={styles.menuBtn}>
              <Text style={styles.menuBtnLabel}>⋯</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {profile.links.length > 0 ? (
        <View style={styles.links}>
          {profile.links.map((link) => (
            <Pressable
              key={link.url}
              onPress={() => void Linking.openURL(link.url)}
              accessibilityRole="link"
              style={styles.linkRow}>
              <Text style={styles.linkLabel} numberOfLines={1}>
                {link.label?.trim() || link.url.replace(/^https:\/\//i, '')}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ErrorBanner message={error ?? actionError} />

      {visibleTabs.length > 0 ? (
        <View style={styles.tabs}>
          {visibleTabs.map((tab) => (
            <Pressable
              key={tab.kind}
              onPress={() => void selectKind(tab.kind)}
              style={[styles.tab, activeKind === tab.kind && styles.tabActive]}>
              <Text style={[styles.tabLabel, activeKind === tab.kind && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState title="Nothing public yet" body="This creator hasn’t shared any public items." />
      )}

      {visibleTabs.length > 0 ? (
        <View style={styles.items}>
          {items.length === 0 ? (
            <Text style={styles.emptyTab}>No items</Text>
          ) : (
            items.map((item) => (
              <Pressable
                key={`${item.kind}-${item.id}`}
                onPress={() => router.push(itemHref(item))}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            ))
          )}
          {nextCursor ? (
            <Btn
              label={loadingMore ? 'Loading…' : 'Load more'}
              variant="secondary"
              busy={loadingMore}
              onPress={() => void loadMore()}
            />
          ) : null}
        </View>
      ) : null}

      <Text style={styles.permanentId}>{profile.permanentId}</Text>

      <Sheet visible={menuOpen} title="Profile" onClose={() => setMenuOpen(false)}>
        <View style={styles.menuStack}>
          <Btn
            label="Report"
            variant="secondary"
            onPress={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          />
          <Btn label="Block" variant="danger" busy={actionBusy} onPress={() => void onBlock()} />
        </View>
      </Sheet>

      <Sheet visible={reportOpen} title="Report" onClose={() => setReportOpen(false)}>
        <View style={styles.menuStack}>
          <Field
            label="Reason"
            value={reportReason}
            onChangeText={setReportReason}
            placeholder="Why are you reporting this profile?"
            multiline
          />
          <Btn
            label="Submit report"
            busy={actionBusy}
            disabled={!reportReason.trim()}
            onPress={() => void onReport()}
          />
          <ErrorBanner message={actionError} />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    gap: 16,
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  headerText: { flex: 1, minWidth: 0, gap: 10 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  handle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  verified: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  menuBtn: {
    alignSelf: 'flex-start',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  menuBtnLabel: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  bio: { color: colors.text, fontSize: 15, lineHeight: 22 },
  links: { gap: 8 },
  linkRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  linkLabel: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  tabActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  tabLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: colors.accent },
  items: { gap: 10 },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  itemPressed: { backgroundColor: colors.bgHover },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  emptyTab: { color: colors.textMuted, fontSize: 14 },
  permanentId: {
    marginTop: 12,
    color: colors.textDim,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  menuStack: { gap: 12, paddingBottom: 12 },
});
