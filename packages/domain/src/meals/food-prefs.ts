import { ALLERGEN_OPTIONS, EQUIPMENT_OPTIONS, normalizeFoodTags } from './food-tags';
import type { Recipe } from './types';

export type HouseholdFoodPrefsInput = {
  cuisines?: readonly string[];
  allergies?: readonly string[];
  equipment?: readonly string[];
};

const ALLERGEN_IDS = new Set(ALLERGEN_OPTIONS.map((option) => option.id));
const EQUIPMENT_IDS = new Set(EQUIPMENT_OPTIONS.map((option) => option.id));

function tagSet(list: readonly string[] | undefined): Set<string> {
  return new Set(normalizeFoodTags(list ?? []).map((tag) => tag.toLowerCase()));
}

/** Recipe cuisine labels used for variety / soft bias. */
export function recipeCuisineKeys(recipe: Recipe): string[] {
  const fromMulti = (recipe.cuisines ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (fromMulti.length > 0) return [...new Set(fromMulti)];
  const single = recipe.cuisine?.trim().toLowerCase();
  return single ? [single] : ['unknown'];
}

export function recipeConflictsHouseholdAllergies(
  recipe: Recipe,
  allergies: readonly string[] | undefined,
): boolean {
  const blocked = tagSet(allergies);
  if (blocked.size === 0) return false;
  const allergens = tagSet(recipe.allergens);
  for (const allergen of allergens) {
    if (blocked.has(allergen)) return true;
  }
  return false;
}

/**
 * Empty recipe equipment = always eligible.
 * Otherwise every tagged item must be present in household equipment.
 * Empty household equipment = no filter (caller should skip).
 */
export function recipeFitsHouseholdEquipment(
  recipe: Recipe,
  equipment: readonly string[] | undefined,
): boolean {
  const needed = tagSet(recipe.equipment);
  if (needed.size === 0) return true;
  const owned = tagSet(equipment);
  if (owned.size === 0) return true;
  for (const item of needed) {
    if (!owned.has(item)) return false;
  }
  return true;
}

export function filterRecipesForFoodPrefs(
  recipes: readonly Recipe[],
  prefs: HouseholdFoodPrefsInput | null | undefined,
): Recipe[] {
  if (!prefs) return [...recipes];
  const allergies = normalizeFoodTags(prefs.allergies ?? []);
  const equipment = normalizeFoodTags(prefs.equipment ?? []);
  const filterAllergies = allergies.length > 0;
  const filterEquipment = equipment.length > 0;
  if (!filterAllergies && !filterEquipment) return [...recipes];

  return recipes.filter((recipe) => {
    if (filterAllergies && recipeConflictsHouseholdAllergies(recipe, allergies)) return false;
    if (filterEquipment && !recipeFitsHouseholdEquipment(recipe, equipment)) return false;
    return true;
  });
}

/** Soft score boost (higher = better for preferred cuisines). Lower is better in generate scoring — use as a subtract. */
export function preferredCuisineBoost(
  recipe: Recipe,
  preferredCuisines: readonly string[] | undefined,
  amount = 40,
): number {
  const preferred = tagSet(preferredCuisines);
  if (preferred.size === 0) return 0;
  const keys = recipeCuisineKeys(recipe);
  return keys.some((key) => preferred.has(key)) ? amount : 0;
}

export function overlappingHouseholdAllergens(
  recipe: Recipe,
  allergies: readonly string[] | undefined,
): string[] {
  const blocked = tagSet(allergies);
  if (blocked.size === 0) return [];
  const out: string[] = [];
  for (const allergen of tagSet(recipe.allergens)) {
    if (blocked.has(allergen)) out.push(allergen);
  }
  return out;
}

/** Allergens on optional ingredients that overlap household allergies (do not hard-filter generate). */
export function overlappingOptionalIngredientAllergens(
  recipe: Recipe,
  allergies: readonly string[] | undefined,
): string[] {
  const blocked = tagSet(allergies);
  if (blocked.size === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ingredient of recipe.ingredients ?? []) {
    if (!ingredient.optional) continue;
    for (const allergen of tagSet(ingredient.allergens)) {
      if (!blocked.has(allergen) || seen.has(allergen)) continue;
      seen.add(allergen);
      out.push(allergen);
    }
  }
  return out;
}

function allergenLabels(ids: readonly string[]): string[] {
  return ids.map((id) => {
    const option = ALLERGEN_OPTIONS.find((item) => item.id === id);
    return option?.label ?? id;
  });
}

export function householdAllergenAlertLabel(
  recipe: Recipe,
  allergies: readonly string[] | undefined,
): string | null {
  const required = overlappingHouseholdAllergens(recipe, allergies);
  if (required.length > 0) return `Contains: ${allergenLabels(required).join(', ')}`;
  const optional = overlappingOptionalIngredientAllergens(recipe, allergies);
  if (optional.length > 0) return `Optional: ${allergenLabels(optional).join(', ')}`;
  return null;
}

export function knownAllergenId(value: string): string | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  if (ALLERGEN_IDS.has(key)) return key;
  const byLabel = ALLERGEN_OPTIONS.find((option) => option.label.toLowerCase() === key);
  return byLabel?.id ?? null;
}

export function knownEquipmentId(value: string): string | null {
  const key = value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!key) return null;
  if (EQUIPMENT_IDS.has(key)) return key;
  const byLabel = EQUIPMENT_OPTIONS.find((option) => option.label.toLowerCase() === value.trim().toLowerCase());
  return byLabel?.id ?? null;
}
