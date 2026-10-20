import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addableMealSlotKeys,
  DAY_LABELS,
  dayIsRemovedFromPlan,
  hiddenMealSlotKeysForDay,
  isHouseholdAudience,
  MEAL_SLOTS,
  normalizeAudiencePersonIds,
  orderedMealSlotKeys,
  slotMatchesPersonFilter,
  visibleMealSlotKeys,
  type Day,
  type MealSlotKey,
} from '@kinexus/domain';

import { Chip, Sheet } from '@/src/features/meals/meals-kit';
import { RecipePhoto } from '@/src/features/meals/RecipePhoto';
import type { PlanSlot } from '@/src/features/meals/use-meals-sync';
import { weekRangeLabel } from '@/src/features/meals/week-labels';
import { colors, radius, space } from '@/src/features/shell/theme';

export function slotTitle(slot: MealSlotKey): string {
  return MEAL_SLOTS.find((s) => s.key === slot)?.label ?? slot;
}

export type PlanPersonFilter = 'all' | string;

export type PlanCellView = {
  key: string;
  slotKey: MealSlotKey;
  cell: PlanSlot | undefined;
  household: boolean;
};

export function audienceLabel(
  audiencePersonIds: readonly string[] | null | undefined,
  personNames: ReadonlyMap<string, string>,
): string {
  const ids = normalizeAudiencePersonIds(audiencePersonIds);
  if (ids.length === 0) return 'Family';
  return ids.map((id) => personNames.get(id) ?? 'Someone').join(', ');
}

/** Cards to show for one meal type on a day, honoring the person filter. */
export function planCellsForSlot(
  slots: readonly PlanSlot[],
  day: Day,
  slotKey: MealSlotKey,
  personFilter: PlanPersonFilter,
): PlanCellView[] {
  const rows = slots.filter((slot) => slot.day === day && slot.slotKey === slotKey && !slot.hidden);
  const household = rows.find((slot) => isHouseholdAudience(slot.audiencePersonIds));
  const personals = rows.filter((slot) => !isHouseholdAudience(slot.audiencePersonIds));
  const views: PlanCellView[] = [];

  // Everyone: household meals only (empty family card when the slot is on the day plan).
  if (personFilter === 'all') {
    views.push({ key: `${day}_${slotKey}_family`, slotKey, cell: household, household: true });
    return views;
  }

  // Person: household meals plus that person's personal/group meals.
  if (household || personals.length === 0) {
    views.push({ key: `${day}_${slotKey}_family`, slotKey, cell: household, household: true });
  }
  for (const slot of personals) {
    if (!slotMatchesPersonFilter(slot, personFilter)) continue;
    views.push({ key: slot.id, slotKey, cell: slot, household: false });
  }
  return views;
}

export function planDayMealViews(
  activeSlots: readonly MealSlotKey[],
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
  slots: readonly PlanSlot[],
  day: Day,
  personFilter: PlanPersonFilter,
): { visible: MealSlotKey[]; cells: PlanCellView[]; addable: MealSlotKey[]; removed: boolean; filled: number; kcal: number } {
  const { visible, addable, removed } = dayPlanSlots(activeSlots, slotMap, day);
  // Person filter: personal-only meals can appear even when that slot type is off the family day plan.
  const personalKeys =
    personFilter === 'all'
      ? []
      : slots
          .filter(
            (slot) =>
              slot.day === day &&
              !slot.hidden &&
              !isHouseholdAudience(slot.audiencePersonIds) &&
              slotMatchesPersonFilter(slot, personFilter),
          )
          .map((slot) => slot.slotKey);
  const visibleKeys = orderedMealSlotKeys([...visible, ...personalKeys]);
  const cells = visibleKeys.flatMap((slotKey) => planCellsForSlot(slots, day, slotKey, personFilter));
  const filled = cells.filter((item) => item.cell?.recipeId).length;
  const kcal = cells.reduce((sum, item) => sum + (item.cell?.calories ?? 0), 0);
  return { visible: visibleKeys, cells, addable, removed, filled, kcal };
}

/** Meal boxes that already have a recipe assigned. */
export function appliedPlanCells(cells: readonly PlanCellView[]): PlanCellView[] {
  return cells.filter((item) => Boolean(item.cell?.recipeId));
}

/** Slot types the add-meal sheet can offer for a family meal on this day. */
export function familyAddMealSlotOptions(
  activeSlots: readonly MealSlotKey[],
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
  slots: readonly PlanSlot[],
  day: Day,
): MealSlotKey[] {
  const { visible, addable } = dayPlanSlots(activeSlots, slotMap, day);
  const emptyVisible = visible.filter((slotKey) => {
    const household = slots.find(
      (slot) =>
        slot.day === day &&
        slot.slotKey === slotKey &&
        isHouseholdAudience(slot.audiencePersonIds) &&
        !slot.hidden,
    );
    return !household?.recipeId;
  });
  return orderedMealSlotKeys([...emptyVisible, ...addable]);
}

export function dayPlanSlots(
  activeSlots: readonly MealSlotKey[],
  slotMap: ReadonlyMap<string, { hidden?: boolean }>,
  day: Day,
): { visible: MealSlotKey[]; addable: MealSlotKey[]; removed: boolean } {
  const hiddenOnDay = hiddenMealSlotKeysForDay(slotMap, day);
  const visible = visibleMealSlotKeys(activeSlots, hiddenOnDay);
  return {
    visible,
    addable: addableMealSlotKeys(visible),
    removed: dayIsRemovedFromPlan(activeSlots, slotMap, day),
  };
}

export function WeekSwitcher({
  weekStart,
  onPrev,
  onNext,
}: {
  weekStart: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.weekBar}>
      <Pressable onPress={onPrev} style={styles.weekBtn} hitSlop={8}>
        <Text style={styles.weekBtnText}>‹</Text>
      </Pressable>
      <Text style={styles.weekLabel}>{weekRangeLabel(weekStart)}</Text>
      <Pressable onPress={onNext} style={styles.weekBtn} hitSlop={8}>
        <Text style={styles.weekBtnText}>›</Text>
      </Pressable>
    </View>
  );
}

export function DayStrip({
  days,
  selected,
  today,
  dateNums,
  onSelect,
}: {
  days: readonly Day[];
  selected: Day;
  today: Day | null;
  dateNums: ReadonlyMap<Day, string>;
  onSelect: (day: Day) => void;
}) {
  return (
    <View style={styles.dayStrip}>
      {days.map((day) => {
        const active = day === selected;
        const isToday = day === today;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            style={[styles.dayStripItem, active && styles.dayStripItemActive, isToday && !active && styles.dayStripItemToday]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <Text style={[styles.dayStripDow, active && styles.dayStripTextActive]}>{DAY_LABELS[day].slice(0, 3)}</Text>
            <Text style={[styles.dayStripNum, active && styles.dayStripTextActive]}>{dateNums.get(day) ?? ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PlanMealCard({
  slot,
  slotLabel,
  filled,
  photoUrl,
  emoji,
  title,
  meta,
  photoHeight,
  onPress,
}: {
  slot: MealSlotKey;
  slotLabel?: string;
  filled: boolean;
  photoUrl?: string;
  emoji?: string | null;
  title: string;
  meta: string;
  photoHeight: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.meal, !filled && styles.mealEmpty]}>
      <View style={[styles.mealPhoto, { height: photoHeight }]}>
        <RecipePhoto uri={filled ? photoUrl : undefined} emoji={filled ? emoji : '＋'} size="fill" radius={0} />
      </View>
      <View style={styles.mealBody}>
        <Text style={[styles.slotLabel, !filled && styles.slotEmpty]}>{slotLabel ?? slotTitle(slot)}</Text>
        <Text style={styles.mealName}>{title}</Text>
        <Text style={styles.mealMeta}>{meta || ' '}</Text>
      </View>
    </Pressable>
  );
}

export function PlanAddTile({ onPress, label = 'Add meal' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.addTile} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.addTilePlus}>＋</Text>
    </Pressable>
  );
}

export function AddMealSheet({
  day,
  people,
  familySlotOptions,
  error,
  busy,
  onClose,
  onConfirm,
}: {
  day: Day | null;
  people: readonly { id: string; name: string }[];
  familySlotOptions: readonly MealSlotKey[];
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (slot: MealSlotKey, audiencePersonIds: string[]) => void;
}) {
  const [slot, setSlot] = useState<MealSlotKey | null>(null);
  const [audience, setAudience] = useState<string[]>([]);

  useEffect(() => {
    setSlot(null);
    setAudience([]);
  }, [day]);

  if (!day) return null;
  const family = audience.length === 0;
  const slotOptions = family ? familySlotOptions : MEAL_SLOTS.map((item) => item.key);
  const slotReady = slot !== null && slotOptions.includes(slot);
  const canSubmit = slotReady && !busy && (family || audience.length > 0);

  return (
    <Sheet visible title={`Add meal · ${DAY_LABELS[day]}`} onClose={onClose}>
      <Text style={styles.addHint}>Pick who this is for and which meal, then choose a recipe.</Text>
      <Text style={styles.sheetLabel}>Who eats</Text>
      <View style={styles.sheetChips}>
        <Chip label="Family" active={family} onPress={() => { setAudience([]); setSlot(null); }} />
        {people.map((person) => {
          const active = audience.includes(person.id);
          return (
            <Chip
              key={person.id}
              label={person.name}
              active={active}
              onPress={() => {
                setSlot(null);
                if (family) {
                  setAudience([person.id]);
                  return;
                }
                setAudience((current) =>
                  active ? current.filter((id) => id !== person.id) : [...current, person.id],
                );
              }}
            />
          );
        })}
      </View>
      <Text style={styles.sheetLabel}>Meal</Text>
      {slotOptions.length === 0 ? (
        <Text style={styles.addHint}>
          Every meal time is already filled for the family. Pick people above to add a personal meal, or clear a
          slot first.
        </Text>
      ) : (
        <View style={styles.sheetChips}>
          {slotOptions.map((key) => (
            <Chip key={key} label={slotTitle(key)} active={slot === key} onPress={() => setSlot(key)} />
          ))}
        </View>
      )}
      {error ? <Text style={styles.sheetError}>{error}</Text> : null}
      <Pressable
        onPress={() => {
          if (!slot || !canSubmit) return;
          onConfirm(slot, audience);
        }}
        disabled={!canSubmit}
        style={[styles.sheetSubmit, !canSubmit && styles.sheetSubmitDisabled]}>
        <Text style={styles.sheetSubmitLabel}>{busy ? 'Adding…' : 'Continue'}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  weekBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgHover,
  },
  weekBtnText: { color: colors.text, fontSize: 22, fontWeight: '600', marginTop: -2 },
  weekLabel: { color: colors.text, fontWeight: '700', fontSize: 14, minWidth: 168, textAlign: 'center' },
  dayStrip: { flexDirection: 'row', gap: 6 },
  dayStripItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  dayStripItemActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayStripItemToday: { borderColor: colors.accent },
  dayStripDow: { color: colors.textDim, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  dayStripNum: { color: colors.text, fontSize: 16, fontWeight: '800' },
  dayStripTextActive: { color: colors.bg },
  meal: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mealEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  mealPhoto: { width: '100%' },
  mealBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 4 },
  slotLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  slotEmpty: { color: colors.accent },
  mealName: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  mealMeta: { color: colors.textDim, fontSize: 13, minHeight: 18 },
  addTile: {
    minHeight: 160,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTilePlus: { color: colors.accent, fontSize: 36, fontWeight: '300', lineHeight: 40 },
  addHint: { color: colors.textMuted, marginBottom: 12, lineHeight: 20 },
  sheetLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sheetError: { color: colors.danger ?? '#c44', fontSize: 13, marginBottom: 8 },
  sheetSubmit: {
    marginTop: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetSubmitDisabled: { opacity: 0.45 },
  sheetSubmitLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
