import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
} from '@kinexus/domain';

import { BackLink, Btn, Card, ErrorText, Field, Pill } from '@/src/features/household/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { loadOverviewPrefs, persistOverviewPrefs, type OverviewPrefs } from '@/src/features/today/prefs';
import { useAuth } from '@/src/lib/auth';

export function NewsTopicsLink() {
  const router = useRouter();
  return (
    <Card>
      <Text style={styles.linkHeading}>News topics</Text>
      <Text style={styles.linkBody}>
        Interests on your overview, including narrower picks such as gaming. Set them once, then change them here.
      </Text>
      <Btn label="Choose topics" onPress={() => router.push('/settings/news' as Href)} />
    </Card>
  );
}

export function NewsTopicsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['overview-prefs', user?.id],
    enabled: Boolean(user),
    queryFn: () => loadOverviewPrefs(user!),
  });
  const [prefs, setPrefs] = useState<OverviewPrefs | null>(null);
  const prefsRef = useRef<OverviewPrefs | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    if (!query.data || prefsRef.current) return;
    prefsRef.current = query.data;
    setPrefs(query.data);
  }, [query.data]);

  if (!prefs) {
    if (query.isError) {
      return (
        <View style={styles.fallback}>
          <ErrorBanner message={query.error instanceof Error ? query.error.message : 'Could not load your topics.'} />
        </View>
      );
    }
    return <LoadingState label="Opening topics…" />;
  }

  if (!user) return <LoadingState label="Opening topics…" />;

  const commit = (update: (current: OverviewPrefs) => OverviewPrefs) => {
    const base = prefsRef.current ?? prefs;
    const next = update(base);
    prefsRef.current = next;
    setPrefs(next);
    setSaveError(null);
    queryClient.setQueryData<OverviewPrefs>(['overview-prefs', user.id], (cached) => update(cached ?? next));
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        const saved = await persistOverviewPrefs(user, update);
        if (prefsRef.current === next) {
          prefsRef.current = saved;
          setPrefs(saved);
          queryClient.setQueryData(['overview-prefs', user.id], saved);
        }
      } catch (err: unknown) {
        setSaveError(err instanceof Error ? err.message : 'Could not save your topics.');
      }
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackLink label="Settings" onPress={() => router.replace('/settings' as Href)} />
      <Text style={styles.kicker}>Overview</Text>
      <Text style={styles.title}>News topics</Text>
      <Text style={styles.lede}>
        Choose what shows in Headlines. Topics with extra choices, such as gaming, are set here and stay off the overview until you change them.
      </Text>
      <ErrorText message={saveError} />
      <NewsTopicForm
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

function NewsTopicForm({
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
    <View style={styles.form}>
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
        <Btn
          label="Add interest"
          onPress={() => add(draft)}
          disabled={!draft.trim() || interests.length >= NEWS_INTEREST_LIMIT}
        />
      </View>
      {note ? <Text style={styles.body}>{note}</Text> : null}
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
        <Text style={styles.body}>No interests yet.</Text>
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
      <Text style={styles.body}>{config.blurb}</Text>
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
      {note ? <Text style={styles.body}>{note}</Text> : null}
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
        <Text style={styles.body}>{config.emptyHint}</Text>
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
  fallback: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: space.lg,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: 64,
    maxWidth: 720,
    width: '100%',
    gap: 12,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: space.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.sm,
  },
  form: {
    gap: 12,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: {
    gap: 8,
    paddingTop: 8,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  linkHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  linkBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
});
