import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import {
  NEWS_INTEREST_LIMIT,
  NEWS_INTEREST_SUGGESTIONS,
  NEWS_TOPIC_PRIORITY_LIMIT,
  normalizeNewsInterests,
  normalizeNewsTopicPriorities,
  normalizeTopicPriorities,
  topicPriorityConfigsForInterests,
  type NewsTopicPriorities,
  type NewsTopicPriorityConfig,
  type OverviewPlace,
  type WeatherKind,
} from '@kinexus/domain';

import { Btn, ErrorText, Field, Pill } from '@/src/features/household/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { fetchOverviewNews, fetchOverviewWeather, searchOverviewPlaces, type PlaceSuggestion } from '@/src/features/today/api';
import { DailyHud } from '@/src/features/today/DailyHud';
import { EMPTY_OVERVIEW, loadOverviewPrefs, saveOverviewPrefs, type OverviewPrefs } from '@/src/features/today/prefs';
import { MorePuzzles, SudokuCard } from '@/src/features/today/puzzles/PuzzlesCard';
import { WordleCard } from '@/src/features/today/WordleCard';
import type { AuthUser } from '@/src/lib/auth';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';

const KIND_COLOR: Record<WeatherKind, string> = {
  clear: colors.warning,
  cloud: colors.textMuted,
  fog: colors.textDim,
  rain: colors.accent,
  snow: colors.text,
  storm: colors.danger,
};

const WEATHER_ART: Record<WeatherKind, ImageSourcePropType> = {
  clear: require('../../../assets/images/weather/weather-clear.jpg'),
  cloud: require('../../../assets/images/weather/weather-cloud.jpg'),
  fog: require('../../../assets/images/weather/weather-fog.jpg'),
  rain: require('../../../assets/images/weather/weather-rain.jpg'),
  snow: require('../../../assets/images/weather/weather-snow.jpg'),
  storm: require('../../../assets/images/weather/weather-storm.jpg'),
};

const WEATHER_WASH: Record<WeatherKind, string> = {
  clear: colors.warningBg,
  cloud: colors.bgHover,
  fog: colors.bgElevated,
  rain: colors.accentSoft,
  snow: colors.bgHover,
  storm: colors.dangerBg,
};

function placeShort(label: string): string {
  return label.split(',')[0]?.trim() || label;
}

function degrees(value: number): string {
  return `${Math.round(value)}°`;
}

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

  return <TodayBody key={user.id} user={user} initial={query.data ?? EMPTY_OVERVIEW} />;
}

function TodayBody({ user, initial }: { user: AuthUser; initial: OverviewPrefs }) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const [prefs, setPrefs] = useState(initial);
  const prefsRef = useRef(initial);
  const [pickingPlace, setPickingPlace] = useState(initial.weather == null);
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
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        await saveOverviewPrefs(user, next);
        if (rev === revision.current) setSaving(false);
      } catch (err: unknown) {
        if (rev !== revision.current) return;
        setSaving(false);
        setSaveError(err instanceof Error ? err.message : 'Could not save your overview.');
      }
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <DailyHud
        user={user}
        desktop={desktop}
        weather={<WeatherReadout place={prefs.weather} onPress={() => setPickingPlace(true)} />}
      >
        {pickingPlace ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Weather place</Text>
              {prefs.weather ? (
                <Pressable onPress={() => setPickingPlace(false)} hitSlop={6}>
                  <Text style={styles.link}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
            <PlaceSearch
              onPick={(weather) => {
                commit((current) => ({ ...current, weather }));
                setPickingPlace(false);
              }}
            />
            <ErrorText message={saveError} />
            {saving ? <Text style={styles.credit}>Saving…</Text> : null}
          </View>
        ) : null}
      </DailyHud>

      <View style={desktop ? styles.gameRow : styles.gameStack}>
        <View style={desktop ? styles.gameSlot : styles.gameSlotStack}>
          <WordleCard />
        </View>
        <View style={desktop ? styles.gameSlot : styles.gameSlotStack}>
          <SudokuCard />
        </View>
      </View>
      <MorePuzzles />
      <NewsCard
        interests={prefs.newsInterests}
        topicPriorities={prefs.topicPriorities}
        onChangeInterests={(newsInterests) =>
          commit((current) => ({
            ...current,
            newsInterests,
            topicPriorities: normalizeNewsTopicPriorities(newsInterests, current.topicPriorities),
          }))
        }
        onChangeTopicPriorities={(topicPriorities) => commit((current) => ({ ...current, topicPriorities }))}
      />
    </ScrollView>
  );
}

function WeatherReadout({ place, onPress }: { place: OverviewPlace | null; onPress: () => void }) {
  const forecast = useQuery({
    queryKey: ['overview-weather', place?.latitude, place?.longitude],
    enabled: place != null,
    queryFn: () => fetchOverviewWeather(place!),
    staleTime: 10 * 60 * 1000,
  });
  const current = forecast.data?.current;
  const kind = current?.kind ?? 'cloud';
  const label = !place ? 'Set a place' : forecast.isLoading ? 'Loading' : (current?.label ?? 'Weather');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change weather place"
      onPress={onPress}
      style={[styles.weatherChip, { backgroundColor: current ? WEATHER_WASH[kind] : colors.bgCard, borderColor: current ? KIND_COLOR[kind] : colors.border }]}>
      <Image source={WEATHER_ART[kind]} accessibilityIgnoresInvertColors style={styles.weatherArt} />
      <View style={styles.weatherCopy}>
        <Text style={[styles.weatherTemp, current ? { color: KIND_COLOR[kind] } : null]}>{current ? degrees(current.temperature) : '—'}</Text>
        <Text style={styles.weatherLabel} numberOfLines={1}>
          {label}
        </Text>
        {place ? (
          <Text style={styles.weatherPlace} numberOfLines={1}>
            {placeShort(place.label)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PlaceSearch({ onPick }: { onPick: (place: OverviewPlace) => void }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canLocate = Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const places = useQuery({
    queryKey: ['overview-places', submitted],
    enabled: submitted.length >= 2,
    queryFn: () => searchOverviewPlaces({ query: submitted }),
  });

  const pick = (place: PlaceSuggestion) => {
    onPick({
      label: place.label,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
    });
  };

  const locate = () => {
    if (!canLocate) return;
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void searchOverviewPlaces({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
          .then((found) => {
            const first = found[0];
            if (!first) throw new Error('No place matched this device.');
            pick(first);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not use this device’s location.');
          })
          .finally(() => setLocating(false));
      },
      () => {
        setLocating(false);
        setError('Location permission was denied. Search for a place instead.');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  };

  return (
    <View style={styles.search}>
      <Field
        label="Place"
        value={query}
        onChangeText={setQuery}
        placeholder="City or town"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => setSubmitted(query.trim())}
      />
      <View style={styles.inlineActions}>
        <Btn label="Search" variant="secondary" onPress={() => setSubmitted(query.trim())} />
        {canLocate ? <Btn label="Use this device" variant="ghost" busy={locating} onPress={locate} /> : null}
      </View>
      {submitted.length === 1 ? <Text style={styles.cardBody}>Enter at least two letters.</Text> : null}
      <ErrorText message={error ?? (places.error instanceof Error ? places.error.message : null)} />
      {places.data?.map((place) => (
        <Pressable key={`${place.id}-${place.label}`} onPress={() => pick(place)} style={styles.placeHit}>
          <Text style={styles.choiceTitle}>{place.label}</Text>
          {place.country ? <Text style={styles.cardBody}>{place.country}</Text> : null}
        </Pressable>
      ))}
      {places.data && places.data.length === 0 ? <Text style={styles.cardBody}>No places matched that name.</Text> : null}
    </View>
  );
}

function NewsCard({
  interests,
  topicPriorities,
  onChangeInterests,
  onChangeTopicPriorities,
}: {
  interests: string[];
  topicPriorities: NewsTopicPriorities;
  onChangeInterests: (interests: string[]) => void;
  onChangeTopicPriorities: (priorities: NewsTopicPriorities) => void;
}) {
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const topicConfigs = topicPriorityConfigsForInterests(interests);
  const news = useQuery({
    queryKey: ['overview-news', interests.join('|'), JSON.stringify(topicPriorities)],
    enabled: interests.length > 0,
    queryFn: () => fetchOverviewNews(interests, topicPriorities),
    staleTime: 10 * 60 * 1000,
  });
  const chosen = new Set(interests.map((interest) => interest.toLowerCase()));

  const add = (value: string) => {
    const next = normalizeNewsInterests([...interests, value]);
    if (next.length === interests.length) {
      setNote('Use 2–40 letters. You can add up to 8 interests.');
      return;
    }
    setNote(null);
    setDraft('');
    onChangeInterests(next);
  };

  const setTopicList = (topicKey: string, values: string[]) => {
    const next: NewsTopicPriorities = { ...topicPriorities };
    const normalized = normalizeTopicPriorities(topicKey, values);
    if (normalized.length > 0) next[topicKey] = normalized;
    else delete next[topicKey];
    onChangeTopicPriorities(next);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardKicker}>News</Text>
      <Text style={styles.cardTitle}>Headlines you follow</Text>
      <Text style={styles.cardBody}>
        Type any interest, such as gaming or fashion. Each one is a short list from several outlets.
      </Text>
      <Field
        label="Interest"
        value={draft}
        onChangeText={setDraft}
        placeholder="Gaming, fashion, local politics…"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        editable={interests.length < NEWS_INTEREST_LIMIT}
        onSubmitEditing={() => add(draft)}
      />
      <View style={styles.inlineActions}>
        <Btn label="Add interest" onPress={() => add(draft)} disabled={!draft.trim() || interests.length >= NEWS_INTEREST_LIMIT} />
      </View>
      {note ? <Text style={styles.cardBody}>{note}</Text> : null}
      {interests.length > 0 ? (
        <View style={styles.pills}>
          {interests.map((interest) => (
            <Pill
              key={interest}
              label={`${interest} ×`}
              active
              onPress={() => onChangeInterests(interests.filter((item) => item !== interest))}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.cardBody}>No interests yet.</Text>
      )}
      <View style={styles.pills}>
        {NEWS_INTEREST_SUGGESTIONS.filter((interest) => !chosen.has(interest.toLowerCase())).map((interest) => (
          <Pill key={interest} label={interest} onPress={() => add(interest)} />
        ))}
      </View>
      {topicConfigs.map((config) => (
        <TopicPriorityEditor
          key={config.key}
          config={config}
          values={topicPriorities[config.key] ?? []}
          onChange={(values) => setTopicList(config.key, values)}
        />
      ))}
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

function TopicPriorityEditor({
  config,
  values,
  onChange,
}: {
  config: NewsTopicPriorityConfig;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const chosen = new Set(values.map((value) => value.toLowerCase()));

  const add = (value: string) => {
    const next = normalizeTopicPriorities(config.key, [...values, value]);
    if (next.length === values.length) {
      setNote(`Use 2–40 letters. You can prioritise up to ${NEWS_TOPIC_PRIORITY_LIMIT} ${config.noun}s.`);
      return;
    }
    setNote(null);
    setDraft('');
    onChange(next);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{config.label}</Text>
      <Text style={styles.cardBody}>{config.blurb}</Text>
      <Field
        label={config.noun.charAt(0).toUpperCase() + config.noun.slice(1)}
        value={draft}
        onChangeText={setDraft}
        placeholder={config.placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        editable={values.length < NEWS_TOPIC_PRIORITY_LIMIT}
        onSubmitEditing={() => add(draft)}
      />
      <View style={styles.inlineActions}>
        <Btn
          label={`Add ${config.noun}`}
          onPress={() => add(draft)}
          disabled={!draft.trim() || values.length >= NEWS_TOPIC_PRIORITY_LIMIT}
        />
      </View>
      {note ? <Text style={styles.cardBody}>{note}</Text> : null}
      {values.length > 0 ? (
        <View style={styles.pills}>
          {values.map((value, index) => (
            <Pill
              key={value}
              label={`${index + 1}. ${value} ×`}
              active
              onPress={() => onChange(values.filter((item) => item !== value))}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.cardBody}>{config.emptyHint}</Text>
      )}
      <View style={styles.pills}>
        {config.suggestions
          .filter((suggestion) => !chosen.has(suggestion.toLowerCase()))
          .map((suggestion) => (
            <Pill key={suggestion} label={suggestion} onPress={() => add(suggestion)} />
          ))}
      </View>
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
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 320,
    paddingLeft: 6,
    paddingRight: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  weatherArt: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
  weatherCopy: {
    flexShrink: 1,
    gap: 1,
  },
  weatherTemp: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  weatherLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  weatherPlace: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  choiceCopy: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  choiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  nowTemp: {
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 52,
  },
  nowCopy: {
    flex: 1,
    gap: 4,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  day: {
    width: 92,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
  },
  dayName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  dayKind: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayTemp: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dayLow: {
    color: colors.textDim,
    fontWeight: '600',
  },
  dayRain: {
    color: colors.textDim,
    fontSize: 11,
  },
  search: {
    gap: 10,
  },
  placeHit: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
