import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ALLERGEN_OPTIONS, CUISINE_SUGGESTIONS, EQUIPMENT_OPTIONS, normalizeFoodTags } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { canManageMealPlan } from '@/src/features/meals/picker-access';
import { OptionTagEditor, StringTagEditor } from '@/src/features/meals/food/tag-editors';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useHousehold } from '@/src/lib/household';
import { supabase } from '@/src/lib/supabase';
import { LoadingState } from '@/src/features/shell/states';

type FoodPrefs = {
  householdId: string;
  cuisines: string[];
  allergies: string[];
  equipment: string[];
};

function emptyPrefs(householdId: string): FoodPrefs {
  return { householdId, cuisines: [], allergies: [], equipment: [] };
}

function prefsKey(householdId: string) {
  return ['meals', 'food-prefs', householdId] as const;
}

function normalizedPrefs(prefs: FoodPrefs) {
  return {
    cuisines: normalizeFoodTags(prefs.cuisines),
    allergies: normalizeFoodTags(prefs.allergies),
    equipment: normalizeFoodTags(prefs.equipment),
  };
}

function prefsEqual(a: FoodPrefs, b: FoodPrefs): boolean {
  const left = normalizedPrefs(a);
  const right = normalizedPrefs(b);
  return (
    left.cuisines.join('|') === right.cuisines.join('|') &&
    left.allergies.join('|') === right.allergies.join('|') &&
    left.equipment.join('|') === right.equipment.join('|')
  );
}

async function fetchFoodPrefs(householdId: string): Promise<FoodPrefs> {
  if (!supabase) return emptyPrefs(householdId);
  const { data, error } = await supabase
    .from('household_food_prefs')
    .select('household_id,cuisines,allergies,equipment')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return emptyPrefs(householdId);
  return {
    householdId: data.household_id,
    cuisines: data.cuisines ?? [],
    allergies: data.allergies ?? [],
    equipment: data.equipment ?? [],
  };
}

async function saveFoodPrefs(prefs: FoodPrefs): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const normalized = normalizedPrefs(prefs);
  const { error } = await supabase.from('household_food_prefs').upsert(
    {
      household_id: prefs.householdId,
      cuisines: normalized.cuisines,
      allergies: normalized.allergies,
      equipment: normalized.equipment,
    },
    { onConflict: 'household_id' },
  );
  if (error) throw error;
}

export function FoodSettingsScreen() {
  const queryClient = useQueryClient();
  const { activeHousehold, role } = useHousehold();
  const householdId = activeHousehold?.id ?? null;
  const canEdit = canManageMealPlan(role);

  const query = useQuery({
    queryKey: householdId ? prefsKey(householdId) : ['meals', 'food-prefs', 'none'],
    enabled: Boolean(householdId),
    queryFn: () => fetchFoodPrefs(householdId!),
  });

  const [prefs, setPrefs] = useState<FoodPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(null);
    setError(null);
  }, [householdId]);

  useEffect(() => {
    if (!householdId || !query.data || prefs) return;
    setPrefs(query.data);
  }, [householdId, prefs, query.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!prefs) return;
      await saveFoodPrefs(prefs);
    },
    onSuccess: async () => {
      if (!householdId || !prefs) return;
      await queryClient.invalidateQueries({ queryKey: prefsKey(householdId) });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not save food settings');
    },
  });

  const dirty = useMemo(() => (prefs && query.data ? !prefsEqual(prefs, query.data) : false), [prefs, query.data]);

  if (!householdId) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>Food prefs</Text>
        <Text style={styles.lede}>Pick a household first.</Text>
      </View>
    );
  }

  if (!prefs) {
    if (query.isError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Food prefs</Text>
          <ErrorText message={query.error instanceof Error ? query.error.message : 'Could not load food settings.'} />
        </View>
      );
    }
    return (
      <View style={styles.loading}>
        <LoadingState label="Opening food settings…" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Food prefs</Text>
      <ErrorText message={error} />

      <View style={styles.panel}>
        <Text style={styles.section}>Preferred cuisines</Text>
        <StringTagEditor
          label="Cuisines"
          placeholder="Italian"
          value={prefs.cuisines}
          suggestions={CUISINE_SUGGESTIONS}
          disabled={!canEdit}
          onChange={(cuisines) => setPrefs((current) => (current ? { ...current, cuisines } : current))}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.section}>Allergies</Text>
        <OptionTagEditor
          label="Allergies"
          options={ALLERGEN_OPTIONS}
          value={prefs.allergies}
          disabled={!canEdit}
          allowCustom
          customFieldLabel="Add allergen"
          customPlaceholder="Mustard"
          onChange={(allergies) => setPrefs((current) => (current ? { ...current, allergies } : current))}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.section}>Equipment</Text>
        <OptionTagEditor
          label="Equipment"
          options={EQUIPMENT_OPTIONS}
          value={prefs.equipment}
          disabled={!canEdit}
          allowCustom
          customFieldLabel="Add equipment"
          customPlaceholder="Pizza stone"
          emptyLabel="None"
          onChange={(equipment) => setPrefs((current) => (current ? { ...current, equipment } : current))}
        />
      </View>

      <View style={styles.actions}>
        <Btn
          label="Save"
          onPress={() => {
            setError(null);
            void save.mutateAsync();
          }}
          busy={save.isPending}
          disabled={!canEdit || !dirty || query.isFetching}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, paddingBottom: space.xl, gap: space.md, width: '100%', maxWidth: 820, alignSelf: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  lede: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  panel: {
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    padding: space.md,
  },
  section: { color: colors.text, fontSize: 16, fontWeight: '700' },
  actions: { gap: 8 },
  fallback: { flex: 1, backgroundColor: colors.bg, padding: space.md, gap: 12 },
  loading: { flex: 1, backgroundColor: colors.bg, padding: space.md },
});

