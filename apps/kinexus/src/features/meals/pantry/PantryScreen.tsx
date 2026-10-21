import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addPantryIngredients, matchRecipesToPantry, parsePantryIngredients, type PantryMatch } from '@kinexus/domain';

import { Btn, ErrorText, Field } from '@/src/features/household/ui';
import { recipeHref } from '@/src/features/meals/recipe-href';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

const STORAGE_PREFIX = 'kinexus.meals.pantry.';
const MATCH_CAP = 40;

export function PantryScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const meals = useMealsSync();
  const [pantry, setPantry] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meals.householdId) return;
    let cancelled = false;
    setReady(false);
    void AsyncStorage.getItem(STORAGE_PREFIX + meals.householdId).then((raw) => {
      if (cancelled) return;
      const next = parseStored(raw);
      setPantry(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [meals.householdId]);

  useEffect(() => {
    if (!ready || !meals.householdId) return;
    void AsyncStorage.setItem(STORAGE_PREFIX + meals.householdId, JSON.stringify(pantry));
  }, [meals.householdId, pantry, ready]);

  const matches = useMemo(
    () => matchRecipesToPantry(meals.recipes, pantry),
    [meals.recipes, pantry],
  );
  const readyMatches = matches.filter((match) => match.status === 'ready');
  const closeMatches = matches.filter((match) => match.status === 'close');

  function commitDraft() {
    const incoming = parsePantryIngredients(draft);
    if (incoming.length === 0) {
      setDraft('');
      return;
    }
    setPantry((current) => addPantryIngredients(current, incoming));
    setDraft('');
  }

  function onDraftChange(text: string) {
    if (!/[,;\n]/.test(text)) {
      setDraft(text);
      return;
    }
    const chunks = text.split(/[,;\n]/);
    const trailing = chunks.pop() ?? '';
    const incoming = parsePantryIngredients(chunks.join(','));
    if (incoming.length > 0) setPantry((current) => addPantryIngredients(current, incoming));
    setDraft(trailing.replace(/^\s+/, ''));
  }

  function removeIngredient(name: string) {
    setPantry((current) => current.filter((item) => item !== name));
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        desktop && styles.contentDesktop,
        !desktop && { paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>Kitchen</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>What can I make</Text>
      <Text style={styles.lede}>
        Add what’s in the kitchen. We’ll match it to your recipe library and show dishes you can cook now, plus ones you’re an ingredient or two away from.
      </Text>
      <Field
        label="Ingredients"
        value={draft}
        onChangeText={onDraftChange}
        onSubmitEditing={commitDraft}
        placeholder="chicken, rice, broccoli"
        returnKeyType="done"
        autoCapitalize="none"
      />
      <View style={styles.actions}>
        <Btn label="Add" onPress={commitDraft} disabled={!draft.trim()} />
        {pantry.length > 0 ? (
          <Btn label="Clear pantry" variant="ghost" onPress={() => setPantry([])} />
        ) : null}
      </View>
      {pantry.length > 0 ? (
        <View style={styles.chips}>
          {pantry.map((name) => (
            <Pressable
              key={name}
              onPress={() => removeIngredient(name)}
              accessibilityLabel={`Remove ${name}`}
              style={styles.chip}>
              <Text style={styles.chipLabel}>{name}</Text>
              <Text style={styles.chipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>Type an ingredient and press Add. Commas split a list.</Text>
      )}
      <Text style={styles.note}>Salt, pepper, oil, butter, and water are treated as already on hand.</Text>
      <ErrorText message={meals.error} />

      {pantry.length === 0 ? null : meals.isLoading && meals.recipes.length === 0 ? (
        <Text style={styles.hint}>Loading recipes…</Text>
      ) : matches.length === 0 ? (
        <Text style={styles.hint}>Nothing in the library is close to that list yet. Add a few more ingredients, or import a recipe that uses them.</Text>
      ) : (
        <>
          <MatchSection
            title="You can make"
            empty="Nothing uses only what you’ve listed."
            matches={readyMatches.slice(0, MATCH_CAP)}
            total={readyMatches.length}
            onOpen={(id) => router.push(recipeHref(id))}
          />
          <MatchSection
            title="Almost"
            empty="No dishes are just a few ingredients away."
            matches={closeMatches.slice(0, MATCH_CAP)}
            total={closeMatches.length}
            onOpen={(id) => router.push(recipeHref(id))}
          />
        </>
      )}
    </ScrollView>
  );
}

function MatchSection({
  title,
  empty,
  matches,
  total,
  onOpen,
}: {
  title: string;
  empty: string;
  matches: PantryMatch[];
  total: number;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
        {total > 0 ? ` · ${total}` : ''}
      </Text>
      {total > matches.length ? (
        <Text style={styles.hint}>Showing the closest {matches.length}.</Text>
      ) : null}
      {matches.length === 0 ? (
        <Text style={styles.hint}>{empty}</Text>
      ) : (
        matches.map((match) => (
          <Pressable key={match.recipe.id} onPress={() => onOpen(match.recipe.id)} style={styles.row}>
            <RecipePhoto uri={match.recipe.imageUrl} emoji={match.recipe.emoji} size={56} />
            <View style={styles.rowCopy}>
              <Text style={styles.name}>{match.recipe.name}</Text>
              <Text style={styles.meta}>
                {match.status === 'ready'
                  ? `Uses ${match.requiredCount} ingredient${match.requiredCount === 1 ? '' : 's'} you have`
                  : `Have ${match.covered.length} of ${match.requiredCount}`}
              </Text>
              {match.missing.length > 0 ? (
                <Text style={styles.missing}>Missing {match.missing.join(', ')}</Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

function parseStored(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: 12, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, maxWidth: 880 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  lede: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipRemove: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  note: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  section: { gap: 8, marginTop: 8 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  rowCopy: { flex: 1, gap: 2 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 12 },
  missing: { color: colors.warning, fontSize: 12, lineHeight: 17 },
});
