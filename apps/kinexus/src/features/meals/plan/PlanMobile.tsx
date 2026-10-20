import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAYS, DAY_LABELS, mondayWeekStart, type Day, type MealSlotKey } from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { Chip, OfflineBanner } from '@/src/features/meals/meals-kit';
import {
  appliedPlanCells,
  audienceLabel,
  planDayMealViews,
  DayStrip,
  PlanAddTile,
  PlanMealCard,
  WeekSwitcher,
  type PlanCellView,
  type PlanPersonFilter,
} from '@/src/features/meals/plan/PlanShared';
import { recipePhotoUrl } from '@/src/features/meals/RecipePhoto';
import type { PlanSlot, useMealsSync } from '@/src/features/meals/use-meals-sync';
import { isoDayNumber, todayDay, weekDayIso } from '@/src/features/meals/week-labels';
import { colors, space } from '@/src/features/shell/theme';

type Meals = ReturnType<typeof useMealsSync>;

export function PlanMobile({
  meals,
  personNames,
  peopleOptions,
  personFilter,
  onPersonFilter,
  selectedDay,
  onSelectDay,
  showGenerate = true,
  canManage = false,
  onOpenSlot,
  onAddMeal,
  onRemoveDay,
  onRestoreDay,
  onGenerate,
  onShopping,
}: {
  meals: Meals;
  personNames: Map<string, string>;
  peopleOptions: { id: string; name: string }[];
  personFilter: PlanPersonFilter;
  onPersonFilter: (next: PlanPersonFilter) => void;
  selectedDay: Day;
  onSelectDay: (day: Day) => void;
  showGenerate?: boolean;
  canManage?: boolean;
  onOpenSlot: (day: Day, slot: MealSlotKey, cell?: PlanSlot) => void;
  onAddMeal: (day: Day) => void;
  onRemoveDay: (day: Day) => void;
  onRestoreDay: (day: Day) => void;
  onGenerate: () => void;
  onShopping: () => void;
}) {
  const insets = useSafeAreaInsets();
  const thisWeek = meals.weekStart === mondayWeekStart();
  const today = todayDay();
  const dateNums = new Map(DAYS.map((day) => [day, isoDayNumber(weekDayIso(meals.weekStart, day))] as const));
  const { cells, removed, filled, kcal } = planDayMealViews(
    meals.activeSlots,
    meals.slotMap,
    meals.slots,
    selectedDay,
    personFilter,
  );
  const applied = appliedPlanCells(cells);
  const dayLabel = thisWeek && selectedDay === today ? 'Today' : DAY_LABELS[selectedDay];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <WeekSwitcher
        weekStart={meals.weekStart}
        onPrev={() => meals.shiftWeek(-1)}
        onNext={() => meals.shiftWeek(1)}
      />
      <DayStrip
        days={DAYS}
        selected={selectedDay}
        today={thisWeek ? today : null}
        dateNums={dateNums}
        onSelect={onSelectDay}
      />
      <View style={styles.filterRow}>
        <Chip label="Everyone" active={personFilter === 'all'} onPress={() => onPersonFilter('all')} />
        {peopleOptions.map((person) => (
          <Chip
            key={person.id}
            label={person.name}
            active={personFilter === person.id}
            onPress={() => onPersonFilter(person.id)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        {showGenerate ? <Btn label="Generate plan" onPress={onGenerate} /> : null}
        <Btn label="Shopping list" variant="secondary" onPress={onShopping} />
      </View>
      <OfflineBanner online={meals.online} pendingCount={meals.pendingCount} extra={meals.importBlockedReason} />
      <ErrorText message={meals.error} />
      <View style={styles.dayMeta}>
        <View style={styles.dayMetaCopy}>
          <Text style={styles.dayTitle}>{dayLabel}</Text>
          <Text style={styles.daySubtitle}>
            {removed
              ? "Not on this week's plan"
              : `${filled} meal${filled === 1 ? '' : 's'}${kcal ? ` · ${Math.round(kcal).toLocaleString()} kcal` : ''}`}
          </Text>
        </View>
        {canManage ? (
          removed ? (
            <Pressable onPress={() => onRestoreDay(selectedDay)} hitSlop={6}>
              <Text style={styles.dayAction}>Restore</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => onRemoveDay(selectedDay)} hitSlop={6}>
              <Text style={styles.dayActionMuted}>Remove day</Text>
            </Pressable>
          )
        ) : null}
      </View>
      {removed ? null : (
        <View style={styles.stack}>
          {applied.map((view) => (
            <MealCardFromView
              key={view.key}
              view={view}
              meals={meals}
              personNames={personNames}
              photoHeight={160}
              onPress={() => onOpenSlot(selectedDay, view.slotKey, view.cell)}
            />
          ))}
          {canManage ? <PlanAddTile onPress={() => onAddMeal(selectedDay)} /> : null}
        </View>
      )}
    </ScrollView>
  );
}

function MealCardFromView({
  view,
  meals,
  personNames,
  photoHeight,
  onPress,
}: {
  view: PlanCellView;
  meals: Meals;
  personNames: Map<string, string>;
  photoHeight: number;
  onPress: () => void;
}) {
  const cell = view.cell;
  const hasRecipe = Boolean(cell?.recipeId);
  const assignee = cell?.assignedPersonId ? personNames.get(cell.assignedPersonId) : null;
  const who = audienceLabel(cell?.audiencePersonIds, personNames);
  return (
    <PlanMealCard
      slot={view.slotKey}
      slotLabel={view.household ? undefined : `${slotTitleCase(view.slotKey)} · ${who}`}
      filled={hasRecipe}
      photoUrl={recipePhotoUrl(meals.recipes, cell?.recipeId)}
      emoji={cell?.emoji}
      title={hasRecipe ? (cell?.recipeName ?? 'Meal') : assignee ? `${assignee} picks` : 'Add meal'}
      meta={[assignee && hasRecipe ? assignee : null, cell?.calories ? `${cell.calories} kcal` : null]
        .filter(Boolean)
        .join(' · ')}
      photoHeight={photoHeight}
      onPress={onPress}
    />
  );
}

function slotTitleCase(slot: MealSlotKey): string {
  return slot.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.md, paddingTop: space.sm, gap: 16 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { gap: 8 },
  dayMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayMetaCopy: { flex: 1, minWidth: 0, gap: 2 },
  dayTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  daySubtitle: { color: colors.textMuted, fontSize: 13 },
  dayAction: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  dayActionMuted: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  stack: { gap: 12 },
});
