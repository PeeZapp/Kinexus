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

import { OptionTiles } from '@/src/features/household/option-tiles';
import { BackLink, Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { ErrorBanner, LoadingState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { loadOverviewPrefs, persistOverviewPrefs, type OverviewPrefs } from '@/src/features/today/prefs';
import { useAuth } from '@/src/lib/auth';

export function NewsTopicsLink() {
  const router = useRouter();
  return (
    <Card>
      <Text style={styles.linkHeading}>News topics</Text>
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
      <BackLink label="Preferences" onPress={() => router.replace('/settings/preferences' as Href)} />
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

  const customInterests = interests.filter(
    (interest) => !NEWS_INTEREST_SUGGESTIONS.some((item) => item.toLowerCase() === interest.toLowerCase()),
  );

  return (
    <View style={styles.form}>
      <OptionTiles
        label="Interests"
        rows={NEWS_INTEREST_SUGGESTIONS.map((interest) => ({
          key: interest,
          label: interest,
          active: chosen.has(interest.toLowerCase()),
          onPress: () => {
            if (chosen.has(interest.toLowerCase())) {
              onChangeInterests(interests.filter((item) => item.toLowerCase() !== interest.toLowerCase()));
            } else {
              add(interest);
            }
          },
        }))}
      />
      {customInterests.length > 0 ? (
        <OptionTiles
          label="Yours"
          rows={customInterests.map((interest) => ({
            key: `custom-${interest}`,
            label: interest,
            active: true,
            onPress: () => onChangeInterests(interests.filter((item) => item !== interest)),
          }))}
        />
      ) : null}
      <Field
        label="Custom interest"
        value={draft}
        onChangeText={setDraft}
        placeholder="Local politics…"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        editable={interests.length < NEWS_INTEREST_LIMIT}
        onSubmitEditing={() => add(draft)}
      />
      <View style={styles.inlineActions}>
        <Btn
          label="Add"
          onPress={() => add(draft)}
          disabled={!draft.trim() || interests.length >= NEWS_INTEREST_LIMIT}
        />
      </View>
      {note ? <Text style={styles.meta}>{note}</Text> : null}
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

  const customValues = values.filter(
    (value) => !config.suggestions.some((suggestion) => suggestion.toLowerCase() === value.toLowerCase()),
  );

  return (
    <View style={styles.section}>
      <OptionTiles
        label={config.label}
        rows={config.suggestions.map((suggestion) => ({
          key: suggestion,
          label: suggestion,
          active: chosen.has(suggestion.toLowerCase()),
          onPress: () => {
            if (chosen.has(suggestion.toLowerCase())) {
              onChange(values.filter((item) => item.toLowerCase() !== suggestion.toLowerCase()));
            } else {
              add(suggestion);
            }
          },
        }))}
      />
      {customValues.length > 0 ? (
        <OptionTiles
          label="Yours"
          rows={customValues.map((value) => ({
            key: `custom-${value}`,
            label: value,
            active: true,
            onPress: () => onChange(values.filter((item) => item !== value)),
          }))}
        />
      ) : null}
      <Field
        label={`Custom ${config.noun}`}
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
          label="Add"
          onPress={() => add(draft)}
          disabled={!draft.trim() || values.length >= NEWS_TOPIC_PRIORITY_LIMIT}
        />
      </View>
      {note ? <Text style={styles.meta}>{note}</Text> : null}
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
  form: {
    gap: 12,
  },
  meta: {
    color: colors.textDim,
    fontSize: 13,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: {
    gap: 8,
    paddingTop: 8,
  },
  linkHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
});
