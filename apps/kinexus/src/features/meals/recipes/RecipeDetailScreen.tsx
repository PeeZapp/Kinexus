import { type ReactNode, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { formatCostPerServe, formatCostSource, formatDishCost, formatMoney, findReplacingRecipe, MEAL_SLOTS } from '@kinexus/domain';

import { useWakeLock } from '@/src/features/cook/use-wake-lock';
import { Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { recipeEditHref, recipeHref, recipeParam } from '@/src/features/meals/recipe-href';
import { CatalogRemoveEditor } from '@/src/features/meals/recipes/CatalogRemoveEditor';
import { printRecipe } from '@/src/features/meals/recipes/print-recipe';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { fetchRecipeById, useMealsSync } from '@/src/features/meals/use-meals-sync';
import { LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const recipeId = recipeParam(id);
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const meals = useMealsSync();
  const listed = recipeId ? meals.recipes.find((r) => r.id === recipeId) : undefined;
  const detailQuery = useQuery({
    queryKey: ['meals', 'recipe', recipeId, meals.market.country, meals.market.currency],
    enabled: Boolean(recipeId && !listed),
    queryFn: () => fetchRecipeById(recipeId!, meals.market.country, meals.market.currency),
  });
  const recipeRaw = listed ?? detailQuery.data ?? null;
  const recipe = recipeRaw
    ? {
        ...recipeRaw,
        excludedFromAuto: Boolean(recipeRaw.excludedFromAuto) || meals.hiddenRecipeIds.has(recipeRaw.id),
      }
    : null;
  const fav = recipe ? meals.favouriteIds.has(recipe.id) : false;
  const householdOwned = Boolean(recipe?.householdId && recipe.householdId === meals.householdId);
  const householdVersion = recipe && !householdOwned ? findReplacingRecipe(meals.recipes, recipe.id) : undefined;
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [cookMode, setCookMode] = useState(false);

  useWakeLock(cookMode);

  useEffect(() => {
    setNotes(recipe?.notes ?? '');
  }, [recipe?.id, recipe?.notes]);

  function goToLibrary() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/meals/recipes' as Href);
  }

  if (!recipe && (meals.isLoading || detailQuery.isLoading)) {
    return (
      <View style={[styles.root, desktop && styles.rootDesktop]}>
        <LoadingState label="Loading recipe…" />
      </View>
    );
  }

  if (!recipeId || !recipe) {
    return (
      <View style={[styles.root, desktop && styles.rootDesktop]}>
        <Text style={styles.title}>Recipe not found</Text>
        <Btn label="Back to library" variant="secondary" onPress={goToLibrary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Pressable onPress={goToLibrary}>
        <Text style={styles.back}>← Library</Text>
      </Pressable>
      <View style={[styles.hero, desktop && styles.heroDesktop]}>
        <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size="fill" radius={0} />
      </View>
      {meals.isCatalogEditor && !recipe.householdId ? (
        <CatalogRemoveEditor
          recipe={recipe}
          online={meals.online}
          onReview={(action) => meals.reviewCatalogRecipe(recipe.id, action)}
        />
      ) : null}
      <Text style={[styles.title, desktop && styles.titleDesktop]}>
        {recipe.name}
      </Text>
      {householdOwned && recipe.replacesSource ? (
        <Text style={styles.hiddenHint}>Your household version of this recipe.</Text>
      ) : householdVersion ? (
        <Pressable onPress={() => router.push(recipeHref(householdVersion.id))}>
          <Text style={styles.back}>Open your household version →</Text>
        </Pressable>
      ) : null}
      <Text style={styles.meta}>
        {recipe.cuisine ?? 'Recipe'} · {recipe.cookTime ?? '—'} min · {recipe.servings ?? '—'} servings
        {formatCostPerServe(recipe.cost) ? ` · ${formatCostPerServe(recipe.cost)}` : ''}
      </Text>
      <View style={styles.macros}>
        <Macro label="kcal" value={recipe.calories} />
        <Macro label="protein" value={recipe.protein} suffix="g" />
        <Macro label="carbs" value={recipe.carbs} suffix="g" />
        <Macro label="fat" value={recipe.fat} suffix="g" />
      </View>
      <Card>
        <Text style={styles.heading}>Approx. cost</Text>
        {recipe.cost ? (
          <>
            <Text style={styles.costHero}>{formatCostPerServe(recipe.cost)}</Text>
            <Text style={styles.meta}>
              {formatDishCost(recipe.cost)} for {recipe.cost.servingsBasis} servings
            </Text>
            {recipe.cost.coveredIngredients != null && recipe.cost.totalIngredients != null ? (
              <Text style={styles.meta}>
                {recipe.cost.coveredIngredients} of {recipe.cost.totalIngredients} ingredients priced
              </Text>
            ) : null}
            <Text style={styles.hiddenHint}>{formatCostSource(recipe.cost)}</Text>
          </>
        ) : (
          <Text style={styles.hiddenHint}>
            Typical {meals.market.stores.join(' and ')} prices when ingredients can be matched.
          </Text>
        )}
      </Card>
      <View style={styles.row}>
        <Btn
          label={cookMode ? 'Cook mode on' : 'Cook mode'}
          variant={cookMode ? 'secondary' : 'primary'}
          onPress={() => setCookMode((on) => !on)}
        />
        <Btn
          label="Edit"
          disabled={!meals.online}
          onPress={() => router.push(recipeEditHref(recipe.id))}
        />
        <Btn
          label={printing ? 'Preparing print…' : 'Print'}
          variant="secondary"
          busy={printing}
          onPress={() => {
            setPrinting(true);
            void printRecipe(recipe)
              .catch((err) => setError(err instanceof Error ? err.message : 'Print failed'))
              .finally(() => setPrinting(false));
          }}
        />
        <Btn
          label={fav ? 'Favourited' : 'Favourite'}
          variant={fav ? 'secondary' : 'primary'}
          disabled={!meals.online}
          onPress={() => void meals.toggleFavourite(recipe.id).catch((err) => setError(err instanceof Error ? err.message : 'Favourite failed'))}
        />
        <Btn
          label={recipe.excludedFromAuto ? 'Include for my family' : 'Not for my family'}
          variant={recipe.excludedFromAuto ? 'secondary' : 'ghost'}
          disabled={!meals.online}
          onPress={() =>
            void meals.toggleNotForFamily(recipe.id).catch((err) =>
              setError(err instanceof Error ? err.message : 'Could not update recipe'),
            )
          }
        />
        {householdOwned ? (
          <Btn
            label="Delete"
            variant="danger"
            disabled={!meals.online}
            onPress={() => {
              void meals.deleteHouseholdRecipe(recipe.id).then(() => goToLibrary());
            }}
          />
        ) : null}
      </View>
      {cookMode ? (
        <Text style={styles.hiddenHint}>Screen stays awake while Cook mode is on.</Text>
      ) : null}
      <Text style={styles.hiddenHint}>
        {recipe.excludedFromAuto
          ? 'Hidden from plans and recommendations for this household.'
          : 'Mark not for my family to keep it in the library but skip it on plans and suggestions.'}
      </Text>
      <ErrorText message={error ?? detailQuery.error?.message ?? null} />
      <Card>
        <Text style={styles.heading}>Slots</Text>
        <BodyText>
          {(recipe.mealSlots ?? []).map((s) => MEAL_SLOTS.find((x) => x.key === s)?.label ?? s).join(' · ') || 'Dinner'}
        </BodyText>
      </Card>
      <View style={desktop ? styles.cols : styles.stack}>
        <View style={desktop ? styles.col : styles.stackCol}>
          <Card>
            <Text style={styles.heading}>Ingredients</Text>
            {(recipe.ingredients ?? []).length === 0 ? (
              <BodyText>No ingredients listed.</BodyText>
            ) : (
              (recipe.ingredients ?? []).map((ing, idx) => {
                const line = recipe.cost?.breakdown.find(
                  (item) => item.name.trim().toLowerCase() === ing.name.trim().toLowerCase(),
                );
                return (
                  <View key={`${ing.name}-${idx}`} style={styles.ingRow}>
                    <Text style={[styles.body, cookMode && styles.cookBody, wrapText, styles.ingName]}>
                      {ing.amount ? `${ing.amount} ` : ''}
                      {ing.name}
                    </Text>
                    {line ? (
                      <Text style={styles.ingCost}>{formatMoney(line.lineCost, recipe.cost?.currency)}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>
        </View>
        <View style={desktop ? styles.col : styles.stackCol}>
          <Card>
            <Text style={styles.heading}>Method</Text>
            {(recipe.method ?? []).length === 0 ? (
              <BodyText>No method listed.</BodyText>
            ) : (
              (recipe.method ?? []).map((step, idx) => (
                <View key={idx} style={styles.step}>
                  <Text style={[styles.stepNum, cookMode && styles.cookStepNum]}>{idx + 1}.</Text>
                  <Text style={[styles.stepText, cookMode && styles.cookStepText, wrapText]}>{step}</Text>
                </View>
              ))
            )}
          </Card>
        </View>
      </View>
      {recipe.chefTip ? (
        <Card>
          <Text style={styles.heading}>Chef tip</Text>
          <BodyText>{recipe.chefTip}</BodyText>
        </Card>
      ) : null}
      {householdOwned ? (
        <Card>
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
          <Btn
            label="Save notes"
            variant="secondary"
            disabled={!meals.online}
            onPress={() => void meals.updateHouseholdRecipe(recipe.id, { notes })}
          />
        </Card>
      ) : recipe.notes ? (
        <Card>
          <Text style={styles.heading}>Notes</Text>
          <BodyText>{recipe.notes}</BodyText>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Macro({ label, value, suffix }: { label: string; value?: number; suffix?: string }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroVal}>
        {value ?? '—'}
        {suffix ?? ''}
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function BodyText({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bodyWrap}>
      <Text style={[styles.body, wrapText]}>{children}</Text>
    </View>
  );
}

const wrapText = (
  Platform.OS === 'web'
    ? {
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }
    : undefined
) as TextStyle | undefined;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  rootDesktop: { padding: 48 },
  content: { padding: space.md, gap: 12, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, maxWidth: 980, width: '100%', alignSelf: 'center' },
  back: { color: colors.accent, fontWeight: '700' },
  hero: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  heroDesktop: { height: 320 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  meta: { color: colors.textMuted },
  costHero: { color: colors.text, fontSize: 22, fontWeight: '800' },
  ingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  ingName: { flex: 1, minWidth: 0 },
  ingCost: { color: colors.textMuted, fontSize: 13, fontWeight: '700', flexShrink: 0 },
  macros: { flexDirection: 'row', gap: 8 },
  macro: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  macroVal: { color: colors.text, fontWeight: '800', fontSize: 16 },
  macroLabel: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hiddenHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: -4 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  bodyWrap: { width: '100%', minWidth: 0, flexShrink: 1 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    minWidth: 0,
  },
  stepNum: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    minWidth: 22,
    flexShrink: 0,
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  cookBody: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
  },
  cookStepNum: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
    minWidth: 28,
  },
  cookStepText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
  },
  cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', width: '100%', minWidth: 0 },
  col: { flex: 1, minWidth: 0, maxWidth: '100%' },
  stack: { gap: 12, width: '100%' },
  stackCol: { width: '100%', minWidth: 0 },
});
