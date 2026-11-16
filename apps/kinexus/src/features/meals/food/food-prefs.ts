import { useQuery } from '@tanstack/react-query';

import { normalizeFoodTags } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

export type HouseholdFoodPrefs = {
  householdId: string;
  cuisines: string[];
  allergies: string[];
  equipment: string[];
};

export function emptyFoodPrefs(householdId: string): HouseholdFoodPrefs {
  return { householdId, cuisines: [], allergies: [], equipment: [] };
}

export function foodPrefsKey(householdId: string) {
  return ['meals', 'food-prefs', householdId] as const;
}

export function normalizeHouseholdFoodPrefs(prefs: HouseholdFoodPrefs) {
  return {
    cuisines: normalizeFoodTags(prefs.cuisines),
    allergies: normalizeFoodTags(prefs.allergies),
    equipment: normalizeFoodTags(prefs.equipment),
  };
}

export function foodPrefsEqual(a: HouseholdFoodPrefs, b: HouseholdFoodPrefs): boolean {
  const left = normalizeHouseholdFoodPrefs(a);
  const right = normalizeHouseholdFoodPrefs(b);
  return (
    left.cuisines.join('|') === right.cuisines.join('|') &&
    left.allergies.join('|') === right.allergies.join('|') &&
    left.equipment.join('|') === right.equipment.join('|')
  );
}

export async function fetchHouseholdFoodPrefs(householdId: string): Promise<HouseholdFoodPrefs> {
  if (!supabase) return emptyFoodPrefs(householdId);
  const { data, error } = await supabase
    .from('household_food_prefs')
    .select('household_id,cuisines,allergies,equipment')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return emptyFoodPrefs(householdId);
  return {
    householdId: data.household_id,
    cuisines: data.cuisines ?? [],
    allergies: data.allergies ?? [],
    equipment: data.equipment ?? [],
  };
}

export async function saveHouseholdFoodPrefs(prefs: HouseholdFoodPrefs): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const normalized = normalizeHouseholdFoodPrefs(prefs);
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

export function useHouseholdFoodPrefs(householdId: string | null | undefined) {
  return useQuery({
    queryKey: householdId ? foodPrefsKey(householdId) : ['meals', 'food-prefs', 'none'],
    enabled: Boolean(householdId),
    queryFn: () => fetchHouseholdFoodPrefs(householdId!),
  });
}
