import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MEAL_SLOTS, type Recipe } from '@kinexus/domain';

import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import { colors, radius } from '@/src/features/shell/theme';

export function RecipePeek({
  recipe,
  target,
  useLabel = 'Use this',
  onUse,
  onRandom,
  onSwap,
  onBack,
  onEdit,
  onOpen,
  belowActions,
}: {
  recipe: Recipe;
  target?: { calories: number; protein: number } | null;
  useLabel?: string;
  onUse?: () => void;
  onRandom?: () => void;
  onSwap?: () => void;
  onBack?: () => void;
  onEdit?: () => void;
  onOpen?: () => void;
  belowActions?: ReactNode;
}) {
  const slots = (recipe.mealSlots ?? [])
    .map((key) => MEAL_SLOTS.find((slot) => slot.key === key)?.label)
    .filter(Boolean)
    .join(' · ');
  const hasActions = Boolean(onEdit || onOpen || onUse || onSwap || onRandom || onBack || belowActions);
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <RecipePhoto uri={recipe.imageUrl} emoji={recipe.emoji} size="fill" radius={0} />
      </View>
      <Text style={styles.name}>{recipe.name}</Text>
      <Text style={styles.meta}>
        {[
          recipe.vegetarian ? 'Vegetarian' : null,
          recipe.cuisine,
          slots || null,
          recipe.cookTime != null ? `${recipe.cookTime} min` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Text style={styles.macros}>
        {recipe.calories ?? '—'}
        {target ? ` / ${target.calories}` : ''} kcal · {recipe.protein ?? '—'}
        {target ? ` / ${target.protein}` : ''}g protein
        {recipe.carbs != null ? ` · ${recipe.carbs}g carbs` : ''}
        {recipe.fat != null ? ` · ${recipe.fat}g fat` : ''}
      </Text>
      {hasActions ? (
        <View style={styles.actionBlock}>
          {onEdit || onOpen || onUse || onSwap || onRandom || onBack ? (
            <View style={styles.actions}>
              {onEdit ? <PeekBtn label="Edit" variant={onUse ? 'secondary' : 'primary'} onPress={onEdit} /> : null}
              {onUse ? <PeekBtn label={useLabel} variant="primary" onPress={onUse} /> : null}
              {onOpen ? <PeekBtn label="Open recipe" onPress={onOpen} /> : null}
              {onSwap ? <PeekBtn label="Swap" onPress={onSwap} /> : null}
              {onRandom ? <PeekBtn label="Random" onPress={onRandom} /> : null}
              {onBack ? <PeekBtn label="Back" onPress={onBack} /> : null}
            </View>
          ) : null}
          {belowActions}
        </View>
      ) : null}
      {recipe.chefTip ? <Text style={styles.tip}>{recipe.chefTip}</Text> : null}
      {(recipe.ingredients ?? []).length > 0 ? (
        <>
          <Text style={styles.heading}>Ingredients</Text>
          {(recipe.ingredients ?? []).map((item, index) => (
            <Text key={`${item.name}-${index}`} style={styles.line}>
              {item.amount ? `${item.amount} ${item.name}` : item.name}
            </Text>
          ))}
        </>
      ) : null}
      {(recipe.method ?? []).length > 0 ? (
        <>
          <Text style={styles.heading}>Method</Text>
          {(recipe.method ?? []).map((step, index) => (
            <Text key={index} style={styles.line}>
              {index + 1}. {step}
            </Text>
          ))}
        </>
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
  wrap: { gap: 8, paddingBottom: 8 },
  hero: {
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  macros: { color: colors.text, fontSize: 13, fontWeight: '700' },
  actionBlock: { gap: 8, marginTop: 4 },
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
  tip: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  heading: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  line: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
