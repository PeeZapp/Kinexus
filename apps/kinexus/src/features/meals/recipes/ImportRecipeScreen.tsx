import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { type MealSlotKey, type Recipe } from '@kinexus/domain';

import { recipeHref } from '@/src/features/meals/recipe-href';
import { ImportView, type ImportFormState, type ImportTab } from '@/src/features/meals/recipes/ImportShared';
import { LINK_ONLY_NOTE } from '@/src/features/meals/recipes/link-recipe';
import {
  pickRecipePhoto,
  releaseRecipePhotoPreview,
  uploadRecipePhoto,
  type RecipePhotoFile,
} from '@/src/features/meals/recipes/recipe-photo-import';
import { applyNutrition, draftFromForm, EMPTY_RECIPE_FORM, ingredientRowsFrom, methodRowsFrom, patchRecipeForm } from '@/src/features/meals/recipes/recipe-form';
import { resolveRecipeNutrition } from '@/src/features/meals/recipes/resolve-nutrition';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { useAiStatus } from '@/src/lib/ai-status-context';
import { useHousehold } from '@/src/lib/household';
import {
  extractRecipeFromPhoto,
  extractRecipeFromText,
  generateRecipeFromName,
  importRecipeFromUrl,
  isMealsApiConfigured,
  type ImportSource,
  type ImportedRecipe,
  type MissingRecipe,
} from '@/src/lib/meals-api';

function tabFromParam(value: string | string[] | undefined): ImportTab | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'text' || raw === 'photo' || raw === 'url') return raw;
  return null;
}

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
  const meals = useMealsSync();
  const { activeHousehold } = useHousehold();
  const { blocked, blockedMessage, guardAi, goFixKey } = useAiStatus();
  const params = useLocalSearchParams<{
    url?: string | string[];
    fallback?: string | string[];
    tab?: string | string[];
  }>();
  const openedFallback = useRef(false);
  const [tab, setTab] = useState<ImportTab>(() => tabFromParam(params.tab) ?? 'url');
  const [paste, setPaste] = useState('');
  const [photo, setPhoto] = useState<RecipePhotoFile | null>(null);
  const [form, setFormState] = useState<ImportFormState>(EMPTY_RECIPE_FORM);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'extracting'>('idle');
  const [source, setSource] = useState<ImportSource | null>(null);
  const [missing, setMissing] = useState<MissingRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultsMayVary, setResultsMayVary] = useState(false);
  const householdId = activeHousehold?.id;

  useEffect(() => {
    const next = tabFromParam(params.tab);
    if (next) setTab(next);
  }, [params.tab]);

  useEffect(() => {
    return () => releaseRecipePhotoPreview(photo);
  }, [photo]);

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
      recipeClass: null,
      slots,
      imageUrl: recipe.imageUrl ?? '',
      imageCandidates: recipe.imageCandidates ?? (recipe.imageUrl ? [recipe.imageUrl] : []),
    }));
    setSource(nextSource);
    setMissing(null);
  }

  function requireAi(): boolean {
    if (guardAi()) return true;
    setError(blockedMessage);
    return false;
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
    if (!householdId) {
      setError('Pick a household first.');
      return;
    }
    if ((tab === 'text' || tab === 'photo') && !requireAi()) return;
    setError(null);
    setResultsMayVary(false);
    try {
      if (tab === 'text') {
        if (paste.trim().length < 20) {
          setError('Paste more of the recipe text.');
          return;
        }
        setPhase('extracting');
        const result = await extractRecipeFromText(paste.trim(), householdId);
        setResultsMayVary(Boolean(result.resultsMayVary));
        applyDraft(result.value, 'text-paste');
        return;
      }
      if (tab === 'photo') {
        if (!photo) {
          setError('Choose a recipe photo first.');
          return;
        }
        setPhase('extracting');
        const imageUrl = await uploadRecipePhoto(householdId, photo);
        const result = await extractRecipeFromPhoto(imageUrl, householdId);
        setResultsMayVary(Boolean(result.resultsMayVary));
        applyDraft(
          {
            ...result.value,
            imageUrl: result.value.imageUrl ?? imageUrl,
            imageCandidates: result.value.imageCandidates ?? [imageUrl],
          },
          'photo',
        );
        return;
      }
      const url = form.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        setError('Enter a valid URL starting with https://');
        return;
      }
      setPhase('fetching');
      const result = await importRecipeFromUrl(url, householdId);
      if (result.source === 'not-found') {
        setSource(null);
        setMissing(result.missing);
        setForm({ url: result.missing.recipeUrl, name: result.missing.dishName });
        return;
      }
      if (result.source !== 'json-ld') setPhase('extracting');
      setResultsMayVary(Boolean(result.resultsMayVary));
      applyDraft(result.recipe, result.source, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract recipe');
    } finally {
      setPhase('idle');
    }
  }

  async function onPickPhoto() {
    setError(null);
    try {
      const next = await pickRecipePhoto();
      if (!next) return;
      setPhoto((current) => {
        releaseRecipePhotoPreview(current);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that photo');
    }
  }

  async function onGenerateFromName() {
    const name = missing?.dishName.trim() ?? '';
    if (name.length < 2) {
      setError('Enter the dish name.');
      return;
    }
    if (!householdId) {
      setError('Pick a household first.');
      return;
    }
    if (!requireAi()) return;
    setError(null);
    setResultsMayVary(false);
    setPhase('extracting');
    try {
      const result = await generateRecipeFromName(name, householdId);
      setResultsMayVary(Boolean(result.resultsMayVary));
      applyDraft(result.value, 'generated-name', missing?.recipeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate that recipe');
    } finally {
      setPhase('idle');
    }
  }

  async function onSaveLink() {
    if (!missing) return;
    if (!meals.online) {
      setError(meals.importBlockedReason);
      return;
    }
    if (!form.slots.length && !form.recipeClass) {
      setError('Pick at least one meal slot');
      return;
    }
    const name = missing.dishName.trim() || 'Linked recipe';
    setBusy(true);
    setError(null);
    try {
      const saved = await meals.saveHouseholdRecipe({
        name,
        emoji: '🔗',
        ingredients: [],
        method: [],
        mealSlots: form.slots,
        recipeClass: form.recipeClass ?? undefined,
        notes: LINK_ONLY_NOTE,
        sourceUrl: missing.recipeUrl,
        excludedFromAuto: true,
      });
      router.replace(recipeHref(saved.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that link');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (openedFallback.current) return;
    const fallback = Array.isArray(params.fallback) ? params.fallback[0] : params.fallback;
    const url = Array.isArray(params.url) ? params.url[0] : params.url;
    if (fallback !== '1' || !url) return;
    openedFallback.current = true;
    setForm({ url });
    setMissing({ url, recipeUrl: url, dishName: '' });
  }, [params.fallback, params.url]);

  async function onSave() {
    if (!meals.online) {
      setError(meals.importBlockedReason);
      return;
    }
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.slots.length && !form.recipeClass) {
      setError('Pick at least one meal slot');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const draft: Omit<Recipe, 'id' | 'householdId'> = draftFromForm(form);
      if ((draft.ingredients ?? []).length === 0) {
        const saved = await meals.saveHouseholdRecipe(draft);
        router.replace(recipeHref(saved.id));
        return;
      }
      const estimate = await resolveRecipeNutrition({
        name: draft.name,
        ingredients: draft.ingredients ?? [],
        servings: draft.servings,
        allowAi: !blocked,
        householdId,
      });
      if (estimate) {
        draft.calories = estimate.calories;
        draft.protein = estimate.protein;
        draft.carbs = estimate.carbs;
        draft.fat = estimate.fat;
        if (estimate.resultsMayVary) setResultsMayVary(true);
        setFormState((current) => applyNutrition(current, estimate));
      }
      const saved = await meals.saveHouseholdRecipe(draft);
      router.replace(recipeHref(saved.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recipe');
    } finally {
      setBusy(false);
    }
  }

  const props = {
    online: meals.online,
    apiReady: isMealsApiConfigured(),
    tab,
    setTab,
    paste,
    setPaste,
    photoPreviewUrl: photo?.previewUrl ?? null,
    onPickPhoto: () => void onPickPhoto(),
    form,
    setForm,
    phase,
    source,
    missing,
    onDishName: (dishName: string) => setMissing((current) => (current ? { ...current, dishName } : current)),
    onGenerateFromName: () => void onGenerateFromName(),
    onSaveLink: () => void onSaveLink(),
    error,
    blockedReason: meals.importBlockedReason,
    busy,
    onExtract,
    onSave,
    aiBlocked: blocked,
    aiBlockedMessage: blockedMessage,
    onAiBlockedPress: () => {
      if (blocked === 'key_paused') goFixKey();
      else setError(blockedMessage);
    },
    resultsMayVary,
  };

  return <ImportView {...props} />;
}
