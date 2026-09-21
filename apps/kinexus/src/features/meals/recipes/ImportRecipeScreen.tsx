import { useState } from 'react';
import { useRouter } from 'expo-router';

import { type MealSlotKey, type Recipe } from '@kinexus/domain';

import { recipeHref } from '@/src/features/meals/recipe-href';
import { ImportDesktop } from '@/src/features/meals/recipes/ImportDesktop';
import { ImportMobile } from '@/src/features/meals/recipes/ImportMobile';
import type { ImportFormState } from '@/src/features/meals/recipes/ImportShared';
import { applyNutrition, draftFromForm, EMPTY_RECIPE_FORM, ingredientRowsFrom, methodRowsFrom, patchRecipeForm } from '@/src/features/meals/recipes/recipe-form';
import { resolveRecipeNutrition } from '@/src/features/meals/recipes/resolve-nutrition';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useExperienceMode } from '@/src/lib/experience-mode';
import {
  extractRecipeFromText,
  importRecipeFromUrl,
  isMealsApiConfigured,
  type ImportSource,
  type ImportedRecipe,
} from '@/src/lib/meals-api';

const SLOT_KEYS = new Set<string>([
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'night_snack',
  'dessert',
]);

export function ImportRecipeScreen() {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const meals = useMealsSync();
  const [tab, setTab] = useState<'url' | 'text'>('url');
  const [paste, setPaste] = useState('');
  const [form, setFormState] = useState<ImportFormState>(EMPTY_RECIPE_FORM);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'extracting'>('idle');
  const [source, setSource] = useState<ImportSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setForm(patch: Partial<ImportFormState>) {
    setFormState((current) => patchRecipeForm(current, patch));
  }

  function applyDraft(recipe: ImportedRecipe, nextSource: ImportSource, sourceUrl?: string) {
    const slots = (recipe.mealSlots ?? []).filter((slot): slot is MealSlotKey => SLOT_KEYS.has(slot));
    setFormState((current) => ({
      ...current,
      url: sourceUrl ?? current.url,
      name: recipe.name,
      emoji: recipe.emoji || '🍽️',
      cuisine: recipe.cuisine ?? '',
      cookTime: recipe.cookTime != null ? String(recipe.cookTime) : '',
      servings: recipe.servings != null ? String(recipe.servings) : '',
      calories: recipe.calories != null ? String(recipe.calories) : '',
      protein: recipe.protein != null ? String(recipe.protein) : '',
      carbs: recipe.carbs != null ? String(recipe.carbs) : '',
      fat: recipe.fat != null ? String(recipe.fat) : '',
      ingredients: ingredientRowsFrom(recipe.ingredients ?? []),
      method: methodRowsFrom(recipe.method ?? []),
      chefTip: recipe.chefTip ?? current.chefTip,
      notes: current.notes,
      slots: slots.length ? slots : ['dinner'],
    }));
    setSource(nextSource);
  }

  async function onExtract() {
    if (!meals.online) {
      setError(meals.importBlockedReason);
      return;
    }
    if (!isMealsApiConfigured()) {
      setError('Recipe API is not configured. Set EXPO_PUBLIC_API_URL and start the API server.');
      return;
    }
    setError(null);
    try {
      if (tab === 'text') {
        if (paste.trim().length < 20) {
          setError('Paste more of the recipe text.');
          return;
        }
        setPhase('extracting');
        const recipe = await extractRecipeFromText(paste.trim());
        applyDraft(recipe, 'text-paste');
        return;
      }
      const url = form.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        setError('Enter a valid URL starting with https://');
        return;
      }
      setPhase('fetching');
      const result = await importRecipeFromUrl(url);
      if (result.source !== 'json-ld') setPhase('extracting');
      applyDraft(result.recipe, result.source, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract recipe');
    } finally {
      setPhase('idle');
    }
  }

  async function onSave() {
    if (!meals.online) {
      setError(meals.importBlockedReason);
      return;
    }
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const draft: Omit<Recipe, 'id' | 'householdId'> = draftFromForm(form);
      const estimate = await resolveRecipeNutrition({
        name: draft.name,
        ingredients: draft.ingredients ?? [],
        servings: draft.servings,
        allowAi: true,
      });
      if (estimate) {
        draft.calories = estimate.calories;
        draft.protein = estimate.protein;
        draft.carbs = estimate.carbs;
        draft.fat = estimate.fat;
        setFormState((current) => applyNutrition(current, estimate));
      }
      const saved = await meals.saveHouseholdRecipe(draft);
      router.push(recipeHref(saved.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recipe');
    } finally {
      setBusy(false);
    }
  }

  const props = {
    desktop: mode === 'desktop',
    online: meals.online,
    apiReady: isMealsApiConfigured(),
    tab,
    setTab,
    paste,
    setPaste,
    form,
    setForm,
    phase,
    source,
    error,
    blockedReason: meals.importBlockedReason,
    busy,
    onExtract,
    onSave,
  };

  return mode === 'desktop' ? <ImportDesktop {...props} /> : <ImportMobile {...props} />;
}
