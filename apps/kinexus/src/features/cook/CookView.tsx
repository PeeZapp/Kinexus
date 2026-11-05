import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { scaledQuantityLabel, type CleanRecipe } from '@kinexus/domain';

import {
  clearPendingCookSave,
  readCookChecks,
  readPendingCookSave,
  writeCookChecks,
  writeCookReturnTo,
  writePendingCookSave,
  writeSavedHouseholdId,
} from '@/src/features/cook/cook-storage';
import { CookSaveSheet, formFromCleanRecipe } from '@/src/features/cook/CookSaveSheet';
import { openSourceUrl } from '@/src/features/cook/open-source';
import { useCookSave } from '@/src/features/cook/use-cook-save';
import { useWakeLock } from '@/src/features/cook/use-wake-lock';
import { Btn } from '@/src/features/household/ui';
import { MealsWeekProvider } from '@/src/features/meals/MealsWeekContext';
import { recipeHref } from '@/src/features/meals/recipe-href';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import {
  applyNutrition,
  draftFromForm,
  patchRecipeForm,
  type RecipeFormState,
} from '@/src/features/meals/recipes/recipe-form';
import { resolveRecipeNutrition } from '@/src/features/meals/recipes/resolve-nutrition';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { ErrorBanner } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function CookView(props: { importId: string; recipe: CleanRecipe }) {
  return (
    <MealsWeekProvider>
      <CookViewBody {...props} />
    </MealsWeekProvider>
  );
}

function CookViewBody({
  importId,
  recipe,
}: {
  importId: string;
  recipe: CleanRecipe;
}) {
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const cookSave = useCookSave(importId);
  const meals = useMealsSync();
  const canScale = Boolean(recipe.originalServings && recipe.originalServings > 0);
  const [servings, setServings] = useState(Math.max(1, recipe.originalServings ?? 1));
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setFormState] = useState<RecipeFormState>(() => formFromCleanRecipe(recipe));
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useWakeLock(true);

  useEffect(() => {
    setServings(Math.max(1, recipe.originalServings ?? 1));
    setFormState(formFromCleanRecipe(recipe));
  }, [recipe, importId]);

  useEffect(() => {
    let cancelled = false;
    void readCookChecks(importId).then((ids) => {
      if (!cancelled) setChecked(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [importId]);

  const persistChecks = useCallback(
    (next: Set<string>) => {
      setChecked(next);
      void writeCookChecks(importId, [...next]);
    },
    [importId],
  );

  const signedIn = Boolean(cookSave.user);
  const householdId = cookSave.householdId;
  const alreadySaved = cookSave.alreadySaved;

  useEffect(() => {
    if (!signedIn || !householdId || alreadySaved || confirmOpen) return;
    let cancelled = false;
    void (async () => {
      const pending = await readPendingCookSave();
      if (cancelled || pending?.importId !== importId) return;
      setFormState(formFromCleanRecipe(pending.recipe));
      setConfirmOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [alreadySaved, confirmOpen, householdId, importId, signedIn]);

  const groups = useMemo(() => groupedIngredients(recipe), [recipe]);

  function setForm(patch: Partial<RecipeFormState>) {
    setFormState((current) => patchRecipeForm(current, patch));
  }

  async function onSavePress() {
    if (!cookSave.user) {
      await writePendingCookSave({ importId, recipe });
      await writeCookReturnTo(`/recipes/${importId}`);
      router.push('/sign-in' as Href);
      return;
    }
    setSaveError(null);
    setFormState(formFromCleanRecipe(recipe));
    setConfirmOpen(true);
  }

  async function onConfirmSave() {
    if (!form.name.trim()) {
      setSaveError('Name is required');
      return;
    }
    if (!form.slots.length && !form.recipeClass) {
      setSaveError('Pick at least one meal slot');
      return;
    }
    if (!meals.online) {
      setSaveError(meals.importBlockedReason ?? 'Saving recipes needs a connection');
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    try {
      const draft = draftFromForm(form);
      if ((draft.ingredients ?? []).length > 0) {
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
      }
      const saved = await meals.saveHouseholdRecipe(draft);
      await writeSavedHouseholdId(importId, saved.id);
      await clearPendingCookSave();
      setConfirmOpen(false);
      router.push(recipeHref(saved.id));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save that recipe');
    } finally {
      setSaveBusy(false);
    }
  }

  let stepNumber = 0;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{recipe.title}</Text>
        {recipe.attribution.sourceUrl ? (
          <Pressable onPress={() => openSourceUrl(recipe.attribution.sourceUrl)} accessibilityRole="link">
            <Text style={styles.source}>From {recipe.attribution.displayName}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sourceMuted}>From {recipe.attribution.displayName}</Text>
        )}
        <Text style={styles.attrNote}>Source recipe. Kinexus did not write this.</Text>

        {recipe.imageUrl ? (
          <View style={styles.hero}>
            <RecipePhoto uri={recipe.imageUrl} size="fill" radius={0} />
          </View>
        ) : null}

        <View style={styles.servingsRow}>
          <Text style={styles.sectionLabel}>Servings</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => canScale && setServings((n) => Math.max(1, n - 1))}
              disabled={!canScale || servings <= 1}
              style={({ pressed }) => [
                styles.stepBtn,
                (!canScale || servings <= 1) && styles.stepBtnDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Fewer servings">
              <Text style={styles.stepBtnLabel}>−</Text>
            </Pressable>
            <Text style={styles.servingsValue}>{canScale ? servings : '—'}</Text>
            <Pressable
              onPress={() => canScale && setServings((n) => n + 1)}
              disabled={!canScale}
              style={({ pressed }) => [
                styles.stepBtn,
                !canScale && styles.stepBtnDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="More servings">
              <Text style={styles.stepBtnLabel}>+</Text>
            </Pressable>
          </View>
        </View>
        {!canScale ? (
          <Text style={styles.hint}>Servings were not listed, so amounts stay as written.</Text>
        ) : null}

        {cookSave.error ? <ErrorBanner message={cookSave.error} /> : null}
        {alreadySaved && cookSave.savedId ? (
          <Btn
            label="Open in library"
            variant="secondary"
            onPress={() => router.push(recipeHref(cookSave.savedId!))}
          />
        ) : (
          <Btn
            label={cookSave.user ? 'Save to My Recipes' : 'Sign in to save'}
            onPress={() => void onSavePress()}
            busy={saveBusy}
            disabled={saveBusy || (Boolean(cookSave.user) && !cookSave.householdId)}
          />
        )}
        {cookSave.user && !cookSave.householdId ? (
          <Text style={styles.hint}>Create a household in Kinexus to save this recipe.</Text>
        ) : null}

        <Text style={styles.section}>Ingredients</Text>
        {groups.map((group) => (
          <View key={group.key} style={styles.group}>
            {group.label ? <Text style={styles.groupLabel}>{group.label}</Text> : null}
            {group.items.map((item) => {
              const on = checked.has(item.id);
              const qty = scaledQuantityLabel(item.quantity, recipe.originalServings, servings);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    const next = new Set(checked);
                    if (on) next.delete(item.id);
                    else next.add(item.id);
                    persistChecks(next);
                  }}
                  style={[styles.ingredient, on && styles.ingredientOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}>
                  <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.check}>✓</Text> : null}</View>
                  <Text style={[styles.ingredientText, on && styles.ingredientDone]}>
                    {qty ? `${qty} ${item.name}` : item.name}
                    {item.note ? ` (${item.note})` : ''}
                    {item.optional ? ' (optional)' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Text style={styles.section}>Method</Text>
        {recipe.method.map((block) => {
          if (block.type === 'heading') {
            return (
              <Text key={block.id} style={styles.methodHeading}>
                {block.text}
              </Text>
            );
          }
          stepNumber += 1;
          return (
            <View key={block.id} style={styles.stepRow}>
              <Text style={styles.stepNum}>{stepNumber}</Text>
              <Text style={styles.stepText}>{block.text}</Text>
            </View>
          );
        })}

        {recipe.chefTip ? (
          <View style={styles.tip}>
            <Text style={styles.groupLabel}>Chef tip</Text>
            <Text style={styles.stepText}>{recipe.chefTip}</Text>
          </View>
        ) : null}

        <Btn label="Import another" variant="ghost" onPress={() => router.push('/import' as Href)} />
      </ScrollView>

      <CookSaveSheet
        visible={confirmOpen}
        form={form}
        setForm={setForm}
        busy={saveBusy}
        error={saveError}
        onClose={() => setConfirmOpen(false)}
        onSave={() => void onConfirmSave()}
      />
    </>
  );
}

function groupedIngredients(recipe: CleanRecipe) {
  const groups: { key: string; label?: string; items: CleanRecipe['ingredients'] }[] = [];
  for (const item of recipe.ingredients) {
    const label = item.group?.trim() || undefined;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ key: `${label ?? 'all'}-${groups.length}`, label, items: [item] });
    }
  }
  return groups;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    padding: space.md,
    gap: 14,
    paddingBottom: 64,
  },
  contentDesktop: {
    maxWidth: 640,
    width: '100%',
    paddingTop: space.lg,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  source: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  sourceMuted: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  attrNote: {
    color: colors.textDim,
    fontSize: 13,
  },
  hero: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepBtnLabel: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: -2,
  },
  servingsValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  ingredient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientOn: {
    backgroundColor: colors.bgElevated,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.accent,
  },
  check: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
  },
  ingredientText: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  ingredientDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  methodHeading: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.accent,
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
  },
  tip: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: 6,
  },
  pressed: {
    opacity: 0.86,
  },
});
