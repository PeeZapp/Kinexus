import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { findReplacingRecipe, nutritionKey } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { recipeHref, recipeParam } from '@/src/features/meals/recipe-href';
import { ImportFieldsCard, importStyles } from '@/src/features/meals/recipes/ImportShared';
import { applyNutrition, draftFromForm, formFromRecipe, patchRecipeForm, type RecipeFormState } from '@/src/features/meals/recipes/recipe-form';
import { resolveRecipeNutrition } from '@/src/features/meals/recipes/resolve-nutrition';
import { fetchRecipeById, useMealsSync } from '@/src/features/meals/use-meals-sync';
import { LoadingState } from '@/src/features/shell/states';
import { colors, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const recipeId = recipeParam(id);
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const meals = useMealsSync();
  const listed = recipeId ? meals.recipes.find((r) => r.id === recipeId) : undefined;
  const replacing = recipeId ? findReplacingRecipe(meals.recipes, recipeId) : undefined;
  const detailQuery = useQuery({
    queryKey: ['meals', 'recipe', recipeId, meals.market.country, meals.market.currency],
    enabled: Boolean(recipeId),
    queryFn: () => fetchRecipeById(recipeId!, meals.market.country, meals.market.currency),
  });
  const recipe = detailQuery.data ?? listed ?? null;
  const [form, setFormState] = useState<RecipeFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'overwrite' | 'save_as' | null>(null);

  useEffect(() => {
    if (detailQuery.data) setFormState(formFromRecipe(detailQuery.data));
  }, [detailQuery.data?.id]);

  useEffect(() => {
    if (detailQuery.data || !detailQuery.isError || !listed) return;
    setFormState((current) => current ?? formFromRecipe(listed));
  }, [detailQuery.data, detailQuery.isError, listed]);

  function setForm(patch: Partial<RecipeFormState>) {
    setFormState((current) => (current ? patchRecipeForm(current, patch) : current));
  }

  async function onSave(mode: 'overwrite' | 'save_as') {
    if (!recipe || !form) return;
    if (!meals.online) {
      setError(meals.importBlockedReason ?? 'Saving recipes needs a connection');
      return;
    }
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      const draft = draftFromForm(form, {
        vegetarian: recipe.vegetarian,
        isComponent: recipe.isComponent,
        imageUrl: recipe.imageUrl,
        excludedFromAuto: recipe.excludedFromAuto,
      });
      const ingredientsChanged =
        nutritionKey(recipe.ingredients ?? [], recipe.servings) !== nutritionKey(draft.ingredients ?? [], draft.servings);
      if (ingredientsChanged) {
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
          setFormState((current) => (current ? applyNutrition(current, estimate) : current));
        }
      }
      const saved = await meals.saveRecipeForHousehold(recipe, draft, mode);
      router.replace(recipeHref(saved.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recipe');
    } finally {
      setBusy(null);
    }
  }

  if (!recipeId) {
    return (
      <View style={[importStyles.root, styles.pad, desktop && styles.padDesktop]}>
        <Text style={styles.title}>Recipe not found</Text>
        <Btn label="Back to library" variant="secondary" onPress={() => router.push('/meals/recipes' as Href)} />
      </View>
    );
  }

  if (detailQuery.isLoading || !form) {
    if (detailQuery.isError && !listed) {
      return (
        <View style={[importStyles.root, styles.pad, desktop && styles.padDesktop]}>
          <Text style={styles.title}>Recipe not found</Text>
          <Btn label="Back to library" variant="secondary" onPress={() => router.push('/meals/recipes' as Href)} />
        </View>
      );
    }
    return (
      <View style={[importStyles.root, desktop && styles.padDesktop]}>
        <LoadingState label="Loading recipe…" />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={[importStyles.root, styles.pad, desktop && styles.padDesktop]}>
        <Text style={styles.title}>Recipe not found</Text>
        <Btn label="Back to library" variant="secondary" onPress={() => router.push('/meals/recipes' as Href)} />
      </View>
    );
  }

  const householdOwned = Boolean(recipe.householdId && recipe.householdId === meals.householdId);
  const overwriteHint = householdOwned
    ? 'Overwrite updates this recipe for everyone in your household. Meal plan slots that use it stay pointed here.'
    : replacing
      ? 'Overwrite updates your household version and keeps using it instead of the catalog recipe.'
      : 'Overwrite saves this as your household version and uses it instead of the catalog recipe. Other households are not affected.';

  return (
    <ScrollView
      style={importStyles.root}
      contentContainerStyle={[importStyles.content, desktop && importStyles.contentDesktop]}
      keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.push(recipeHref(recipe.id))}>
        <Text style={styles.back}>← {recipe.name}</Text>
      </Pressable>
      <Text style={styles.kicker}>{householdOwned ? 'Household recipe' : 'Catalog recipe'}</Text>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>Edit recipe</Text>
      <Text style={styles.lede}>
        Change ingredients, method, or details, then overwrite this recipe for your household or save a second version.
        Calories and macros update from the ingredient list.
      </Text>
      {replacing && !householdOwned ? (
        <Text style={styles.hint}>
          You already have a household version of this recipe. Overwrite updates that copy.
        </Text>
      ) : null}
      <ImportFieldsCard desktop={desktop} form={form} setForm={setForm} />
      <ErrorText message={error ?? detailQuery.error?.message ?? null} />
      <Text style={styles.hint}>{overwriteHint}</Text>
      <Text style={styles.hint}>
        Save as keeps this recipe and adds another copy to your household library. Rename it if you want them to look
        different.
      </Text>
      <View style={styles.actions}>
        <Btn
          label={householdOwned ? 'Overwrite' : 'Overwrite for household'}
          disabled={!meals.online || Boolean(busy)}
          busy={busy === 'overwrite'}
          onPress={() => void onSave('overwrite')}
        />
        <Btn
          label="Save as"
          variant="secondary"
          disabled={!meals.online || Boolean(busy)}
          busy={busy === 'save_as'}
          onPress={() => void onSave('save_as')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.md, gap: 12 },
  padDesktop: { padding: 48 },
  back: { color: colors.accent, fontWeight: '700' },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  lede: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
