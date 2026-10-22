import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { ingredientSwaps, type Ingredient, type Recipe } from '@kinexus/domain';

import { recipeHref } from '@/src/features/meals/recipe-href';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { colors, radius } from '@/src/features/shell/theme';

export function IngredientSwapSlot({
  recipe,
  index,
  children,
}: {
  recipe: Recipe;
  index: number;
  children: (button: ReactNode) => ReactNode;
}) {
  const ingredient = recipe.ingredients?.[index];
  const swaps = ingredient ? ingredientSwaps(ingredient.name) : [];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meals = useMealsSync();
  const router = useRouter();
  const pathname = usePathname();

  if (!ingredient || swaps.length === 0) {
    return <View style={styles.slot}>{children(null)}</View>;
  }

  async function apply(nextName: string) {
    if (!ingredient || busy) return;
    setBusy(nextName);
    setError(null);
    try {
      const ingredients = (recipe.ingredients ?? []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, name: nextName } : item,
      );
      const saved = await meals.saveRecipeForHousehold(recipe, draftWithIngredients(recipe, ingredients), 'overwrite');
      if (meals.shoppingCount > 0) await meals.rebuildShopping();
      setOpen(false);
      if (saved.id !== recipe.id && pathname.includes('/recipes/')) {
        router.replace(recipeHref(saved.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not swap this ingredient');
    } finally {
      setBusy(null);
    }
  }

  const button = (
    <Pressable
      onPress={() => setOpen((current) => !current)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={open ? `Hide substitutes for ${ingredient.name}` : `Substitutes for ${ingredient.name}`}
      style={({ pressed }) => [styles.logo, open && styles.logoOpen, pressed && styles.pressed]}>
      <Text style={styles.logoMark}>⇄</Text>
    </Pressable>
  );

  return (
    <View style={styles.slot}>
      {children(button)}
      {open ? (
        <View style={styles.panel}>
          {swaps.map((swap) => (
            <View key={swap} style={styles.choice}>
              <Text style={styles.choiceName}>{swap}</Text>
              <Pressable
                onPress={() => void apply(swap)}
                disabled={busy != null}
                accessibilityRole="button"
                accessibilityLabel={`Swap ${ingredient.name} for ${swap}`}
                style={({ pressed }) => [styles.swapBtn, pressed && styles.pressed, busy != null && styles.disabled]}>
                <Text style={styles.swapLabel}>{busy === swap ? 'Swapping…' : 'Swap'}</Text>
              </Pressable>
            </View>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function draftWithIngredients(recipe: Recipe, ingredients: Ingredient[]): Omit<Recipe, 'id' | 'householdId'> {
  return {
    name: recipe.name,
    emoji: recipe.emoji,
    cuisine: recipe.cuisine,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    protein: recipe.protein,
    calories: recipe.calories,
    carbs: recipe.carbs,
    fat: recipe.fat,
    vegetarian: recipe.vegetarian,
    ingredients,
    method: recipe.method,
    chefTip: recipe.chefTip,
    notes: recipe.notes,
    mealSlots: recipe.mealSlots,
    recipeClass: recipe.recipeClass,
    isComponent: recipe.isComponent,
    excludedFromAuto: recipe.excludedFromAuto,
    sourceUrl: recipe.sourceUrl,
    imageUrl: recipe.imageUrl,
    imageFlagged: recipe.imageFlagged,
  };
}

const styles = StyleSheet.create({
  slot: { flex: 1, gap: 6, alignSelf: 'stretch' },
  logo: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOpen: { backgroundColor: colors.accentMuted },
  logoMark: { color: colors.accent, fontSize: 12, fontWeight: '800', lineHeight: 14 },
  pressed: { opacity: 0.7 },
  panel: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    padding: 8,
    gap: 8,
  },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceName: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 18 },
  swapBtn: {
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  swapLabel: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 16 },
});
