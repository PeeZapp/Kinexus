import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  MEAL_SLOTS,
  recipesForPicker,
  type Day,
  type HouseholdPerson,
  type MealSlotKey,
  type Recipe,
  type SwapRecipeFilters,
} from '@kinexus/domain';

import { Chip, Sheet } from '@/src/features/meals/meals-kit';
import { RecipePeek } from '@/src/features/meals/RecipePeek';
import { RecipePhoto, recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import { SwapRecipePicker } from '@/src/features/meals/SwapRecipePicker';
import type { PlanSlot } from '@/src/features/meals/use-meals-sync';
import { colors, radius, space } from '@/src/features/shell/theme';

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
  onAllocate: (personId: string | null) => void;
  onClear: () => void;
  onHide: () => void;
  onShuffle: () => void | Promise<Recipe | null>;
  onOpenRecipe: (id: string) => void;
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
  onAllocate,
  onClear,
  onHide,
  onShuffle,
  onOpenRecipe,
}: Props) {
  const [filters, setFilters] = useState<SwapRecipeFilters>(EMPTY_FILTERS);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [picking, setPicking] = useState(false);
  const label = MEAL_SLOTS.find((s) => s.key === slotKey)?.label ?? 'Slot';
  const pool = useMemo(() => {
    if (!slotKey) return [];
    return recipesForPicker(recipes, slotKey, approvedIds);
  }, [approvedIds, recipes, slotKey]);
  const currentRecipe = slot?.recipeId ? recipes.find((recipe) => recipe.id === slot.recipeId) ?? null : null;
  const showRecipe = Boolean(currentRecipe) && !picking && !viewing;
  const showPicker = canEdit && (picking || !currentRecipe);

  useEffect(() => {
    if (!visible) return;
    setFilters(EMPTY_FILTERS);
    setViewing(null);
    setPicking(false);
  }, [day, slotKey, visible]);

  const hint = !canEdit
    ? assigneeName
      ? `${assigneeName} picks this ${label.toLowerCase()}.`
      : 'This slot is not assigned to you. Only a parent can fill Anyone slots.'
    : approvedIds
      ? `Pick from your approved ${label.toLowerCase()} list.`
      : 'Pick a recipe for this slot.';

  function closeSheet() {
    setFilters(EMPTY_FILTERS);
    setViewing(null);
    setPicking(false);
    onClose();
  }

  return (
    <Sheet visible={visible} title={day ? `${titleCase(day)} · ${label}` : label} onClose={closeSheet}>
      {showRecipe && currentRecipe ? (
        <RecipePeek
          recipe={currentRecipe}
          target={target}
          belowActions={
            <>
              {canEdit || canAssign ? (
                <View style={styles.actions}>
                  {canEdit ? <ActionBtn label="Swap" onPress={() => setPicking(true)} /> : null}
                  {canEdit ? (
                    <ActionBtn label="Random" onPress={() => void Promise.resolve(onShuffle())} />
                  ) : null}
                  {canAssign ? <ActionBtn label="Clear" onPress={onClear} /> : null}
                  {canAssign ? <ActionBtn label="Remove from day" onPress={onHide} /> : null}
                </View>
              ) : null}
              <WhoPicks
                canAssign={canAssign}
                people={people}
                assignedPersonId={slot?.assignedPersonId}
                onAllocate={onAllocate}
                compact
              />
            </>
          }
        />
      ) : null}
      {showRecipe ? null : currentRecipe ? null : slot?.recipeId ? (
        <View style={styles.currentBlock}>
          <Pressable
            onPress={() => {
              if (slot.recipeId) onOpenRecipe(slot.recipeId);
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
          <View style={styles.actions}>
            <ActionBtn label="View recipe" onPress={() => slot.recipeId && onOpenRecipe(slot.recipeId)} />
            {canAssign ? <ActionBtn label="Clear" onPress={onClear} /> : null}
            {canAssign ? <ActionBtn label="Remove from day" onPress={onHide} /> : null}
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>{hint}</Text>
      )}
      {showPicker && currentRecipe && !viewing ? (
        <View style={[styles.actions, styles.actionsSpaced]}>
          <ActionBtn label="Back to recipe" onPress={() => setPicking(false)} />
          {canAssign ? <ActionBtn label="Clear" onPress={onClear} /> : null}
          {canAssign ? <ActionBtn label="Remove from day" onPress={onHide} /> : null}
        </View>
      ) : null}
      {showPicker && !currentRecipe && !viewing && canAssign ? (
        <View style={[styles.actions, styles.actionsSpaced]}>
          <ActionBtn label="Remove from day" onPress={onHide} />
        </View>
      ) : null}
      {showPicker && !viewing ? (
        <WhoPicks canAssign={canAssign} people={people} assignedPersonId={slot?.assignedPersonId} onAllocate={onAllocate} />
      ) : null}
      {showPicker ? (
        <SwapRecipePicker
          recipes={pool}
          currentId={slot?.recipeId}
          current={currentRecipe}
          target={target}
          filters={filters}
          viewing={viewing}
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

function WhoPicks({
  canAssign,
  people,
  assignedPersonId,
  onAllocate,
  compact = false,
}: {
  canAssign: boolean;
  people: HouseholdPerson[];
  assignedPersonId?: string | null;
  onAllocate: (personId: string | null) => void;
  compact?: boolean;
}) {
  if (!canAssign || people.length === 0) return null;
  return (
    <View style={[styles.assign, compact && styles.assignCompact]}>
      <Text style={styles.assignLabel}>Who picks</Text>
      {compact ? null : (
        <Text style={styles.assignHint}>Anyone is parents only. Assign someone to pick from their approved list.</Text>
      )}
      <View style={styles.chips}>
        <Chip label="Anyone" active={!assignedPersonId} onPress={() => onAllocate(null)} />
        {people.map((person) => (
          <Chip
            key={person.id}
            label={person.name}
            active={assignedPersonId === person.id}
            onPress={() => onAllocate(person.id)}
          />
        ))}
      </View>
    </View>
  );
}

function titleCase(day: Day): string {
  return day.slice(0, 1).toUpperCase() + day.slice(1);
}

function ActionBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  assign: { gap: 6, marginBottom: 10 },
  assignCompact: { marginBottom: 0 },
  assignLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  assignHint: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
});
