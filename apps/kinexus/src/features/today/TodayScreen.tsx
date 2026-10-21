import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NewsTopicPriorities } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { fetchOverviewNews } from '@/src/features/today/api';
import { DailyHud } from '@/src/features/today/DailyHud';
import { WeatherReadout, WeatherSheet } from '@/src/features/today/WeatherSheet';
import { EMPTY_OVERVIEW, loadOverviewPrefs, persistOverviewPrefs, type OverviewPrefs } from '@/src/features/today/prefs';
import { MorePuzzles, SudokuCard } from '@/src/features/today/puzzles/PuzzlesCard';
import { WordleCard } from '@/src/features/today/WordleCard';
import type { AuthUser } from '@/src/lib/auth';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

function headlineWhen(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const then = Date.parse(publishedAt);
  if (!Number.isFinite(then)) return null;
  const hours = Math.max(0, Math.round((Date.now() - then) / 3_600_000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

export function TodayScreen() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['overview-prefs', user?.id],
    enabled: Boolean(user),
    queryFn: () => loadOverviewPrefs(user!),
  });

  if (!user || query.isLoading) return <LoadingState label="Opening Today…" />;
  if (query.isError) {
    return (
      <View style={styles.fallback}>
        <ErrorBanner message={query.error instanceof Error ? query.error.message : 'Could not load your overview.'} />
        <Btn label="Try again" onPress={() => void query.refetch()} />
      </View>
    );
  }

  const prefs = query.data ?? EMPTY_OVERVIEW;
  const newsKey = JSON.stringify({ interests: prefs.newsInterests, topics: prefs.topicPriorities });
  return <TodayBody key={`${user.id}:${newsKey}`} user={user} initial={prefs} />;
}

function TodayBody({ user, initial }: { user: AuthUser; initial: OverviewPrefs }) {
  const queryClient = useQueryClient();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const [prefs, setPrefs] = useState(initial);
  const prefsRef = useRef(initial);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [pickingPlace, setPickingPlace] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);

  const commit = (update: (current: OverviewPrefs) => OverviewPrefs) => {
    const next = update(prefsRef.current);
    const rev = ++revision.current;
    prefsRef.current = next;
    setPrefs(next);
    setSaveError(null);
    setSaving(true);
    queryClient.setQueryData<OverviewPrefs>(['overview-prefs', user.id], (cached) => update(cached ?? next));
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        const saved = await persistOverviewPrefs(user, update);
        if (rev === revision.current) {
          queryClient.setQueryData(['overview-prefs', user.id], saved);
          setSaving(false);
        }
      } catch (err: unknown) {
        if (rev !== revision.current) return;
        setSaving(false);
        setSaveError(err instanceof Error ? err.message : 'Could not save your overview.');
      }
    });
  };

  return (
    <ScrollView
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <DailyHud
        user={user}
        desktop={desktop}
        weather={
          <WeatherReadout
            place={prefs.weather}
            onPress={() => {
              setPickingPlace(prefs.weather == null);
              setWeatherOpen(true);
            }}
          />
        }
      />
      <WeatherSheet
        visible={weatherOpen}
        place={prefs.weather}
        pickingPlace={pickingPlace}
        saving={saving}
        saveError={saveError}
        onClose={() => {
          setWeatherOpen(false);
          setPickingPlace(false);
        }}
        onChangePlace={() => setPickingPlace(true)}
        onBackToForecast={() => setPickingPlace(false)}
        onPick={(weather) => {
          commit((current) => ({ ...current, weather }));
          setPickingPlace(false);
        }}
      />

      <View style={desktop ? styles.gameRow : styles.gameStack}>
        <View style={desktop ? styles.gameSlot : styles.gameSlotStack}>
          <WordleCard />
        </View>
        <View style={desktop ? styles.gameSlot : styles.gameSlotStack}>
          <SudokuCard />
        </View>
      </View>
      <MorePuzzles />
      <NewsCard interests={prefs.newsInterests} topicPriorities={prefs.topicPriorities} />
    </ScrollView>
  );
}

function NewsCard({
  interests,
  topicPriorities,
}: {
  interests: string[];
  topicPriorities: NewsTopicPriorities;
}) {
  const router = useRouter();
  const news = useQuery({
    queryKey: ['overview-news', interests.join('|'), JSON.stringify(topicPriorities)],
    enabled: interests.length > 0,
    queryFn: () => fetchOverviewNews(interests, topicPriorities),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <View style={styles.card}>
      <View style={styles.newsHeader}>
        <View style={styles.newsHeaderCopy}>
          <Text style={styles.cardKicker}>News</Text>
          <Text style={styles.cardTitle}>Headlines you follow</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings/news' as Href)}
          style={styles.extrasBtn}>
          <Text style={styles.extrasBtnLabel}>{interests.length > 0 ? 'Topics' : 'Choose topics'}</Text>
        </Pressable>
      </View>
      {interests.length === 0 ? (
        <Text style={styles.cardBody}>
          Choose the topics you want here. Narrower picks, such as gaming, stay in Settings until you change them.
        </Text>
      ) : null}
      {news.isLoading ? <Text style={styles.cardBody}>Gathering headlines…</Text> : null}
      {news.isError ? (
        <ErrorText message={news.error instanceof Error ? news.error.message : 'Headlines are unavailable right now.'} />
      ) : null}
      {news.data?.map((section) => (
        <View key={section.interest} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.interest}</Text>
          {section.error ? <Text style={styles.cardBody}>{section.error}</Text> : null}
          {section.headlines.map((headline) => {
            const when = headlineWhen(headline.publishedAt);
            return (
              <Pressable
                key={headline.url}
                onPress={() => void Linking.openURL(headline.url)}
                accessibilityRole="link"
                style={styles.headline}>
                <Text style={styles.headlineTitle}>{headline.title}</Text>
                <Text style={styles.cardBody}>
                  {headline.source}
                  {when ? ` · ${when}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {interests.length > 0 ? <Text style={styles.credit}>Headlines from Google News, across many outlets</Text> : null}
    </View>
  );
}


const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: 48,
    gap: 16,
  },
  contentDesktop: {
    paddingHorizontal: 40,
    paddingTop: 36,
    maxWidth: 1080,
    width: '100%',
    alignSelf: 'center',
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  gameStack: {
    gap: 16,
  },
  gameSlot: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  gameSlotStack: {
    alignSelf: 'stretch',
  },
  extrasBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extrasBtnOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  extrasBtnLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  extrasBtnLabelOn: {
    color: colors.bg,
  },
  fallback: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: space.lg,
    gap: 12,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 16,
  },
  stack: {
    gap: 16,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 12,
  },
  cardKicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  newsHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  section: {
    gap: 8,
    paddingTop: 4,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headline: {
    gap: 2,
    paddingVertical: 4,
  },
  headlineTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  credit: {
    color: colors.textDim,
    fontSize: 12,
  },
});
