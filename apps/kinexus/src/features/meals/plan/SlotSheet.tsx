import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  isHouseholdAudience,
  MEAL_SLOTS,
  recipeForHouseholdView,
  recipesForPicker,
  type Day,
  type HouseholdPerson,
  type MealSlotKey,
  type Recipe,
  type SwapRecipeFilters,
} from '@kinexus/domain';

import { Sheet } from '@/src/features/meals/meals-kit';
import { SideDishPicker } from '@/src/features/meals/plan/SideDishPicker';
import { audienceLabel } from '@/src/features/meals/plan/PlanShared';
import { RecipePeek } from '@/src/features/meals/RecipePeek';
import { RecipePhoto, recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import { SwapRecipePicker } from '@/src/features/meals/SwapRecipePicker';
import type { PlanSlot } from '@/src/features/meals/use-meals-sync';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

type Props = {
  visible: boolean;
  day: Day | null;
  slotKey: MealSlotKey | null;
  slot: PlanSlot | undefined;
  recipes: Recipe[];
  people: HouseholdPerson[];
  canAssign: boolean;
  canEdit: boolean;
  assigneeName: string | null;
  approvedIds: Set<string> | null;
  target?: { calories: number; protein: number } | null;
  onClose: () => void;
  onAssign: (recipe: Recipe) => void;
  onClear: () => void;
  onHide: () => void;
  onShuffle: () => void | Promise<Recipe | null>;
  onOpenRecipe: (id: string, serves?: number) => void;
  onEditRecipe: (id: string) => void;
  onSetSides?: (sideRecipeIds: string[]) => void;
};

const EMPTY_FILTERS: SwapRecipeFilters = {};

export function SlotSheet({
  visible,
  day,
  slotKey,
  slot,
  recipes,
  people,
  canAssign,
  canEdit,
  assigneeName,
  approvedIds,
  target,
  onClose,
  onAssign,
  onClear,
  onHide,
  onShuffle,
  onOpenRecipe,
  onEditRecipe,
  onSetSides,
}: Props) {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const [filters, setFilters] = useState<SwapRecipeFilters>(EMPTY_FILTERS);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickingSide, setPickingSide] = useState(false);
  const label = MEAL_SLOTS.find((s) => s.key === slotKey)?.label ?? 'Slot';
  const personNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people) map.set(person.id, person.name);
    return map;
  }, [people]);
  const householdMeal = isHouseholdAudience(slot?.audiencePersonIds);
  const eatsLabel = audienceLabel(slot?.audiencePersonIds, personNames);
  const pool = useMemo(() => {
    if (!slotKey) return [];
    return recipesForPicker(recipes, slotKey, approvedIds);
  }, [approvedIds, recipes, slotKey]);
  const currentRecipe = recipeForHouseholdView(recipes, slot?.recipeId) ?? null;
  const sideIds = slot?.sideRecipeIds ?? [];
  const sides = sideIds.flatMap((id) => {
    const side = recipeForHouseholdView(recipes, id);
    return side ? [side] : [];
  });
  const showRecipe = Boolean(currentRecipe) && !picking && !viewing && !pickingSide;
  const showPicker = canEdit && (picking || !currentRecipe);
  const removeLabel = householdMeal ? 'Remove from day' : 'Remove meal';

  useEffect(() => {
    if (!visible) return;
    setFilters(EMPTY_FILTERS);
    setViewing(null);
    setPicking(false);
    setPickingSide(false);
  }, [day, slotKey, slot?.id, visible]);

  const hint = !canEdit
    ? assigneeName
      ? `${assigneeName} picks this ${label.toLowerCase()}.`
      : 'This slot is not assigned to you. Only a parent can fill Anyone slots.'
    : approvedIds
      ? `Pick from your approved ${label.toLowerCase()} list.`
      : null;

  function closeSheet() {
    setFilters(EMPTY_FILTERS);
    setViewing(null);
    setPicking(false);
    setPickingSide(false);
    onClose();
  }

  function openRecipe(id: string) {
    onOpenRecipe(id, slot?.targetServings);
  }

  const sheetTitle = day
    ? householdMeal
      ? `${titleCase(day)} · ${label}`
      : `${titleCase(day)} · ${label} · ${eatsLabel}`
    : label;

  const openRecipeButton =
    showRecipe && currentRecipe ? (
      <Pressable
        onPress={() => openRecipe(currentRecipe.id)}
        hitSlop={8}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && styles.pressed]}>
        <Text style={styles.headerAction}>Open recipe</Text>
      </Pressable>
    ) : null;

  const removeAction = canAssign ? (
    <Pressable
      onPress={onHide}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => [pressed && styles.pressed]}>
      <Text style={styles.headerRemove}>{removeLabel}</Text>
    </Pressable>
  ) : null;

  const headerActions =
    (desktop && openRecipeButton) || removeAction ? (
      <View style={styles.headerActions}>
        {desktop ? openRecipeButton : null}
        {removeAction}
      </View>
    ) : null;

  const planActionCount = (canEdit ? 2 : 0) + (canAssign ? 1 : 0);

  return (
    <Sheet
      visible={visible}
      title={sheetTitle}
      onClose={closeSheet}
      desktopMaxWidth={showRecipe ? 680 : undefined}
      action={headerActions}
      header={!desktop ? openRecipeButton : undefined}>
      {!householdMeal ? (
        <Text style={styles.audienceBanner}>For {eatsLabel}</Text>
      ) : null}
      {showRecipe && currentRecipe ? (
        <RecipePeek
          recipe={currentRecipe}
          viewServings={slot?.targetServings}
          target={target}
          onEdit={() => onEditRecipe(currentRecipe.id)}
          afterIdentity={
            planActionCount > 0 ? (
              <View style={styles.actions}>
                {canEdit ? <ActionBtn label="Swap" onPress={() => setPicking(true)} /> : null}
                {canEdit ? <ActionBtn label="Random" onPress={() => void Promise.resolve(onShuffle())} /> : null}
                {canAssign ? <ActionBtn label="Clear" onPress={onClear} /> : null}
              </View>
            ) : undefined
          }
          belowActions={
            onSetSides ? (
              <View style={styles.sides}>
                <Text style={styles.sidesLabel}>Sides</Text>
                {sides.length === 0 ? <Text style={styles.sideEmpty}>No side with this meal.</Text> : null}
                {sides.map((side) => (
                  <View key={side.id} style={styles.sideRow}>
                    <Pressable onPress={() => openRecipe(side.id)} style={styles.sideName} accessibilityRole="button">
                      <Text style={styles.name}>{side.name}</Text>
                    </Pressable>
                    {canEdit ? (
                      <Pressable
                        onPress={() => onSetSides(sideIds.filter((id) => id !== side.id))}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${side.name}`}>
                        <Text style={styles.sideRemove}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {canEdit ? (
                  <Pressable onPress={() => setPickingSide(true)} hitSlop={6} accessibilityRole="button" style={styles.addSide}>
                    <Text style={styles.addSideLabel}>Add side</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : undefined
          }
        />
      ) : null}
      {showRecipe ? null : currentRecipe ? null : slot?.recipeId ? (
        <View style={styles.currentBlock}>
          <Pressable
            onPress={() => {
              if (slot.recipeId) openRecipe(slot.recipeId);
            }}
            style={styles.current}>
            <RecipePhoto uri={recipePhotoUrl(recipes, slot.recipeId)} emoji={slot.emoji} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{slot.recipeName}</Text>
              <Text style={styles.meta}>
                {slot.calories ?? '—'} kcal · {slot.protein ?? '—'}g protein
                {assigneeName ? ` · ${assigneeName}` : ''}
              </Text>
            </View>
          </Pressable>
          <View style={[styles.actions, styles.actionsSpaced]}>
            <ActionBtn label="Edit" onPress={() => slot.recipeId && onEditRecipe(slot.recipeId)} />
            <ActionBtn label="View recipe" onPress={() => slot.recipeId && openRecipe(slot.recipeId)} />
            {canAssign ? <ActionBtn label="Clear" onPress={onClear} /> : null}
          </View>
        </View>
      ) : (
        hint ? <Text style={styles.hint}>{hint}</Text> : null
      )}
      {showPicker && currentRecipe && !viewing ? (
        <View style={[styles.actions, styles.actionsSpaced]}>
          <ActionBtn label="Back to recipe" onPress={() => setPicking(false)} />
          {canAssign ? <ActionBtn label="Clear" onPress={onClear} /> : null}
        </View>
      ) : null}
      {pickingSide && canEdit ? (
        <View style={styles.sides}>
          <ActionBtn label="Back to recipe" onPress={() => setPickingSide(false)} />
          <SideDishPicker
            recipes={recipes}
            selectedIds={sideIds}
            excludeIds={slot?.recipeId ? [slot.recipeId] : []}
            onAdd={(recipe) => onSetSides?.([...sideIds, recipe.id])}
            onRemove={(id) => onSetSides?.(sideIds.filter((item) => item !== id))}
          />
        </View>
      ) : null}
      {showPicker ? (
        <SwapRecipePicker
          recipes={pool}
          currentId={slot?.recipeId}
          current={currentRecipe}
          target={target}
          filters={filters}
          viewing={viewing}
          viewServings={slot?.targetServings}
          showRandom={canEdit}
          onChangeFilters={setFilters}
          onView={setViewing}
          onPick={onAssign}
          onRandom={() => {
            void Promise.resolve(onShuffle()).then((picked) => {
              if (!picked) return;
              setViewing(null);
              setPicking(false);
            });
          }}
        />
      ) : null}
    </Sheet>
  );
}

function titleCase(day: Day): string {
  return day.slice(0, 1).toUpperCase() + day.slice(1);
}

function ActionBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  audienceBanner: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  currentBlock: { gap: 8, marginBottom: 10 },
  current: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: space.sm,
  },
  hint: { color: colors.textMuted, marginBottom: 10, fontSize: 13 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerAction: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  headerRemove: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionsSpaced: { marginBottom: 10 },
  actionBtn: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  actionLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  sides: { gap: 4, marginTop: 8 },
  sideEmpty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  sidesLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sideName: { flex: 1 },
  sideRemove: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  addSide: { alignSelf: 'flex-start', paddingVertical: 8 },
  addSideLabel: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
