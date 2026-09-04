import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { MEAL_SLOTS } from '@kinexus/domain';

import { Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { CatalogPhotoEditor } from '@/src/features/meals/recipes/CatalogPhotoEditor';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { useMealsSync } from '@/src/features/meals/use-meals-sync';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const meals = useMealsSync();
  const recipe = meals.recipes.find((r) => r.id === id);
  const fav = recipe ? meals.favouriteIds.has(recipe.id) : false;
  const householdOwned = Boolean(recipe?.householdId && recipe.householdId === meals.householdId);
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!recipe) {
    return (
      <View style={[styles.root, desktop && styles.rootDesktop]}>
        <Text style={styles.title}>Recipe not found</Text>
        <Btn label="Back to library" variant="secondary" onPress={() => router.push('/meals/recipes' as Href)} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
      <Pressable onPress={() => router.push('/meals/recipes' as Href)}>
        <Text style={styles.back}>← Library</Text>
      </Pressable>
      <View style={[styles.hero, desktop && styles.heroDesktop]}>
        <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size="fill" radius={0} />
      </View>
      {meals.isCatalogEditor && !recipe.householdId ? (
        <CatalogPhotoEditor
          recipe={recipe}
          online={meals.online}
          onReview={(action, imageUrl) => meals.reviewCatalogImage(recipe.id, action, imageUrl)}
        />
      ) : null}
      <Text style={[styles.title, desktop && styles.titleDesktop]}>{recipe.name}</Text>
      <Text style={styles.meta}>
        {recipe.cuisine ?? 'Recipe'} · {recipe.cookTime ?? '—'} min · {recipe.servings ?? '—'} servings
      </Text>
      <View style={styles.macros}>
        <Macro label="kcal" value={recipe.calories} />
        <Macro label="protein" value={recipe.protein} suffix="g" />
        <Macro label="carbs" value={recipe.carbs} suffix="g" />
        <Macro label="fat" value={recipe.fat} suffix="g" />
      </View>
      <View style={styles.row}>
        <Btn
          label={fav ? 'Favourited' : 'Favourite'}
          variant={fav ? 'secondary' : 'primary'}
          disabled={!meals.online}
          onPress={() => void meals.toggleFavourite(recipe.id).catch((err) => setError(err instanceof Error ? err.message : 'Favourite failed'))}
        />
        {householdOwned ? (
          <Btn
            label="Delete"
            variant="danger"
            disabled={!meals.online}
            onPress={() => {
              void meals.deleteHouseholdRecipe(recipe.id).then(() => router.push('/meals/recipes' as Href));
            }}
          />
        ) : null}
      </View>
      <ErrorText message={error} />
      <Card>
        <Text style={styles.heading}>Slots</Text>
        <Text style={styles.body}>
          {(recipe.mealSlots ?? []).map((s) => MEAL_SLOTS.find((x) => x.key === s)?.label ?? s).join(' · ') || 'Dinner'}
        </Text>
      </Card>
      <View style={desktop ? styles.cols : styles.stack}>
        <Card>
          <Text style={styles.heading}>Ingredients</Text>
          {(recipe.ingredients ?? []).map((ing, idx) => (
            <Text key={`${ing.name}-${idx}`} style={styles.body}>
              {ing.amount ? `${ing.amount} ` : ''}
              {ing.name}
            </Text>
          ))}
        </Card>
        <Card>
          <Text style={styles.heading}>Method</Text>
          {(recipe.method ?? []).map((step, idx) => (
            <Text key={idx} style={styles.body}>
              {idx + 1}. {step}
            </Text>
          ))}
        </Card>
      </View>
      {recipe.chefTip ? (
        <Card>
          <Text style={styles.heading}>Chef tip</Text>
          <Text style={styles.body}>{recipe.chefTip}</Text>
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
          <Btn
            label={recipe.excludedFromAuto ? 'Include in auto-generate' : 'Exclude from auto-generate'}
            variant="ghost"
            disabled={!meals.online}
            onPress={() => void meals.updateHouseholdRecipe(recipe.id, { excludedFromAuto: !recipe.excludedFromAuto })}
          />
        </Card>
      ) : recipe.notes ? (
        <Card>
          <Text style={styles.heading}>Notes</Text>
          <Text style={styles.body}>{recipe.notes}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  rootDesktop: { padding: 48 },
  content: { padding: space.md, gap: 12, paddingBottom: 48 },
  contentDesktop: { paddingHorizontal: 48, maxWidth: 980 },
  back: { color: colors.accent, fontWeight: '700' },
  hero: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  heroDesktop: { height: 320 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleDesktop: { fontSize: 40 },
  meta: { color: colors.textMuted },
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
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  stack: { gap: 12 },
});
