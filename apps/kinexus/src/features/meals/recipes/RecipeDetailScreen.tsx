import { type ReactNode, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { formatCostPerServe, formatCostSource, formatDishCost, formatMoney, findReplacingRecipe, linkedRecipeForIngredient, MEAL_SLOTS, recipeBaseServings, recipeClassLabel, scaleRecipeToServings } from '@kinexus/domain';

import { useCreator } from '@/src/features/creators/use-creator';
import { useWakeLock } from '@/src/features/cook/use-wake-lock';
import { BackLink, Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { IngredientSwapSlot } from '@/src/features/meals/IngredientSwapSlot';
import { recipeEditHref, recipeHref, recipeParam } from '@/src/features/meals/recipe-href';
import { printRecipe } from '@/src/features/meals/recipes/print-recipe';
import { RecipeImageDisclaimer } from '@/src/features/meals/RecipeImageDisclaimer';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { fetchRecipeById, useMealsSync } from '@/src/features/meals/use-meals-sync';
import { LoadingState } from '@/src/features/shell/states';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { isLinkOnlyRecipe, openRecipeLink, sourceHostLabel } from '@/src/features/meals/recipes/link-recipe';

const CATALOG_REMOVE_EMAIL = 'pzappft@gmail.com';

export function RecipeDetailScreen() {
  const { id, from, serves } = useLocalSearchParams<{
    id: string | string[];
    from?: string | string[];
    serves?: string | string[];
  }>();
  const recipeId = recipeParam(id);
  const servesParam = Array.isArray(serves) ? serves[0] : serves;
  const fromShopping = (Array.isArray(from) ? from[0] : from) === 'shopping';
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const meals = useMealsSync();
  const creator = useCreator();
  const { user } = useAuth();
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
  const sourceHost = recipe ? sourceHostLabel(recipe.sourceUrl) : null;
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [cookMode, setCookMode] = useState(false);
  const [viewServings, setViewServings] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const publishedCatalog = recipe
    ? meals.recipes.find(
        (r) => !r.householdId && !r.removed && r.creatorSourceRecipeId === recipe.id,
      )
    : undefined;
  const isOwnCreatorCatalog = Boolean(
    recipe &&
      !recipe.householdId &&
      recipe.createdBy &&
      user?.id &&
      recipe.createdBy === user.id &&
      creator.isApprovedCreator,
  );
  const canRemoveFromCatalog = Boolean(
    recipe &&
      !recipe.householdId &&
      !recipe.removed &&
      user?.email?.toLowerCase() === CATALOG_REMOVE_EMAIL,
  );

  useWakeLock(cookMode);

  useEffect(() => {
    setNotes(recipe?.notes ?? '');
  }, [recipe?.id, recipe?.notes]);

  useEffect(() => {
    const next = Number(servesParam);
    setViewServings(Number.isFinite(next) && next > 0 ? Math.round(next) : null);
  }, [recipeId, servesParam]);

  function goToLibrary() {
    router.push('/meals/recipes' as Href);
  }

  function goBack() {
    if (fromShopping) {
      router.push('/meals/shopping' as Href);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/meals/recipes' as Href);
  }

  const backLabel = fromShopping ? 'Shopping' : 'Library';

  async function removeFromCatalog() {
    if (!recipe || removing) return;
    const message = 'This hides it from the recipe library for every household.';
    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Remove ${recipe.name} from the catalog?\n\n${message}`)
        : await new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (value: boolean) => {
              if (settled) return;
              settled = true;
              resolve(value);
            };
            Alert.alert(
              'Remove from catalog?',
              message,
              [
                { text: 'Keep', style: 'cancel', onPress: () => settle(false) },
                { text: 'Remove', style: 'destructive', onPress: () => settle(true) },
              ],
              { cancelable: true, onDismiss: () => settle(false) },
            );
          });
    if (!confirmed) return;
    setRemoving(true);
    setError(null);
    try {
      await meals.reviewCatalogRecipe(recipe.id, 'remove');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove recipe');
    } finally {
      setRemoving(false);
    }
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
        <BackLink label={backLabel} onPress={goBack} />
      </View>
    );
  }

  const baseServings = recipeBaseServings(recipe);
  const shown = scaleRecipeToServings(recipe, viewServings);
  const serveCount = viewServings ?? baseServings;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <BackLink label={backLabel} onPress={goBack} />
      <View style={[styles.hero, desktop && styles.heroDesktop]}>
        <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size="fill" radius={0} />
        {canRemoveFromCatalog ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove from catalog"
            disabled={!meals.online || removing}
            onPress={() => void removeFromCatalog()}
            style={[styles.removeCatalog, (!meals.online || removing) && styles.removeCatalogDisabled]}>
            <Text style={styles.removeCatalogMark}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <RecipeImageDisclaimer visible={Boolean(recipe.imageUrl)} style={styles.imageNote} />
      <Text style={[styles.title, desktop && styles.titleDesktop]}>
        {recipe.name}
      </Text>
      {!recipe.householdId && recipe.createdBy ? (
        <Text style={styles.meta}>
          Shared by a Kinexus creator
          {recipe.creatorPublishedAt
            ? ` · ${new Date(recipe.creatorPublishedAt).toLocaleDateString()}`
            : ''}
        </Text>
      ) : null}
      {isLinkOnlyRecipe(recipe) && recipe.sourceUrl ? (
        <Card>
          <Text style={styles.heading}>Full recipe not found</Text>
          <BodyText>It can be viewed at this link.</BodyText>
          <Pressable onPress={() => openRecipeLink(recipe.sourceUrl)}>
            <Text style={styles.back}>{recipe.sourceUrl}</Text>
          </Pressable>
          <Btn label="Open recipe link" onPress={() => openRecipeLink(recipe.sourceUrl)} />
        </Card>
      ) : recipe.sourceUrl ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => openRecipeLink(recipe.sourceUrl)}
          style={styles.sourceRow}>
          <Text style={styles.back}>View original{sourceHost ? ` on ${sourceHost}` : ''} →</Text>
        </Pressable>
      ) : null}
      {householdOwned && recipe.replacesSource ? (
        <Text style={styles.hiddenHint}>Your household version of this recipe.</Text>
      ) : householdVersion ? (
        <Pressable onPress={() => router.push(recipeHref(householdVersion.id))}>
          <Text style={styles.back}>Open your household version →</Text>
        </Pressable>
      ) : null}
      <Text style={styles.meta}>
        {recipe.cuisine ?? 'Recipe'} · {recipe.cookTime ?? '—'} min
        {baseServings ? '' : ` · ${recipe.servings ?? '—'} servings`}
        {formatCostPerServe(shown.cost) ? ` · ${formatCostPerServe(shown.cost)}` : ''}
      </Text>
      {baseServings && serveCount ? (
        <View style={styles.servesRow}>
          <Text style={styles.meta}>Serves</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fewer serves"
            disabled={serveCount <= 1}
            onPress={() => setViewServings(Math.max(1, serveCount - 1))}
            style={[styles.servesBtn, serveCount <= 1 && styles.servesBtnDisabled]}>
            <Text style={styles.servesBtnLabel}>−</Text>
          </Pressable>
          <Text style={styles.servesValue}>{serveCount}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More serves"
            disabled={serveCount >= 24}
            onPress={() => setViewServings(Math.min(24, serveCount + 1))}
            style={[styles.servesBtn, serveCount >= 24 && styles.servesBtnDisabled]}>
            <Text style={styles.servesBtnLabel}>+</Text>
          </Pressable>
          {viewServings != null && viewServings !== baseServings ? (
            <Text style={styles.meta}>scaled from {baseServings}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.macros}>
        <Macro label="kcal" value={recipe.calories} />
        <Macro label="protein" value={recipe.protein} suffix="g" />
        <Macro label="carbs" value={recipe.carbs} suffix="g" />
        <Macro label="fat" value={recipe.fat} suffix="g" />
      </View>
      <Card>
        <Text style={styles.heading}>Approx. cost</Text>
        {shown.cost ? (
          <>
            <Text style={styles.costHero}>{formatCostPerServe(shown.cost)}</Text>
            <Text style={styles.meta}>
              {formatDishCost(shown.cost)} for {shown.cost.servingsBasis} servings
            </Text>
            {shown.cost.coveredIngredients != null && shown.cost.totalIngredients != null ? (
              <Text style={styles.meta}>
                {shown.cost.coveredIngredients} of {shown.cost.totalIngredients} ingredients priced
              </Text>
            ) : null}
            <Text style={styles.hiddenHint}>{formatCostSource(shown.cost)}</Text>
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
            void printRecipe(shown)
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
        {householdOwned && creator.isApprovedCreator ? (
          <Btn
            label={
              publishing
                ? 'Publishing…'
                : publishedCatalog
                  ? 'Update in library'
                  : 'Publish to library'
            }
            variant="secondary"
            disabled={!meals.online || publishing}
            busy={publishing}
            onPress={() => {
              setPublishing(true);
              setError(null);
              void meals
                .publishCreatorRecipe(recipe.id)
                .then((catalogId) => router.push(recipeHref(catalogId)))
                .catch((err) => setError(err instanceof Error ? err.message : 'Publish failed'))
                .finally(() => setPublishing(false));
            }}
          />
        ) : null}
        {isOwnCreatorCatalog && recipe.createdBy ? (
          <Btn
            label="Remove from library"
            variant="ghost"
            disabled={!meals.online}
            onPress={() => {
              void meals
                .unpublishCreatorRecipe(recipe.id)
                .then(() => goToLibrary())
                .catch((err) => setError(err instanceof Error ? err.message : 'Could not unpublish'));
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
          {[
            recipe.recipeClass ? recipeClassLabel(recipe.recipeClass) : null,
            ...(recipe.mealSlots ?? []).map((s) => MEAL_SLOTS.find((x) => x.key === s)?.label ?? s),
          ]
            .filter(Boolean)
            .join(' · ') || 'Dinner'}
        </BodyText>
      </Card>
      <View style={desktop ? styles.cols : styles.stack}>
        <View style={desktop ? styles.col : styles.stackCol}>
          <Card>
            <Text style={styles.heading}>Ingredients</Text>
            {(shown.ingredients ?? []).length === 0 ? (
              <BodyText>No ingredients listed.</BodyText>
            ) : (
              (shown.ingredients ?? []).map((ing, idx) => {
                const line = shown.cost?.breakdown.find(
                  (item) => item.name.trim().toLowerCase() === ing.name.trim().toLowerCase(),
                );
                const linked = linkedRecipeForIngredient(ing.name, meals.recipes, {
                  explicitId: ing.baseRecipeId,
                  excludeIds: [recipe.id],
                });
                return (
                  <IngredientSwapSlot key={`${ing.name}-${idx}`} recipe={recipe} index={idx}>
                    {(button) => (
                      <View style={styles.ingRow}>
                        <View style={styles.ingLead}>
                          <Text style={[styles.body, cookMode && styles.cookBody, wrapText, styles.ingName]}>
                            {ing.amount ? `${ing.amount} ` : ''}
                            {ing.name}
                            {linked ? (
                              <Text style={styles.ingLink} onPress={() => router.push(recipeHref(linked.id))}>
                                {`  · ${linked.name}`}
                              </Text>
                            ) : null}
                          </Text>
                          {button}
                        </View>
                        {line ? (
                          <Text style={styles.ingCost}>{formatMoney(line.lineCost, shown.cost?.currency)}</Text>
                        ) : null}
                      </View>
                    )}
                  </IngredientSwapSlot>
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
  sourceRow: { alignSelf: 'flex-start', marginTop: -4 },
  hero: { height: 220, borderRadius: radius.lg, overflow: 'hidden', position: 'relative' },
  heroDesktop: { height: 320 },
  removeCatalog: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 16, 22, 0.72)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeCatalogDisabled: { opacity: 0.45 },
  removeCatalogMark: { color: colors.danger, fontSize: 22, fontWeight: '700', lineHeight: 24, marginTop: -1 },
  imageNote: { marginTop: -4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  meta: { color: colors.textMuted },
  costHero: { color: colors.text, fontSize: 22, fontWeight: '800' },
  ingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  ingLead: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  ingName: { flexGrow: 0, flexShrink: 1, minWidth: 0 },
  ingLink: { color: colors.accent, fontWeight: '700' },
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
  servesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  servesBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servesBtnDisabled: { opacity: 0.4 },
  servesBtnLabel: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  servesValue: { minWidth: 28, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '800' },
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
