import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MEAL_SLOTS, recipeBaseServings, scaleRecipeToServings, type Recipe } from '@kinexus/domain';

import { IngredientSwapSlot } from '@/src/features/meals/IngredientSwapSlot';
import { RecipeImageDisclaimer } from '@/src/features/meals/RecipeImageDisclaimer';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { colors, radius } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

export function RecipePeek({
  recipe,
  viewServings,
  target,
  useLabel = 'Use this',
  onUse,
  onRandom,
  onSwap,
  onBack,
  onEdit,
  onNotForFamily,
  notForFamilyBusy = false,
  note,
  afterIdentity,
  belowActions,
}: {
  recipe: Recipe;
  /** Scale ingredient amounts from the written yield to this many serves. */
  viewServings?: number | null;
  target?: { calories: number; protein: number } | null;
  useLabel?: string;
  onUse?: () => void;
  onRandom?: () => void;
  onSwap?: () => void;
  onBack?: () => void;
  onEdit?: () => void;
  onNotForFamily?: () => void;
  notForFamilyBusy?: boolean;
  note?: string | null;
  afterIdentity?: ReactNode;
  belowActions?: ReactNode;
}) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const slots = (recipe.mealSlots ?? [])
    .map((key) => MEAL_SLOTS.find((slot) => slot.key === key)?.label)
    .filter(Boolean)
    .join(' · ');
  const shown = scaleRecipeToServings(recipe, viewServings);
  const baseServings = recipeBaseServings(recipe);
  const servingLabel =
    shown.servings != null && shown.servings > 0
      ? `${shown.servings} ${shown.servings === 1 ? 'serving' : 'servings'}${
          viewServings != null && baseServings != null && viewServings !== baseServings
            ? ` · scaled from ${baseServings}`
            : ''
        }`
      : null;
  const meta = [
    recipe.vegetarian ? 'Vegetarian' : null,
    recipe.cuisine,
    slots || null,
    recipe.cookTime != null ? `${recipe.cookTime} min` : null,
    servingLabel,
  ]
    .filter(Boolean)
    .join(' · ');
  const hasActions = Boolean(onUse || onSwap || onRandom || onBack || onNotForFamily || note || belowActions);
  const ingredients = shown.ingredients ?? [];
  const method = recipe.method ?? [];

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, desktop && styles.heroDesktop]}>
        <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size="fill" radius={0} />
      </View>
      <RecipeImageDisclaimer visible={Boolean(recipe.imageUrl)} />
      <View style={styles.titleRow}>
        <Text style={[styles.name, desktop && styles.nameDesktop]}>{recipe.name}</Text>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit recipe"
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
            <Text style={styles.editLabel}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      <Text style={styles.macros}>
        {recipe.calories ?? '—'}
        {target ? ` / ${target.calories}` : ''} kcal · {recipe.protein ?? '—'}
        {target ? ` / ${target.protein}` : ''}g protein
        {recipe.carbs != null ? ` · ${recipe.carbs}g carbs` : ''}
        {recipe.fat != null ? ` · ${recipe.fat}g fat` : ''}
      </Text>
      {afterIdentity}
      {recipe.chefTip ? <Text style={styles.tip}>{recipe.chefTip}</Text> : null}
      {ingredients.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Ingredients</Text>
          {ingredients.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.ingredient}>
              {item.amount ? <Text style={styles.amount}>{item.amount}</Text> : null}
              <View style={styles.ingredientSlot}>
                <IngredientSwapSlot recipe={recipe} index={index}>
                  {(button) => (
                    <View style={styles.ingredientLine}>
                      <Text style={styles.ingredientName}>{item.name}</Text>
                      {button}
                    </View>
                  )}
                </IngredientSwapSlot>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {method.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Method</Text>
          {method.map((step, index) => (
            <View key={index} style={styles.step}>
              <Text style={styles.stepNum}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {hasActions ? (
        <View style={styles.actionBlock}>
          {onUse || onSwap || onRandom || onBack ? (
            <View style={styles.actions}>
              {onUse ? <PeekBtn label={useLabel} variant="primary" onPress={onUse} /> : null}
              {onSwap ? <PeekBtn label="Swap" onPress={onSwap} /> : null}
              {onRandom ? <PeekBtn label="Random" onPress={onRandom} /> : null}
              {onBack ? <PeekBtn label="Back" onPress={onBack} /> : null}
            </View>
          ) : null}
          {onNotForFamily ? (
            <Pressable
              onPress={onNotForFamily}
              disabled={notForFamilyBusy}
              style={[styles.btn, styles.btnReject, notForFamilyBusy && styles.btnDisabled]}>
              <Text style={[styles.btnLabel, styles.btnLabelReject]}>
                {notForFamilyBusy ? 'Saving…' : 'Not for my family'}
              </Text>
            </Pressable>
          ) : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {belowActions}
        </View>
      ) : null}
    </View>
  );
}

function PeekBtn({
  label,
  onPress,
  variant = 'secondary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, variant === 'primary' && styles.btnPrimary]}>
      <Text style={[styles.btnLabel, variant === 'primary' && styles.btnLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 8 },
  hero: {
    height: 200,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
  },
  heroDesktop: { height: 240 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  nameDesktop: { fontSize: 26, lineHeight: 32 },
  editBtn: {
    marginTop: 2,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  meta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  macros: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  tip: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  section: { gap: 8, marginTop: 6 },
  heading: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  ingredient: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  amount: { width: 88, color: colors.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  ingredientSlot: { flex: 1, minWidth: 0 },
  ingredientLine: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', minWidth: 0 },
  ingredientName: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 20 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: { width: 18, color: colors.accent, fontSize: 14, lineHeight: 22, fontWeight: '800' },
  stepText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
  actionBlock: { gap: 10, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  btnLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  btnLabelPrimary: { color: colors.bg },
  btnReject: { alignSelf: 'flex-start', borderColor: colors.danger, backgroundColor: colors.dangerBg },
  btnDisabled: { opacity: 0.55 },
  btnLabelReject: { color: colors.danger },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
