import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addableMealSlotKeys,
  DAY_LABELS,
  dayIsRemovedFromPlan,
  formatCostPerServe,
  hiddenMealSlotKeysForDay,
  isHouseholdAudience,
  MEAL_SLOTS,
  normalizeAudiencePersonIds,
  orderedMealSlotKeys,
  recipesForPicker,
  slotMatchesPersonFilter,
  slotTarget,
  visibleMealSlotKeys,
  type Day,
  type MealSlotKey,
  type NutritionGoals,
  type Recipe,
  type SwapRecipeFilters,
} from '@kinexus/domain';

import { Chip, Sheet } from '@/src/features/meals/meals-kit';
import { SwapRecipePicker } from '@/src/features/meals/SwapRecipePicker';
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

/** Filled meals plus blank slots that already exist on the plan. */
export function planBoardCells(cells: readonly PlanCellView[]): PlanCellView[] {
  return cells.filter((item) => Boolean(item.cell) && !item.cell?.hidden);
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

export function planMealCardMeta(input: {
  assignee?: string | null;
  calories?: number | null;
  servings?: number | null;
  recipe?: Pick<Recipe, 'servings' | 'cost'> | null;
}): string {
  const servings =
    input.servings && input.servings > 0
      ? input.servings
      : input.recipe?.servings && input.recipe.servings > 0
        ? input.recipe.servings
        : input.recipe?.cost?.servingsBasis;
  return [
    input.assignee,
    input.calories ? `${input.calories} kcal` : null,
    formatCostPerServe(input.recipe?.cost),
    servings != null && servings > 0 ? `${servings} ${servings === 1 ? 'serving' : 'servings'}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
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
  onAddSide,
  sides,
  footer,
  blank = false,
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
  onAddSide?: () => void;
  sides?: readonly { id: string; name: string }[];
  footer?: ReactNode;
  blank?: boolean;
}) {
  return (
    <View style={styles.meal}>
      <Pressable onPress={onPress} style={styles.mealHit} accessibilityRole="button">
        {blank ? null : (
          <View style={[styles.mealPhoto, { height: photoHeight }]}>
            <RecipePhoto uri={photoUrl} emoji={emoji} size="fill" radius={0} />
          </View>
        )}
        <View style={[styles.mealBody, onAddSide ? styles.mealBodyWithAction : null, blank && styles.mealBodyBlank]}>
          <Text style={styles.slotLabel}>{slotLabel ?? slotTitle(slot)}</Text>
          {title ? <Text style={styles.mealName}>{title}</Text> : null}
          {meta.trim() ? <Text style={styles.mealMeta}>{meta}</Text> : null}
        </View>
      </Pressable>
      {filled && onAddSide ? (
        <Pressable
          onPress={onAddSide}
          style={[styles.addSide, sides && sides.length > 0 ? styles.addSideAboveLine : null]}
          accessibilityRole="button"
          accessibilityLabel="Add side dish">
          <Text style={styles.addSideLabel}>Add side dish</Text>
        </Pressable>
      ) : null}
      {sides && sides.length > 0 ? (
        <View style={styles.sideLines}>
          {sides.map((side) => (
            <Text key={side.id} style={styles.sideLine}>
              {side.name}
            </Text>
          ))}
        </View>
      ) : null}
      {footer}
    </View>
  );
}

export function WhoPicksMenu({
  people,
  assignedPersonId,
  onAllocate,
}: {
  people: { id: string; name: string }[];
  assignedPersonId?: string | null;
  onAllocate: (personId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (people.length === 0) return null;
  const current = people.find((person) => person.id === assignedPersonId)?.name ?? 'Anyone';
  return (
    <View style={styles.who}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        style={styles.whoTrigger}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Who picks, ${current}`}>
        <Text style={styles.whoLabel}>Who picks</Text>
        <View style={styles.whoValueRow}>
          <Text style={styles.whoValue} numberOfLines={1}>
            {current}
          </Text>
          <Text style={styles.whoChevron}>{open ? '▴' : '▾'}</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.whoChips}>
          <Chip
            label="Anyone"
            active={!assignedPersonId}
            onPress={() => {
              onAllocate(null);
              setOpen(false);
            }}
          />
          {people.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              active={assignedPersonId === person.id}
              onPress={() => {
                onAllocate(person.id);
                setOpen(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PlanActionTile({ onAllocate, onPick }: { onAllocate: () => void; onPick: () => void }) {
  return (
    <View style={styles.actionTile}>
      <Pressable onPress={onAllocate} accessibilityRole="button" style={styles.actionBtn}>
        <Text style={styles.actionLabel}>Allocate</Text>
      </Pressable>
      <View style={styles.actionRule} />
      <Pressable onPress={onPick} accessibilityRole="button" style={[styles.actionBtn, styles.actionBtnPick]}>
        <Text style={[styles.actionLabel, styles.actionLabelPick]}>Pick</Text>
      </Pressable>
    </View>
  );
}

export function AllocateMealSheet({
  visible,
  people,
  familySlotOptions,
  error,
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  people: readonly { id: string; name: string }[];
  familySlotOptions: readonly MealSlotKey[];
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (slot: MealSlotKey, audiencePersonIds: string[], personId: string | null) => void | Promise<void>;
}) {
  const [slot, setSlot] = useState<MealSlotKey | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [eaterId, setEaterId] = useState<string | null>(null);
  const family = eaterId === null;
  const slotOptions = family ? familySlotOptions : MEAL_SLOTS.map((item) => item.key);
  const canSubmit = slot !== null && slotOptions.includes(slot) && !busy;

  useEffect(() => {
    if (!visible) return;
    setSlot(null);
    setPickerId(null);
    setEaterId(null);
  }, [visible]);

  return (
    <Sheet visible={visible} title="Allocate" onClose={onClose} desktopMaxWidth={420}>
      <ChoiceBlock label="Meal">
        {slotOptions.length === 0 ? (
          <Text style={styles.choiceEmpty}>Every family meal on this day is filled.</Text>
        ) : (
          slotOptions.map((key) => (
            <Chip key={key} label={slotTitle(key)} active={slot === key} onPress={() => setSlot(key)} />
          ))
        )}
      </ChoiceBlock>
      <ChoiceBlock label="Who picks">
        <Chip label="Anyone" active={pickerId === null} onPress={() => setPickerId(null)} />
        {people.map((person) => (
          <Chip
            key={person.id}
            label={person.name}
            active={pickerId === person.id}
            onPress={() => setPickerId(person.id)}
          />
        ))}
      </ChoiceBlock>
      <ChoiceBlock label="Who eats">
        <Chip
          label="Family"
          active={family}
          onPress={() => {
            setEaterId(null);
            setSlot(null);
          }}
        />
        {people.map((person) => (
          <Chip
            key={person.id}
            label={person.name}
            active={eaterId === person.id}
            onPress={() => {
              setEaterId(person.id);
              setSlot(null);
            }}
          />
        ))}
      </ChoiceBlock>
      {error ? <Text style={styles.sheetError}>{error}</Text> : null}
      <Pressable
        onPress={() => {
          if (!slot || !canSubmit) return;
          void Promise.resolve(onConfirm(slot, family ? [] : [eaterId!], pickerId)).catch(() => undefined);
        }}
        disabled={!canSubmit}
        accessibilityRole="button"
        style={[styles.sheetSubmit, !canSubmit && styles.sheetSubmitDisabled]}>
        <Text style={styles.sheetSubmitLabel}>{busy ? 'Saving…' : 'Allocate'}</Text>
      </Pressable>
    </Sheet>
  );
}

export function PickMealSheet({
  visible,
  recipes,
  slotOptions,
  goals,
  activeSlots,
  onClose,
  onPicked,
}: {
  visible: boolean;
  recipes: readonly Recipe[];
  slotOptions: readonly MealSlotKey[];
  goals: NutritionGoals;
  activeSlots: readonly MealSlotKey[];
  onClose: () => void;
  onPicked: (slot: MealSlotKey, recipe: Recipe) => void;
}) {
  const [slot, setSlot] = useState<MealSlotKey | null>(null);
  const [filters, setFilters] = useState<SwapRecipeFilters>({});
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const options = slotOptions.length > 0 ? slotOptions : MEAL_SLOTS.map((item) => item.key);
  const firstSlot = options[0] ?? null;

  useEffect(() => {
    if (!visible) return;
    setSlot(firstSlot);
    setFilters({});
    setViewing(null);
  }, [firstSlot, visible]);

  const pool = slot ? recipesForPicker(recipes, slot) : [];
  const target = slot ? slotTarget(slot, activeSlots.length > 0 ? activeSlots : options, goals) : null;

  return (
    <Sheet visible={visible} title="Pick a meal" onClose={onClose} desktopMaxWidth={560}>
      <ChoiceBlock label="Meal">
        {options.map((key) => (
          <Chip
            key={key}
            label={slotTitle(key)}
            active={slot === key}
            onPress={() => {
              setSlot(key);
              setViewing(null);
            }}
          />
        ))}
      </ChoiceBlock>
      {slot ? (
        <SwapRecipePicker
          recipes={pool}
          target={target}
          filters={filters}
          viewing={viewing}
          showRandom={false}
          onChangeFilters={setFilters}
          onView={setViewing}
          onPick={(recipe) => onPicked(slot, recipe)}
          onRandom={() => undefined}
        />
      ) : (
        <Text style={styles.choiceEmpty}>Choose a meal first.</Text>
      )}
    </Sheet>
  );
}

export function EatForSheet({
  visible,
  recipeName,
  people,
  familyBlocked,
  error,
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  recipeName: string;
  people: readonly { id: string; name: string }[];
  familyBlocked?: boolean;
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (audiencePersonIds: string[]) => void | Promise<void>;
}) {
  const [eaterId, setEaterId] = useState<string | null>(null);
  const family = eaterId === null && !familyBlocked;
  const canSubmit = !busy && (familyBlocked ? eaterId !== null : true);

  useEffect(() => {
    if (!visible) return;
    setEaterId(familyBlocked ? (people[0]?.id ?? null) : null);
  }, [familyBlocked, people, visible]);

  return (
    <Sheet visible={visible} title="Who is eating?" onClose={onClose} desktopMaxWidth={420}>
      <Text style={styles.eatRecipe} numberOfLines={2}>
        {recipeName}
      </Text>
      <ChoiceBlock label="For">
        {familyBlocked ? null : <Chip label="Family" active={family} onPress={() => setEaterId(null)} />}
        {people.map((person) => (
          <Chip
            key={person.id}
            label={person.name}
            active={eaterId === person.id}
            onPress={() => setEaterId(person.id)}
          />
        ))}
      </ChoiceBlock>
      {familyBlocked ? <Text style={styles.choiceEmpty}>That family meal is already filled.</Text> : null}
      {error ? <Text style={styles.sheetError}>{error}</Text> : null}
      <Pressable
        onPress={() => {
          if (!canSubmit) return;
          const audience = eaterId ? [eaterId] : [];
          void Promise.resolve(onConfirm(audience)).catch(() => undefined);
        }}
        disabled={!canSubmit}
        accessibilityRole="button"
        style={[styles.sheetSubmit, !canSubmit && styles.sheetSubmitDisabled]}>
        <Text style={styles.sheetSubmitLabel}>{busy ? 'Saving…' : 'Add meal'}</Text>
      </Pressable>
    </Sheet>
  );
}

function ChoiceBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.choiceBlock}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceChips}>{children}</View>
    </View>
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
  mealHit: { width: '100%' },
  mealPhoto: { width: '100%' },
  mealBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 4 },
  mealBodyBlank: { paddingTop: 14 },
  mealBodyWithAction: { paddingBottom: 6 },
  addSide: { paddingHorizontal: 14, paddingBottom: 14, alignSelf: 'flex-start' },
  addSideAboveLine: { paddingBottom: 4 },
  addSideLabel: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  sideLines: { paddingHorizontal: 14, paddingBottom: 14, gap: 2 },
  sideLine: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  who: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 8,
  },
  whoTrigger: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  whoLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  whoValueRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 },
  whoValue: { flexShrink: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  whoChevron: { color: colors.textDim, fontSize: 11 },
  whoChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 6 },
  slotLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mealName: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  mealMeta: { color: colors.textDim, fontSize: 13, lineHeight: 18, minHeight: 18 },
  actionTile: {
    flexDirection: 'row',
    minHeight: 92,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionBtnPick: { backgroundColor: colors.accentSoft },
  actionRule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  actionLabel: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  actionLabelPick: { color: colors.accent },
  choiceBlock: { marginBottom: 16 },
  choiceLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  choiceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceEmpty: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  eatRecipe: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 16 },
  sheetError: { color: colors.danger, fontSize: 13, lineHeight: 18, marginBottom: 8 },
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
